#!/usr/bin/env bash
# End-to-end visual smoke test of Zaměřovač TEST on an Android emulator.
# Screenshots/logs are retained as a GitHub Actions artifact. No customer data.
set -Eeuo pipefail
OUT="${GITHUB_WORKSPACE:-$PWD}/emulator-results"
mkdir -p "$OUT"
PACKAGE="cz.zamerovac.app.preview"
ACTIVITY="cz.zamerovac.app.MainActivity"
APK="app/build/outputs/apk/preview/app-preview.apk"
echo "===== Zaměřovač Android emulátor =====" | tee "$OUT/summary.txt"
adb wait-for-device
adb shell settings put system accelerometer_rotation 0 || true
adb shell settings put system user_rotation 0 || true
# Keep the display close to a portrait Samsung phone for comparable photos.
adb shell wm size 1080x2340
adb shell wm density 420
adb shell input keyevent 82 || true
adb logcat -c || true
adb install -r -t "$APK" | tee "$OUT/install.txt"
adb shell am start -W -n "$PACKAGE/$ACTIVITY" | tee "$OUT/start.txt"
sleep 12
snap() {
  local name="$1"
  adb exec-out screencap -p > "$OUT/$name.png"
  test -s "$OUT/$name.png"
  echo "Snímek: $name.png" | tee -a "$OUT/summary.txt"
}
dump_ui() {
  local name="$1"
  if adb shell uiautomator dump /sdcard/window.xml >/dev/null 2>&1; then
    adb exec-out cat /sdcard/window.xml > "$OUT/$name.xml" || true
  fi
}
# Locate visible controls by text/content-desc in the accessibility tree.
# Clicking by label is more stable across resolutions than hardcoded coordinates.
tap_text() {
  local label="$1"
  dump_ui "ui_current"
  if [ ! -s "$OUT/ui_current.xml" ]; then return 1; fi
  local xy
  xy="$(python3 - "$OUT/ui_current.xml" "$label" <<'PY'
import re,sys,xml.etree.ElementTree as ET
file,label=sys.argv[1:]
try:
    root=ET.parse(file).getroot()
    hits=[]
    for node in root.iter('node'):
        text=(node.get('text','')+' '+node.get('content-desc',''))
        if label.lower() not in text.lower(): continue
        bounds=node.get('bounds','')
        m=re.match(r'\[(\d+),(\d+)\]\[(\d+),(\d+)\]',bounds)
        if m:
            x1,y1,x2,y2=map(int,m.groups())
            hits.append(((x1+x2)//2,(y1+y2)//2))
    if hits: print(*hits[0])
except Exception: pass
PY
)"
  if [ -z "$xy" ]; then return 1; fi
  echo "Klepnutí na '$label': $xy" | tee -a "$OUT/summary.txt"
  adb shell input tap $xy
}
snap 01_domovska_obrazovka
dump_ui 01_domovska_obrazovka
# Open the new-item sheet using the bottom-left plus button.
adb shell input tap 66 2205
sleep 2
snap 02_nabidka_pridat
dump_ui 02_nabidka_pridat
if tap_text 'Nový náčrt'; then
  sleep 2
  snap 03_zalozeni_platna
  dump_ui 03_zalozeni_platna
  # The modal defaults to "Nový náčrt"; save it without typing user data.
  if tap_text 'Uložit'; then
    sleep 3
    snap 04_seznam_s_testovacim_platnem
    if tap_text 'Nový náčrt'; then
      sleep 3
      snap 05_editor_pred_kotou
      # A press-and-drag captures the in-progress magnifier near the end.
      adb shell input swipe 250 630 610 1410 3600 &
      drag_pid=$!
      sleep 2
      snap 06_lupa_behem_tazeni
      wait "$drag_pid" || true
      sleep 2
      snap 07_editor_po_kote
      dump_ui 07_editor_po_kote
      # Check edit near the left side too, but do not accidentally delete data.
      adb shell input swipe 250 630 170 740 2000 &
      drag_pid=$!
      sleep 1
      snap 08_lupa_vlevo
      wait "$drag_pid" || true
    else
      echo "FAIL: Nelze otevřít nově vytvořené plátno přes přístupnost." | tee -a "$OUT/summary.txt"
      exit 1
    fi
  else
    echo "FAIL: Nové plátno se nepodařilo uložit přes přístupnost." | tee -a "$OUT/summary.txt"
    exit 1
  fi
else
  echo "FAIL: Nový náčrt se v přístupnosti nenašel; postup nebyl proveden." | tee -a "$OUT/summary.txt"
  exit 1
fi
adb shell dumpsys activity activities > "$OUT/activity-final.txt" || true
adb logcat -d -v time > "$OUT/logcat.txt" || true
# Actual app-crash detection is a hard failure; UI snapshots above are diagnostics.
if grep -A 12 -E 'FATAL EXCEPTION|AndroidRuntime: FATAL' "$OUT/logcat.txt" | grep -qE "$PACKAGE|$ACTIVITY"; then
  echo "CHYBA: Pád Zaměřovače, viz logcat.txt" | tee -a "$OUT/summary.txt"
  exit 1
fi
if ! adb shell pidof "$PACKAGE" >/dev/null; then
  echo "CHYBA: Aplikace není spuštěná." | tee -a "$OUT/summary.txt"
  exit 1
fi
echo "PASS: Smoke procesu a průchod do editoru. IME/picker ověřuje až android-system.cjs; samotné snímky nejsou funkční PASS." | tee -a "$OUT/summary.txt"
