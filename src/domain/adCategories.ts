/**
 * THE AD POLICY, AS DATA — ADR-008 clause D · SCRUM-63
 *
 * ADR-008 (accepted 2026-10-05) locks advertising as **post-ritual only** and sets the
 * categories to a **strong NO** for gambling, loans and alcohol — with the compliance
 * detail split to SCRUM-63. It also states the no-in-ritual rule *"is a rule a designer
 * can break by accident; it wants a machine-readable check, not a code-review convention."*
 *
 * This module is that rule, expressed the way the rest of `src/domain/` expresses locked
 * decisions: **pure data + pure functions** — no React, no network, importable by the app
 * and by any future review tool.
 *
 * WHY THIS EXISTS WITH NO AD SDK YET (doc 19 §6.2 item 11 is deferred):
 *   1. The SDK cannot be *chosen* before we know what its own policy misses (SCRUM-63 Q3).
 *   2. No network's taxonomy is aligned to Singapore law, and AdMob's own docs say its
 *      filter is **best-effort, not guaranteed**, is **language-limited**, and that its
 *      `Consumer Loans` category is **removed on 2026-10-23**. Our list is the control of
 *      record; the SDK's controls are a second layer, not the first.
 *   3. It costs nothing now and means the first SDK lands against a contract, not a prose
 *      intention.
 *
 * ⚠️ THE `basis` FIELD IS THE POINT. Most classes are compelled by Singapore law; **alcohol
 * is not**. The type therefore records *why* each class is excluded, and `checks/ads.ts`
 * asserts it — so "upgrading" alcohol to `statutory`, or downgrading gambling to `policy`,
 * turns the check red. Both directions of that error are the failure mode this file exists
 * to prevent: over-claiming the law for a choice that is ours, and under-claiming it for a
 * category we could be prosecuted for serving.
 *
 * Sources verified 2026-10-05 → `AppDesignConceptBoard/21-ad-category-denylist.md` §2.
 */

/** How a class's exclusion is grounded. */
export type AdBasis =
  /** Singapore statute or subsidiary legislation forbids it. */
  | 'statutory'
  /** A regulator's directions / licence conditions forbid it for the liable party. */
  | 'regulatory_direction'
  /** **No Singapore law compels this** — it is our own stricter product policy. */
  | 'policy';

export type AdClassId = 'gambling' | 'loans' | 'alcohol' | 'nicotine' | 'unhealthy_food';

export interface AdClass {
  readonly id: AdClassId;
  readonly label: string;
  readonly basis: AdBasis;
  /** The instrument that grounds the exclusion (or `—` when it is our policy). */
  readonly instrument: string;
  readonly regulator: string;
  /** The implementable taxonomy — the sub-categories that belong in this class. */
  readonly includes: readonly string[];
  /** Deliberately **not** in this class. Over-blocking is a bug too (doc 21 §3). */
  readonly excludes: readonly string[];
  /** One line the PM or the cultural reviewer can read without the legal citation. */
  readonly note: string;
}

