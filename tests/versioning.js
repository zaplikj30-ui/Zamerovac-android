'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs');
const v=require('../tools/release/versioning.js');
const catalog=require('../app/src/main/assets/release-history.js');

// Check the version that is actually configured; do not pin the test to 1.4.0.
// Workflow/BUILD/RELEASE safety is tested by test_ci_cloud_release_gate.py
// and test_apk_gate.py. Do not require obsolete workflow shell snippets here.
const current=v.read();
assert.equal(v.check(),current);
assert.equal(catalog.releases[0].version,current);
assert.equal(v.cmp(current,catalog.releases[1].version),1);
assert.equal(v.cmp('1.4.0','1.3.0'),1);
assert.equal(v.cmp('1.3.0','1.2.153'),1);
assert.equal(v.cmp('1.3.1','1.3.0'),1);
assert.equal(v.cmp('2.0.0','1.99.99'),1);
assert.equal(v.cmp('1.3.0','1.3.0'),0);
for(const s of ['','1.3','1.3.0-test','1.03.0','0.1.-1','1.2.3.4','foo','1.3.0\nother=value','99999999999999999.0.0'])assert.throws(()=>v.parse(s));
assert.throws(()=>v.read('versionName=1.3.0\nversionName=1.4.0\n'));
assert.equal(v.read('versionName=1.2.153\n'),'1.2.153');
assert.equal(v.verify(current,catalog.releases),current);
assert.throws(()=>v.verify(catalog.releases[1].version,catalog.releases),'Old release must not be republished');
assert.throws(()=>v.verify('9999.0.0',catalog.releases),'Missing changelog entry must be rejected');
assert.throws(()=>v.verify(current,[{version:current,groups:[{}]},{version:current,groups:[{}]}]),'Duplicate release must be rejected');
assert.throws(()=>v.verify('1.2.152',[{version:'1.2.152',groups:[{}]},{version:'1.2.153',groups:[{}]}]));
const gradle=fs.readFileSync('app/build.gradle','utf8');
assert(gradle.includes('versionName marketingVersion'));
assert(gradle.includes('versionCode 1000 + workflowBuildNumber'));
assert(gradle.includes("applicationIdSuffix '.preview'")&&gradle.includes("keyAlias 'zamerovacdev'"));
console.log('PASS semantic versioning, changelog and Android preview version mapping');
