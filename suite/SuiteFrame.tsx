'use client';

import type { ReactNode } from 'react';
import { cn } from '../lib/utils';
import { SidebarProvider, SidebarTrigger } from '../ui/sidebar';
import { TooltipProvider } from '../ui/tooltip';

// ─── The suite's page frame ───────────────────────────────────────────────────
//
// How every app in the suite lays out a page, as Mail's /outreach does: a shadcn
// sidebar on the left (pass a <Sidebar collapsible="none">), and beside it the
// page, which starts with a PageHeader. Full-bleed on the panel colour, no
// shell strip, the app switcher at the right end of the header.

export function SuiteFrame({ sidebar, children, className }: {
  /** A <Sidebar> from @comedia/design-system/ui/sidebar. */
  sidebar: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <TooltipProvider>
      <SidebarProvider data-shadcn-page className={cn('h-svh min-h-0 bg-background text-foreground', className)}>
        {sidebar}
        <div className="flex min-w-0 flex-1 flex-col">{children}</div>
      </SidebarProvider>
    </TooltipProvider>
  );
}

/**
 * The header row every suite page shares: Email's 16px bold title, the count
 * in Grey, a muted line on the right, the page's actions, then the app
 * switcher (pass the app's <AppSwitcher trigger="grid" align="right" />).
 */
export function PageHeader({ title, count, meta, actions, switcher }: {
  title: ReactNode;
  count?: ReactNode;
  meta?: ReactNode;
  actions?: ReactNode;
  switcher?: ReactNode;
}) {
  return (
    <header className="flex shrink-0 items-center gap-3 border-b px-3 py-4 md:px-6">
      <SidebarTrigger className="-ml-1 md:hidden" />
      {/* The title keeps its width; the muted line is what gives way. */}
      <h1 className="shrink-0 text-[16px] font-bold">{title}</h1>
      {count !== undefined && <span className="shrink-0 text-[16px] tabular-nums text-[var(--color-text-off)]">{count}</span>}
      <span className="flex-1" />
      {meta && <span className="hidden min-w-0 truncate text-xs text-muted-foreground md:inline">{meta}</span>}
      {actions}
      {switcher}
    </header>
  );
}
