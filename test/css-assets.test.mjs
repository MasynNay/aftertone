import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync, mkdirSync, writeFileSync, rmSync, symlinkSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {checkCssAssets} from '../scripts/check-css-assets.mjs';

test('CSS asset graph resolves relative and root-relative assets and ignores external/data URLs',()=>{
  const root=mkdtempSync(join(tmpdir(),'aftertone-css-'));
  try {
    mkdirSync(join(root,'css'));mkdirSync(join(root,'images'));
    writeFileSync(join(root,'images','cover.svg'),'<svg/>');
    const css=join(root,'css','style.css');
    writeFileSync(css,'a{background:url("../images/cover.svg?v=2#icon")}b{mask:url("/images/cover.svg")}c{background:url(data:image/png;base64,AA==)}d{background:url(https://example.org/a.svg)}');
    assert.equal(checkCssAssets(css,root),2);
  } finally {rmSync(root,{recursive:true,force:true});}
});

test('CSS asset graph fails for missing assets and paths outside published output',()=>{
  const root=mkdtempSync(join(tmpdir(),'aftertone-css-'));
  try {
    const css=join(root,'style.css');
    writeFileSync(css,'a{background:url("./missing.svg")}');
    assert.throws(()=>checkCssAssets(css,root),/Missing CSS asset/);
    writeFileSync(css,'a{background:url("../private.svg")}');
    assert.throws(()=>checkCssAssets(css,root),/escapes published site/);
  } finally {rmSync(root,{recursive:true,force:true});}
});

test('CSS asset graph rejects symlinks outside dist but permits internal aliases',()=>{
  const root=mkdtempSync(join(tmpdir(),'aftertone-css-'));
  const outside=mkdtempSync(join(tmpdir(),'aftertone-css-private-'));
  try {
    writeFileSync(join(outside,'private.svg'),'<svg/>');
    symlinkSync(join(outside,'private.svg'),join(root,'leaked.svg'));
    const css=join(root,'style.css');
    writeFileSync(css,'a{background:url("./leaked.svg")}');
    assert.throws(()=>checkCssAssets(css,root),/escapes published site via symlink/);
    writeFileSync(join(root,'safe.svg'),'<svg/>');
    symlinkSync(join(root,'safe.svg'),join(root,'alias.svg'));
    writeFileSync(css,'a{background:url("./alias.svg")}');
    assert.equal(checkCssAssets(css,root),1);
  } finally {
    rmSync(root,{recursive:true,force:true});
    rmSync(outside,{recursive:true,force:true});
  }
});
