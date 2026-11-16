import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {THEMES} from '../app/src/themes.mjs';

const css=readFileSync(new URL('../app/public/themes.css',import.meta.url),'utf8');
function luminance(hex){
  const values=hex.match(/[0-9a-f]{2}/gi).map(pair=>parseInt(pair,16)/255)
    .map(value=>value<=0.04045?value/12.92:((value+0.055)/1.055)**2.4);
  return values[0]*0.2126 + values[1]*0.7152 + values[2]*0.0722;
}
function contrast(first,second){
  const a=luminance(first),b=luminance(second);
  return (Math.max(a,b)+0.05)/(Math.min(a,b)+0.05);
}
test('all 20 themes meet minimum 4.5:1 contrast for primary, muted and accent text surfaces',()=>{
  assert.equal(THEMES.length,20);
  for(const theme of THEMES){
    for(const [label,fg,bg] of [
      ['body copy',theme.colors.text,theme.colors.bg],
      ['muted surface copy',theme.colors.muted,theme.colors.surface],
      ['accent on surface',theme.colors.accent,theme.colors.surface],
      ['accent button text',theme.colors.accentInk,theme.colors.accent],
    ]){
      const actual=contrast(fg,bg);
      assert.ok(actual>=4.5,theme.id+' '+label+' contrast '+actual.toFixed(2)+' below 4.5:1');
    }
  }
});
test('generated theme stylesheet contains audited source color tokens',()=>{
  for(const theme of THEMES){
    const start=css.indexOf('body[data-theme="'+theme.id+'"] {');
    assert.ok(start>=0,'missing theme selector: '+theme.id);
    const block=css.slice(start,css.indexOf('}',start)+1);
    for(const token of ['bg','surface','text','muted','accent','accentInk']){
      assert.ok(block.includes('--'+token+': '+theme.colors[token]+';'),
        theme.id+' generated CSS out of sync for '+token);
    }
  }
});
