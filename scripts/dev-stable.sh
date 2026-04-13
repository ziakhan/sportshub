#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
APP_DIR="$ROOT_DIR/apps/web"
APP_URL="http://localhost:3000/"
MAX_WAIT_SECONDS=90
MAX_ATTEMPTS=2
DEV_PID=""

cleanup_build_artifacts() {
  local pids
  pids="$(lsof -ti:3000 2>/dev/null || true)"
  if [[ -n "$pids" ]]; then
    kill $pids 2>/dev/null || true
    sleep 1
    pids="$(lsof -ti:3000 2>/dev/null || true)"
    if [[ -n "$pids" ]]; then
      kill -9 $pids 2>/dev/null || true
    fi
  fi

  rm -rf "$APP_DIR/.next"
}

start_dev_server() {
  npm --workspace @youthbasketballhub/web run dev &
  DEV_PID=$!
}

wait_for_homepage() {
  local start now
  start="$(date +%s)"

  while true; do
    if ! kill -0 "$DEV_PID" 2>/dev/null; then
      echo "Dev server process exited before becoming healthy."
      return 1
    fi

    local code
    code="$(curl -s -o /tmp/ybh-home.html -w '%{http_code}' "$APP_URL" || true)"

    # Accept any non-5xx response while warming up routing.
    if [[ "$code" =~ ^[1234][0-9][0-9]$ ]]; then
      return 0
    fi

    now="$(date +%s)"
    if (( now - start >= MAX_WAIT_SECONDS )); then
      echo "Timed out waiting for homepage readiness. Last HTTP code: $code"
      return 1
    fi

    sleep 1
  done
}

validate_runtime_assets() {
  if grep -q "Cannot find module './" /tmp/ybh-home.html; then
    echo "Detected stale server chunk error in homepage output."
    return 1
  fi

  if grep -q "webpack-runtime.js" /tmp/ybh-home.html; then
    echo "Detected webpack runtime stack in homepage output."
    return 1
  fi

  local assets
  assets="$(grep -oE '"/_next/static/[^"]+"' /tmp/ybh-home.html | tr -d '"' | sort -u || true)"

  if [[ -z "$assets" ]]; then
    echo "No static assets found in homepage HTML."
    return 1
  fi

  local bad=0
  local asset code
  while IFS= read -r asset; do
    [[ -z "$asset" ]] && continue
    code="$(curl -s -o /dev/null -w '%{http_code}' "http://localhost:3000$asset" || true)"
    if [[ ! "$code" =~ ^(200|301|302|307|308)$ ]]; then
      echo "Bad asset response: $code $asset"
      bad=1
    fi
  done <<< "$assets"

  if [[ "$bad" -ne 0 ]]; then
    return 1
  fi

  return 0
}

stop_dev_server() {
  if [[ -n "$DEV_PID" ]] && kill -0 "$DEV_PID" 2>/dev/null; then
    kill "$DEV_PID" 2>/dev/null || true
    wait "$DEV_PID" 2>/dev/null || true
  fi
}

attempt_start() {
  local attempt="$1"

  echo "[$attempt/$MAX_ATTEMPTS] Starting clean dev server..."
  cleanup_build_artifacts
  start_dev_server

  if ! wait_for_homepage; then
    stop_dev_server
    return 1
  fi

  if ! validate_runtime_assets; then
    echo "[$attempt/$MAX_ATTEMPTS] Runtime validation failed, retrying with a clean restart..."
    stop_dev_server
    return 1
  fi

  echo "Dev server is healthy at $APP_URL"
  return 0
}

trap 'stop_dev_server; exit 0' INT TERM

for attempt in $(seq 1 "$MAX_ATTEMPTS"); do
  if attempt_start "$attempt"; then
    wait "$DEV_PID"
    exit $?
  fi

done

echo "Failed to start a healthy dev server after $MAX_ATTEMPTS attempts."
echo "Try: npm run dev:reset"
exit 1
