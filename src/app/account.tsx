/**
 * ACCOUNT — the email sign-up / sign-in (SCRUM-215 · ADR-004 · its Amendment 1).
 *
 * ⚠️ WHERE THIS SITS. The first-run sequence is **demo → ACCOUNT → clan fork**: ADR-004 Amendment 1
 * made the account **REQUIRED to create or join a clan**, and SCRUM-216's ruling put the demo first.
 * ⚠️ ADR-004 still holds — *"No sign-in wall before the first burn"* — so this screen is reachable
 * **only after the demo**, and `ACCOUNT_GATE` states that as data.
 *
 * ⚠️ THE ONE THING THAT MUST BE RIGHT: the sign-up road is the in-place **UPGRADE** (`updateUser`), so
 * the anonymous device **KEEPS its id** — its tribute wallet, streak, ancestors and league standing come
 * with it. ⚠️ `signInWithOtp` on that road is the second-user bug SCRUM-215 calls *"a failure of this
 * ticket"*. See `lib/account.ts`.
 *
 * ⚠️ TWO THINGS THE BOARDS DRAW THAT ARE DELIBERATELY ABSENT — recorded, not guessed:
 *   · `field · name` (FAMILY NAME, `EN · 0d6` @20,250) — part (A) of **SCRUM-214**, STILL OPEN, with no
 *     agreed write path (the natural column is `profiles.display_label`). ⚠️ So the sign-up carries ONE
 *     field, like the sign-in — a recorded DEVIATION from the board.
 *   · `link · use password` / `link · help` (`EN · 0c`) — phase 1 is **code-only**, and a control that
 *     cannot do what it promises is worse than an absent one.
 *
 * ⚠️ WHAT THE BOARDS DO GET: the header mark, title/sub, the field, the `LANGUAGE` caption (with the
 * real `LocaleToggle` under it — **SCRUM-218**), the privacy note, the 6-box code entry, the resend
 * countdown, and the cross-link between modes.
 */

import { router } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Dimensions, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppMark } from '@/components/home/header-art';
import { LocaleToggle } from '@/components/locale-toggle';
import { confirmAccountCode, isAnonymousSession, sendAccountCode } from '@/lib/account';
import {
  ACCOUNT_CODE_LENGTH,
  AFTER_ACCOUNT_ROUTE,
  emailProblem,
  isCompleteCode,
  issueKeyFor,
  meansSignInInstead,
  normaliseEmail,
  type AccountMode,
} from '@/lib/account-flow';
import { t } from '@/lib/i18n';
import { TOUCH_TARGET, brand, fontSize, onColorCream, radius, space, surface, text } from '@/theme/tokens';

/** Scale from the boards' 390 px reference — the idiom the Store and the picker use. */
function scale(): number {
  return Dimensions.get('screen').width / 390;
}

/**
 * The board geometry, in `EN · 0d6` / `0d7` / `0c` px. ⚠️ Offsets are from the BOARD's top, and the code
 * boxes are the board's own 44×56 at a 54 px pitch (38 → 308 = 5 × 54, symmetric inside 390).
 */
const A = {
  mark: { x: 16, y: 52, size: 48 },
  title: { x: 20, y: 150, w: 350, h: 36 },
  sub: { x: 20, y: 196, w: 350, h: 20 },
  field: { x: 20, y: 250, w: 350, h: 64, labelDy: 12, valueDy: 34, valueX: 40, valueW: 310 },
  caption: { x: 20, y: 400, w: 350, h: 14 },
  toggle: { y: 424 },
  privacy: { x: 20, y: 474, w: 350, h: 36 },
  button: { x: 20, y: 690, w: 350, h: 56 },
  link: { x: 20, y: 764, w: 350, h: 20 },
  otp: { y: 258, size: 44, h: 56, pitch: 54, first: 38 },
  otpText: { y: 334 },
  otpEdit: { y: 366 },
} as const;

/** ⚠️ The boards' resend window (`0:42`) — the same 42 s the countdown renders. */
const RESEND_SECONDS = 42;

type Step = 'email' | 'code';

