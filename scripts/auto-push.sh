#!/usr/bin/env bash
set -u
REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
INTERVAL="${AUTOPUSH_INTERVAL_SECONDS:-600}"
cd "$REPO_DIR"
log(){ printf '[%s] %s\n' "$(date -Is)" "$*"; }
while true; do
  if [ -n "$(git status --porcelain)" ]; then
    git add -A
    git -c user.name='ARGOCHAT Auto Sync' -c user.email='agrochat-builder@users.noreply.github.com' commit -m "chore: sync workspace changes" || true
    if [ -n "${GH_TOKEN:-}" ]; then
      git -c http.extraheader="AUTHORIZATION: bearer ${GH_TOKEN}" push origin main && log 'Pushed changes to origin/main.' || log 'Push failed; will retry next cycle.'
    else
      log 'GH_TOKEN is unavailable; commit kept locally and push skipped.'
    fi
  else
    log 'No changes to sync.'
  fi
  sleep "$INTERVAL"
done
