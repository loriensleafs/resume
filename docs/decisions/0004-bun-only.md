# All tooling is Bun and TypeScript: no Node, no Python

Peter's rule for his repos: "I don't want to use node with this, any sort of JS should be written in pure bun" and "absolutely no Python. All in bun."

Decided 2026-10-26 by Peter.

Consequences:

- The PDF build drives Chrome directly over the DevTools protocol from Bun, instead of using Playwright.
- The font cutter uses HarfBuzz compiled to WebAssembly (`harfbuzzjs`), instead of Python's fontTools. Its output differs from the fontTools cut only by one-pixel anti-aliasing on curves.
- Scripts use Bun's APIs (`Bun.file`, `Bun.write`, `Bun.YAML`, `Bun.spawn`, `$`) instead of `node:` modules.
- A JavaScript tool that the stack needs (for example Vite under TanStack Start) runs on the Bun runtime.
