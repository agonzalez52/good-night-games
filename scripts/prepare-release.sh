#!/usr/bin/env bash
# Prepare a Good Night Games release from develop.
#
# Usage:
#   ./scripts/prepare-release.sh --bump <major|minor|patch> [--pre-release alpha|beta]
#
set -euo pipefail

BUMP=""
PRE_RELEASE=""

usage() {
  echo "Usage: $0 --bump <major|minor|patch> [--pre-release alpha|beta]" >&2
  exit 1
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --bump)
      BUMP="${2:-}"
      shift 2
      ;;
    --pre-release)
      PRE_RELEASE="${2:-}"
      shift 2
      ;;
    -h|--help)
      usage
      ;;
    *)
      echo "Unknown argument: $1" >&2
      usage
      ;;
  esac
done

if [[ -z "$BUMP" ]]; then
  usage
fi

case "$BUMP" in
  major|minor|patch) ;;
  *)
    echo "Invalid --bump value: $BUMP (expected major, minor, or patch)" >&2
    exit 1
    ;;
esac

if [[ -n "$PRE_RELEASE" ]]; then
  case "$PRE_RELEASE" in
    alpha|beta) ;;
    *)
      echo "Invalid --pre-release value: $PRE_RELEASE (expected alpha or beta)" >&2
      exit 1
      ;;
  esac
fi

for cmd in git npm gh node; do
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "Required command not found: $cmd" >&2
    exit 1
  fi
done

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

if [[ -n "$(git status --porcelain)" ]]; then
  echo "Working tree is not clean. Commit or stash changes before preparing a release." >&2
  git status --porcelain
  exit 1
fi

PRE_RELEASE_SUFFIX=""
if [[ -n "$PRE_RELEASE" ]]; then
  PRE_RELEASE_SUFFIX="-${PRE_RELEASE}"
fi

echo "Fetching latest develop..."
git fetch origin develop
git checkout develop
git pull origin develop

echo "Bumping $BUMP version in frontend and backend..."
(cd frontend && npm version "$BUMP" --no-git-tag-version >/dev/null)
BASE_VERSION="$(node -p "require('./frontend/package.json').version")"
(cd backend && npm version "$BASE_VERSION" --no-git-tag-version >/dev/null)

FRONTEND_VERSION="$(node -p "require('./frontend/package.json').version")"
BACKEND_VERSION="$(node -p "require('./backend/package.json').version")"
if [[ "$FRONTEND_VERSION" != "$BACKEND_VERSION" ]]; then
  echo "Version mismatch after bump: frontend=$FRONTEND_VERSION backend=$BACKEND_VERSION" >&2
  exit 1
fi

BRANCH_NAME="release/${BASE_VERSION}${PRE_RELEASE_SUFFIX}"
RELEASE_LABEL="v${BASE_VERSION}${PRE_RELEASE_SUFFIX}"
PR_TITLE_TO_DEVELOP="${RELEASE_LABEL} -> develop"
PR_TITLE_TO_MAIN="${RELEASE_LABEL} -> main"

if git show-ref --verify --quiet "refs/heads/${BRANCH_NAME}"; then
  echo "Local branch already exists: ${BRANCH_NAME}" >&2
  exit 1
fi

if git ls-remote --heads origin "refs/heads/${BRANCH_NAME}" | grep -q .; then
  echo "Remote branch already exists: origin/${BRANCH_NAME}" >&2
  exit 1
fi

echo "Creating branch ${BRANCH_NAME} (package version ${FRONTEND_VERSION})..."
git checkout -b "$BRANCH_NAME"
git add \
  frontend/package.json \
  frontend/package-lock.json \
  backend/package.json \
  backend/package-lock.json
git commit -m "$RELEASE_LABEL"

echo "Pushing ${BRANCH_NAME}..."
git push -u origin "$BRANCH_NAME"

echo "Opening pull requests..."
DEVELOP_PR_URL="$(gh pr create \
  --base develop \
  --head "$BRANCH_NAME" \
  --title "$PR_TITLE_TO_DEVELOP" \
  --body "Release preparation for ${RELEASE_LABEL}.")"

MAIN_PR_URL="$(gh pr create \
  --base main \
  --head "$BRANCH_NAME" \
  --title "$PR_TITLE_TO_MAIN" \
  --body "Release preparation for ${RELEASE_LABEL}.")"

RELEASE_ARGS=(
  "$RELEASE_LABEL"
  --target "$BRANCH_NAME"
  --title "$RELEASE_LABEL"
  --generate-notes
)
if [[ -n "$PRE_RELEASE" ]]; then
  RELEASE_ARGS+=(--prerelease)
fi

echo "Creating GitHub release ${RELEASE_LABEL}..."
RELEASE_URL="$(gh release create "${RELEASE_ARGS[@]}")"

echo ""
echo "Release prepared successfully."
echo "  Branch:       ${BRANCH_NAME}"
echo "  Version:      ${FRONTEND_VERSION}"
echo "  Tag:          ${RELEASE_LABEL}"
echo "  PR (develop): ${DEVELOP_PR_URL}"
echo "  PR (main):    ${MAIN_PR_URL}"
echo "  Release:      ${RELEASE_URL}"
