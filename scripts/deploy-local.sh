#!/usr/bin/env bash

set -Eeuo pipefail

SERVICE_NAME="front"
IMAGE_NAME="${IMAGE_NAME:-myapp-front}"
IMAGE_TAG="${IMAGE_TAG:-$(git rev-parse HEAD)}"
MYAPP_INFRA_DIR="${MYAPP_INFRA_DIR:-/home/um/myApp-Infra}"
NGINX_CONTAINER="${NGINX_CONTAINER:-myapp-nginx}"
NETWORK_NAME="${NETWORK_NAME:-myapp-network}"
DRAIN_SECONDS="${DRAIN_SECONDS:-10}"

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
UPSTREAM_FILE="$MYAPP_INFRA_DIR/nginx/conf.d/$SERVICE_NAME-upstream.conf"

if ! docker info >/dev/null 2>&1; then
    echo "Docker is not running or the current user cannot access it." >&2
    exit 1
fi

if [ ! -d "$MYAPP_INFRA_DIR" ]; then
    echo "Infra directory does not exist: $MYAPP_INFRA_DIR" >&2
    exit 1
fi

if [ ! -f "$UPSTREAM_FILE" ]; then
    echo "Front upstream file does not exist: $UPSTREAM_FILE" >&2
    echo "Create it from myApp-Infra/nginx/templates/front-upstream.conf first." >&2
    exit 1
fi

if [ "$(docker inspect --format '{{.State.Running}}' "$NGINX_CONTAINER" 2>/dev/null || true)" != true ]; then
    echo "Nginx container is not running: $NGINX_CONTAINER" >&2
    exit 1
fi

if ! docker network inspect "$NETWORK_NAME" >/dev/null 2>&1; then
    echo "Docker network does not exist: $NETWORK_NAME" >&2
    exit 1
fi

if grep -Fq "myapp-front-blue-1:8080" "$UPSTREAM_FILE"; then
    CURRENT_COLOR="blue"
    TARGET_COLOR="green"
elif grep -Fq "myapp-front-green-1:8080" "$UPSTREAM_FILE"; then
    CURRENT_COLOR="green"
    TARGET_COLOR="blue"
else
    echo "Could not determine current front color from $UPSTREAM_FILE" >&2
    exit 1
fi

echo "Deployment plan"
echo "  service: $SERVICE_NAME"
echo "  image: $IMAGE_NAME:$IMAGE_TAG"
echo "  current: $CURRENT_COLOR"
echo "  target: $TARGET_COLOR"

cd "$PROJECT_DIR"

echo "[1/7] Build Docker image"
docker build -t "$IMAGE_NAME:$IMAGE_TAG" .

echo "[2/7] Remove stale target containers"
docker rm -f \
    "myapp-front-$TARGET_COLOR-1" \
    "myapp-front-$TARGET_COLOR-2" \
    >/dev/null 2>&1 || true

echo "[3/7] Start target containers"
for instance in 1 2; do
    docker run -d \
        --name "myapp-front-$TARGET_COLOR-$instance" \
        --network "$NETWORK_NAME" \
        -e APP_ENV="$TARGET_COLOR" \
        -e SERVER_NAME="front_${TARGET_COLOR}_${instance}" \
        "$IMAGE_NAME:$IMAGE_TAG"
done

echo "[4/7] Check target containers directly"
for instance in 1 2; do
    container="myapp-front-$TARGET_COLOR-$instance"

    for attempt in $(seq 1 20); do
        response="$(docker exec "$NGINX_CONTAINER" \
            wget -q -T 2 -O - "http://$container:8080/hc" || true)"

        if grep -Fq "\"env\":\"$TARGET_COLOR\"" <<< "$response"; then
            echo "$container OK: $response"
            break
        fi

        if [ "$attempt" = 20 ]; then
            echo "$container health check failed: $response" >&2
            exit 1
        fi

        sleep 1
    done
done

echo "[5/7] Promote upstream"
"$MYAPP_INFRA_DIR/scripts/promote-service-upstream.sh" "$SERVICE_NAME" "$TARGET_COLOR"

echo "[6/7] Drain previous containers for ${DRAIN_SECONDS}s"
sleep "$DRAIN_SECONDS"

echo "[7/7] Stop previous containers"
docker rm -f \
    "myapp-front-$CURRENT_COLOR-1" \
    "myapp-front-$CURRENT_COLOR-2" \
    >/dev/null 2>&1 || true

echo "Prune old front images"
docker images "$IMAGE_NAME" --format '{{.Repository}}:{{.Tag}} {{.CreatedAt}}' \
    | awk -v keep="$IMAGE_TAG" '$1 !~ ":"keep"$" { print $1 }' \
    | xargs -r docker rmi || true

echo "Front deployment complete: $CURRENT_COLOR -> $TARGET_COLOR"