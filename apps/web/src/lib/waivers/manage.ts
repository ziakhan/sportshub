// Shared waiver CRUD logic for the league and club management routes.
// Owner is exactly one of { leagueId } | { tenantId }.

import { prisma } from "@youthbasketballhub/db"
import { z } from "zod"
import { getWaiverTemplate } from "@/lib/waivers/templates"

export type WaiverOwner = { leagueId: string } | { tenantId: string }

export const createWaiverSchema = z
  .object({
    templateKey: z.string().optional(),
    title: z.string().trim().min(2).max(160).optional(),
    body: z.string().trim().min(20).max(50_000).optional(),
    type: z
      .enum(["ACKNOWLEDGMENT_INDEMNITY", "CONCUSSION_CODE", "MEDIA_CONSENT", "CUSTOM"])
      .optional(),
    annualRenewal: z.boolean().optional(),
    required: z.boolean().optional(),
  })
  .refine((d) => d.templateKey || (d.title && d.body), {
    message: "Provide a templateKey, or a title and body",
  })

export const updateWaiverSchema = z
  .object({
    title: z.string().trim().min(2).max(160).optional(),
    body: z.string().trim().min(20).max(50_000).optional(),
    annualRenewal: z.boolean().optional(),
    required: z.boolean().optional(),
    active: z.boolean().optional(),
  })
  .refine((d) => Object.keys(d).length > 0, { message: "Nothing to update" })

export async function listWaivers(owner: WaiverOwner) {
  return (prisma as any).waiverDocument.findMany({
    where: owner,
    orderBy: { createdAt: "asc" },
    include: { _count: { select: { signatures: true } } },
  })
}

export async function createWaiver(
  owner: WaiverOwner,
  orgName: string,
  input: z.infer<typeof createWaiverSchema>
) {
  let data: {
    title: string
    body: string
    type: string
    annualRenewal: boolean
    required: boolean
  }
  if (input.templateKey) {
    const template = getWaiverTemplate(input.templateKey)
    if (!template) return { error: "Unknown template" as const }
    data = {
      // Explicit title/body still win over the template (customize-on-create)
      title: input.title ?? template.title,
      body: input.body ?? template.body(orgName),
      type: template.type,
      annualRenewal: input.annualRenewal ?? template.annualRenewal,
      required: input.required ?? true,
    }
  } else {
    data = {
      title: input.title!,
      body: input.body!,
      type: input.type ?? "CUSTOM",
      annualRenewal: input.annualRenewal ?? false,
      required: input.required ?? true,
    }
  }
  const waiver = await (prisma as any).waiverDocument.create({
    data: { ...owner, ...data },
  })
  return { waiver }
}

export async function updateWaiver(
  owner: WaiverOwner,
  waiverId: string,
  input: z.infer<typeof updateWaiverSchema>
) {
  const existing = await (prisma as any).waiverDocument.findFirst({
    where: { id: waiverId, ...owner },
  })
  if (!existing) return { error: "Waiver not found" as const }

  const bodyChanged = input.body !== undefined && input.body !== existing.body
  const waiver = await (prisma as any).waiverDocument.update({
    where: { id: waiverId },
    data: {
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.body !== undefined ? { body: input.body } : {}),
      ...(input.annualRenewal !== undefined ? { annualRenewal: input.annualRenewal } : {}),
      ...(input.required !== undefined ? { required: input.required } : {}),
      ...(input.active !== undefined ? { active: input.active } : {}),
      // Text edits invalidate prior signatures by version bump — everyone
      // re-signs the new text (signatures keep their old snapshot forever).
      ...(bodyChanged ? { version: { increment: 1 } } : {}),
    },
  })
  return { waiver, versionBumped: bodyChanged }
}
