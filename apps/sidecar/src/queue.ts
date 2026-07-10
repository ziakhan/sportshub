import { Queue, Worker } from "bullmq"
import Redis from "ioredis"
import { PrismaClient } from "@prisma/client"
import { env } from "./env"
import {
  processReceipts,
  processSend,
  RECEIPT_DELAY_MS,
  type PushDb,
  type PushItem,
} from "./push"

/**
 * Push queue wiring (M3). Two modes, chosen by env:
 * - REDIS_URL set   → BullMQ: durable jobs, retries with backoff, real
 *                     delayed receipt checks. Production (Railway) mode.
 * - REDIS_URL unset → in-process: immediate send, setTimeout receipts.
 *                     Local dev only — jobs die with the process.
 * Either way the interface to the HTTP layer is just enqueueSend().
 */

export interface PushQueue {
  enqueueSend(items: PushItem[]): Promise<void>
  /** Null when push is disabled (no DATABASE_URL) — the endpoint 503s. */
  enabled: boolean
}

export function createPushQueue(): PushQueue {
  if (!env.databaseUrl) {
    console.warn("push disabled: DATABASE_URL not set (device lookups need it)")
    return { enabled: false, enqueueSend: async () => {} }
  }

  const prisma = new PrismaClient({
    datasources: { db: { url: env.databaseUrl } },
  }) as unknown as PushDb

  if (env.redisUrl) {
    // `as any`: bullmq ships its own nested ioredis whose types clash with
    // the hoisted instance we construct; the runtime objects are compatible.
    const connection = new Redis(env.redisUrl, { maxRetriesPerRequest: null }) as any
    const queue = new Queue("push", { connection })

    const deps = {
      db: prisma,
      fetchFn: fetch,
      now: () => new Date(),
      scheduleReceipts: async (receiptMap: Record<string, string>) => {
        await queue.add(
          "receipts",
          { receiptMap },
          { delay: RECEIPT_DELAY_MS, attempts: 3, backoff: { type: "exponential", delay: 60_000 } }
        )
      },
    }

    new Worker(
      "push",
      async (job) => {
        if (job.name === "send") await processSend(job.data.items as PushItem[], deps)
        else if (job.name === "receipts") {
          await processReceipts(job.data.receiptMap as Record<string, string>, deps)
        }
      },
      {
        connection: new Redis(env.redisUrl, { maxRetriesPerRequest: null }) as any,
        concurrency: 2,
      }
    ).on("failed", (job, err) => {
      console.error(`push job ${job?.name} failed:`, err.message)
    })

    return {
      enabled: true,
      enqueueSend: async (items) => {
        await queue.add(
          "send",
          { items },
          { attempts: 3, backoff: { type: "exponential", delay: 30_000 } }
        )
      },
    }
  }

  // Dev fallback — no durability, no retries
  const deps = {
    db: prisma,
    fetchFn: fetch,
    now: () => new Date(),
    scheduleReceipts: async (receiptMap: Record<string, string>) => {
      setTimeout(() => {
        processReceipts(receiptMap, deps).catch((err) =>
          console.error("push receipts failed:", err.message)
        )
      }, RECEIPT_DELAY_MS)
    },
  }
  return {
    enabled: true,
    enqueueSend: async (items) => {
      setImmediate(() => {
        processSend(items, deps).catch((err) => console.error("push send failed:", err.message))
      })
    },
  }
}
