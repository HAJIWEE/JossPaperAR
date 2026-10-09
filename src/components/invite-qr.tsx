import { useCallback, useState } from 'react';
import { Share, StyleSheet, Text, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

import { INVITE_SHARE_COPY, inviteLink, qrPayload } from '@/lib/invites';
import { isInvitePayloadSafe } from '@/lib/invite-flow';
import { activeLocale, t } from '@/lib/i18n';
import { brand, fontSize, radius, space, surface, text, TOUCH_TARGET } from '@/theme/tokens';
import { GhostButton, Label } from '@/components/clan-ui';

/**
 * The invite card's QR (SCRUM-50 · doc 07 §4.6 · boards SCRUM-48 `0e4` / `0e9`).
 *
 * ⚠️ GENERATED AT RUNTIME, NEVER COPIED FROM THE DESIGN. The QR drawn on the
 * Penpot boards (`0e6` · `0e9`) is a decorative, deliberately NON-SCANNABLE
 * placeholder — doc 07 §4.6 says so explicitly, because a designer's plausible
 * pattern is exactly the kind of asset that gets exported "to save time" and
 * ships as a code that scans to nothing.
 *
 * ⚠️ `react-native-svg` is INCLUDED IN EXPO GO (Expo SDK 57 docs), so this does
 * not force a development build — which matters, because the project has no
 * `expo-dev-client` and the device run is Expo Go (trap 4).
 *
 * ⚠️ The payload is the DEEP LINK, not the code (`invites.ts`'s `qrPayload`), so
 * one payload serves QR · link · share sheet. It is asserted safe before render:
 * a payload carrying clan data would be a privacy leak on a screen anyone can
 * photograph (doc 13 §4).
 */

/** The scanner needs real contrast; white is not a design-token decision. */
const QR_BACKGROUND = '#FFFFFF';
const QR_MODULE_COLOR = brand.ink;
/** The spec's required quiet zone. Without it many scanners cannot lock on. */
const QR_QUIET_ZONE = 8;

export function InviteQr({ code, size = 180 }: { code: string; size?: number }) {
  const [failed, setFailed] = useState(false);

  if (!isInvitePayloadSafe(code) || failed) {
    // ⚠️ Never render a half-built QR: a code that failed to encode would scan
    // to nothing and read as "the invite works, the other person's phone is
    // broken". Showing the code as text instead is honest and still usable.
    return <Text style={styles.qrFallback}>{failed ? t('invite.qrFailed') : t('invite.qrUnavailable')}</Text>;
  }

  return (
    <View style={styles.qrFrame} testID="invite-qr">
      <QRCode
        value={qrPayload(code)}
        size={size}
        color={QR_MODULE_COLOR}
        backgroundColor={QR_BACKGROUND}
        quietZone={QR_QUIET_ZONE}
        ecl="M"
        onError={() => setFailed(true)}
      />
    </View>
  );
}

/**
 * The whole invite surface: QR · the code in a readable size · Share.
 *
 * ⚠️ Share is the ONLY way the code leaves the device (doc 19 §3.5). There is no
 * upload, no server call, no analytics event — see the acceptance list on
 * SCRUM-50 ("no invite code appears in analytics or logs").
 */
export function InviteCard({ clanName, code }: { clanName: string; code: string }) {
  const onShare = useCallback(async () => {
    const copy = INVITE_SHARE_COPY[activeLocale()](clanName, code);
    try {
      await Share.share({ message: `${copy}\n${inviteLink(code)}` });
    } catch {
      // The share sheet can be dismissed or unavailable; the code is still on
      // screen and selectable, so a failed share is not a dead end.
    }
  }, [clanName, code]);

  return (
    <View style={styles.card}>
      <InviteQr code={code} />
      <Label>{t('clan_code')}</Label>
      <Text testID="clan-invite-code" selectable style={styles.code}>
        {code}
      </Text>
      <GhostButton testID="clan-invite-share" label={t('clan.invite')} onPress={() => void onShare()} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: { marginTop: space.sm, marginBottom: space.sm },
  qrFrame: {
    alignSelf: 'flex-start',
    backgroundColor: QR_BACKGROUND,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: surface.paperEdge,
    padding: space.sm,
    marginBottom: space.md,
    minHeight: TOUCH_TARGET,
  },
  qrFallback: { color: text.cinnabar, fontSize: fontSize.body.at390, marginVertical: space.md },
  code: {
    color: text.ink,
    fontSize: fontSize.titleScreen.at390,
    fontWeight: '700',
    letterSpacing: 4,
    marginBottom: space.sm,
  },
});
