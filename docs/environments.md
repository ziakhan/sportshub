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
