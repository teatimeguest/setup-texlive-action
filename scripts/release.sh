#!/bin/bash
set -euo pipefail

function usage() {
  cat <<EOF >&2
Create a release commit with tags

USAGE:
    $(basename "$0") {patch|minor|major}
EOF
}

function validate() {
  if [[ "$#" -ne 1 || ! "$1" =~ ^(patch|minor|major)$ ]]; then
    usage; exit 1
  fi
}

function release() {
  [[ "$(git rev-parse --abbrev-ref HEAD)" == main ]]

  local -r next="$(npm version "$1")"
  git add package-lock.json package.json
  git commit -m "chore(release): prepare for ${next}"
  git cliff -ut "${next}" | git tag "${next}" --cleanup=whitespace -F -
  git tag -f "${next%%.*}" -m "${next}"

  git --no-pager show "${next}"
}

validate "$@"
release "$@"
