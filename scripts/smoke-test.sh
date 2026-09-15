#!/usr/bin/env sh
set -eu

BASE_URL="${BASE_URL:-http://localhost:3000/api/v1}"

curl -fsS "$BASE_URL/health" >/dev/null
curl -fsS "$BASE_URL/health/ready" >/dev/null

echo "AuthForge smoke checks passed"
