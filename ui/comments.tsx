'use client';

/**
 * The suite's comment threads: who wrote what, replies, @-mentions,
 * reactions, edit and delete on your own, and resolve. Lifted from Slides
 * (v0.10.0) so Patterns' teardowns use the same threads instead of a copy.
 *
 * This file is the surface and the pure helpers, never the storage. Each app
 * keeps its own table, row security and server actions (Slides' comments hang
 * off decks and workspaces, Patterns' off projects and teardown pages), maps
 * its rows to `SuiteComment`, and passes `ThreadActions` that call its own
 * actions. An action an app leaves out hides its button: Patterns has no
 * reactions, so it passes no `react`.
 *
 * What stays in each app: where a thread sits (Slides' pins and floating
 * card, Patterns' page and screen keys), the panel around the threads, and
 * sign-in.
 */

import * as React from 'react';
import { useEffect, useRef, useState } from 'react';
import { ArrowUp, Check, Pencil, SmilePlus, Trash2, X } from 'lucide-react';
import { tokens } from '../dist/tokens.js';
import { cn } from '../lib/utils';
import { Avatar, AvatarFallback } from './avatar';
import { Button } from './button';
import { Textarea } from './textarea';

// ─── What a comment is ───────────────────────────────────────────────────────

/** One emoji on one comment, and everyone who added it. */
export interface CommentReaction {
  emoji: string;
  emails: string[];
}

/** The fields every app's comment has. Apps extend it with where it sits. */
export interface SuiteComment {
  id: string;
  /** Null = top-level; otherwise the thread root's id (replies stay flat). */
  parentId: string | null;
  /** Lower case, verified by the app's sign-in. */
  authorEmail: string;
  body: string;
  /** Emails this comment @-mentions (the body keeps the visible "@Name"). */
  mentions: string[];
  /** Set when the author changed the text after posting. */
  editedAt: string | null;
  reactions: CommentReaction[];
  resolvedAt: string | null;
  resolvedBy: string | null;
  createdAt: string;
}

/** A top-level comment and its flat replies. */
export interface Thread<C extends SuiteComment = SuiteComment> {
  root: C;
  replies: C[];
}

/** Thread root id -> when the viewer last saw it (ISO). */
export type ThreadReads = Record<string, string>;

/** Someone a comment can @-mention. */
export interface MentionCandidate {
  email: string;
  name: string;
}

// ─── People and time ─────────────────────────────────────────────────────────

/**
 * `chris@comediadesign.com` → "Chris". Anything without an @ (a script's
 * name) is shown as it is.
 */
export function personName(raw: string | null): string | null {
  if (!raw) return null;
  if (!raw.includes('@')) return raw;
  const local = raw.split('@')[0].split(/[._+-]/)[0];
  return local ? local[0].toUpperCase() + local.slice(1) : raw;
}

/** "chris.basey@x" → "Chris Basey". */
export function fullName(email: string): string {
  return email
    .split('@')[0]
    .split(/[._+-]/)
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(' ');
}

/**
 * "Today, 09:18" / "Yesterday, 17:02" / "12 Oct" / "12 Oct 2025". `tz`
 * undefined means the viewer's own zone.
 */
export function timeLabel(iso: string, now: Date, tz?: string): string {
  const d = new Date(iso);
  const day = (x: Date) => x.toLocaleDateString('en-CA', { timeZone: tz });
  const time = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: tz });
  if (day(d) === day(now)) return `Today, ${time}`;
  const yesterday = new Date(now.getTime() - 86_400_000);
  if (day(d) === day(yesterday)) return `Yesterday, ${time}`;
  const sameYear =
    d.toLocaleDateString('en-GB', { year: 'numeric', timeZone: tz }) ===
    now.toLocaleDateString('en-GB', { year: 'numeric', timeZone: tz });
  return d.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: sameYear ? undefined : 'numeric',
    timeZone: tz,
  });
}

// ─── Threads ─────────────────────────────────────────────────────────────────

export function threadsOf<C extends SuiteComment>(comments: C[], match: (root: C) => boolean = () => true): Thread<C>[] {
  return comments
    .filter((c) => !c.parentId && match(c))
    .map((root) => ({ root, replies: comments.filter((c) => c.parentId === root.id) }));
}

/**
 * Thread numbers (#1, #2…), in the order threads were started. Resolved
 * threads keep theirs, so resolving one renumbers nothing.
 */
export function threadNumbers(comments: SuiteComment[]): Map<string, number> {
  const roots = comments.filter((c) => !c.parentId).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  return new Map(roots.map((c, i) => [c.id, i + 1]));
}

