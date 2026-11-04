"""Automatické testy přenosu vzdálenosti Bosch BLE bez Android telefonu."""
import pathlib
import shutil
import subprocess
import tempfile
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'app/src/main/java/cz/zamerovac/app/BoschBleProtocol.java'
ACTIVITY = ROOT / 'app/src/main/java/cz/zamerovac/app/MainActivity.java'

class BoschBleTests(unittest.TestCase):
    def test_meter_history_separate_button_and_long_press(self):
        ui=(ROOT/'app/src/main/assets/upgrade.js').read_text(encoding='utf-8')
        html=(ROOT/'app/src/main/assets/index.html').read_text(encoding='utf-8')
        css=(ROOT/'app/src/main/assets/upgrade.css').read_text(encoding='utf-8')
        self.assertIn('Historii měření otevřeš ikonou měřáku vedle Bluetooth',ui)
        self.assertIn("oldBluetoothLong.addEventListener('contextmenu'",ui)
        self.assertIn("window.__boschHistoryReadings=()",ui)
        self.assertIn("$('boschHistoryBtn').onclick=showLaserHistory;",ui)
        self.assertIn('id="boschHistoryBtn"',html)
        self.assertIn('aria-label="Historie měření Bosch"',html)
        self.assertLess(html.index('id="bluetoothBtn"'),html.index('id="boschHistoryBtn"'))
        self.assertLess(html.index('id="boschHistoryBtn"'),html.index('id="cloudBtn"'))
        self.assertIn('#boschHistoryBtn',css)
        self.assertNotIn('bt-history-mark',ui+css)
        self.assertIn('b.innerHTML=icon+overlay',ui)

    def test_meter_identity_is_private_and_persistent(self):
        java=ACTIVITY.read_text(encoding='utf-8')
        self.assertIn('private String laserHistoryKey(BluetoothDevice device)',java)
        self.assertIn('getString("boschHistorySalt",null)',java)
        self.assertIn('MessageDigest.getInstance("SHA-256")',java)
        self.assertIn('.put("deviceId",activeLaserHistoryId)',java)
        self.assertIn('activeLaserHistoryId=laserHistoryKey(device)',java)
        self.assertIn('activeLaserHistoryId=""',java)
        self.assertNotIn('.put("deviceId",device.getAddress())',java)
        ui=(ROOT/'app/src/main/assets/upgrade.js').read_text(encoding='utf-8')
        self.assertIn('function boschHistoryGroups()',ui)
        self.assertIn('const multi=groups.size>1',ui)
        self.assertIn('Starší měření bez přiřazení',ui)
        self.assertIn("readings.length>200",ui)
        self.assertIn('Vymazat vybranou historii',ui)
        self.assertIn('Potvrdit vymazání historie',ui)

    def test_protocol_integration(self):
        java = ACTIVITY.read_text(encoding='utf-8')
        self.assertIn('BoschBleProtocol.MEASUREMENT_UUID', java)
        self.assertIn('BoschBleProtocol.START_STREAM', java)
        self.assertIn('onDescriptorWrite(', java)
        self.assertIn('onCharacteristicChanged(', java)
        self.assertIn('BoschBleProtocol.millimetersText(', java)
        self.assertNotIn('new String(bytes,StandardCharsets.US_ASCII).trim()', java)
        self.assertIn('private void startScan()', java)
        self.assertIn('adapter.getBondedDevices()', java)
        self.assertIn('leAddresses.contains(d.getAddress())', java)

    @unittest.skipUnless(shutil.which('javac') and shutil.which('java'), 'JDK není dostupné')
    def test_binary_distance_frame(self):
        harness = r"""
package cz.zamerovac.app;
public class BoschBleProtocolTest {
  public static void main(String[] args) {
    byte[] packet = {(byte)192,85,16,6,0,97,0,(byte)162,(byte)180,
                     (byte)151,62,0,0,0,0,0,0,0,0,(byte)172};
    if (!"296.3".equals(BoschBleProtocol.millimetersText(packet)))
      throw new AssertionError("Známý paket Bosch 0,296 m musí zachovat 296,3 mm");
    packet[0]=0;
    if (BoschBleProtocol.millimetersText(packet)!=null)
      throw new AssertionError("Neplatný paket nesmí dát měření");
    if (BoschBleProtocol.millimetersText(new byte[0])!=null)
      throw new AssertionError("Prázdný paket nesmí dát měření");
    System.out.println("OK: Bosch BLE binární paket a ochrana proti vadným datům");
  }
}
"""
        with tempfile.TemporaryDirectory() as tmp:
            p = pathlib.Path(tmp) / 'BoschBleProtocolTest.java'
            p.write_text(harness, encoding='utf-8')
            subprocess.run(['javac','-d',tmp,str(SOURCE),str(p)],check=True,
                           capture_output=True,text=True)
            subprocess.run(['java','-cp',tmp,'cz.zamerovac.app.BoschBleProtocolTest'],
                           check=True,capture_output=True,text=True)

if __name__=='__main__':
    unittest.main()
