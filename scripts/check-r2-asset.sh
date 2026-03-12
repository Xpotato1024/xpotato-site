#!/usr/bin/env bash
set -euo pipefail

if [ $# -lt 1 ]; then
  echo "usage: bash scripts/check-r2-asset.sh <r2:/path/or/https-url>" >&2
  exit 1
fi

input="$1"

if [[ "$input" == r2:/* ]]; then
  url="https://assets.xpotato.net/${input#r2:/}"
else
  url="$input"
fi

status="$(curl -sS -o /dev/null -w '%{http_code}' -I "$url")"

echo "url: $url"
echo "status: $status"

if [ "$status" != "200" ]; then
  echo "asset is not ready for production use" >&2
  exit 1
fi
