'use client';

import { useEffect, useRef, useState } from 'react';
import type { SuiteApp, SuiteAppId } from './apps';
import { comediaIcon, gridIcon } from './icons';

// ─── Suite app switcher ───────────────────────────────────────────────────────
//
// The Comedia mark, pinned to the top-left corner of every app in the suite. It
// opens a menu of the suite's apps below it, with the signed-in account at the
// foot. The current app wears Mail's active treatment: Dark Grey disc, Yellow
// 00 icon. `label` puts the app's name beside the mark, for an app whose nav is
// a sidebar wide enough to carry it (Slides); Mail's 48px rail has no room.
//
// `trigger="grid"` swaps the mark for the grid-circle-plus icon, for an app
// that puts the switcher in its header instead (Mail, Figma 2583:152: top
// right, beside search). `align="right"` opens the menu from the right edge.
//
// Self-contained on purpose — inline styles and literal colours rather than
// this app's tokens — so the same file drops into every app in the suite.

const C = {
  disc:     '#2C2C2C',
  menu:     '#2C2C2C',
  ring:     'rgba(255,255,255,0.14)',
  ringOpen: 'rgba(255,255,255,0.25)',
  rule:     'rgba(255,255,255,0.08)',
  hover:    'rgba(255,255,255,0.05)',
  current:  'rgba(255,255,255,0.07)',
  activeBg: '#0C0C0C',
  activeFg: '#F1E31A',
  hi:       '#FFFFFF',
  mid:      '#B4B4B4',
};

/** An app's home as a path on its own origin: "/", "/outreach", "/?gallery". */
function homePath(url: string | null): string {
  if (!url) return '/';
  try { const u = new URL(url); return u.pathname + u.search; } catch { return '/'; }
}

function mask(src: string, size: number, color: string, opacity = 1): React.CSSProperties {
  return {
    width: size,
    height: size,
    display: 'block',
    background: color,
    opacity,
    WebkitMaskImage: `url("${src}")`,
    maskImage: `url("${src}")`,
    WebkitMaskRepeat: 'no-repeat',
    maskRepeat: 'no-repeat',
    WebkitMaskPosition: 'center',
    maskPosition: 'center',
    WebkitMaskSize: 'contain',
    maskSize: 'contain',
  };
}

