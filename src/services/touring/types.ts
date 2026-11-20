export interface PositionPayload {
  id: string;
  name: string;
  lat: number;
  lng: number;
  speed: number | null; // m/s
  heading: number | null;
  /** Waktu kirim (epoch ms) — untuk mengukur latensi. */
  sentAt: number;
}

export interface SosPayload {
  id: string;
  name: string;
  lat: number;
  lng: number;
  active: boolean;
  sentAt: number;
}

export type TransportStatus = 'connecting' | 'connected' | 'error' | 'closed';

export interface TransportHandlers {
  onPosition: (p: PositionPayload) => void;
  onSos: (p: SosPayload) => void;
  onLeave: (memberId: string) => void;
  onStatus: (s: TransportStatus, detail?: string) => void;
}

export interface TouringTransport {
  readonly kind: 'online' | 'demo';
  join(code: string, me: { id: string; name: string }, h: TransportHandlers): Promise<void>;
  sendPosition(p: PositionPayload): void;
  sendSos(p: SosPayload): void;
  leave(): Promise<void>;
}
