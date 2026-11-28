/** Static demo source imports must resolve from each copied public module,
 * including future nested modules, not just a hard-coded filename list. */
import {readdirSync,readFileSync,writeFileSync} from 'node:fs';
import {join,relative,dirname,extname,sep} from 'node:path';

export function rewritePublicSourceImports(code,modulePath) {
  const route=relative(dirname(modulePath),'src').split(sep).join('/');
  const prefix=(route.startsWith('.')?route:'./'+route)+'/';
  // Static imports/re-exports, side-effect imports and literal dynamic imports.
  // Restrict the rewrite to module specifiers; do not change displayed text.
  return code.replace(/(\b(?:from\s*|import\s*(?:\(\s*)?))(['"])(?:\/src\/|(?:\.\.\/)+src\/)([^'"\r\n]+)\2/g,
    (_,lead,quote,tail)=>lead+quote+prefix+tail+quote);
}
export function rewritePublishedPublicModules(publicRoot,demoRoot) {
  let count=0;
  function visit(folder) {
    for(const entry of readdirSync(folder,{withFileTypes:true})) {
      const path=join(folder,entry.name);
      if(entry.isDirectory())visit(path);
      else if(entry.isFile()&&['.js','.mjs'].includes(extname(entry.name))) {
        const name=relative(publicRoot,path);
        const published=join(demoRoot,name);
        const code=readFileSync(published,'utf8');
        writeFileSync(published,rewritePublicSourceImports(code,name));
        count++;
      }
    }
  }
  visit(publicRoot);
  return count;
}
