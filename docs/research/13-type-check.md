# A type check for before each commit and CI

Researched 2026-10-27, when the repository had no type check. Peter's choice is [decision record](../design/interview-2026-10-26.md) row 157; task A9 (`tasks/modules/agents.md`) builds it.

## Peter's choice (row 157)

Bun's built-in checker, `bun check`, with the minimum Bun moving from 1.4.2 to 1.4.4. `typescript` 7.0.2 stays installed as the reference checker, and `@types/bun` 1.4.4 gives the types; both are exact development dependencies. The question recommended TypeScript's own checker with Bun staying at 1.4.2. Peter asked what the Bun 1.4.4 part meant, then chose Bun's checker.

## Options

| Checker | Version | Runs under Bun without Node | Speed | Maturity | Adds |
|---|---|---|---|---|---|
| `bun check`, built into Bun | Bun 1.4.4; matches TypeScript 7.0.2 | Yes. It is part of the `bun` binary [B1] | 0.06 s on this repo (measured). 3x to 6.4x faster than `tsc` 7 on large projects [B2] | New: Bun 1.4.3, 2026-10-10. Passes all 51,210 TypeScript 7.0.2 conformance tests [B2] | `@types/bun` |
| `typescript` (`tsc`, native Go) | 7.0.2, stable since 2026-07-08 [T1] | Yes. A JS launcher starts a native binary. `bun <path>/bin/tsc --version` printed `Version 7.0.2` (verified) | 0.18 s on this repo (measured). 8x to 12x faster than TypeScript 6 [T1] | Stable reference compiler. No programmatic API until 7.1 [T1] | `typescript` and one platform binary (28 MB) |
| `typescript` 6 (`@typescript/typescript6`) | 6.0.2 | Unverified | About 10x slower [T1] | Only for tools that need the compiler API | The same |
| `@typescript/native-preview` | 7.0.0-dev.20260707.2 | Yes | As 7.0 | Ended 2026-07-07 [T1] | – |

With the `tsconfig.json` below, both checkers printed identical results on the repository's 25 files (measured).

## Packages

| Package (development dependency, exact) | Version | Reason |
|---|---|---|
| `@types/bun` | 1.4.4 | Types for `Bun` and `bun:test`. It also brings the Node types [B1]. |
| `typescript` | 7.0.2 | Equals `process.versions.typescript` of Bun 1.4.4, so the editor and the check agree [B1]. The planned `@tanstack/db` 0.15.2 requires it as a peer, and Bun installs peers [B5]. It is the reference `tsc`. |
| `@types/react`, `@types/react-dom` | 19.3.0 each | Added with the site's first task, S1, not with A9 (row 159). React ships no types [R1]. `@tanstack/ai-react` 1.0.0 requires `@types/react` as a peer. |

TanStack Start, Router, AI 1.0 and both design-system packages ship their own `.d.ts` files (npm manifests). No direct `@types/node`: `bun-types` references it.

## `tsconfig.json`

```jsonc
{
  "compilerOptions": {
    "lib": ["ESNext", "DOM", "DOM.Iterable"],
    "target": "ESNext",
    "module": "Preserve",
    "moduleDetection": "force",
    "jsx": "react-jsx",
    "allowJs": true,
    "types": ["bun"],
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "isolatedModules": true,
    "noEmit": true,
    "strict": true,
    "skipLibCheck": true,
    "noFallthroughCasesInSwitch": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true
  },
  "include": ["src", "scripts", "__tests__", "evals", ".agents/skills", "*.ts"]
}
```

This is Bun's recommended file [B4] with four changes:

