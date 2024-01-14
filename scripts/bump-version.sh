#!/usr/bin/env bash
set -euo pipefail

# shellcheck disable=SC2154
readonly version="v${npm_package_version}"

# shellcheck disable=SC2154
case "${npm_lifecycle_event}" in
  preversion)
    npm run prepack
    markdown-link-check dist/NOTICE.md
    ;;

  version)
    git ls-files -z dist |
      xargs -0 git update-index --no-assume-unchanged --
    git add dist package-lock.json package.json
    git commit -m "chore(release): prepare for ${version}"
    ;;

  postversion)
    git ls-files -z dist |
      xargs -0 git update-index --assume-unchanged --

    git cliff \
      --config packages/config/cliff.toml \
      --unreleased \
      --tag "${version}" |
      git tag "${version}" --cleanup=whitespace -F -
    git tag -f "${version%%.*}" -m "${version}"

    git --no-pager show --color --no-patch "${version}" |
      sed '/^-----BEGIN/,/^-----END/d'
    echo
    ;;
esac
