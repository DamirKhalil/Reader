#!/usr/bin/env bash
# Model weights are not committed. HuggingFace / GitHub releases may be blocked by the network policy.
set -e
cd "$(dirname "$0")/.."
mkdir -p models
[ -f models/EDSR_x4.pb ] || curl -sSL -o models/EDSR_x4.pb https://raw.githubusercontent.com/Saafke/EDSR_Tensorflow/master/models/EDSR_x4.pb
echo "EDSR_x4.pb ready"
