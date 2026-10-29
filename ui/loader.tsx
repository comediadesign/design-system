'use client';

/**
 * The suite's loading animation: the ninja panda running its karate loop
 * (animated WebP, transparent, built from the brand character — see the
 * character-loader-gif pipeline).
 *
 * Three pieces, used together or alone:
 *
 * - `useDelayedLoading(loading)` — the flash guards. A loader that appears for
 *   a 200ms fetch reads as jank, so nothing shows until `delay` (300ms) has
 *   passed; and a loader that vanishes the frame after it appeared reads as a
 *   glitch, so once shown it stays for `minVisible` (600ms). Render the
 *   loader from this hook's value, never from the raw loading flag.
 * - `<SuiteLoader>` — the animation itself, with a static poster frame for
 *   prefers-reduced-motion.
 * - `<PandaPull>` — the pull-to-refresh indicator for mobile: scrubs the loop
 *   with pull progress, plays it while refreshing. The host owns the gesture;
 *   this renders the character.
 */

import * as React from 'react';
import { cn } from '../lib/utils';
import panda200 from '../assets/loader/panda-200.webp';
import panda120 from '../assets/loader/panda-120.webp';
import poster200 from '../assets/loader/panda-poster-200.png';
import poster120 from '../assets/loader/panda-poster-120.png';
import strip120 from '../assets/loader/panda-strip-120.webp';

const STRIP_FRAMES = 32;
const STRIP_FRAME_W = 144;
const STRIP_FRAME_H = 120;
const LOOP_FPS = 16;

function assetSrc(a: string | { src: string }): string {
  return typeof a === 'string' ? a : a.src;
}

function usePrefersReducedMotion() {
  const [reduced, setReduced] = React.useState(false);
  React.useEffect(() => {
    const mql = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(mql.matches);
    const onChange = () => setReduced(mql.matches);
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, []);
  return reduced;
}

/**
 * Flash-guarded loading state. `visible` goes true only after `delay` ms of
 * continuous loading, and once true stays for at least `minVisible` ms.
 * Defaults mean: loads under ~300ms show nothing at all.
 */
export function useDelayedLoading(
  loading: boolean,
  { delay = 300, minVisible = 600 }: { delay?: number; minVisible?: number } = {},
): boolean {
  const [visible, setVisible] = React.useState(false);
  const shownAt = React.useRef(0);

  React.useEffect(() => {
    let t: ReturnType<typeof setTimeout>;
    if (loading && !visible) {
      t = setTimeout(() => {
        shownAt.current = Date.now();
        setVisible(true);
      }, delay);
    } else if (!loading && visible) {
      const left = minVisible - (Date.now() - shownAt.current);
      if (left <= 0) setVisible(false);
      else t = setTimeout(() => setVisible(false), left);
    }
    return () => clearTimeout(t);
  }, [loading, visible, delay, minVisible]);

  return visible;
}

export interface SuiteLoaderProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Rendered height in px. The 200px asset is used above 140. */
  size?: number;
  /** One short line under the character, e.g. "Loading deck…". */
  label?: string;
}

export function SuiteLoader({ size = 120, label, className, ...props }: SuiteLoaderProps) {
  const reduced = usePrefersReducedMotion();
  const big = size > 140;
  const src = assetSrc(reduced ? (big ? poster200 : poster120) : big ? panda200 : panda120);
  return (
    <div
      data-slot="suite-loader"
      role="status"
      aria-live="polite"
      className={cn('flex flex-col items-center gap-2', className)}
      {...props}
    >
      <img src={src} height={size} style={{ height: size, width: 'auto' }} alt="" />
      {label ? <span className="text-[13px] opacity-60">{label}</span> : null}
      <span className="sr-only">{label ?? 'Loading'}</span>
    </div>
  );
}

export interface PandaPullProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Pull progress 0→1 (clamp before passing); scrubs through the loop. */
  progress: number;
  /** While true, the loop plays on its own (release / refresh in flight). */
  refreshing?: boolean;
  /** Rendered height in px. */
  size?: number;
}

export function PandaPull({ progress, refreshing = false, size = 56, className, style, ...props }: PandaPullProps) {
  // Reduced motion: the scrub still tracks the pull — it is 1:1 with the
  // user's own finger, like a scrollbar, not autonomous motion. Only the
  // self-playing refresh loop is calmed: a gentle opacity pulse on a static
  // frame instead of the karate playback.
  const reduced = usePrefersReducedMotion();
  const [playFrame, setPlayFrame] = React.useState(0);
  const [dimmed, setDimmed] = React.useState(false);

  React.useEffect(() => {
    if (!refreshing) return;
    if (reduced) {
      const t = setInterval(() => setDimmed((d) => !d), 900);
      return () => { clearInterval(t); setDimmed(false); };
    }
    const t = setInterval(
      () => setPlayFrame((f) => (f + 1) % STRIP_FRAMES),
      1000 / LOOP_FPS,
    );
    return () => clearInterval(t);
  }, [refreshing, reduced]);

  const frame = refreshing
    ? (reduced ? 0 : playFrame)
    : Math.min(STRIP_FRAMES - 1, Math.max(0, Math.round(progress * (STRIP_FRAMES - 1))));
  const h = size;
  const w = (size * STRIP_FRAME_W) / STRIP_FRAME_H;
  return (
    <div
      data-slot="panda-pull"
      aria-hidden="true"
      className={className}
      style={{
        width: w,
        height: h,
        backgroundImage: `url(${assetSrc(strip120)})`,
        backgroundSize: `${w * STRIP_FRAMES}px ${h}px`,
        backgroundPosition: `${-frame * w}px 0`,
        backgroundRepeat: 'no-repeat',
        opacity: dimmed ? 0.45 : 1,
        transition: 'opacity 0.8s ease-in-out',
        ...style,
      }}
      {...props}
    />
  );
}
