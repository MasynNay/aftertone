/** 20 intentionally differentiated palettes. No third-party CSS or design assets. */
function palette(id, name, kind, colors, description) {
  const [bg, side, surface, surface2, surface3, border, text, muted, dim, accent, accentInk, heroA, heroB, heroC] = colors;
  return Object.freeze({ id, name, kind, description, swatch: accent,
    colors: Object.freeze({ bg, side, surface, surface2, surface3, border, text, muted, dim, accent, accentInk,
      warm: kind === 'light' ? '#a83f55' : '#ffb4a2', purple: kind === 'light' ? '#654abb' : '#bcb0ff',
      vinyl: heroB, heroA, heroB, heroC, shadow: kind === 'light' ? 'rgba(38,42,51,.13)' : 'rgba(0,0,0,.32)' }),
  });
}
export const THEMES = Object.freeze([
  palette('night','Midnight','dark',['#0c0e15','#10131c','#171b27','#1e2431','#292e3a','#2a303e','#f7f8fc','#a2a9b7','#737c8e','#d7f681','#1a2410','#28365b','#1d2441','#433857'],'The original after-hours listening room'),
  palette('aurora','Aurora','dark',['#081918','#0a211f','#12302b','#1a3d35','#265046','#2b5048','#f1f8f1','#adc9bf','#85ab9d','#c2f29e','#17311c','#23584d','#133d46','#324e45'],'Forest greens and northern lights'),
  palette('plum','Plum','dark',['#17101c','#201426','#2b2032','#35263d','#44314d','#543a58','#fff5fb','#d2b9d2','#a890ac','#ffb6ca','#4c2331','#66446b','#3a2c53','#6f4259'],'Soft berry and lilac'),
  palette('daylight','Daylight','light',['#f4f3ef','#eae9e4','#ffffff','#f4f3ee','#ebebe6','#dadbd5','#202622','#666e67','#899187','#476d39','#ffffff','#dce8d4','#ebede5','#dfd9ed'],'Fresh paper and sage'),
  palette('charcoal','Charcoal','dark',['#111214','#191a1d','#222428','#2a2d31','#35383b','#414449','#f5f5f3','#b4b5b7','#8c9093','#ededed','#161719','#3c4147','#25282d','#454249'],'Monochrome, understated, clean'),
  palette('obsidian','Obsidian','dark',['#08080a','#111014','#19191e','#24242a','#303038','#33333b','#ffffff','#b5aebd','#817c8b','#ecb76b','#24160b','#3e2b29','#1e1c2c','#4d302d'],'Inky black with warm gold'),
  palette('deepsea','Deep Sea','dark',['#06131f','#091c2b','#112c3c','#173c4b','#215466','#2b5060','#eaf8ff','#a5c6d4','#739dac','#72dff0','#063039','#16485e','#123147','#205772'],'Underwater blues and cyan'),
  palette('glacier','Glacier','light',['#eaf4f8','#dcecf2','#ffffff','#e8f3f8','#d6e8f0','#c0d9e5','#173b51','#577286','#7993a3','#176f9a','#ffffff','#bce8f8','#dceff8','#b4d4e9'],'Frosted glass and arctic blue'),
  palette('sunset','Sunset','dark',['#23141b','#301a22','#3e252d','#4b3038','#614049','#69414e','#fff3eb','#e2bcb1','#b98e8b','#ffcb8a','#49240e','#904d54','#4f2b4b','#9d5b35'],'Golden hour and terracotta'),
  palette('ember','Ember','dark',['#1b100b','#271710','#322117','#412c1e','#523728','#644331','#fff6e9','#d6b8a3','#a88c77','#ffa65f','#36170b','#72412b','#3b2721','#85482e'],'Fireside copper and smoke'),
  palette('rose','Rosewater','light',['#fff5f6','#f8e9ee','#ffffff','#fff0f2','#f5e1e7','#e8cdd7','#513445','#896879','#a68d99','#b84778','#ffffff','#f9d5df','#f3e3ee','#e9bfd0'],'Soft blush, spacious and calm'),
  palette('mint','Mint','light',['#eefaf3','#ddf2e7','#ffffff','#e8f8ef','#d6efe2','#bedfce','#193b30','#54766a','#7c978a','#17765d','#ffffff','#c5f0d7','#e7f5ec','#c9e9dd'],'Clean white and spearmint'),
  palette('forest','Evergreen','dark',['#0f1b14','#17241a','#21352a','#2b4133','#385443','#3b5946','#f4f7eb','#b2caac','#89a087','#d1dd85','#23320f','#435b39','#243d31','#536348'],'Deep pine and moss'),
  palette('sandstone','Sandstone','light',['#f9f2e9','#efe3d5','#fffaf4','#f4e8db','#e9d8c5','#dfc9b1','#403026','#887361','#a08e7b','#a15634','#ffffff','#e5c49e','#f4e7d9','#d9af90'],'Earthy beige and warm clay'),
  palette('cream','Porcelain','light',['#fcfbf7','#f1efe9','#ffffff','#f7f5ee','#efebe2','#e1ddd1','#2d3034','#697179','#949ba0','#315a88','#ffffff','#d9e2ed','#f3eee2','#cbdce9'],'Minimal ivory and navy'),
  palette('latte','Café','light',['#f7f0e8','#e9dfd2','#fffaf4','#f2e7db','#e5d6c8','#d5c4b1','#3b2b24','#806c5f','#a18e81','#83563d','#ffffff','#dfb99b','#eaded2','#c99b86'],'Espresso, oat milk and caramel'),
  palette('lavender','Lavender','light',['#f6f1fc','#ebe2f5','#ffffff','#f2eafa','#e7dbf2','#d8c9e8','#392c4a','#746486','#9688a5','#7b52b4','#ffffff','#d7c2ef','#ede4f9','#d5d1ed'],'Light violet with ink-dark text'),
  palette('retro','Retro Arcade','dark',['#16132c','#21193d','#2c2350','#382b61','#4c397b','#53406c','#fffbfa','#b9aed4','#9084b4','#ffde59','#231331','#57428d','#2c2e70','#774b79'],'Purple neon and pixel nostalgia'),
  palette('solarized','Solarized','dark',['#002b36','#073642','#12444e','#1a5158','#285e60','#38636d','#eee8d5','#93a1a1','#738e91','#b58900','#00212a','#135467','#003b52','#356361'],'Classic developer-friendly blue-green'),
  palette('neon','Neon Pulse','dark',['#090b15','#11152b','#1a2040','#23294d','#303963','#39436c','#f5f8ff','#b0bee1','#7e92c0','#53fdd7','#061e20','#22286b','#181d4d','#443173'],'Electric cyan and midnight indigo'),
]);
export const THEME_IDS = Object.freeze(THEMES.map((t) => t.id));
