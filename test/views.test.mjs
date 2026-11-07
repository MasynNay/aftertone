import test from 'node:test';
import assert from 'node:assert/strict';
import { STARTER_TRACKS, GENRES } from '../app/src/catalog.mjs';
import { createInitialState, recordChoice } from '../app/src/taste.mjs';
import { createViews } from '../app/public/views.js';
import { html, urlSafe } from '../app/public/view-utils.js';

function pages(state = createInitialState(), current = STARTER_TRACKS[0]) {
  return createViews({ state, catalog: STARTER_TRACKS, current, allGenres: GENRES, challengeIds: [], challengeResponses: [], catalogWarning: '', catalogLive: false, collectionQuery: '', collectionSort: 'recent' });
}

test('mystery card never discloses artist, title or genre', () => {
  const track = STARTER_TRACKS[0];
  const markup = pages({ ...createInitialState(), blind: true }).renderDiscovery();
  assert.match(markup, /Who could it be\?/);
  assert.match(markup, /BLIND CHALLENGE/);
  assert.doesNotMatch(markup, new RegExp(track.artist, 'i'));
  assert.doesNotMatch(markup, new RegExp(track.title, 'i'));
  assert.match(markup, /data-action="like"/);
});

test('normal discovery exposes song identity and cover metadata by default', () => {
  const track = STARTER_TRACKS[0];
  const markup = pages().renderDiscovery();
  assert.match(markup, new RegExp(track.artist, 'i'));
  assert.match(markup, /NOW DISCOVERING/);
  assert.match(markup, /22-second listening preview/);
});

test('collection markup contains escaped real metadata and source genre', () => {
  const track = STARTER_TRACKS[0];
  const state = recordChoice(createInitialState(), { id: track.id, action: 'like', recognized: false });
  const markup = pages(state).renderCollection();
  assert.match(markup, new RegExp(track.title, 'i'));
  assert.match(markup, new RegExp(track.artist, 'i'));
  assert.match(markup, /data-action="export-json"/);
  assert.match(markup, /data-action="remove-favorite"/);
});

test('taste map has informative empty and populated states', () => {
  const before = pages().renderTaste();
  assert.match(before, /Your sound constellation is waiting/);
  const state = recordChoice(createInitialState(), { id: STARTER_TRACKS[0].id, action: 'like' });
  const after = pages(state).renderTaste();
  assert.match(after, /class="map-visual"/);
  assert.match(after, /Favorite frequencies/);
});

test('markup helpers escape hostile text and reject non-HTTPS links', () => {
  assert.equal(html(`<img onerror="alert('bad')">`), '&lt;img onerror=&quot;alert(&#39;bad&#39;)&quot;&gt;');
  assert.equal(urlSafe('javascript:alert(1)'), '#');
  assert.equal(urlSafe('http://example.com'), '#');
});
