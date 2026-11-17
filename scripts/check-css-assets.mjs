/** Validate local CSS url() references in a built static site. */
import {existsSync, readFileSync, statSync} from 'node:fs';
import {dirname, resolve, relative, isAbsolute} from 'node:path';

export function checkCssAssets(stylesheet, publishedRoot) {
  const css=readFileSync(stylesheet,'utf8');
  let checked=0;
  for (const match of css.matchAll(/url\(\s*(?:"([^"]*)"|'([^']*)'|([^)]*?))\s*\)/gi)) {
    const raw=(match[1]??match[2]??match[3]).trim();
    if (!raw || /^(?:data:|https?:|blob:|#|\/\/)/i.test(raw)) continue;
    const pathname=raw.split(/[?#]/,1)[0];
    if (!pathname) continue;
    const target=pathname.startsWith('/')?resolve(publishedRoot,'.'+pathname):resolve(dirname(stylesheet),pathname);
    const rel=relative(publishedRoot,target);
    if (rel==='..'||rel.startsWith('../')||isAbsolute(rel)) {
      throw new Error(`CSS asset escapes published site: ${stylesheet} -> ${raw}`);
    }
    if (!existsSync(target)||!statSync(target).isFile()) {
      throw new Error(`Missing CSS asset: ${stylesheet} -> ${raw}`);
    }
    checked++;
  }
  return checked;
}
