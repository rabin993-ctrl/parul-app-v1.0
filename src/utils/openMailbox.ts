import { Linking, Platform } from 'react-native';

type Provider = {
  label: string;
  /** Webmail inbox URL (web). */
  web: string;
  /** Native app URL scheme to open the inbox, if the app exposes one. */
  native?: string;
};

function providerFor(email: string): Provider | null {
  const domain = email.split('@')[1]?.toLowerCase().trim();
  if (!domain) return null;
  const encoded = encodeURIComponent(email.trim());

  if (domain === 'gmail.com' || domain === 'googlemail.com') {
    // authuser hints which signed-in Gmail to land in (Gmail still picks among
    // signed-in accounts, but this targets the right one when available).
    return { label: 'Gmail', web: `https://mail.google.com/mail/u/?authuser=${encoded}`, native: 'googlegmail://' };
  }
  if (['outlook.com', 'hotmail.com', 'live.com', 'msn.com'].includes(domain)) {
    return { label: 'Outlook', web: 'https://outlook.live.com/mail/', native: 'ms-outlook://' };
  }
  if (['yahoo.com', 'ymail.com', 'rocketmail.com'].includes(domain)) {
    return { label: 'Yahoo Mail', web: 'https://mail.yahoo.com/', native: 'ymail://' };
  }
  if (['icloud.com', 'me.com', 'mac.com'].includes(domain)) {
    return { label: 'iCloud Mail', web: 'https://www.icloud.com/mail' };
  }
  if (['proton.me', 'protonmail.com', 'pm.me'].includes(domain)) {
    return { label: 'Proton Mail', web: 'https://mail.proton.me/' };
  }
  if (domain === 'aol.com') {
    return { label: 'AOL Mail', web: 'https://mail.aol.com/' };
  }
  return null;
}

/**
 * Label for the "open mailbox" button, or null when there's nothing reliable to
 * open (an unrecognised provider on web — we can't guess their webmail). On
 * native we can always fall back to the system mail app, so a label is returned.
 */
export function mailboxButtonLabel(email: string): string | null {
  const provider = providerFor(email);
  if (provider) return `Open ${provider.label}`;
  if (Platform.OS !== 'web') return 'Open email app';
  return null;
}

/** Open the recipient's webmail (web) or mail app (native). Inbox only — there's no way to deep-link a single message. */
export async function openMailbox(email: string): Promise<void> {
  const provider = providerFor(email);

  if (Platform.OS === 'web') {
    if (typeof window === 'undefined') return;
    const url = provider?.web;
    if (url) window.open(url, '_blank', 'noopener,noreferrer');
    return;
  }

  if (provider?.native) {
    try {
      if (await Linking.canOpenURL(provider.native)) {
        await Linking.openURL(provider.native);
        return;
      }
    } catch {
      // fall through to the system mail app
    }
  }

  // Fallback: open the default mail app. message:// opens Apple Mail's inbox;
  // mailto: at least surfaces the default mail client on Android.
  const fallback = Platform.OS === 'ios' ? 'message://' : 'mailto:';
  try {
    await Linking.openURL(fallback);
  } catch {
    // nothing else we can do
  }
}
