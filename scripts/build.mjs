// Build the suite's tokens from the Figma export.
//
//   tokens/figma.json  (exported from the Figma library by scripts/figma-export.js)
//     → dist/theme.css   Tailwind v4 theme: @import it after "tailwindcss"
//     → dist/vars.css    the same tokens as plain --cds-* variables, for apps with their own theme
//     → dist/tokens.js   the same values for JS (inline styles, canvas, charts)
//     → dist/tokens.json resolved values, for anything else
//
// Names come from Figma: a variable's Web code syntax (var(--color-panel)) is
// its CSS name. Primitives become --palette-* on :root; the tokens apps use
// alias them, so a theme only has to swap aliases.
//
// Modes: a collection's first mode is the default. Every other mode becomes a
// [data-app="<mode>"] block holding only what differs, so <html data-app="slides">
// switches an app's palette without forking anything.
//
// `node scripts/build.mjs --check` fails if dist/ is out of date with the export.

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = JSON.parse(readFileSync(join(root, 'tokens/figma.json'), 'utf8'));
const check = process.argv.includes('--check');

const slug = s => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const num = x => +x.toFixed(4);
const px = x => (num(x) === 0 ? '0' : `${num(x)}px`);

function colour({ r, g, b, a }) {
  const c = [r, g, b].map(x => Math.round(x * 255));
  if (a >= 1) return '#' + c.map(x => x.toString(16).padStart(2, '0')).join('').toUpperCase();
  return `rgba(${c.join(', ')}, ${num(a)})`;
}

const collections = Object.fromEntries(src.collections.map(c => [c.name, c]));
const prim = collections.Primitives;
if (!prim) throw new Error('No Primitives collection in the export');

// ── Primitives → --palette-* ────────────────────────────────────────────────
const palette = new Map(); // figma name → { css, value }
for (const v of prim.variables) {
  if (v.type !== 'COLOR') continue;
  palette.set(v.name, { css: `--palette-${slug(v.name)}`, value: colour(v.values[prim.modes[0]]) });
}

// The CSS name of a variable: its Web code syntax, else one derived from its name.
function cssName(v, prefix) {
  const m = v.web && /^var\((--[a-z0-9-]+)\)$/i.exec(v.web.trim());
  if (m) return m[1];
  return `--${prefix}-${slug(v.name.replace(/^(color|radius|font)\//, ''))}`;
}

function cssValue(v, val) {
  if (val && typeof val === 'object' && 'alias' in val) {
    const p = palette.get(val.alias);
    if (!p) throw new Error(`${v.name}: alias to ${val.alias}, which is not a primitive`);
    return { css: `var(${p.css})`, resolved: p.value };
  }
  if (val && typeof val === 'object' && 'r' in val) { const c = colour(val); return { css: c, resolved: c }; }
  if (typeof val === 'number') return { css: `${num(val)}px`, resolved: `${num(val)}px` };
  if (typeof val === 'string') {
    const generic = /mono/i.test(v.name) ? 'monospace' : 'system-ui, sans-serif';
    const s = `'${val}', ${generic}`;
    return { css: s, resolved: s };
  }
  throw new Error(`${v.name}: unsupported value ${JSON.stringify(val)}`);
}

// ── Semantic tokens (Color, Radius, Typography) ─────────────────────────────
const theme = new Map();   // css name → { css, resolved, from }
const modes = new Map();   // mode name → Map(css name → css)
function add(collection, prefix) {
  const c = collections[collection];
  if (!c) return;
  const [base, ...rest] = c.modes;
  for (const v of c.variables) {
    // Code syntax that isn't var(--x) (Spacing's calc(var(--spacing) * n),
    // a radius of "2px") means code uses that expression as is: nothing to emit.
    if (v.web && !/^var\(--[a-z0-9-]+\)$/i.test(v.web.trim())) continue;
    const name = cssName(v, prefix);
    const val = cssValue(v, v.values[base]);
    const prev = theme.get(name);
    if (prev && prev.resolved !== val.resolved) throw new Error(`${name} is set by ${prev.from} (${prev.resolved}) and ${v.name} (${val.resolved})`);
    if (!prev) theme.set(name, { ...val, from: v.name });
    for (const m of rest) {
      const mv = cssValue(v, v.values[m]);
      if (mv.resolved === val.resolved) continue;
      if (!modes.has(m)) modes.set(m, new Map());
      modes.get(m).set(name, mv.css);
    }
  }
}
add('Color', 'color');
add('Spacing', 'spacing');
add('Radius', 'radius');
add('Typography', 'font');

