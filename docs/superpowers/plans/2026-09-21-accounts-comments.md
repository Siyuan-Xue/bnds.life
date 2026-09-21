# Accounts and comments implementation plan

> **For agentic workers:** Use executing-plans for the API work; independent frontend and deletion worker domains use dispatching-parallel-agents.

**Goal:** Restore public registration/login, threaded comments, official stories and safe permanent video management.

**Architecture:** Existing Better Auth and tRPC, Drizzle/PostgreSQL; durable deletion jobs consumed by a separate media worker with existing import locking.

**Tech Stack:** Next.js 15, React 19, Better Auth, tRPC 11, Drizzle, PostgreSQL, Node 26.

**Spec:** docs/superpowers/specs/2026-09-21-accounts-comments.md

## Constraints

Public viewing; Chinese only; two navigation items; no email verification; no additional social features. Official role cannot be claimed through signup. Never delete actual videos during testing. Do not expose passwords or database URLs. Maintain mobile drawer geometry.

## Work

- [x] Add isolated tests for comment validation, same-video reply relationships, authorization, pagination, role escalation and deletion state transitions.
- [x] Extend schema and idempotent migration 003 for role/comments; enable Better Auth email/password with reserved official nickname. Add restricted bootstrap script.
- [x] Implement discussion tRPC list/stories/add/viewer, official video update/remove/deletion and mutation origin check. Validate dates using existing normalizeRecordedDate.
- [x] Implement frontend login/register, masthead account menu, comments/replies and official editing/deletion status without player layout changes.
- [x] Add migration 004, media deletion worker and tombstones; test containment, retries, real file removal and import exclusion on synthetic files.
- [x] Run lint/typecheck/unit/integration tests and production build. Review security boundaries, check desktop/mobile via browser.
- [ ] Back up server DB, apply additive migrations, create official account when mailbox is provided, deploy app plus worker through SSH. Verify production public viewing, authentication and worker status.
- [ ] Record operations, commit/push and verify clean Git state; deliver private official credentials path when created.

## Verification completed before release

26 unit tests and three isolated integration suites passed on the server. Local lint/typecheck and server production build passed. Browser checks covered registration without verification, automatic return to the video, ordinary comments, replies to official stories, date precision, name editing, durable deletion task entry, duplicate-button regression, and desktop/mobile panel geometry. Mobile player rectangle stayed identical while its story drawer opened. Official account was created before public authentication was enabled.
