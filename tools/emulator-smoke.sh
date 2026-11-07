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
collect_diagnostics() {
  timeout 20s adb shell dumpsys activity activities > "$OUT/activity-final.txt" || true
  timeout 20s adb logcat -d -v time > "$OUT/logcat.txt" || true
}
trap collect_diagnostics EXIT
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
  if timeout 20s adb shell uiautomator dump /sdcard/window.xml >/dev/null 2>&1; then
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
# The cold CI image can show a System UI ANR over an otherwise started app.
# Recover that OS dialog once using its real Wait action. Never dismiss an ANR
# naming Zaměřovač, and retain the original screenshot/XML as environment evidence.
if python3 - "$OUT/01_domovska_obrazovka.xml" <<'PY'
import sys,xml.etree.ElementTree as ET
try:
    nodes=ET.parse(sys.argv[1]).getroot().iter('node')
    found=any('System UI' in n.get('text','') and 'respond' in n.get('text','') for n in nodes)
except Exception:
    found=False
sys.exit(0 if found else 1)
PY
then
  echo 'ENV: Cold-boot System UI ANR; choosing Wait once, not closing the app.' | tee -a "$OUT/summary.txt"
  if ! tap_text 'Wait'; then exit 1; fi
  sleep 5
  snap 01_po_system_ui_wait
  dump_ui 01_po_system_ui_wait
fi
# A fresh preview opens its release notes. Dismiss only an existing visible
# close control, then use the actual accessible add button rather than pixels.
if tap_text 'Zavřít'; then sleep 1; fi
if ! tap_text 'Přidat'; then
  echo 'FAIL: Tlačítko Přidat není dosažitelné.' | tee -a "$OUT/summary.txt"
  exit 1
fi
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
