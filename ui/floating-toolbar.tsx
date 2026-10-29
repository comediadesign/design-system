'use client';

/**
 * The suite's floating text-format toolbar: the pill that appears over a text
 * selection in anything editable — Mail's composer, Slides' edit-in-place.
 *
 * This file exports the surface, not the commands. What the buttons DO stays
 * per app: Mail writes real HTML (an email body is HTML), Slides folds every
 * edit down to its plain-text markup (its database never stores HTML). Each
 * app renders its own buttons into <FloatingToolbar> and wires its own
 * actions; `useSelectionToolbar` supplies the when and where.
 *
 * Self-contained on purpose: inline styles over the design tokens, with the
 * resolved values as fallbacks, so an app gets the suite look from the import
 * alone — before it adopts theme.css, and with no ui.css entry to ship.
 */

import * as React from 'react';
import { useEffect, useState } from 'react';
import { tokens } from '../dist/tokens.js';

/** A token as a CSS var with its resolved value as the fallback. */
function tok(name: string): string {
  const value = (tokens as Record<string, string>)[name];
  return value ? `var(--${name}, ${value})` : `var(--${name})`;
}

// ─── Where and when the pill shows ───────────────────────────────────────────

export interface SelectionAnchor {
  /** Selection midpoint in viewport px — hand straight to <FloatingToolbar>. */
  x: number;
  y: number;
  /** The editable the selection lives in (what `resolve` returned). */
  container: HTMLElement;
}

/**
 * Tracks the document selection and yields an anchor while a non-collapsed
 * selection sits inside an editable that `resolve` recognises (pass a stable
 * function — `closestEditable` + useMemo, or a useCallback). `frozen` keeps
 * the last anchor while e.g. the link input is open and steals the selection.
 */
export function useSelectionToolbar(
  resolve: (node: Node) => HTMLElement | null,
  frozen = false,
): SelectionAnchor | null {
  const [anchor, setAnchor] = useState<SelectionAnchor | null>(null);

  useEffect(() => {
    if (frozen) return;
    function onSelectionChange() {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed || !sel.anchorNode) {
        setAnchor(null);
        return;
      }
      const container = resolve(sel.anchorNode);
      if (!container) {
        setAnchor(null);
        return;
      }
      const rect = sel.getRangeAt(0).getBoundingClientRect();
      if (rect.width < 2) {
        setAnchor(null);
        return;
      }
      setAnchor({ x: rect.left + rect.width / 2, y: rect.top, container });
    }
    document.addEventListener('selectionchange', onSelectionChange);
    return () => document.removeEventListener('selectionchange', onSelectionChange);
  }, [resolve, frozen]);

  return anchor;
}

/** A `resolve` for the common case: nearest ancestor matching `selector`. */
export function closestEditable(selector: string): (node: Node) => HTMLElement | null {
  return (node) => {
    const el = node instanceof Element ? node : node.parentElement;
    return (el?.closest(selector) as HTMLElement | null) ?? null;
  };
}

// ─── The pill ────────────────────────────────────────────────────────────────

export function FloatingToolbar({
  x,
  y,
  clamp = 60,
  children,
}: {
  x: number;
  y: number;
  /** Half the pill's width in px, so it stays on screen at the edges. */
  clamp?: number;
  children: React.ReactNode;
}) {
  const left = Math.max(clamp, Math.min(x, window.innerWidth - clamp));
  const above = y > 60;
  const top = above ? y - 44 : y + 28;

  return (
    <div
      role="toolbar"
      aria-label="Text formatting"
      style={{
        position: 'fixed',
        left,
        top,
        transform: 'translateX(-50%)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        gap: '1px',
        padding: '3px',
        background: tok('color-elevated'),
        border: `1px solid ${tok('color-border')}`,
        borderRadius: '8px',
        boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
      }}
    >
      {children}
    </div>
  );
}

export function ToolbarButton({
  onClick,
  title,
  highlight,
  active,
  style,
  children,
}: {
  onClick: () => void;
  title: string;
  /** Accent-coloured (the AI sparkle). */
  highlight?: boolean;
  /** Pressed state, e.g. the caret is already inside bold text. */
  active?: boolean;
  style?: React.CSSProperties;
  children: React.ReactNode;
}) {
  const [hover, setHover] = useState(false);
  return (
    <button
      type="button"
      title={title}
      // preventDefault keeps focus (and the selection) in the editable, so
      // each app's save-on-blur stays its only save path.
      onMouseDown={(e) => {
        e.preventDefault();
        onClick();
      }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 30,
        height: 30,
        padding: 0,
        border: 'none',
        borderRadius: 6,
        cursor: 'pointer',
        background: hover || active ? 'rgba(255,255,255,0.06)' : 'transparent',
        color: highlight ? tok('color-accent') : tok('color-text-mid'),
        fontSize: 13,
        transition: 'background 0.1s',
        ...style,
      }}
    >
      {children}
    </button>
  );
}

