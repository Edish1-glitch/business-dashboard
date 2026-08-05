#!/usr/bin/env bash
# Deploy the latest `main` to the Oracle production VM (FinDash).
#
# What it does: SSHes into the Oracle Always-Free ARM VM and runs the on-VM
# runbook `~/redeploy.sh`, which fetches `main`, merges it into the
# `oracle-migration` branch (the branch that carries the Oracle-only bits),
# pushes, then `docker compose up -d --build`. If a merge conflict occurs the
# runbook aborts cleanly WITHOUT rebuilding.
#
# Data (Neon Postgres + Cloudflare R2) is shared, so this is code-only and
# fully reversible — no data migration ever happens here.
#
# Usage:  bash scripts/deploy-oracle.sh
set -euo pipefail

HOST="ubuntu@84.13.66.121"
KEY="$HOME/.ssh/oracle_findash"
URL="https://84.13.66.121.sslip.io"

echo "▶ Deploying latest main to Oracle ($HOST) …"
ssh -i "$KEY" -o ConnectTimeout=20 "$HOST" 'bash ~/redeploy.sh'

echo "▶ Health check …"
code=$(curl -sS -m 30 -o /dev/null -w "%{http_code}" "$URL/login" || echo "000")
echo "   $URL/login → HTTP $code"
[ "$code" = "200" ] && echo "✔ Deploy done, site is up." || echo "⚠ Site returned $code — check the logs."
