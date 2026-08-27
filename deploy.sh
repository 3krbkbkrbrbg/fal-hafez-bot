#!/usr/bin/env bash
# Deploy fal-hafez-bot (fal + voice-to-text + translate) to Cloudflare Workers
set -e
cd "$(dirname "$0")"

export CLOUDFLARE_API_TOKEN="${CLOUDFLARE_API_TOKEN:-$(cat /tmp/.cf_token 2>/dev/null)}"
if [ -z "$CLOUDFLARE_API_TOKEN" ]; then
  echo "❌ CLOUDFLARE_API_TOKEN not set"; exit 1
fi
if [ -z "$TG_BOT_TOKEN" ]; then
  echo "❌ TG_BOT_TOKEN env var not set (the Telegram bot token)"; exit 1
fi

echo "📦 deploying worker..."
wrangler deploy

echo "🔑 setting TG_BOT_TOKEN secret..."
printf '%s' "$TG_BOT_TOKEN" | wrangler secret put TG_BOT_TOKEN

ADMIN_KEY=$(grep -oP 'ADMIN_KEY = "\K[^"]+' wrangler.toml)
echo "🔗 registering webhook (Worker→Telegram)..."
curl -sL "https://fal-hafez-bot.vickfmr.workers.dev/setup?key=$ADMIN_KEY&action=set"
echo
echo "✅ done. Bot: https://t.me/deeplersazbot_bot"
