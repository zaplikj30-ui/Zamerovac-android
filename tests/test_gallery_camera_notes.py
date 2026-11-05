"""Regression checks for photo notes, gallery bounds and camera cancellation."""
import pathlib
import unittest

ROOT=pathlib.Path(__file__).resolve().parents[1]
ASSETS=ROOT/'app/src/main/assets'
JAVA=ROOT/'app/src/main/java/cz/zamerovac/app/MainActivity.java'

class PhotoNotesGalleryTests(unittest.TestCase):
    def test_back_persists_unsaved_photo_note(self):
        source=(ASSETS/'rich-notes.js').read_text(encoding='utf-8')
        self.assertIn('window.__activeRichNotePersist=persist',source)
        self.assertIn("if(window.__activeRichNotePersist()===false)return 'handled'",source)
        self.assertIn("return 'handled'",source)
        self.assertIn('window.__activeRichNotePersist=null',source)

    def test_gallery_includes_outside_insets(self):
        source=(ASSETS/'upgrade.js').read_text(encoding='utf-8')
        self.assertIn('let minX=0,minY=0,maxX=image.naturalWidth,maxY=image.naturalHeight',source)
        self.assertIn('window.insetAnnotationBounds?.(measure,item)',source)
        self.assertIn('const workspaceW=maxX-minX+2*margin',source)
        self.assertIn('c.translate(shiftX,shiftY);c.scale(scale,scale)',source)
        self.assertIn('view={zoom:1,dx:0,dy:0}',source)

    def test_camera_cancellation_cleans_state(self):
        source=JAVA.read_text(encoding='utf-8')
        self.assertIn('private void discardPendingCamera()',source)
        self.assertIn('if(request==REQUEST_CAMERA){discardPendingCamera();',source)
        self.assertIn('cameraOutput=null;cameraId=null;',source)
        self.assertIn('js("window.onNativeMediaDone?.()")',source)

if __name__=='__main__':
    unittest.main()
