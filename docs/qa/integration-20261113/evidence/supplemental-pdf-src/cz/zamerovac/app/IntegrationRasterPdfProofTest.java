package cz.zamerovac.app;
import static org.junit.Assert.*;
import java.io.*;
import java.nio.file.*;
import java.util.*;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.robolectric.*;
import org.robolectric.annotation.*;
@RunWith(RobolectricTestRunner.class)
@Config(sdk=35)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
public class IntegrationRasterPdfProofTest {
 @Test public void actualBrowserRasterSurvivesNativeMultipagePdfAndRejectedInput() throws Exception {
  Path png=Path.of(System.getProperty("integration.png"));byte[] original=Files.readAllBytes(png);
  String encoded=Base64.getEncoder().encodeToString(original);
  CustomerPdfExport writer=new CustomerPdfExport(RuntimeEnvironment.getApplication().getCacheDir());
  try {
   writer.begin("Browser exact dimension 1585,800001 and rotated inset");
   writer.addPage(encoded);writer.addPage(encoded);writer.end();
   Files.copy(writer.archive().toPath(),Path.of(System.getProperty("integration.pdf")),StandardCopyOption.REPLACE_EXISTING);
  } finally {writer.close();}
  CustomerPdfExport bad=new CustomerPdfExport(RuntimeEnvironment.getApplication().getCacheDir());
  try {
   bad.begin("Rejected input");
   try {bad.addPage("invalid");fail("Invalid input accepted");}catch(IOException expected){}
   try {bad.archive();fail("Incomplete export accepted");}catch(IOException expected){}
  }finally{bad.close();}
  assertArrayEquals("Native export changed the original browser raster",original,Files.readAllBytes(png));
 }
}
