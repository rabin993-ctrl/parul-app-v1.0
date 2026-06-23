export type PublishStatus = 'uploading' | 'failed';

export const PUBLISH_LABELS = {
  feed: 'Uploading your post…',
  pawPosting: 'Uploading paw post…',
  community: 'Posting to community…',
  adoption: 'Uploading your listing…',
  rescueCase: 'Creating rescue case…',
  rescueUpdate: 'Posting update…',
} as const;

export function publishLabelForFeedPost(post: {
  companionAuthorId?: string;
  tag?: string | null;
}): string {
  if (post.companionAuthorId || post.tag === 'paw-posting') return PUBLISH_LABELS.pawPosting;
  return PUBLISH_LABELS.feed;
}