export const AD_CLASSES: readonly AdClass[] = [
  {
    id: 'gambling',
    label: 'Gambling & betting',
    basis: 'statutory',
    instrument: 'Gambling Control Act 2022',
    regulator: 'Gambling Regulatory Authority (GRA)',
    includes: [
      'casino, slots, table games, poker/rummy for money',
      'sports and esports betting, bookmakers, odds/tipster services',
      'lottery, toto, 4D, scratch cards, raffles for money',
      'crash/binary-style games of chance, prediction markets',
      'social casino and sweepstakes-casino titles',
      'gambling affiliates and "how to win" funnels',
    ],
    excludes: ['skill games with no stake or prize', 'sports news without betting'],
    note:
      'Advertising unlawful gambling is a GCA 2022 offence in or from Singapore, and to someone in Singapore; even licensed operators need GRA approval for any advertising or promotion.',
  },
  {
    id: 'loans',
    label: 'Loans, credit & money-advance',
    basis: 'regulatory_direction',
    instrument:
      'Moneylenders Act 2008 s.29(3) r/w s.45(1) — Registrar’s Directions on Advertising & Marketing Activities of Licensed Moneylenders (v3.0, wef 2025-04-01)',
    regulator: 'Registry of Moneylenders (Ministry of Law)',
    includes: [
      'payday / salary-advance / short-term loans (the highest-risk placement)',
      'BNPL and "pay later" instalment-credit products',
      'personal loans, fast cash, instant-approval credit, credit lines',
      'credit cards and balance-transfer promos',
      'pawnbroking, cash-for-gold, debt consolidation, credit repair',
      'loan aggregators/comparison sites, crypto-collateralised lending',
      '"get rich quick" money offers (also a Google Ads restricted category)',
    ],
    excludes: ['insurance', 'deposit/savings products with no credit element'],
    note:
      'A licensed moneylender may advertise only through a closed list — directories, its own website, its own premises. Paid search, social/video and SMS/WhatsApp/email are prohibited; unlicensed lending is criminal.',
  },
  {
    id: 'alcohol',
    label: 'Alcoholic drinks',
    basis: 'policy',
    instrument:
      '— (self-regulatory only: ASAS Singapore Code of Advertising Practice, Appendix K)',
    regulator: 'Advertising Standards Authority of Singapore (industry body)',
    includes: [
      'beer, wine, spirits, soju, sake, cider, RTDs and alcohol delivery',
      'bars, pubs, clubs, happy-hour and drinks-promotion ads',
      'home-brew and brewery kits, mixers, alcohol accessories',
    ],
    excludes: ['0% ABV / alcohol-alternative beverages (blocked anyway as look-alikes)'],
    note:
      '**Singapore has no statutory ban on alcohol advertising.** Our exclusion is stricter than the law — and Google permits alcohol ads to be served in Singapore, so this must be switched off explicitly, not assumed off.',
  },
  {
    id: 'nicotine',
    label: 'Tobacco & vaporisers',
    basis: 'statutory',
    instrument:
      'Tobacco and Vaporisers Control Act 1993 (formerly the Tobacco (Control of Advertisements and Sale) Act)',
    regulator: 'Health Sciences Authority (HSA)',
    includes: [
      'e-cigarettes, vapes, pods, heated tobacco, nicotine pouches',
      'shisha / waterpipe, snus, oral and nasal snuff, chewing tobacco',
      'cigarettes and cigarette brands',
    ],
    excludes: ['licensed smoking-cessation products (e.g. nicotine patches)'],
    note:
      'The Act prohibits tobacco advertisements, extends the ban to e-cigarettes and similar products, and expressly covers advertisements published electronically — including those originating in Singapore that target local or foreign audiences.',
  },
  {
    id: 'unhealthy_food',
    label: 'High-sugar drinks & child-targeted HFSS food',
    basis: 'statutory',
    instrument: 'Food Regulations reg. 184E–184F (Food (Amendment No. 2) Regulations 2021)',
    regulator: 'Singapore Food Agency / MOH / Health Promotion Board',
    includes: [
      'Nutri-Grade "D" beverages — the statutorily banned class',
      'energy drinks, syrups, high-sugar powdered drinks',
      'fast food and confectionery aimed at children (ASAS Children’s Code — self-regulatory)',
    ],
    excludes: ['"A"/"B" Nutri-Grade drinks and ungraded food with no ad ban'],
    note:
      'Advertising Nutri-Grade "D" beverages is prohibited (prepacked from 2022-12-30; freshly prepared from 2023-12-30). The wider child-targeted HFSS block is our policy, not law.',
  },
];

// ── The placement rule (ADR-008, machine-readable) ───────────────────────────

/** The ritual flow — **no ad surface may ever intersect this** (ADR-008; locked by doc 10 §1). */
export const RITUAL_FLOW_STEPS: readonly string[] = ['capture', 'cartoonize', 'burn', 'reward'];

