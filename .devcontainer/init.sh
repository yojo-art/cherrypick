#!/bin/bash

set -xe

sudo chown node node_modules
git config --global --add safe.directory /workspace
git submodule update --init
pnpm config set store-dir /home/node/.local/share/pnpm/store
pnpm install --frozen-lockfile
cp .devcontainer/devcontainer.yml .config/default.yml
cp .config/playwright-devcontainer.yml .config/test.yml
pnpm build
pnpm migrate
pnpm --filter frontend exec playwright install --with-deps chromium
