#!/usr/bin/env bash
# Checks a deployed tello.live Worker: every main page answers 200 and /api/health reports the database working.
# Usage: scripts/smoke.sh https://tello-live.infomomtelo.workers.dev
set -uo pipefail
BASE="${1%/}"
fail=0
for path in / /business /business/manage /models /install /make /videos /website /social-setup /sitemap.xml /robots.txt /llms.txt /api/public/tello-hub/config; do
  code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 30 "$BASE$path")
  echo "$code $path"
  [ "$code" = "200" ] || fail=1
done
health=$(curl -s --max-time 30 "$BASE/api/health")
echo "health: $health"
[ "$(printf %s "$health" | jq -r '.db // false')" = "true" ] || { echo "::error::The database check failed."; fail=1; }
for k in anthropic stripe email; do
  [ "$(printf %s "$health" | jq -r ".$k // false")" = "true" ] || echo "::warning::$k key is not set on the Worker yet."
done
exit $fail
