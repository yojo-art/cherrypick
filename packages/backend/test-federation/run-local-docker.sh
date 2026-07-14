#!/usr/bin/env bash
# SPDX-FileCopyrightText: syuilo and misskey-project, yojo-art team
# SPDX-License-Identifier: AGPL-3.0-only
#
# Run federation tests locally in a clean Docker environment.
# Usage:
#   ./run-local-docker.sh                    # run all tests
#   ./run-local-docker.sh timeline.test.ts   # run a specific test file
#   SKIP_BUILD=1 ./run-local-docker.sh       # skip pnpm build

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "${SCRIPT_DIR}"

# Set NODE_VERSION from .node-version if not already set
if [[ -z "${NODE_VERSION:-}" ]]; then
    NODE_VERSION="$(cat "${SCRIPT_DIR}/../../../.node-version")"
    export NODE_VERSION
fi

TEST_FILTER="${1:-}"

# ──────────────────────────────────────────────
# 1. Generate configs / certificates if missing
# ──────────────────────────────────────────────
if [[ ! -d certificates || ! -f .config/a.test.conf || ! -f .config/a.test.default.yml ]]; then
    echo "==> Running setup.sh…"
    bash ./setup.sh
fi

# ──────────────────────────────────────────────
# 2. Build backend & deps (backend / misskey-js / misskey-reversi)
#    Skips frontend which requires submodules.
# ──────────────────────────────────────────────
if [[ "${SKIP_BUILD:-}" != "1" ]]; then
    echo "==> Building backend & deps…"
    cd "${SCRIPT_DIR}/../../.."
    pnpm --filter backend --filter misskey-js --filter misskey-reversi build
    cd "${SCRIPT_DIR}"
else
    echo "==> Skipping build (SKIP_BUILD=1)"
fi

# ──────────────────────────────────────────────
# 3. Stop running containers, then clean DB volumes.
#    Recreate redis dir with correct ownership
#    (UID 999 = redis user) so create_host_path
#    doesn't make it root-owned.
# ──────────────────────────────────────────────
echo "==> Stopping containers & cleaning DB volumes…"
docker compose down --remove-orphans >/dev/null 2>&1 || true

docker run --rm -v "${SCRIPT_DIR}/volumes:/volumes" --user root alpine:3 sh -c \
    'rm -rf /volumes/db.a /volumes/db.b /volumes/db.c && rm -rf /volumes/redis/* && mkdir -p /volumes/redis && chown 999:999 /volumes/redis'

# ──────────────────────────────────────────────
# 4. Start services in phases
# ──────────────────────────────────────────────
echo "==> Starting infrastructure (DBs, redis, setup, daemon, z.test.deliver)…"
docker compose up -d db.a.test db.b.test db.c.test redis.test setup daemon z.test.deliver

# Wait for setup to finish installing node_modules before starting misskey
echo -n "==> Waiting for setup to finish"
while docker compose ps setup --format json 2>/dev/null | grep -q '"State":"running"'; do
    echo -n "."
    sleep 2
done
echo " OK"

echo "==> Starting Misskey backends (migration may take a while)…"
# --no-deps is required because the nginx containers depend on
# misskey being healthy, but misskey won't be healthy while
# migrations are running. We start misskey without deps and
# poll until all three are ready, then start nginx.
docker compose up -d --no-deps cherrypick.a.test cherrypick.b.test cherrypick.c.test

# Poll until all three misskey containers are healthy
MAX_WAIT=180  # seconds
WAITED=0
echo -n "==> Waiting for Misskey containers to become healthy"
while [[ ${WAITED} -lt ${MAX_WAIT} ]]; do
    HEALTHY_COUNT=$(docker compose ps cherrypick.a.test cherrypick.b.test cherrypick.c.test --format json 2>/dev/null \
        | grep -c '"Health":"healthy"' || true)
    if [[ "${HEALTHY_COUNT}" == "3" ]]; then
        echo " OK"
        break
    fi
    echo -n "."
    sleep 5
    WAITED=$((WAITED + 5))
done

if [[ ${WAITED} -ge ${MAX_WAIT} ]]; then
    echo " TIMEOUT"
    echo "==> Misskey container status:"
    docker compose ps cherrypick.a.test cherrypick.b.test cherrypick.c.test
    echo "==> Misskey logs (last 30 lines):"
    docker compose logs --tail 30 cherrypick.a.test
    exit 1
fi

echo "==> Starting nginx frontends…"
docker compose up -d --no-deps a.test b.test c.test z.test

# ──────────────────────────────────────────────
# 5. Run tests
# ──────────────────────────────────────────────
echo "==> Running federation tests…"
if [[ -n "${TEST_FILTER}" ]]; then
    docker compose run --rm tester pnpm --filter backend test:fed -- "${TEST_FILTER}"
else
    docker compose run --rm tester pnpm --filter backend test:fed
fi
