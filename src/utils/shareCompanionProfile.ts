import { supabase } from '../lib/supabase';
import type { ForwardDest } from '../components/ForwardSheet';
import type { Companion } from '../data/mockData';
import { formatCompanionHandleLabel } from './companionHandle';
import { parseAppShareUrl } from './linkText';
import { companionProfileShareUrl } from './shareLinks';

export const COMPANION_PROFILE_DEEP_LINK_RE = /parul:\/\/companion\/([0-9a-f-]{36})/i;
export const COMPANION_PROFILE_URL_RE = /https?:\/\/[^\s]*\/profile\/companion\/([0-9a-f-]{36})/i;

export type CompanionProfileSharePreview = {
  name: string;
  handleLabel?: string;
  metaLine?: string;
  bioSnippet?: string;
};

export type ParsedCompanionProfileShare = {
  companionId: string;
  preview?: CompanionProfileSharePreview;
};

function extractCompanionId(text: string): string | null {
  const trimmed = text.trim();
  const deepMatch = trimmed.match(COMPANION_PROFILE_DEEP_LINK_RE);
  if (deepMatch?.[1]) return deepMatch[1];

  for (const line of trimmed.split('\n')) {
    const target = parseAppShareUrl(line.trim());
    if (target?.type === 'companion') return target.companionId;
  }

  const urlMatch = trimmed.match(COMPANION_PROFILE_URL_RE);
  return urlMatch?.[1] ?? null;
}

export function isCompanionProfileShareText(text: string): boolean {
  return extractCompanionId(text) !== null;
}

export function parseCompanionProfileShareText(text: string): ParsedCompanionProfileShare | null {
  const trimmed = text.trim();
  const companionId = extractCompanionId(trimmed);
  if (!companionId) return null;

  const withoutLinks = trimmed
    .replace(/\n?parul:\/\/companion\/[0-9a-f-]+/gi, '')
    .replace(/\n?https?:\/\/[^\s]*\/profile\/companion\/[0-9a-f-]+/gi, '')
    .trim();
  const lines = withoutLinks.split('\n').map(l => l.trim()).filter(Boolean);

  if (lines.length === 0) return { companionId };

  const line0 = lines[0]!;
  let name = line0;
  let handleLabel: string | undefined;
  const handleSep = line0.lastIndexOf(' · ');
  if (handleSep >= 0 && line0.slice(handleSep + 3).trim().startsWith('#')) {
    name = line0.slice(0, handleSep).trim();
    handleLabel = line0.slice(handleSep + 3).trim();
  }

  return {
    companionId,
    preview: {
      name,
      handleLabel,
      metaLine: lines[1],
      bioSnippet: lines[2],
    },
  };
}

function formatMetaLine(companion: Companion): string {
  const parts = [
    companion.breed && companion.breed !== '—' ? companion.breed : null,
    companion.age && companion.age !== '—' ? companion.age : null,
    companion.species && companion.species !== '—' ? companion.species : null,
  ].filter(Boolean);
  return parts.join(' · ');
}

function buildCompanionShareText(companion: Companion): { title: string; body: string } {
  const handleLabel = formatCompanionHandleLabel(companion.handle, companion.name);
  const metaLine = formatMetaLine(companion);
  const bioSnippet = companion.about?.trim()
    ? (companion.about.length > 120 ? `${companion.about.slice(0, 117)}…` : companion.about)
    : '';
  const deepLink = `parul://companion/${companion.id}`;
  const webLink = companionProfileShareUrl(companion.id);

  const title = `Companion profile: ${companion.name}`;
  const bodyParts = [
    `${companion.name} · ${handleLabel}`,
    metaLine,
    bioSnippet,
    deepLink,
    webLink,
  ].filter(Boolean);

  return { title, body: bodyParts.join('\n') };
}

export async function shareCompanionProfile(
  companion: Companion,
  dests: ForwardDest[],
  userId: string,
  note?: string,
): Promise<void> {
  const trimmedNote = note?.trim();
  const { title, body } = buildCompanionShareText(companion);

  for (const dest of dests) {
    if (dest.type === 'circle' && dest.dbId) {
      if (trimmedNote) {
        await supabase.from('circle_messages').insert({
          circle_id: dest.dbId,
          type: 'text',
          sender_user_id: userId,
          text: trimmedNote,
        });
      }
      await supabase.from('circle_messages').insert({
        circle_id: dest.dbId,
        type: 'text',
        sender_user_id: userId,
        text: body,
      });
    } else if (dest.type === 'community') {
      const sharedBody = trimmedNote ? `${trimmedNote}\n\n${body}` : body;
      const postTitle = title.length > 80 ? `${title.slice(0, 77)}…` : title;
      await supabase.from('community_posts').insert({
        community_id: dest.id,
        author_user_id: userId,
        title: postTitle,
        body: sharedBody,
        category: 'general',
      });
    } else if (dest.type === 'member') {
      const { data: existing } = await supabase
        .from('thread_participants')
        .select('thread_id, threads!inner(type)')
        .eq('user_id', dest.id)
        .filter('threads.type', 'eq', 'dm');

      let threadId: string | null = null;
      if (existing && existing.length > 0) {
        const { data: mine } = await supabase
          .from('thread_participants')
          .select('thread_id')
          .eq('user_id', userId)
          .in('thread_id', (existing as { thread_id: string }[]).map(r => r.thread_id));
        threadId = (mine as { thread_id: string }[] | null)?.[0]?.thread_id ?? null;
      }

      if (!threadId) {
        const { data: newThread } = await supabase
          .from('threads')
          .insert({ type: 'dm' })
          .select('id')
          .single();
        if (!newThread) continue;
        threadId = (newThread as { id: string }).id;
        await supabase.from('thread_participants').insert([
          { thread_id: threadId, user_id: userId },
          { thread_id: threadId, user_id: dest.id },
        ]);
      }

      if (trimmedNote) {
        await supabase.from('messages').insert({
          thread_id: threadId,
          sender_user_id: userId,
          kind: 'text',
          text: trimmedNote,
        } as never);
      }
      await supabase.from('messages').insert({
        thread_id: threadId,
        sender_user_id: userId,
        kind: 'text',
        text: body,
      } as never);
    }
  }
}
