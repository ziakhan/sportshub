#!/usr/bin/env bash
# ============================================================================
# SportsHub — single-box provisioning for a clean Ubuntu server (Oracle Cloud)
#
# Everything on one machine: PostgreSQL + Redis + Next.js web + realtime/push
# sidecar + Caddy (auto-HTTPS) + crons + nightly backups. Demo-grade prod:
# the same code that runs on Vercel/Railway/Neon, minus the network hops.
#
# Usage (as a sudo-capable user on the box):
#   export DOMAIN="demo.example.com"          # DNS A record -> this box's IP
#   export GITHUB_TOKEN="ghp_..."             # read access to ziakhan/sportshub
#   export SEED="nph"                         # "nph" demo world | "base" | "none"
#   curl -fsSL <raw url of this file> | bash   (or scp it up and: bash setup.sh)
#
# Idempotent-ish: safe to re-run; it skips what already exists.
# ============================================================================
set -euo pipefail

DOMAIN="${DOMAIN:?set DOMAIN to your hostname (DNS must point at this box)}"
GITHUB_TOKEN="${GITHUB_TOKEN:?set GITHUB_TOKEN (repo read access)}"
SEED="${SEED:-nph}"
REPO="ziakhan/sportshub"
APP_USER="sportshub"
APP_DIR="/opt/sportshub"
ENV_DIR="/etc/sportshub"

echo "==> [1/10] System packages"
export DEBIAN_FRONTEND=noninteractive
sudo apt-get update -y
sudo apt-get install -y curl git ca-certificates gnupg postgresql postgresql-contrib redis-server

echo "==> [2/10] Node 20 LTS"
if ! command -v node >/dev/null || [[ "$(node -v)" != v20* ]]; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
  sudo apt-get install -y nodejs
fi
node -v

echo "==> [3/10] Caddy (reverse proxy + automatic HTTPS)"
if ! command -v caddy >/dev/null; then
  sudo apt-get install -y debian-keyring debian-archive-keyring apt-transport-https
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
  sudo apt-get update -y && sudo apt-get install -y caddy
fi

echo "==> [4/10] Open the firewall (Oracle images ship restrictive iptables)"
# OCI Ubuntu images have a REJECT-all rule; insert HTTP/S before it.
sudo iptables -C INPUT -p tcp --dport 80 -j ACCEPT 2>/dev/null || sudo iptables -I INPUT 5 -p tcp --dport 80 -j ACCEPT
sudo iptables -C INPUT -p tcp --dport 443 -j ACCEPT 2>/dev/null || sudo iptables -I INPUT 5 -p tcp --dport 443 -j ACCEPT
sudo apt-get install -y iptables-persistent >/dev/null 2>&1 || true
sudo netfilter-persistent save >/dev/null 2>&1 || true
echo "    NOTE: also allow TCP 80+443 in the OCI console -> VCN -> Security List (ingress)."

echo "==> [5/10] App user, database, secrets"
id -u "$APP_USER" >/dev/null 2>&1 || sudo useradd -r -m -d "/home/$APP_USER" -s /bin/bash "$APP_USER"
DB_PASS_FILE="$ENV_DIR/.db_pass"
sudo mkdir -p "$ENV_DIR"
if ! sudo test -f "$DB_PASS_FILE"; then
  openssl rand -hex 24 | sudo tee "$DB_PASS_FILE" >/dev/null
  sudo chmod 600 "$DB_PASS_FILE"
fi
DB_PASS="$(sudo cat "$DB_PASS_FILE")"
sudo -u postgres psql -tc "SELECT 1 FROM pg_roles WHERE rolname='sportshub'" | grep -q 1 || \
  sudo -u postgres psql -c "CREATE ROLE sportshub LOGIN PASSWORD '$DB_PASS'"
sudo -u postgres psql -tc "SELECT 1 FROM pg_database WHERE datname='youthbasketballhub'" | grep -q 1 || \
  sudo -u postgres createdb -O sportshub youthbasketballhub
