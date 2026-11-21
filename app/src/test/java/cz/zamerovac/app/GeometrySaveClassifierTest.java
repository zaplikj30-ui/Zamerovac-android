package cz.zamerovac.app;

import org.json.JSONArray;
import org.json.JSONObject;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.robolectric.RobolectricTestRunner;
import org.robolectric.annotation.Config;
import static org.junit.Assert.*;

/**
 * #221 stage 1: classification-only contract. This test must NOT be used
 * as evidence of crash recovery, protected media, or actual fast saving.
 */
@RunWith(RobolectricTestRunner.class)
@Config(sdk = 35)
public class GeometrySaveClassifierTest {
    private static final String LOCAL = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    private static final String PEER = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
    private static final String DATE = "2026-11-21T10:00:00.000Z";

    private static JSONObject touched(JSONObject object, String rev) throws Exception {
        object.put("syncClock", new JSONObject().put(LOCAL, 2).put(PEER, 7));
        object.put("rev", rev);
        object.put("updatedAt", DATE);
        return object;
    }

    private static JSONObject fixture() throws Exception {
        JSONObject dimension = touched(new JSONObject()
            .put("id", "dimension-1").put("type", "dimension")
            .put("a", new JSONObject().put("x", 1.125).put("y", 2.5))
            .put("b", new JSONObject().put("x", 9.25).put("y", 3.5))
            .put("measure", "1585.800001234567890")
            .put("laserMeasuredMm", "1585.800001234567890")
            .put("unit", "mm"), "old-item");
        JSONObject photo = touched(new JSONObject()
            .put("id", "photo-1").put("kind", "photo")
            .put("media", new JSONArray().put("original-photo"))
            .put("items", new JSONArray().put(dimension)), "old-photo");
        JSONObject other = touched(new JSONObject()
            .put("id", "photo-2").put("kind", "photo")
            .put("media", new JSONArray().put("other-original"))
            .put("items", new JSONArray()), "other-photo");
        return new JSONObject().put("schema", 1)
            .put("prefs", new JSONObject().put("unit", "mm"))
            .put("records", new JSONArray().put(photo).put(other));
    }

    private static JSONObject photo(JSONObject db) throws Exception {
        return db.getJSONArray("records").getJSONObject(0);
    }

    private static JSONObject item(JSONObject db) throws Exception {
        return photo(db).getJSONArray("items").getJSONObject(0);
    }

    private static void touchOnce(JSONObject object, String newRev) throws Exception {
        JSONObject clock = object.getJSONObject("syncClock");
        clock.put(LOCAL, clock.getLong(LOCAL) + 1);
        object.put("rev", newRev);
        object.put("updatedAt", "2026-11-21T10:00:00.001Z");
    }

    private static JSONObject moved(JSONObject before) throws Exception {
        JSONObject after = new JSONObject(before.toString());
        item(after).getJSONObject("a").put("x", 17.125);
        touchOnce(item(after), "new-item");
        touchOnce(photo(after), "new-photo");
        return after;
    }

    private static void rejected(JSONObject before, JSONObject after) throws Exception {
        assertFalse(GeometrySaveClassifier.isDimensionEndpointMove(
            before.toString(), after.toString(), LOCAL));
    }

    @Test public void realEditorTouchMetadataAndOneEndpointAreAccepted() throws Exception {
        JSONObject before = fixture();
        JSONObject after = moved(before);
        String original = before.toString();
        String proposed = after.toString();
        assertTrue(GeometrySaveClassifier.isDimensionEndpointMove(original, proposed, LOCAL));
        assertEquals(original, before.toString());
        assertEquals(proposed, after.toString());
        // Classification returns true WITHOUT establishing any media protection:
        // production writes must not use this result as standalone authority.
    }

    @Test public void bothEndpointsCanMoveButNotOtherDimensionFields() throws Exception {
        JSONObject before = fixture(), after = moved(before);
        item(after).getJSONObject("b").put("y", 7.5);
        assertTrue(GeometrySaveClassifier.isDimensionEndpointMove(
            before.toString(), after.toString(), LOCAL));
        item(after).put("measure", "9999");
        rejected(before, after);
        item(after).put("measure", "1585.800001234567890");
        item(after).put("laserMeasuredMm", "9999");
        rejected(before, after);
        item(after).put("laserMeasuredMm", "1585.800001234567890");
        item(after).put("unit", "inch");
        rejected(before, after);
    }

