package cz.zamerovac.app;

import org.json.JSONArray;
import org.json.JSONObject;
import java.util.Arrays;
import java.util.HashSet;
import java.util.Iterator;
import java.util.Set;

/**
 * Read-only experiment for #221. Not wired to persistence or JS bridge.
 * Returning true is NOT proof that protected media/sync evidence exists.
 * A later fast-save design needs an independent durable protection gate.
 */
final class GeometrySaveClassifier {
    private GeometrySaveClassifier() {}

    /**
     * Recognize exactly one endpoint move of one existing dimension in one
     * photo, accompanied solely by the editor's item + photo touch metadata.
     * Everything unknown or ambiguous is deliberately rejected.
     * trustedDevice must come from native identity, never a JS suggestion.
     */
    static boolean isDimensionEndpointMove(String before, String after, String trustedDevice) {
        try {
            if (!DeviceIdentity.valid(trustedDevice)) return false;
            LocalDatabase.validate(before);
            LocalDatabase.validate(after);
            JSONObject oldDb = new JSONObject(before);
            JSONObject newDb = new JSONObject(after);
            if (!sameExcept(oldDb, newDb, "records")) return false;
            JSONArray oldRecords = oldDb.getJSONArray("records");
            JSONArray newRecords = newDb.getJSONArray("records");
            if (oldRecords.length() != newRecords.length()) return false;
            int changedPhotos = 0;
            for (int i = 0; i < oldRecords.length(); i++) {
                JSONObject previous = oldRecords.getJSONObject(i);
                JSONObject next = newRecords.getJSONObject(i);
                if (identical(previous, next)) continue;
                if (++changedPhotos != 1
                        || !"photo".equals(previous.optString("kind"))
                        || !"photo".equals(next.optString("kind"))
                        || !sameExcept(previous, next, "items", "syncClock", "rev", "updatedAt")
                        || !validTouch(previous, next, trustedDevice)) return false;
                JSONArray previousItems = previous.getJSONArray("items");
                JSONArray nextItems = next.getJSONArray("items");
                if (previousItems.length() != nextItems.length()) return false;
                int changedDimensions = 0;
                for (int j = 0; j < previousItems.length(); j++) {
                    JSONObject oldItem = previousItems.getJSONObject(j);
                    JSONObject newItem = nextItems.getJSONObject(j);
                    if (identical(oldItem, newItem)) continue;
                    if (++changedDimensions != 1
                            || !"dimension".equals(oldItem.optString("type"))
                            || !"dimension".equals(newItem.optString("type"))
                            || !sameExcept(oldItem, newItem, "a", "b", "syncClock", "rev", "updatedAt")
                            || !validTouch(oldItem, newItem, trustedDevice)) return false;
                    JSONObject oldA = oldItem.getJSONObject("a");
                    JSONObject oldB = oldItem.getJSONObject("b");
                    JSONObject newA = newItem.getJSONObject("a");
                    JSONObject newB = newItem.getJSONObject("b");
                    if (!point(oldA) || !point(oldB) || !point(newA) || !point(newB)
                            || !sameExcept(oldA, newA, "x", "y")
                            || !sameExcept(oldB, newB, "x", "y")
                            || identical(oldA, newA) && identical(oldB, newB)) return false;
                }
                if (changedDimensions != 1) return false;
            }
            return changedPhotos == 1;
        } catch (Exception invalidOrUncertain) {
            // Classification must never authorize a write or swallow a save error.
            return false;
        }
    }

    private static boolean validTouch(JSONObject oldValue, JSONObject newValue,
                                      String device) throws Exception {
        // Real editor touch() advances only this installation's clock and
        // changes rev/updatedAt. Foreign clock entries must be unchanged.
        if (!newValue.has("syncClock")
                || !CausalClock.canonical(CausalClock.advance(
                        CausalClock.clock(oldValue), device))
                    .equals(CausalClock.canonical(CausalClock.clock(newValue)))) return false;
        if (oldValue.has("rev") && !(oldValue.opt("rev") instanceof String)) return false;
        String rev = newValue.getString("rev");
        if (rev.isEmpty() || rev.length() > 128
                || rev.equals(oldValue.optString("rev", ""))) return false;
        if (oldValue.has("updatedAt")
                && !(oldValue.opt("updatedAt") instanceof String)) return false;
        Object timestamp = newValue.get("updatedAt");
        // UTC millis, as emitted by new Date().toISOString(). An unchanged
        // millisecond is possible on very fast repeated edits.
        return timestamp instanceof String && ((String) timestamp)
                .matches("[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}\\.[0-9]{3}Z");
    }

    private static boolean point(JSONObject point) throws Exception {
        Object x = point.get("x"), y = point.get("y");
        return x instanceof Number && y instanceof Number
                && Double.isFinite(((Number) x).doubleValue())
                && Double.isFinite(((Number) y).doubleValue());
    }

    private static boolean sameExcept(JSONObject previous, JSONObject next,
                                      String... exceptions) throws Exception {
        Set<String> ignored = new HashSet<>(Arrays.asList(exceptions));
        for (Iterator<String> it = previous.keys(); it.hasNext();) {
            String key = it.next();
            if (!ignored.contains(key) && (!next.has(key)
                    || !identical(previous.get(key), next.get(key)))) return false;
        }
        for (Iterator<String> it = next.keys(); it.hasNext();) {
            String key = it.next();
            if (!ignored.contains(key) && !previous.has(key)) return false;
        }
        return true;
    }

    /** Compare all unknown data without coercing strings into numbers. */
    private static boolean identical(Object first, Object second) throws Exception {
        if (first == JSONObject.NULL || second == JSONObject.NULL)
            return first == second;
        if (first == null || second == null) return first == second;
        if (first instanceof JSONObject && second instanceof JSONObject)
            return sameExcept((JSONObject) first, (JSONObject) second);
        if (first instanceof JSONArray && second instanceof JSONArray) {
            JSONArray a = (JSONArray) first, b = (JSONArray) second;
            if (a.length() != b.length()) return false;
            for (int i = 0; i < a.length(); i++)
                if (!identical(a.get(i), b.get(i))) return false;
            return true;
        }
        if (!first.getClass().equals(second.getClass())) return false;
        return first instanceof Number
                ? first.toString().equals(second.toString())
                : first.equals(second);
    }
}
