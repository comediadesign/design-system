// ─── The Comedia suite's apps ─────────────────────────────────────────────────
//
// What the app switcher lists. Each app builds the list with suiteApps(), giving
// the addresses it knows (from its own env), so the names, descriptions and
// icons stay in one place.

import { mailIcon, outreachIcon, slidesIcon, patternsIcon, builderIcon } from './icons';

export type SuiteAppId = 'mail' | 'outreach' | 'slides' | 'patterns' | 'builder';

export interface SuiteApp {
  id: SuiteAppId;
  name: string;
  desc: string;
  /** Null when the app has no address here (Builder only runs locally). */
  url: string | null;
  /** A mask image: data URI or path. */
  icon: string;
}

export interface SuiteUrls {
  mail: string;
  slides: string | null;
  patterns: string | null;
  builder: string | null;
}

/** Live addresses. */
export const PRODUCTION_URLS: SuiteUrls = {
  mail: 'https://comedia-email.vercel.app',
  slides: 'https://comedia-deck-system.vercel.app',
  patterns: 'https://concept-prototypes.vercel.app/?gallery',
  builder: null,
};

/** The local dev ports of the suite worktrees. */
export const LOCAL_URLS: SuiteUrls = {
  mail: 'http://localhost:3101',
  slides: 'http://localhost:3102',
  patterns: 'http://localhost:8543/?gallery',
  builder: 'http://localhost:8545',
};

/** The suite's apps at these addresses. Outreach is a page of Mail. */
export function suiteApps(urls: SuiteUrls): SuiteApp[] {
  return [
    { id: 'mail', name: 'Mail', desc: 'Inbox, tasks and contacts', url: urls.mail, icon: mailIcon },
    { id: 'outreach', name: 'Outreach', desc: 'Love letters, follow-ups and prospects', url: `${urls.mail}/outreach`, icon: outreachIcon },
    { id: 'slides', name: 'Slides', desc: 'Decks, templates and guidelines', url: urls.slides, icon: slidesIcon },
    { id: 'patterns', name: 'Patterns', desc: 'Component library and concept prototypes', url: urls.patterns, icon: patternsIcon },
    { id: 'builder', name: 'Builder', desc: 'Generate screens and flows from a brief', url: urls.builder, icon: builderIcon },
  ];
}
