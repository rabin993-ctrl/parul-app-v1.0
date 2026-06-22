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

function assetFromPicker(a: ImagePicker.ImagePickerAsset): PickedAsset {
  const mime = a.mimeType ?? 'image/jpeg';
  // expo-image-picker exposes the underlying File on web — grab it synchronously
  // (it's a Blob), so we never depend on the volatile blob: URL at upload time.
  const file = (a as ImagePicker.ImagePickerAsset & { file?: File }).file;
  return {
    uri: a.uri,
    ext: extFromMime(mime),
    mime,
    width: a.width,
    height: a.height,
    bytes: a.fileSize ?? undefined,
    blob: file instanceof Blob ? file : undefined,
  };
}

/** Web fallback: if the picker didn't hand us a File, read the bytes NOW while the blob: URL is still fresh. */
async function withCapturedBlob(asset: PickedAsset): Promise<PickedAsset> {
  if (asset.blob || Platform.OS !== 'web') return asset;
  try {
    const blob = await (await fetch(asset.uri)).blob();
    return { ...asset, blob };
  } catch {
    return asset; // fall back to upload-time fetch
  }
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
      const asset = await withCapturedBlob(assetFromPicker(result.assets[0]));
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
    const assets = await Promise.all(result.assets.map(a => withCapturedBlob(assetFromPicker(a))));
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
      const asset = await withCapturedBlob(assetFromPicker(result.assets[0]));
      setSelectedAsset(asset);
      return asset;
    }
    return null;
  }, []);

  const clear = useCallback(() => setSelectedAsset(null), []);

  return { selectedAsset, selectedUri: selectedAsset?.uri ?? null, pickImage, pickImages, takePhoto, clear };
}
