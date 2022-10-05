#!/usr/bin/env bash
set -euo pipefail

readonly version="v${npm_package_version}"

git add -u dist package-lock.json package.json
git commit -m "chore(release): prepare for ${version}"
git cliff --config .config/cliff.toml --unreleased --tag "${version}" |
  git tag "${version}" --cleanup=whitespace -F -
git tag -f "${version%%.*}" -m "${version}"
git --no-pager show --no-patch "${version}"
echo
