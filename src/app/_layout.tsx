/**
 * ⚠️ FIRST IMPORT, ON PURPOSE — it must not be reordered.
 *
 * It installs `expo-blob`'s Blob as `globalThis.Blob` (module side effect). That
 * is what switches `expo/fetch`'s `Response.blob()` off React Native's Blob
 * (native blob store + base64) and onto a native byte read. `isReactNativeBlobGlobal()`
 * is evaluated per `.blob()` call, so this only has to land before the first one —
 * and this file is the earliest app code there is. See `src/lib/blob-polyfill.ts`.
 */
import '@/lib/blob-polyfill';

import { Stack, router, usePathname } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { LocaleProvider } from '@/components/locale-provider';
import { ACCOUNT_ROUTE } from '@/lib/account-flow';
import { INTRO_ROUTE, shouldShowIntro } from '@/lib/intro';
import { readIntroSeen } from '@/lib/intro-seen';
import { SIGN_IN_REQUIRED, ensureAnonymousSession } from '@/lib/session';
import { surface } from '@/theme/tokens';

/**
 * ⚠️⚠️ **THE SPLASH IS HELD FROM MODULE SCOPE, NOT FROM A HOOK (SCRUM-172).**
 *
 * ⚠️ **THE FLASH THIS FIXES.** With no call here, `expo-splash-screen` auto-hides *"when your app
 * is ready"* — which is before the shrine's first frame is committed. Cold start therefore showed
 * a blank/scaffold frame and then the shrine. The ticket's acceptance is the opposite: the splash
 * visible **before any Home content, with no flash of the scaffold first**.
 *
 * ⚠️ **MODULE SCOPE IS THE SDK'S OWN INSTRUCTION**, verbatim: *"It is recommended to call this in
 * global scope without awaiting, rather than inside React components or hooks, because otherwise
 * this might be called too late, when the splash screen is already hidden."* Putting it in a
 * `useEffect` would reproduce the very flash it exists to prevent.
 *
 * ⚠️ Not awaited, and the rejection is swallowed: a device where the native module misbehaves must
 * still boot. The splash is a **cover, never a gate**.
 */
void SplashScreen.preventAutoHideAsync().catch(() => {});

/**
 * ⚠️ **HIDE IT ONCE THE TREE HAS PAINTED — AND NEVER ON THE SESSION (SCRUM-172).**
 *
 * ⚠️⚠️ **THE CONSTRAINT THIS TICKET NAMES.** `RootLayout` fires `ensureAnonymousSession()` and
 * deliberately does **not** block the app on it (ADR-004: a slow bootstrap must be un-warm, never
 * fatal). **So the splash must not become a gate on that call** — a cover that waited for the
 * session would hold the splash through a slow network and hold it *forever* on a failed one.
 *
 * ✅ **This hook touches nothing but the splash.** It has no dependency on the identity gate, and
 * `check:lib` proves that by slicing this function out of the file and asserting it never mentions
 * `ensureAnonymousSession` — a comment cannot be enforced; a slice can.
 *
 * ⚠️ **WHY THE ROOT'S `useEffect` AND NOT A CHILD SCREEN:** React runs a **child's** effects before
 * its **parent's**, so when this parent effect runs the whole tree — shrine included — has already
 * committed. One `requestAnimationFrame` on top moves the hide to after that paint rather than
 * between the commit and it, which is the difference between a clean hand-off and a one-frame
 * flash of background colour.
 *
 * ⚠️ **NOT VERIFIABLE IN EXPO GO** — since SDK 52 it shows the app icon instead of the real splash,
 * so the timing can only be judged in a release build. Recorded rather than assumed.
 */
function useSplashCover(): void {
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      void SplashScreen.hideAsync().catch(() => {});
    });
    return () => cancelAnimationFrame(frame);
  }, []);
}

