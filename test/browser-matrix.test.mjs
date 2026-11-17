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