export default function AccountScreen() {
  const s = scale();
  const insets = useSafeAreaInsets();
  const [mode, setMode] = useState<AccountMode>('signUp');
  /**
   * ⚠️ **IS THERE AN ANONYMOUS SESSION TO UPGRADE?** `null` = not known yet. This is the difference between
   * the two ways this screen is reached (ADR-004 · Amendment 2):
   *   · **first run** — the demo's anonymous session exists, so "Create your account" is the in-place
   *     UPGRADE and keeps the ledger;
   *   · **the sign-in wall** — the device is signed out with NO session, so there is nothing to upgrade and
   *     only **sign in** can work.
   * ⚠️ Leaving the default at `signUp` on the wall would draw "Create your account" over a road that
   * cannot complete — exactly the dead control this project treats as a defect. Found on glass 2026-11-08:
   * the wall opened on *"Create your account"*.
   */
  const [anonymous, setAnonymous] = useState<boolean | null>(null);
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [issue, setIssue] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const emailRef = useRef<TextInput>(null);
  const codeRef = useRef<TextInput>(null);

  /**
   * ⚠️ **THE ROAD IS CHOSEN BY THE SESSION, NOT BY THE SCREEN.** Runs once on mount: with no anonymous
   * session there is nothing to upgrade, so the screen opens on **sign in** and stops offering "create".
   * ⚠️ It never fights the user afterwards — a deliberate `swapMode` is theirs to make.
   */
  useEffect(() => {
    let live = true;
    void isAnonymousSession().then((yes) => {
      if (!live) return;
      setAnonymous(yes);
      if (!yes) setMode('signIn');
    });
    return () => {
      live = false;
    };
  }, []);

  const canSend = emailProblem(email) === null && !busy;
  const canConfirm = isCompleteCode(code) && !busy;

  /**
   * ⚠️ The countdown runs ONLY while the code step shows, and it is a LOCAL timer — nothing is requested
   * by it. At 0 the resend affordance replaces it.
   */
  useEffect(() => {
    if (step !== 'code' || secondsLeft <= 0) return;
    const id = setInterval(() => setSecondsLeft((n) => (n > 0 ? n - 1 : 0)), 1000);
    return () => clearInterval(id);
  }, [step, secondsLeft]);

  const send = useCallback(async () => {
    const address = normaliseEmail(email);
    if (emailProblem(address) !== null) {
      setIssue('account.emailInvalid');
      return;
    }
    setBusy(true);
    setIssue(null);
    const res = await sendAccountCode(mode, address);
    setBusy(false);
    if (!res.ok) {
      /**
       * ⚠️ **THE ONE FAILURE WITH A JOB TO DO.** `updateUser` refuses an email that already belongs to
       * an account, and the RIGHT answer is to SIGN IN — not to reassign the anonymous rows, which is
       * the second user ADR-004 forbids. So that reason turns the MODE rather than printing a server
       * string: the user is already a user, they are just on the wrong screen.
       */
      if (meansSignInInstead(mode, res.reason)) {
        setMode('signIn');
        setIssue('account.haveAccount');
        return;
      }
      setIssue(issueKeyFor(res.reason));
      return;
    }
    setEmail(address);
    setCode('');
    setSecondsLeft(RESEND_SECONDS);
    setStep('code');
  }, [email, mode]);

  const confirm = useCallback(async () => {
    /** ⚠️ The BUTTON is gated by `canConfirm`, but `onSubmitEditing` is NOT — so an Enter with a partial
     *  code would otherwise reach the network. Found on glass, 2026-11-07. */
    if (!isCompleteCode(code)) return;
    setBusy(true);
    setIssue(null);
    const res = await confirmAccountCode(mode, normaliseEmail(email), code.trim());
    setBusy(false);
    if (!res.ok) {
      setIssue(issueKeyFor(res.reason, 'code'));
      return;
    }
    /** ⚠️ The account is done — on to the **clan fork**, which is the next required step. */
    router.replace(AFTER_ACCOUNT_ROUTE);
  }, [code, email, mode]);

  const goStep = useCallback((next: Step) => {
    setIssue(null);
    setStep(next);
    setTimeout(() => (next === 'email' ? emailRef.current : codeRef.current)?.focus(), 60);
  }, []);

  const swapMode = useCallback((next: AccountMode) => {
    setMode(next);
    setIssue(null);
    setStep('email');
    setCode('');
    setSecondsLeft(0);
  }, []);


  /** The board's vertical rhythm: the gap from one element's bottom to the next one's top. */
  const gap = (fromY: number, fromH: number, toY: number) => (toY - fromY - fromH) * s;
  const TOGGLE_H = 32;

  return (
    <View style={styles.screen} testID="account-screen">
      <ScrollView style={styles.scroll} contentContainerStyle={{ paddingTop: insets.top }} keyboardShouldPersistTaps="handled">
        {/* `icon · app mark (header)` — 16,52 48×48. ⚠️ `AppMark` is an `Svg width/height="100%"`, so it
            needs an explicitly sized parent or it fills the whole screen. ⚠️ And the board's `52` is
            measured from the very top of the phone, so the status-bar inset is SUBTRACTED, not added. */}
        <View style={{ marginLeft: A.mark.x * s, marginTop: Math.max(0, A.mark.y * s - insets.top), width: A.mark.size * s, height: A.mark.size * s }}>
          <AppMark />
        </View>

        <Text
          testID="account-title"
          style={[styles.title, { marginLeft: A.title.x * s, marginTop: gap(A.mark.y, A.mark.size, A.title.y), fontSize: fontSize.titlePage.at390 * s }]}
        >
          {t(step === 'code' ? 'account.verifyTitle' : mode === 'signUp' ? 'account.signupTitle' : 'account.signinTitle')}
        </Text>
        <Text style={[styles.sub, { marginLeft: A.sub.x * s, marginTop: gap(A.title.y, A.title.h, A.sub.y), fontSize: fontSize.body.at390 * s }]} testID="account-sub">
          {step === 'code' ? t('account.verifySub', { email }) : t(mode === 'signUp' ? 'account.signupSub' : 'account.signinSub')}
        </Text>

        {step === 'email' ? (
          <>
            {/* `field · email (bg)` — 20,250 350×64; label at +12, the input at +34 */}
            <View style={[styles.field, { marginLeft: A.field.x * s, marginTop: gap(A.sub.y, A.sub.h, A.field.y), width: A.field.w * s, height: A.field.h * s, borderRadius: radius.md }]}>
              <Text style={[styles.fieldLabel, { position: 'absolute', left: (A.field.valueX - A.field.x) * s, top: A.field.labelDy * s, fontSize: fontSize.caption.at390 * s }]}>
                {t('account.emailLabel')}
              </Text>
              <TextInput
                ref={emailRef}
                testID="account-email"
                value={email}
                onChangeText={setEmail}
                placeholder={t('account.emailPlaceholder')}
                placeholderTextColor={text.muted}
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="email"
                keyboardType="email-address"
                textContentType="emailAddress"
                returnKeyType="go"
                onSubmitEditing={() => void send()}
                style={[styles.fieldInput, { position: 'absolute', left: (A.field.valueX - A.field.x) * s, top: A.field.valueDy * s, width: A.field.valueW * s, fontSize: fontSize.bodyLg.at390 * s }]}
              />
            </View>

            {/* `caption · language` — and the ACTUAL switcher beneath it (SCRUM-218) */}
            <Text style={[styles.caption, { marginLeft: A.caption.x * s, marginTop: gap(A.field.y, A.field.h, A.caption.y), fontSize: fontSize.caption.at390 * s }]}>
              {t('account.languageCaption')}
            </Text>
            <View style={{ marginLeft: A.caption.x * s, marginTop: gap(A.caption.y, A.caption.h, A.toggle.y) }}>
              <LocaleToggle testID="account-language" />
            </View>

            {/* `note · privacy` */}
            <Text style={[styles.privacy, { marginLeft: A.privacy.x * s, marginTop: gap(A.toggle.y, TOGGLE_H, A.privacy.y), width: A.privacy.w * s, fontSize: fontSize.caption.at390 * s }]} testID="account-privacy">
              {t('account.privacy')}
            </Text>
          </>
        ) : (

          <>
            {/* `otp · box 1..6` — 44×56 at 38 + 54n, one row */}
            <View style={{ marginTop: gap(A.sub.y, A.sub.h, A.otp.y), marginLeft: A.otp.first * s, flexDirection: 'row', gap: (A.otp.pitch - A.otp.size) * s }}>
              {Array.from({ length: ACCOUNT_CODE_LENGTH }, (_, i) => (
                <Pressable
                  key={i}
                  onPress={() => codeRef.current?.focus()}
                  accessibilityRole="button"
                  testID={`account-otp-${i + 1}`}
                  style={[styles.otp, { width: A.otp.size * s, height: A.otp.h * s, borderRadius: radius.sm * s }]}
                >
                  <Text style={[styles.otpDigit, { fontSize: fontSize.titleRow.at390 * s }]}>{code[i] ?? ''}</Text>
                </Pressable>
              ))}
            </View>
            {/** ⚠️ ONE real input behind the six boxes — what the keyboard and the OS autofill expect. */}
            <TextInput
              ref={codeRef}
              testID="account-code"
              value={code}
              onChangeText={(v) => setCode(v.replace(/\D/g, '').slice(0, ACCOUNT_CODE_LENGTH))}
              keyboardType="number-pad"
              autoComplete="one-time-code"
              textContentType="oneTimeCode"
              returnKeyType="go"
              onSubmitEditing={() => void confirm()}
              style={styles.hidden}
            />

            {secondsLeft > 0 ? (
              <Text style={[styles.caption, { marginLeft: A.caption.x * s, marginTop: gap(A.otp.y, A.otp.h, A.otpText.y), fontSize: fontSize.caption.at390 * s }]} testID="account-resend">
                {t('account.resendIn', { time: `0:${String(secondsLeft).padStart(2, '0')}` })}
              </Text>
            ) : (
              <Pressable onPress={() => void send()} disabled={busy} testID="account-resend-now" style={{ marginLeft: A.caption.x * s, marginTop: gap(A.otp.y, A.otp.h, A.otpText.y), minHeight: TOUCH_TARGET, justifyContent: 'center' }}>
                <Text style={[styles.link, { fontSize: fontSize.body.at390 * s }]}>{t('account.resendNow')}</Text>
              </Pressable>
            )}

            <Pressable onPress={() => goStep('email')} testID="account-edit" style={{ marginLeft: A.caption.x * s, marginTop: gap(A.otpText.y, A.sub.h, A.otpEdit.y), minHeight: TOUCH_TARGET, justifyContent: 'center' }}>
              <Text style={[styles.link, { fontSize: fontSize.body.at390 * s }]}>{t('account.editEmail')}</Text>
            </Pressable>
          </>
        )}

        {issue === null ? null : (
          <Text style={[styles.issue, { marginLeft: A.caption.x * s, marginTop: space.md, width: A.privacy.w * s, fontSize: fontSize.body.at390 * s }]} testID="account-issue">
            {t(issue)}
          </Text>
        )}

        {/* `btn` — 20,690 350×56, cinnabar. ⚠️ Disabled reads FAINTER, not merely inert. */}
        <Pressable
          testID="account-primary"
          accessibilityRole="button"
          disabled={step === 'email' ? !canSend : !canConfirm}
          onPress={() => void (step === 'email' ? send() : confirm())}
          style={[
            styles.button,
            {
              marginLeft: A.button.x * s,
              marginTop: gap(A.privacy.y, A.privacy.h, A.button.y),
              width: A.button.w * s,
              height: A.button.h * s,
              borderRadius: radius.md,
              opacity: (step === 'email' ? canSend : canConfirm) ? 1 : 0.5,
            },
          ]}
        >
          <Text style={[styles.buttonLabel, { fontSize: fontSize.bodyLg.at390 * s }]}>
            {t(step === 'email' ? (mode === 'signUp' ? 'account.create' : 'account.sendCode') : mode === 'signUp' ? 'account.verify' : 'account.signIn')}
          </Text>
        </Pressable>

        {/* `link` — the cross-link at y 764
            ⚠️ **AND IT IS NOT ALWAYS OFFERED** (ADR-004 · Amendment 2): "New here? Create an account" is the
            UPGRADE road, which needs an anonymous session. On the sign-in wall there is none, so the link
            would promise something that cannot complete — the dead-control defect this project refuses. */}
        {mode === 'signUp' || anonymous !== false ? (
          <Pressable
            testID="account-swap"
            accessibilityRole="button"
            onPress={() => swapMode(mode === 'signUp' ? 'signIn' : 'signUp')}
            style={{ marginLeft: A.link.x * s, marginTop: gap(A.button.y, A.button.h, A.link.y), minHeight: TOUCH_TARGET, justifyContent: 'center' }}
          >
            <Text style={[styles.link, { fontSize: fontSize.body.at390 * s }]}>
              {t(mode === 'signUp' ? 'account.haveAccount' : 'account.newHere')}
            </Text>
          </Pressable>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: surface.paper },
  scroll: { flex: 1 },
  title: { color: text.ink, fontWeight: '700' },
  sub: { color: text.inkSoft },
  field: { backgroundColor: surface.paperDeep, justifyContent: 'flex-start' },
  fieldLabel: { color: text.inkSoft, letterSpacing: 0.6 },
  fieldInput: { color: text.ink, padding: 0 },
  caption: { color: text.inkSoft, letterSpacing: 0.6, textTransform: 'uppercase' },
  privacy: { color: text.inkSoft, lineHeight: 16 },
  issue: { color: brand.cinnabar, fontWeight: '700' },
  button: { backgroundColor: brand.cinnabar, alignItems: 'center', justifyContent: 'center', minHeight: TOUCH_TARGET },
  buttonLabel: { color: onColorCream, fontWeight: '700' },
  link: { color: text.azurite, fontWeight: '700' },
  otp: { backgroundColor: surface.paperDeep, alignItems: 'center', justifyContent: 'center' },
  otpDigit: { color: text.ink, fontWeight: '700' },
  hidden: { position: 'absolute', width: 1, height: 1, opacity: 0 },
});

