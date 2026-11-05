"""Coordinate validation and fixed destination do not depend on Android APIs."""
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'app/src/main/java/cz/zamerovac/app/AddressMapLink.java'

class AddressMapLinkTest(unittest.TestCase):
    @unittest.skipUnless(shutil.which('javac') and shutil.which('java'), 'JDK není dostupné')
    def test_valid_and_invalid_coordinates(self):
        java = '''package cz.zamerovac.app;
public class MapLinkCheck {
  public static void main(String[] args) {
    String link = AddressMapLink.forCoordinates(49.557, 17.618);
    if (!link.equals("https://www.openstreetmap.org/?mlat=49.557&mlon=17.618#map=17/49.557/17.618"))
      throw new AssertionError(link);
    AddressMapLink.forCoordinates(-90, 180);
    double[][] invalid = {{Double.NaN, 1}, {1, Double.POSITIVE_INFINITY}, {90.01, 1}, {1, -180.01}};
    for (double[] pair : invalid) {
      try { AddressMapLink.forCoordinates(pair[0], pair[1]); throw new AssertionError("accepted invalid coordinates"); }
      catch (IllegalArgumentException expected) { }
    }
  }
}'''
        with tempfile.TemporaryDirectory() as tmp:
            fixture = Path(tmp) / 'MapLinkCheck.java'
            fixture.write_text(java, encoding='utf-8')
            subprocess.run(['javac', '-d', tmp, str(SOURCE), str(fixture)], check=True)
            subprocess.run(['java', '-cp', tmp, 'cz.zamerovac.app.MapLinkCheck'], check=True)

if __name__ == '__main__':
    unittest.main()
