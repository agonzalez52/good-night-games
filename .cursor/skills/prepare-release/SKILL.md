---
name: prepare-release
description: >-
  Prepare a Good Night Games release from develop: bump frontend and backend
  versions, create release branch, commit, push, open PRs to develop and main,
  and create a GitHub release. Use when planning or cutting a release.
disable-model-invocation: true
---

# Prepare release

Run this workflow only in **Agent mode** with shell and network permissions.

## Before you start

1. Confirm `git`, `npm`, `gh`, and `node` are available (`gh auth status` must succeed).
2. Confirm the working tree is clean (no uncommitted changes).
3. Do **not** ask for release notes; the script uses `--generate-notes` on the GitHub release.

## Prompt the user

Ask these two questions before running anything:

1. **Bump type** (required): `major`, `minor`, or `patch`
2. **Pre-release channel** (optional): `alpha`, `beta`, or neither (stable release)

Do not proceed until bump type is confirmed.

## Run the script

From the repository root. Prefer the shell script on macOS/Linux; use PowerShell on Windows when `pwsh` is available.

**macOS / Linux (Terminal, zsh/bash):**

```bash
./scripts/prepare-release.sh --bump <major|minor|patch>
```

Add `--pre-release alpha` or `--pre-release beta` when the user chose a pre-release channel.

Examples:

```bash
./scripts/prepare-release.sh --bump patch
./scripts/prepare-release.sh --bump minor --pre-release alpha
./scripts/prepare-release.sh --bump major --pre-release beta
```

**Windows (PowerShell):**

```powershell
pwsh -NoProfile -File scripts/prepare-release.ps1 -Bump <major|minor|patch>
```

Add `-PreRelease alpha` or `-PreRelease beta` when the user chose a pre-release channel.

Examples:

```powershell
pwsh -NoProfile -File scripts/prepare-release.ps1 -Bump patch
pwsh -NoProfile -File scripts/prepare-release.ps1 -Bump minor -PreRelease alpha
pwsh -NoProfile -File scripts/prepare-release.ps1 -Bump major -PreRelease beta
```

Both scripts implement the same workflow. If `pwsh` is missing on macOS, use `prepare-release.sh` (do not hand-roll the steps).

## Naming conventions (do not change)

| Item | Stable | Alpha | Beta |
|------|--------|-------|------|
| Branch | `release/X.Y.Z` | `release/X.Y.Z-alpha` | `release/X.Y.Z-beta` |
| `package.json` version | `X.Y.Z` | `X.Y.Z` | `X.Y.Z` |
| Commit message | `vX.Y.Z` | `vX.Y.Z-alpha` | `vX.Y.Z-beta` |
| PR titles | `vX.Y.Z -> develop/main` | `vX.Y.Z-alpha -> develop/main` | `vX.Y.Z-beta -> develop/main` |
| GitHub release tag & title | `vX.Y.Z` | `vX.Y.Z-alpha` | `vX.Y.Z-beta` |

`X.Y.Z` is the semver after `npm version <bump> --no-git-tag-version` on `frontend/package.json`. Both `frontend/` and `backend/` get the same `X.Y.Z` (backend is synced to match frontend). Do **not** append `-rc0`, `-alpha-rc0`, or `-beta-rc0` to package versions or release labels.

Alpha and beta GitHub releases are created with `--prerelease`. Stable releases are not marked pre-release.

## After the script

Report branch name, package version, tag, PR URLs, and release URL from the script output.

Do **not** merge PRs unless the user explicitly asks.

## Errors

If the script fails:

- Read the error message and fix the underlying issue (dirty tree, missing `gh`, existing branch/tag, etc.).
- Do not re-run blindly if a branch or release was partially created; inspect `git branch` and `gh release list` first.
