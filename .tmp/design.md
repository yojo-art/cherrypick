# Backend Test Coverage 100% - Design Document

## Objective

Achieve 100% test coverage for all files under `packages/backend/src/`.

## Current State

- **Files**: 969
- **Statement Coverage**: 63.10% (74,719 / 118,406)
- **Branch Coverage**: 75.59% (3,348 / 4,429)
- **Function Coverage**: 67.02% (2,205 / 3,290)
- **Files needing coverage**: 773

## Strategy

### Priority Order (by feasibility and impact)

1. **src/misc/** (32 files, 833 uncovered stmts) - Pure utility functions, no DI needed
2. **src/misc/prelude/** (5 files, 84 uncovered stmts) - Pure utility functions
3. **src/misc/id/** (6 files, 44 uncovered stmts) - ID generation utilities
4. **src/models/** (14 files, 244 uncovered stmts) - Model definitions
5. **src/@types/** (6 files, 193 uncovered stmts) - Type definitions
6. **src/core/** (79 files, 13,321 uncovered stmts) - NestJS services with DI
7. **src/core/entities/** (42 files, 3,171 uncovered stmts) - Entity services
8. **src/core/activitypub/** (24 files, 4,078 uncovered stmts) - ActivityPub services
9. **src/core/chart/** (18 files, 402 uncovered stmts) - Chart services
10. **src/server/api/** (478 files, 13,474 uncovered stmts) - API endpoint validators
11. **src/queue/** (4+39 files, 4,039 uncovered stmts) - Queue processors
12. **src/server/** (6+3+1 files, 2,976 uncovered stmts) - Server, web, OAuth
13. **src/boot/** (5 files, 455 uncovered stmts) - Boot scripts
14. **src/daemons/** (2 files, 141 uncovered stmts) - Background daemons
15. **src/cli/** (2 files, 72 uncovered stmts) - CLI commands
16. **src/** (7 files, 160 uncovered stmts) - Root files

### Test Patterns

- **Pure utilities**: Direct import + expect/assert, no DI
- **NestJS services**: `Test.createTestingModule({ imports: [GlobalModule, CoreModule] })`
- **Complex services with mocking**: Custom providers + `.useMocker()` + beforeEach/afterEach
- **API endpoint validation**: Inline `.test.ts` files using `getValidator(paramDef)`

### Test File Locations

- Pure utility tests: `test/unit/misc/`
- Service tests: `test/unit/`
- Inline validation tests: `src/server/api/endpoints/**/*.test.ts`
