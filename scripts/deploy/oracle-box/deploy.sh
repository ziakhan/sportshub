#!/usr/bin/env bash
# SportsHub single-box redeploy: pull latest, migrate, rebuild, restart.
# Run on the box: bash /opt/sportshub/scripts/deploy/oracle-box/deploy.sh
set -euo pipefail

APP_DIR="/opt/sportshub"
ENV_DIR="/etc/sportshub"
APP_USER="sportshub"

echo "==> Pulling latest"
sudo -u "$APP_USER" bash -c "cd $APP_DIR && git pull --ff-only"

echo "==> Installing deps"
sudo -u "$APP_USER" bash -c "cd $APP_DIR && npm install"

echo "==> Schema push + client"
sudo -u "$APP_USER" bash -c "cd $APP_DIR && set -a && . $ENV_DIR/web.env && set +a && npx prisma db push --skip-generate && npx prisma generate"

echo "==> Building (env loaded — NEXT_PUBLIC_* bakes at build time)"
sudo -u "$APP_USER" bash -c "cd $APP_DIR && set -a && . $ENV_DIR/web.env && set +a && npx turbo run build --filter=@youthbasketballhub/web"
sudo -u "$APP_USER" bash -c "cd $APP_DIR/apps/sidecar && npm run build"

echo "==> Restarting services"
sudo systemctl restart sportshub-sidecar sportshub-web

sleep 3
curl -fsS http://127.0.0.1:8080/healthz >/dev/null && echo "sidecar OK"
curl -fsS -o /dev/null -w "web: %{http_code}\n" http://127.0.0.1:3000/
echo "Deployed $(cd $APP_DIR && git rev-parse --short HEAD)"
