import test from 'node:test';
import assert from 'node:assert/strict';
import {smartPlaylists} from '../app/src/smart-playlists.mjs';
import {createViews} from '../app/public/views.js';
import {createInitialState} from '../app/src/taste.mjs';
const catalog=[
  {id:'deezer:1',title:'One',artist:'A',genre:'Rock',mood:'Fresh'},
  {id:'deezer:2',title:'Two',artist:'B',genre:' rock ',mood:'Dreamy'},
  {id:'deezer:3',title:'Three',artist:'C',genre:'unknown',mood:'unknown'},
  {id:'deezer:4',title:'Unsaved',artist:'D',genre:'Rock'}
];
const ids=['deezer:1','deezer:2','deezer:3','deezer:missing'];
const history=[{id:'deezer:1',recognized:false,mood:'Dreamy'},{id:'deezer:2',recognized:true},{id:'deezer:3',recognized:'false'}];
test('dynamic mixes use only saved identities, meaningful metadata and actual recognition booleans',()=>{
  const mixes=smartPlaylists(ids,catalog,history);
  const map=new Map(mixes.map(p=>[p.id,p.trackIds]));
  assert.deepEqual(map.get('recent'),['deezer:3','deezer:2','deezer:1']);
  assert.deepEqual(map.get('genre:rock'),['deezer:2','deezer:1']);
  assert.deepEqual(map.get('mood:dreamy'),['deezer:2','deezer:1']);
  assert.deepEqual(map.get('new-to-you'),['deezer:1']);
  assert.deepEqual(map.get('recognized'),['deezer:2']);
  assert.ok(!map.has('genre:unknown'));assert.ok(!map.has('mood:fresh'));
});
test('mixes recalculate after removal and do not modify input',()=>{
  const before=JSON.stringify([ids,catalog,history]);
  assert.deepEqual(smartPlaylists([],catalog,history),[]);
  assert.deepEqual(smartPlaylists(['deezer:2'],catalog,history).find(p=>p.id==='genre:rock').trackIds,['deezer:2']);
  assert.equal(JSON.stringify([ids,catalog,history]),before);
});
test('recent mix and category count are bounded independently of Collection size',()=>{
  const tracks=Array.from({length:100},(_,i)=>({id:'deezer:'+i,genre:'Genre '+i,mood:'Mood '+i}));
  const mixes=smartPlaylists(tracks.map(t=>t.id),tracks);
  assert.equal(mixes.find(p=>p.id==='recent').trackIds.length,30);
  assert.equal(mixes.filter(p=>p.id.startsWith('genre:')).length,8);
  assert.equal(mixes.filter(p=>p.id.startsWith('mood:')).length,8);
});
test('Collection displays selectable Smart Mixes and playback actions',()=>{
  const state={...createInitialState(),favorites:ids,history};
  const html=createViews({state,catalog,current:null,allGenres:['all'],challengeIds:[],challengeResponses:[],smartPlaylistId:'genre:rock'}).renderCollection();
  assert.match(html,/Smart Mixes/);assert.match(html,/value="genre:rock" selected/);
  assert.match(html,/data-kind="smart">Play Mix/);
});
