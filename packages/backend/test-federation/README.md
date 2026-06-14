## test-federation
Test federation between two CherryPick servers: `a.test` and `b.test`.

Before testing, you need to build the entire project, and change working directory to here:
```sh
pnpm build
cd packages/backend/test-federation
```

First, you need to start servers by executing following commands:
```sh
bash ./setup.sh
NODE_VERSION=22 docker compose up --scale tester=0
```

Then you can run all tests by a following command:
```sh
NODE_VERSION=22 docker compose run --no-deps --rm tester
```

For testing a specific file, run a following command:
```sh
NODE_VERSION=22 docker compose run --no-deps --rm tester -- pnpm -F backend test:fed packages/backend/test-federation/test/user.test.ts
```

### AP emoji normalization tests (`#1049`)

Tests under `describe('AP絵文字タグの正規化')` in `test/emoji.test.ts` deliver static ActivityPub fixtures from the dedicated stub host `z.test` (`stub/` served by nginx only — not a Misskey instance). Run `bash ./setup.sh` to generate `z.test` TLS material and `.config/z.test.conf`.

`resolveFederationTestNote()` builds a signed `Create` activity with `stub/users/alice-key.json`, POSTs it to the target instance inbox (`/inbox`), then waits until `ap/show` can resolve the note. Remote emoji assertions use the `emoji` API after inbox processing completes.

The `tester` service bind-mounts `stub/` so Jest can read `alice-key.json` inside the container.

`stub/users/alice` is a static Actor whose public key matches the test private key above.
