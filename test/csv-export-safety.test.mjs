import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {csvCell,csvRows} from '../app/src/csv.mjs';
import {createTournament,nextDuelMatch,voteDuel,podiumCsv,hallOfFameCsv} from '../app/src/duels.mjs';

test('spreadsheet formula prefixes are inert even after leading whitespace or invisible marks',()=>{
  const hostile=[
    '=HYPERLINK("https://fixture.invalid","Open")',
    '+SUM(2,3)','-1+2','@SUM(2,3)',
    '  =HYPERLINK("https://fixture.invalid","Open")',
    '\t+SUM(1,2)','\r=1+1','\n@NOW()',
    '\uFEFF=1+1','\u200B-42',
  ];
  for(const value of hostile)
    assert.equal(csvCell(value),'"'+"'"+value.replaceAll('"','""')+'"',
      'Potential spreadsheet formula was not explicitly rendered as text');
  assert.equal(csvCell('A, "safe" recording'),'"A, ""safe"" recording"');
  assert.equal(csvCell("  Just a title"),'"  Just a title"');
  assert.equal(csvCell('Jazz / Rock'),'"Jazz / Rock"');
  assert.equal(csvCell(7),'"7"');
  assert.equal(csvCell(null),'""');
  assert.equal(csvRows([['Title','Artist'],['A, "safe" recording','Singer']]),
    '"Title","Artist"\r\n"A, ""safe"" recording","Singer"\r\n');
});

test('podium and Hall of Fame CSVs use the same safe cell encoding without rewriting titles',()=>{
  const titles=[
    '=HYPERLINK("https://fixture.invalid","Listen")',
    'Safe Title',
    'Third Song',
    'Fourth Song',
  ];
  const tracks=titles.map((title,i)=>({
    id:'deezer:'+(810000+i),title,
    artist:i===0?'\t@Untrusted Singer':'Test Artist '+i,
    source:'deezer',genre:'unknown'
  }));
  const name='  +Friday Cup';
  let tournament=createTournament({
    id:'duel_spreadsheet_safe1',name,tracks,createdAt:1730000000000
  });
  while(tournament.status!=='complete'){
    const match=nextDuelMatch(tournament);
    assert.ok(match,'A four-song tournament must advance');
    tournament=voteDuel(tournament,match.id,match.a,1730000001000);
  }
  const podium=podiumCsv(tournament);
  const hall=hallOfFameCsv([tournament]);
  for(const output of [podium,hall]){
    assert.ok(output.includes(csvCell(tracks[0].title)),
      'A ranked song title must be exported literally, not as a formula');
    assert.ok(output.includes(csvCell(tracks[0].artist)),
      'A ranked artist name must not run as a formula');
    assert.ok(output.includes(csvCell('Safe Title')),
      'Normal song names must not be modified');
    assert.ok(output.endsWith('\r\n'),'CSV must end with a normal CRLF');
  }
  // Creating a cup intentionally trims its name before storage.
  assert.ok(podium.includes(csvCell(tournament.name)),
    'A normalized user-supplied cup name must not execute in a spreadsheet');
  assert.equal(tournament.name,name.trim(),
    'CSV must preserve the tournament name after its ordinary input normalization');
  assert.equal(tournament.entries[0].title,titles[0],
    'Export must not modify the saved song metadata');
});

test('Collection CSV export shares the hardened encoder but JSON stays unmodified',()=>{
  const main=readFileSync(new URL('../app/public/main.js',import.meta.url),'utf8');
  assert.match(main,/import \{ csvRows \} from '\/src\/csv\.mjs'/);
  const exportBlock=main.slice(main.indexOf("function exportLibrary(type = 'json')"),
    main.indexOf('/** Persistent action feedback'));
  assert.match(exportBlock,/csvRows\(\[\['Title','Artist','Genre','Mood','Source URL'\]/);
  assert.match(exportBlock,/JSON\.stringify\(\{ exportVersion: 1/);
  assert.doesNotMatch(exportBlock,/replaceAll\('"', '""'\)/,
    'Do not reintroduce a second unsafe CSV path');
});
