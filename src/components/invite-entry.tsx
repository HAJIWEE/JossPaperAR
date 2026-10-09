import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useLinkingURL } from 'expo-linking';

import { GhostButton, PageTitle, Screen } from '@/components/clan-ui';
import { holdInvite } from '@/lib/held-invite';
import { HELD_INVITE_KEY_BY_REASON, shouldHoldInvite } from '@/lib/invite-flow';
import { parseInviteUrl } from '@/lib/invites';
import { ensureAnonymousSession } from '@/lib/session';
import { t } from '@/lib/i18n';
import { text } from '@/theme/tokens';

/**
 * The DEEP-LINK ENTRY — where a family link lands (SCRUM-50 · doc 07 §4.6).
 *
 * Two routes render this: `/join?code={CODE}` (the custom scheme
 * `josspaperar://join?code=…`) and `/join/{CODE}` (the universal link
 * `https://josspaperar.app/join/{CODE}`). Both shapes, plus a bare code and a
 * percent-encoded wrapper, are read by the ONE parser in `invites.ts` — this
 * screen never invents a second notion of "what an invite looks like".
 *
 * ⚠️ THE JOB HERE IS THE HOLD, and it is the reason this is a screen rather
 * than a redirect. doc 07 §4.6: "an invite opened **before first-run completes
 * is held**, then applied once the user has an identity". The recipient of a
 * family link is very often a BRAND-NEW user: the app cold-starts, there is no
 * session yet, and the invite must survive that rather than dead-end.
 *
 * ⚠️ A FAILED SESSION IS NOT AN ERROR SCREEN. The user did nothing wrong; the
 * device is simply not ready. So the invite is parked and the copy says so —
 * the fork will offer it again (see `src/app/clan/index.tsx`).
 */

/** Everything a link could have arrived as, in the order we prefer them. */
export interface InviteCandidates {
  /** the `[code]` path segment, if the route has one */
  readonly path?: string | undefined;
  /** the `?code=` query value, if the route has one */
  readonly query?: string | undefined;
}

export default function InviteEntry({ path, query }: InviteCandidates) {
  /** The raw URL the app was opened with — covers links the router did not parse. */
  const url = useLinkingURL();

  const [state, setState] = useState<'working' | 'held' | 'unreadable'>('working');
  const [holdKey, setHoldKey] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      // ⚠️ Order matters only for speed, not for correctness: every candidate
      // goes through the same parser, so a link that arrives in an unexpected
      // shape still resolves.
      const code =
        parseInviteUrl(path) ?? parseInviteUrl(query) ?? parseInviteUrl(url) ?? null;

      if (!code) {
        if (!cancelled) setState('unreadable');
        return;
      }

      // ADR-004 — the device needs an identity before ANY clan call can mean
      // anything, and a cold start has not made one yet.
      const session = await ensureAnonymousSession();
      if (cancelled) return;

      // ⚠️ `reached: true` — reachability is not probed HERE. A stored session
      // resolves offline, and the first real network call is the preview; when
      // that fails, `clan-join.tsx` parks the invite with reason `offline`. So
      // both hold reasons are reachable, each from the layer that actually knows.
      const reason = shouldHoldInvite({ sessionOk: session.ok, reached: true, code });
      if (reason) {
        await holdInvite(code, reason);
        if (cancelled) return;
        setHoldKey(HELD_INVITE_KEY_BY_REASON[reason]);
        setState('held');
        return;
      }

      // The invite is good and the device is ready — hand it to the one join body.
      router.replace({ pathname: '/clan/join', params: { code } });
    })();

    return () => {
      cancelled = true;
    };
  }, [path, query, url]);

  return (
    <Screen>
      <PageTitle>{t('clan.forkJoin')}</PageTitle>

      {state === 'working' ? <ActivityIndicator testID="invite-entry-working" /> : null}

      {state === 'held' ? (
        <View testID="invite-entry-held">
          <Text style={styles.notice}>{t(holdKey ?? 'invite.heldNoIdentity')}</Text>
          <GhostButton
            label={t('clan.forkTitle')}
            onPress={() => {
              router.replace('/clan');
            }}
          />
        </View>
      ) : null}

      {state === 'unreadable' ? (
        <View testID="invite-entry-unreadable">
          <Text style={styles.problem}>{t('invite.unreadableLink')}</Text>
          <GhostButton
            label={t('invite.typeCode')}
            onPress={() => {
              router.replace('/clan/join');
            }}
          />
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  notice: { color: text.inkSoft, fontSize: 15, lineHeight: 22, marginBottom: 12 },
  problem: { color: text.cinnabar, fontSize: 15, marginBottom: 12 },
});
