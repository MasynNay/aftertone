import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,cpSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {rewritePublicSourceImports,rewritePublishedPublicModules} from '../scripts/static-module-paths.mjs';

test('all import forms target the published demo src folder, without changing display copy',()=>{
  const code="import x from '/src/a.mjs';\nexport {x} from '../src/b.mjs';\nimport '/src/c.mjs';\nconst d=import('/src/d.mjs');\nconst text='/src/not-an-import';";
  const top=rewritePublicSourceImports(code,'new-view.js');
  assert.match(top,/from '\.\/src\/a\.mjs'/);
  assert.match(top,/from '\.\/src\/b\.mjs'/);
  assert.match(top,/import '\.\/src\/c\.mjs'/);
  assert.match(top,/import\('\.\/src\/d\.mjs'\)/);
  assert.match(top,/text='\/src\/not-an-import'/);
  const nested=rewritePublicSourceImports(code,'components/deep/new-view.mjs');
  assert.ok(nested.includes("from '../../src/a.mjs'"));
});
test('new public files and nested modules are rewritten without an allowlist',()=>{
  const root=mkdtempSync(join(tmpdir(),'aftertone-modules-'));
  try {
    const pub=join(root,'public'),demo=join(root,'demo');
    mkdirSync(join(pub,'components'),{recursive:true});
    writeFileSync(join(pub,'new-view.js'),"import {x} from '../src/a.mjs';");
    writeFileSync(join(pub,'components','nested.mjs'),"import {x} from '/src/a.mjs';");
    cpSync(pub,demo,{recursive:true});
    mkdirSync(join(demo,'src'));
    writeFileSync(join(demo,'src','a.mjs'),"export const x=1;");
    assert.equal(rewritePublishedPublicModules(pub,demo),2);
    assert.equal(readFileSync(join(demo,'new-view.js'),'utf8'),"import {x} from './src/a.mjs';");
    assert.equal(readFileSync(join(demo,'components','nested.mjs'),'utf8'),"import {x} from '../src/a.mjs';");
    assert.equal(readFileSync(join(pub,'new-view.js'),'utf8'),"import {x} from '../src/a.mjs';");
    assert.equal(readFileSync(join(demo,'src','a.mjs'),'utf8'),"export const x=1;");
  } finally {rmSync(root,{recursive:true,force:true});}
});
