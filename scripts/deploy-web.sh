#!/usr/bin/env bash
# Local convenience: build Expo web and deploy to Vercel production.
# Requires: npx vercel linked to the project (run `npx vercel link` once).
# NOTE: deploys are MANUAL via this script — there is no CI/CD workflow yet.
# To automate on push to main, add .github/workflows/deploy-web.yml (it does not exist).
set -euo pipefail

echo "==> Preparing public web assets…"
bash scripts/prepare-web-public-assets.sh

echo "==> Building web bundle (expo export)…"
# Requires EXPO_PUBLIC_* in .env or the shell environment (see .env.example).
npx expo export --platform web   # outputs ./dist

echo "==> Deploying to Vercel (production)…"
npx vercel --prod

echo "==> Done. Check https://vercel.com/dashboard for the live URL."
