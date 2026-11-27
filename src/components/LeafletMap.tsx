// Peta interaktif berbasis Leaflet + OpenStreetMap di dalam WebView.
// Tidak butuh Google Maps API key, jadi langsung jalan di APK.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleProp, View, ViewStyle } from 'react-native';
import { WebView, WebViewMessageEvent, WebViewProps } from 'react-native-webview';
import { colors } from '../theme';

// Tipe bawaan react-native-webview 14 (`WebView<P = undefined>`) menjadi `never` di TS 6,
// jadi dibungkus ulang dengan tipe props yang benar.
type WebViewHandle = { injectJavaScript: (script: string) => void };
const WV = WebView as unknown as React.ComponentType<WebViewProps & React.RefAttributes<WebViewHandle>>;

export interface MapMarker {
  id: string;
  lat: number;
  lng: number;
  label?: string;
  color?: string;
  me?: boolean;
  pulse?: boolean;
}

interface Props {
  route?: [number, number][];
  markers?: MapMarker[];
  /** Ikuti marker "me" / titik rute terakhir. */
  follow?: boolean;
  /** Zoom otomatis agar semua rute/marker terlihat. */
  fitAll?: boolean;
  height?: number;
  style?: StyleProp<ViewStyle>;
}

const HTML = `<!DOCTYPE html><html><head>
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1"/>
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<style>
  html,body,#map{height:100%;margin:0;background:#1C1C1E}
  .leaflet-tile-pane{filter:invert(1) hue-rotate(180deg) brightness(.9) contrast(.9)}
  .leaflet-control-attribution{background:rgba(10,11,13,.7)!important;color:#8E8E93!important}
  .leaflet-control-attribution a{color:#64B5FF!important}
  .leaflet-bar a{background:#1C1C1E;color:#fff;border-color:#2C2C2E}
  .lbl{background:#12304F;color:#fff;border:none;border-radius:6px;font:600 11px sans-serif;padding:2px 6px;box-shadow:none}
  .lbl:before{display:none}
  .pulse{animation:p 1s infinite}
  @keyframes p{0%{opacity:1}50%{opacity:.25}100%{opacity:1}}
  .err{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font:14px sans-serif;color:#8E8E93;text-align:center;padding:20px}
</style></head><body><div id="map"></div><script>
(function(){
  function post(m){ window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify(m)); }
  if (typeof L === 'undefined') {
    document.body.innerHTML = '<div class="err">Peta butuh koneksi internet untuk memuat. Data tetap tersimpan.</div>';
    post({type:'ready'}); window.__set=function(){}; window.__append=function(){}; window.__markers=function(){}; return;
  }
  var map = L.map('map', { zoomControl: false, attributionControl: true }).setView([-6.2, 106.816], 13);
  L.control.zoom({ position: 'bottomright' }).addTo(map);
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; OpenStreetMap' }).addTo(map);
  var line = L.polyline([], { color: '${colors.accent}', weight: 5, opacity: .9 }).addTo(map);
  var start = null, layer = L.layerGroup().addTo(map), userMoved = false, fitted = false;
  map.on('dragstart', function(){ userMoved = true; });
  var opts = { follow: false, fitAll: false };
  function fit(){
    var pts = line.getLatLngs().slice();
    layer.eachLayer(function(l){ if (l.getLatLng) pts.push(l.getLatLng()); });
    if (pts.length === 1) map.setView(pts[0], 16);
    else if (pts.length > 1) map.fitBounds(L.latLngBounds(pts), { padding: [30, 30], maxZoom: 17 });
  }
  function after(){
    if (opts.fitAll && (!fitted || !userMoved)) { fit(); fitted = true; return; }
    if (opts.follow && !userMoved) {
      var me = null; layer.eachLayer(function(l){ if (l.options && l.options.me) me = l.getLatLng(); });
      var pts = line.getLatLngs();
      var target = me || pts[pts.length - 1];
      if (target) map.setView(target, Math.max(map.getZoom(), 15));
    }
  }
  function startMarker(){
    var pts = line.getLatLngs();
    if (start) { map.removeLayer(start); start = null; }
    if (pts.length) start = L.circleMarker(pts[0], { radius: 6, color: '#fff', weight: 2, fillColor: '#16A34A', fillOpacity: 1 }).addTo(map);
  }
  window.__opts = function(o){ opts = o; };
  window.__set = function(pts){ line.setLatLngs(pts); startMarker(); after(); };
  window.__append = function(pts){ pts.forEach(function(p){ line.addLatLng(p); }); if (!start) startMarker(); after(); };
  window.__markers = function(ms){
    layer.clearLayers();
    ms.forEach(function(m){
      var c = L.circleMarker([m.lat, m.lng], { me: !!m.me, radius: m.me ? 9 : 8, color: '#fff', weight: 3,
        fillColor: m.color || '${colors.info}', fillOpacity: 1, className: m.pulse ? 'pulse' : '' });
      if (m.label) c.bindTooltip(m.label, { permanent: true, direction: 'top', offset: [0, -8], className: 'lbl' });
      c.addTo(layer);
    });
    after();
  };
  window.__recenter = function(){ userMoved = false; fitted = false; if (opts.fitAll) fit(); else after(); };
  post({ type: 'ready' });
})();
</script></body></html>`;

export function LeafletMap({ route, markers, follow, fitAll, height = 260, style }: Props) {
  const ref = useRef<WebViewHandle>(null);
  const [ready, setReady] = useState(false);
  const sentCount = useRef(0);
  const sentFirst = useRef<string>('');

  const run = useCallback((js: string) => ref.current?.injectJavaScript(`${js};true;`), []);

  useEffect(() => {
    if (ready) run(`window.__opts(${JSON.stringify({ follow: !!follow, fitAll: !!fitAll })})`);
  }, [ready, follow, fitAll, run]);

  useEffect(() => {
    if (!ready || !route) return;
    const first = route[0] ? route[0].join(',') : '';
    // Rute yang hanya bertambah dikirim inkremental supaya ringan saat rekaman 1 Hz.
    if (first === sentFirst.current && route.length >= sentCount.current && sentCount.current > 0) {
      const add = route.slice(sentCount.current);
      if (add.length) run(`window.__append(${JSON.stringify(add)})`);
    } else {
      run(`window.__set(${JSON.stringify(route)})`);
    }
    sentCount.current = route.length;
    sentFirst.current = first;
  }, [ready, route, run]);

  const markersJson = useMemo(() => JSON.stringify(markers ?? []), [markers]);
  useEffect(() => {
    if (ready) run(`window.__markers(${markersJson})`);
  }, [ready, markersJson, run]);

  const onMessage = (e: WebViewMessageEvent) => {
    try {
      const msg = JSON.parse(e.nativeEvent.data);
      if (msg.type === 'ready') {
        sentCount.current = 0;
        sentFirst.current = '';
        setReady(true);
      }
    } catch {
      // abaikan
    }
  };

  return (
    <View style={[{ height, borderRadius: 16, overflow: 'hidden', backgroundColor: colors.border }, style]}>
      <WV
        ref={ref}
        source={{ html: HTML, baseUrl: 'https://VELIQ.local/' }}
        originWhitelist={['*']}
        onMessage={onMessage}
        javaScriptEnabled
        domStorageEnabled
        setSupportMultipleWindows={false}
        style={{ backgroundColor: 'transparent' }}
      />
    </View>
  );
}
