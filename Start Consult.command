#!/bin/zsh
# Double-click in Finder. Launch the exact Consult binary, not another Handy app.
consult_root="${0:A:h}"
consult_app="$consult_root/src-tauri/target/debug/bundle/macos/Consult.app"
consult_binary="$consult_app/Contents/MacOS/handy"
consult_log="${TMPDIR:-/tmp/}consult-launch.log"
if [[ ! -x "$consult_binary" ]]; then
  print 'Consult has not been built here yet.'
  print 'Open docs/START_HERE.md for the build instructions.'
  read '?Press Return to close this window.'
  exit 1
fi
cd "$consult_root/src-tauri" || exit 1
"$consult_binary" --no-tray >> "$consult_log" 2>&1 &
consult_pid=$!
sleep 1
if ! kill -0 "$consult_pid" 2>/dev/null; then
  wait "$consult_pid"
  consult_result=$?
  if (( consult_result != 0 )); then
    print 'Consult could not start. Please share the following error:'
    tail -n 15 "$consult_log"
    read '?Press Return to close this window.'
    exit "$consult_result"
  fi
fi
# A second launch forwards a show-window request to the existing instance.
print 'Consult startup completed. Its window should appear in front.'
print "If it does not, the startup log is: $consult_log"
