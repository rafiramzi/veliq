// Mode demo (tanpa server): 3 anggota simulasi bergerak di sekitar posisi Anda.
// Salah satunya perlahan tertinggal supaya notifikasi "terpisah" bisa diuji.
import type { PositionPayload, SosPayload, TouringTransport, TransportHandlers } from './types';

interface Bot {
  id: string;
  name: string;
  /** Offset dari posisi kita (meter, utara/timur). */
  north: number;
  east: number;
  drift: number; // m per tick menjauh (negatif = mendekat)
}

const M_PER_DEG_LAT = 111_320;

export class DemoTransport implements TouringTransport {
  readonly kind = 'demo' as const;
  private timer: ReturnType<typeof setInterval> | null = null;
  private handlers: TransportHandlers | null = null;
  private me: { lat: number; lng: number } | null = null;
  private tick = 0;
  private bots: Bot[] = [
    { id: 'demo-budi', name: 'Budi (demo)', north: 60, east: 20, drift: 0 },
    { id: 'demo-sari', name: 'Sari (demo)', north: -90, east: -30, drift: 0 },
    { id: 'demo-andi', name: 'Andi (demo)', north: -150, east: 10, drift: -40 },
  ];

  async join(_code: string, _me: { id: string; name: string }, h: TransportHandlers) {
    this.handlers = h;
    h.onStatus('connecting');
    setTimeout(() => h.onStatus('connected'), 400);
    this.timer = setInterval(() => this.step(), 2000);
  }

  private step() {
    if (!this.me || !this.handlers) return;
    this.tick++;
    for (const b of this.bots) {
      // Andi tertinggal hingga ~1 km lalu menyusul lagi (siklus ±60 detik).
      if (b.id === 'demo-andi') {
        if (b.north < -1000) b.drift = 35;
        if (b.north > -150) b.drift = -40;
        b.north += b.drift;
      }
      b.north += (Math.random() - 0.5) * 8;
      b.east += (Math.random() - 0.5) * 8;
      const lat = this.me.lat + b.north / M_PER_DEG_LAT;
      const lng = this.me.lng + b.east / (M_PER_DEG_LAT * Math.cos((this.me.lat * Math.PI) / 180));
      const latency = 80 + Math.random() * 320;
      const payload: PositionPayload = {
        id: b.id,
        name: b.name,
        lat,
        lng,
        speed: 11 + Math.random() * 3,
        heading: 0,
        sentAt: Date.now() - latency,
      };
      this.handlers.onPosition(payload);
    }
  }

  sendPosition(p: PositionPayload) {
    this.me = { lat: p.lat, lng: p.lng };
  }

  sendSos(_p: SosPayload) {
    // Di mode demo tidak ada penerima nyata.
  }

  /** Simulasikan SOS dari anggota demo untuk menguji alarm. */
  simulateSos() {
    if (!this.me || !this.handlers) return;
    const b = this.bots[0];
    this.handlers.onSos({
      id: b.id,
      name: b.name,
      lat: this.me.lat + b.north / M_PER_DEG_LAT,
      lng: this.me.lng,
      active: true,
      sentAt: Date.now(),
    });
  }

  async leave() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.handlers?.onStatus('closed');
    this.handlers = null;
  }
}
