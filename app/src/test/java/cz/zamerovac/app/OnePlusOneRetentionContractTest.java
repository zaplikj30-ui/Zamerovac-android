package cz.zamerovac.app;

import android.content.*;
import org.json.*;
import org.junit.*;
import org.junit.runner.RunWith;
import org.robolectric.*;
import org.robolectric.annotation.Config;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.util.*;
import static org.junit.Assert.*;

/**
 * #221: RED contract for the owner-approved 1 current + 1 backup design.
 *
 * These are INTENTIONALLY RED on main (2026-11-21). They do not justify
 * deleting existing protected revisions or weakening photo/sync recovery.
 * No production behavior changes until independent DESIGN/SECURITY review.
 */
@RunWith(RobolectricTestRunner.class)
@Config(sdk=35)
public class OnePlusOneRetentionContractTest {
    static final byte[] ORIGINAL = {0, 8, 13, 22, 101, 3};

    private static final class Fixture {
        final PeerTransferTest.Device device;
        final JSONObject data, dimension, circle, rectangle;
        String previous;

        Fixture() throws Exception {
            File root = Files.createTempDirectory(
                RuntimeEnvironment.getApplication().getCacheDir().toPath(),
                "one-plus-one-").toFile();
            device = new PeerTransferTest.Device(root, "phone");
            // A clean installation must have a durable empty database before media.
            previous = "{\"schema\":1,\"records\":[]}";
            LocalDatabase.write(device, previous);
            File media = new File(device.home, "media");
            assertTrue(media.mkdirs());
            Files.write(new File(media, "original-photo").toPath(), ORIGINAL);
            assertTrue(device.prefs.edit().putString("mime-original-photo", "image/jpeg")
                .putString("name-original-photo", "Original.jpg").commit());

            dimension = new JSONObject().put("type", "dimension")
                .put("measure", "1585.800001234567890").put("unit", "mm")
                .put("a", new JSONObject().put("x", 1.125).put("y", 2.5))
                .put("b", new JSONObject().put("x", 100.25).put("y", 3.5));
            circle = new JSONObject().put("type", "circle")
                .put("a", new JSONObject().put("x", 10).put("y", 10))
                .put("b", new JSONObject().put("x", 30).put("y", 30));
            rectangle = new JSONObject().put("type", "rect")
                .put("a", new JSONObject().put("x", 50).put("y", 50))
                .put("b", new JSONObject().put("x", 90).put("y", 90));
            JSONObject photo = new JSONObject().put("id", "photo-1").put("kind", "photo")
                .put("media", new JSONArray().put("original-photo"))
                .put("items", new JSONArray().put(dimension).put(circle).put(rectangle));
            data = new JSONObject().put("schema", 1).put("records", new JSONArray().put(photo));
        }

        void changeAndCommit(int move) throws Exception {
            dimension.getJSONObject("a").put("x", move + 0.125);
            circle.getJSONObject("b").put("y", move + 30.25);
            rectangle.getJSONObject("a").put("x", move + 50.5);
            String next = data.toString();
            LocalDatabase.write(device, next);
            assertEquals("New confirmed work must survive reload", next,
                LocalDatabase.readForCas(device));
            assertEquals("One previous fully confirmed state is kept", previous,
                LocalDatabase.readFile(new File(device.home, "projects.bak")));
            assertArrayEquals("Original photo bytes must not change", ORIGINAL,
                Files.readAllBytes(new File(device.home, "media/original-photo").toPath()));
            previous = next;
        }
    }

    @Test public void repeatedShapeMovesMustNotArchiveEveryOldDatabaseState() throws Exception {
        Fixture f = new Fixture();
        for (int i = 0; i < 18; i++) f.changeAndCommit(i);
        File directory = new File(f.device.home, "protected-revisions");
        int databaseRevisions = 0;
        File[] holds = directory.listFiles();
        if (holds != null) for (File file : holds) {
            if (!file.getName().matches("[a-f0-9]{64}\\.json")) continue;
            JSONObject hold = new JSONObject(new String(
                Files.readAllBytes(file.toPath()), StandardCharsets.UTF_8));
            if ("database".equals(hold.optString("kind"))) databaseRevisions++;
        }
        // Target contract, not an assertion that current implementation passes.
        assertTrue("RED on main: every drag adds a full historical DB version (actual: "
            + databaseRevisions + ")", databaseRevisions <= 2);
    }

    @Test public void syncingMustNotShipEveryIntermediateShapePosition() throws Exception {
        Fixture f = new Fixture();
        for (int i = 0; i < 12; i++) f.changeAndCommit(i);
        PeerSnapshot recovery = PeerSnapshot.captureRecovery(f.device, f.device.prefs, () -> {});
        int carried = recovery == null ? 0 : recovery.wire.getJSONArray("recovery").length();
        // Necessary media/ACK/conflict evidence must be preserved separately.
        // Review must resolve compatibility before this can be GREEN.
        assertTrue("RED on main: recovery sync includes historic gesture snapshots (actual: "
            + carried + ")", carried <= 1);
        assertEquals(f.previous, LocalDatabase.readForCas(f.device));
        assertArrayEquals(ORIGINAL, Files.readAllBytes(
            new File(f.device.home, "media/original-photo").toPath()));
    }
}
