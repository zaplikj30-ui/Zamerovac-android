"""Sanity checks; the project must additionally build against the Android SDK."""
from pathlib import Path
import subprocess
import unittest
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT/'app/src/main/assets'
class SourceSmokeTest(unittest.TestCase):
    def test_javascript_syntax(self):
        for name in ('app.js','editor.js'):
            subprocess.run(['node','--check',str(ASSETS/name)],check=True,capture_output=True)
    def test_manifest_and_resources(self):
        for path in (ROOT/'app/src/main/AndroidManifest.xml',ROOT/'app/src/main/res/values/styles.xml',ROOT/'app/src/main/res/drawable/ic_launcher.xml'):
            ET.parse(path)
    def test_editor_controls_present(self):
        scripts=(ASSETS/'app.js').read_text()+(ASSETS/'editor.js').read_text()
        for item in ('drawLoupe','checkpoint','commitEditor','onNativeMedia','onNativeSync','onLaserValue','syncCloud','openNote'):
            self.assertIn(item,scripts)
    def test_excluded_tools(self):
        tools=(ASSETS/'editor.js').read_text()
        for forbidden in ('Počítadlo','Výsledková listina','Perspektivní délka','Referenční měřítko'):
            self.assertNotIn(forbidden,tools)
    def test_dimension_endpoints_match_grips_and_loupe(self):
        # Regression: the previous -22px visual offset put the dimension's
        # visible endpoint at a different location than its editable anchor.
        # The magnifier correctly centered the anchor, not the visible arrow.
        editor=(ASSETS/'editor.js').read_text()
        self.assertEqual(editor.count('item.offset??0'), 2)
        self.assertNotIn('item.offset??-22', editor)
        self.assertIn('worldToScreen(it[key])', editor)
        self.assertIn('magnifierPoint=selectedHandle.point', editor)

    def test_cloud_and_media_are_real_modules(self):
        java=ROOT/'app/src/main/java/cz/zamerovac/app'
        for module in ('SyncEngine.java','SyncJob.java','BoschClassicReader.java','MediaProvider.java'):
            self.assertTrue((java/module).is_file())
if __name__ == '__main__': unittest.main()
