import { useLocalSearchParams } from 'expo-router';

import InviteEntry from '@/components/invite-entry';

/**
 * `https://josspaperar.app/join/{CODE}` — the universal link (doc 07 §4.6).
 *
 * ⚠️ The universal link needs the domain to exist AND to serve
 * `/.well-known/assetlinks.json` (Android App Links) or an AASA file (iOS). The
 * domain is still an open PM item — doc 19 §6.2 item 6 / SCRUM-56 — so **this
 * route is currently reachable by the custom scheme and by the in-app scanner
 * only**. The route is correct now and becomes live when the domain lands; the
 * generated QR already carries this link, so nothing else has to change.
 */
export default function InvitePathRoute() {
  const { code } = useLocalSearchParams<{ code?: string }>();
  return <InviteEntry path={typeof code === 'string' ? code : undefined} />;
}
