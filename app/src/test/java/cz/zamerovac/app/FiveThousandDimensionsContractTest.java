package cz.zamerovac.app;

import android.content.*;
import org.json.*;
import org.junit.*;
import org.junit.runner.RunWith;
import org.robolectric.*;
import org.robolectric.annotation.Config;
import java.io.*;
import java.nio.file.*;
import java.util.*;
import static org.junit.Assert.*;

/**
 * #221/#232: regression contract for 5,000 editable dimensions.
 *
 * Intentionally RED on main until normal edits stop creating immutable full-DB
 * holds. This does NOT permit pruning legacy holds, photos or sync evidence.
 * A JVM test is not evidence of Android device speed or touch frame rate.
 */
@RunWith(RobolectricTestRunner.class)
@Config(sdk=35)
public class FiveThousandDimensionsContractTest {
    private static final String DEVICE_ID = "11111111-1111-4111-8111-111111111111";
    private static final String LASER = "1585.800001234567890";
    private static final byte[] PHOTO_ONE = {0, 1, 23, 47, 5};
    private static final byte[] PHOTO_TWO = {0, 3, 72, 41, 9};

    private static JSONObject annotation(int index) throws Exception {
        return new JSONObject()
            .put("type", "dimension").put("id", "dimension-" + index)
            .put("a", new JSONObject().put("x", index + 0.125).put("y", 2.5))
            .put("b", new JSONObject().put("x", index + 100.25).put("y", 3.5))
            .put("measure", LASER).put("laserMeasuredMm", LASER)
            .put("unit", "mm")
            .put("syncClock", new JSONObject().put(DEVICE_ID, 1))
            .put("rev", "initial").put("updatedAt", "2026-11-21T10:00:00Z");
    }

    private static JSONObject photo(String id, String mediaId, int count) throws Exception {
        JSONArray items = new JSONArray();
        for (int i = 0; i < count; i++) {
            JSONObject item = annotation(i);
            item.put("id", id + "-dimension-" + i);
            items.put(item);
        }
        return new JSONObject().put("id", id).put("kind", "photo")
            .put("media", new JSONArray().put(mediaId)).put("items", items)
            .put("syncClock", new JSONObject().put(DEVICE_ID, 1))
            .put("rev", "initial").put("updatedAt", "2026-11-21T10:00:00Z");
    }

    private static void touch(JSONObject object, int version) throws Exception {
        JSONObject clock = object.getJSONObject("syncClock");
        clock.put(DEVICE_ID, clock.getInt(DEVICE_ID) + 1);
        object.put("rev", "revision-" + version);
        object.put("updatedAt", "2026-11-21T10:00:" + String.format(Locale.ROOT, "%02d", version % 60) + "Z");
    }

    private static int databaseHolds(File home) throws Exception {
        File dir = new File(home, "protected-revisions");
        File[] files = dir.listFiles();
        if (files == null) {
            if (dir.exists()) throw new IOException("Protected revision directory cannot be listed");
            return 0;
        }
        int count = 0;
        for (File file : files) {
            if (!file.getName().matches("[a-f0-9]{64}\\.json")) continue;
            if ("database".equals(new JSONObject(Files.readString(file.toPath()))
                    .optString("kind"))) count++;
        }
        return count;
    }

    private static final class Fixture {
        final PeerTransferTest.Device device;
        final JSONObject database, first;
        final File mediaDirectory;
        String previous;

        Fixture(int dimensions) throws Exception {
            File root = Files.createTempDirectory(
                RuntimeEnvironment.getApplication().getCacheDir().toPath(),
                "zamerovac-5000-").toFile();
            device = new PeerTransferTest.Device(root, "phone");
            // Establish the durable empty installation before placing any media.
            // LocalDatabase correctly refuses an uninitialized home with orphan bytes.
            LocalDatabase.write(device, "{\\"schema\\":1,\\"records\\":[]}");
            mediaDirectory = new File(device.home, "media");
            assertTrue(mediaDirectory.mkdirs());
            Files.write(new File(mediaDirectory, "original-one").toPath(), PHOTO_ONE);
            assertTrue(device.prefs.edit().putString("mime-original-one", "image/jpeg")
                .putString("name-original-one", "One.jpg").commit());
            first = photo("photo-one", "original-one", dimensions);
            database = new JSONObject().put("schema", 1)
                .put("records", new JSONArray().put(first));
            commit();
        }

