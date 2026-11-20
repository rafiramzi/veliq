// Group Touring Radar & SOS: posisi real-time anggota, jarak Haversine,
// deteksi anggota tertinggal / hilang sinyal, dan tombol SOS.
import * as Location from 'expo-location';
import { Vibration } from 'react-native';
import { create } from 'zustand';
import { haversine } from '../../lib/geo';
import { roomCode as genRoomCode } from '../../lib/id';
import { supabase } from '../../lib/supabase';
import { useSettings } from '../../store/settings';
import { CHANNELS, notifyNow } from '../notifications';
import { DemoTransport } from './demoTransport';
import { SupabaseTransport } from './supabaseTransport';
import type { PositionPayload, SosPayload, TouringTransport, TransportStatus } from './types';

export const POSITION_INTERVAL_MS = 2000;
export const LOST_AFTER_MS = 30_000;

export type MemberStatus = 'ok' | 'behind' | 'lost' | 'sos';

export interface Member extends PositionPayload {
  lastSeen: number;
  latencyMs: number;
  distanceM: number | null;
  status: MemberStatus;
  sos: boolean;
}

export interface TouringAlert {
  id: string;
  at: number;
  text: string;
  level: 'info' | 'warning' | 'danger';
}

interface TouringState {
  roomCode: string | null;
  mode: 'online' | 'demo' | null;
  connection: TransportStatus | 'idle';
  connectionDetail?: string;
  me: PositionPayload | null;
  members: Record<string, Member>;
  mySos: boolean;
  alerts: TouringAlert[];
}

export const useTouring = create<TouringState>(() => ({
  roomCode: null,
  mode: null,
  connection: 'idle',
  me: null,
  members: {},
  mySos: false,
  alerts: [],
}));

let transport: TouringTransport | null = null;
let watchSub: Location.LocationSubscription | null = null;
let staleTimer: ReturnType<typeof setInterval> | null = null;
let lastSent = 0;

function pushAlert(text: string, level: TouringAlert['level']) {
  useTouring.setState((s) => ({
    alerts: [{ id: `${Date.now()}-${Math.random()}`, at: Date.now(), text, level }, ...s.alerts].slice(0, 30),
  }));
}

function statusFor(m: Pick<Member, 'sos' | 'lastSeen' | 'distanceM'>, now: number): MemberStatus {
  if (m.sos) return 'sos';
  if (now - m.lastSeen > LOST_AFTER_MS) return 'lost';
  if (m.distanceM != null && m.distanceM > useSettings.getState().separationM) return 'behind';
  return 'ok';
}

/** Hitung ulang jarak & status; beri notifikasi saat status memburuk. */
function evaluateMembers() {
  const { me, members } = useTouring.getState();
  const now = Date.now();
  const next: Record<string, Member> = {};
  for (const m of Object.values(members)) {
    const distanceM = me ? haversine(me, m) : null;
    const status = statusFor({ ...m, distanceM }, now);
    if (status !== m.status) {
      if (status === 'behind') {
        const text = `${m.name} terpisah ${(distanceM! / 1000).toFixed(2)} km dari Anda`;
        pushAlert(text, 'warning');
        void notifyNow('Anggota tertinggal', text, CHANNELS.alerts);
      } else if (status === 'lost') {
        const text = `Sinyal ${m.name} hilang lebih dari ${LOST_AFTER_MS / 1000} detik`;
        pushAlert(text, 'warning');
        void notifyNow('Sinyal anggota hilang', text, CHANNELS.alerts);
      } else if (status === 'ok' && (m.status === 'behind' || m.status === 'lost')) {
        pushAlert(`${m.name} kembali bergabung`, 'info');
      }
    }
    next[m.id] = { ...m, distanceM, status };
  }
  useTouring.setState({ members: next });
}

