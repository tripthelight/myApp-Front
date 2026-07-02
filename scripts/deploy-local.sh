#!/usr/bin/env bash

set -Eeuo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
INFRA_DIR="${MYAPP_INFRA_DIR:-$HOME/myApp-Infra}"
IMAGE_NAME="${IMAGE_NAME:-myapp-front}"
IMAGE_TAG="${IMAGE_TAG:-manual-$(date +%Y%m%d%H%M%S)}"

cd "$PROJECT_DIR"

echo "Front image build: $IMAGE_NAME:$IMAGE_TAG"

echo "[1/3] Install dependencies and build Front"
npm install
npm run build

echo "[2/3] Build Docker image"
docker build --tag "$IMAGE_NAME:$IMAGE_TAG" .

echo "[3/3] Deploy through Infra default.conf switcher"
cd "$INFRA_DIR"
IMAGE_OVERRIDE="$IMAGE_NAME:$IMAGE_TAG" ./scripts/deploy-front.sh