#!/usr/bin/env bash
set -euo pipefail

base_url="${1:-https://xpotato.net}"
www_url="${2:-https://www.xpotato.net}"
asset_url="${3:-}"

base_status="$(curl -sS -o /dev/null -w '%{http_code}' "$base_url/")"
www_status="$(curl -sS -o /dev/null -w '%{http_code}' -I "$www_url/")"
robots_text="$(curl -fsSL "$base_url/robots.txt")"

echo "base_status: $base_status"
echo "www_status: $www_status"

if [ "$base_status" != "200" ]; then
  echo "unexpected base status" >&2
  exit 1
fi

if [ "$www_status" != "301" ]; then
  echo "unexpected www redirect status" >&2
  exit 1
fi

if ! grep -Fq "Sitemap: https://xpotato.net/sitemap-index.xml" <<<"$robots_text"; then
  echo "robots.txt does not contain the expected sitemap line" >&2
  exit 1
fi

if [ -n "$asset_url" ]; then
  bash scripts/check-r2-asset.sh "$asset_url"
fi

echo "public checks passed"
