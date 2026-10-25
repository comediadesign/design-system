# Comedia design system

One design system for the Comedia suite: Mail (with Outreach), Slides, Patterns and Builder. Change it here and every app picks it up on its next update.

**Source of truth:** the Figma library **Comedia Suite Design System** ([file](https://www.figma.com/design/5WsKy0WS3ipkyWLLTkfZRG)). This repo turns its variables and styles into code. It holds no design decisions of its own.

## What's in it

| File | What it is |
| --- | --- |
| `tokens/figma.json` | The raw export from Figma: every variable, mode, text style and shadow. |
| `scripts/figma-export.js` | The Figma script that produces that export. |
| `scripts/build.mjs` | Turns the export into `dist/`. |
| `dist/theme.css` | The Tailwind v4 theme: colours, radii, fonts, shadows and text styles. |
| `dist/tokens.js` | The same values for JavaScript (`tokens`, `cssVar`, `apps`). |
| `dist/tokens.json` | Resolved values for anything else. |

`dist/` is committed, so apps install the package without building it.

## Using it in an app

```bash
npm install "@comedia/design-system@https://codeload.github.com/comediadesign/design-system/tar.gz/refs/tags/v0.1.1"
```

Use the release download (https), not `github:…`: npm records that as a git+ssh address, which Vercel's build can't fetch.

```css
/* app/globals.css: after Tailwind, before the app's own CSS */
@import "tailwindcss";
@import "@comedia/design-system/theme.css";
```

That gives every token as a CSS variable and a Tailwind utility: `bg-panel`, `text-text-mid`, `border-border-subtle`, `rounded-pill`, `shadow-panel`, `text-body-small`, `font-sans`. In inline styles, use `var(--color-panel)`, or `cssVar['color-panel']` from `@comedia/design-system/tokens`.

Apps use the **tokens** (`--color-*`, `--radius-*`, `--shadow-*`, `--text-*`, `--font-*`), never the `--palette-*` colours underneath. That's what lets a theme swap the palette without touching components.

## Changing the design system

1. Change the variables or styles in the Figma library, and publish the library so the design files get the change too.
2. Export: run `scripts/figma-export.js` against the library. Claude can do this through its Figma connection ("export the design system tokens"), or you can paste the script into a Figma plugin console. Save the result as `tokens/figma.json`.
3. Build: `npm run build`. CI fails a push whose `dist/` doesn't match the export.
4. Commit, tag a new version (`v0.2.0`), push.
5. Each app moves to the new tag, and its next deploy carries the change.

How a token gets its CSS name: from the variable's **Web code syntax** in Figma (`var(--color-panel)`). Variables without one get a name from their path (`color/badge/client-bg` → `--color-badge-client-bg`). Shadows take theirs from a `code: --shadow-x` line in the style's description. A code syntax that isn't a `var()` (spacing's `calc(var(--spacing) * 4)`, a radius of `2px`) means code writes that value directly, so nothing is emitted: spacing stays Tailwind's 4px scale.

## Per-app themes

Each app can look the same but different, for example with its own accent. To set one up:

1. In Figma, add a mode to the **Color** collection named after the app (`Slides`), and change only the variables that differ.
2. Export and build. Each extra mode becomes a `[data-app="slides"]` block holding just those overrides.
3. The app sets `<html data-app="slides">`.

Every app keeps the same components, spacing and type. Only the overridden tokens change.

## Versions

- **v0.1.1**: tokens whose Figma code syntax is a plain value (radius `2px`, `40px`) are no longer emitted, so Tailwind's own `rounded-xs` is untouched.
- **v0.1.0**: the tokens from Comedia Mail, matched one for one with Mail's previous `app/globals.css` theme. Mail is the first app on it.
