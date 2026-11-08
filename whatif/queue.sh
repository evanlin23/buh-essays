#!/usr/bin/env bash
# Narrate, render, QA and package every episode whose narration is still estimated (fake) or missing.
# Usage: whatif/queue.sh [episode ...]     (default: all episodes in order, Shorts first)
set -u
cd "$(dirname "$0")/.."
PY=.venv/bin/python
eps=("$@")
if [ ${#eps[@]} -eq 0 ]; then
  for d in episodes/*/; do [ -f "$d/scene.html" ] && eps+=("$(basename "$d")"); done
fi
for ep in "${eps[@]}"; do
  d="episodes/$ep"
  [ -f "$d/scene.html" ] || { echo "skip $ep: no scene"; continue; }
  if [ ! -f "$d/vo.js" ] || grep -q "ESTIMATED" "$d/vo.js"; then
    echo "== narrate $ep"
    $PY -I whatif/make.py "$d" narrate || { echo "narration failed for $ep (quota?)"; continue; }
  fi
  if [ ! -f "renders/$ep/qa.json" ] || [ "$d/vo.js" -nt "renders/$ep/qa.json" ]; then
    echo "== render $ep"
    $PY -I whatif/make.py "$d" render && $PY -I whatif/make.py "$d" qa; $PY -I whatif/make.py "$d" package
  fi
done
