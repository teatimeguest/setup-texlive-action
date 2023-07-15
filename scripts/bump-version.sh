#!/usr/bin/env bash
set -euo pipefail

# shellcheck disable=SC2154
readonly version="v${npm_package_version}"

git update-index --no-skip-worktree dist/*
trap 'git update-index --skip-worktree dist/*' EXIT

git add -u dist package-lock.json package.json
git commit -m "chore(release): prepare for ${version}"

git cliff --config .config/cliff.toml --unreleased --tag "${version}" |
  git tag "${version}" --cleanup=whitespace -F -
git tag -f "${version%%.*}" -m "${version}"

git --no-pager show --no-patch "${version}"
echo
