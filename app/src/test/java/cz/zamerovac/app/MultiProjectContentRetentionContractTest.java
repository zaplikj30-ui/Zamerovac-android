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
 * #221/#232: realistic long-running work across multiple projects.
 * One project has 30 annotated photos x 20 editable dimensions.
 * Notes contain exact text, image originals and audio originals.
 *
 * RED contract on the old writer: ordinary edits must not append another
 * immutable full-database revision. This is not a physical Android benchmark.
 */
@RunWith(RobolectricTestRunner.class)
@Config(sdk=35)
public class MultiProjectContentRetentionContractTest {
    private static final String DEVICE_ID = "11111111-1111-4111-8111-111111111111";
    private static final String EXACT_LASER = "1585.800001234567890";
    private static final int PROJECTS = 3, PHOTOS = 30, DIMENSIONS = 20;
    private static final String NOTE_TEXT = "Poznámka: roh 1585,800001234567890 mm – ověřit.";

    private static JSONObject revision(String id, String kind, String parentId) throws Exception {
        return new JSONObject().put("id", id).put("kind", kind)
            .put("parentId", parentId)
            .put("syncClock", new JSONObject().put(DEVICE_ID, 1))
            .put("rev", "initial").put("updatedAt", "2026-11-21T12:00:00Z");
    }

    private static void touch(JSONObject record, int change) throws Exception {
        JSONObject clock = record.getJSONObject("syncClock");
        clock.put(DEVICE_ID, clock.getInt(DEVICE_ID) + 1);
        record.put("rev", "revision-" + change)
            .put("updatedAt", "2026-11-21T12:01:" +
                String.format(Locale.ROOT, "%02d", change % 60) + "Z");
    }

    private static int databaseHolds(File home) throws Exception {
        File directory = new File(home, "protected-revisions");
        File[] files = directory.listFiles();
        if (files == null) throw new IOException("Missing immutable revision directory");
        int count = 0;
        for (File f : files) {
            if (!f.getName().matches("[a-f0-9]{64}\\.json")) continue;
            if ("database".equals(new JSONObject(new String(Files.readAllBytes(f.toPath()), java.nio.charset.StandardCharsets.UTF_8))
                    .optString("kind"))) count++;
        }
        return count;
    }

    private static final class Scenario {
        final PeerTransferTest.Device device;
        final JSONObject database;
        final JSONObject[][] photos = new JSONObject[PROJECTS][PHOTOS];
        final JSONObject[][] notes = new JSONObject[PROJECTS][2];
        final Map<String, byte[]> originals = new LinkedHashMap<>();
        final File directory;
        String confirmed;

        Scenario() throws Exception {
            File root = Files.createTempDirectory(
                RuntimeEnvironment.getApplication().getCacheDir().toPath(),
                "zamerovac-multi-project-").toFile();
            device = new PeerTransferTest.Device(root, "phone");
            LocalDatabase.write(device, "{\"schema\":1,\"records\":[]}");
            directory = new File(device.home, "media");
            assertTrue(directory.mkdirs());
            JSONArray records = new JSONArray();
            for (int project = 0; project < PROJECTS; project++) {
                String folderId = "project-" + project;
                records.put(revision(folderId, "folder", ""));
                for (int photo = 0; photo < PHOTOS; photo++) {
                    String id = "photo-" + project + "-" + photo;
                    String media = "original-" + id;
                    original(media, "image/jpeg",
                        new byte[]{(byte) project, (byte) photo, 12, 34, 56});
                    JSONArray items = new JSONArray();
                    for (int dim = 0; dim < DIMENSIONS; dim++) {
                        items.put(new JSONObject().put("id", id + "-dimension-" + dim)
                            .put("type", "dimension")
                            .put("a", new JSONObject().put("x", dim + 0.125).put("y", 4.5))
                            .put("b", new JSONObject().put("x", dim + 101.25).put("y", 8.5))
                            .put("measure", EXACT_LASER)
                            .put("laserMeasuredMm", EXACT_LASER).put("unit", "mm"));
                    }
                    JSONObject image = revision(id, "photo", folderId)
                        .put("title", "Foto " + photo)
                        .put("media", new JSONArray().put(media))
                        .put("items", items);
                    photos[project][photo] = image;
                    records.put(image);
                }
                for (int index = 0; index < 2; index++) {
                    String id = "note-" + project + "-" + index;
                    String imageId = "note-picture-" + project + "-" + index;
                    String audioId = "note-audio-" + project + "-" + index;
                    original(imageId, "image/jpeg",
                        new byte[]{11, (byte) project, (byte) index, 4, 9});
                    original(audioId, "audio/mp4",
                        new byte[]{0, 0, 0, 24, 102, 116, 121, 112,
                            (byte) project, (byte) index});
                    JSONObject note = revision(id, "note", folderId)
                        .put("text", NOTE_TEXT)
                        .put("media", new JSONArray().put(imageId).put(audioId))
                        .put("checks", new JSONArray().put(
                            new JSONObject().put("text", "Zkontrolovat detail")
                                .put("done", false)));
                    notes[project][index] = note;
                    records.put(note);
                }
            }
            database = new JSONObject().put("schema", 1).put("records", records);
            commit();
            assertEquals(PROJECTS * PHOTOS * DIMENSIONS, countDimensions());
        }

