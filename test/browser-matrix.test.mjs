import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const workflow=readFileSync(new URL('../.github/workflows/pages.yml',import.meta.url),'utf8');
const browser=readFileSync(new URL('../scripts/browser-smoke.py',import.meta.url),'utf8');

test('Pages deployment is gated by both Chromium and Firefox browser smoke checks',()=>{
  assert.match(workflow,/playwright install --with-deps chromium firefox/);
  assert.match(workflow,/run: python scripts\/browser-smoke\.py\n/);
  assert.match(workflow,/run: python scripts\/browser-smoke\.py --firefox\n/);
  assert.match(browser,/def firefox_case\(browser, base, width, height\):/);
  assert.match(browser,/firefox_case\(browser, base, 1440, 900\)/);
  assert.match(browser,/firefox_case\(browser, base, 390, 844\)/);
  assert.match(browser,/firefox_case\(browser, base, 320, 740\)/);
  assert.match(browser,/def firefox_main\(\):/);
  assert.match(browser,/if "--firefox" in sys\.argv:/);
});

test('Firefox smoke protects keyboard and navigation behavior without contacting real music providers',()=>{
  const firefox=browser.slice(browser.indexOf('def firefox_case('),browser.indexOf('def firefox_main('));
  assert.match(firefox,/context\.route\("https:\/\/api\.deezer\.com\/\*\*", mock_deezer\)/);
  assert.match(firefox,/page\.keyboard\.press\("Shift\+Tab"\)/);
  assert.match(firefox,/page\.keyboard\.press\("Space"\)/);
  assert.match(firefox,/for mode, name in/);
  assert.match(firefox,/aria-current/);
  assert.match(firefox,/scrollWidth/);
  assert.match(firefox,/pageerror/);
});

test('successful PR runs retain browser-generated app screenshots including an active bracket',()=>{
  assert.match(workflow,/Upload verified product screenshots for PR review/);
  assert.match(workflow,/if: success\(\) && github\.event_name == 'pull_request'/);
  assert.match(workflow,/name: aftertone-ui-evidence/);
  assert.match(workflow,/if-no-files-found: error/);
  assert.match(workflow,/retention-days: 7/);
  for (const name of ['portfolio','discover','duels','music-duels-bracket','music-duels-complete']) {
    assert.ok(workflow.includes(`browser-smoke-artifacts/${name}-1440x900.png`),
      `CI evidence is missing ${name}`);
  }
  const bracket=browser.indexOf('screenshot(page, f"music-duels-bracket-{label}")');
  const created=browser.indexOf("page.locator('[data-duel-action=\"create\"]').click()");
  const voted=browser.indexOf("page.locator('#duel-active-event [data-duel-vote]').first.click()");
  assert.ok(created < bracket && bracket < voted,'Brackets must be captured after creation, before any votes');
});

test('Deezer outages recover from an API error without a page reload or false votes in both browsers',()=>{
  assert.match(browser,/def check_catalog_outage_recovery\(browser, base\):/);
  assert.match(browser,/Temporary provider outage \(fictional fixture\)/);
  assert.match(browser,/state\["online"\] = True/);
  assert.match(browser,/retry\.click\(\)/);
  assert.match(browser,/window\.__aftertoneRecoveryProbe/);
  assert.match(browser,/saved_after == saved_before/);
  const uses=[...browser.matchAll(/check_catalog_outage_recovery\(browser, base\)/g)];
  assert.equal(uses.length,3,'The outage test must run once in each browser plus its definition');
});

test('real backup and restore are exercised in Chromium and Firefox',()=>{
  assert.match(browser,/def check_backup_restore_cross_browser\(browser, base\):/);
  assert.match(browser,/accept_downloads=True/);
  assert.match(browser,/page\.expect_download\(timeout=TIMEOUT\)/);
  assert.match(browser,/malformed\["version"\]=999/);
  assert.match(browser,/after_invalid==before/);
  assert.match(browser,/page\.once\("dialog", lambda dialog: dialog\.accept\(\)\)/);
  assert.match(browser,/page\.locator\("#progress-backup-file"\)\.set_input_files/);
  assert.match(browser,/Restored favorite is missing from the visible Collection/);
  const calls=[...browser.matchAll(/check_backup_restore_cross_browser\(browser, base\)/g)];
  assert.equal(calls.length,3,'One definition and one call in each real browser');
});

test('reduced-motion reflow audits all routes in both real browsers at zoom-equivalent widths',()=>{
  assert.match(browser,/def check_reflow_reduced_motion\(browser, base, width, height\):/);
  assert.match(browser,/reduced_motion="reduce"/);
  assert.match(browser,/prefers-reduced-motion: reduce/);
  assert.match(browser,/Listening card animations still run/);
  assert.match(browser,/Horizontal document overflow in/);
  assert.match(browser,/Navigation\/control clipped at/);
  assert.equal(browser.split('check_reflow_reduced_motion(browser, base, 720, 900)').length-1,2);
  assert.equal(browser.split('check_reflow_reduced_motion(browser, base, 360, 740)').length-1,2);
});

test('failed preview retry and neutral skip restore keyboard focus and never record a vote',()=>{
  assert.match(browser,/def check_preview_recovery_keyboard\(browser, base\):/);
  assert.match(browser,/requests\["preview"\]>first_requests/);
  assert.match(browser,/get_by_role\("button",name="Retry Preview",exact=True\)/);
  assert.match(browser,/get_by_role\("button",name="Skip Without Voting",exact=True\)/);
  assert.match(browser,/document.activeElement\?\.id === 'stage-play'/);
  assert.match(browser,/after==initial/);
  const runs=[...browser.matchAll(/check_preview_recovery_keyboard\(browser, base\)/g)];
  assert.equal(runs.length,3,'One definition plus Chromium and Firefox runs required');
});
