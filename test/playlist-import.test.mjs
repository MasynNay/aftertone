import test from 'node:test';
import assert from 'node:assert/strict';
import { parseCSV, parsePlaylist, buildSeedProfile, buildSeedLanes, trackIdentity } from '../app/src/playlist-import.mjs';
import { createInitialState, selectNext } from '../app/src/taste.mjs';
import { createViews } from '../app/public/views.js';
import { parseDeezerRelated, fetchRelatedArtists } from '../app/src/related-artists.mjs';

test('imports Spotify-style CSV with BOM, quoted commas and multiple artists', () => {
  const csv = '\uFEFFTrack URI,Track Name,Artist Name(s),Album Name\r\nspotify:track:x,"How Long","Charlie Puth",Voicenotes\r\nspotify:track:y,"Birds, Pt. 1","Imagine Dragons","Origins"\r\n';
  const result = parsePlaylist(csv);
  assert.equal(result.count, 2);
  assert.deepEqual(result.tracks.map(t=>t.artist), ['Charlie Puth', 'Imagine Dragons']);
  assert.equal(result.tracks[1].title, 'Birds, Pt. 1');
  assert.deepEqual(parseCSV('"a\nb",c\r\n')[0], ['a\nb','c']);
});

test('imports pasted artist-song lines, deduplicates and never invents titles', () => {
  const data = parsePlaylist('Paramore - Still Into You\nCharlie Puth — How Long\nparamore - Still Into You\nNot a song');
  assert.equal(data.count, 2);
  assert.equal(data.artistCount, 2);
  assert.deepEqual(data.tracks[1], {artist:'Charlie Puth', title:'How Long'});
});

test('allows common JSON playlist export shapes', () => {
  const one = parsePlaylist(JSON.stringify({tracks:{items:[{track:{name:'Shake It Off',artists:[{name:'Taylor Swift'}]}}]}}));
  assert.equal(one.tracks[0].artist,'Taylor Swift');
  assert.equal(one.tracks[0].title,'Shake It Off');
});

test('rejects pasted Spotify link rather than claiming to import it', () => {
  assert.throws(()=>parsePlaylist('https://open.spotify.com/playlist/abcd'), /cannot be read directly/i);
  assert.throws(()=>parsePlaylist('some invalid string'), /No artist\/title pairs/);
  assert.throws(()=>parsePlaylist('"unterminated,title\n'), /unclosed quoted field/i);
});

test('taste profile captures frequency, interleaves related artists, avoids duplicates', () => {
  const parsed = parsePlaylist('Muse - Starlight\nMuse - Uprising\nM83 - Midnight City\nMuse - Starlight');
  const profile = buildSeedProfile(parsed);
  assert.equal(profile.totalSongs, 3);
  assert.equal(profile.artists[0].artist,'Muse');
  assert.equal(profile.artists[0].count,2);
  assert.ok(profile.seenTracks.has(trackIdentity('muse','starlight')));
  const lanes=buildSeedLanes(profile,[{artist:'Muse',because:'Muse'},{artist:'Radiohead',because:'Muse'}]);
  assert.deepEqual(lanes.map(l=>l.artist),['Muse','Radiohead','M83']);
});

test('seeded next-track ranking prioritizes compatible artists without blocking all discovery', () => {
  const tracks = [
    {id:'youtube:aaaaaaaaaaa', title:'One',artist:'Muse',genre:'rock',mood:'Bold'},
    {id:'youtube:bbbbbbbbbbb', title:'Two',artist:'Other',genre:'rock',mood:'Bold'},
  ];
  assert.equal(selectNext(tracks, [], 'all',()=>0,{seedArtists:['Muse']}).artist,'Muse');
  assert.ok(selectNext(tracks,[], 'all',()=>0));
});

