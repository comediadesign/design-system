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
| `dist/vars.css` | The same tokens as plain `--cds-*` variables (no Tailwind utilities), for apps with a theme of their own. |
| `dist/tokens.js` | The same values for JavaScript (`tokens`, `cssVar`, `apps`). |
| `dist/tokens.json` | Resolved values for anything else. |

`dist/` is committed, so apps install the package without building it.

## Using it in an app

```bash
npm install "@comedia/design-system@https://codeload.github.com/comediadesign/design-system/tar.gz/refs/tags/v0.2.0"
```

Use the release download (https), not `github:…`: npm records that as a git+ssh address, which Vercel's build can't fetch.

```css
/* app/globals.css: after Tailwind, before the app's own CSS */
@import "tailwindcss";
@import "@comedia/design-system/theme.css";
```

That gives every token as a CSS variable and a Tailwind utility: `bg-panel`, `text-text-mid`, `border-border-subtle`, `rounded-pill`, `shadow-panel`, `text-body-small`, `font-sans`. In inline styles, use `var(--color-panel)`, or `cssVar['color-panel']` from `@comedia/design-system/tokens`.

**Apps with their own theme** (Patterns, whose prototypes have their own `--color-*` palette) import `vars.css` instead and map what their suite chrome needs: `--sc-background: var(--cds-color-panel)`. The `--cds-` prefix means nothing collides with the app's own names.

```css
@import "@comedia/design-system/vars.css";
```

Apps use the **tokens** (`--color-*`, `--radius-*`, `--shadow-*`, `--text-*`, `--font-*`), never the `--palette-*` colours underneath. That's what lets a theme swap the palette without touching components.

## Apps on it

| App | Repo | How |
| --- | --- | --- |
| Mail (and Outreach) | chrisbcn/comedia-email | `theme.css` in `app/globals.css` |
| Slides | comediadesign/comedia-deck-system | `theme.css` in `src/app/globals.css`, before Slides' own `@theme` (its deck palette wins on shared names) |
| Patterns, Builder | comediadesign/concept-prototypes (`suite/shared-ui`, `suite/demo-data`) | `vars.css` in `packages/suite-ui/src/tokens.css`, mapped onto the suite chrome's names |

## Changing the design system

1. Change the variables or styles in the Figma library, and publish the library so the design files get the change too.
2. Export: run `scripts/figma-export.js` against the library. Claude can do this through its Figma connection ("export the design system tokens"), or you can paste the script into a Figma plugin console. Save the result as `tokens/figma.json`.
3. Build: `npm run build`. CI fails a push whose `dist/` doesn't match the export.
4. Release: `scripts/release.sh 0.3.0`. It checks `dist/`, sets the version, commits, tags `v0.3.0`, pushes, and starts every app's update.
5. Each app updates itself (below) and deploys.

## How apps stay current

Each app repo has `.github/workflows/design-system-update.yml` (copied from `templates/`). Every hour, and whenever `release.sh` starts it, it reads the newest `v*` tag here. If the app is behind, the workflow moves its `package.json` and lockfile to that release and pushes, and Vercel deploys. This repo is public, so the workflow needs no tokens; it pushes with the app repo's own built-in permission.

If a release breaks an app's build, Vercel keeps that app's last good deployment live, and the failed build shows in Vercel. Fix forward with a new release.

| App | Workflow updates | Notes |
| --- | --- | --- |
| Mail | `main` | |
| Slides | `main` | |
| Patterns, Builder | `suite/shared-ui`, then merges into `suite/demo-data` | The workflow file lives on `main` (GitHub runs scheduled workflows from the default branch); `main` itself has no suite chrome yet. |

To add an app: install the package, copy the template into its `.github/workflows/`, set the four `env` lines, and add the repo to `APPS` in `scripts/release.sh`.

How a token gets its CSS name: from the variable's **Web code syntax** in Figma (`var(--color-panel)`). Variables without one get a name from their path (`color/badge/client-bg` → `--color-badge-client-bg`). Shadows take theirs from a `code: --shadow-x` line in the style's description. A code syntax that isn't a `var()` (spacing's `calc(var(--spacing) * 4)`, a radius of `2px`) means code writes that value directly, so nothing is emitted: spacing stays Tailwind's 4px scale.

## Per-app themes

Each app can look the same but different, for example with its own accent. To set one up:

1. In Figma, add a mode to the **Color** collection named after the app (`Slides`), and change only the variables that differ.
2. Export and build. Each extra mode becomes a `[data-app="slides"]` block holding just those overrides.
3. The app sets `<html data-app="slides">`.

Every app keeps the same components, spacing and type. Only the overridden tokens change.

## Versions

- **v0.2.0**: `vars.css`, the tokens as namespaced `--cds-*` variables for apps with their own theme. `theme.css` is unchanged.
- **v0.1.1**: tokens whose Figma code syntax is a plain value (radius `2px`, `40px`) are no longer emitted, so Tailwind's own `rounded-xs` is untouched.
- **v0.1.0**: the tokens from Comedia Mail, matched one for one with Mail's previous `app/globals.css` theme. Mail is the first app on it.
