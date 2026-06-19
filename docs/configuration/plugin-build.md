# Building the Waymark Plugin

This guide covers how to build the Waymark plugin from source. It is written for both human developers working locally and AI agents executing build steps programmatically. AI agents should follow the [verification checklist](#for-ai-agents-build-verification-checklist) to confirm each step succeeded before proceeding.

---

## Prerequisites

Before building, ensure the following tools are installed:

- **Node.js ≥ 22** — check with `node --version`
- **pnpm ≥ 10.6** — check with `pnpm --version`; install with `npm install -g pnpm`
- **git** — for cloning and version control

Waymark uses pnpm workspaces. Do not substitute npm or yarn — the workspace protocol (`workspace:*`) in `package.json` requires pnpm.

---

## Repository Structure

```
waymark/
├── package.json                    # root workspace (private, no publish)
├── pnpm-workspace.yaml             # declares waymark-plugin/packages/*
├── tsconfig.json                   # root TypeScript config (composite mode)
└── waymark-plugin/
    └── packages/
        └── core/
            ├── package.json        # @waymark/core — the published package
            ├── tsconfig.json       # extends root, compiles src/ → dist/
            ├── src/                # TypeScript source files
            └── dist/               # compiled output (gitignored, created by build)
```

The workspace root's `package.json` is private and not published. All publishable code lives in `waymark-plugin/packages/core`.

The `dist/` directory is not committed to git. It is created by running `pnpm build` and must exist before the MCP server can be used.

---

## Build Steps

```bash
# 1. Install dependencies (run from the repo root)
pnpm install

# 2. Build @waymark/core
pnpm build
# Runs: tsc -p waymark-plugin/packages/core/tsconfig.json
# Writes output to: waymark-plugin/packages/core/dist/

# 3. Verify the MCP server binary was produced
ls waymark-plugin/packages/core/dist/bin/waymark-mcp.js

# 4. Run the test suite
pnpm test
# Expected: 38+ tests pass, 0 failures
```

All four commands should be run from the repository root. Do not `cd` into `waymark-plugin/packages/core` before running `pnpm build` or `pnpm test` — the root workspace scripts handle the correct project path.

---

## What Gets Built

Running `pnpm build` compiles everything in `src/` and produces the following in `dist/`:

| Output | Description |
|---|---|
| `dist/index.js` | Public package entry point (JavaScript) |
| `dist/index.d.ts` | Public package type declarations |
| `dist/bin/waymark-mcp.js` | The MCP server binary, registered as `waymark-mcp` in the package's `bin` field |
| `dist/**/*.js` | All other compiled modules |
| `dist/**/*.d.ts` | Type declarations for all modules |

The `waymark-mcp` binary is the executable Claude Code invokes as an MCP server. It reads from stdin and writes to stdout using the MCP protocol. It is not intended to be run interactively.

---

## For AI Agents: Build Verification Checklist

AI agents should execute these steps in order and verify each before continuing. A failed step means the build is not usable — do not proceed past a failure without fixing it.

- [ ] **Check Node.js version**: `node --version`
  - Must print `v22.x.x` or higher
  - If not: install Node.js 22 from [nodejs.org](https://nodejs.org/) or via a version manager

- [ ] **Check pnpm**: `pnpm --version`
  - Must print `10.x.x` or higher
  - If not: run `npm install -g pnpm`

- [ ] **Install dependencies**: `pnpm install`
  - Expect: no errors, lock file may be updated if dependencies changed
  - A warning about peer dependencies is acceptable; an error is not

- [ ] **Build**: `pnpm build`
  - Expect: no TypeScript errors, no exit code other than 0
  - If there are errors, fix them before running tests

- [ ] **Verify binary exists**: `ls waymark-plugin/packages/core/dist/bin/waymark-mcp.js`
  - Expect: file is listed (not "No such file or directory")
  - If missing: the build script may not have run correctly — check `pnpm build` output

- [ ] **Run tests**: `pnpm test`
  - Expect: all tests pass (38+ as of the current release)
  - A test failure means either the build is broken or a source change introduced a regression

- [ ] **Sanity check the binary**: `node waymark-plugin/packages/core/dist/bin/waymark-mcp.js --help 2>&1 || true`
  - The server starts and either prints help text or hangs waiting for MCP input on stdin
  - Either behavior is correct — press Ctrl+C if it hangs
  - An immediate crash (non-zero exit, error stacktrace) indicates a broken build

---

## Common Build Errors and Fixes

| Error | Cause | Fix |
|---|---|---|
| `Cannot find module './foo'` or similar | Missing `.js` extension on a relative import | Add `.js` to the import: `import { foo } from "./foo.js"` |
| `Type error: ... is not assignable to type ...` | TypeScript strict mode violation | Fix the type annotation or cast |
| `pnpm: command not found` | pnpm is not installed | `npm install -g pnpm` |
| `esbuild: Ignored build scripts` | pnpm security policy blocks postinstall scripts | Add `"pnpm": { "onlyBuiltDependencies": ["esbuild"] }` to the root `package.json` |
| `dist/` directory not found or empty | Build has not been run | Run `pnpm build` from the repo root |
| `Cannot find module '@waymark/core'` in tests | Core package not built yet | Run `pnpm build` before `pnpm test` |
| TypeScript `rootDir` error | Source file outside expected root | Check `tsconfig.json` `include` and `rootDir` settings |

TypeScript is configured in strict mode. All type errors must be fixed — the build does not allow `any` by default.

---

## Bumping the Version

When preparing a release, the version must be updated in two places so Claude Code's plugin system and the npm package agree:

1. Update `version` in `waymark-plugin/packages/core/package.json`
2. Update `version` in `.claude-plugin/plugin.json` to the **same value**
3. Run `pnpm build` to rebuild with the new version embedded
4. Run `pnpm test` to confirm nothing is broken
5. Commit the changes:
   ```bash
   git commit -m "chore: bump version to X.Y.Z"
   ```

The two version fields must stay in sync. A mismatch will cause Claude Code to report an outdated plugin version.

---

## For AI Agents: Adding a New Source File

When adding new functionality to the plugin, follow these steps to integrate a new TypeScript file correctly:

1. **Create the file** in `waymark-plugin/packages/core/src/` using a descriptive, lowercase-kebab-case name, e.g., `my-feature.ts`

2. **Use `.js` extensions on all relative imports**, even though the files are `.ts`. TypeScript's `moduleResolution: NodeNext` requires the output extension, not the source extension:
   ```typescript
   // Correct
   import { helper } from "./utils/helper.js";

   // Wrong — will fail at runtime
   import { helper } from "./utils/helper";
   ```

3. **Export from `src/index.ts`** if the new code is part of the public API that consumers of `@waymark/core` should be able to import. If it is internal-only, no export from `index.ts` is needed.

4. **Build to verify it compiles**: `pnpm build`
   - Fix any TypeScript errors before continuing

5. **Run tests to check for regressions**: `pnpm test`
   - Add tests for the new file in the appropriate location under `src/` (test files are co-located with source files or in a `__tests__/` directory)
