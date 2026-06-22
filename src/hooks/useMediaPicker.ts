import { useCallback, useState } from 'react';
import { Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';

export type PickedAsset = {
  uri: string;
  ext: string;
  mime: string;
  width?: number;
  height?: number;
  bytes?: number;
  /**
   * Web: the actual file bytes captured AT PICK TIME. On web `uri` is a `blob:`
   * URL that can be revoked/stale by the time we upload (which happens several
   * awaits later), causing the upload to throw and the image to vanish on reload.
   * Holding the Blob in memory makes the upload immune to that.
   */
  blob?: Blob;
};

function extFromMime(mime: string): string {
  if (mime === 'image/png') return 'png';
  if (mime === 'image/webp') return 'webp';
  if (mime === 'image/gif') return 'gif';
  return 'jpg';
}

type ReadablePickerFile = {
  arrayBuffer: () => Promise<ArrayBuffer>;
  size: number;
  type?: string;
};

function isReadablePickerFile(v: unknown): v is ReadablePickerFile {
  return !!v
    && typeof v === 'object'
    && typeof (v as ReadablePickerFile).arrayBuffer === 'function'
    && typeof (v as ReadablePickerFile).size === 'number';
}

/** Duck-type Blob/File — `instanceof Blob` fails on some mobile Safari cross-realm Files. */
function syncBlobFromPickerFile(file: unknown): Blob | undefined {
  if (!file || typeof file !== 'object') return undefined;
  if (file instanceof Blob) return file;
  const candidate = file as Blob;
  if (typeof candidate.slice === 'function' && typeof candidate.size === 'number') {
    return candidate;
  }
  return undefined;
}

function assetFromPicker(a: ImagePicker.ImagePickerAsset): PickedAsset {
  const mime = a.mimeType ?? 'image/jpeg';
  const file = (a as ImagePicker.ImagePickerAsset & { file?: File }).file;
  const syncBlob = syncBlobFromPickerFile(file);
  return {
    uri: a.uri,
    ext: extFromMime(mime),
    mime,
    width: a.width,
    height: a.height,
    bytes: a.fileSize ?? syncBlob?.size ?? undefined,
    blob: syncBlob,
  };
}

function readUriAsArrayBuffer(uri: string): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('GET', uri);
    xhr.responseType = 'arraybuffer';
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300 && xhr.response instanceof ArrayBuffer) {
        resolve(xhr.response);
        return;
      }
      reject(new Error(`XHR failed: ${xhr.status}`));
    };
    xhr.onerror = () => reject(new Error('XHR network error'));
    xhr.send();
  });
}

/**
 * Web: materialize bytes at pick time so upload never depends on a stale blob: URL.
 * Mobile Safari often fails `instanceof Blob` on picker Files — use arrayBuffer() first.
 */
async function withCapturedBlob(
  asset: PickedAsset,
  pickerFile?: unknown,
): Promise<PickedAsset> {
  if (asset.blob || Platform.OS !== 'web') return asset;

  const mime = asset.mime || 'image/jpeg';

  if (isReadablePickerFile(pickerFile)) {
    try {
      const ab = await pickerFile.arrayBuffer();
      if (ab.byteLength > 0) {
        return {
          ...asset,
          blob: new Blob([ab], { type: pickerFile.type || mime }),
          bytes: pickerFile.size,
        };
      }
    } catch {
      // try fallbacks below
    }
  }

  try {
    const blob = await (await fetch(asset.uri)).blob();
    if (blob.size > 0) {
      return { ...asset, blob, bytes: asset.bytes ?? blob.size };
    }
  } catch {
    // try XHR fallback below
  }

  try {
    const ab = await readUriAsArrayBuffer(asset.uri);
    if (ab.byteLength > 0) {
      return {
        ...asset,
        blob: new Blob([ab], { type: mime }),
        bytes: ab.byteLength,
      };
    }
  } catch {
    // all capture paths failed
  }

  if (__DEV__) {
    console.warn('[useMediaPicker] failed to capture image bytes at pick time; upload may fail on mobile web');
  }
  return asset;
}

function pickerFileFromAsset(a: ImagePicker.ImagePickerAsset): unknown {
  return (a as ImagePicker.ImagePickerAsset & { file?: File }).file;
}

export function useMediaPicker() {
  const [selectedAsset, setSelectedAsset] = useState<PickedAsset | null>(null);

  const pickImage = useCallback(async (opts?: { squareCrop?: boolean }): Promise<PickedAsset | null> => {
    if (Platform.OS !== 'web') {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') return null;
    }
    const squareCrop = opts?.squareCrop ?? false;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images' as ImagePicker.MediaTypeOptions,
      quality: 0.85,
      allowsMultipleSelection: false,
      allowsEditing: squareCrop,
      aspect: squareCrop ? [1, 1] : undefined,
      exif: false,
    });
    if (!result.canceled && result.assets[0]) {
      const pickerAsset = result.assets[0];
      const asset = await withCapturedBlob(assetFromPicker(pickerAsset), pickerFileFromAsset(pickerAsset));
      setSelectedAsset(asset);
      return asset;
    }
    return null;
  }, []);

  const pickImages = useCallback(async (opts?: { limit?: number }): Promise<PickedAsset[]> => {
    if (Platform.OS !== 'web') {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') return [];
    }
    const limit = opts?.limit ?? 0;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images' as ImagePicker.MediaTypeOptions,
      quality: 0.85,
      allowsMultipleSelection: true,
      selectionLimit: limit > 0 ? limit : 0,
      exif: false,
    });
    if (result.canceled || result.assets.length === 0) return [];
    const assets = await Promise.all(
      result.assets.map(a => withCapturedBlob(assetFromPicker(a), pickerFileFromAsset(a))),
    );
    if (assets[0]) setSelectedAsset(assets[assets.length - 1]);
    return assets;
  }, []);

  const takePhoto = useCallback(async (opts?: { squareCrop?: boolean }): Promise<PickedAsset | null> => {
    if (Platform.OS !== 'web') {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') return null;
    }
    const squareCrop = opts?.squareCrop ?? false;
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: 'images' as ImagePicker.MediaTypeOptions,
      quality: 0.85,
      allowsEditing: squareCrop,
      aspect: squareCrop ? [1, 1] : undefined,
      exif: false,
    });
    if (!result.canceled && result.assets[0]) {
      const pickerAsset = result.assets[0];
      const asset = await withCapturedBlob(assetFromPicker(pickerAsset), pickerFileFromAsset(pickerAsset));
      setSelectedAsset(asset);
      return asset;
    }
    return null;
  }, []);

  const clear = useCallback(() => setSelectedAsset(null), []);

  return { selectedAsset, selectedUri: selectedAsset?.uri ?? null, pickImage, pickImages, takePhoto, clear };
}
