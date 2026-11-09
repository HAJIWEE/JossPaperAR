/**
 * i18n — EN / 中文 (the two locales the design is signed off in, doc 15 §8).
 *
 * A deliberately TINY runtime: `i18n-js` plus one flat message table. The copy
 * itself is the locked product copy from the specs (doc 10 §4, doc 15 §8,
 * doc 13 §5) — where a string is already owned by another module, this file
 * IMPORTS it rather than restating it, so the two cannot drift.
 *
 * PURE ON PURPOSE: `i18n-js` is plain JavaScript, so this module loads under
 * plain Node and `src/lib/checks/run.ts` can assert the EN and 中文 tables have
 * exactly the same keys (a missing translation is a bug, not a fallback).
 *
 * ⚠️ `expo-localization` is NOT imported here. The device tag list is passed in
 * — that keeps the module Node-loadable and keeps the native dependency in the
 * device-only layer.
 */

import { I18n } from 'i18n-js';
import { QUOTA_SPENT_COPY } from '../domain/quota.ts';

export const LOCALES = ['en', 'zh'] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'en';

/**
 * The message table. Flat keys on purpose: one lookup, no nesting rules, and a
 * parity check that is a set comparison.
 */
export const MESSAGES = {
  en: {
    'app_name': 'Joss Paper AR',

    // ── the ritual (doc 10 §4 / doc 07 §4.2 — "the wait is UI") ────────────
    'ritual_preparing': 'The offering is being prepared…',
    'ritual_busy': 'The shrine is receiving many offerings — yours will be prepared shortly.',
    'ritual.cannotPrepare': 'This offering cannot be prepared.',
    // ── SCRUM-127 — the `/preparing` screen's copy, per phase (option B) ───────
    // ⚠️ DRAFTED, awaiting the owner's edit. The two failure phases used to share
    // `ritual.cannotPrepare`, so a photo that never left the phone was told its offering
    // "cannot be prepared"; and the title was permanently "being prepared…". The mapping
    // that pairs these keys with a phase is `PREPARING_COPY` in `domain/slice.ts`.
    'ritual.spentBody': 'This photo cannot be used for an offering — a new one is the only way on.',
    'ritual.offlineTitle': 'The offering could not reach the shrine.',
    'ritual.offlineBody': 'Nothing has been used — your offering is safe.',
    'ritual.offeringPrepared': 'Your offering is ready.',
    'ritual.refundReturned': 'The offering could not be prepared — your points have returned.',
    // ⚠️ Two DIFFERENT retries, deliberately. `common.retry` is for a request
    // that did not cost anything (parked by the budget, or never sent);
    // `common.recapture` is for a capture that IS spent and needs a new photo.
    // One shared "try again" would imply a re-offer is free when it is not.
    'common.retry': 'Check again',
    'common.recapture': 'Offer a new photo',
    'common.done': 'Return to the shrine',
    'quota_spent': QUOTA_SPENT_COPY.en,

    // ── the RITUAL screens' copy (burn · capture · reward · Home) ────────────
    // ⚠️ These lived as HARDCODED literals inside the screens, several of them
    // *bilingually* (`开始 · Begin`), so a panel marked `zh` showed English and an EN
    // panel showed Chinese. Where a design board already carries the ZH it is used
    // verbatim; the rest is new copy and is listed for review in `SCRUM-97`.
    'common.begin': 'Begin',
    'common.confirm': 'Confirm',
    'common.cancel': 'Cancel',
    'capture.cameraNeeded': 'The camera is needed',
    'capture.cameraWhy':
      'The offering is the object you would like to burn. Nothing leaves this phone without your permission to photograph it.',
    'capture.photoHint': 'Photograph the offering',
    'capture.failed': 'The photo was not taken — nothing has been used.',
    'capture.tryAgain': 'Try again',
    // ── SCRUM-131: the zoom stops and the crop/lasso step ───────────────────
    // ⚠️ The stop LABELS themselves ("1×"/"2×"/"4×") are numerals and live in
    // `src/lib/zoom.ts` — see that file for why they are not translated.
    'zoom.stopA11y': 'Zoom %{label}',
    // The analogue track's label. ⚠️ The VALUE it announces is the ratio, built in
    // `zoom.ts` (a numeral, like the labels above).
    'zoom.sliderA11y': 'Zoom',
    'crop.title': 'Frame your offering',
    'crop.hintRect': 'Drag over your offering.',
    'crop.hintLasso': 'Draw a closed loop around your offering.',
    'crop.modeRect': 'Rectangle',
    'crop.modeLasso': 'Lasso',
    // ⚠️ Rewritten in S64: the outline is applied FREE-FORM now. See SCRUM-130.
    'crop.lassoNote': 'Freehand — everything outside your outline is removed.',
    // ── the outline's four refusals (S64, `src/lib/lasso.ts`) ──────────────
    // ⚠️ Four sentences for four faults, because they need four different actions.
    'crop.lassoTooShort': 'Draw a bigger loop around your offering.',
    'crop.lassoDegenerate': 'That loop encloses nothing — draw around your offering.',
    'crop.lassoOpen': 'Join the two ends — the outline must be a closed loop.',
    'crop.lassoCrosses': 'Your outline crosses itself — draw one simple loop.',
    'crop.tooSmall': 'Choose a larger area.',
    'crop.skip': 'Use the whole photo',
    'crop.confirm': 'Use this frame',
    'crop.working': 'Framing your offering…',
    'crop.failed': 'That frame could not be applied — the whole photo will be used.',
    'crop.loading': 'Loading your photo…',
    'crop.photoFailed': 'Your photo could not be loaded.',
    'crop.badParams': 'That photo is missing something — please take it again.',
    'burn.aimHint': 'Swipe up and aim for the heart',
    'burn.dragHint': 'Drag up from here, and release over the fire.',
    'burn.lostPlace': 'This offering lost its place — begin again.',
    'burn.returns': 'Missed the heart — the offering returns to you. Nothing is lost, nothing is earned.',
    'burn.capped': 'A rethrow reaches at most Devout — never Bullseye.',
    'burn.exhausted': 'The offering rests.',
    'burn.rethrow': 'Throw again',
    'reward.safe': 'Your offering is safe — nothing has been recorded.',
    'reward.tributeUnit': 'tribute',
    'reward.alreadyRecorded': 'Already recorded',
    'reward.capped': 'Capped',
    'reward.balance': 'Balance %{points}',
    // ── the two MONEY confirms' copy (SCRUM-137, option B — owner-approved 2026-10-25) ──
    // ⚠️ READ OFF THE BOARDS, not invented: `5b Reward / one more offering` and
    // `9b Buy offerings · confirm`. ⚠️ The reward TITLE is also verbatim in doc 10's
    // "UX copy" table (the ad-gated offer row), so it is double-signed-off.
    // ⚠️ NEITHER confirm is wired yet, and the reason is NOT copy: the store has no
    // screen in the app, and the reward offer is AD-GATED (SCRUM-107 / ADR-008). The
    // strings ship now so the wiring is "a few lines once the words exist".
    'reward.oneMoreTitle': 'Watch to prepare one more offering.',
    'reward.oneMoreBody':
      'A short video unlocks one extra photo. Always after the ritual — never during.',
    'reward.oneMoreWatch': '▶ Watch',
    'reward.oneMoreDecline': 'No thanks',
    // ⚠️ `%{item}` is `OFFERINGS[].name` via `localized()`; `%{price}` is the cash price
    // the board shows. ⚠️ The board's own body is a WIRE ANNOTATION ("IAP sheet =
    // placeholder in this wire.") and is deliberately NOT what ships here.
    'store.buyConfirmTitle': 'Confirm — %{item}',
    'store.buyConfirmBody': '%{item} · %{price}. Google Play will ask you to verify.',
    'store.buyWithPlay': 'Buy with Google Play',
    'store.buyCancel': 'Cancel',
    'home.begin': 'Begin an offering',
    'home.clanEntry': 'Clan',
    // ⚠️ BOTH strings are doc 15 §8's Board copy, read off `EN · 1 Home / Shrine` and
    // `ZH · 1 Home / 首页` (Penpot, 2026-10-31) — NOT written here. The panels are
    // `panel · tribute label` ("TRIBUTE POINTS" / 功德点) and `panel · streak label`
    // ("12-day streak" / 连续 12 天). The EN is uppercased by the STYLE, not the string,
    // so the same key can be reused where sentence case is wanted.
    'home.tributeLabel': 'Tribute points',
    'home.streakLabel': '%{days}-day streak',
    // ⚠️ Board copy — `EN · 1 Home / Shrine` (Penpot, 2026-10-31). The caption and the hint
    // were MISSING from the build until the owner diffed it against the board.
    'home.altarEmpty': 'Your altar is empty — tap ＋ to add a tablet.',
    'home.ctaHint': 'Offer something meaningful, once a day',
    'home.templeChip': 'Everything here is customizable',
    // ⚠️ The tab bar's four labels — `nav · tab * label`, EN board.
    'nav.shrine': 'Shrine',
    'nav.league': 'League',
    'nav.store': 'Store',
    'nav.profile': 'Profile',
    // ── Settings (SCRUM-151) ────────────────────────────────────────────────
    // ⚠️ Board copy: `EN · 8b Settings`, read 2026-11-01. ⚠️ The board's *"(SCRUM-43)"* on the
    // policies row is a WIRE ANNOTATION and is deliberately NOT shipped — the same ruling the
    // store's buy-confirm body got ("IAP sheet = placeholder in this wire.").
    'settings.title': 'Settings',
    'settings.general': 'General',
    'settings.privacy': 'Privacy',
    'settings.language': 'Language',
    'settings.notifications': 'Daily remembrance reminder',
    'settings.notificationsSub': 'One nudge each evening · 8:00 PM',
    'settings.retention': 'Original photos',
    'settings.retentionSub': 'Auto-deleted 7 days after the offering is ready',
    'settings.analytics': 'Share usage analytics',
    'settings.analyticsSub': "Off — we don't need it to run the app",
    'settings.export': 'View or export my data',
    'settings.exportSub': 'A summary of everything we hold',
    'settings.deleteAll': 'Delete everything',
    'settings.deleteAllSub': 'Erases offerings, collection & points — receipt issued',
    'settings.policies': 'Privacy policy · Terms of Service',
    'settings.policiesSub': 'Published at josspaperar.app',
    'settings.signOut': 'Sign out',
    // ⚠️ SCRUM-215 — this row carried `settings.notBuilt` until the sign-out was built. A sub-label now
    // says what the row DOES, because the sub is what distinguishes a real row from a dead one.
    // ⚠️ AMENDED 2026-11-08 (ADR-004 Amendment 2): the sub used to promise "goes back to anonymous". That
    // is no longer what happens — the device is signed out and the next screen is the sign-in wall.
    'settings.signOutSub': 'You will need to sign in again',
    'settings.signOutTitle': 'Sign out?',
    // ⚠️ The body NAMES the consequence, the standard the delete card is held to: the account is not
    // erased, it is left behind — and the email is what brings it back. ⚠️ It no longer mentions an
    // anonymous device, because there is no longer one to go back to.
    'settings.signOutBody': 'You will be signed out on this device and will need your email to get back in. Your offerings, collection and tribute points stay with the account.',
    'settings.signOutConfirm': 'Sign out',
    'settings.signingOut': 'Signing out…',
    'settings.signOutFailed': 'The sign out did not go through — you are still signed in. Try again.',
    // ⚠️ The confirm's body names the CONSEQUENCES, which is what SCRUM-151 asks for — a card that
    // says only "are you sure?" is the thing ADR-007's one-tap delete is not allowed to be.
    'settings.deleteTitle': 'Delete everything?',
    'settings.deleteBody': 'This erases your offerings, your collection and your tribute points. It cannot be undone, and you will start again from first run.',
    'settings.deleteConfirm': 'Delete everything',
    'settings.deleting': 'Deleting…',
    'settings.deleteFailed': 'The delete did not go through — nothing has been erased. Try again.',
    // ⚠️ Shown on a row whose screen or server read does not exist yet. ⚠️ NOT a placeholder for a
    // dead link: the row renders DISABLED with this as its sub-label (the tab-bar pattern).
    'settings.notBuilt': 'Not built yet',
    // ── History (SCRUM-151) ─────────────────────────────────────────────────
    // ⚠️ Board copy: `EN · 8c History`, read 2026-11-01. ⚠️ The board's own footnote —
    // *"Only your offerings — nothing about others."* — is the promise the SECURITY DEFINER read
    // keeps, so it ships verbatim.
    'hist.title': 'History',
    'hist.weekHead': 'This week',
    'hist.weekBurned': '%{count} burned',
    'hist.weekTribute': '+%{points} tribute',
    'hist.weekStreak': '🔥 %{days} days',
    'hist.weekStreakOne': '🔥 1 day',
    'hist.allHead': 'All offerings',
    'hist.band': '%{band} ×%{mult}',
    'hist.photoOffering': 'Photo offering',
    'hist.note': 'Only your offerings — nothing about others.',
    'hist.empty': 'Nothing here yet — your first offering lands here.',
    // ⚠️ A FAILED read says so. ⚠️ It must NOT render as the empty state: "you have burned
    // nothing" and "we could not reach the shrine" are different facts, and the empty copy
    // states the first one as fact.
    'hist.unreachable': 'Your history could not be loaded just now.',
    // ── Profile (SCRUM-151) ────────────────────────────────────────────────
    // ── Collection (SCRUM-151) ─────────────────────────────────────────────
    // ⚠️ Read off `EN · 8 Collection` / `EN · 8d Collection / empty`, 2026-11-01 — not written here.
    // ── Store (SCRUM-150) ──────────────────────────────────────────────────
    // ⚠️ Read off `EN · 7 Store`, 2026-11-01. ⚠️ The note is NOT the board's: the board's says
    // *"Pay with cash or Store Points"*, and there is no cash rail — see `lib/store.ts`.
    // ── The offerings picker (SCRUM-149) ───────────────────────────
    // ⚠️ `EN · 2e Offerings picker`, 2026-11-01 — the note is the board's own sentence.
    'picker.title': 'Choose an offering',
    'picker.note': 'Nothing to photograph? Choose a standard offering — it arrives already in joss style.',
    'picker.base': 'base %{value}',
    'picker.owned': '×%{qty}',
    'picker.notOwned': 'Not owned',
    'picker.noneOwned': 'You own no offerings yet — buy one in the Store.',
    'picker.unreachable': 'Your offerings could not be loaded just now.',
    'store.title': 'Store',
    'store.intro': 'Standard offerings.',
    'store.pointsChip': 'Store Points %{points}',
    // ⚠️ The CASH rail's copy (owner, 2026-11-08: build the layout, not the payment). ⚠️ `%{cash}` is
    // formatted in cents->dollars at the call site, so no float ever reaches the string.
    'store.cashChip': 'Cash $%{cash}',
    'store.cashPrice': '$%{cash}',
    'store.buyCash': 'Buy for cash',
    // ⚠️ A control that exists must SAY what it does — this is not a greyed-out promise, it is the truth.
    'store.cashNotOpen': 'Cash purchases open when Google Play billing goes live — use Store Points for now.',
    'store.tabOfferings': 'Offerings',
    'store.tabDecorations': 'Decorations',
    'store.featured': 'FEATURED',
    'store.featuredValue': 'base value %{value}',
    'store.more': 'More bundles',
    // ── DECORATIONS (`EN · 7b Store · Decorations`) — the board's own copy, not a paraphrase. ────
    'store.decorIntro': 'Decorations stay on your altar. Pay with cash or Store Points.',
    'store.decorFeaturedValue': 'four pieces · permanent',
    'store.decorPermanent': 'Decoration · permanent',
    'store.moreDecorations': 'More decorations',
    'store.base': 'base %{value}',
    'store.price': '%{points} pts',
    'store.note': 'Pay with Store Points — every burn earns Points at 20% of its tribute.',
    // ── Buying (SCRUM-150) ────────────────────────────────────────
    'store.buyTitle': 'Buy this offering?',
    'store.buyBody': '%{name} — %{points} Store Points. It lands in your offerings, ready to burn.',
    'store.buyBodyBundle': '%{name} — %{points} Store Points. It lands as one of each standard offering, ready to burn.',
    'store.buyConfirm': 'Buy',
    'store.unreachable': 'The store could not be loaded just now.',
    'collection.title': 'Collection',
    'collection.burnedLabel': 'offerings burned',
    'collection.collectedLabel': 'items collected',
    // ⚠️ `×` is U+00D7, the multiplication sign — the board's glyph, not the letter `x`.
    'collection.meta': 'burned ×%{count}',
    'collection.emptyFirst1': 'Nothing here yet',
    'collection.emptyFirst2': 'your first burn lands here',
    'collection.emptyNext1': 'Offer something new',
    'collection.emptyNext2': 'and it lands here',
    'collection.note': 'Every offering you burn is kept here.',
    // ⚠️ A FAILED read says so — it must NOT render as the empty state, for the reason `hist.unreachable` records.
    'collection.unreachable': 'Your collection could not be loaded just now.',
    'profile.title': 'Profile',
    'profile.rowHistory': 'History',
    'profile.rowHistorySub': 'Recent burns & offerings',
    'profile.rowCollection': 'Collection',
    'profile.rowCollectionSub': 'Items you kept',
    'profile.rowSettings': 'Settings',
    'profile.rowSettingsSub': 'Language · notifications · privacy',
    'profile.tributeLabel': 'Tribute Points',
    // ── The USER'S OWN NAME (SCRUM-214(A) option B) ──────────────────────────
    // ⚠️ This is the person's name on their own profile — NOT the clan's name (Clan page) and NOT the league
    // pseudonym (doc 13 §4, never shown as a name). The hint says so, because the three are easy to confuse.
    'profile.namePrompt': 'Add your name',
    'profile.nameRow': 'Your name',
    'profile.nameNotSet': 'Not set yet',
    'profile.nameHint': "Your own name, for your profile. Your clan's name lives on the Clan page.",
    // ⚠️ THE LIMIT IS ITS OWN LINE, NOT A CLAUSE INSIDE THE HINT (owner, 2026-11-08: *"i dont see one when i go
    // to change the name"*). Buried at the end of a paragraph it read as boilerplate. It now has one job and its
    // own styled row in the sheet, because it is a COST the user is about to pay.
    'profile.nameLimitNote': 'You can change your name once every %{days} days.',
    'profile.namePlaceholder': 'e.g. Ah Gwee',
    'profile.nameSave': 'Save name',
    'profile.nameSaving': 'Saving…',
    'profile.nameEmpty': 'Enter a name first.',
    'profile.nameTooLong': 'That name is too long.',
    'profile.nameFailed': 'The name was not saved — try again.',
    // ⚠️ The once-a-week limit (SCRUM-223). ⚠️ `{days}` is the DATABASE's interval and `{remaining}` is this
    // user's wait — two different numbers. Reusing one placeholder for both would print "once every 2 days" to
    // someone with 2 days left.
    'profile.nameLockedSub': 'Change again in %{remaining} days',
    'profile.nameTooSoon': 'A name can be changed once every %{days} days. Try again in %{remaining} days.',
    // ⚠️ The tablet sheet (SCRUM-146 · SCRUM-168). Every limit named here is the DB's own.
    // ⚠️ The sheet's copy is `EN · 1s Ancestor sheet` / `EN · 1s2 … / edit mode`, read off
    // Penpot 2026-11-01 — NOT written here. The title says *ancestor* (the person), not
    // *tablet* (the object), which is the board's own wording.
    'ancestor.titleAdd': 'Add an ancestor',
    'ancestor.titleEdit': 'Edit ancestor',
    'ancestor.sheetSub': 'Their name is painted onto the tablet',
    'ancestor.surname': 'Surname',
    'ancestor.givenName': 'Given name',
    'ancestor.labelGivenOptional': 'Given name (optional)',
    'ancestor.relationship': 'Relationship',
    'ancestor.placeOnAltar': 'Place on altar',
    'ancestor.remove': 'Remove',
    'ancestor.previewCaption': 'Tablet preview',
    // ⚠️ The empty preview's placeholder — the board's own `preview · tablet · text (姓)`,
    // i.e. the word "surname" standing where the name will be painted. Same in both locales.
    'ancestor.previewPlaceholder': '姓',
    // ⚠️ The board's rule, verbatim — it is the ONLY place the 3-character limit and the
    // 姓+氏 fallback are explained to the user, and `tabletName()` implements both.
    'ancestor.sheetHint': 'Surname + given name paint up to 3 characters. No given name → 姓 + 氏, the traditional short form.',
    // ⚠️ The relationship chips write their OWN label into the free-text column — see
    // `RELATIONSHIP_CHIPS`. `—` is the chip that clears it.
    'ancestor.rel.none': '—',
    'ancestor.rel.grandfather': 'Grandfather',
    'ancestor.rel.grandmother': 'Grandmother',
    'ancestor.rel.father': 'Father',
    'ancestor.rel.mother': 'Mother',
    'ancestor.problemSurname': 'A surname is required.',
    'ancestor.problemTooLong': 'Too long — the limit is %{max} characters.',
    'ancestor.capReached': 'The altar holds %{cap} tablets. Archive one to add another.',
    'ancestor.archiveConfirm': 'An archived tablet leaves the altar. This cannot be undone.',
    // ⚠️ `caption · altar state` on `EN · 1b Home / tablets (carousel)`, read 2026-11-01. The
    // singular is OURS: the board only draws the 3-tablet case, and "1 ancestors" is not copy.
    'home.altarFilledOne': 'One ancestor enshrined — swipe or tap a tablet to edit.',
    'home.altarFilled': '%{count} ancestors enshrined — swipe or tap a tablet to edit.',

    // ── the throw (doc 05 §2 — the four bands) ────────────────────────────
    'band_bullseye': 'Bullseye',
    'band_devout': 'Devout',
    'band_graze': 'Graze',
    'band_miss': 'Miss',
    'reward.newGround': 'New ground',

    // ── clans & invites (doc 15 §8, doc 07 §4.6) ──────────────────────────
    'clan.forkJoin': 'Join a Clan',
    'clan.forkJoinHint': 'A family member sent you a link? Enter the code.',
    'clan.forkCreate': 'Create a Clan',
    'clan.forkCreateHint': "Start your family's altar.",
    'clan_name': 'Clan name',
    'clan.youWillBeHead': 'You will be the Clan Head.',
    'clan_code': 'Enter clan code',
    'clan_preview': '%{name} · %{ancestors} ancestors · %{members} members',
    'clan_welcome': 'Welcome to %{name}.',
    'clan.alreadyMember': 'You are already a member of this clan.',
    'clan.invalidCode': 'That invite code is not valid.',
    // ⚠️ A SECOND message for a SECOND fact: an unreachable shrine is not a bad
    // code, and telling a user their family's code is wrong when it is fine is
    // how an invite never gets retried (SCRUM-50).
    'clan.unreachableCode': 'We could not reach the shrine. Your code is fine — try again.',
    'clan.inviteFamily': 'Invite your family',
    'clan.shareCode': 'Share code · Show QR · Copy link',

    // ── invites: the QR, the scanner and the held link (SCRUM-50 · doc 07 §4.6) ──
    'invite.scan': 'Scan a QR code',
    'invite.scanHint': 'Point the camera at your family’s invite code.',
    'invite.typeCode': 'Type the code instead',
    'invite.scanNeedsCamera': 'Scanning needs the camera',
    'invite.scanNeedsCameraBody': 'Allow camera access to read a family invite, or type the code.',
    'invite.grantCamera': 'Allow camera',
    'invite.unreadableLink': 'That link does not contain an invite code.',
    'invite.waiting': 'You have an invite waiting',
    'invite.waitingHint': 'Tap to join.',
    // ⚠️ `%{code}` is the whole payload — no clan name, no counts (doc 13 §4).
    'invite.heldNoIdentity':
      'Invite %{code} is saved. We will take you to the clan once your account is ready.',
    'invite.heldOffline':
      'Invite %{code} is saved. We could not reach the shrine — try again when you are back online.',
    'invite.qrFailed': 'The QR could not be drawn — share the code instead.',
    'invite.qrUnavailable': 'The QR is unavailable — share the code instead.',
    'role_head': 'Clan Head',
    'role_co_head': 'Co-Head',
    'role_elder': 'Elder',
    'role_member': 'Member',

    // ── the clan SCREENS — fork · create · join · manage (SCRUM-46 · doc 15 §4/§8) ──
    // Written from doc 15 §8's copy table (C1 fork title, C12 promote, C13 offer,
    // C17 delete) plus the statements §4 names. The screen keys the pure
    // `clan-flow.ts` returns — `ROLE_LABEL_KEY`, `promoteLabelKey`,
    // `leaveHintKey` — must exist here, and `check:lib` asserts exactly that.
    'clan.forkTitle': "Your family's altar",
    'clan.nameHint': 'e.g. 陈氏 · Tan Family',
    'clan.create': 'Create',
    'clan.join': 'Join',
    'clan.skip': 'Skip',
    'clan.next': 'Continue',
    'clan.back': 'Back',
    'clan.invite': 'Invite family',
    'clan.copied': 'Invite code copied.',
    'clan.placeFirstTablet': 'Place your first tablet',
    'clan.offerTo': "Offer to %{name}'s ancestors",
    'clan.manage': 'Members',
    'clan.yourRole': 'Your role',
    /* SCRUM-92 — the Home pill's accessibility label (the visible text is the clan
       name + the role chip). ⚠️ The ZH side below stays TRADITIONAL, matching this
       table; the simplified/traditional question is SCRUM-95, not a per-string call. */
    'clan.pillA11y': 'Open your clan, %{name}',
    'clan.makeElder': 'Make Elder',
    'clan.makeCoHead': 'Make Co-Head',
    'clan.rename': 'Rename',
    'clan.renamePrompt': 'New clan name',
    'clan.removeMember': 'Remove',
    'clan.removeConfirm': 'Remove %{name} from the clan? Their past offerings stay.',
    'clan.leave': 'Leave this clan',
    'clan.leaveConfirm': 'Leave this clan? Your past offerings stay.',
    // ── the SCRUM-84 head-exit ramp (PM-answered 2026-10-08) ──────────────
    // The prompt is step ONE of the rule, so its copy prepares the head for the
    // question instead of refusing them.
    'clan.leaveHint': 'You will be asked who leads the clan next.',
    'clan.nameSuccessor': 'Name a successor',
    'clan.successorHint':
      'Choose who leads the clan after you — or leave it to the longest-standing elder.',
    'clan.leaveWithoutSuccessor': 'Leave without naming one',
    // the refusals, so a 中文 reader never meets the server's English sentence
    'clan.leaveNotMember': 'You are not a member of this clan.',
    'clan.leaveSelfSuccessor': 'You cannot name yourself as your successor.',
    'clan.leaveStrangerSuccessor': 'That person is not a member of this clan.',
    'clan.leaveNoSuccessor':
      'Nobody can lead after you yet. Promote a co-head first, or delete the clan.',
    'clan.successorNamed': '%{name} now leads the clan.',
    'clan.successorAuto':
      'No successor named — %{name}, the longest-standing elder, now leads the clan.',

    // ── the FIRST-RUN TUTORIAL (SCRUM-85 · the SCRUM-83 answer) ────────────
    // ⚠️ The copy must be HONEST that nothing is recorded and nothing is spent.
    // A demo the player mistakes for a real award is worse than no demo at all.
    'tutorial.badge': 'Demo',
    'tutorial.intro':
      'This first offering is a demonstration — you offer a %{item}. Nothing is recorded and no points are earned.',
    'tutorial.demoStart': 'Offer it',
    'tutorial.preparing': 'Preparing a demo offering…',
    'tutorial.preparingNote':
      'In the real ritual this is where your photo becomes a paper offering.',
    'tutorial.receiptNote': 'Demo only — no points were earned and no clan was touched.',
    'tutorial.finish': "Build your family's altar",
    'tutorial.startHint': 'First time? This one is a guided demo.',
    'tutorial.noClanNote': 'The demo needs no clan — you will create or join one next.',
    // the ACCOUNT (SCRUM-215 · ADR-004) — the boards `EN · 0d6` / `0d7` / `0c`, both locales
    'account.signupTitle': 'Create your account',
    'account.signupSub': 'Then straight to building your family altar.',
    'account.signinTitle': 'Sign in or register new account',
    'account.signinSub': 'Sign in to return to your shrine.',
    'account.emailLabel': 'EMAIL',
    'account.emailPlaceholder': 'you@example.com',
    'account.languageCaption': 'LANGUAGE',
    // ⚠️ THE PROMISE IS "ads or messages", NOT "ads or email" (owner, 2026-11-08 · SCRUM-217.2: *"we can
    // generalize the ZH to 信息 instead"*). ⚠️ The ZH draft said 邮件推送 — which quietly promised something
    // narrower than the EN sentence: only EMAIL pushes would be excluded, so an SMS, a notification or any
    // future channel fell outside the promise the user was shown. 信息推送 keeps the two languages saying the
    // same thing. `check:lib` holds this line, because a narrowing here is a privacy claim getting weaker.
    'account.privacy': 'Your email is only used to sign you in — never for ads or messages.',
    'account.create': 'Create account',
    'account.sendCode': 'Send code',
    'account.verifyTitle': 'Enter your code',
    'account.verifySub': 'Sent to %{email}',
    'account.resendIn': 'Resend code in %{time}',
    'account.resendNow': 'Resend a new code',
    'account.editEmail': 'Wrong email? Edit',
    // ⚠️ A TEMPORARY refusal, and it must not read as a broken sign-in. The server answers 429 when the
    // address was mailed too recently, so the copy names the WAIT and keeps the code road alive.
    'account.tooMany': 'A code was just sent to this address — give it a minute, then ask again.',
    'account.verify': 'Verify',
    'account.signIn': 'Sign in',
    'account.haveAccount': 'Already have an account? Sign in',
    'account.newHere': 'New here? Create an account',
    'account.emailInvalid': 'Check the email address and try again.',
    'account.codeWrong': 'That code didn’t match. Have another go.',
    'account.genericIssue': 'Something went wrong. Please try again.',
    'clan.deleteClan': 'Delete this clan',
    'clan.deleteConfirm':
      'Delete this clan? Every member loses the altar and the Book of Tributes. This cannot be undone.',

    // ── the Book of Tributes (doc 15 §7) ──────────────────────────────────
    'book_header': 'Book of Tributes',
    'book_outside': 'A member made this offering.',
    'book_window': 'Showing the last month.',
    // ⚠️ SCRUM-122 / SCRUM-144 — the Book's EMPTY state. ✅ **SIGNED OFF 2026-10-31 (option A)**:
    // it is doc 15 §8's row **C18**, the copy table of record. ⚠️ Until then it was a marked
    // PROPOSAL — §8 carried no empty-state row (C14–C16 only), so the ZH could not be taken from
    // the table without inventing it. `check:copy` rule 4 now holds §8 ↔ these keys, so a row
    // that goes missing again turns the gate red instead of shipping an invented string.
    'book_empty': 'No offerings yet. The first one will appear here.',

    // ── the LEAGUE BOARD (SCRUM-11 step 6 · doc 07 §4.7 · doc 18 E7) ───────
    'league.title': 'League',
    'league.week': '%{from} – %{to}',
    'league.yourRank': 'Your rank',
    'league.rankN': '#%{rank}',
    'league.points': '%{points}',
    'league.you': 'You',
    'league.families': '%{count} families',
    'league.zones': 'The top 3 rise · the bottom 3 fall',
    'league.live': 'Live',
    'league.unreachable': 'The board could not be reached.',
    // ⚠️ The SERVER's `note` is EN prose and is deliberately NOT rendered — a ZH
    //    screen cannot localise it. The two states it names are expressed here
    //    instead, chosen from `cohortId === null` / week dates. See league-api.ts.
    'league.noWeek': 'The league opens with the first weekly roll.',
    'league.notPlaced': 'You are not in a cohort this week — the next roll places you.',
    // ⚠️ THE MOMENT (SCRUM-111 answer C). ONLY the promoted pair animates — see
    //    `promotionMoment()` in domain/league.ts for why a demotion must not, and
    //    note that the demoted copy names no fault: no "you lost", no "don't slip".
    // ⚠️ THE BODIES USED TO RESTATE THE MECHANISM ("three families rise each week",
    //    "your family stays in %{tier}"), which the TITLE and the tier delta already
    //    say — the PM's review, 2026-10-12. Each body now carries only what the
    //    title cannot: where the new week STARTS (promoted), that it starts at all
    //    (demoted), and that points reset weekly (held). ⚠️ Held no longer takes
    //    `%{tier}` for the same reason — the title names the rung.
    'league.momentPromotedTitle': 'Risen to %{tier}',
    'league.momentPromotedBody': 'A new week begins a rung higher.',
    'league.momentDemotedTitle': 'Moved to %{tier}',
    'league.momentDemotedBody': 'A new week begins today.',
    'league.momentHeldTitle': 'Held at %{tier}',
    'league.momentHeldBody': 'Points reset every week.',

    // ── privacy (doc 13 §5/§8, ADR-007) ───────────────────────────────────
    'privacy.firstRun':
      "Your photos, your ancestors' names, and where you pay tribute stay in your account. We use them only to make your offering — never sold, never in ads.",
    'privacy.rawPhotoNote':
      'Your original photo is deleted automatically a week after the offering is ready.',
    'delete_title': 'Delete everything',
    'delete_confirm': 'Delete everything? This cannot be undone.',
  },
  zh: {
    'app_name': 'Joss Paper AR',

    'ritual_preparing': '供品制作中…',
    'ritual_busy': '神龛正繁忙，您的供品稍后即成。',
    'ritual.cannotPrepare': '此供品无法制作。',
    // ── SCRUM-127 — the `/preparing` screen's copy, per phase (option B) ───────
    // ⚠️ DRAFTED, awaiting the owner's edit. 词汇沿用既有文案（制作 · 神龛 · 安然无恙）。
    'ritual.spentBody': '这张照片无法制作供品——只能重新拍摄。',
    'ritual.offlineTitle': '供品未能送达神龛。',
    'ritual.offlineBody': '未消耗任何内容——供品安然无恙。',
    'ritual.offeringPrepared': '您的供品已备好。',
    'ritual.refundReturned': '供品未能制成，点数已退回。',
    'common.retry': '再试一次',
    'common.recapture': '重新供相',
    'common.done': '回到神龛',
    'quota_spent': QUOTA_SPENT_COPY.zh,

    // ── the RITUAL screens' copy (burn · capture · reward · Home) ────────────
    // The ZH where a design board already carries it is used verbatim
    // (上滑对准火心抛入 · 未中火心 · 重投最高至虔诚 ×1.5 · 三次已尽 · 再次投掷 · 功德点);
    // the remainder is NEW copy and is listed for review in `SCRUM-97`.
    'common.begin': '开始',
    'common.confirm': '确认',
    'common.cancel': '取消',
    'capture.cameraNeeded': '需要使用相机',
    'capture.cameraWhy': '供品就是您想焚烧的物品。未获得您的拍照许可，任何内容都不会离开这台手机。',
    'capture.photoHint': '拍摄供品',
    'capture.failed': '未能拍下照片——未消耗任何内容。',
    'capture.tryAgain': '再试一次',
    // ── SCRUM-131：变焦档位与裁切／套索 ─────────────────────────────────────
    // ⚠️ 档位标签（"1×"／"2×"／"4×"）是数字，定义在 `src/lib/zoom.ts`。
    'zoom.stopA11y': '变焦 %{label}',
    // 模拟滑杆的标签。⚠️ 它播报的数值是倍率，由 `zoom.ts` 生成。
    'zoom.sliderA11y': '变焦',
    'crop.title': '框出您的供品',
    'crop.hintRect': '在供品上拖动框选。',
    'crop.hintLasso': '沿供品画一圈并合上首尾。',
    'crop.modeRect': '方框',
    'crop.modeLasso': '套索',
    // ⚠️ S64 改写：轮廓现在是自由形状套用。见 SCRUM-130。
    'crop.lassoNote': '手绘圈选——轮廓之外的部分会被去除。',
    // ── 轮廓的四种拒绝（S64，`src/lib/lasso.ts`）──────────────────────────
    'crop.lassoTooShort': '请绕着供品画大一点的圈。',
    'crop.lassoDegenerate': '这个圈没有围出范围——请绕着供品画。',
    'crop.lassoOpen': '请把首尾连起来——轮廓必须是闭合的圈。',
    'crop.lassoCrosses': '轮廓自己交叉了——请画一个简单的圈。',
    'crop.tooSmall': '请选择更大的范围。',
    'crop.skip': '使用整张照片',
    'crop.confirm': '使用此框',
    'crop.working': '正在框取供品…',
    'crop.failed': '无法套用此框——将使用整张照片。',
    'crop.loading': '正在载入您的照片…',
    'crop.photoFailed': '无法载入您的照片。',
    'crop.badParams': '这张照片缺少必要信息——请重新拍摄。',
    'burn.aimHint': '上滑对准火心抛入',
    'burn.dragHint': '从这里上滑，在火上松开。',
    'burn.lostPlace': '供品已失去记录，请重新开始。',
    'burn.returns': '未中火心 · 供品回到您手中——未失未得。',
    'burn.capped': '重投最高至虔诚 ×1.5 —— 永不为正中 ×2.0。',
    'burn.exhausted': '三次已尽。',
    'burn.rethrow': '再次投掷',
    'reward.safe': '供品安然无恙——未记录任何内容。',
    'reward.tributeUnit': '功德点',
    'reward.alreadyRecorded': '已记录',
    'reward.capped': '已达上限',
    'reward.balance': '余额 %{points}',
    // ── the two MONEY confirms' copy (SCRUM-137, option B — owner-approved 2026-10-25) ──
    // ⚠️ The same board-sourced strings as the EN block above. `%{item}` / `%{price}` are
    // placeholders, so the only prose is the fixed part of each string.
    'reward.oneMoreTitle': '观看以再备一份供品。',
    'reward.oneMoreBody': '一段短视频，多一次拍照供品。仅在仪式之后 — 绝不在仪式之中。',
    'reward.oneMoreWatch': '▶ 观看',
    'reward.oneMoreDecline': '不用了',
    'store.buyConfirmTitle': '确认 — %{item}',
    'store.buyConfirmBody': '%{item} · %{price}。Google Play 将请求您验证。',
    'store.buyWithPlay': '通过 Google Play 购买',
    'store.buyCancel': '取消',
    'home.begin': '开始供奉',
    'home.clanEntry': '宗族',
    // ⚠️ Board copy — `ZH · 1 Home / 首页` (Penpot, 2026-10-31). 功德点 is already the
    // unit used by `reward.tributeUnit`, so the shrine and the reward screen agree.
    'home.tributeLabel': '功德点',
    'home.streakLabel': '连续 %{days} 天',
    // ⚠️ Board copy — `ZH · 1 Home / 首页` (Penpot, 2026-10-31).
    'home.altarEmpty': '尚未安奉牌位 — 轻点 ＋ 安放',
    'home.ctaHint': '每日供奉一件有意义之物',
    'home.templeChip': '此处一切皆可自定义',
    'nav.shrine': '神龛',
    'nav.league': '联赛',
    'nav.store': '商店',
    'nav.profile': '我的',
    // ── 设置（SCRUM-151）────────────────────────────────────────────────────
    // ⚠️ 文案取自 `ZH · 8b 设置`（Penpot，2026-11-01）。⚠️ 板上的「(SCRUM-43)」是线稿批注，不予发布。
    'settings.title': '设置',
    'settings.general': '通用',
    'settings.privacy': '隐私',
    'settings.language': '语言',
    'settings.notifications': '每日追思提醒',
    'settings.notificationsSub': '每晚提醒一次 · 20:00',
    'settings.retention': '原始照片',
    'settings.retentionSub': '供奉完成后 7 天自动删除',
    'settings.analytics': '分享使用数据',
    'settings.analyticsSub': '已关闭 — 运行应用并不需要它',
    'settings.export': '查看或导出我的数据',
    'settings.exportSub': '我们保存的全部内容摘要',
    'settings.deleteAll': '删除全部',
    'settings.deleteAllSub': '清空供品、收藏与功德点 — 并出具回执',
    'settings.policies': '隐私政策 · 服务条款',
    'settings.policiesSub': '发布于 josspaperar.app',
    'settings.signOut': '退出登录',
    'settings.signOutSub': '退出后需重新登录',
    'settings.signOutTitle': '退出登录？',
    'settings.signOutBody': '此设备将退出登录，需用邮箱重新登录才能继续使用。供品、收藏与功德点仍保留在账号中。',
    'settings.signOutConfirm': '退出登录',
    'settings.signingOut': '正在退出…',
    'settings.signOutFailed': '退出未成功 — 仍处于登录状态。请重试。',
    'settings.deleteTitle': '删除全部？',
    'settings.deleteBody': '此操作将清空你的供品、收藏与功德点，无法撤销，并将回到首次使用状态。',
    'settings.deleteConfirm': '删除全部',
    'settings.deleting': '正在删除…',
    'settings.deleteFailed': '删除未成功 — 未清除任何数据。请重试。',
    'settings.notBuilt': '尚未实现',
    // ── 历史（SCRUM-151）────────────────────────────────────────────────────
    'hist.title': '历史',
    'hist.weekHead': '本周',
    'hist.weekBurned': '焚烧 %{count} 次',
    'hist.weekTribute': '+%{points} 功德',
    'hist.weekStreak': '🔥 连续 %{days} 天',
    'hist.weekStreakOne': '🔥 连续 1 天',
    'hist.allHead': '全部供品',
    'hist.band': '%{band} ×%{mult}',
    'hist.photoOffering': '照片供品',
    'hist.note': '仅显示你自己的供品 — 不含他人。',
    'hist.empty': '暂无记录 — 你的第一次供奉将出现在这里。',
    'hist.unreachable': '暂时无法载入历史记录。',
    // ── 我的（SCRUM-151）────────────────────────────────────────────────────
    // ── 收藏（SCRUM-151）─────────────────────────────────────────────────────
    // ── 商店（SCRUM-150）──────────────────────────────────────────────────────
    // ── 供品选择（SCRUM-149）────────────────────────────────
    'picker.title': '选择供品',
    'picker.note': '没有照片？选一份标准供品——它已经是金银纸的样子。',
    'picker.base': '基础 %{value}',
    'picker.owned': '×%{qty}',
    'picker.notOwned': '未拥有',
    'picker.noneOwned': '你还没有任何供品——请在商店购买。',
    'picker.unreachable': '暂时无法载入供品。',
    'store.title': '商店',
    'store.intro': '标准供品。',
    'store.pointsChip': '功德点 %{points}',
    'store.cashChip': '现金 $%{cash}',
    'store.cashPrice': '$%{cash}',
    'store.buyCash': '现金购买',
    'store.cashNotOpen': '现金购买将于 Google Play 结算上线后开放 — 目前请使用功德点。',
    'store.tabOfferings': '供品',
    'store.tabDecorations': '装饰',
    'store.featured': '精选',
    'store.featuredValue': '基础 %{value}',
    'store.more': '更多套装',
    'store.decorIntro': '装饰会留在你的神台上，可用现金或功德点购买。',
    'store.decorFeaturedValue': '四件 · 永久',
    'store.decorPermanent': '装饰 · 永久',
    'store.moreDecorations': '更多装饰',

    'store.base': '基础 %{value}',
    'store.price': '%{points} 点',
    'store.note': '使用功德点购买 — 每次焚烧可获得其功德 20% 的点数。',
    // ── 购买（SCRUM-150）───────────────────────────────────────────
    'store.buyTitle': '购买这份供品？',
    'store.buyBody': '%{name} —— %{points} 功德点。它会进入你的供品，随时可以焚烧。',
    'store.buyBodyBundle': '%{name} —— %{points} 功德点。它会变成每件标准供品各一份，随时可以焚烧。',
    'store.buyConfirm': '购买',
    'store.unreachable': '暂时无法载入商店。',
    'collection.title': '收藏',
    'collection.burnedLabel': '已焚烧供品',
    'collection.collectedLabel': '已收藏物品',
    'collection.meta': '焚烧 ×%{count}',
    'collection.emptyFirst1': '这里还空着',
    'collection.emptyFirst2': '第一份供品会留在这里',
    'collection.emptyNext1': '再备一份新供品',
    'collection.emptyNext2': '它就会留在这里',
    'collection.note': '你焚烧的每一份供品都会保存在这里。',
    'collection.unreachable': '暂时无法载入你的收藏。',
    'profile.title': '我的',
    'profile.rowHistory': '历史',
    'profile.rowHistorySub': '最近的焚烧与供品',
    'profile.rowCollection': '收藏',
    'profile.rowCollectionSub': '你保留的供品',
    'profile.rowSettings': '设置',
    'profile.rowSettingsSub': '语言 · 通知 · 隐私',
    'profile.tributeLabel': '功德点',
    // ── 用户自己的名字（SCRUM-214(A) 方案 B）────────────────────────────────
    'profile.namePrompt': '添加你的名字',
    'profile.nameRow': '你的名字',
    'profile.nameNotSet': '尚未设置',
    'profile.nameHint': '这仅是你的个人档案名字，宗族名称请到宗族页面查看。',
    'profile.nameLimitNote': '名字每 %{days} 天只能修改一次。',
    'profile.namePlaceholder': '例如：阿贵',
    'profile.nameSave': '保存名字',
    'profile.nameSaving': '保存中…',
    'profile.nameEmpty': '请先输入名字。',
    'profile.nameTooLong': '名字太长了。',
    'profile.nameFailed': '名字未能保存 — 请重试。',
    // ⚠️ 每 7 天只能修改一次（SCRUM-223）。`{days}` 是数据库的间隔，`{remaining}` 是这位用户还需等待的天数 —
    // 两个不同的数字，混用会让只剩 2 天的人看到「每 2 天可修改一次」。
    'profile.nameLockedSub': '%{remaining} 天后可再次修改',
    'profile.nameTooSoon': '名字每 %{days} 天只能修改一次，请 %{remaining} 天后再试。',
    // ⚠️ 牌位弹层 — 文案取自 `ZH · 1s 安奉牌位` / `ZH · 1s2 … / 编辑`（Penpot，2026-11-01）。
    'ancestor.titleAdd': '添加祖先',
    'ancestor.titleEdit': '编辑祖先',
    'ancestor.sheetSub': '名字将刻于牌位',
    'ancestor.surname': '姓氏',
    'ancestor.givenName': '名字',
    'ancestor.labelGivenOptional': '名字（选填）',
    'ancestor.relationship': '称谓',
    'ancestor.placeOnAltar': '安放',
    'ancestor.remove': '移走',
    'ancestor.previewCaption': '牌位预览',
    'ancestor.previewPlaceholder': '姓',
    'ancestor.sheetHint': '姓与名共刻三字；未填名字则刻「姓＋氏」，依传统简称。',
    'ancestor.rel.none': '—',
    'ancestor.rel.grandfather': '祖父',
    'ancestor.rel.grandmother': '祖母',
    'ancestor.rel.father': '父亲',
    'ancestor.rel.mother': '母亲',
    'ancestor.problemSurname': '需要填写姓氏',
    'ancestor.problemTooLong': '过长 — 上限 %{max} 个字',
    'ancestor.capReached': '神龛已奉 %{cap} 座牌位 — 归档一座后可再添加',
    'ancestor.archiveConfirm': '归档后牌位将离开神龛，无法撤销。',
    'home.altarFilledOne': '已安奉 1 位祖先 — 滑动查看，轻点编辑',
    'home.altarFilled': '已安奉 %{count} 位祖先 — 滑动查看，轻点编辑',

    'band_bullseye': '正中',
    'band_devout': '虔诚',
    'band_graze': '擦边',
    'band_miss': '偏失',
    'reward.newGround': '新地',

    'clan.forkJoin': '加入宗族',
    'clan.forkJoinHint': '家人发来了链接？输入邀请码。',
    'clan.forkCreate': '创建宗族',
    'clan.forkCreateHint': '建立您家族的祭坛。',
    'clan_name': '宗族名称',
    'clan.youWillBeHead': '您将成为族长。',
    'clan_code': '输入邀请码',
    'clan_preview': '%{name} · 先人 %{ancestors} 位 · 成员 %{members} 位',
    'clan_welcome': '欢迎加入%{name}。',
    'clan.alreadyMember': '您已是此宗族的成员。',
    'clan.invalidCode': '邀请码无效。',
    'clan.unreachableCode': '无法连上神龛。邀请码没有错——请再试一次。',
    'clan.inviteFamily': '邀请家人加入',
    'clan.shareCode': '分享邀请码 · 显示二维码 · 复制链接',

    // ── 邀请：二维码 · 扫描 · 暂存的链接（SCRUM-50 · doc 07 §4.6）──
    'invite.scan': '扫描二维码',
    'invite.scanHint': '将镜头对准家人的邀请码。',
    'invite.typeCode': '改为输入邀请码',
    'invite.scanNeedsCamera': '扫描需要相机权限',
    'invite.scanNeedsCameraBody': '允许使用相机以读取家人的邀请，或改为输入邀请码。',
    'invite.grantCamera': '允许使用相机',
    'invite.unreadableLink': '此链接没有邀请码。',
    'invite.waiting': '您有一个待加入的邀请',
    'invite.waitingHint': '轻点即可加入。',
    'invite.heldNoIdentity': '邀请码 %{code} 已储存。账号就绪后将带您加入宗族。',
    'invite.heldOffline': '邀请码 %{code} 已储存。目前无法连上神龛——请于连线后再试。',
    'invite.qrFailed': '无法绘制二维码——请改为分享邀请码。',
    'invite.qrUnavailable': '二维码暂不可用——请改为分享邀请码。',
    'role_head': '族长',
    'role_co_head': '副族长',
    'role_elder': '长老',
    'role_member': '成员',

    // ✅ SIMPLIFIED — SCRUM-95, answered by the PM on 2026-10-10: *"Simplified Chinese.
    // Has a significant larger market."* This table was TRADITIONAL until then, while
    // doc 15 §8 and all four S36 ZH design boards were already simplified — so the code
    // was the one holdout. It is now simplified throughout, and `check:lib` asserts it
    // (section 15), so it cannot drift back.
    // ⚠️ Character conversion is not WORD conversion: 連結 → 链接 and 身分 → 身份 were
    // fixed by hand against doc 15 §8 (C2/C10) and the `ZH · 0e9` board, because a
    // char-level pass yields 连结/身分 — both wrong for a simplified-mainland reader.
    'clan.forkTitle': '您家族的祭坛',
    'clan.nameHint': '例：陈氏 · Tan Family',
    'clan.create': '创建',
    'clan.join': '加入',
    'clan.skip': '略过',
    'clan.next': '继续',
    'clan.back': '返回',
    'clan.invite': '邀请家人',
    'clan.copied': '邀请码已复制。',
    'clan.placeFirstTablet': '安放第一块神主牌',
    'clan.offerTo': '向%{name}的先人供奉',
    'clan.manage': '成员',
    'clan.yourRole': '您的身份',
    /* SCRUM-92 — the Home pill's accessibility label. ✅ Simplified, like the rest of
       this table since SCRUM-95, so the pill and its board now agree on BOTH the
       character set and the wording (`role_head` → 族长, matching the board's chip). */
    'clan.pillA11y': '开启您的宗族：%{name}',
    'clan.makeElder': '设为长老',
    'clan.makeCoHead': '设为副族长',
    'clan.rename': '重新命名',
    'clan.renamePrompt': '新的宗族名称',
    'clan.removeMember': '移出宗族',
    'clan.removeConfirm': '将 %{name} 移出宗族？先前的供奉纪录将保留。',
    'clan.leave': '离开此宗族',
    'clan.leaveConfirm': '离开此宗族？先前的供奉纪录将保留。',
    // the SCRUM-84 head-exit ramp — the successor prompt and its refusals
    'clan.leaveHint': '系统将询问由谁接任带领宗族。',
    'clan.nameSuccessor': '指定继任者',
    'clan.successorHint': '选择在您离开后带领宗族的人，或交由加入最久的长老接任。',
    'clan.leaveWithoutSuccessor': '不指定直接离开',
    'clan.leaveNotMember': '您不是此宗族的成员。',
    'clan.leaveSelfSuccessor': '不能指定自己为继任者。',
    'clan.leaveStrangerSuccessor': '此人不是此宗族的成员。',
    'clan.leaveNoSuccessor': '目前没有可接任的人。请先设副族长，或删除宗族。',
    'clan.successorNamed': '现由 %{name} 带领宗族。',
    'clan.successorAuto': '未指定继任者——由加入最久的长老 %{name} 带领宗族。',

    // the FIRST-RUN TUTORIAL (SCRUM-85) — parity is enforced, so BOTH locales
    'tutorial.badge': '示范',
    'tutorial.intro': '首次供奉为示范——您将供奉一份%{item}。不会留下纪录，也不会获得点数。',
    'tutorial.demoStart': '供奉',
    'tutorial.preparing': '正在制作示范供品…',
    'tutorial.preparingNote': '在正式仪式中，您的照片会在此化为纸扎供品。',
    'tutorial.receiptNote': '仅为示范——未获得点数，也未涉及任何宗族。',
    'tutorial.finish': '建立您家族的祭坛',
    'tutorial.startHint': '第一次吗？这次是引导示范。',
    'tutorial.noClanNote': '示范不需要宗族——接下来您将建立或加入一个。',
    // the ACCOUNT (SCRUM-215 · ADR-004) — the boards `ZH · 0d6` / `0d7` / `0c`, both locales
    'account.signupTitle': '创建账号',
    'account.signupSub': '随后即可安奉您的家族神台。',
    'account.signinTitle': '登录或注册新账号',
    'account.signinSub': '登录，回到您的神台。',
    'account.emailLabel': '邮箱',
    'account.emailPlaceholder': '请输入邮箱',
    'account.languageCaption': '语言',
    'account.privacy': '邮箱仅用于登录验证，不会用于广告或信息推送。',
    'account.create': '创建账号',
    'account.sendCode': '发送验证码',
    'account.verifyTitle': '输入验证码',
    'account.verifySub': '验证码已发送至 %{email}',
    'account.resendIn': '%{time} 后可重新发送',
    'account.resendNow': '重新发送验证码',
    'account.editEmail': '邮箱有误？修改',
    'account.tooMany': '验证码刚刚已发送到此邮箱 — 请稍等一分钟后再试。',
    'account.verify': '验证',
    'account.signIn': '登录',
    'account.haveAccount': '已有账号？登录',
    'account.newHere': '还没有账号？创建账号',
    'account.emailInvalid': '请检查邮箱地址后重试。',
    'account.codeWrong': '验证码不正确，请再试一次。',
    'account.genericIssue': '出了点问题，请再试一次。',
    'clan.deleteClan': '删除宗族',
    'clan.deleteConfirm': '删除宗族？所有成员将失去祭坛与供奉簿，无法复原。',

    'book_header': '供奉簿',
    'book_outside': '由宗族成员供奉。',
    'book_window': '仅显示最近一个月。',
    // ⚠️ SCRUM-122 / SCRUM-144 — ✅ **已获签核（2026-10-31 · 方案 A）**：即 doc 15 §8 的 **C18** 行。
    // ⚠️ 用词沿用既有文案（供奉 · 显示），未新增词汇；`check:copy` 规则 4 会比对 §8 与本键。
    'book_empty': '尚无供奉。第一笔将显示在这里。',

    // ── 联赛榜（SCRUM-11 第 6 步 · doc 07 §4.7 · doc 18 E7）────────────────
    'league.title': '联赛',
    'league.week': '%{from} – %{to}',
    'league.yourRank': '你的名次',
    'league.rankN': '第 %{rank} 名',
    'league.points': '%{points}',
    'league.you': '你',
    'league.families': '%{count} 个家族',
    'league.zones': '前三名晋升 · 后三名下降',
    'league.live': '实时',
    'league.unreachable': '暂时无法取得榜单。',
    'league.noWeek': '联赛将在第一次每周结算时开始。',
    'league.notPlaced': '本周你尚未分组——下次结算将为你分组。',
    'league.momentPromotedTitle': '晋升至%{tier}',
    // ⚠️ 正文不再复述机制——标题与段位变化已经说明。每行只补充标题没有说的：
    //    新的一周从哪里开始（晋升）· 新的一周会开始（下降）· 功德点每周重置（留级）。
    //    ⚠️ 留级不再使用 %{tier}，理由相同：标题已经点名段位。
    'league.momentPromotedBody': '新的一周从更高段位开始。',
    'league.momentDemotedTitle': '降至%{tier}',
    'league.momentDemotedBody': '新的一周从今天开始。',
    'league.momentHeldTitle': '留在%{tier}',
    'league.momentHeldBody': '功德点每周重置。',

    'privacy.firstRun':
      '您的照片、先人姓名与祭拜位置只属于您的账号，仅用于制作供品。我们绝不出售这些资料。',
    'privacy.rawPhotoNote': '供品完成后，您的原始照片将于一周内自动删除。',
    'delete_title': '删除所有资料',
    'delete_confirm': '确定删除所有资料？此操作无法复原。',
  },
} as const;

