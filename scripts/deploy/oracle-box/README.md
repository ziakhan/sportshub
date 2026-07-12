# Single-box deploy — Oracle Cloud Ubuntu

Everything on one machine: Postgres, Redis, the Next.js web app, the
realtime/push sidecar, Caddy with automatic HTTPS, the four daily crons,
and nightly DB backups. Same code as the Vercel/Railway/Neon stack — the
services just talk over localhost. Demo-grade production; scale out later
by lifting each piece back onto its own host unchanged.

## What lands where

| Piece | How it runs | Port |
|---|---|---|
| Next.js web | systemd `sportshub-web` | 3000 (local) |
| Realtime + push sidecar | systemd `sportshub-sidecar` | 8080 (local) |
| PostgreSQL 14/16 | distro service | 5432 (local) |
| Redis (push queue) | distro service | 6379 (local) |
| Caddy | routes `https://DOMAIN` → web, `/socket.io/*` → sidecar; auto-TLS | 80/443 (public) |
| Crons | root crontab → curls the 4 `/api/cron/*` routes with `CRON_SECRET` | — |
| Backups | `/etc/cron.daily/sportshub-backup` → gzip pg_dump, keeps 14 | — |

The sidecar's `/internal/*` endpoints are **not** exposed publicly — the web
app reaches them via `http://127.0.0.1:8080`; only `/socket.io` is routed.

## Prerequisites (owner)

1. An Ubuntu 22.04/24.04 box (ARM or x86 both fine) with a public IP.
2. **OCI console:** VCN → Security List → ingress rules for TCP 80 + 443.
3. **DNS:** an A record (e.g. `demo.yourdomain.com`) → the box's public IP.
   No domain? `<ip>.sslip.io` works as DOMAIN for a throwaway demo.
4. A GitHub token with read access to `ziakhan/sportshub`
   (github.com → Settings → Developer settings → Fine-grained token →
   this repo → Contents: Read).

## Run it

```bash
scp scripts/deploy/oracle-box/setup.sh ubuntu@<box>:
ssh ubuntu@<box>
export DOMAIN="demo.yourdomain.com"
export GITHUB_TOKEN="github_pat_..."
export SEED="nph"        # NPH demo world (parent@sportshub.demo etc.) | base | none
bash setup.sh
```

~10 minutes. At the end it prints the smoke check + next steps.

## Day-2

- **Redeploy after code changes:** `bash /opt/sportshub/scripts/deploy/oracle-box/deploy.sh`
- **Logs:** `journalctl -u sportshub-web -f` / `-u sportshub-sidecar -f`
- **Secrets** live in `/etc/sportshub/` (`web.env`, `sidecar.env`, generated `.cron` etc.)
- **Stripe (when ready):** add the 3 STRIPE vars to `web.env`, point the
  Stripe webhook at `https://DOMAIN/api/webhooks/stripe`, run deploy.sh.
- **Native apps against this box:** build with
  `EXPO_PUBLIC_API_URL=https://DOMAIN` and `EXPO_PUBLIC_SOCKET_URL=https://DOMAIN`
  (eas.json profiles) — the socket path rides the same domain via Caddy.
- **Reseed the demo world:** `cd /opt/sportshub && set -a && . /etc/sportshub/web.env && set +a && npx tsx scripts/seed-nph-demo.ts`

## What this replaces (and what it doesn't)

- Replaces: Vercel hosting (+ Pro-plan cron limits), Railway sidecar, Neon DB
  — for the demo. The existing Vercel/Neon prod is untouched and runs in
  parallel until you decide which is canonical.
- Doesn't replace: Expo's push delivery (outbound HTTPS from the sidecar —
  works from anywhere), EAS builds, Stripe, Apple/Google programs.
