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
  assert.match(browser,/page\.keyboard\.press\("Enter"\)/);
  assert.match(browser,/window\.__aftertoneRecoveryProbe/);
  assert.match(browser,/saved_after == saved_before/);
  assert.match(browser,/retry\.focus\(\)/);
  assert.match(browser,/document\.activeElement\?\.dataset\?\.action === 'load-more'/);
  assert.match(browser,/document\.activeElement\?\.id === 'stage-play'/);
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

test('real reduced-motion smoke checks scripted search scrolling, not just CSS',()=>{
  assert.match(browser,/__aftertoneScrollLog/);
  assert.match(browser,/scrollIntoView=function\(options\)/);
  assert.match(browser,/item\["id"\]=="music-search" and item\["behavior"\]=="auto"/);
});

test('both browser engines test Pass, Undo and Keep keyboard focus restoration',()=>{
  assert.match(browser,/def check_choice_keyboard_focus\(browser, base\):/);
  assert.match(browser,/document.activeElement\?\.dataset\?\.action === 'pass'/);
  assert.match(browser,/document.activeElement\?\.id === 'main-content'/);
  assert.match(browser,/document.activeElement\?\.dataset\?\.action === 'like'/);
  assert.match(browser,/history\.length === 0/);
  assert.equal(browser.split('check_choice_keyboard_focus(browser, base)').length-1,3,
    'One definition and one run per browser');
});

test('real browsers distinguish Deezer preview quota errors from ordinary CDN failures',()=>{
  assert.match(browser,/def check_deezer_preview_quota_recovery\(browser, base\):/);
  assert.match(browser,/state=\{"limited":True,"metadata":0\}/);
  assert.match(browser,/temporarily limiting requests/);
  assert.match(browser,/state\["limited"\]=False/);
  assert.match(browser,/An older rate limit warning persisted/);
  assert.match(browser,/Quota\/retry silently added a favorite or listening vote/);
  assert.equal(browser.split('check_deezer_preview_quota_recovery(browser, base)').length-1,3,
    'Define once, run in Chromium and Firefox');
});

test('Deezer metadata is fetched only after Play in both browser engines',()=>{
  assert.match(browser,/def check_deezer_preview_on_demand\(browser, base\):/);
  assert.match(browser,/counts\["preview"\]==0/);
  assert.match(browser,/for section in \("collection","duels","discover"\):/);
  assert.match(browser,/counts\["preview"\]>=1/);
  assert.match(browser,/saved_after==saved_before/);
  assert.equal(browser.split('check_deezer_preview_on_demand(browser, base)').length-1,3,
    'One definition plus Chromium and Firefox calls are required');
});

test('portable progress really transfers into an isolated new browser profile',()=>{
  assert.match(browser,/def check_backup_transfer_new_profile\(browser, base\):/);
  assert.match(browser,/source\.close\(\)/);
  assert.match(browser,/target=browser\.new_context/);
  assert.match(browser,/exported_bytes=Path\(download\.path\(\)\)\.read_bytes\(\)/);
  assert.match(browser,/document\.querySelector\('#main-nav button\[data-view="collection"\]'\)/);
  assert.match(browser,/Isolated destination lost history, savedTracks or favorites after reload/);
  assert.equal(browser.split('check_backup_transfer_new_profile(browser, base)').length-1,3,
    'One definition and a separate Chromium/Firefox test run required');
});

test('cross-browser restore tests cover persistent errors, cancel protection and focus return',()=>{
  assert.match(browser,/Invalid restore left keyboard focus on a hidden file input/);
  assert.match(browser,/Canceling restore unexpectedly modified saved progress/);
  assert.match(browser,/Canceled restore did not return focus to the restore button/);
  assert.match(browser,/Restore canceled\. Your existing progress was not changed/);
});

test('both browser engines reject shortcut modifiers and held keys without losing plain shortcuts',()=>{
  assert.match(browser,/def check_safe_music_shortcuts\(browser, base\):/);
  assert.match(browser,/Modified\/repeated shortcuts changed listening history or blind mode/);
  assert.match(browser,/Holding an arrow rated a second song without another deliberate press/);
  assert.match(browser,/A held\/modified Space shortcut unexpectedly requested preview playback/);
  assert.match(browser,/page\.keyboard\.press\("ArrowLeft"\)/);
  assert.equal(browser.split('check_safe_music_shortcuts(browser, base)').length-1,3,
    'One definition and one invocation for Chromium and Firefox required');
});