/**
 * ⚠️ THE KEY SEPARATOR — AND WHY `.` IS A BUG HERE.
 *
 * `i18n-js` reads `.` as a SCOPE separator, so `t('ritual.cannotPrepare')` was
 * looked up as the nested path `messages.en.ritual.cannotPrepare`, which does not
 * exist. Every DOTTED key in the table above was therefore unreachable, while
 * every underscore key (`ritual_preparing`, `clan_welcome`) worked — which is
 * exactly the pattern that made it so easy to miss.
 *
 * Found on glass 2026-10-06 (SCRUM-53 / SCRUM-64): the slice's failure screen
 * rendered `[missing "en.ritual.cannotPrepare" translation]` instead of the copy
 * we signed off, so a player hitting a recoverable error was shown nothing
 * readable. It survived the whole gate suite because `check:lib` compared key
 * SETS between the locales — and the one key it happened to interpolate is an
 * underscore one.
 *
 * THE TABLE IS FLAT ON PURPOSE ("one lookup, no nesting rules" — see MESSAGES
 * above), and a dotted key is a flat key that merely LOOKS nested. So the fix is
 * a separator that cannot occur inside a key: scope splitting is disabled
 * entirely, and every key is looked up whole, dots and all.
 *
 * ⚠️ Do not "tidy this away". Deleting it silently re-breaks every dotted key;
 * `check:lib` now asserts that every message RESOLVES, which is the check that
 * was missing the first time.
 */
