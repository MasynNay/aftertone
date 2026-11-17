import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, statSync} from 'node:fs';

const readme = readFileSync(new URL('../README.md',import.meta.url),'utf8');
const provenance=readFileSync(new URL('../docs/SCREENSHOT_PROVENANCE.md',import.meta.url),'utf8');

for(const [name,caption] of [
  ['app-music-duels-bracket.webp','Music Duels — a match in progress'],
  ['app-music-duels-podium.webp','Music Duels — champions and results'],
]){
  test(`README embeds real, nonempty ${name} with verified file header`,()=>{
    const file=new URL(`../docs/screenshots/${name}`,import.meta.url);
    const bytes=readFileSync(file);
    assert.ok(bytes.length > 15_000 && bytes.length < 800_000,'Screenshot must be a useful, reasonably sized image');
    assert.equal(bytes.toString('ascii',0,4),'RIFF');
    assert.equal(bytes.toString('ascii',8,12),'WEBP');
    assert.match(bytes.toString('ascii',12,16),/VP8/,'Expected a WebP image payload');
    assert.ok(readme.includes(`(docs/screenshots/${name})`),'README image link missing');
    assert.ok(readme.includes(caption),'README caption missing');
    assert.ok(provenance.includes(name),'Source and test-fixture provenance missing');
    assert.ok(statSync(file).size===bytes.length);
  });
}

test('README marks fixture captures as not proof of live music permissions or playback',()=>{
  assert.match(readme,/fictional test tracks/i);
  assert.match(readme,/do not.*verify live music playback/i);
  assert.match(provenance,/does not satisfy unresolved work to obtain media permissions/i);
});
