# Backend Test Coverage 100% - Task List

## Phase 1: Utility Functions (COMPLETED)
- [x] src/misc/ utility tests (32 files - acct, bigint, clone, dev-null, get-reaction-emoji, i18n, safe-for-sql, json-value, status-error, fastify-reply-error, is-instance-muted, is-user-related, get-note-summary, extract-custom-emojis, extract-hashtags, collapsed-queue, promise-tracker, show-machine-info, create-temp, gen-key-pair, generate-invite-code, gen-identicon, fastify-hook-handlers, cache, FileWriterStream, JsonArrayStream, get-ip-hash)
- [x] src/misc/prelude/ tests (array, xml, relation)
- [x] src/misc/id/ tests (aidx, aid, meid, meidg, object-id, ulid)

## Phase 2: Jest Config Fix (COMPLETED)
- [x] Fix transformIgnorePatterns for ESM-only packages (nanoid, chalk, strip-ansi, etc.)
- [x] Add file-type mock for modules that can't be transformed
- [x] Set transformIgnorePatterns to [] for comprehensive ESM support

## Phase 3: API Endpoint Validation Tests (IN PROGRESS)
- [x] Generate 458 endpoint paramDef validation tests
- [ ] Fix remaining failures (some endpoint imports still fail)
- [ ] Run full coverage suite

## Phase 4: Models and Types (PENDING)
- [ ] src/models/ tests (14 files, 244 stmts)
- [ ] src/@types/ tests (6 files, 193 stmts)

## Phase 5: Core Services (PENDING)
- [ ] src/core/ service tests (79 files, 13,321 stmts)
- [ ] src/core/entities/ tests (42 files, 3,171 stmts)
- [ ] src/core/activitypub/ tests (24 files, 4,078 stmts)
- [ ] src/core/chart/ tests (18 files, 402 stmts)

## Phase 6: Queue and Remaining (PENDING)
- [ ] src/queue/ tests (43 files, 4,039 stmts)
- [ ] src/server/ tests (10 files, 2,976 stmts)
- [ ] src/boot/ tests (5 files, 455 stmts)
- [ ] src/daemons/ tests (2 files, 141 stmts)
- [ ] src/cli/ tests (2 files, 72 stmts)
- [ ] Root files tests (7 files, 160 stmts)

## Coverage Progress
| Checkpoint | Statements | Branches | Functions |
|-----------|-----------|----------|-----------|
| Initial | 63.10% | 75.59% | 67.02% |
| After misc/prelude/id | 63.60% | 77.02% | 68.94% |
| After API endpoints | TBD | TBD | TBD |