        void commit() throws Exception {
            String next = database.toString();
            LocalDatabase.write(device, next);
            assertEquals("The fully confirmed primary must survive reload",
                next, LocalDatabase.readForCas(device));
            if (previous != null)
                assertEquals("The immediately prior confirmed version is the backup",
                    previous, LocalDatabase.readFile(new File(device.home, "projects.bak")));
            assertArrayEquals(PHOTO_ONE, Files.readAllBytes(
                new File(mediaDirectory, "original-one").toPath()));
            previous = next;
        }

        void move(JSONObject record, int dimension, int version) throws Exception {
            JSONObject item = record.getJSONArray("items").getJSONObject(dimension);
            item.getJSONObject("a").put("x", 50000 + version + 0.125);
            touch(item, version);
            touch(record, version);
            commit();
        }

        JSONObject secondPhoto() throws Exception {
            Files.write(new File(mediaDirectory, "original-two").toPath(), PHOTO_TWO);
            assertTrue(device.prefs.edit().putString("mime-original-two", "image/jpeg")
                .putString("name-original-two", "Two.jpg").commit());
            JSONObject second = photo("photo-two", "original-two", 1);
            database.getJSONArray("records").put(second);
            commit();
            assertArrayEquals(PHOTO_TWO, Files.readAllBytes(
                new File(mediaDirectory, "original-two").toPath()));
            return second;
        }
    }

    @Test public void fiveThousandDimensionsMovingMustNotAccumulateFullDatabaseHolds()
        throws Exception {
        Fixture f = new Fixture(5000);
        int before = databaseHolds(f.device.home);
        for (int i = 0; i < 4; i++)
            f.move(f.first, i * 997, i + 1);
        assertEquals("Four pure gestures must create ZERO new full DB holds; "
            + "the actual touch also increments syncClock, rev and updatedAt",
            before, databaseHolds(f.device.home));
        assertEquals(LASER, f.first.getJSONArray("items").getJSONObject(0)
            .getString("laserMeasuredMm"));
    }

    @Test public void addingEditingAndDeletingDimensionsAreOrdinaryOnePlusOneSaves()
        throws Exception {
        Fixture f = new Fixture(20);
        int before = databaseHolds(f.device.home);
        JSONArray items = f.first.getJSONArray("items");
        items.put(annotation(20));
        touch(f.first, 1);
        f.commit();
        JSONObject changed = items.getJSONObject(20);
        changed.put("measure", "1250.000000987654321");
        touch(changed, 2);
        touch(f.first, 2);
        f.commit();
        items.remove(20);
        touch(f.first, 3);
        f.commit();
        assertEquals("New, changed and deleted dimensions cannot each create "
            + "a permanent full-database recovery copy",
            before, databaseHolds(f.device.home));
        assertEquals(20, items.length());
    }

    @Test public void secondPhotoMustNotSufferFromFirstPhotosEditHistory()
        throws Exception {
        Fixture f = new Fixture(100);
        for (int i = 0; i < 5; i++) f.move(f.first, i, i + 1);
        JSONObject second = f.secondPhoto();
        int before = databaseHolds(f.device.home);
        for (int i = 0; i < 5; i++) f.move(second, 0, i + 6);
        assertEquals("Editing the second photo must not add the first photo's "
            + "historical gesture copies",
            before, databaseHolds(f.device.home));
        assertArrayEquals(PHOTO_TWO, Files.readAllBytes(
            new File(f.mediaDirectory, "original-two").toPath()));
    }

    @Test public void historicalOriginalRemainsProtectedAcrossDimensionChanges()
        throws Exception {
        Fixture f = new Fixture(5);
        f.move(f.first, 0, 1);
        f.move(f.first, 1, 2);
        assertTrue(new ProtectedRevisions(f.device, f.device.prefs)
            .pinsForCleanup().contains("original-one"));
        assertArrayEquals(PHOTO_ONE, Files.readAllBytes(
            new File(f.mediaDirectory, "original-one").toPath()));
    }
}
