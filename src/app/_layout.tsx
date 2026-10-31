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

import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ensureAnonymousSession } from '@/lib/session';
import { surface } from '@/theme/tokens';

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
  // ADR-004 / SCRUM-80 — the device adopts an anonymous session at first launch,
  // BEFORE any ritual call, so the very first burn needs no account and no sign-in
  // wall. Fire-and-forget: the ritual re-ensures at its own network boundary, so a
  // slow or failed attempt here is merely un-warm, never fatal.
  useEffect(() => {
    void ensureAnonymousSession();
  }, []);

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
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: surface.paper },
        }}
      />
    </SafeAreaProvider>
  );
}