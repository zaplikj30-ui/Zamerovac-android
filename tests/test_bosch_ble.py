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
    def test_protocol_integration(self):
        java = ACTIVITY.read_text(encoding='utf-8')
        self.assertIn('BoschBleProtocol.MEASUREMENT_UUID', java)
        self.assertIn('BoschBleProtocol.START_STREAM', java)
        self.assertIn('onDescriptorWrite(', java)
        self.assertIn('onCharacteristicChanged(', java)
        self.assertIn('BoschBleProtocol.millimetersText(', java)
        self.assertNotIn('new String(bytes,StandardCharsets.US_ASCII).trim()', java)
        self.assertIn('private void startScan()', java)

    @unittest.skipUnless(shutil.which('javac') and shutil.which('java'), 'JDK není dostupné')
    def test_binary_distance_frame(self):
        harness = r"""
package cz.zamerovac.app;
public class BoschBleProtocolTest {
  public static void main(String[] args) {
    byte[] packet = {(byte)192,85,16,6,0,97,0,(byte)162,(byte)180,
                     (byte)151,62,0,0,0,0,0,0,0,0,(byte)172};
    if (!"296.5".equals(BoschBleProtocol.millimetersText(packet)))
      throw new AssertionError("Známý paket Bosch 0,296 m musí dát 296,5 mm");
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
