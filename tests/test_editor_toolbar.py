"""Regression tests for the compact, single-choice editor toolbar."""
from pathlib import Path
import subprocess
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
