// Google Encoded Polyline Algorithm Format.
// https://developers.google.com/maps/documentation/utilities/polylinealgorithm
// Encoder dibuat inkremental (append-only) supaya titik bisa ditambahkan
// satu per satu selama perekaman tanpa meng-encode ulang seluruh rute.

/** Encode satu bilangan bulat bertanda (sudah dikali presisi & berupa delta). */
export function encodeSigned(value: number): string {
  let v = value < 0 ? ~(value << 1) : value << 1;
  let out = '';
  while (v >= 0x20) {
    out += String.fromCharCode((0x20 | (v & 0x1f)) + 63);
    v >>= 5;
  }
  out += String.fromCharCode(v + 63);
  return out;
}

/** Decode string menjadi deretan bilangan bulat delta. */
export function decodeSignedStream(str: string): number[] {
  const out: number[] = [];
  let index = 0;
  while (index < str.length) {
    let result = 0;
    let shift = 0;
    let b: number;
    do {
      b = str.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20 && index < str.length);
    out.push(result & 1 ? ~(result >> 1) : result >> 1);
  }
  return out;
}

/** Encoder multi-dimensi inkremental. */
export class DeltaEncoder {
  private prev: number[];
  constructor(
    private readonly factors: number[],
    public encoded = '',
    prev?: number[],
  ) {
    this.prev = prev ?? factors.map(() => 0);
  }

  push(values: number[]): string {
    let chunk = '';
    for (let i = 0; i < this.factors.length; i++) {
      const scaled = Math.round(values[i] * this.factors[i]);
      chunk += encodeSigned(scaled - this.prev[i]);
      this.prev[i] = scaled;
    }
    this.encoded += chunk;
    return chunk;
  }

  snapshot() {
    return { encoded: this.encoded, prev: [...this.prev] };
  }
}

/** Decode stream multi-dimensi menjadi array tuple. */
export function decodeDelta(str: string, factors: number[]): number[][] {
  const ints = decodeSignedStream(str);
  const dims = factors.length;
  const acc = factors.map(() => 0);
  const rows: number[][] = [];
  for (let i = 0; i + dims <= ints.length; i += dims) {
    const row: number[] = [];
    for (let d = 0; d < dims; d++) {
      acc[d] += ints[i + d];
      row.push(acc[d] / factors[d]);
    }
    rows.push(row);
  }
  return rows;
}

/** Presisi standar Google: 5 digit desimal. */
export const LATLNG_FACTORS = [1e5, 1e5];
/** alt: 1 m, t: detik relatif terhadap awal trip, speed: 0.1 m/s. */
export const TELEMETRY_FACTORS = [1, 1, 10];

export function encodePolyline(points: [number, number][]): string {
  const enc = new DeltaEncoder(LATLNG_FACTORS);
  points.forEach((p) => enc.push(p));
  return enc.encoded;
}

export function decodePolyline(str: string): [number, number][] {
  return decodeDelta(str, LATLNG_FACTORS) as [number, number][];
}
