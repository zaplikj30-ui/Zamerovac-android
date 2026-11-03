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
        # Geometrie, popisek i bílé zvýraznění používají stejný posun.
        self.assertEqual(editor.count('item.offset??0'), 3)
        self.assertNotIn('item.offset??-22', editor)
        self.assertIn('worldToScreen(item[key])', editor)
        self.assertIn('magnifierPoint=selectedHandle.point', editor)

    def test_reference_magnifier_geometry(self):
        editor=(ASSETS/'editor.js').read_text()
        css=(ASSETS/'style.css').read_text()
        # Comparison screenshots: ~160 actual pixels on phone = 136 CSS px.
        self.assertIn('const size=136;', editor)
        self.assertIn('border-radius:32px', css)
        self.assertIn('loupeCtx.setLineDash([5,7])', editor)
        self.assertIn('size*.5-pointer.x*zoom,size*.5-pointer.y*zoom', editor)

    def test_installed_version_visible_to_user(self):
        activity=(ROOT/'app/src/main/java/cz/zamerovac/app/MainActivity.java').read_text()
        app=(ASSETS/'app.js').read_text()
        css=(ASSETS/'style.css').read_text()
        self.assertIn('getPackageManager().getPackageInfo(getPackageName(),0).versionName', activity)
        self.assertIn('Native.getAppVersion()', app)
        self.assertIn('id="appVersionInfo"', app)
        self.assertIn('#screenTitle .app-version', css)

    def test_photo_thumbnails_and_menu(self):
        app=(ASSETS/'app.js').read_text()
        css=(ASSETS/'style.css').read_text()
        activity=(ROOT/'app/src/main/java/cz/zamerovac/app/MainActivity.java').read_text()
        self.assertIn('function browserEntryIcon(r)', app)
        self.assertIn('entry-thumb', app)
        self.assertIn('photoThumbnail(id)', activity)
        self.assertIn('"/thumb/"', activity)
        self.assertIn('.entry-icon.photo-preview', css)
        # "Zakázky" was a no-op that only called showFolder on itself.
        self.assertNotIn("['📁  Zakázky',()=>showFolder()]", app)

    def test_photo_capture_time_and_readable_location(self):
        app=(ASSETS/'app.js').read_text()
        activity=(ROOT/'app/src/main/java/cz/zamerovac/app/MainActivity.java').read_text()
        resolver=(ROOT/'app/src/main/java/cz/zamerovac/app/PhotoAddressResolver.java').read_text()
        manifest=(ROOT/'app/src/main/AndroidManifest.xml').read_text()
        self.assertIn('java.time.Instant.now().toString()', activity)
        self.assertIn('ExifInterface.TAG_DATETIME_ORIGINAL', activity)
        self.assertIn('PhotoAddressResolver.resolve', activity)
        self.assertIn('window.onNativePhotoAddress=', app)
        self.assertIn('photoTakenAt', app)
        self.assertIn('photoAddress', app)
        self.assertIn('getFromLocation(', resolver)
        self.assertIn('ACCESS_COARSE_LOCATION', manifest)
        self.assertIn('ACCESS_FINE_LOCATION', manifest)
        self.assertNotIn('latitude:', app)
        self.assertNotIn('longitude:', app)

    def test_cloud_and_media_are_real_modules(self):
        java=ROOT/'app/src/main/java/cz/zamerovac/app'
        for module in ('SyncEngine.java','SyncJob.java','BoschClassicReader.java','MediaProvider.java'):
            self.assertTrue((java/module).is_file())
if __name__ == '__main__': unittest.main()