/**
 * ⚠️ **THE IDENTITY GATE — `ADR-004 · Amendment 2` (2026-11-08).**
 *
 * The owner's ruling: *"the Demo should only be on first install of the App and signing out does not return
 * us to anon status but require a sign in every time."*
 *
 * It does TWO things, and both are needed:
 *   1. **bootstraps the identity** — on a device still owed its demo this mints the anonymous session the
 *      demo needs; on any other it must NOT (see `session.ts`);
 *   2. **is the sign-in wall** — a device that is past its demo and has no session goes to `/account`.
 *
 * ⚠️ **Without (2) a sign-out would be a dead end**: `signOutAccount()` deliberately leaves the device with
 * no session, so every authenticated read would answer `42501` behind a shrine that still renders.
 *
 * ⚠️ **IT KEYS ON `SIGN_IN_REQUIRED` ALONE, and that is the whole discipline.** Every other failure — a
 * blip, a timeout, `not_configured`, a refused anonymous sign-in — must **NOT** bounce a signed-in user to
 * a sign-in wall. A network failure and a sign-out are not the same fact; treating one as the other turns a
 * bad signal into "you have been logged out", which is the worst copy in the app.
 *
 * ⚠️ **And it exempts `/account` itself** — otherwise the redirect would point at the screen it is already
 * on, which is a loop. The route is on `pathname` so the effect re-runs on every navigation: a signed-out
 * user who reaches the shrine some other way (a deep link, a back gesture) is put back on the wall.
 */
function useBootGate(): void {
  const pathname = usePathname();

  useEffect(() => {
    let live = true;
    void (async () => {
      const result = await ensureAnonymousSession();
      if (!live) return;

      // ⚠️ THE WALL WINS. A device that must sign in is NEVER bounced to the
      // intro — the sign-in decision is the stronger fact, and stacking a second
      // redirect over it is how a boot flow starts to lie.
      if (!result.ok && result.reason === SIGN_IN_REQUIRED) {
        if (pathname !== ACCOUNT_ROUTE) router.replace(ACCOUNT_ROUTE);
        return;
      }

      // ⚠️ SCRUM-169 — OFFER THE INTRO ONCE, FROM THE ROOT ONLY.
      // `shouldShowIntro` is pure and asserted by `check:lib`, so "exactly once"
      // is a tested fact rather than a boot flow nobody can observe. ⚠️ It is
      // read AFTER the identity outcome, so a slow bootstrap cannot pre-empt the
      // wall, and `onboarding.tsx` still never reads the flag itself.
      const introSeen = await readIntroSeen();
      if (!live) return;
      if (shouldShowIntro(pathname, introSeen)) router.replace(INTRO_ROUTE);
    })();
    return () => {
      live = false;
    };
  }, [pathname]);
}

/**
 * The root navigator (doc 19 §7).
 *
 * Routes live in `src/app/` — every file there is a screen. Non-route code stays
 * OUTSIDE `src/app/` (components · theme · domain · features · lib), which is why
 * this file only wires providers and a `Stack`.
 *
 * Scaffold note (SCRUM-57): the route tree is deliberately tiny here. Home is a
 * shell that proves the theme bridge is live; the ritual routes (capture → burn →
 * reward) land with the slice (SCRUM-53, doc 19 §8 PR-4).
 */
export default function RootLayout() {
  /**
   * ⚠️ ORDER IS LOAD-BEARING AND IS NOT COSMETIC: the splash cover is installed **first**, so the
   * identity gate — which fires `ensureAnonymousSession()` — can never be what the cover waits on.
   * They are two independent effects and neither can hold the other.
   */
  useSplashCover();
  /**
   * ⚠️ ONE gate, not two (SCRUM-169). The identity outcome and the intro are
   * decided together so they cannot race: a device that must sign in is never
   * also sent to the panels.
   */
  useBootGate();

  return (
    <SafeAreaProvider>
      {/* light artwork on cream paper → dark icons (doc 19 §4.4) */}
      <StatusBar style="dark" />
      {/*
        ⚠️ NO explicit `<Stack.Screen>` children here, deliberately.
        `ancestor` was declared with `options={{ presentation: 'modal' }}` and that made it the
        stack's INITIAL route on glass: the app booted straight onto the tablet sheet, `router.back()`
        answered *"the action GO_BACK was not handled by any navigator"*, and Home never mounted.
        The sheet reads `clanId` from its params, so with no push it saw `null` — and told a clan
        HEAD that only a head may edit the altar.
        ⚠️ A route file is enough. Options belong in the layout only when they cannot change routing,
        and this one did.
      */}
      {/*
        ⚠️ `LocaleProvider` wraps the WHOLE navigator, and it REMOUNTS it on a language change
        (`key={locale}` inside the provider). That is deliberate and load-bearing: `t()` reads
        `i18n.locale` at call time and React cannot see that dependency, so nothing short of a
        remount guarantees "every visible string changes" — see the provider's header.
        ⚠️ The cost is that a language change restarts navigation at the shrine.
      */}
      <LocaleProvider>
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: surface.paper },
          }}
        />
      </LocaleProvider>
    </SafeAreaProvider>
  );
}