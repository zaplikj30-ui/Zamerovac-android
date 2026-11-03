"""Opravené ikony a ruční doplnění čísla popisného nesmějí regresovat."""
from pathlib import Path
import subprocess
import unittest

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT/'app/src/main/assets'
JAVA = ROOT/'app/src/main/java/cz/zamerovac/app'

class PhotoAddressAndIconsTest(unittest.TestCase):
    def test_address_script_loaded_and_valid(self):
        html=(ASSETS/'index.html').read_text(encoding='utf-8')
        self.assertIn('address-correction.js',html)
        self.assertLess(html.index('upgrade.js'),html.index('address-correction.js'))
        subprocess.run(['node','--check',str(ASSETS/'address-correction.js')],check=True,capture_output=True)

    def test_rural_house_number_not_discarded_when_street_missing(self):
        src=(JAVA/'PhotoAddressResolver.java').read_text(encoding='utf-8')
        self.assertIn('a.getSubThoroughfare()',src)
        self.assertIn('a.getFeatureName()',src)
        self.assertIn('sb.append(city.trim())',src)
        self.assertIn('sb.append(number.trim())',src)

    def test_ruian_only_looks_at_real_addresses(self):
        src=(JAVA/'AddressLookup.java').read_text(encoding='utf-8')
        self.assertIn('GeocodeSOE/tables/1/findAddressCandidates',src)

    def test_manually_confirmed_address_is_preserved(self):
        app=(ASSETS/'app.js').read_text(encoding='utf-8')
        corrections=(ASSETS/'address-correction.js').read_text(encoding='utf-8')
        self.assertIn('record.photoAddressConfirmed',app)
        self.assertIn('record.photoAddressConfirmed=true',corrections)
        self.assertIn('Doplnit číslo domu',corrections)
        self.assertIn('Uložit adresu',corrections)

    def test_svg_icons_not_placeholder_characters(self):
        script=(ASSETS/'upgrade.js').read_text(encoding='utf-8')
        self.assertIn('class="bluetooth-symbol"',script)
        self.assertIn('browseGallery.innerHTML=',script)
        self.assertIn('bt-spinner',script)
        self.assertNotIn("browseGallery.textContent='▧'",script)
        self.assertNotIn("b.textContent=laserState==='connected'?'ᛒ✓'",script)

if __name__=='__main__':
    unittest.main()
