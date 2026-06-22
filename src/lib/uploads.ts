/**
 * Media upload helper. Uploads a local file to a Supabase Storage bucket and records
 * a row in `media_assets`. Optionally generates thumbnail + full-res variants.
 *
 * Path convention (Wave 7 directory scheme):
 *   <bucket>/<userId>/<mediaId>/original.<ext>   — original file
 *   <bucket>/<userId>/<mediaId>/thumb.jpg         — ~200px thumbnail (JPEG)
 *   <bucket>/<userId>/<mediaId>/full.jpg          — ~1080px full view (JPEG)
 *
 * Variant generation requires `expo-image-manipulator`. If not installed (or if
 * `generateVariants` is false), only the original is uploaded; thumbUrl() / fullUrl()
 * derive the variant paths from the original path using the convention above and
 * will 404 until variants are uploaded.
 *
 * Buckets: 'avatars' | 'post-media' | 'adoption-media' | 'rescue-media' | 'circle-media'
 */
import { Platform } from 'react-native';
import * as ImageManipulator from 'expo-image-manipulator';
import { supabase } from './supabase';
import { mediaUrl } from './cdn';

/** Public buckets whose thumbs are backfilled by the VPS generate-thumbs job. */
const PUBLIC_IMAGE_BUCKETS = new Set(['avatars', 'post-media']);

/**
 * No-op. Thumbnail generation is handled entirely by the VPS cron
 * (generate-thumbs.js, every ~15 min); the feed falls back to the full image URL
 * until a thumb exists. The previous client-side webhook nudge required shipping
 * a bearer secret in the bundle (every EXPO_PUBLIC_* var is inlined into the
 * client), which is not a real secret — so it was removed. Kept as a no-op so
 * call sites stay put if the trigger later moves behind a server-side edge
 * function that holds the secret.
 */
export function triggerThumbGeneration(): void {
  // intentionally empty — see above.
}

// ---------------------------------------------------------------------------
// Low-level: raw Storage upload (unchanged, used internally + by callers that
// manage their own DB row).
// ---------------------------------------------------------------------------

export type UploadInput = {
  bucket: string;
  /** path within the bucket, MUST start with the owner's user id, e.g. `${userId}/posts/${uuid}.jpg` */
  path: string;
  /** file blob/bytes (from expo-image-picker / fetch(uri).blob()) */
  data: Blob | ArrayBuffer | Uint8Array;
  contentType?: string;
  upsert?: boolean;
};

export async function uploadMedia({ bucket, path, data, contentType, upsert }: UploadInput) {
  const { data: res, error } = await supabase.storage
    .from(bucket)
    .upload(path, data, { contentType, upsert: upsert ?? false });
  if (error) throw error;
  return { path: res.path, bucket };
}

/**
 * Retry a flaky async op. The original-file fetch + storage upload run several
 * awaits after the image was picked; on mobile web that critical step fails
 * intermittently (transient network, or a momentarily-stale blob URL), which
 * otherwise throws and leaves a post with no image. A couple of retries with
 * backoff turns those transient failures into successes.
 */
async function withUploadRetry<T>(fn: () => Promise<T>, attempts = 3): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (i < attempts - 1) {
        await new Promise(resolve => setTimeout(resolve, 500 * (i + 1)));
      }
    }
  }
  throw lastErr;
}

/** Prefer pre-captured bytes; on web normalize to Uint8Array for reliable Supabase uploads. */
async function resolveUploadBytes(
  blob: Blob | undefined,
  localUri: string,
): Promise<Blob | Uint8Array> {
  const raw = blob ?? await withUploadRetry(async () => (await fetch(localUri)).blob());
  if (Platform.OS === 'web') {
    const ab = await raw.arrayBuffer();
    return new Uint8Array(ab);
  }
  return raw;
}