const handlers = {
  onPosition: (p: PositionPayload) => {
    const now = Date.now();
    useTouring.setState((s) => {
      const prev = s.members[p.id];
      const member: Member = {
        ...p,
        lastSeen: now,
        latencyMs: Math.max(0, now - p.sentAt),
        distanceM: prev?.distanceM ?? null,
        status: prev?.status ?? 'ok',
        sos: prev?.sos ?? false,
      };
      return { members: { ...s.members, [p.id]: member } };
    });
    evaluateMembers();
  },
  onSos: (p: SosPayload) => {
    useTouring.setState((s) => {
      const prev = s.members[p.id];
      const base: Member = prev ?? {
        id: p.id,
        name: p.name,
        lat: p.lat,
        lng: p.lng,
        speed: null,
        heading: null,
        sentAt: p.sentAt,
        lastSeen: Date.now(),
        latencyMs: 0,
        distanceM: null,
        status: 'ok',
        sos: false,
      };
      return { members: { ...s.members, [p.id]: { ...base, lat: p.lat, lng: p.lng, sos: p.active } } };
    });
    if (p.active) {
      Vibration.vibrate([0, 800, 300, 800, 300, 800]);
      const text = `${p.name} menekan tombol SOS!`;
      pushAlert(text, 'danger');
      void notifyNow('🚨 SOS dari rombongan', `${text} Buka radar untuk melihat lokasinya.`, CHANNELS.sos);
    } else {
      pushAlert(`${p.name} membatalkan SOS`, 'info');
    }
    evaluateMembers();
  },
  onLeave: (id: string) => {
    const m = useTouring.getState().members[id];
    if (m) pushAlert(`${m.name} keluar dari room`, 'info');
    useTouring.setState((s) => {
      const { [id]: _, ...rest } = s.members;
      return { members: rest };
    });
  },
  onStatus: (connection: TransportStatus, detail?: string) => useTouring.setState({ connection, connectionDetail: detail }),
};

export const isOnlineTouringAvailable = () => supabase != null;

export async function joinRoom(code: string): Promise<{ ok: boolean; reason?: string }> {
  const cleaned = code.trim().toUpperCase();
  if (!/^[A-Z0-9]{6}$/.test(cleaned)) return { ok: false, reason: 'Kode room harus 6 karakter.' };
  const perm = await Location.requestForegroundPermissionsAsync();
  if (perm.status !== 'granted') return { ok: false, reason: 'Izin lokasi diperlukan untuk radar touring.' };

  await leaveRoom();
  const settings = useSettings.getState();
  const me = { id: settings.deviceId, name: settings.riderName || 'Rider' };
  transport = supabase ? new SupabaseTransport(supabase) : new DemoTransport();
  useTouring.setState({ roomCode: cleaned, mode: transport.kind, members: {}, alerts: [], mySos: false, me: null });
  await transport.join(cleaned, me, handlers);

  try {
    watchSub = await Location.watchPositionAsync(
      { accuracy: Location.Accuracy.High, timeInterval: POSITION_INTERVAL_MS, distanceInterval: 0 },
      (l) => {
        const p: PositionPayload = {
          ...me,
          lat: l.coords.latitude,
          lng: l.coords.longitude,
          speed: l.coords.speed,
          heading: l.coords.heading,
          sentAt: Date.now(),
        };
        useTouring.setState({ me: p });
        if (Date.now() - lastSent >= POSITION_INTERVAL_MS - 200) {
          lastSent = Date.now();
          transport?.sendPosition(p);
        }
        evaluateMembers();
      },
    );
  } catch (e: any) {
    await leaveRoom();
    return { ok: false, reason: `GPS tidak bisa dibaca: ${e?.message ?? e}` };
  }
  staleTimer = setInterval(evaluateMembers, 5000);
  return { ok: true };
}

export async function createRoom() {
  return joinRoom(genRoomCode());
}

export async function leaveRoom() {
  watchSub?.remove();
  watchSub = null;
  if (staleTimer) clearInterval(staleTimer);
  staleTimer = null;
  if (useTouring.getState().mySos) setSos(false);
  await transport?.leave();
  transport = null;
  useTouring.setState({ roomCode: null, mode: null, connection: 'idle', members: {}, me: null, mySos: false });
}

export function setSos(active: boolean) {
  const { me } = useTouring.getState();
  const settings = useSettings.getState();
  const payload: SosPayload = {
    id: settings.deviceId,
    name: settings.riderName || 'Rider',
    lat: me?.lat ?? 0,
    lng: me?.lng ?? 0,
    active,
    sentAt: Date.now(),
  };
  transport?.sendSos(payload);
  useTouring.setState({ mySos: active });
  pushAlert(active ? 'SOS Anda terkirim ke seluruh rombongan' : 'SOS dibatalkan', active ? 'danger' : 'info');
}

export function simulateDemoSos() {
  if (transport instanceof DemoTransport) transport.simulateSos();
}
