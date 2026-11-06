"""Reference checks for inset-detail-photo handling (ImageMeter comparison).

Does not change touch targets or stored dimensions of older notes.
"""
from pathlib import Path
import unittest

ROOT=Path(__file__).resolve().parents[1]
NOTES=(ROOT/'app/src/main/assets/rich-notes.js').read_text('utf-8')
INSET=(ROOT/'app/src/main/assets/inset-workspace.js').read_text('utf-8')


class ImageMeterInsetTests(unittest.TestCase):
    def test_new_inset_is_large_enough_and_existing_size_survives(self):
        self.assertIn('Number(item.insetWidth)||Math.max(140,Math.min(1400,Math.round(photoSize.w*.42)))', NOTES)
        self.assertIn("item.insetWidth=Math.max(70,Math.min(1500", NOTES)

    def test_original_image_remains_editable(self):
        self.assertIn('function openNestedPhoto(parent,item,mediaId)', NOTES)
        self.assertIn("item.detailItems||[]", NOTES)
        self.assertIn('window.renderPhotoInset=function', INSET)

    def test_image_border_stays_yellow_when_selected(self):
        self.assertIn("c.strokeStyle='#f7dc27';c.lineWidth=isSelected?2.4:2", INSET)
        self.assertNotIn("isSelected?'#e3c4ff'", INSET)

    def test_grips_show_resize_and_rotation_without_changing_hit_targets(self):
        self.assertIn("c.arc(g.cx,g.cy,11", INSET)
        self.assertIn("rgba(255,255,255,.46)", INSET)
        self.assertIn("c.beginPath();c.moveTo(-12,0);c.lineTo(12,0);c.stroke();", INSET)
        self.assertIn("for(const [start,end] of [[Math.PI*1.1,Math.PI*1.85]", INSET)
        self.assertIn("rgba(255,255,255,.92)", INSET)
        self.assertIn("rotationHandle(c,turn(", INSET)
        self.assertIn("const near=position=>pointerDistance(point,position)<=24", INSET)
        self.assertIn("kind:'resize-right'", INSET)
        self.assertIn("kind:'resize-left'", INSET)

    def test_detail_can_leave_photo_without_moving_note_anchor(self):
        self.assertIn("v.item.insetX=v.startingX+dx/view.zoom", INSET)
        self.assertIn("v.item.insetY=v.startingY+dy/view.zoom", INSET)
        self.assertIn("v.item.a=boundsPoint(w)", INSET)
        self.assertIn("v.item.insetMoved=true", INSET)


if __name__=='__main__':
    unittest.main()