/** The newest comment in a thread, for "latest activity first". */
export function lastActivity(t: Thread): string {
  return t.replies.reduce((latest, r) => (r.createdAt > latest ? r.createdAt : latest), t.root.createdAt);
}

/** Everyone who wrote in a thread, starter first. */
export function participants(t: Thread): string[] {
  return [...new Set([t.root.authorEmail, ...t.replies.map((r) => r.authorEmail)])];
}

/**
 * Whether a thread has something the viewer hasn't seen: a comment by
 * someone else, newer than their mark (or any, with no mark).
 */
export function isThreadUnread(comments: SuiteComment[], rootId: string, reads: ThreadReads, viewerEmail: string | null): boolean {
  if (!viewerEmail) return false;
  const me = viewerEmail.toLowerCase();
  const seen = reads[rootId] ? Date.parse(reads[rootId]) : 0;
  return comments.some(
    (c) => (c.id === rootId || c.parentId === rootId) && c.authorEmail !== me && Date.parse(c.createdAt) > seen,
  );
}

// ─── Mentions ────────────────────────────────────────────────────────────────

/**
 * "@Chris" while there's one Chris; "@Chris Basey" once there are two. The
 * name is what the body carries, so it has to tell people apart.
 */
export function namesFor(emails: string[]): MentionCandidate[] {
  const first = (e: string) => personName(e) ?? e;
  const counts = new Map<string, number>();
  for (const e of emails) counts.set(first(e), (counts.get(first(e)) ?? 0) + 1);
  return emails.map((email) => ({
    email,
    name: (counts.get(first(email)) ?? 0) > 1 ? fullName(email) : first(email),
  }));
}

/** Every way a body might name this person after "@". */
export function mentionNames(email: string): string[] {
  return [...new Set([fullName(email), personName(email) ?? email])];
}

function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** The mentionable emails in a body: "@Name" tokens matched against candidates. */
export function mentionsIn(body: string, candidates: MentionCandidate[]): string[] {
  const found = new Set<string>();
  for (const c of candidates) {
    const at = new RegExp(`(^|[^\\w@])@${escapeRegExp(c.name)}(?![\\w])`, 'i');
    if (at.test(body)) found.add(c.email);
  }
  return [...found];
}

/** A body split into plain text and the "@Name" runs that mention someone. */
export function mentionRuns(body: string, mentions: string[]): { text: string; mention: boolean }[] {
  const names = mentions.flatMap(mentionNames).sort((a, b) => b.length - a.length);
  if (names.length === 0) return [{ text: body, mention: false }];
  const pattern = new RegExp(`@(?:${names.map(escapeRegExp).join('|')})(?![\\w])`, 'gi');
  const runs: { text: string; mention: boolean }[] = [];
  let last = 0;
  for (const m of body.matchAll(pattern)) {
    if (m.index > last) runs.push({ text: body.slice(last, m.index), mention: false });
    runs.push({ text: m[0], mention: true });
    last = m.index + m[0].length;
  }
  if (last < body.length) runs.push({ text: body.slice(last), mention: false });
  return runs;
}

// ─── Avatars ─────────────────────────────────────────────────────────────────

/** A token as a CSS var with its resolved value as the fallback. */
function tok(name: string): string {
  const value = (tokens as Record<string, string>)[name];
  return value ? `var(--${name}, ${value})` : `var(--${name})`;
}

/**
 * One colour per person, from the tokens (no new colours). Picked by a hash
 * of the email, so a person is the same colour everywhere.
 */
const TONES: { bg: string; fg: string }[] = [
  { bg: 'color-accent', fg: '#fff' },
  { bg: 'color-success', fg: '#fff' },
  { bg: 'color-warmth-hot', fg: '#fff' },
  { bg: 'color-link', fg: '#fff' },
  { bg: 'color-warning', fg: '#000' },
];

function toneIndex(email: string): number {
  let h = 0;
  for (const ch of email.toLowerCase()) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return h % TONES.length;
}

/** A person's colour as a CSS value, for outlines and tags. */
export function toneColorFor(email: string): string {
  return tok(TONES[toneIndex(email)].bg);
}

export function initialOf(email: string): string {
  return (personName(email) ?? email).charAt(0).toUpperCase();
}

