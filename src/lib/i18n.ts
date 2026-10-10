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
    'capture.cameraNeeded': 'The camera is needed',
    'capture.cameraWhy':
      'The offering is the object you would like to burn. Nothing leaves this phone without your permission to photograph it.',
    'capture.photoHint': 'Photograph the offering',
    'capture.failed': 'The photo was not taken — nothing has been used.',
    'capture.tryAgain': 'Try again',
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
    'home.begin': 'Begin an offering',
    'home.clanEntry': 'Clan',

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
      'This first offering is a demonstration. Nothing is recorded and no points are earned.',
    'tutorial.preparing': 'Preparing a demo offering…',
    'tutorial.preparingNote':
      'In the real ritual this is where your photo becomes a paper offering.',
    'tutorial.receiptNote': 'Demo only — no points were earned and no clan was touched.',
    'tutorial.finish': "Build your family's altar",
    'tutorial.startHint': 'First time? This one is a guided demo.',
    'tutorial.noClanNote': 'The demo needs no clan — you will create or join one next.',
    'clan.deleteClan': 'Delete this clan',
    'clan.deleteConfirm':
      'Delete this clan? Every member loses the altar and the Book of Tributes. This cannot be undone.',

    // ── the Book of Tributes (doc 15 §7) ──────────────────────────────────
    'book_header': 'Book of Tributes',
    'book_outside': 'A member made this offering.',
    'book_window': 'Showing the last month.',

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
    'capture.cameraNeeded': '需要使用相机',
    'capture.cameraWhy': '供品就是您想焚烧的物品。未获得您的拍照许可，任何内容都不会离开这台手机。',
    'capture.photoHint': '拍摄供品',
    'capture.failed': '未能拍下照片——未消耗任何内容。',
    'capture.tryAgain': '再试一次',
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
    'home.begin': '开始供奉',
    'home.clanEntry': '宗族',

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
    'tutorial.intro': '首次供奉为示范。不会留下纪录，也不会获得点数。',
    'tutorial.preparing': '正在制作示范供品…',
    'tutorial.preparingNote': '在正式仪式中，您的照片会在此化为纸扎供品。',
    'tutorial.receiptNote': '仅为示范——未获得点数，也未涉及任何宗族。',
    'tutorial.finish': '建立您家族的祭坛',
    'tutorial.startHint': '第一次吗？这次是引导示范。',
    'tutorial.noClanNote': '示范不需要宗族——接下来您将建立或加入一个。',
    'clan.deleteClan': '删除宗族',
    'clan.deleteConfirm': '删除宗族？所有成员将失去祭坛与供奉簿，无法复原。',

    'book_header': '供奉簿',
    'book_outside': '由宗族成员供奉。',
    'book_window': '仅显示最近一个月。',

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