    @Test public void rejectForeignClockRevTombstonesOrAmbiguousGesture() throws Exception {
        JSONObject before = fixture(), after = moved(before);
        item(after).getJSONObject("syncClock").put(PEER, 8);
        rejected(before, after);
        after = moved(before);
        photo(after).getJSONObject("syncClock").put(LOCAL, 4);
        rejected(before, after);
        after = moved(before);
        item(after).put("rev", "old-item");
        rejected(before, after);
        after = moved(before);
        item(after).put("rev", 1234);
        rejected(before, after);
        after = moved(before);
        item(after).put("updatedAt", "not-an-ISO-date");
        rejected(before, after);
        after = moved(before);
        after.put("syncTombstones", new JSONObject().put("photo-3",
            new JSONObject().put(LOCAL, 2)));
        rejected(before, after);
        after = new JSONObject(before.toString());
        rejected(before, after);
    }

    @Test public void rejectChangesToMediaIdsPhotosOtherItemsAndStructure() throws Exception {
        JSONObject before = fixture(), after = moved(before);
        photo(after).getJSONArray("media").put("new-media");
        rejected(before, after);
        after = moved(before);
        photo(after).put("id", "replaced-photo");
        rejected(before, after);
        after = moved(before);
        item(after).put("id", "replaced-dimension");
        rejected(before, after);
        after = moved(before);
        photo(after).getJSONArray("items").put(new JSONObject()
            .put("id", "added").put("type", "dimension"));
        rejected(before, after);
        after = moved(before);
        after.getJSONArray("records").getJSONObject(1).put("name", "Changed");
        rejected(before, after);
        after = moved(before);
        after.getJSONObject("prefs").put("unit", "inch");
        rejected(before, after);
        after = moved(before);
        item(after).put("unknownField", new JSONArray().put("mutated"));
        rejected(before, after);
    }

    @Test public void rejectMalformedOrUntrustedInputs() throws Exception {
        JSONObject before = fixture(), after = moved(before);
        assertFalse(GeometrySaveClassifier.isDimensionEndpointMove(
            before.toString(), after.toString(), "untrusted-device"));
        assertFalse(GeometrySaveClassifier.isDimensionEndpointMove(
            "{broken", after.toString(), LOCAL));
        assertFalse(GeometrySaveClassifier.isDimensionEndpointMove(
            before.toString(), "", LOCAL));
        after = moved(before);
        item(after).getJSONObject("a").put("x", "17.125");
        rejected(before, after);
        after = moved(before);
        item(after).getJSONObject("a").put("height", 1);
        rejected(before, after);
        after = moved(before);
        photo(after).put("hierarchyConflict",
            new JSONObject().put("parentId", "folder-7"));
        rejected(before, after);
    }

    @Test public void rejectDuplicateAndEscapedJsonKeysBeforeAnyObjectParsing() throws Exception {
        JSONObject before = fixture(), after = moved(before);
        String oldText = before.toString(), newText = after.toString();
        // Duplicate root key on either side: org.json must never silently
        // collapse it into the same effective value and authorize a fast save.
        assertFalse(GeometrySaveClassifier.isDimensionEndpointMove(
            "{\"schema\":1," + oldText.substring(1), newText, LOCAL));
        assertFalse(GeometrySaveClassifier.isDimensionEndpointMove(
            oldText, "{\"schema\":1," + newText.substring(1), LOCAL));

        // Duplicates hidden in nested records, arrays or escaped aliases.
        String doubleId = "\"id\":\"dimension-1\",\"id\":\"dimension-1\"";
        assertTrue(oldText.contains("\"id\":\"dimension-1\""));
        assertFalse(GeometrySaveClassifier.isDimensionEndpointMove(
            oldText.replace("\"id\":\"dimension-1\"", doubleId), newText, LOCAL));

        // Escaped key spelling must collide after JSON unescaping: "id"
        // and "\\u0069d" are the same semantic key.
        String escaped = "\"id\":\"dimension-1\",\"" + "\\\\" + "u0069d\":\"dimension-1\"";
        assertFalse(GeometrySaveClassifier.isDimensionEndpointMove(
            oldText, newText.replace("\"id\":\"dimension-1\"", escaped), LOCAL));
        // Repeated keys in a nested endpoint are not a valid point change.
        String repeatedX = "\"x\":17.125,\"x\":17.125";
        assertTrue(newText.contains("\"x\":17.125"));
        assertFalse(GeometrySaveClassifier.isDimensionEndpointMove(
            oldText, newText.replace("\"x\":17.125", repeatedX), LOCAL));
    }

    @Test public void repeatedMovesDoNotDependOnNumberOfPreviousGestures() throws Exception {
        JSONObject before = fixture();
        for (int i = 0; i < 150; i++) {
            JSONObject after = new JSONObject(before.toString());
            item(after).getJSONObject("a").put("x", 17.125 + i);
            touchOnce(item(after), "item-" + i);
            touchOnce(photo(after), "photo-" + i);
            assertTrue("gesture " + i, GeometrySaveClassifier.isDimensionEndpointMove(
                before.toString(), after.toString(), LOCAL));
            before = after;
        }
    }
}
