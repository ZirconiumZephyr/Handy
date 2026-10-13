#!/bin/zsh
# Double-click this file in Finder to open the locally built Consult app.
consult_root="${0:A:h}"
consult_app="$consult_root/src-tauri/target/debug/bundle/macos/Consult.app"
if [[ ! -d "$consult_app" ]]; then
  print 'Consult has not been built here yet.'
  print 'Open docs/START_HERE.md for the build instructions.'
  read '?Press Return to close this window.'
  exit 1
fi
if ! /usr/bin/open -a "$consult_app" --args --no-tray; then
  print 'macOS could not open Consult.'
  print 'Open docs/START_HERE.md for troubleshooting.'
  read '?Press Return to close this window.'
  exit 1
fi
print 'Consult has been opened. Look for its window or its teal pulse icon in the Dock.'
print 'On first run, follow the Permissions Required screen.'
