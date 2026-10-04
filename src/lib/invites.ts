/**
 * Invites — one secret, dressed three ways (doc 07 §4.6, SCRUM-50).
 *
 * `clans.code` is the capability; **link · QR · copy** are three ways to carry
 * it. All of the encoding here is CLIENT-SIDE and FREE: no server call, no
 * image upload, works offline (doc 19 §3.5). The code only ever leaves the
 * device through the share action the user chose.
 *
 * PURE ON PURPOSE — no React, no native module, no network. The QR *rendering*
 * is a UI concern (react-native-svg + react-native-qrcode-svg, doc 19 §5.1) and
 * lands with the clan screens; what belongs here is the PAYLOAD, which doc 07
 * §4.6 pins as "the invite deep link", not the bare code.
 *
 * ⚠️ PRIVACY: the payload carries ONLY the code. Never ancestor names, never
 * member counts, never a clan id (doc 13 §4, doc 15 §4.3).
 */

/** ⚠️ Mirrors the `clans.code` CHECK in migration 0001 EXACTLY. */
export const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
/** No 0/O and no 1/I/L — a code that is read aloud must not be ambiguous. */
export const CODE_LENGTH = 8;
export const CODE_PATTERN = new RegExp(`^[${CODE_ALPHABET}]{${CODE_LENGTH}}$`);

/** doc 07 §4.6 — the App/Universal Link host (the domain itself is SCRUM-56 #6). */
export const INVITE_HOST = 'josspaperar.app';
/** The custom-scheme fallback, for when no universal link is registered. */
export const INVITE_SCHEME = 'josspaperar';

/**
 * Normalise typed or pasted input into a canonical code, or null.
 * Tolerates spaces, hyphens and lower case — people read these aloud.
 */
export function normaliseClanCode(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const cleaned = raw.toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (cleaned.length !== CODE_LENGTH) return null;
  return CODE_PATTERN.test(cleaned) ? cleaned : null;
}

/** `https://josspaperar.app/join/{CODE}` — survives the app not being installed. */
export function inviteLink(code: string): string {
  const canonical = normaliseClanCode(code);
  if (!canonical) throw new RangeError(`not a clan code: ${code}`);
  return `https://${INVITE_HOST}/join/${canonical}`;
}

/** `josspaperar://join?code={CODE}` — the in-app fallback route. */
export function inviteDeepLink(code: string): string {
  const canonical = normaliseClanCode(code);
  if (!canonical) throw new RangeError(`not a clan code: ${code}`);
  return `${INVITE_SCHEME}://join?code=${canonical}`;
}

/**
 * The QR payload. doc 07 §4.6: **the payload is the invite deep link** — one
 * payload then serves QR · link · share sheet, so the three presentations can
 * never drift apart.
 */
export function qrPayload(code: string): string {
  return inviteLink(code);
}

/**
 * Pull a code out of anything a link could look like: the universal link, the
 * custom scheme, a bare code, or a URL a user pasted with trailing junk.
 * Returns null rather than guessing.
 */
export function parseInviteUrl(input: unknown): string | null {
  if (typeof input !== 'string') return null;
  const trimmed = input.trim();

  // a bare code
  const bare = normaliseClanCode(trimmed);
  if (bare) return bare;

  // …/join/{CODE}
  const pathMatch = new RegExp(`/join/([A-Za-z0-9]{${CODE_LENGTH}})`).exec(trimmed);
  if (pathMatch) return normaliseClanCode(pathMatch[1]);

  // ?code={CODE} or &code={CODE} or #code={CODE}
  const queryMatch = new RegExp(`[?&#]code=([A-Za-z0-9]{${CODE_LENGTH}})`).exec(trimmed);
  if (queryMatch) return normaliseClanCode(queryMatch[1]);

  // a JWT-free smart link that nests one, e.g. ?redirect=…%2Fjoin%2FCODE
  try {
    const decoded = decodeURIComponent(trimmed);
    if (decoded !== trimmed) return parseInviteUrl(decoded);
  } catch {
    // not percent-encoded: fall through
  }
  return null;
}

/** The share-sheet text (EN / 中文) — code only, nothing personal. */
export const INVITE_SHARE_COPY = {
  en: (clanName: string, code: string) =>
    `Join ${clanName} on Joss Paper AR — invite code ${code}`,
  zh: (clanName: string, code: string) =>
    `加入 ${clanName} 的宗族 — 邀请码 ${code}`,
} as const;
