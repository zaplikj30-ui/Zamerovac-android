"""Tests průchodnosti velké aktualizace a zásad ochrany stávajících dat."""
from pathlib import Path
import unittest
import subprocess

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / 'app/src/main/assets'
JAVA = ROOT / 'app/src/main/java/cz/zamerovac/app'


class BigUpdateSmokeTest(unittest.TestCase):
    def test_all_added_javascript_compiles(self):
        for name in ('upgrade.js', 'rich-notes.js', 'sketch.js'):
            with self.subTest(name=name):
                self.assertTrue((ASSETS / name).is_file())
                subprocess.run(['node', '--check', str(ASSETS / name)],
                               check=True, capture_output=True)

    def test_new_modules_are_loaded_from_app_index(self):
        html = (ASSETS / 'index.html').read_text(encoding='utf-8')
        for file in ('upgrade.css', 'upgrade.js', 'rich-notes.js', 'sketch.js'):
            self.assertIn(file, html)
        self.assertLess(html.index('editor.js'), html.index('upgrade.js'))
        self.assertLess(html.index('upgrade.js'), html.index('rich-notes.js'))

    def test_deferred_ideas_are_not_claimed_as_shipped(self):
        upgrade = (ASSETS / 'upgrade.js').read_text(encoding='utf-8')
        self.assertNotIn('floorPlanCameraMarkers', upgrade)
        self.assertNotIn('automaticSamsungNotesSync', upgrade)

    def test_preview_id_and_signing_are_not_changed(self):
        gradle = (ROOT / 'app/build.gradle').read_text(encoding='utf-8')
        self.assertIn("applicationId 'cz.zamerovac.app'", gradle)
        self.assertIn("applicationIdSuffix '.preview'", gradle)
        self.assertIn("keyAlias 'zamerovacdev'", gradle)
        self.assertIn("manifestPlaceholders = [appLabel: 'Zaměřovač']", gradle)
        self.assertIn('versionCode 1000 + workflowBuildNumber', gradle)

    def test_backup_includes_originals_and_isolated_restore(self):
        main = (JAVA / 'MainActivity.java').read_text(encoding='utf-8')
        restore = (JAVA / 'BackupImporter.java').read_text(encoding='utf-8')
        self.assertIn('new ZipEntry("projects.json")', main)
        self.assertIn('new ZipEntry("media-meta.json")', main)
        self.assertIn('new ZipEntry("media/"+id)', main)
        self.assertIn('UUID.randomUUID()', restore)
        self.assertIn('Obnovená záloha', restore)
        self.assertIn('MAX_ENTRIES', restore)
        self.assertIn('collectNestedMedia', main)
        self.assertIn('rewriteItems', restore)
        self.assertIn('writeDb(restored.data.toString())', main)

    def test_photo_notes_contain_editable_detail(self):
        editor = (ASSETS / 'editor.js').read_text(encoding='utf-8')
        rich = (ASSETS / 'rich-notes.js').read_text(encoding='utf-8')
        self.assertIn('openRichNote(item,true)', editor)
        self.assertIn("openRichNote(item,false)", editor)
        self.assertIn('detailItems', rich)
        self.assertIn('openNestedPhoto', rich)
        self.assertIn('Native.startAudio', rich)

    def test_diagnostics_and_version_history_present(self):
        upgrade = (ASSETS / 'upgrade.js').read_text(encoding='utf-8')
        for name in ('openDiagnostics', 'showChanges', 'openSumCheck',
                     'restoreVersion', 'setCloudState', 'onAddressCandidates',
                     'isRecordLocked', 'showLaserHistory', 'navigateToFeature'):
            self.assertIn(name, upgrade)
        self.assertIn('window.onLaserStatus', upgrade)


if __name__ == '__main__':
    unittest.main()