// ── Shadows: effect styles, CSS name in the description ("code: --shadow-x") ─
for (const s of src.effectStyles ?? []) {
  const m = /code:\s*(--[a-z0-9-]+)/i.exec(s.description ?? '');
  const name = m ? m[1] : `--shadow-${slug(s.name.replace(/^shadow\//i, ''))}`;
  const value = s.effects.map(e => `${e.type === 'INNER_SHADOW' ? 'inset ' : ''}${px(e.x)} ${px(e.y)} ${px(e.radius)}${e.spread ? ` ${px(e.spread)}` : ''} ${colour(e.color)}`).join(', ');
  theme.set(name, { css: value, resolved: value, from: s.name });
}

// ── Text styles → Tailwind text-* utilities (text-body-small, text-badge…) ──
const WEIGHT = { thin: 100, extralight: 200, light: 300, regular: 400, medium: 500, semibold: 600, bold: 700, extrabold: 800, black: 900 };
const text = [];
for (const s of src.textStyles ?? []) {
  const n = `--text-${slug(s.name)}`;
  const lh = s.lineHeight?.unit === 'PIXELS' ? `${num(s.lineHeight.value)}px` : s.lineHeight?.unit === 'PERCENT' ? `${num(s.lineHeight.value / 100)}` : 'normal';
  const ls = s.letterSpacing?.unit === 'PERCENT' ? `${num(s.letterSpacing.value / 100)}em` : `${num(s.letterSpacing?.value ?? 0)}px`;
  const w = WEIGHT[s.fontStyle.toLowerCase().replace(/[\s-]/g, '')] ?? 400;
  text.push([n, `${num(s.fontSize)}px`], [`${n}--line-height`, lh], [`${n}--letter-spacing`, ls], [`${n}--font-weight`, String(w)]);
}

// ── Deprecated names: old CSS names kept for one release (tokens/deprecated.json) ─
let deprecated = [];
try {
  const d = JSON.parse(readFileSync(join(root, 'tokens/deprecated.json'), 'utf8'));
  for (const [k, v] of Object.entries(d.aliases ?? {})) {
    if (theme.has(k)) throw new Error(`${k} is deprecated but Figma still uses it: remove it from tokens/deprecated.json`);
    const target = /^var\((--[a-z0-9-]+)\)$/.exec(v);
    if (target && !theme.has(target[1])) throw new Error(`${k} points at ${target[1]}, which is not a token`);
    deprecated.push([k, v, target ? theme.get(target[1]).resolved : v]);
  }
} catch (e) { if (e.code !== 'ENOENT') throw e; }

// ── Write ───────────────────────────────────────────────────────────────────
const head = `/* Comedia suite design tokens. Generated by scripts/build.mjs from
   tokens/figma.json (Figma: Comedia Suite Design System). Do not edit by
   hand: change the Figma library, export, rebuild. */\n`;