/** Where an ad MAY appear. Anything not listed is a violation, not a judgement call. */
export const ALLOWED_AD_SURFACES: readonly string[] = [
  'home',
  'league',
  'screen_transition',
  'post_ritual',
];

/** Surfaces that stay ad-free regardless of how a new surface is named. */
export const FORBIDDEN_AD_SURFACES: readonly string[] = [
  'ritual_capture',
  'ritual_cartoonize',
  'ritual_burn',
  'ritual_reward',
  'generation_wait',
  'ancestor_names_visible',
  'tablets',
  'ancestor_sheet',
  'book_of_tributes',
];

/** ADR-008 clause B — the accepted volume caps. */
export const AD_CAPS = { appStartInterstitials: 2, consecutivePostRitual: 3 } as const;

/** ADR-008 clause C — Singapore practice for now, modelled as data for other diasporas. */
export const PROTECTED_MOMENTS: readonly string[] = [
  'qingming',
  'hungry_ghost',
  'ancestor_death_anniversary',
];

/** ADR-008 clause D's headline classes — the ones the PM answered "strong NO" for. */
export const HEADLINE_NO_CLASSES: readonly AdClassId[] = ['gambling', 'loans', 'alcohol'];

// ── Pure helpers ─────────────────────────────────────────────────────────────

export function adClassById(id: AdClassId): AdClass {
  const found = AD_CLASSES.find((c) => c.id === id);
  if (!found) throw new Error(`unknown ad class: ${id}`);
  return found;
}

/**
 * True when a surface may carry an ad.
 * **Deny by default:** an unrecognised surface is refused, and the forbidden list wins.
 */
export function isAdPlacementAllowed(surface: string): boolean {
  return ALLOWED_AD_SURFACES.includes(surface) && !FORBIDDEN_AD_SURFACES.includes(surface);
}

/**
 * Review-time heuristic for creatives the network's own filter let through.
 *
 * Deliberately blunt, and deliberately **not** the primary control: the primary controls
 * are (1) the category blocks in the SDK and (2) the Ad review center. This is the backstop
 * for the residual that AdMob's docs themselves admit they cannot guarantee — and it is
 * written to be auditable, so a false positive is a one-line fix rather than a mystery.
 *
 * It must never fire on our own ritual vocabulary; `checks/ads.ts` asserts exactly that.
 */
export const DENY_KEYWORDS: Readonly<Record<AdClassId, readonly string[]>> = {
  gambling: [
    'casino',
    'free spins',
    'jackpot',
    'betting',
    'sportsbook',
    'toto',
    '4d',
    'poker',
    'rummy',
    'sweepstakes',
  ],
  loans: [
    'payday',
    'fast cash',
    'instant loan',
    'cash advance',
    'salary advance',
    'bnpl',
    'pay later',
    'moneylender',
    'borrow up to',
    'credit line',
    'debt relief',
  ],
  alcohol: ['beer', 'whisky', 'vodka', 'soju', 'happy hour', 'brewery', 'spirits', 'wine'],
  nicotine: [
    'vape',
    'e-cigarette',
    'ecigarette',
    'pod system',
    'heated tobacco',
    'nicotine pouch',
    'shisha',
    'snus',
  ],
  unhealthy_food: ['nutri-grade d', 'energy drink', 'sugar rush'],
};

/**
 * Classify a creative's visible text against the denylist.
 * Returns every class that matched. An empty array means *no keyword hit* — **not** a clearance.
 */
export function classifyAdText(text: string): AdClassId[] {
  const haystack = text.toLowerCase();
  const hits: AdClassId[] = [];
  for (const cls of AD_CLASSES) {
    if (DENY_KEYWORDS[cls.id].some((kw) => haystack.includes(kw))) hits.push(cls.id);
  }
  return hits;
}
