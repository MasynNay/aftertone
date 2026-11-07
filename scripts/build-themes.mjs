import { writeFile } from 'node:fs/promises';
import { THEMES } from '../src/themes.mjs';
const css = [
  '/* GENERATED FROM src/themes.mjs — edit the palettes there, then run npm run themes */',
  ...THEMES.map((theme) => `body[data-theme="${theme.id}"] {\n  color-scheme: ${theme.kind};\n${Object.entries(theme.colors).map(([key, val]) => `  --${key}: ${val};`).join('\n')}\n}`),
].join('\n\n') + '\n';
await writeFile(new URL('../public/themes.css', import.meta.url), css);
console.log(`Generated ${THEMES.length} AFTERTONE themes`);
