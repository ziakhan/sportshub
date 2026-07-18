#!/usr/bin/env bash
# Serve sportshubone.com alongside ysportshub.com (owner ruling 2026-07-18:
# both domains fully standalone, incl. SSO) and enable AUTH_TRUST_HOST so
# next-auth builds OAuth callbacks from the request host (Caddy already
# forwards X-Forwarded-Host). Idempotent; safe to run before DNS points at
# the box (Caddy retries cert issuance until it does).
#
# Run on the box as root:  sudo bash add-sportshubone-domain.sh
set -euo pipefail

CADDYFILE=/etc/caddy/Caddyfile
WEBENV=/etc/sportshub/web.env

if ! grep -q '^sportshubone\.com' "$CADDYFILE"; then
  cp "$CADDYFILE" "$CADDYFILE.bak-$(date +%Y%m%d%H%M%S)"
  tee -a "$CADDYFILE" > /dev/null <<'EOF'

sportshubone.com {
	encode gzip
	@socket path /socket.io/*
	reverse_proxy @socket 127.0.0.1:8080
	reverse_proxy 127.0.0.1:3000 {
		header_up X-Forwarded-Host {host}
	}
}
www.sportshubone.com {
	redir https://sportshubone.com{uri} permanent
}
EOF
  caddy validate --config "$CADDYFILE"
  systemctl reload caddy
  echo "caddy: sportshubone.com + www added, reloaded"
else
  echo "caddy: sportshubone.com already configured"
fi

if ! grep -q '^AUTH_TRUST_HOST=' "$WEBENV"; then
  echo 'AUTH_TRUST_HOST=true' >> "$WEBENV"
  systemctl restart sportshub-web
  echo "web.env: AUTH_TRUST_HOST=true set, sportshub-web restarted"
else
  echo "web.env: AUTH_TRUST_HOST already set"
fi

echo "done — once GoDaddy A record for sportshubone.com -> 147.5.125.7 lands, TLS auto-issues"
