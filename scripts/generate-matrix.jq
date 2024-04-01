#!/usr/bin/env -S jq -crf
.current.version | tonumber as $latest | null |

"matrix=\(
  { ubuntu, windows, macos: 2013 }
  | to_entries
  | map(
    {
      os: .key,
      version: range(.value // 2008; $latest) | tostring
    }
    | select(
      contains(env | { os, version } | map_values(. // empty))
    )
  )
)"
