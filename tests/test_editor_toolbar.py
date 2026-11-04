"""Regression tests for the compact, single-choice editor toolbar."""
from pathlib import Path
import subprocess
import re
import unittest

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / 'app/src/main/assets'

class EditorToolbarTests(unittest.TestCase):
    def test_toolbar_extension_parses(self):
        subprocess.run(['node', '--check', str(ASSETS/'upgrade.js')],
                       check=True, capture_output=True)

    def test_tools_only_behind_plus(self):
        script=(ASSETS/'upgrade.js').read_text(encoding='utf-8')
        css=(ASSETS/'upgrade.css').read_text(encoding='utf-8')
        self.assertIn("const originalShowTools=showTools", script)
        self.assertIn("showTools=function()", script)
        self.assertIn("$('activeTool').hidden=false", script)
        self.assertIn('display:flex!important', css)
        self.assertIn("lastButton.classList.toggle('tool-active',activeLastTool)", script)
        self.assertIn("lastButton.setAttribute('aria-pressed'", script)
        self.assertNotIn("function renderFavorites()", script)
        self.assertNotIn("prefs.editorFavorites.map", script)
        self.assertNotIn("openFavorites", script)

    def test_current_tool_is_highlighted_with_accessible_state(self):
        script=(ASSETS/'upgrade.js').read_text(encoding='utf-8')
        css=(ASSETS/'upgrade.css').read_text(encoding='utf-8')
        self.assertIn('function highlightCurrentTool()', script)
        self.assertIn("button.dataset.tool===mode", script)
        self.assertIn("classList.toggle('tool-chosen',active)", script)
        self.assertIn('aria-pressed', script)
        self.assertIn('tool-choice-check', script)
        self.assertIn('#activeTool.tool-active', css)
        self.assertIn('border-left:0', css)
        self.assertIn('.choice.tool-chosen', css)

    def test_style_button_is_pencil_and_ruler_not_dimension_shortcut(self):
        script=(ASSETS/'upgrade.js').read_text(encoding='utf-8')
        self.assertIn("$('styleTool').innerHTML='<svg",script)
        self.assertIn("Vzhled kóty – pravítko a tužka",script)
        self.assertIn("$('styleTool').setAttribute('aria-label'",script)
        self.assertIn("$('deleteTool').innerHTML='<svg",script)

    def test_undo_and_redo_icons_are_exact_mirrors(self):
        html=(ASSETS/'index.html').read_text(encoding='utf-8')
        extra=(ASSETS/'editor-extra-toolbar.js').read_text(encoding='utf-8')
        undo=re.search(r'<button[^>]*id="undo"[^>]*>(.*?)</button>', html, re.S)
        self.assertIsNotNone(undo)
        self.assertIn('transform="translate(24 0) scale(-1 1)"', undo.group(1))
        self.assertIn('viewBox="0 0 24 24"', undo.group(1))
        self.assertIn('stroke-width="1.75"', undo.group(1))
        self.assertEqual(re.findall(r'<path d="([^"]+)"', undo.group(1)),
                         re.findall(r'<path d="([^"]+)"', re.search(r"redo:'([^']+)'", extra).group(1)))
        self.assertIn("['redo','Znovu poslední úpravu']", extra)
        self.assertIn('id="undo" title="Zpět"', html)

    def test_existing_tools_and_repeat_mode_still_available(self):
        editor=(ASSETS/'editor.js').read_text(encoding='utf-8')
        self.assertIn("['note'",editor)
        self.assertIn("['dimension'",editor)
        self.assertIn("['select'",editor)
        self.assertIn("prefs.repeatDrawing=!prefs.repeatDrawing",editor)
        self.assertIn("$('activeTool').onclick=()=>",editor)
        self.assertIn("setTool(lastDrawingTool)",editor)

if __name__=='__main__':
    unittest.main()
