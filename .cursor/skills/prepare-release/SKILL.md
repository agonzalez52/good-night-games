---
name: prepare-release
description: >-
  Prepare a Good Night Games release from develop: bump frontend and backend
  versions, create release branch, commit, push, open PRs to develop and main,
  and create a GitHub pre-release. Use when planning or cutting a release.
disable-model-invocation: true
---

# Prepare release

Run this workflow only in **Agent mode** with shell and network permissions.

## Before you start

1. Confirm `git`, `npm`, and `gh` are available (`gh auth status` must succeed).
2. Confirm the working tree is clean (no uncommitted changes).
3. Do **not** ask for release notes; the script uses `--generate-notes` on the GitHub release.

## Prompt the user

Ask these two questions before running anything:

1. **Bump type** (required): `major`, `minor`, or `patch`
2. **Pre-release channel** (optional): `alpha`, `beta`, or neither (stable release)

Do not proceed until bump type is confirmed.

## Run the script

From the repository root:

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

## Naming conventions (do not change)

| Item | Stable | Alpha | Beta |
|------|--------|-------|------|
| Branch | `release/X.Y.Z` | `release/X.Y.Z-alpha` | `release/X.Y.Z-beta` |
| `package.json` version | `X.Y.Z-rc0` | `X.Y.Z-alpha-rc0` | `X.Y.Z-beta-rc0` |
| Commit message | `vX.Y.Z-rc0` | `vX.Y.Z-alpha-rc0` | `vX.Y.Z-beta-rc0` |
| PR titles | `vX.Y.Z-rc0 -> develop/main` | `vX.Y.Z-alpha-rc0 -> develop/main` | `vX.Y.Z-beta-rc0 -> develop/main` |
| GitHub release tag & title | `vX.Y.Z-rc0` | `vX.Y.Z-alpha-rc0` | `vX.Y.Z-beta-rc0` |

`X.Y.Z` is the semver after the requested bump, read from `frontend/package.json`.

Both `frontend/` and `backend/` must end on the same version. The script enforces this.

## After the script

Report branch name, package version, tag, PR URLs, and release URL from the script output.

Do **not** merge PRs unless the user explicitly asks.

## Errors

If the script fails:

- Read the error message and fix the underlying issue (dirty tree, missing `gh`, existing branch/tag, etc.).
- Do not re-run blindly if a branch or release was partially created; inspect `git branch` and `gh release list` first.
