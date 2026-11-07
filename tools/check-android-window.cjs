'use strict';
const assert=require('node:assert/strict');
const {assertInteractiveWindowDump:check}=require('./e2e/android-window.cjs');
const pkg='cz.zamerovac.app.preview';
const focus='mCurrentFocus=Window{461e1c1 u0 '+pkg+'/cz.zamerovac.app.MainActivity}';
check(focus,pkg);
// Shape observed in run 42356263427: `windows` lists the visible ANR but has
// no mCurrentFocus. The old negative-only focus check wrongly accepted it.
const anr='  Window #7 Window{7a7047f u0 Application Not Responding: com.android.systemui}:\n    mViewVisibility=0x0\n    mHasSurface=true isReadyForDisplay()=true\n    isVisible=true\n';
assert.throws(()=>check(anr,pkg),/ANR window/);
assert.throws(()=>check(focus+'\n'+anr,pkg),/ANR window/);
assert.throws(()=>check(anr.replace('com.android.systemui',pkg),pkg),/ANR window/);
assert.throws(()=>check('  Window #0 Window{461e1c1 u0 '+pkg+'/cz.zamerovac.app.MainActivity}:',pkg),/recognized current window focus/);
assert.throws(()=>check('mCurrentFocus=null',pkg),/recognized current window focus/);
assert.throws(()=>check('mCurrentFocus=Window{123 u0 com.android.documentsui/.DocumentsActivity}',pkg),/does not own/);
console.log('PASS Android window gate: native app focus required; OS/app ANR, missing focus and another activity rejected');
