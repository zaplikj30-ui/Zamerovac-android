'use strict';
// Controlled sandbox smoke probe, not proof of Windows token/AppContainer isolation.
// Do not run product E2E or launch a browser without the pinned offline binary.
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const EXPECTED_SHA256 = 'ce4635cd0e5dc0e21494542a701f347e91c1f1d821970578d97ed8df4ced50ef';
const identity = {
  GITHUB_REPOSITORY: 'zaplikj30-ui/Zamerovac-android',
  GITHUB_ACTOR: 'zaplikj30-ui',
  GITHUB_TRIGGERING_ACTOR: 'zaplikj30-ui',
  GITHUB_RUN_ATTEMPT: '1',
  GITHUB_EVENT_NAME: 'push',
  RUNNER_NAME: 'Zamerovac-Win11-QA',
};
async function main() {
  assert.equal(process.platform, 'win32', 'BLOCKED: HOME Windows only');
  assert.equal((process.env.USERNAME || '').toLowerCase(), 'zamerovacqa',
    'BLOCKED: must run as service account ZamerovacQA');
  assert(process.env.GITHUB_REF?.startsWith('refs/heads/qa/'),
    'BLOCKED: expected an approved qa/* workflow');
  for (const [key, value] of Object.entries(identity)) {
    assert.equal(process.env[key], value, 'BLOCKED: owner-only ' + key);
  }
  const executablePath = process.env.CHROMIUM_PATH;
  assert(executablePath && path.isAbsolute(executablePath),
    'BLOCKED: explicit pinned CHROMIUM_PATH required');
  const hash = crypto.createHash('sha256').update(fs.readFileSync(executablePath)).digest('hex');
  assert.equal(hash, EXPECTED_SHA256, 'BLOCKED: Chromium binary SHA256 mismatch');
  // The reviewed HOME gate sets NODE_PATH to its isolated offline Playwright install.
  const playwright = require('playwright');
  assert.equal(require('playwright/package.json').version, '1.62.1',
    'BLOCKED: Playwright version mismatch');
  const {chromium} = playwright;
  let browser;
  try {
    browser = await chromium.launch({executablePath, chromiumSandbox:true, headless:true,
      args:['--no-first-run','--disable-background-networking']});
    const page = await browser.newPage();
    await page.goto('data:text/html,<title>QA sandbox smoke</title><p>synthetic</p>');
    assert.equal(await page.title(), 'QA sandbox smoke');
    console.log('PASS: pinned Chromium launched with chromiumSandbox=true; synthetic page OK');
    console.log('NOT VERIFIED: Windows renderer restricted token / OS-level sandbox isolation');
  } finally {
    if (browser) await browser.close();
  }
}
main().catch(err => { console.error('BLOCKED/FAIL: ' + err.message); process.exitCode=1; });
