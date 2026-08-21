#!/usr/bin/env bash
# SportsHub STAGING redeploy (ysportshub.com). Same shape as deploy.sh, but it
# only ever touches the staging checkout, database, ports and services.
#
#   ssh sh 'sudo /opt/sportshub-staging/scripts/deploy/oracle-box/deploy-staging.sh [branch]'
#
# Default branch is whatever staging is already on, so a plain run is "update
# what I am testing". Pass a branch name to move staging onto it.
set -euo pipefail

APP_DIR="/opt/sportshub-staging"
ENV_FILE="/etc/sportshub/web-staging.env"
APP_USER="sportshub"
BRANCH="${1:-}"

# The script lives inside the checkout it is about to rewrite, and bash reads a
# script as it runs. Re-exec from a copy so a pull can never swap the file out
# from under the running shell.
if [ "${STAGING_DEPLOY_REEXEC:-}" != "1" ]; then
  TMP="$(mktemp /tmp/deploy-staging.XXXXXX.sh)"
  cp "$0" "$TMP"
  chmod +x "$TMP"
  STAGING_DEPLOY_REEXEC=1 exec "$TMP" "$@"
fi
trap 'rm -f "$0"' EXIT

echo "==> Staging deploy starting"
if [ -n "$BRANCH" ]; then
  echo "==> Switching to branch $BRANCH"
  sudo -u "$APP_USER" bash -c "cd $APP_DIR && git fetch origin --prune && git checkout $BRANCH && git reset --hard origin/$BRANCH"
else
  sudo -u "$APP_USER" bash -c "cd $APP_DIR && git pull --ff-only"
fi

echo "==> Installing deps"
sudo -u "$APP_USER" bash -c "cd $APP_DIR && npm install"

echo "==> Schema push + client (STAGING database only)"
sudo -u "$APP_USER" bash -c "cd $APP_DIR && set -a && . $ENV_FILE && set +a && npx prisma db push --skip-generate && npx prisma generate"

echo "==> Building"
sudo -u "$APP_USER" bash -c "cd $APP_DIR && set -a && . $ENV_FILE && set +a && npx turbo run build --filter=@youthbasketballhub/web"
sudo -u "$APP_USER" bash -c "cd $APP_DIR/apps/sidecar && npm run build"

echo "==> Restarting staging services"
sudo systemctl restart sportshub-sidecar-staging sportshub-web-staging

sleep 4
curl -fsS -m 10 http://127.0.0.1:8180/healthz >/dev/null && echo "staging sidecar OK"
curl -fsS -m 15 -o /dev/null -w "staging web: %{http_code}\n" http://127.0.0.1:3100/
# Production is a different stack entirely; report it so a staging deploy can
# never quietly coincide with a production problem.
curl -fsS -m 15 -o /dev/null -w "production web (untouched): %{http_code}\n" http://127.0.0.1:3000/
echo "Staging now at $(cd $APP_DIR && git rev-parse --short HEAD) on $(cd $APP_DIR && git rev-parse --abbrev-ref HEAD)"
