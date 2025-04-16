#!/usr/bin/env -S jq -crf
.current.version | tonumber as $latest | null |

def default_runners: "ubuntu-latest", "windows-latest", "mac-latest";

def min_supported_version:
  if test("^ubuntu-.*-arm$") then
    2017
  elif startswith("macos-") then
    2013
  else
    2008
  end;

[
  env.runner | select(. != "") // default_runners
    | {
      runner: .,
      "texlive-version": range(min_supported_version; $latest)
        | tostring
        | select(["", null, .] | any(. == env."texlive-version"))
    }
]
