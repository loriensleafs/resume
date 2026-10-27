## Structural Remedies

When you flag a structural problem, propose the move, not just the problem. A review that only says "this is complex" leaves the author guessing. The smell baseline names one fix per smell. For the problems it does not cover, reach for a named restructuring:

- **Separate orchestration from business logic** so each reads on its own.
- **Move feature-specific logic** out of a shared module into the package that owns the concept.
- **Make a type boundary explicit** so downstream branching disappears.
- **Extract a helper, or split a large file** into focused modules.

Prefer the remedy that removes moving pieces over one that spreads the same complexity around.

