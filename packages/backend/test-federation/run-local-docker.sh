#!/usr/bin/env bash
# SPDX-FileCopyrightText: syuilo and misskey-project, yojo-art team
# SPDX-License-Identifier: AGPL-3.0-only
#
# Run federation tests locally in a clean Docker environment.
# Usage:
#   ./run-local-docker.sh                    # run all tests
#   ./run-local-docker.sh timeline.test.ts   # run a specific test file
#   ./run-local-docker.sh --skip-build       # skip pnpm build
#   ./run-local-docker.sh --clean            # remove node_modules & built/, then exit

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "${SCRIPT_DIR}"

NODE_VERSION="$(cat "${SCRIPT_DIR}/../../../.node-version")"
export NODE_VERSION

CLEAN=0
TEST_FILTER=""
ARG_COUNT=0
for arg in "$@"; do
    ARG_COUNT=$((ARG_COUNT + 1))
    case "${arg}" in
        --clean)
            CLEAN=1
            ;;
				--skip-build)
						SKIP_BUILD=1
						;;
        *)
            TEST_FILTER="${arg}"
            ;;
    esac
done

if [[ "${CLEAN}" == "1" ]]; then
    REPO_ROOT="$(cd "${SCRIPT_DIR}/../../.." && pwd)"
    echo "==> --clean: removing node_modules, built/, and generated test configs …"

    # Glob expansion for the .config/* patterns: if nothing matches, expand
    # to nothing instead of the literal pattern string.
    shopt -s nullglob
    CONFIG_FILES=(
        "${SCRIPT_DIR}/.config/"*.test.conf
        "${SCRIPT_DIR}/.config/"*.test.config.json
        "${SCRIPT_DIR}/.config/docker.env"
    )
    shopt -u nullglob

    rm -rf \
        "${REPO_ROOT}/node_modules" \
        "${REPO_ROOT}/built" \
        "${REPO_ROOT}/packages/backend/node_modules" \
        "${REPO_ROOT}/packages/backend/built" \
        "${REPO_ROOT}/packages/misskey-js/node_modules" \
        "${REPO_ROOT}/packages/misskey-js/built" \
        "${REPO_ROOT}/packages/misskey-reversi/node_modules" \
        "${REPO_ROOT}/packages/misskey-reversi/built" \
        "${CONFIG_FILES[@]}"
    echo "==> Clean done."
    exit 0
fi

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
#
#    Runs inside a throwaway Docker container so the host Node
#    toolchain is never touched. Output (node_modules/built) is
#    bind-mounted, so files land on the host with whatever UID/GID
#    we run the container as — we use the host user's, to avoid
#    root-owned files.
# ──────────────────────────────────────────────
if [[ "${SKIP_BUILD:-}" != "1" ]]; then
    HOST_UID="$(id -u)"
    HOST_GID="$(id -g)"
    echo "==> Building backend & deps (in Docker, as uid=${HOST_UID} gid=${HOST_GID})…"
    REPO_ROOT="$(cd "${SCRIPT_DIR}/../../.." && pwd)"
    BUILD_IMAGE_TAG="misskey-build-env:${NODE_VERSION}"

    BUILD_DOCKERFILE="$(mktemp)"
    trap 'rm -f "${BUILD_DOCKERFILE}"' EXIT
    cat > "${BUILD_DOCKERFILE}" <<EOF
ARG NODE_VERSION=${NODE_VERSION}
FROM node:\${NODE_VERSION}-bookworm
RUN apt-get update \\
    && apt-get install -y --no-install-recommends ffmpeg \\
    && rm -rf /var/lib/apt/lists/*
RUN corepack enable
WORKDIR /misskey
EOF

    docker build \
        --build-arg NODE_VERSION="${NODE_VERSION}" \
        -t "${BUILD_IMAGE_TAG}" \
        -f "${BUILD_DOCKERFILE}" \
        "${SCRIPT_DIR}"

    docker run --rm \
        --user "$(id -u):$(id -g)" \
        -v "${REPO_ROOT}:/misskey" \
        -w /misskey \
        -e HOME=/tmp \
        -e PNPM_HOME=/tmp/pnpm \
        -e CI=true \
        "${BUILD_IMAGE_TAG}" \
        bash -c 'pnpm i --frozen-lockfile && pnpm --filter backend --filter misskey-js --filter misskey-reversi build'

    rm -f "${BUILD_DOCKERFILE}"
    trap - EXIT
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
docker compose up -d --no-deps misskey.a.test misskey.b.test misskey.c.test

# Poll until all three misskey containers are healthy
MAX_WAIT=180  # seconds
WAITED=0
echo -n "==> Waiting for Misskey containers to become healthy"
while [[ ${WAITED} -lt ${MAX_WAIT} ]]; do
    HEALTHY_COUNT=$(docker compose ps misskey.a.test misskey.b.test misskey.c.test --format json 2>/dev/null \
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
    docker compose ps misskey.a.test misskey.b.test misskey.c.test
    echo "==> Misskey logs (last 30 lines):"
    docker compose logs --tail 30 misskey.a.test
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
