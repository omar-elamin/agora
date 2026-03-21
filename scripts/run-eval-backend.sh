#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

pip install -r requirements.txt
uvicorn agora.server:app --host 0.0.0.0 --port 8100 --reload