const FLAT_KEY_SEPARATOR = '\u0000';

const i18n = new I18n(MESSAGES as unknown as Record<string, Record<string, string>>, {
  defaultSeparator: FLAT_KEY_SEPARATOR,
});
i18n.defaultLocale = DEFAULT_LOCALE;
i18n.enableFallback = true;
i18n.locale = DEFAULT_LOCALE;

/** Set the active locale. Both locales are complete, so there is no fallback UI. */
export function setLocale(locale: Locale): void {
  i18n.locale = locale;
}

export function activeLocale(): Locale {
  const current = i18n.locale;
  return (LOCALES as readonly string[]).includes(current) ? (current as Locale) : DEFAULT_LOCALE;
}

/**
 * Pick the ACTIVE locale's field from a bilingual value — the `{ en, zh }` shape used by
 * `domain/aim.ts`, `domain/catalogue.ts` and `domain/throw.ts`.
 *
 * ⚠️ **This exists because screens used to render `{value.zh} {value.en}`** — BOTH
 * languages, in EVERY locale — which is exactly how a panel marked `zh` still showed an
 * English label (and an EN panel showed Chinese). It is now the only supported way to
 * read such a field, and `check:lib` section 16 fails on user-visible copy that does not
 * go through `t()` or this.
 *
 * ⚠️ It reads the locale at CALL time, so a screen re-renders correctly after
 * `setLocale`. Call it inside the render, never once at module scope.
 */