export async function removeMedia(bucket: string, paths: string[]) {
  const { error } = await supabase.storage.from(bucket).remove(paths);
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// High-level: upload + insert/update `media_assets` row with variant URLs.
// ---------------------------------------------------------------------------

export type MediaAssetInput = {
  /** Supabase Storage bucket name */
  bucket: string;
  /** Authenticated user id — used as the first path segment */
  userId: string;
  /** UUID for this media item (generate with crypto.randomUUID() at call site) */
  mediaId: string;
  /** Local URI (from expo-image-picker) or a Blob/Uint8Array for the original */
  localUri: string;
  /** Pre-captured original bytes (web). When present, used instead of re-fetching localUri (which may be a stale blob: URL). */
  blob?: Blob;
  /** File extension without dot, e.g. 'jpg', 'png', 'mp4' */
  ext: string;
  /** MIME type, e.g. 'image/jpeg'. Defaults to 'image/jpeg'. */
  mime?: string;
  /** Width of the original in px (optional, stored on the DB row) */
  width?: number;
  /** Height of the original in px (optional, stored on the DB row) */
  height?: number;
  /** Size of the original in bytes (optional) */
  bytes?: number;
  /** Duration in ms for audio/video assets */
  durationMs?: number;
  /**
   * When true (default for images), upload thumbnail + full-res variants
   * alongside the original. Requires expo-image-manipulator to be installed;
   * if not installed the variants are skipped and only the original is stored.
   */
  generateVariants?: boolean;
};

export type MediaAssetResult = {
  mediaId: string;
  bucket: string;
  originalPath: string;
  thumbPath: string;
  fullPath: string;
  /** CDN/public URL for the original */
  originalUrl: string;
  /** CDN/public URL for the ~200px thumbnail */
  thumbUrlValue: string;
  /** CDN/public URL for the ~1080px full view */
  fullUrlValue: string;
};

/**
 * Upload a media file to Storage (original + optionally thumbnail & full variants),
 * then upsert the corresponding `media_assets` DB row with `url` (original public URL)
 * and `thumb_url` (thumbnail public URL).
 *
 * Returns paths and CDN URLs for all three variants.
 */
export async function uploadMediaAsset({
  bucket,
  userId,
  mediaId,
  localUri,
  blob,
  ext,
  mime = 'image/jpeg',
  width,
  height,
  bytes,
  durationMs,
  generateVariants = true,
}: MediaAssetInput): Promise<MediaAssetResult> {
  const isImage = mime.startsWith('image/');
  const isVideo = mime.startsWith('video/');
  const shouldGenerateVariants = generateVariants && isImage;

  // Build storage paths
  const basePath = `${userId}/${mediaId}`;
  const originalPath = `${basePath}/original.${ext}`;
  const thumbPath = `${basePath}/thumb.jpg`;
  const fullPath = `${basePath}/full.jpg`;

  // 1. Get the original file bytes, then 2. upload them.
  //    Prefer the pre-captured Blob (taken at pick time) — on web the localUri is
  //    a blob: URL that is frequently dead by the time we upload (several awaits
  //    after picking), which threw and left the post with no image. Only fall back
  //    to fetching the URI when no Blob was captured (native).
  const originalBytes = await resolveUploadBytes(blob, localUri);
  await withUploadRetry(() =>
    uploadMedia({ bucket, path: originalPath, data: originalBytes, contentType: mime, upsert: true }),
  );

  // 3. Generate & upload variants. A failure here (ImageManipulator can throw on
  //    web / unusual image formats) must NOT abort the upload — the original is
  //    already stored, so we fall back to no thumbnail and still persist the
  //    media_assets row below. The VPS thumbnail cron backfills thumb/full later.
  let variantsOk = false;
  if (shouldGenerateVariants) {
    const variantObjectUrl = blob && Platform.OS === 'web' ? URL.createObjectURL(blob) : undefined;
    const variantSourceUri = variantObjectUrl ?? localUri;
    try {
      const thumbResult = await ImageManipulator.manipulateAsync(
        variantSourceUri,
        [{ resize: { width: 200 } }],
        { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG },
      );
      const thumbBlob = await (await fetch(thumbResult.uri)).blob();
      await uploadMedia({
        bucket,
        path: thumbPath,
        data: thumbBlob,
        contentType: 'image/jpeg',
        upsert: true,
      });

      const fullResult = await ImageManipulator.manipulateAsync(
        variantSourceUri,
        [{ resize: { width: 1080 } }],
        { compress: 0.85, format: ImageManipulator.SaveFormat.JPEG },
      );
      const fullBlob = await (await fetch(fullResult.uri)).blob();
      await uploadMedia({
        bucket,
        path: fullPath,
        data: fullBlob,
        contentType: 'image/jpeg',
        upsert: true,
      });
      variantsOk = true;
    } catch (variantErr) {
      if (__DEV__) {
        console.warn('[uploads] variant generation failed; storing original only:', variantErr);
      }
    } finally {
      if (variantObjectUrl) URL.revokeObjectURL(variantObjectUrl);
    }
  }

  // 4. Compute CDN/public URLs for the DB row.
  //    All three always use CDN paths. The VPS cron (generate-thumbs.js, every 15 min)
  //    uploads thumb.jpg and full.jpg to Storage so these CDN URLs resolve shortly
  //    after each upload. The feed falls back to url when thumb_url hasn't loaded yet.
  const originalUrl = mediaUrl(bucket, originalPath, 'original');
  const thumbUrlValue = mediaUrl(bucket, originalPath, 'thumb');
  const fullUrlValue = mediaUrl(bucket, originalPath, 'full');

  // 5. Upsert the media_assets row:
  //   url       = CDN URL for original
  //   thumb_url = CDN URL for ~200px thumbnail (generated by VPS cron)
  const { error: dbError } = await supabase.from('media_assets').upsert({
    id: mediaId,
    owner_id: userId,
    url: originalUrl,
    // Only store a thumb URL when the thumbnail was actually produced+uploaded.
    // Otherwise the DB would hold a permanently-404 URL (the cron backfills it).
    thumb_url: variantsOk ? thumbUrlValue : null,
    mime,
    type: isImage ? 'image' : isVideo ? 'video' : 'file',
    width: width ?? null,
    height: height ?? null,
    bytes: bytes ?? null,
    duration_ms: durationMs ?? null,
  }, { onConflict: 'id' });
  if (dbError) throw dbError;

  if (isImage && PUBLIC_IMAGE_BUCKETS.has(bucket)) {
    triggerThumbGeneration();
  }

  return {
    mediaId,
    bucket,
    originalPath,
    thumbPath,
    fullPath,
    originalUrl,
    thumbUrlValue,
    fullUrlValue,
  };
}
