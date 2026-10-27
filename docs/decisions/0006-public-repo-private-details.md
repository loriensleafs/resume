# Public repository; private details stay out of git

The site and chat code is a work sample for AI platform roles, so the repository is public. Everything in a public repository is public, including its history, so private details (the phone number) live only in the untracked `private.yaml`. Public outputs (the site, its downloads and CI builds) never contain them. The `private` variant, which Peter sends to employers, adds them at build time.

Decided 2026-10-26 by Peter.

Considered: keep the repository private (hides the work sample); a private source repository plus a public site repository (two repositories to keep in sync).

Consequences: the first commit, which contained the phone number, was rewritten and force-pushed on 2026-10-26, and the repository was made public the same day; Peter approved each step. A test fails if a tracked file ever contains a private detail.