export function ToolbarDivider() {
  return <div style={{ width: 1, height: 16, background: tok('color-border'), margin: '0 2px' }} />;
}

// ─── The link input (the pill's second mode) ─────────────────────────────────

export function FloatingLinkInput({
  x,
  y,
  value,
  onChange,
  onConfirm,
  onCancel,
  inputRef,
  placeholder = 'Paste or type a link…',
}: {
  x: number;
  y: number;
  value: string;
  onChange: (v: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
  inputRef: React.RefObject<HTMLInputElement | null>;
  placeholder?: string;
}) {
  const left = Math.max(130, Math.min(x, window.innerWidth - 130));
  const above = y > 60;
  const top = above ? y - 44 : y + 28;

  return (
    <div
      style={{
        position: 'fixed',
        left,
        top,
        transform: 'translateX(-50%)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        padding: '4px 6px 4px 10px',
        background: tok('color-elevated'),
        border: `1px solid ${tok('color-border')}`,
        borderRadius: '8px',
        boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
        minWidth: '260px',
      }}
    >
      <span style={{ color: tok('color-link'), flexShrink: 0, lineHeight: 0 }}>
        <LinkIcon />
      </span>
      <input
        ref={inputRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            onConfirm();
          }
          if (e.key === 'Escape') {
            e.preventDefault();
            onCancel();
          }
        }}
        placeholder={placeholder}
        style={{
          flex: 1,
          background: 'transparent',
          border: 'none',
          outline: 'none',
          color: tok('color-text-hi'),
          fontSize: '13px',
          caretColor: tok('color-link'),
          minWidth: 0,
        }}
      />
      <button
        type="button"
        onMouseDown={(e) => {
          e.preventDefault();
          onConfirm();
        }}
        disabled={!value.trim()}
        style={{
          background: tok('color-link'),
          color: tok('color-on-accent'),
          fontSize: '12px',
          fontWeight: 600,
          padding: '3px 10px',
          borderRadius: '5px',
          border: 'none',
          cursor: value.trim() ? 'pointer' : 'default',
          opacity: value.trim() ? 1 : 0.3,
          flexShrink: 0,
        }}
      >
        Apply
      </button>
      <button
        type="button"
        onMouseDown={(e) => {
          e.preventDefault();
          onCancel();
        }}
        style={{
          background: 'transparent',
          border: 'none',
          color: tok('color-text-dim'),
          fontSize: '16px',
          lineHeight: 1,
          cursor: 'pointer',
          flexShrink: 0,
          padding: '0 2px',
        }}
      >
        ×
      </button>
    </div>
  );
}

// ─── Icons ───────────────────────────────────────────────────────────────────

export function LinkIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 15 15" fill="none">
      <path
        d="M5.5 9.5l4-4M6.5 4.5l1-1a3.182 3.182 0 114.5 4.5l-1 1M8.5 10.5l-1 1a3.182 3.182 0 01-4.5-4.5l1-1"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function BulletListIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <circle cx="2" cy="4" r="1.2" fill="currentColor" />
      <circle cx="2" cy="7" r="1.2" fill="currentColor" />
      <circle cx="2" cy="10" r="1.2" fill="currentColor" />
      <path d="M5 4h7M5 7h7M5 10h7" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

export function BlockquoteIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path d="M2 3h10M2 7h7M2 11h8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      <rect x="0.5" y="2" width="0.75" height="10" rx="0.3" fill="currentColor" opacity="0.5" />
    </svg>
  );
}

export function SparkleIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
      <path
        d="M6.5 1v2.5M6.5 9.5V12M1 6.5h2.5M9.5 6.5H12M2.5 2.5l1.75 1.75M8.75 8.75l1.75 1.75M2.5 10.5l1.75-1.75M8.75 4.25l1.75-1.75"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function BoldIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path
        d="M4.25 2.5h3a2.25 2.25 0 010 4.5h-3zM4.25 7h3.5a2.25 2.25 0 010 4.5h-3.5z"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function ItalicIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path
        d="M6 2.5h4.5M3.5 11.5H8M8.75 2.5l-3.5 9"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
    </svg>
  );
}
