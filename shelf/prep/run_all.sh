#!/usr/bin/env bash
# Rebuild every derived asset from assets/source.jpg + prep/overrides.json (~8 min on CPU).
set -e
cd "$(dirname "$0")/.."
. .venv/bin/activate
./prep/download_models.sh
[ -f assets/base.png ] || python prep/upscale.py
python prep/analyze.py
python prep/depth.py "$@"
