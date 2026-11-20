import * as Crypto from 'expo-crypto';

export const uuid = () => Crypto.randomUUID();

const ROOM_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // tanpa 0/O/1/I yang membingungkan

/** Private Room Code 6 karakter, acak kriptografis. */
export function roomCode(length = 6): string {
  const bytes = Crypto.getRandomBytes(length);
  let out = '';
  for (let i = 0; i < length; i++) out += ROOM_ALPHABET[bytes[i] % ROOM_ALPHABET.length];
  return out;
}

export const nowISO = () => new Date().toISOString();