DATABASE_URL="postgresql://sportshub:${DB_PASS}@127.0.0.1:5432/youthbasketballhub"

gen_secret() { openssl rand -base64 32 | tr -d '\n'; }
persist_secret() { # $1=name -> prints value, generating once
  local f="$ENV_DIR/.$1"
  if ! sudo test -f "$f"; then gen_secret | sudo tee "$f" >/dev/null; sudo chmod 600 "$f"; fi
  sudo cat "$f"
}
NEXTAUTH_SECRET="$(persist_secret nextauth)"
AUTH_TOKEN_SECRET="$(persist_secret auth_token)"
SIDECAR_SHARED_SECRET="$(persist_secret sidecar_shared)"
CRON_SECRET="$(persist_secret cron)"

echo "==> [6/10] Clone / update the repo"
if [ ! -d "$APP_DIR/.git" ]; then
  sudo git clone "https://x-access-token:${GITHUB_TOKEN}@github.com/${REPO}.git" "$APP_DIR"
else
  (cd "$APP_DIR" && sudo git remote set-url origin "https://x-access-token:${GITHUB_TOKEN}@github.com/${REPO}.git" && sudo git pull --ff-only)
fi
sudo chown -R "$APP_USER:$APP_USER" "$APP_DIR"

echo "==> [7/10] Environment files"
sudo tee "$ENV_DIR/web.env" >/dev/null <<EOF
NODE_ENV=production
DATABASE_URL=${DATABASE_URL}
NEXTAUTH_URL=https://${DOMAIN}
NEXTAUTH_SECRET=${NEXTAUTH_SECRET}
AUTH_TOKEN_SECRET=${AUTH_TOKEN_SECRET}
CRON_SECRET=${CRON_SECRET}
SIDECAR_URL=http://127.0.0.1:8080
SIDECAR_SHARED_SECRET=${SIDECAR_SHARED_SECRET}
NEXT_PUBLIC_SOCKET_URL=https://${DOMAIN}
APP_TIMEZONE=America/Toronto
# Fill these in when ready, then run deploy.sh (payments / AI recaps):
#STRIPE_SECRET_KEY=
#STRIPE_WEBHOOK_SECRET=
#NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
#ANTHROPIC_API_KEY=
#NEXT_PUBLIC_GOOGLE_PLACES_API_KEY=
EOF
sudo tee "$ENV_DIR/sidecar.env" >/dev/null <<EOF
NODE_ENV=production
PORT=8080
DATABASE_URL=${DATABASE_URL}
AUTH_TOKEN_SECRET=${AUTH_TOKEN_SECRET}
SIDECAR_SHARED_SECRET=${SIDECAR_SHARED_SECRET}
CORS_ORIGINS=https://${DOMAIN}
APP_TIMEZONE=America/Toronto
REDIS_URL=redis://127.0.0.1:6379
EOF
sudo chmod 640 "$ENV_DIR"/*.env
sudo chgrp "$APP_USER" "$ENV_DIR"/*.env

echo "==> [8/10] Install deps, push schema, seed, build"
sudo -u "$APP_USER" bash -c "cd $APP_DIR && npm install"
sudo -u "$APP_USER" bash -c "cd $APP_DIR && set -a && . $ENV_DIR/web.env && set +a && npx prisma db push --skip-generate && npx prisma generate"
case "$SEED" in
  nph)  sudo -u "$APP_USER" bash -c "cd $APP_DIR && set -a && . $ENV_DIR/web.env && set +a && npx tsx scripts/seed-nph-demo.ts" ;;
  base) sudo -u "$APP_USER" bash -c "cd $APP_DIR/packages/db && set -a && . $ENV_DIR/web.env && set +a && npm run db:seed" ;;
  none) echo "    (seed skipped)" ;;
esac
# NEXT_PUBLIC_* vars are baked at build time — env must be loaded for the build
sudo -u "$APP_USER" bash -c "cd $APP_DIR && set -a && . $ENV_DIR/web.env && set +a && npx turbo run build --filter=@youthbasketballhub/web"
sudo -u "$APP_USER" bash -c "cd $APP_DIR/apps/sidecar && npm run build"

echo "==> [9/10] systemd services + Caddy + crons + backups"
sudo tee /etc/systemd/system/sportshub-web.service >/dev/null <<EOF
[Unit]
Description=SportsHub web (Next.js)
After=network.target postgresql.service
[Service]
User=${APP_USER}
WorkingDirectory=${APP_DIR}/apps/web
EnvironmentFile=${ENV_DIR}/web.env
ExecStart=/usr/bin/npx next start -p 3000
Restart=always
RestartSec=3
[Install]
WantedBy=multi-user.target
EOF
sudo tee /etc/systemd/system/sportshub-sidecar.service >/dev/null <<EOF
[Unit]
Description=SportsHub realtime/push sidecar
After=network.target postgresql.service redis-server.service
[Service]
User=${APP_USER}
WorkingDirectory=${APP_DIR}/apps/sidecar
EnvironmentFile=${ENV_DIR}/sidecar.env
ExecStart=/usr/bin/node dist/index.js
Restart=always
RestartSec=3
[Install]
WantedBy=multi-user.target
EOF
sudo tee /etc/caddy/Caddyfile >/dev/null <<EOF
${DOMAIN} {
	encode gzip
	@socket path /socket.io/*
	reverse_proxy @socket 127.0.0.1:8080
	reverse_proxy 127.0.0.1:3000
}
EOF
sudo systemctl daemon-reload
sudo systemctl enable --now redis-server postgresql
sudo systemctl enable --now sportshub-web sportshub-sidecar
sudo systemctl reload caddy || sudo systemctl restart caddy

# Crons: same four sweeps Vercel would run, no plan limits here
( sudo crontab -l 2>/dev/null | grep -v sportshub-cron ; cat <<EOF
0 9 * * *  curl -fsS -H "x-cron-secret: ${CRON_SECRET}" https://${DOMAIN}/api/cron/charge-due        >/dev/null 2>&1 # sportshub-cron
15 9 * * * curl -fsS -H "x-cron-secret: ${CRON_SECRET}" https://${DOMAIN}/api/cron/expire-offers     >/dev/null 2>&1 # sportshub-cron
30 9 * * * curl -fsS -H "x-cron-secret: ${CRON_SECRET}" https://${DOMAIN}/api/cron/payment-reminders >/dev/null 2>&1 # sportshub-cron
45 9 * * * curl -fsS -H "x-cron-secret: ${CRON_SECRET}" https://${DOMAIN}/api/cron/rsvp-reminders    >/dev/null 2>&1 # sportshub-cron
EOF
) | sudo crontab -

# Nightly DB backup, keep 14
sudo tee /etc/cron.daily/sportshub-backup >/dev/null <<'EOF'
#!/bin/sh
mkdir -p /var/backups/sportshub
sudo -u postgres pg_dump youthbasketballhub | gzip > "/var/backups/sportshub/db-$(date +%F).sql.gz"
ls -1t /var/backups/sportshub/db-*.sql.gz | tail -n +15 | xargs -r rm
EOF
sudo chmod +x /etc/cron.daily/sportshub-backup

echo "==> [10/10] Smoke check"
sleep 3
curl -fsS http://127.0.0.1:8080/healthz && echo "  sidecar OK"
curl -fsS -o /dev/null -w "  web local: %{http_code}\n" http://127.0.0.1:3000/
echo ""
echo "DONE. Now:"
echo "  1. OCI console: VCN Security List must allow ingress TCP 80 + 443."
echo "  2. DNS: A record ${DOMAIN} -> this box's public IP (Caddy fetches TLS automatically on first hit)."
echo "  3. Open https://${DOMAIN} — demo logins: parent@sportshub.demo / TestPass123!"
echo "  4. Stripe webhook (when keys added): https://${DOMAIN}/api/webhooks/stripe"
echo "Secrets live in ${ENV_DIR} (CRON_SECRET etc.). Redeploy after code changes: bash ${APP_DIR}/scripts/deploy/oracle-box/deploy.sh"