test('Deezer relation records exclude the seed and duplicate artists', () => {
  const records={data:[
    {id:5,name:'Radiohead',nb_fan:120000},{id:6,name:'Muse',nb_fan:140000},
    {id:7,name:'RADIOHEAD',nb_fan:10000},{id:8,name:'Coldplay',nb_fan:70000},
    {id:'invalid',name:'Something'}
  ]};
  assert.deepEqual(parseDeezerRelated(records,'Muse').map(r=>r.artist),['Radiohead','Coldplay']);
});

test('similar artists come from Deezer artist metadata, with strict seed matching', async () => {
  const calls=[];
  const fetcher=async url=>{
    const u=new URL(url);calls.push(u);
    if(u.pathname.endsWith('/search/artist')) return {ok:true,json:async()=>({data:[
      {id:1,name:'Mused Tribute'},{id:2,name:'Muse'}]})};
    return {ok:true,json:async()=>({data:[{id:19,name:'Radiohead',nb_fan:1000}]})};
  };
  const data=await fetchRelatedArtists('Muse',fetcher);
  assert.equal(data.related[0].artist,'Radiohead');
  assert.equal(data.matched,true);
  assert.equal(calls.length,2);
  assert.ok(calls.every(u=>u.host==='api.deezer.com'));
  assert.match(calls[1].pathname,/artist\/2\/related/);
});

test('UI presents fresh discovery first, import optional and an explicit exit', () => {
  const common = {state:createInitialState(),catalog:[],current:null,allGenres:['all'],challengeIds:[],challengeResponses:[],catalogWarning:'',catalogLive:true,collectionQuery:'',collectionSort:'recent'};
  const fresh = createViews({...common,seedInfo:{active:false,ready:false,count:0,artists:0,related:0}}).renderDiscovery();
  assert.match(fresh,/Listen\. Swipe\. Save/);
  const freshSidebar=createViews({...common,seedInfo:{active:false,ready:false,count:0,artists:0,related:0}}).renderSidebarPreferences();
  assert.match(freshSidebar,/data-action="import-playlist"/);
  const seeded = createViews({...common,seedInfo:{active:true,ready:true,count:30,artists:12,related:3}}).renderDiscovery();
  assert.match(seeded,/Your 30 imported songs/);
  assert.match(seeded,/data-action="fresh-discovery"/);
});

test('YouTube playlist seed rejects channels impersonating the requested artist', async () => {
  const { fetchYouTubePage } = await import('../app/src/youtube.mjs');
  const key = 'A'.repeat(39);
  const fake = {id:{videoId:'A1234567890'},snippet:{title:'Muse - Starlight (Official Music Video)',channelTitle:'Random Cover Channel',thumbnails:{high:{url:'https://i.ytimg.com/vi/A1234567890/hqdefault.jpg'}}}};
  const official = {id:{videoId:'B1234567890'},snippet:{title:'Muse - Uprising (Official Video)',channelTitle:'MuseVEVO',thumbnails:{high:{url:'https://i.ytimg.com/vi/B1234567890/hqdefault.jpg'}}}};
  const mock = async url => {
    const path = new URL(url).pathname;
    if (path.endsWith('/search')) return {ok:true,json:async()=>({items:[fake,official]})};
    return {ok:true,json:async()=>({items:[]})};
  };
  const result = await fetchYouTubePage('all','',mock,key,'Muse',true,'all','any','hits','Muse');
  assert.equal(result.tracks.length,1);
  assert.equal(result.tracks[0].artist,'Muse');
  assert.equal(result.tracks[0].id,'youtube:B1234567890');
});

test('fresh discovery is the hard-coded startup choice, even if a saved playlist exists', async () => {
  const {readFile} = await import('node:fs/promises');
  const main = await readFile(new URL('../app/public/main.js', import.meta.url),'utf8');
  assert.match(main,/let seedActive = false/);
  assert.match(main,/let importedPlaylist = readPlaylist\(\)/);
  assert.match(main,/case 'fresh-discovery': return startFreshDiscovery\(\)/);
  assert.match(main,/if \(lane\) query\.set\('seed_artist', lane\.artist\)/);
});
