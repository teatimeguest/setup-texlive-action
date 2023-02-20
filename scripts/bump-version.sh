#!/usr/bin/env bash
set -euo pipefail

# shellcheck disable=SC2154
readonly version="v${npm_package_version}"
# shellcheck disable=SC2154
script="$(jq -r .main "${npm_package_json}")"

git update-index --no-skip-worktree "${script}"
trap 'git update-index --skip-worktree "${script}"' EXIT

git add "${script}" package-lock.json package.json
git commit -m "chore(release): prepare for ${version}"

git cliff --config .config/cliff.toml --unreleased --tag "${version}" |
  git tag "${version}" --cleanup=whitespace -F -
git tag -f "${version%%.*}" -m "${version}"

git --no-pager show --no-patch "${version}"
echo
