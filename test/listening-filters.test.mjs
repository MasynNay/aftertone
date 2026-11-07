import test from 'node:test';
import assert from 'node:assert/strict';
import { likelyMusicRecording, trackLanguage, matchesLanguage, candidateOriginalFromUpload } from '../src/recording-quality.mjs';
import { normalizeAudiusTrack, fetchAudiusPage } from '../src/audius.mjs';
import { fetchJamendoPage } from '../src/jamendo.mjs';
import { sanitizeState } from '../src/persistence.mjs';
import { createInitialState } from '../src/taste.mjs';
import { createViews } from '../public/views.js';
import { createServer } from '../server.mjs';

const real = { id:'aS4_1111', title:'Little Lights', user:{name:'My Real Artist'}, duration:194, genre:'Pop', tags:'lang:en, pop', is_streamable:true, is_available:true };

test('filters podcasts, sound effects, type beats and excessively short samples but accepts original music', () => {
  for (const title of ['Podcast Episode 17', 'My speech recording', 'Free Type Beat 2026', 'A phone call', 'ASMR Rain Sounds', 'Sound effect pack', 'Weekly interview', 'Tutorial Piano Guitar']) {
    assert.equal(likelyMusicRecording({title, duration:145}), false, title);
  }
  assert.equal(likelyMusicRecording({title:'Riversong',duration:22}), false);
  assert.equal(likelyMusicRecording({title:'Little Lights',duration:194,tags:'Pop'}), true);
  assert.equal(normalizeAudiusTrack({ ...real, title:'Podcast Episode 17' }), null);
  assert.equal(normalizeAudiusTrack(real).title, 'Little Lights');
});

test('language controls explicitly marked languages and retains honest uncertainty for untagged music', () => {
  assert.equal(trackLanguage({ language:'en-US' }), 'en');
  assert.equal(trackLanguage({tags:'pop, lang:fr'}), 'fr');
  assert.equal(trackLanguage({title:'山川の音楽'}), 'other');
  assert.equal(trackLanguage({title:'New Day'}), 'unknown');
  assert.equal(matchesLanguage({language:'fr'}, 'en'), true); // Preferred is not English-only.
  assert.equal(matchesLanguage({language:'unknown'}, 'en'), true);
  assert.equal(matchesLanguage({language:'unknown'}, 'en-strict'), false);
  assert.equal(matchesLanguage({language:'en'}, 'en-strict'), true);
  assert.equal(matchesLanguage({language:'fr'}, 'all'), true);
});

test('legitimate independent original remains in originals mode and mismatched cover metadata is rejected', async () => {
  assert.equal(candidateOriginalFromUpload({title:'Little Lights',uploader:'My Real Artist'}), true);
  assert.equal(normalizeAudiusTrack(real, 'pop', true)?.originalCandidate, true);
  assert.equal(normalizeAudiusTrack({...real,title:'Taylor Swift - Anti-Hero',user:{name:'Cover Singer'}},'pop',true),null);
  assert.equal(normalizeAudiusTrack({...real,title:'My Track (Karaoke)'},'pop',true),null);
  const fetcher=async ()=>({ok:true,json:async()=>({data:[real,{...real,id:'aS4_1112',title:'A Live Interview'}, {...real,id:'aS4_1113',tags:'lang:fr'}]})});
  const res=await fetchAudiusPage('pop','0:0',fetcher,'','',true);
  assert.equal(res.tracks.length,2); // en, fr: client or server can apply selected language
});

test('Jamendo requests English-language lyrics and labels results based on that provider filter', async () => {
  let url;
  const fetcher = async (input) => {
    url = new URL(input);
    return {ok:true,json:async()=>({headers:{status:'success'},results:[{id:123,name:'My Favorite Song',artist_name:'Artist',duration:185,audio:'https://mp3d.jamendo.com/abc.mp3'}]})};
  };
  const result=await fetchJamendoPage('client','pop','0',fetcher,'',true,'en-strict');
  assert.equal(url.searchParams.get('lang'),'en');
  assert.equal(result.tracks[0].language,'en');
});

test('language preference survives local save migration and appears in discovery view', () => {
  const initial=createInitialState();
  assert.equal(initial.language,'all');
  assert.equal(sanitizeState({...initial,language:'en-strict'}).language,'en-strict');
  assert.equal(sanitizeState({...initial,language:'all'}).language,'all');
  const source=normalizeAudiusTrack(real);
  const markup=createViews({state:{...initial,source:'audius'},catalog:[source],current:source,allGenres:['all','pop'],challengeIds:[],challengeResponses:[],catalogWarning:'',catalogLive:true,collectionQuery:'',collectionSort:'recent',availableSources:['mix','audius']}).renderDiscovery();
  const sidebar=createViews({state:initial,catalog:[source],current:source,allGenres:['all','pop'],challengeIds:[],challengeResponses:[],feed:{}}).renderSidebarPreferences();
  assert.match(sidebar,/English preferred/);
  assert.match(sidebar,/English-focused artists/);
  assert.match(markup,/stop-session/);
});

test('server independently honors strict language and no covers in live discovery', async () => {
  const fetcher=async()=>({ok:true,json:async()=>({data:[real,{...real,id:'aS4_1114',tags:'lang:fr'},{...real,id:'aS4_1115',title:'Cover of Lights (Cover)',tags:'lang:en'}]})});
  const server=createServer({fetcher});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  try {
    const url=`http://127.0.0.1:${server.address().port}/api/discover?genre=pop&source=audius&language=en-strict&q=Little%20Lights`;
    const res=await fetch(url);
    assert.equal(res.status,200);
    const data=await res.json();
    assert.deepEqual(data.tracks.map(t=>t.title),['Little Lights','Cover of Lights (Cover)']);
  } finally {await new Promise(resolve=>server.close(resolve));}
});
