---
updated: 2026-08-21
tags: [theme/infra, type/runbook, status/living]
---

# The two environments

One box, two completely separate stacks. Built 2026-08-21 because "the test domain" was in fact production wearing a second name, so nobody had anywhere safe to manipulate data.

| | Production | Staging |
|---|---|---|
| Domain | sportshubone.com | **ysportshub.com** |
| Code | `/opt/sportshub` on `master` | `/opt/sportshub-staging`, any branch |
| Web port | 3000 | 3100 |
| Sidecar | 8080 | 8180 |
| Database | `youthbasketballhub` | `youthbasketballhub_staging` |
| Uploads | `/var/lib/sportshub/uploads` | `/var/lib/sportshub-staging/uploads` |
| Env file | `/etc/sportshub/web.env` | `/etc/sportshub/web-staging.env` |
| Services | `sportshub-web`, `sportshub-sidecar` | `sportshub-web-staging`, `sportshub-sidecar-staging` |
| Email | real, via OCI | **Mailpit, captured on the box, never delivered** |
| SMS | Twilio live | **absent on purpose** |
| Analytics | GA4 | **absent on purpose** |
| Crons | charge-due, payment-reminders, waiver-reminders (all hit :3000) | **none** |
| Secrets | production set | freshly generated, shares nothing with production |

Staging's data is a clone of production taken 2026-08-21, so it is real-shaped. Break it freely; re-clone whenever (see below).

## Deploying

**Production** (needs the owner's explicit approval, every time):
```
git push origin HEAD:master
ssh sh 'sudo /opt/sportshub/scripts/deploy/oracle-box/deploy.sh'
```

**Staging** (no approval needed, it is a sandbox):
```
git push origin HEAD:<branch>
ssh sh 'sudo /opt/sportshub-staging/scripts/deploy/oracle-box/deploy-staging.sh <branch>'
```
Omit the branch to just update whatever staging is already on.

Both scripts now re-exec from a copy in /tmp, because a deploy script that lives inside the checkout it is rewriting can otherwise be swapped out mid-run by its own `git pull`.

## Reading staging's email

Mailpit binds to loopback only. Tunnel to it:
```
ssh -L 8125:127.0.0.1:8125 sh
```
then open http://127.0.0.1:8125. Every invitation, waiver notice and receipt staging sends lands there and nowhere else.

## Re-cloning production data into staging

Read-only against production; drops and rebuilds staging:
```
sudo -u postgres pg_dump -Fc youthbasketballhub -f /tmp/p.dump
sudo systemctl stop sportshub-web-staging
sudo -u postgres dropdb --force youthbasketballhub_staging
sudo -u postgres createdb -O sportshub youthbasketballhub_staging
sudo -u postgres pg_restore -d youthbasketballhub_staging --no-owner --role=sportshub /tmp/p.dump
sudo -u postgres psql -d youthbasketballhub_staging -c "UPDATE \"PlatformSettings\" SET \"uploadLocalDir\"='/var/lib/sportshub-staging/uploads';"
sudo -u sportshub bash -c "cd /opt/sportshub-staging && set -a && . /etc/sportshub/web-staging.env && set +a && npx prisma db push --skip-generate"
sudo systemctl start sportshub-web-staging; sudo rm -f /tmp/p.dump
```
**The uploads line is not optional.** A clone brings production's uploads path with it, and without the reset staging would write test images into production's folder.

## Isolation audit, 2026-08-21

Run against the live box, evidence not assumption. **Verified separate:** filesystem trees (no crossing symlinks) · databases (`youthbasketballhub` 89MB vs `youthbasketballhub_staging` 52MB, each env file pointing at its own) · ports and processes · every service's working directory and env file · **every secret value distinct** (NEXTAUTH, AUTH_TOKEN, SIDECAR_SHARED, CRON, DATABASE_URL) · email (production to OCI, staging to Mailpit on loopback) · crons (all three name `127.0.0.1:3000`, production only) · Caddy routes and the two separate uploads snippets · uploads directories per database · git checkouts and branches · the nightly backup (names `youthbasketballhub` explicitly, 14 dailies kept; staging is deliberately not backed up).

**Absent from staging on purpose, re-verified by exact count:** `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `NEXT_PUBLIC_GA_ID`, `STRIPE_SECRET_KEY`.

### One real leak, found and fixed
Both sidecars created a BullMQ queue named `push` on the **same Redis database**, so staging's worker was eligible to consume production's push-notification jobs (a real family's notification silently swallowed by staging) and the reverse. Staging now runs on Redis db1 (`redis://127.0.0.1:6379/1`); production stays on db0. Verified after the change: db0 production keys, db1 staging keys.

### Couplings that remain, ranked
1. **One Postgres role.** Both connect as `sportshub`, so the separation is configuration, not permission: an env file pointing at the wrong database would simply work. Fix when convenient: a `sportshub_staging` role owning the staging database (do it by recreating and re-cloning; never `REASSIGN OWNED`, which also touches shared objects like database ownership).
2. **One Linux user.** Both services run as `sportshub`, and `/etc/sportshub/web.env` is `root:sportshub 640`, so a staging process can read production's secrets. Fix: a dedicated staging user.
3. **Scripts inside the staging tree that hardcode production paths** (`deploy.sh`, `setup.sh`, `reseed-demo.sh`). Both deploy scripts now refuse to run from the wrong tree; the others are still landmines, so always check `APP_DIR` before running anything from `scripts/deploy/`.
4. **CPU, Postgres server process, Caddy config, the box itself.** Inherent to one machine; containers would remove the first three.

## What the two still share

Honest list, because "isolated" has limits on one box:

- **CPU** (2 cores). A staging build makes production briefly sluggish. Do not build both at once.
- **The Postgres server** (separate databases, same process). A runaway staging query can still contend for the same server.
- **Caddy** (one config file). Editing it touches both; always `caddy validate` then `systemctl reload` (never restart), and keep a timestamped backup.
- **The box itself.** A reboot takes both down.
- **Redis**, if the sidecar uses it: verify key separation before relying on it.

Containers would remove the first three. Worth doing when scale demands it; not needed yet.

## Stripe on staging

Staging is where **test** keys belong (`sk_test_`, `pk_test_`, `whsec_`). Add them to `web-staging.env` only. Never put live keys on staging, and never put test keys on production. With no keys at all (today's state) both environments are offline-only and no card can be charged.
