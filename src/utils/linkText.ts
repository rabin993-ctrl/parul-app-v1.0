import { Platform } from 'react-native';
import { PRODUCTION_SITE_URL } from '../lib/authLinks';

const URL_PATTERN = /https?:\/\/[^\s<>"{}|\\^`[\]]+/gi;

const INTERNAL_HOSTS = new Set([
  'parul.pet',
  'parul.app',
  'localhost',
  '127.0.0.1',
]);

export type AppLinkTarget =
  | { type: 'companion'; companionId: string }
  | { type: 'user'; userId: string }
  | { type: 'feedPost'; postId: string }
  | { type: 'profileFeedPost'; postId: string }
  | { type: 'communityPost'; postId: string }
  | { type: 'external'; url: string };

export type UrlSegment =
  | { kind: 'text'; value: string }
  | { kind: 'url'; value: string };

function trimUrlTrailingPunctuation(url: string): string {
  return url.replace(/[),.;!?]+$/g, '');
}

function normalizeHostname(hostname: string): string {
  return hostname.replace(/^www\./i, '').toLowerCase();
}

export function isInternalShareHost(hostname: string): boolean {
  const host = normalizeHostname(hostname);
  if (INTERNAL_HOSTS.has(host)) return true;
  if (host.endsWith('.localhost')) return true;
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    return normalizeHostname(window.location.hostname) === host;
  }
  return normalizeHostname(new URL(PRODUCTION_SITE_URL).hostname) === host;
}

/** Map a Parul share URL or path to an in-app navigation target. */
export function parseAppShareUrl(raw: string): AppLinkTarget | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  let path = trimmed;
  let externalUrl = trimmed;

  if (/^https?:\/\//i.test(trimmed)) {
    try {
      const url = new URL(trimmed);
      externalUrl = url.toString();
      if (!isInternalShareHost(url.hostname)) {
        return { type: 'external', url: externalUrl };
      }
      path = url.pathname;
    } catch {
      return null;
    }
  } else if (trimmed.startsWith('/')) {
    path = trimmed;
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      externalUrl = `${window.location.origin}${path}`;
    } else {
      externalUrl = `${PRODUCTION_SITE_URL}${path}`;
    }
  } else {
    return null;
  }

  const cleanPath = path.split(/[?#]/)[0] ?? path;

  const companion = cleanPath.match(/^\/profile\/companion\/([^/]+)/);
  if (companion?.[1]) {
    return { type: 'companion', companionId: companion[1] };
  }

  const user = cleanPath.match(/^\/circles\/user\/([^/]+)/);
  if (user?.[1]) {
    return { type: 'user', userId: user[1] };
  }

  const feedPost = cleanPath.match(/^\/post\/([^/]+)/);
  if (feedPost?.[1]) {
    return { type: 'feedPost', postId: feedPost[1] };
  }

  const profileFeedPost = cleanPath.match(/^\/profile\/feed-post\/([^/]+)/);
  if (profileFeedPost?.[1]) {
    return { type: 'profileFeedPost', postId: profileFeedPost[1] };
  }

  const communityPost = cleanPath.match(/^\/community\/post\/([^/]+)/);
  if (communityPost?.[1]) {
    return { type: 'communityPost', postId: communityPost[1] };
  }

  return { type: 'external', url: externalUrl };
}

/** Split plain text into runs of text and http(s) URLs. */
export function segmentUrlsInText(text: string): UrlSegment[] {
  if (!text || !/https?:\/\//i.test(text)) {
    return [{ kind: 'text', value: text }];
  }

  const segments: UrlSegment[] = [];
  let lastIndex = 0;

  for (const match of text.matchAll(URL_PATTERN)) {
    const index = match.index ?? 0;
    if (index > lastIndex) {
      segments.push({ kind: 'text', value: text.slice(lastIndex, index) });
    }

    const raw = match[0];
    const value = trimUrlTrailingPunctuation(raw);
    const trailing = raw.slice(value.length);

    if (value) segments.push({ kind: 'url', value });
    if (trailing) segments.push({ kind: 'text', value: trailing });

    lastIndex = index + raw.length;
  }

  if (lastIndex < text.length) {
    segments.push({ kind: 'text', value: text.slice(lastIndex) });
  }

  return segments.length > 0 ? segments : [{ kind: 'text', value: text }];
}