        void original(String id, String mime, byte[] bytes) throws Exception {
            Files.write(new File(directory, id).toPath(), bytes);
            assertTrue(device.prefs.edit()
                .putString("mime-" + id, mime)
                .putString("name-" + id, id)
                .commit());
            originals.put(id, bytes.clone());
        }

        int countDimensions() throws Exception {
            int count = 0;
            for (JSONObject[] group : photos)
                for (JSONObject image : group)
                    count += image.getJSONArray("items").length();
            return count;
        }

        void commit() throws Exception {
            String next = database.toString();
            long started = System.nanoTime();
            LocalDatabase.write(device, next);
            long elapsedMs = (System.nanoTime() - started) / 1000000L;
            System.out.println("ISSUE221 multi-project save-ms=" + elapsedMs
                + " records=" + database.getJSONArray("records").length()
                + " bytes=" + next.length());
            assertEquals(next, LocalDatabase.readForCas(device));
            if (confirmed != null)
                assertEquals("Exact prior committed snapshot must remain in backup",
                    confirmed, LocalDatabase.readFile(
                        new File(device.home, "projects.bak")));
            confirmed = next;
            for (Map.Entry<String, byte[]> original : originals.entrySet())
                assertArrayEquals("Original media must survive unrelated edits: " +
                    original.getKey(), original.getValue(), Files.readAllBytes(
                        new File(directory, original.getKey()).toPath()));
        }

        void move(int project, int photo, int dimension, int change)
            throws Exception {
            JSONObject image = photos[project][photo];
            JSONObject item = image.getJSONArray("items").getJSONObject(dimension);
            item.getJSONObject("a").put("x", 10000 + change + 0.125);
            touch(image, change);
            commit();
        }
    }

    @Test public void manyProjectsPhotosNotesAndAudioMustNotGrowHoldHistoryOnEdits()
        throws Exception {
        Scenario s = new Scenario();
        int baseline = databaseHolds(s.device.home);
        s.move(0, 0, 0, 1);
        s.move(0, 29, 19, 2);
        s.move(1, 10, 8, 3);
        s.notes[2][0].put("text", NOTE_TEXT + " Doplněn text.");
        touch(s.notes[2][0], 4);
        s.commit();
        s.move(2, 25, 17, 5);
        s.move(0, 1, 3, 6);
        assertEquals("Ordinary edits in other projects or notes must not "
            + "append full-DB recovery copies or depend on global work history",
            baseline, databaseHolds(s.device.home));
        assertEquals(EXACT_LASER, s.photos[0][29]
            .getJSONArray("items").getJSONObject(19).getString("laserMeasuredMm"));
        assertEquals(PROJECTS * PHOTOS * DIMENSIONS, s.countDimensions());
        assertTrue(s.notes[2][0].getString("text").endsWith("Doplněn text."));
        assertTrue(new ProtectedRevisions(s.device, s.device.prefs)
            .pinsForCleanup().contains("note-audio-2-0"));
    }
}