/** A person's initial in their colour. */
export function CommentAvatar({ email, size = 'md', className }: { email: string; size?: 'sm' | 'md'; className?: string }) {
  const tone = TONES[toneIndex(email)];
  return (
    <Avatar title={personName(email) ?? email} className={cn(size === 'sm' ? 'size-5' : 'size-6', className)}>
      <AvatarFallback className="text-[11px] font-semibold" style={{ background: tok(tone.bg), color: tone.fg }}>
        {initialOf(email)}
      </AvatarFallback>
    </Avatar>
  );
}

/** Up to three participants, overlapping, starter first. */
export function AvatarStack({ emails, ringClassName = 'ring-background' }: { emails: string[]; ringClassName?: string }) {
  return (
    <span className="flex -space-x-1.5">
      {emails.slice(0, 3).map((e) => (
        <CommentAvatar key={e} email={e} className={cn('ring-2', ringClassName)} />
      ))}
    </span>
  );
}

/** A comment body with its @-mentions picked out. Plain text otherwise. */
export function MentionText({ body, mentions, className }: { body: string; mentions: string[]; className?: string }) {
  return (
    <p className={cn('text-sm whitespace-pre-wrap break-words', className)}>
      {mentionRuns(body, mentions).map((run, i) =>
        run.mention ? (
          <span key={i} className="font-medium text-primary">
            {run.text}
          </span>
        ) : (
          run.text
        ),
      )}
    </p>
  );
}

// ─── The comment box ─────────────────────────────────────────────────────────

/** The text after an "@" the caret is still inside, if any. */
function mentionQuery(text: string, caret: number): { start: number; query: string } | null {
  const before = text.slice(0, caret);
  const m = /(^|\s)@([^\s@][^@\n]{0,30}|)$/.exec(before);
  if (!m) return null;
  return { start: caret - m[2].length - 1, query: m[2] };
}

/**
 * A comment box: Enter sends, Shift+Enter breaks the line, and "@" opens a
 * picker of the people who can be mentioned. Picking one writes "@Name" into
 * the text; on send, the mentions are whichever picked names are still there.
 */
