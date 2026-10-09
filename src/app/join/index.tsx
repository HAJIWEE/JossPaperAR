import { useLocalSearchParams } from 'expo-router';

import InviteEntry from '@/components/invite-entry';

/**
 * `josspaperar://join?code={CODE}` — the custom-scheme fallback (doc 07 §4.6).
 *
 * ⚠️ BOTH shapes must exist as routes: the query form is what the fallback
 * scheme produces, and the path form (`/join/{code}`) is what the universal
 * link `https://josspaperar.app/join/{code}` produces. expo-router needs a file
 * for each, so `join/index.tsx` and `join/[code].tsx` differ only in where the
 * code came from — the parsing, the hold and the join are all shared.
 */
export default function InviteQueryRoute() {
  const { code } = useLocalSearchParams<{ code?: string }>();
  return <InviteEntry query={typeof code === 'string' ? code : undefined} />;
}