test('unsubmitted music searches and their caret survive DOM replacement in both engines',()=>{
  assert.match(browser,/def check_search_draft_survives_rerenders\(browser, base\):/);
  assert.match(browser,/An app rerender erased an unsubmitted artist search/);
  assert.match(browser,/Rerender lost focused search's caret\/selection/);
  assert.match(browser,/Switching away and back erased an unsubmitted search/);
  assert.match(browser,/The unsubmitted draft unexpectedly changed the active discovery query/);
  assert.equal(browser.split('check_search_draft_survives_rerenders(browser, base)').length-1,3,
    'One definition and one invocation each for Chromium and Firefox');
});

test('Collection empty search recovery and sort focus are verified in Chromium and Firefox',()=>{
  assert.match(browser,/def check_collection_search_recovery\(browser, base\):/);
  assert.match(browser,/Showing 0 of 1 saved song/);
  assert.match(browser,/get_by_role\("button",name="Show All Saved Songs",exact=True\)/);
  assert.match(browser,/Changing Collection sort stranded keyboard focus/);
  assert.match(browser,/Collection search changed the user's saved favorites/);
  assert.equal(browser.split('check_collection_search_recovery(browser, base)').length-1,3,
    'Collection recovery requires one check in each browser engine');
});

test('Collection removal Undo is verified in both real browsers and survives reload',()=>{
  assert.match(browser,/def check_collection_undo_remove\(browser, base\):/);
  assert.match(browser,/Removing a focused song stranded keyboard users/);
  assert.match(browser,/Removing a favorite did not present lasting/);
  assert.match(browser,/Remove deleted listening choices or metadata needed for an undo/);
  assert.match(browser,/Restored favorite was lost after a browser reload/);
  assert.match(browser,/Undo changed listening decisions or restored an incomplete favorite/);
  assert.equal(browser.split('check_collection_undo_remove(browser, base)').length-1,3,
    'Both Chromium and Firefox must run Collection Undo regression');
});

test('real browsers cancel obsolete artist JSONP when queries or paths switch',()=>{
  assert.match(browser,/def check_cancel_stale_discovery\(browser, base\):/);
  assert.match(browser,/The first artist query did not remain pending/);
  assert.match(browser,/Obsolete provider callback remained active after a new search/);
  assert.match(browser,/Obsolete JSONP script remained in the document after cancellation/);
  assert.match(browser,/A stale artist request replaced the listener's newer search/);
  assert.match(browser,/Old provider callback leaked after the subsequent path switch/);
  assert.match(browser,/An obsolete search created listening votes or favorites/);
  assert.equal(browser.split('check_cancel_stale_discovery(browser, base)').length-1,3,
    'Stale provider cancellation must be checked in Chromium and Firefox');
});

test('both browser engines reject ranked-search retry storms during artist lookup outages',()=>{
  assert.match(browser,/def check_artist_outage_without_fallback\(browser, base\):/);
  assert.match(browser,/Catalog fixture temporarily unavailable/);
  assert.match(browser,/state\["failed_lookup"\]==1 and state\["ranked_fallback"\]==0/);
  assert.match(browser,/Artist lookup outage incorrectly launched a second ranked search/);
  assert.match(browser,/Retry after provider recovery did not present fixture songs/);
  assert.match(browser,/Artist outage\/recovery modified favorites or listening votes/);
  assert.equal(browser.split('check_artist_outage_without_fallback(browser, base)').length-1,3,
    'Outage/recovery must run once in Chromium, once in Firefox');
});


test('CI caches only the exact pinned Linux browser engines without removing dependency installation',()=>{
  assert.match(workflow,/uses: actions\/cache@v4/);
  assert.match(workflow,/path: ~\/\.cache\/ms-playwright/);
  assert.match(workflow,/key: playwright-\$\{\{ runner\.os \}\}-\$\{\{ runner\.arch \}\}-ubuntu24\.04-1\.56\.0/);
  assert.match(workflow,/python -m pip install --disable-pip-version-check playwright==1\.56\.0/);
  assert.match(workflow,/python -m playwright install --with-deps chromium firefox/);
  assert.ok(workflow.indexOf('Cache pinned Playwright browser binaries') <
    workflow.indexOf('Install Playwright, Chromium and Firefox'),
    'Browser cache restoration must happen before downloading the pinned browsers');
  assert.match(workflow,/runs-on: ubuntu-24\.04/);
  assert.match(workflow,/if: github\.event_name != 'pull_request'/,
    'Pages uploads and production deployment must stay gated separately');
});
