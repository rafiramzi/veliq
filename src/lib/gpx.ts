import type { Trip } from '../types';
import { LATLNG_FACTORS, TELEMETRY_FACTORS, decodeDelta } from './polyline';

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export interface DecodedPoint {
  lat: number;
  lng: number;
  alt: number;
  t: number; // epoch ms
  speed: number; // m/s
}

export function decodeTrip(trip: Pick<Trip, 'polyline' | 'telemetry' | 'startedAt'>): DecodedPoint[] {
  const coords = decodeDelta(trip.polyline, LATLNG_FACTORS);
  const tele = decodeDelta(trip.telemetry, TELEMETRY_FACTORS);
  const start = new Date(trip.startedAt).getTime();
  return coords.map(([lat, lng], i) => {
    const [alt, tSec, speed] = tele[i] ?? [0, 0, 0];
    return { lat, lng, alt, t: start + tSec * 1000, speed };
  });
}

export function tripToGpx(trip: Trip, name: string): string {
  const pts = decodeTrip(trip)
    .map(
      (p) =>
        `      <trkpt lat="${p.lat.toFixed(5)}" lon="${p.lng.toFixed(5)}"><ele>${p.alt.toFixed(0)}</ele>` +
        `<time>${new Date(p.t).toISOString()}</time><extensions><speed>${p.speed.toFixed(1)}</speed></extensions></trkpt>`,
    )
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="VELIQ" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata><name>${esc(name)}</name><time>${trip.startedAt}</time></metadata>
  <trk>
    <name>${esc(name)}</name>
    <trkseg>
${pts}
    </trkseg>
  </trk>
</gpx>
`;
}
