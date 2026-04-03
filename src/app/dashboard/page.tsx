'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { isAuthenticated } from '@/lib/auth';
import AppNav from '@/components/layout/AppNav';
import PageWrapper from '@/components/layout/PageWrapper';
import DetectionModal from '@/components/ui/DetectionModal';
import type { Detection } from '@/components/ui/DetectionModal';
import type { FlyTarget } from '@/components/map/SARMap';

const SARMap = dynamic(() => import('@/components/map/SARMap'), { ssr: false });

function confColor(pct: number): string {
  if (pct >= 80) return '#00D084CC';
  if (pct >= 50) return '#FFB800CC';
  return '#FF4444CC';
}

function priorityLabel(pct: number): string {
  if (pct >= 80) return 'high_conf';
  if (pct >= 50) return 'pending_review';
  return 'low_conf';
}

function priorityColor(pct: number): string {
  if (pct >= 80) return '#00D084';
  if (pct >= 50) return '#FFB800';
  return '#FF4444';
}

type WsStatus = 'connecting' | 'connected' | 'disconnected';

export default function DashboardPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [activeDetection, setActiveDetection] = useState<Detection | null>(null);
  const [flyTarget, setFlyTarget] = useState<FlyTarget | null>(null);
  const [detections, setDetections] = useState<Detection[]>([]);
  const [wsStatus, setWsStatus] = useState<WsStatus>('connecting');
  const idCounter = useRef(1);

  useEffect(() => {
    if (!isAuthenticated()) { router.replace('/login'); return; }
    setReady(true);
  }, [router]);

  // WebSocket connection for live detections
  useEffect(() => {
    if (!ready) return;

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
    const wsUrl = apiUrl.replace(/^http/, 'ws') + '/ws/detections';
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => setWsStatus('connected');
    ws.onclose = () => setWsStatus('disconnected');
    ws.onerror = () => setWsStatus('disconnected');

    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        if (!msg.person_detected) return;

        const det: Detection = {
          id: idCounter.current++,
          lat: msg.lat,
          lng: msg.lng,
          confidence: msg.confidence,
          confColor: confColor(msg.confidence),
          time: new Date(msg.timestamp).toISOString().slice(11, 19),
          priority: priorityLabel(msg.confidence),
          priorityColor: priorityColor(msg.confidence),
          image: msg.image_b64
            ? `data:image/jpeg;base64,${msg.image_b64}`
            : `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}${msg.image_url}`,
        };

        setDetections((prev) => [det, ...prev].slice(0, 50));
      } catch {
        // ignore malformed messages
      }
    };

    return () => ws.close();
  }, [ready]);

  const highConf = detections.filter((d) => d.confidence >= 80).length;
  const pending = detections.filter((d) => d.confidence >= 50 && d.confidence < 80).length;

  const wsStatusColor: Record<WsStatus, string> = {
    connecting: '#FFB800',
    connected: '#00D084',
    disconnected: '#FF4444',
  };

  if (!ready) return null;

  return (
    <div className="flex h-screen bg-white">
      <AppNav />

      <PageWrapper>
        <div className="flex flex-col flex-1 p-10 gap-8 min-h-0 overflow-hidden">
          {/* Title row */}
          <div className="flex items-center w-full shrink-0">
            <div className="flex flex-col gap-1 flex-1">
              <h1 className="text-[36px] font-bold text-black leading-tight">search_and_rescue_hq</h1>
              <p className="text-[#888888] text-sm">// real-time person detection and drone telemetry</p>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <span
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: wsStatusColor[wsStatus] }}
              />
              <span className="text-[#888888] text-xs font-semibold">[{wsStatus.toUpperCase()}]</span>
            </div>
          </div>

          {/* Metrics row */}
          <div className="flex gap-5 w-full shrink-0">
            <div className="flex-1 flex flex-col gap-3 bg-white p-6 border border-[#E8E8E8]">
              <span className="text-[#888888] text-xs">persons_detected</span>
              <span className="text-black text-[36px] font-bold leading-none">{detections.length}</span>
              <span className="text-[#00AF6F] text-xs">
                {highConf} high_conf :: {pending} pending_review
              </span>
            </div>
            <div className="flex-1 flex flex-col gap-3 bg-white p-6 border border-[#E8E8E8]">
              <span className="text-[#888888] text-xs">area_searched</span>
              <span className="text-black text-[36px] font-bold leading-none">4.2 km²</span>
              <span className="text-[#888888] text-xs">// 68% of target_zone covered</span>
            </div>
            <div className="flex-1 flex flex-col gap-3 bg-white p-6 border border-[#E8E8E8]">
              <span className="text-[#888888] text-xs">battery_level</span>
              <span className="text-black text-[36px] font-bold leading-none">78%</span>
              <div className="h-1 bg-[#E8E8E8] w-full">
                <div className="h-full bg-[#00D084]" style={{ width: '78%' }} />
              </div>
            </div>
            <div className="flex-1 flex flex-col gap-3 bg-white p-6 border border-[#E8E8E8]">
              <span className="text-[#888888] text-xs">mission_time</span>
              <span className="text-black text-[36px] font-bold leading-none">01:47:23</span>
              <span className="text-[#888888] text-xs">est_remaining: 00:43:00</span>
            </div>
          </div>

          {/* Bottom: map + feed */}
          <div className="flex gap-5 flex-1 min-h-0">
            {/* Map panel */}
            <div className="flex-1 flex flex-col border border-[#E8E8E8] overflow-hidden min-h-0">
              <div className="flex items-center px-6 py-4 shrink-0">
                <span className="text-black text-sm font-semibold">&gt; search_area_map</span>
              </div>
              <div className="h-px bg-[#E8E8E8] shrink-0" />
              <div className="flex-1 relative min-h-0">
                <SARMap detections={detections} onDetectionClick={setActiveDetection} flyTarget={flyTarget} detectionCount={detections.length} />
              </div>
            </div>

            {/* Detection feed */}
            <div className="flex flex-col border border-[#E8E8E8] overflow-hidden min-h-0 shrink-0" style={{ width: 320 }}>
              <div className="flex items-center px-6 py-4 shrink-0">
                <span className="text-black text-sm font-semibold flex-1">&gt; detection_feed</span>
                <span className="text-[#888888] text-xs">{detections.length} detections</span>
              </div>
              <div className="h-px bg-[#E8E8E8] shrink-0" />

              {detections.length === 0 ? (
                <div className="flex flex-col items-center justify-center flex-1 gap-2 p-6">
                  <span className="text-[#00D084] text-xs font-semibold">
                    {wsStatus === 'connected' ? '// awaiting_detections...' : '// ws_disconnected'}
                  </span>
                  <span className="text-[#AAAAAA] text-[10px] text-center">
                    Live detections will appear here as the drone fleet processes imagery
                  </span>
                </div>
              ) : (
                <div className="flex flex-col gap-3 p-4 overflow-y-auto flex-1 min-h-0">
                  {detections.map((det) => (
                    <button
                      key={det.id}
                      className="relative overflow-hidden shrink-0 text-left cursor-pointer hover:opacity-90 transition-opacity"
                      style={{ height: 110 }}
                      onClick={() => setActiveDetection(det)}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={det.image} alt={`Detection ${det.id}`} className="w-full h-full object-cover" />
                      <div className="absolute top-2 left-2 px-2 py-0.5" style={{ backgroundColor: det.confColor }}>
                        <span className="text-black text-[10px] font-semibold">{det.confidence}%</span>
                      </div>
                      <div className="absolute top-2 right-2 px-2 py-0.5 bg-[#000000CC]">
                        <span className="text-[#FFFFFFBB] text-[10px]">{det.time}</span>
                      </div>
                      <div className="absolute bottom-2 left-2 px-2 py-0.5 bg-[#000000CC]">
                        <span className="text-[10px] font-medium" style={{ color: det.priorityColor }}>{det.priority}</span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </PageWrapper>

      {activeDetection && (
        <DetectionModal
          detection={activeDetection}
          onClose={() => setActiveDetection(null)}
          onViewOnMap={(det) => setFlyTarget({ lng: det.lng, lat: det.lat })}
        />
      )}
    </div>
  );
}
