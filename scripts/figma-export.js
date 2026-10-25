// Figma → tokens export. Runs inside Figma (Plugin API) against the
// "Comedia Suite Design System" library file (5WsKy0WS3ipkyWLLTkfZRG):
// through Claude's Figma connection (use_figma), or pasted into a plugin.
// It returns the JSON that goes in tokens/figma.json, unchanged.
// Colours stay as 0–1 floats with alpha, so nothing is rounded on the way.
const collections = await figma.variables.getLocalVariableCollectionsAsync();
const names = {};
const out = { source: { fileKey: '5WsKy0WS3ipkyWLLTkfZRG', exportedAt: new Date().toISOString() }, collections: [] };
for (const c of collections) {
  const variables = [];
  for (const id of c.variableIds) {
    const v = await figma.variables.getVariableByIdAsync(id);
    names[id] = v.name;
    variables.push({ name: v.name, type: v.resolvedType, web: v.codeSyntax?.WEB ?? null, description: v.description || null, scopes: v.scopes, values: Object.fromEntries(Object.entries(v.valuesByMode).map(([m, val]) => [c.modes.find(x => x.modeId === m).name, val])) });
  }
  out.collections.push({ name: c.name, modes: c.modes.map(m => m.name), variables });
}
const round = x => Math.round(x * 10000) / 10000;
for (const c of out.collections) for (const v of c.variables) for (const m in v.values) {
  const val = v.values[m];
  if (val && val.type === 'VARIABLE_ALIAS') v.values[m] = { alias: names[val.id] };
  else if (val && typeof val === 'object' && 'r' in val) v.values[m] = { r: round(val.r), g: round(val.g), b: round(val.b), a: round(val.a ?? 1) };
}
out.textStyles = (await figma.getLocalTextStylesAsync()).map(s => ({ name: s.name, description: s.description || null, fontFamily: s.fontName.family, fontStyle: s.fontName.style, fontSize: s.fontSize, lineHeight: s.lineHeight, letterSpacing: s.letterSpacing }));
out.effectStyles = (await figma.getLocalEffectStylesAsync()).map(s => ({ name: s.name, description: s.description || null, effects: s.effects.filter(e => e.visible !== false).map(e => ({ type: e.type, x: e.offset?.x ?? 0, y: e.offset?.y ?? 0, radius: e.radius, spread: e.spread ?? 0, color: e.color ? { r: round(e.color.r), g: round(e.color.g), b: round(e.color.b), a: round(e.color.a) } : null })) }));
return out;
