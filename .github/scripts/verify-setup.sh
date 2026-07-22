#!/usr/bin/env bash
set -uo pipefail

echo "Running verification script..."

ADMIN_USERNAME="admin_$(openssl rand -hex 4)"
ADMIN_PASSWORD=$(openssl rand -base64 16)

# 1. アカウント作成
RESPONSE=$(curl -s -o /tmp/create_account_response.json -w '%{http_code}' \
  -X POST http://localhost:3000/api/admin/accounts/create \
  -H 'Content-Type: application/json' \
  -d "{\"username\":\"${ADMIN_USERNAME}\",\"password\":\"${ADMIN_PASSWORD}\"}")
CURL_EXIT=$?

if [ "$CURL_EXIT" -ne 0 ]; then
    echo "Error: curl failed with exit code $CURL_EXIT (account create)"
    exit 1
fi

if [ "$RESPONSE" -ne 200 ]; then
    echo "Error: account create returned HTTP $RESPONSE"
    cat /tmp/create_account_response.json
    exit 1
fi

TOKEN=$(jq -r '.token' < /tmp/create_account_response.json)

if [ -z "$TOKEN" ] || [ "$TOKEN" == "null" ]; then
    echo "Error: failed to extract token from response"
    cat /tmp/create_account_response.json
    exit 1
fi

# 2. ノート作成
NOTE_RESPONSE=$(curl -s -o /tmp/create_note_response.json -w '%{http_code}' \
  -X POST 'http://localhost:3000/api/notes/create' \
  -H 'Content-Type: application/json' \
  -d "{\"i\":\"$TOKEN\",\"text\":\"test\"}")
CURL_EXIT=$?

if [ "$CURL_EXIT" -ne 0 ]; then
    echo "Error: curl failed with exit code $CURL_EXIT (notes create)"
    exit 1
fi

if [ "$NOTE_RESPONSE" -ne 200 ]; then
    echo "Error: notes/create returned HTTP $NOTE_RESPONSE"
    cat /tmp/create_note_response.json
    exit 1
fi

echo "Verification script finished."
