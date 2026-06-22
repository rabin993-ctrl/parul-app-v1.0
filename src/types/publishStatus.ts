export type PublishStatus = 'uploading' | 'failed';

export const PUBLISH_LABELS = {
  feed: 'Uploading your post…',
  community: 'Posting to community…',
  adoption: 'Uploading your listing…',
  rescueCase: 'Creating rescue case…',
  rescueUpdate: 'Posting update…',
} as const;