| Change | Reason |
|---|---|
| No `verbatimModuleSyntax` | TanStack Start: it "can result in server bundles leaking into client bundles" [S1, start-core skill]. Start wins: the leak would hit the chat's server code. Today's code passes with it on, so nothing is lost. |
| `isolatedModules: true` | Vite transpiles one file at a time and requires it [V1]. |
| `DOM`, `DOM.Iterable` in `lib` | React needs `dom` [R1]. TanStack's examples set it [S2]. `@types/bun` works with DOM since Bun 1.2.7 [B6]. |
| Explicit `include` | `.claude/worktrees/` holds other checkouts with `node_modules`. A `**/*` include checks them too. `.agents/skills` is in the list because the release skill's scripts check every push (added in A9's review). |

When a task installs Vite, it adds `"vite/client"` to `types`: TypeScript 7 checks side-effect imports, so `import "./x.css"` needs that declaration [B1, V1]. Commit `src/site/routeTree.gen.ts` [S3]; the generator marks it `// @ts-nocheck` (verified in `@tanstack/router-generator` 1.167.46).

## The script, the commit checks and CI

Name the script `typecheck`, not `check`: a `check` script replaces `bun check` [B1].

```json
"typecheck": "bun check"
```

Before every commit (AGENTS.md, Verify): `bun run typecheck`, then `bun run build`, then `bun test`. The check takes under a second.

CI, job `test` in `.github/workflows/ci.yml`, directly after `bun ci`:

```yaml
- run: bun run typecheck
```

`bun check` writes GitHub `::error` annotations itself [B1]. Inside `test`, the required checks stay unchanged. `oven-sh/setup-bun` gets `bun-version: 1.4.4`.

## Risks

- **Bun pin.** `bun check` needs Bun 1.4.3 or later; CI, AGENTS.md and the specs pinned 1.4.2. Row 157 moves the minimum to 1.4.4. With Bun 1.4.2, the script would be `"typecheck": "bun --bun tsc --noEmit"` with the same packages.
- **Young checker.** `bun check` was 17 days old when researched, and 1.4.4 changed its internals for speed [B3]. `typescript` 7.0.2 stays installed as the reference; a difference from `tsc` is a Bun bug [B1].
- **Version drift.** A Bun upgrade can move the TypeScript version. A small test that compares `process.versions.typescript` with the pinned `typescript` keeps them equal.
- **No compiler API in TypeScript 7.** A tool that imports `typescript`, such as typescript-eslint, fails [T1]. None of the 425 packages in the planned stack imports it; `@tanstack/db` names it only as a types peer. If a tool needs the API later, alias `typescript` to `@typescript/typescript6`, as TanStack's `start-basic` example does [S2].
- **Existing errors.** This `tsconfig.json` finds 35 errors in 3 files: 34 from `noUncheckedIndexedAccess` (33 in `scripts/make-fonts.ts`, 1 in `src/print/chrome.ts`) and 1 in `src/__tests__/build.test.ts:116`. A9 fixes them before the check goes on.
- **Stale route tree.** A route added without the generator fails the check. That is the wanted signal.
- React 19.3 with TypeScript 7: no known problem found.

## Sources (read 2026-10-27)

- [T1] https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/
- [B1] https://bun.com/docs/runtime/check
- [B2] https://bun.com/blog/bun-v1.4.3
- [B3] https://bun.com/blog/bun-v1.4.4
- [B4] https://bun.com/docs/typescript-6
- [B5] https://bun.com/docs/pm/cli/install
- [B6] https://github.com/oven-sh/bun/issues/7821
- [S1] https://tanstack.com/start/latest/docs/framework/react/build-from-scratch
- [S2] https://github.com/TanStack/router/tree/main/examples/react/start-basic (`tsconfig.json`, `package.json`)
- [S3] https://tanstack.com/router/latest/docs/framework/react/faq
- [V1] https://vite.dev/guide/features#typescript
- [R1] https://react.dev/learn/typescript
- start-core skill: `skills/start-core/SKILL.md` in `@tanstack/start-client-core` 1.170.39.
- npm registry, `https://registry.npmjs.org/<package>/<version>`.
- Measurements: Bun 1.4.4 and `tsc` 7.0.2, darwin-arm64.
