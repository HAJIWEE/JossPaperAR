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
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: surface.paper },
        }}
      />
    </SafeAreaProvider>
  );
}