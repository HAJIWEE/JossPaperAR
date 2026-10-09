import { useLocalSearchParams } from 'expo-router';

import ClanJoin from '@/components/clan-join';

/**
 * JOIN — doc 15 §4.3, reachable from the fork, and the landing point for a
 * SCANNED invite (`/clan/scan` hands the code over here as a param).
 *
 * ⚠️ The body is `components/clan-join.tsx`, shared with the deep-link route
 * (`/join`) so a link joiner and a typist resolve a code by the SAME rules
 * (SCRUM-50). Non-route code must not live under `src/app/` (AGENTS.md).
 */
export default function ClanJoinScreen() {
  const { code } = useLocalSearchParams<{ code?: string }>();
  return <ClanJoin initialCode={typeof code === 'string' ? code : null} />;
}
