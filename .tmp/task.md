# Backend Test Coverage 100% - Task List

## Phase 1: Utility Functions (COMPLETED)
- [x] src/misc/ utility tests (27 files)
- [x] src/misc/prelude/ tests (3 files)
- [x] src/misc/id/ tests (1 file)

## Phase 2: Jest Config Fix (COMPLETED)
- [x] Fix transformIgnorePatterns for ESM-only packages
- [x] Add file-type/ulid mocks

## Phase 3: API Endpoint Validation Tests (COMPLETED)
- [x] Generate 458+ endpoint paramDef validation tests

## Phase 4: Core Service Tests (COMPLETED)
- [x] UtilityService (30 test cases)
- [x] IdService (gen, parse, parseFull, isSafeT)
- [x] ImageProcessingService (convertToWebp/Avif/Png)
- [x] GlobalEventService (all publish* methods)
- [x] FeaturedService (ranking CRUD)
- [x] FanoutTimelineService (get/getMulti/purge)
- [x] ModerationLogService
- [x] 55 core DI instantiation tests
- [x] MfmService extended (28 new tests)
- [x] ReactionService extended (7 new tests)

## Phase 5: Entity/ActivityPub/Chart Service Tests (COMPLETED)
- [x] 42 entity service DI tests
- [x] 8 activitypub service DI tests
- [x] 9 activitypub model service DI tests
- [x] 10 chart DI tests
- [x] Notification model type test

## Phase 6: Remaining (IN PROGRESS)
- [ ] queue/processors tests (need individual provider setup)
- [ ] server/ tests (complex fastify setup)
- [ ] boot/ tests
- [ ] daemons/ tests

## Coverage Progress
| Checkpoint | Stmts | Branches | Funcs | Suites | Tests |
|-----------|-------|----------|-------|--------|-------|
| Initial | 63.10% | 75.59% | 67.02% | 11/38 | 124 |
| After misc+endpoints | 63.54% | 77.32% | 69.03% | 514/527 | 1,639 |
| After core/entities | TBD | TBD | TBD | ~640+ | ~1,800+ |

## Total files created: ~630
