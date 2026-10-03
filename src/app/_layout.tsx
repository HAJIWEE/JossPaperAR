import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

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