export function localized(value: { readonly en: string; readonly zh?: string }): string {
  if (activeLocale() !== 'zh') return value.en;
  /**
   * ⚠️ A MISSING translation must not silently pass. `check:lib` section 15 asserts that
   * every bilingual value in the domain (`AIM_BANDS`, `OFFERINGS`) carries BOTH fields, so
   * this fallback is unreachable in practice — it exists only so a gap degrades to
   * readable English rather than to a blank label.
   */
  return value.zh ?? value.en;
}

/** Translate. Interpolation uses i18n-js's `%{name}` placeholders. */
export function t(key: string, options?: Record<string, unknown>): string {
  return i18n.t(key, options);
}

/**
 * Pick a supported locale from the device's language tags (as returned by
 * `expo-localization`'s `getLocales()`), e.g. ['zh-Hans-SG','en-SG'] → 'zh'.
 * Anything unrecognised falls back to English — the app is never untranslated.
 */
export function detectLocale(languageTags: readonly string[]): Locale {
  for (const tag of languageTags) {
    const lower = tag.toLowerCase();
    if (lower.startsWith('zh')) return 'zh';
    if (lower.startsWith('en')) return 'en';
  }
  return DEFAULT_LOCALE;
}

/** The keys a locale defines — used by the parity check, and by nothing else. */
export function messageKeys(locale: Locale): string[] {
  return Object.keys(MESSAGES[locale]);
}
