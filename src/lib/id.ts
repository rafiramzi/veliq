import * as Crypto from 'expo-crypto';

export function uuid(): string {
  try {
    return Crypto.randomUUID();
  } catch {
    // Web lewat http (bukan localhost/https) tidak punya crypto.randomUUID: bangun UUID v4 manual.
    const b = Crypto.getRandomBytes(16);
    b[6] = (b[6] & 0x0f) | 0x40;
    b[8] = (b[8] & 0x3f) | 0x80;
    const h = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
    return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
  }
}

const ROOM_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // tanpa 0/O/1/I yang membingungkan

/** Private Room Code 6 karakter, acak kriptografis. */
export function roomCode(length = 6): string {
  const bytes = Crypto.getRandomBytes(length);
  let out = '';
  for (let i = 0; i < length; i++) out += ROOM_ALPHABET[bytes[i] % ROOM_ALPHABET.length];
  return out;
}

export const nowISO = () => new Date().toISOString();