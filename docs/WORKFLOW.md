# Workflow

## Branches
Use `surface/<task>`, `core/<task>`, or `glue/<task>` from `main`. Keep commits small and named after outcomes.

## Ownership
Surface owns UI files and styles. Core owns API, database access, and provider adapters. Glue owns configuration, docs, deployment, and test scripts.

## Merge policy
Open a pull request or share a commit for review. At least one other teammate checks the happy path. Never force-push `main`. Resolve conflicts with the file owner.

## Merge order
Foundation/config → API contract → UI integration → persistence → deploy. If time is short, merge the smallest working path and defer optional work.
