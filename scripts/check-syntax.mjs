/** Dependency-free syntax gate for source, tests and build scripts. */
import {readdir} from 'node:fs/promises';
import {resolve,relative,extname} from 'node:path';
import {spawnSync} from 'node:child_process';
const ROOT=resolve(import.meta.dirname,'..');
const targets=['app','site','scripts','test'];
const files=[];
async function walk(path) {
  for(const entry of await readdir(resolve(ROOT,path),{withFileTypes:true})) {
    const rel=path==='.'?entry.name:`${path}/${entry.name}`;
    if(entry.isDirectory()) await walk(rel);
    else if(['.js','.mjs'].includes(extname(entry.name))) files.push(rel);
  }
}
for(const path of targets) {
  if(path.endsWith('.mjs')) files.push(path);
  else await walk(path);
}
files.sort();
for(const file of files) {
  const result=spawnSync(process.execPath,['--check',resolve(ROOT,file)],{encoding:'utf8'});
  if(result.status!==0) {
    process.stderr.write(`Syntax error in ${file}:\n${result.stderr}\n`);
    process.exit(1);
  }
}
console.log(`Syntax verified: ${files.length} JavaScript modules`);
