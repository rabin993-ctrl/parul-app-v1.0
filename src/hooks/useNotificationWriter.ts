import { useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { resolveMentionRecipientIds } from '../utils/notificationMentions';

/**
 * Client-side notification row inserts for Wave 2 feed events.
 * Wave 5 replaces these with server-side fan-out via Edge Functions.
 */
export function useNotificationWriter() {
  const { user } = useAuth();

  const notifyComment = useCallback(async (
    postId: string,
    postAuthorId: string,
    commentId: string,
    actorName?: string,
    commentPreview?: string,
  ) => {
    if (!user || postAuthorId === user.id) return;
    const name = actorName?.trim() || 'Someone';
    const preview = commentPreview?.trim().slice(0, 120);
    const { error } = await supabase.from('notifications').insert({
      recipient_id: postAuthorId,
      type: 'comment',
      actor_user_id: user.id,
      entity_type: 'post',
      entity_id: postId,
      title: `${name} commented on your post`,
      body: preview ? `"${preview}"` : 'Tap to view the comment.',
      data: {
        post_id: postId,
        comment_id: commentId,
        ...(preview ? { comment_preview: preview } : {}),
      },
    });
    if (error) console.error('[notifyComment]', error.message);
  }, [user]);

  const notifyLike = useCallback(async (
    postId: string,
    postAuthorId: string,
    actorName?: string,
  ) => {
    if (!user || postAuthorId === user.id) return;
    const name = actorName?.trim() || 'Someone';

    await supabase
      .from('notifications')
      .delete()
      .eq('recipient_id', postAuthorId)
      .eq('actor_user_id', user.id)
      .eq('type', 'like')
      .eq('entity_id', postId);

    const { error } = await supabase.from('notifications').insert({
      recipient_id: postAuthorId,
      type: 'like',
      actor_user_id: user.id,
      entity_type: 'post',
      entity_id: postId,
      title: `${name} liked your post`,
      body: 'Your post is getting some love.',
      data: { post_id: postId },
    });
    if (error) console.error('[notifyLike]', error.message);
  }, [user]);

  const notifyMentions = useCallback(async (
    postId: string,
    text: string,
    actorName?: string,
    opts?: {
      commentId?: string;
      confirmedTokens?: string[];
      /** Skip mention rows for users who already get another notif (e.g. post author on comments). */
      skipRecipientIds?: string[];
    },
  ) => {
    if (!user || !text.includes('@')) return;
    const name = actorName?.trim() || 'Someone';
    const recipientIds = await resolveMentionRecipientIds(text, {
      confirmedTokens: opts?.confirmedTokens,
      excludeUserIds: [user.id],
    });
    const skip = new Set(opts?.skipRecipientIds ?? []);
    const preview = text.trim().slice(0, 120);

    for (const recipientId of recipientIds) {
      if (skip.has(recipientId)) continue;
      const { error } = await supabase.from('notifications').insert({
        recipient_id: recipientId,
        type: 'mention',
        actor_user_id: user.id,
        entity_type: 'post',
        entity_id: postId,
        title: `${name} mentioned you`,
        body: preview ? `"${preview}"` : 'Tap to view the post.',
        data: {
          post_id: postId,
          ...(opts?.commentId ? { comment_id: opts.commentId } : {}),
        },
      });
      if (error) console.error('[notifyMentions]', error.message);
    }
  }, [user]);

  return { notifyComment, notifyLike, notifyMentions };
}
