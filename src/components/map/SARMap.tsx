'use client';
import { useEffect, useRef } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import type { Detection } from '@/components/ui/DetectionModal';

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? '';

const SEARCH_AREA_COORDS: [number, number][] = [
  [-122.445, 37.768], [-122.398, 37.768],
  [-122.398, 37.792], [-122.445, 37.792],
  [-122.445, 37.768],
];

const GRID_LINES = [
  [[-122.445, 37.775], [-122.398, 37.775]],
  [[-122.445, 37.783], [-122.398, 37.783]],
  [[-122.430, 37.768], [-122.430, 37.792]],
  [[-122.415, 37.768], [-122.415, 37.792]],
];

export interface FlyTarget { lng: number; lat: number; }

interface SARMapProps {
  detections: Detection[];
  onDetectionClick: (det: Detection) => void;
  flyTarget?: FlyTarget | null;
  detectionCount?: number;
}

export default function SARMap({ detections, onDetectionClick, flyTarget, detectionCount }: SARMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);

  useEffect(() => {
    if (!MAPBOX_TOKEN || mapRef.current || !containerRef.current) return;

    mapboxgl.accessToken = MAPBOX_TOKEN;

    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: 'mapbox://styles/mapbox/satellite-v9',
      center: [-122.4194, 37.7749],
      zoom: 12,
      attributionControl: false,
    });

    mapRef.current = map;

    const ro = new ResizeObserver(() => map.resize());
    ro.observe(containerRef.current);

    map.on('load', () => {
      map.resize();

      // Search area fill + border
      map.addSource('search-area', {
        type: 'geojson',
        data: {
          type: 'Feature',
          properties: {},
          geometry: { type: 'Polygon', coordinates: [SEARCH_AREA_COORDS] },
        },
      });
      map.addLayer({ id: 'sa-fill', type: 'fill', source: 'search-area', paint: { 'fill-color': '#00D084', 'fill-opacity': 0.07 } });
      map.addLayer({ id: 'sa-border', type: 'line', source: 'search-area', paint: { 'line-color': '#00D084', 'line-width': 1.5, 'line-dasharray': [4, 2] } });

      // Grid lines
      map.addSource('grid', {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: GRID_LINES.map((coords) => ({
            type: 'Feature',
            properties: {},
            geometry: { type: 'LineString', coordinates: coords },
          })),
        },
      });
      map.addLayer({ id: 'grid-lines', type: 'line', source: 'grid', paint: { 'line-color': '#00D084', 'line-width': 0.5, 'line-opacity': 0.3 } });

      // Detection markers — clickable pings
      detections.forEach((det) => {
        const el = document.createElement('div');
        el.style.cssText = `background:${det.confColor};padding:3px 8px;font-family:'JetBrains Mono',monospace;font-size:10px;font-weight:600;color:#000;cursor:pointer;`;
        el.textContent = `[${det.confidence}%]`;
        el.addEventListener('click', () => onDetectionClick(det));
        new mapboxgl.Marker({ element: el }).setLngLat([det.lng, det.lat]).addTo(map);
      });

      // Drone marker
      const droneEl = document.createElement('div');
      droneEl.style.cssText = 'position:relative;width:40px;height:40px;display:flex;align-items:center;justify-content:center;';
      droneEl.innerHTML = `
        <div style="position:absolute;width:48px;height:48px;border-radius:50%;background:#00D084;opacity:0.1;top:-4px;left:-4px;"></div>
        <div style="position:absolute;width:28px;height:28px;border-radius:50%;background:#00D084;opacity:0.2;top:6px;left:6px;"></div>
        <span style="position:relative;color:#00D084;font-size:22px;font-weight:700;font-family:'JetBrains Mono',monospace;line-height:1;">&gt;</span>
      `;
      new mapboxgl.Marker({ element: droneEl }).setLngLat([-122.424, 37.782]).addTo(map);
    });

    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'bottom-right');
    map.addControl(new mapboxgl.AttributionControl({ compact: true }), 'bottom-right');

    return () => { ro.disconnect(); map.remove(); mapRef.current = null; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fly to a detection when triggered from the modal
  useEffect(() => {
    if (!flyTarget || !mapRef.current) return;
    mapRef.current.flyTo({ center: [flyTarget.lng, flyTarget.lat], zoom: 15, speed: 1.4 });
  }, [flyTarget]);

  if (!MAPBOX_TOKEN) {
    return (
      <div className="absolute inset-0 flex items-center justify-center bg-[#0a0a0a]">
        <div className="flex flex-col gap-2 text-center">
          <span className="text-[#00D084] text-sm">// map_init_failed</span>
          <span className="text-[#555555] text-xs">Set NEXT_PUBLIC_MAPBOX_TOKEN in .env.local</span>
        </div>
      </div>
    );
  }

  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />

      {/* Coordinate bar */}
      <div className="absolute top-3 left-3 flex items-center gap-4 px-3 py-2 bg-[#000000CC] z-10 pointer-events-none">
        <span className="text-[#FFFFFFBB] text-[10px]">lat: 37.7749</span>
        <span className="text-[#FFFFFFBB] text-[10px]">lon: -122.4194</span>
        <span className="text-[#00D084] text-[10px]">zone: alpha_3</span>
      </div>
      {/* Speed bar */}
      <div className="absolute bottom-8 left-3 flex items-center gap-3 px-3 py-2 bg-[#000000CC] z-10 pointer-events-none">
        <span className="text-[#FFFFFFBB] text-[10px] font-semibold">$ 12 km/h</span>
        <span className="text-[#FFFFFFBB] text-[10px]">hdg: 247°</span>
        <span className="text-[#FFFFFFBB] text-[10px]">pattern: grid_sweep</span>
      </div>
      {/* Live detection count */}
      {detectionCount !== undefined && (
        <div className="absolute top-3 right-12 flex items-center gap-3 px-3 py-2 bg-[#000000CC] z-10 pointer-events-none">
          <span className="text-[#00D084] text-[10px] font-semibold">{detectionCount} detection{detectionCount !== 1 ? 's' : ''}</span>
        </div>
      )}
    </div>
  );
}