export function AppSwitcher({
  apps, current, email = null, label, trigger = 'mark', align = 'left',
}: {
  /** The suite's apps: suiteApps(urls) with this app's addresses. */
  apps: SuiteApp[];
  current: SuiteAppId;
  /** The signed-in account, for the menu's foot. */
  email?: string | null;
  label?: string;
  trigger?: 'mark' | 'grid';
  align?: 'left' | 'right';
}) {
  const [open, setOpen] = useState(false);
  const [hovered, setHovered] = useState<SuiteAppId | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);


  // Outside click and Escape close it; Escape hands focus back to the mark.
  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') { setOpen(false); button.current?.focus(); }
    }
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={root} style={{ position: 'relative' }}>
      <button
        ref={button}
        type="button"
        aria-label="Comedia apps"
        aria-haspopup="menu"
        aria-expanded={open}
        title="Comedia apps"
        onClick={() => setOpen(o => !o)}
        style={trigger === 'grid' ? {
          width: 24,
          height: 24,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 0,
          border: 0,
          background: 'transparent',
          cursor: 'pointer',
          opacity: open ? 0.6 : 1,
          transition: 'opacity 120ms',
        } : {
          height: 32,
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: 0,
          paddingRight: label ? 6 : 0,
          border: 0,
          background: 'transparent',
          color: C.hi,
          font: 'inherit',
          fontSize: 15,
          fontWeight: 600,
          cursor: 'pointer',
        }}
      >
        {trigger === 'grid' ? (
          // Figma: a 19px glyph inset 3.5px in a 24px frame
          <span aria-hidden style={mask(gridIcon, 19, C.hi)} />
        ) : (<>
        <span
          style={{
            width: 32,
            height: 32,
            boxSizing: 'border-box',
            borderRadius: '50%',
            border: `1px solid ${open ? C.ringOpen : C.ring}`,
            background: C.disc,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flex: 'none',
            transition: 'border-color 120ms',
          }}
        >
          <span aria-hidden style={mask(comediaIcon, 15, '#E2E1DB')} />
        </span>
        {label && (
          <>
            {label}
            <svg aria-hidden width="10" height="10" viewBox="0 0 10 10" fill="none" stroke={C.mid} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="m2 3.5 3 3 3-3" />
            </svg>
          </>
        )}
        </>)}
      </button>

      {/* Always rendered, hidden when closed: mask icons only paint once their
          element is laid out, so a menu mounted on open shows empty discs for
          its first frames. `inert` keeps the closed menu out of tab order. */}
      <div
          role="menu"
          aria-label="Comedia apps"
          aria-hidden={!open}
          inert={!open}
          style={{
            opacity: open ? 1 : 0,
            visibility: open ? 'visible' : 'hidden',
            transform: open ? 'none' : 'translateY(-4px)',
            transition: open
              ? 'opacity 120ms, transform 120ms'
              : 'opacity 120ms, transform 120ms, visibility 0s 120ms',
            position: 'absolute',
            ...(align === 'right' ? { right: 0 } : { left: 0 }),
            top: trigger === 'grid' ? 32 : 40,
            width: 300,
            zIndex: 50,
            background: C.menu,
            border: `1px solid ${C.rule}`,
            borderRadius: 16,
            padding: 6,
            boxShadow: '0 24px 48px rgba(0,0,0,0.45)',
          }}
        >
          {apps.map(app => {
            const isCurrent = app.id === current;
            return (
              <a
                key={app.id}
                role="menuitem"
                // No address (Builder in production): shown, but not a link.
                // The current app links to its own home on this origin (Mail's
                // Outreach lives at /outreach).
                href={isCurrent ? homePath(app.url) : app.url ?? undefined}
                aria-disabled={!isCurrent && !app.url ? true : undefined}
                aria-current={isCurrent ? 'page' : undefined}
                onClick={() => setOpen(false)}
                onMouseEnter={() => setHovered(app.id)}
                onMouseLeave={() => setHovered(h => (h === app.id ? null : h))}
                style={{
                  display: 'flex',
                  gap: 12,
                  alignItems: 'center',
                  padding: 10,
                  borderRadius: 10,
                  textDecoration: 'none',
                  color: C.hi,
                  opacity: !isCurrent && !app.url ? 0.5 : 1,
                  cursor: !isCurrent && !app.url ? 'default' : 'pointer',
                  background: isCurrent ? C.current : hovered === app.id ? C.hover : 'transparent',
                }}
              >
                <span
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: '50%',
                    background: C.activeBg,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flex: 'none',
                  }}
                >
                  <span
                    aria-hidden
                    style={mask(app.icon, 16, isCurrent ? C.activeFg : C.hi, isCurrent ? 1 : 0.8)}
                  />
                </span>
                <span style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                  <span style={{ fontWeight: 600, fontSize: 14, lineHeight: 1.4 }}>{app.name}</span>
                  <span style={{ color: C.mid, fontSize: 12, lineHeight: 1.35 }}>{app.url || isCurrent ? app.desc : 'Runs on your machine'}</span>
                </span>
              </a>
            );
          })}

          {email && (
            <div
              style={{
                borderTop: `1px solid ${C.rule}`,
                marginTop: 6,
                padding: '10px 10px 6px',
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                color: C.mid,
                fontSize: 12,
              }}
            >
              <span
                aria-hidden
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: '50%',
                  background: '#5B4A3A',
                  color: C.hi,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 11,
                  fontWeight: 600,
                  flex: 'none',
                }}
              >
                {email[0].toUpperCase()}
              </span>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{email}</span>
            </div>
          )}
      </div>
    </div>
  );
}