export function CommentComposer({
  candidates = [],
  placeholder,
  submitLabel = 'Send',
  initialText = '',
  initialMentions = [],
  busy = false,
  autoFocus = false,
  rows = 2,
  onSubmit,
  onCancel,
  textareaRef,
  className,
}: {
  candidates?: MentionCandidate[];
  placeholder: string;
  submitLabel?: string;
  initialText?: string;
  /** An edited comment's mentions, so saving keeps the ones still named. */
  initialMentions?: string[];
  busy?: boolean;
  autoFocus?: boolean;
  rows?: number;
  /** Resolves true when the comment landed; the box then clears. */
  onSubmit: (text: string, mentions: string[]) => Promise<boolean>;
  /** Escape, with no picker open. */
  onCancel?: () => void;
  textareaRef?: React.RefObject<HTMLTextAreaElement | null>;
  className?: string;
}) {
  const [text, setText] = useState(initialText);
  const [picked, setPicked] = useState<Set<string>>(() => new Set(initialMentions));
  const [query, setQuery] = useState<{ start: number; query: string } | null>(null);
  const [active, setActive] = useState(0);
  const ownRef = useRef<HTMLTextAreaElement>(null);
  const ref = textareaRef ?? ownRef;

  // Editing: the caret starts at the end of the text, not before it.
  useEffect(() => {
    const el = ref.current;
    if (autoFocus && el && initialText) el.setSelectionRange(initialText.length, initialText.length);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const matches = query
    ? candidates
        .filter((c) => {
          const q = query.query.toLowerCase();
          return c.name.toLowerCase().startsWith(q) || c.email.startsWith(q) || c.name.toLowerCase().includes(` ${q}`);
        })
        .slice(0, 6)
    : [];
  const menuOpen = query !== null && matches.length > 0;

  const track = (value: string, caret: number) => {
    setText(value);
    setQuery(mentionQuery(value, caret));
    setActive(0);
  };

  const choose = (c: MentionCandidate) => {
    if (!query) return;
    const el = ref.current;
    const caret = el?.selectionStart ?? text.length;
    const insert = `@${c.name} `;
    const next = text.slice(0, query.start) + insert + text.slice(caret);
    setText(next);
    setPicked((p) => new Set(p).add(c.email));
    setQuery(null);
    const at = query.start + insert.length;
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(at, at);
    });
  };

  const send = async () => {
    const value = text.trim();
    if (!value || busy) return;
    const mentions = mentionsIn(value, candidates.filter((c) => picked.has(c.email)));
    if (await onSubmit(value, mentions)) {
      setText('');
      setPicked(new Set());
    }
  };

  return (
    <form
      className={cn('relative', className)}
      onSubmit={(e) => {
        e.preventDefault();
        void send();
      }}
    >
      <Textarea
        ref={ref}
        autoFocus={autoFocus}
        rows={rows}
        maxLength={4000}
        placeholder={placeholder}
        value={text}
        onChange={(e) => track(e.target.value, e.target.selectionStart)}
        onClick={(e) => setQuery(mentionQuery(text, e.currentTarget.selectionStart))}
        onKeyDown={(e) => {
          if (menuOpen) {
            if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
              e.preventDefault();
              setActive((i) => (i + (e.key === 'ArrowDown' ? 1 : matches.length - 1)) % matches.length);
              return;
            }
            if (e.key === 'Enter' || e.key === 'Tab') {
              e.preventDefault();
              choose(matches[active]);
              return;
            }
            if (e.key === 'Escape') {
              e.preventDefault();
              e.stopPropagation();
              setQuery(null);
              return;
            }
          }
          if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
            e.preventDefault();
            void send();
            return;
          }
          if (e.key === 'Escape' && onCancel) {
            e.preventDefault();
            onCancel();
          }
        }}
        className="min-h-0 resize-none bg-background pr-10 text-sm"
      />
      <Button
        type="submit"
        size="icon"
        aria-label={submitLabel}
        title={`${submitLabel} (Enter)`}
        disabled={busy || !text.trim()}
        className="absolute right-1.5 bottom-1.5 size-7 rounded-full"
      >
        <ArrowUp />
      </Button>
      {menuOpen && (
        <ul
          role="listbox"
          aria-label="People to mention"
          className="absolute bottom-full left-0 z-50 mb-1 grid w-full gap-0.5 rounded-lg border border-border bg-popover p-1 text-popover-foreground shadow-md"
        >
          {matches.map((c, i) => (
            <li key={c.email} role="option" aria-selected={i === active}>
              <button
                type="button"
                className={cn('flex w-full items-center gap-2 rounded px-2 py-1 text-left text-[13px]', i === active ? 'bg-muted' : 'hover:bg-muted/60')}
                onMouseDown={(e) => {
                  // Keep the textarea's caret: choose before it blurs.
                  e.preventDefault();
                  choose(c);
                }}
              >
                <CommentAvatar email={c.email} size="sm" />
                <span className="font-medium">{c.name}</span>
                <span className="min-w-0 truncate text-muted-foreground">{c.email}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </form>
  );
}

// ─── A thread ────────────────────────────────────────────────────────────────

/** The quick reactions offered on every comment. Any emoji is storable. */
export const QUICK_REACTIONS = ['👍', '👀', '✅', '🎉', '❤️', '😂'];

/** Each resolves true when the write landed. Leave one out to hide its button. */
export interface ThreadActions {
  reply: (text: string, mentions: string[]) => Promise<boolean>;
  resolve?: (resolved: boolean) => Promise<boolean>;
  edit?: (id: string, text: string, mentions: string[]) => Promise<boolean>;
  remove?: (id: string) => Promise<boolean>;
  react?: (id: string, emoji: string) => Promise<boolean>;
}

/**
 * One thread: its comments, a reply box, and resolve.
 *
 * `variant="card"` (Slides' floating card and rail) has a header row and
 * rules between the parts; `variant="plain"` (Patterns' teardown pages, where
 * hierarchy comes from size, weight and space, not boxes) has neither, and
 * puts the label and resolve on the first line.
 *
 * `canModerate`: may resolve anyone's thread and delete anyone's comment
 * (Slides' editors, Patterns' staff). Authors may always resolve their own
 * thread and edit or delete their own comments.
 */
export function ThreadView<C extends SuiteComment>({
  thread,
  label,
  viewerEmail,
  canModerate = false,
  candidates = [],
  busy = false,
  actions,
  onClose,
  autoFocusReply = false,
  signedOut = 'Sign in to reply.',
  variant = 'card',
  className,
}: {
  thread: Thread<C>;
  /** "#4 · Slide 3", "Screen 2". Shown in the header. */
  label?: React.ReactNode;
  viewerEmail: string | null;
  canModerate?: boolean;
  candidates?: MentionCandidate[];
  busy?: boolean;
  actions: ThreadActions;
  onClose?: () => void;
  autoFocusReply?: boolean;
  /** What a signed-out reader sees where the reply box would be. */
  signedOut?: React.ReactNode;
  variant?: 'card' | 'plain';
  className?: string;
}) {
  const me = viewerEmail?.toLowerCase() ?? null;
  const canResolve = Boolean(actions.resolve) && Boolean(me) && (canModerate || thread.root.authorEmail === me);
  const resolved = Boolean(thread.root.resolvedAt);
  const card = variant === 'card';
  const [replying, setReplying] = useState(card);

  const header = (label || canResolve || onClose) && (
    <div className={cn('flex items-center gap-1', card && 'border-b border-border px-3 py-2')}>
      <span className={cn('min-w-0 flex-1 truncate', card ? 'text-[13px] font-medium' : 'text-[13px] text-muted-foreground')}>
        {label}
        {resolved && <span className={cn('text-[11px] tracking-[0.16em] text-muted-foreground uppercase', label && 'ml-2')}>Resolved</span>}
      </span>
      {canResolve && (
        <Button
          variant="ghost"
          size="icon"
          className={cn('size-7', resolved && 'text-primary')}
          title={resolved ? 'Reopen' : 'Resolve'}
          aria-label={resolved ? 'Reopen thread' : 'Resolve thread'}
          disabled={busy}
          onClick={() => void actions.resolve!(!resolved)}
        >
          <Check />
        </Button>
      )}
      {onClose && (
        <Button variant="ghost" size="icon" className="size-7" aria-label="Close thread" onClick={onClose}>
          <X />
        </Button>
      )}
    </div>
  );

  const reply = !me ? (
    <p className="text-[13px] text-muted-foreground">{signedOut}</p>
  ) : resolved ? (
    <p className="text-[13px] text-muted-foreground">Resolved. Reopen it to reply.</p>
  ) : card || replying ? (
    <CommentComposer
      candidates={candidates}
      placeholder={candidates.length ? 'Reply… (@ to mention)' : 'Reply…'}
      submitLabel="Reply"
      busy={busy}
      autoFocus={autoFocusReply || !card}
      rows={1}
      onSubmit={async (text, mentions) => {
        const ok = await actions.reply(text, mentions);
        if (ok && !card) setReplying(false);
        return ok;
      }}
      onCancel={card ? onClose : () => setReplying(false)}
    />
  ) : (
    <button type="button" className="text-[13px] text-muted-foreground hover:text-foreground" onClick={() => setReplying(true)}>
      Reply
    </button>
  );

  return (
    <div className={cn('flex min-h-0 flex-col', !card && 'gap-2', className)}>
      {header}
      <div className={cn('grid min-h-0 gap-3', card && 'overflow-y-auto px-3 py-3', resolved && !card && 'opacity-70')}>
        {[thread.root, ...thread.replies].map((c) => (
          <Message key={c.id} comment={c} me={me} canModerate={canModerate} candidates={candidates} busy={busy} actions={actions} />
        ))}
      </div>
      <div className={cn(card ? 'border-t border-border px-3 py-3' : 'pl-8')}>{reply}</div>
    </div>
  );
}

/** A box for starting a thread: just a composer beside your avatar. */
export function NewThreadView({
  label,
  viewerEmail,
  candidates = [],
  busy = false,
  onCreate,
  onCancel,
  signedOut = 'Sign in to leave a comment.',
  placeholder,
  variant = 'card',
  className,
}: {
  label?: React.ReactNode;
  viewerEmail: string | null;
  candidates?: MentionCandidate[];
  busy?: boolean;
  onCreate: (text: string, mentions: string[]) => Promise<boolean>;
  onCancel?: () => void;
  signedOut?: React.ReactNode;
  placeholder?: string;
  variant?: 'card' | 'plain';
  className?: string;
}) {
  const card = variant === 'card';
  return (
    <div className={cn('flex flex-col', !card && 'gap-2', className)}>
      {(label || (card && onCancel)) && (
        <div className={cn('flex items-center gap-1', card && 'border-b border-border px-3 py-2')}>
          <span className={cn('flex-1', card ? 'text-[13px] font-medium' : 'text-[13px] text-muted-foreground')}>{label}</span>
          {card && onCancel && (
            <Button variant="ghost" size="icon" className="size-7" aria-label="Cancel comment" onClick={onCancel}>
              <X />
            </Button>
          )}
        </div>
      )}
      <div className={cn(card && 'px-3 py-3')}>
        {viewerEmail ? (
          <div className="grid grid-cols-[24px_1fr] gap-2">
            <CommentAvatar email={viewerEmail} />
            <CommentComposer
              candidates={candidates}
              placeholder={placeholder ?? (candidates.length ? 'Add a comment… (@ to mention)' : 'Add a comment…')}
              submitLabel="Comment"
              busy={busy}
              autoFocus={card}
              onSubmit={onCreate}
              onCancel={onCancel}
            />
          </div>
        ) : (
          <p className="text-[13px] text-muted-foreground">{signedOut}</p>
        )}
      </div>
    </div>
  );
}

function Message({
  comment: c,
  me,
  canModerate,
  candidates,
  busy,
  actions,
}: {
  comment: SuiteComment;
  me: string | null;
  canModerate: boolean;
  candidates: MentionCandidate[];
  busy: boolean;
  actions: ThreadActions;
}) {
  const [editing, setEditing] = useState(false);
  const [picking, setPicking] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const mine = me !== null && c.authorEmail === me;
  const canEdit = mine && Boolean(actions.edit);
  const canRemove = (mine || canModerate) && Boolean(actions.remove);
  const canReact = Boolean(actions.react);

  return (
    <div className="group/msg grid grid-cols-[24px_1fr] gap-x-2 gap-y-1">
      <CommentAvatar email={c.authorEmail} />
      <div className="flex min-w-0 items-center gap-2">
        <span className="truncate text-[13px] font-medium" title={canModerate ? c.authorEmail : undefined}>
          {personName(c.authorEmail)}
        </span>
        <span className="shrink-0 text-[13px] text-muted-foreground">
          {timeLabel(c.createdAt, new Date())}
          {c.editedAt && ' · edited'}
        </span>
        <span className="flex-1" />
        {me && !editing && (canReact || canEdit || canRemove) && (
          <span className="flex shrink-0 items-center opacity-0 transition-opacity group-hover/msg:opacity-100 focus-within:opacity-100">
            {canReact && (
              <Button variant="ghost" size="icon" className="size-6" aria-label="Add reaction" title="React" onClick={() => setPicking((v) => !v)}>
                <SmilePlus />
              </Button>
            )}
            {canEdit && (
              <Button variant="ghost" size="icon" className="size-6" aria-label="Edit comment" title="Edit" onClick={() => setEditing(true)}>
                <Pencil />
              </Button>
            )}
            {canRemove && (
              <Button
                variant="ghost"
                size="icon"
                className={cn('size-6', confirmDelete && 'text-destructive')}
                aria-label={confirmDelete ? 'Click again to delete' : 'Delete comment'}
                title={confirmDelete ? 'Click again to delete' : 'Delete'}
                disabled={busy}
                onClick={() => {
                  if (!confirmDelete) return setConfirmDelete(true);
                  setConfirmDelete(false);
                  void actions.remove!(c.id);
                }}
                onBlur={() => setConfirmDelete(false)}
              >
                <Trash2 />
              </Button>
            )}
          </span>
        )}
      </div>

      <div className="col-start-2 grid gap-2">
        {editing ? (
          <CommentComposer
            candidates={candidates}
            placeholder="Edit your comment…"
            submitLabel="Save"
            initialText={c.body}
            initialMentions={c.mentions}
            busy={busy}
            autoFocus
            onSubmit={async (text, mentions) => {
              const ok = await actions.edit!(c.id, text, mentions);
              if (ok) setEditing(false);
              return ok;
            }}
            onCancel={() => setEditing(false)}
          />
        ) : (
          <MentionText body={c.body} mentions={c.mentions} />
        )}

        {picking && canReact && (
          <div className="flex gap-0.5" role="group" aria-label="Quick reactions">
            {QUICK_REACTIONS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                className="rounded px-1 text-base hover:bg-muted"
                aria-label={`React ${emoji}`}
                onClick={() => {
                  setPicking(false);
                  void actions.react!(c.id, emoji);
                }}
              >
                {emoji}
              </button>
            ))}
          </div>
        )}

        {c.reactions.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {c.reactions.map((r) => {
              const reacted = me !== null && r.emails.includes(me);
              return (
                <button
                  key={r.emoji}
                  type="button"
                  disabled={!me || busy || !canReact}
                  title={r.emails.map((e) => personName(e)).join(', ')}
                  aria-pressed={reacted}
                  className={cn(
                    'flex items-center gap-1 rounded-full border px-1.5 text-[13px] tabular-nums',
                    reacted ? 'border-primary bg-primary/15' : 'border-border hover:border-muted-foreground/50',
                  )}
                  onClick={() => void actions.react?.(c.id, r.emoji)}
                >
                  <span className="text-sm">{r.emoji}</span>
                  {r.emails.length}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