const block = (sel, entries) => `${sel} {\n${entries.map(([k, v]) => `  ${k}: ${v};`).join('\n')}\n}\n`;
let css = head + '\n/* Palette: the raw colours. Apps use the tokens below, not these. */\n';
css += block(':root', [...palette.values()].map(p => [p.css, p.value]));
css += '\n/* Tokens. static: utilities read var(--color-*), so a [data-app] theme reaches them. */\n';
css += block('@theme static', [...[...theme].map(([k, v]) => [k, v.css]), ...text]);
for (const [m, entries] of modes) css += `\n/* ${m} */\n` + block(`[data-app="${slug(m)}"]`, [...entries]);
if (deprecated.length) css += '\n/* Deprecated: old names, kept for one release. Use the name they point at. In @theme so their utilities (bg-blue, text-red) still exist. */\n' + block('@theme static', deprecated.map(([k, v]) => [k, v]));

// Namespaced copy for apps that keep their own theme (Patterns' prototypes):
// the same tokens as plain variables prefixed --cds-, no Tailwind utilities,
// so nothing can collide with the app's own --color-* names.
const ns = n => `--cds-${n.slice(2)}`;
const nsValue = v => v.replace(/var\(--palette-/g, 'var(--cds-palette-');
let vars = head.replace('Do not edit by\n   hand', 'Namespaced (--cds-*) for apps\n   with their own theme. Do not edit by hand') + '\n';
vars += block(':root', [...[...palette.values()].map(p => [ns(p.css), p.value]), ...[...theme].map(([k, v]) => [ns(k), nsValue(v.css)]), ...text.map(([k, v]) => [ns(k), v])]);
for (const [m, entries] of modes) vars += `\n/* ${m} */\n` + block(`[data-app="${slug(m)}"]`, [...entries].map(([k, v]) => [ns(k), nsValue(v)]));
if (deprecated.length) vars += '\n/* Deprecated: old names, kept for one release. */\n' + block(':root', deprecated.map(([k, v]) => [ns(k), v.replace(/var\(--/g, 'var(--cds-')]));

const resolved = Object.fromEntries([...[...palette.values()].map(p => [p.css.slice(2), p.value]), ...[...theme].map(([k, v]) => [k.slice(2), v.resolved]), ...text.map(([k, v]) => [k.slice(2), v])]);
const js = `// Generated by scripts/build.mjs from tokens/figma.json. Do not edit.\n` +
  `/** Resolved values, keyed by CSS name without the leading dashes ("color-panel"). */\n` +
  `export const tokens = ${JSON.stringify(resolved, null, 2)};\n\n` +
  `/** var() references for inline styles: cssVar['color-panel'] → 'var(--color-panel)'. */\n` +
  `export const cssVar = Object.fromEntries(Object.keys(tokens).map(k => [k, \`var(--\${k})\`]));\n\n` +
  `/** The app themes (Figma modes other than the default), for <html data-app="…">. */\n` +
  `export const apps = ${JSON.stringify([...modes.keys()].map(slug))};\n`;
const dts = `export type TokenName = ${Object.keys(resolved).map(k => JSON.stringify(k)).join(' | ')};\n` +
  `export declare const tokens: Record<TokenName, string>;\n` +
  `export declare const cssVar: Record<TokenName, string>;\n` +
  `export declare const apps: string[];\n`;
const json = JSON.stringify({ source: src.source, tokens: resolved, apps: Object.fromEntries([...modes].map(([m, e]) => [slug(m), Object.fromEntries(e)])) }, null, 2) + '\n';

const outputs = { 'dist/theme.css': css, 'dist/vars.css': vars, 'dist/tokens.js': js, 'dist/tokens.d.ts': dts, 'dist/tokens.json': json };
let stale = [];
for (const [f, body] of Object.entries(outputs)) {
  const p = join(root, f);
  if (check) { let cur = ''; try { cur = readFileSync(p, 'utf8'); } catch {} if (cur !== body) stale.push(f); continue; }
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, body);
}
if (check && stale.length) { console.error(`Out of date: ${stale.join(', ')}. Run npm run build.`); process.exit(1); }
console.log(`${check ? 'Up to date' : 'Built'}: ${palette.size} palette colours, ${theme.size} tokens, ${text.length / 4} text styles, ${modes.size} app themes.`);
