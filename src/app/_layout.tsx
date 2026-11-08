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
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { LocaleProvider } from '@/components/locale-provider';
import { ACCOUNT_ROUTE } from '@/lib/account-flow';
import { SIGN_IN_REQUIRED, ensureAnonymousSession } from '@/lib/session';
import { surface } from '@/theme/tokens';

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
function useIdentityGate(): void {
  const pathname = usePathname();

  useEffect(() => {
    let live = true;
    void (async () => {
      const result = await ensureAnonymousSession();
      if (!live) return;
      if (!result.ok && result.reason === SIGN_IN_REQUIRED && pathname !== ACCOUNT_ROUTE) {
        router.replace(ACCOUNT_ROUTE);
      }
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
  useIdentityGate();

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