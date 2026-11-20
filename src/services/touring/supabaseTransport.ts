// Transport online memakai Supabase Realtime (WebSocket, latensi rendah).
// Broadcast tidak butuh tabel database: posisi dikirim langsung antar-anggota room.
import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js';
import type { PositionPayload, SosPayload, TouringTransport, TransportHandlers } from './types';

export class SupabaseTransport implements TouringTransport {
  readonly kind = 'online' as const;
  private channel: RealtimeChannel | null = null;

  constructor(private readonly client: SupabaseClient) {}

  async join(code: string, me: { id: string; name: string }, h: TransportHandlers) {
    h.onStatus('connecting');
    const channel = this.client.channel(`touring:${code}`, {
      config: { broadcast: { self: false, ack: false }, presence: { key: me.id } },
    });
    channel
      .on('broadcast', { event: 'pos' }, ({ payload }) => h.onPosition(payload as PositionPayload))
      .on('broadcast', { event: 'sos' }, ({ payload }) => h.onSos(payload as SosPayload))
      .on('presence', { event: 'leave' }, ({ key }) => h.onLeave(key))
      .subscribe(async (status, err) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({ name: me.name, joinedAt: Date.now() });
          h.onStatus('connected');
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          h.onStatus('error', err?.message ?? status);
        } else if (status === 'CLOSED') {
          h.onStatus('closed');
        }
      });
    this.channel = channel;
  }

  sendPosition(p: PositionPayload) {
    void this.channel?.send({ type: 'broadcast', event: 'pos', payload: p });
  }

  sendSos(p: SosPayload) {
    void this.channel?.send({ type: 'broadcast', event: 'sos', payload: p });
  }

  async leave() {
    if (this.channel) await this.client.removeChannel(this.channel);
    this.channel = null;
  }
}
