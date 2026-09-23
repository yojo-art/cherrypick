#!/bin/bash
mkdir certificates

# rootCA
openssl genrsa -des3 \
  -passout pass:rootCA \
  -out certificates/rootCA.key 4096
openssl req -x509 -new -nodes -batch \
  -key certificates/rootCA.key \
  -sha256 \
  -days 1024 \
  -passin pass:rootCA \
  -out certificates/rootCA.crt

# domain
function generate {
  openssl req -new -newkey rsa:2048 -sha256 -nodes \
    -keyout certificates/$1.key \
    -subj "/CN=$1/emailAddress=admin@$1/C=JP/ST=/L=/O=Misskey Tester/OU=Some Unit" \
    -out certificates/$1.csr
  openssl x509 -req -sha256 \
    -in certificates/$1.csr \
    -CA certificates/rootCA.crt \
    -CAkey certificates/rootCA.key \
    -CAcreateserial \
    -passin pass:rootCA \
    -out certificates/$1.crt \
    -days 500
  if [ ! -f .config/docker.env ]; then cp .config/example.docker.env .config/docker.env; fi
  if [ ! -f .config/$1.conf ]; then sed "s/\${HOST}/$1/g" .config/example.conf > .config/$1.conf; fi
  if [ ! -f .config/$1.config.json ]; then sed "s/\${HOST}/$1/g" .config/example.config.json > .config/$1.config.json; fi
}

function generate_stub {
  # z.test は nginx 静的スタブホストのため、Misskey 設定ファイル (.default.yml) は不要
  openssl req -new -newkey rsa:2048 -sha256 -nodes \
    -keyout certificates/$1.key \
    -subj "/CN=$1/emailAddress=admin@$1/C=JP/ST=/L=/O=Misskey Tester/OU=Some Unit" \
    -out certificates/$1.csr
  openssl x509 -req -sha256 \
    -in certificates/$1.csr \
    -CA certificates/rootCA.crt \
    -CAkey certificates/rootCA.key \
    -CAcreateserial \
    -passin pass:rootCA \
    -out certificates/$1.crt \
    -days 500
  sed "s/\${HOST}/$1/g" .config/example.stub.conf > .config/$1.conf
}

# z.test.deliver (LD署名生成用) の依存を調達する。
# deliverコンテナは隔離NW (internal) のため起動時に npm install できない。
# backend と同じ jsonld@9.0.0 を ./stub-vendor に前もって入れておく。
function vendor_jsonld {
  if ! (npm init -y --prefix ./stub-vendor >/dev/null 2>&1 && npm install --prefix ./stub-vendor --no-save --no-audit --no-fund jsonld@9.0.0); then
    echo "WARNING: failed to vendor jsonld for z.test.deliver (network required)." >&2
    echo "WARNING: LD-signature delivery modes (ld=valid/...) will fail until this succeeds." >&2
  fi
}

# LD署名の正規化に使うコンテキストは backend の PRELOADED_CONTEXTS と完全一致が必要。
# 手動コピーだとドリフトするため backend ソースから直接生成する (Node >= 22.18 の type stripping)。
function generate_ld_contexts {
  if ! node --input-type=module -e "
import { writeFile } from 'node:fs/promises';
const { PRELOADED_CONTEXTS } = await import('./../src/core/activitypub/misc/contexts.ts');
await writeFile('./stub-deliver-contexts.json', JSON.stringify(PRELOADED_CONTEXTS, null, '\t') + '\n');
"; then
    echo "WARNING: failed to regenerate stub-deliver-contexts.json from src/core/activitypub/misc/contexts.ts (Node >= 22.18 required)." >&2
    echo "WARNING: z.test.deliver LD-signature modes (ld=valid/...) require this file." >&2
  fi
}

generate a.test
generate b.test
generate c.test
generate_stub z.test

vendor_jsonld
generate_ld_contexts
