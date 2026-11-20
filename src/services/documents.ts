// Pengambilan & kompresi foto dokumen (STNK, nota servis).
// Alur: kamera/galeri -> resize (sisi terpanjang maks 1600 px) + rotasi -> JPEG/WebP kualitas 60–80.
import { Directory, File, Paths } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';

export const MAX_SIDE_PX = 1600;

export interface PickedImage {
  uri: string;
  width: number;
  height: number;
  bytes: number;
}

export interface CompressedImage {
  uri: string;
  width: number;
  height: number;
  bytes: number;
}

function fileSize(uri: string): number {
  try {
    return new File(uri).size ?? 0;
  } catch {
    return 0;
  }
}

export async function pickImage(source: 'camera' | 'gallery'): Promise<PickedImage | { error: string } | null> {
  const perm =
    source === 'camera'
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) return { error: source === 'camera' ? 'Izin kamera ditolak.' : 'Izin galeri ditolak.' };

  const opts: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 1, exif: false };
  const res = source === 'camera' ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
  if (res.canceled || !res.assets?.length) return null;
  const a = res.assets[0];
  return { uri: a.uri, width: a.width, height: a.height, bytes: a.fileSize ?? fileSize(a.uri) };
}

/**
 * Resize + koreksi orientasi + kompresi. Orientasi EXIF dinormalkan saat gambar
 * didekode; `rotate` dipakai untuk koreksi manual (kelipatan 90°).
 */
export async function compressImage(
  src: PickedImage,
  opts: { quality: number; format: 'jpeg' | 'webp'; rotate: number },
): Promise<CompressedImage> {
  const ctx = ImageManipulator.manipulate(src.uri);
  const rotated = opts.rotate % 180 !== 0;
  const w = rotated ? src.height : src.width;
  const h = rotated ? src.width : src.height;
  if (opts.rotate % 360 !== 0) ctx.rotate(opts.rotate);
  if (Math.max(w, h) > MAX_SIDE_PX) {
    ctx.resize(w >= h ? { width: MAX_SIDE_PX } : { height: MAX_SIDE_PX });
  }
  const image = await ctx.renderAsync();
  const out = await image.saveAsync({
    compress: opts.quality / 100,
    format: opts.format === 'webp' ? SaveFormat.WEBP : SaveFormat.JPEG,
  });
  ctx.release();
  image.release();
  return { uri: out.uri, width: out.width, height: out.height, bytes: fileSize(out.uri) };
}

function docsDir(): Directory {
  const dir = new Directory(Paths.document, 'documents');
  if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
  return dir;
}

/** Pindahkan hasil kompresi dari cache ke folder dokumen permanen. */
export async function persistCompressed(img: CompressedImage, id: string, format: 'jpeg' | 'webp'): Promise<string> {
  const dest = new File(docsDir(), `${id}.${format === 'webp' ? 'webp' : 'jpg'}`);
  if (dest.exists) dest.delete();
  await new File(img.uri).copy(dest);
  return dest.uri;
}
