/**
 * clan-rules.ts — the PURE name rule for a clan (SCRUM-46).
 *
 * ── ⚠️ WHAT WAS HERE, AND WHY IT IS NOT ANY MORE ────────────────────────────
 * This file used to hold the SCRUM-82 **slice shortcut** (`SLICE_CLAN_NAME` +
 * `planClan`): the slice auto-created a clan called *"My Altar"* on first use,
 * because `submit_burn` is clan-scoped and there was no clan flow yet.
 *
 * **`SCRUM-83` retired it** (PM, 2026-10-08). The first burn is now a
 * **tutorial** — no clan, no points — and the **real create/join flow** follows
 * it (`src/app/clan/`, migration `0012`). One user, one clan, chosen by hand.
 *
 * `planClan` and `SLICE_CLAN_NAME` were DELETED rather than left commented out:
 * a helper that says *"the real flow is SCRUM-46/50"* is an invitation for a
 * future session to wire the shortcut back in. Only the NAME rule survives,
 * because creating and renaming a clan still need it.
 *
 * PURE on purpose (imports nothing), so `check:lib` can assert it without the
 * native Supabase client — the project's usual pure/device split.
 */

/**
 * ⚠️ **A CLAN NAME IS NOT LOCALISED — PM, 2026-10-10 (SCRUM-102.3).**
 * A clan is named in **whatever script the user types**, and the app renders it
 * **byte-for-byte**. The app language changes UI copy and nothing else: a 中文 name is
 * **not** translated to English when the language is English, and an English name is
 * **not** translated to 中文 when the language is 中文. So this rule measures LENGTH
 * only — it is **script-blind by construction**, and it must stay that way. The trim
 * below is the app's **only** transform on a name; there is no localiser, and adding
 * one would break the rule. `check:lib` §9 asserts the script-blindness.
 */

/** `create_clan` rejects a name outside 2..20 chars (measured after trim). */
export function isValidClanName(name: string): boolean {
  const trimmed = name.trim();
  return trimmed.length >= 2 && trimmed.length <= 20;
}

