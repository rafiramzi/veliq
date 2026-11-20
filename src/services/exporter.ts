// Ekspor file: rute GPX dan Vehicle Passport (PDF).
import * as Crypto from 'expo-crypto';
import { File, Paths } from 'expo-file-system';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { tripToGpx } from '../lib/gpx';
import { buildPassportHtml, PassportData } from '../lib/passport';
import type { Trip } from '../types';

async function share(uri: string, mimeType: string, dialogTitle: string, UTI?: string) {
  if (!(await Sharing.isAvailableAsync())) throw new Error('Fitur berbagi tidak tersedia di perangkat ini.');
  await Sharing.shareAsync(uri, { mimeType, dialogTitle, UTI });
}

export async function exportTripGpx(trip: Trip, name: string) {
  const safe = name.replace(/[^\w-]+/g, '_').slice(0, 40);
  const file = new File(Paths.cache, `${safe}_${trip.id.slice(0, 8)}.gpx`);
  if (file.exists) file.delete();
  file.create();
  await file.write(tripToGpx(trip, name));
  await share(file.uri, 'application/gpx+xml', 'Ekspor rute GPX');
}

export async function exportPassportPdf(data: Omit<PassportData, 'passportId'>) {
  // ID paspor = hash isi ringkasan, supaya pembeli bisa mencocokkan dokumen.
  const digest = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    JSON.stringify({ v: data.vehicle, r: data.records, g: data.generatedAt }),
  );
  const html = buildPassportHtml({ ...data, passportId: digest.slice(0, 16).toUpperCase() });
  const { uri } = await Print.printToFileAsync({ html, width: 595, height: 842 });
  const target = new File(Paths.cache, `Vehicle_Passport_${data.vehicle.plate.replace(/\s+/g, '')}.pdf`);
  if (target.exists) target.delete();
  await new File(uri).move(target);
  await share(target.uri, 'application/pdf', 'Bagikan Vehicle Passport', 'com.adobe.pdf');
}
