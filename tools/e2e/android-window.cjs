'use strict';
const assert=require('node:assert/strict');

// Use the complete `dumpsys window`: its `windows` subsection alone omits
// mCurrentFocus on Android 13. Missing focus is not proof of an interactive app.
function assertInteractiveWindowDump(dump,pkg){
 assert(!/Window\s+#\d+\s+Window\{[^\n]*Application Not Responding/i.test(dump),
  'NOT VERIFIED: Android retains a native ANR window; device input may be blocked');
 const focus=dump.match(/mCurrentFocus=Window\{([^\n]+)\}/);
 assert(focus,'NOT VERIFIED: Android did not expose a recognized current window focus');
 assert(focus[1].includes(pkg+'/'),
  'NOT VERIFIED: the preview activity does not own native window focus');
}
module.exports={assertInteractiveWindowDump};
