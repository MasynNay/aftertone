import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createViews } from '../public/views.js';
import { createInitialState, recordChoice } from '../src/taste.mjs';
import { normalizeDeezerTrack } from '../src/deezer.mjs';

const row=(id,title,artist)=>normalizeDeezerTrack({id,title,duration:198,readable:true,preview:`https://cdnt-preview.dzcdn.net/api/1/1/${id}.mp3`,artist:{name:artist},album:{cover_medium:'https://e-cdns-images.dzcdn.net/x.jpg'}});
const tracks=[row(12345,'bad guy','Billie Eilish'),row(12346,'Levitating','Dua Lipa'),row(12347,'Perfect','Ed Sheeran'),row(12348,'How Long','Charlie Puth')];
function pages(state=createInitialState(),extras={}) {return createViews({state,catalog:tracks,current:tracks[0],allGenres:['all','pop'],challengeIds:[],challengeResponses:[],feed:{available:4},availableSources:['deezer'],collectionQuery:'',collectionSort:'recent',...extras});}

test('streamlined discover keeps an inline preview player but removes clutter and obsolete source selector',()=>{
 const page=pages().renderDiscovery();
 assert.match(page,/id="stage-play"/);
 assert.match(page,/Find your next favorite/);
 assert.match(page,/data-action="like"/);
 assert.doesNotMatch(page,/id="source-select"/);
 assert.doesNotMatch(page,/New: real catalog metadata/);
 assert.doesNotMatch(page,/CONFIGURE_YOUTUBE/);
 assert.doesNotMatch(page,/youtube\.com\/embed/);
});

test('sidebar settings contain genre, language and optional import controls',()=>{
 const sidebar=pages().renderSidebarPreferences();
 for(const label of ['genre-select','language-select','music-search','import-playlist']) assert.match(sidebar,new RegExp(label));
 assert.doesNotMatch(sidebar,/source-select/);
});

test('quick keep records decision immediately and never enters recognition modal',()=>{
 const code=readFileSync(new URL('../public/main.js', import.meta.url),'utf8');
 assert.match(code,/else recordDecision\(selected, 'like'\)/);
 assert.doesNotMatch(code,/else openModal\('choice'/);
 assert.match(code,/const quizSession =|let quizSession =/);
});

test('optional Tune Lab has separate questions and mood feedback from saved music',()=>{
 const state=recordChoice(createInitialState(),{id:tracks[0].id,action:'like'});
 const quiz={id:tracks[0].id,answer:null,mood:null,quiz:{field:'artist',correct:'Billie Eilish',label:'Who made this track?',options:['Billie Eilish','Dua Lipa','Ed Sheeran','Charlie Puth']}};
 const page=pages(state,{quizSession:quiz}).renderQuizLab();
 assert.match(page,/data-quiz-answer="0"/);
 assert.doesNotMatch(page,/data-quiz-mood=/);
 const answered=pages(state,{quizSession:{...quiz,answer:0}}).renderQuizLab();
 assert.match(answered,/data-quiz-mood="Dreamy"/);
 assert.match(answered,/data-action="quiz-next"/);
});

test('favorite persistence is unchanged by Tune Lab and old preview source history remains readable',()=>{
 const state=recordChoice(createInitialState(),{id:tracks[0].id,action:'like'});
 assert.deepEqual(state.favorites,[tracks[0].id]);
 assert.equal(state.history[0].action,'like');
 const page=pages(state).renderCollection();
 assert.match(page,/Billie Eilish/);
});
