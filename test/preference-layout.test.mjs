import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createViews } from '../public/views.js';
import { STARTER_TRACKS, GENRES } from '../src/catalog.mjs';
import { createInitialState } from '../src/taste.mjs';

const page = (settings = {}) => createViews({
  state: { ...createInitialState(), ...settings },
  catalog: STARTER_TRACKS, current: STARTER_TRACKS[0], allGenres: GENRES,
  challengeIds: [], challengeResponses: [], catalogWarning: '', catalogLive: false,
  collectionQuery: '', collectionSort: 'recent', availableSources: ['mix','youtube','audius']
}).renderSidebarPreferences();

test('language and song search are accessible in compact sidebar controls', () => {
  const markup=page();
  assert.doesNotMatch(markup, /data-action="toggle-originals"/);
  assert.match(markup, /id="language-select"/);
  assert.match(markup, /id="music-search"/);
  assert.match(markup, /data-action="import-playlist"/);
});
test('language selection is controlled and no recording-type toggle exists', () => {
  const markup=page({language:'en-strict'});
  assert.doesNotMatch(markup,/toggle-originals/);
  assert.match(markup,/value="en-strict" selected/);
  assert.match(markup,/for="language-select"/);
});
test('preferences controls have two columns and mobile stack style', () => {
  const css = readFileSync(new URL('../public/styles.css', import.meta.url), 'utf8');
  assert.match(css,/\.sidebar-preferences/);
  assert.match(css,/body\.mobile-filters-open/);
});
