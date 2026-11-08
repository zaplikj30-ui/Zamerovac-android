"""Regression checks for unobtrusive ImageMeter-style selected dimension outlines."""
from pathlib import Path
import re
import unittest

EDITOR = (Path(__file__).resolve().parents[1] / 'app/src/main/assets/editor.js')
GEOMETRY = (Path(__file__).resolve().parents[1] / 'app/src/main/assets/annotation-geometry.js')


class DimensionSelectionTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.script = EDITOR.read_text(encoding='utf-8')
        cls.geometry = GEOMETRY.read_text(encoding='utf-8')
        cls.outline = cls.script.split('function drawSelectedOutline(c,item){', 1)[1].split('function drawSelectedGrips(c){', 1)[0]

    def test_white_selection_is_behind_yellow_line_not_drawn_over_it(self):
        self.assertIn('if(item.id===selected)drawSelectedOutline(ctx,item);drawItem(ctx,item)', self.script)
        self.assertNotIn('drawSelectedOutline(ctx);', self.script)

    def test_soft_outline_includes_line_terminal_ticks_and_arrows(self):
        self.assertIn("c.strokeStyle='rgba(255,255,255,.55)'", self.outline)
        self.assertIn('c.moveTo(ao.x,ao.y);c.lineTo(bo.x,bo.y)', self.outline)
        self.assertIn('drawArrow(c,ao,bo,9)', self.outline)
        self.assertIn('drawArrow(c,bo,ao,9)', self.outline)

    def test_visual_rings_are_translucent_and_independent_of_touch_target(self):
        self.assertIn("c.fillStyle='rgba(255,255,255,.12)'", self.outline)
        self.assertIn('c.arc(point.x,point.y,14,0,Math.PI*2)', self.outline)
        self.assertIn('let best=null,dist=31', self.geometry)
        self.assertIn('return AnnotationGeometry.nearestHandle(point,current.items||[],view,onlyItem);', self.script)
        self.assertNotIn('current.items.push', self.outline)

    def test_other_selection_tools_remain(self):
        self.assertIn('function drawSelectedGrips(c)', self.script)
        self.assertRegex(self.script, r"if\(item\.type==='note'&&item\.media\?\.length\)return;")


if __name__ == '__main__':
    unittest.main()
