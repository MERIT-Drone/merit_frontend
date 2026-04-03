'use client';
import { useEffect, useRef, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { isAuthenticated } from '@/lib/auth';
import AppNav from '@/components/layout/AppNav';
import PageWrapper from '@/components/layout/PageWrapper';
import DetectionModal from '@/components/ui/DetectionModal';
import type { Detection } from '@/components/ui/DetectionModal';

type SortKey = 'time' | 'confidence' | 'id';
type SortDir = 'asc' | 'desc';
type FilterPriority = 'all' | 'high_conf' | 'pending_review' | 'low_conf';
type WsStatus = 'connecting' | 'connected' | 'disconnected';

const PRIORITY_FILTERS: { value: FilterPriority; label: string }[] = [
  { value: 'all', label: 'all' },
  { value: 'high_conf', label: 'high_conf' },
  { value: 'pending_review', label: 'pending_review' },
  { value: 'low_conf', label: 'low_conf' },
];

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: 'time', label: 'time' },
  { value: 'confidence', label: 'confidence' },
  { value: 'id', label: 'det_id' },
];

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

function ConfBar({ value }: { value: number }) {
  const color = value >= 70 ? '#00D084' : value >= 50 ? '#FFB800' : '#FF4444';
  return (
    <div className="flex items-center gap-2 w-full">
      <div className="flex-1 h-1 bg-[#E8E8E8]">
        <div className="h-full transition-all" style={{ width: `${value}%`, backgroundColor: color }} />
      </div>
      <span className="text-[11px] font-semibold w-8 text-right" style={{ fontFamily: "'JetBrains Mono', monospace", color }}>
        {value}%
      </span>
    </div>
  );
}

const wsStatusColor: Record<WsStatus, string> = {
  connecting: '#FFB800',
  connected: '#00D084',
  disconnected: '#FF4444',
};

export default function DetectionsPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [detections, setDetections] = useState<Detection[]>([]);
  const [wsStatus, setWsStatus] = useState<WsStatus>('connecting');
  const [sortKey, setSortKey] = useState<SortKey>('time');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [filterPriority, setFilterPriority] = useState<FilterPriority>('all');
  const [activeDetection, setActiveDetection] = useState<Detection | null>(null);
  const idCounter = useRef(1);

  useEffect(() => {
    if (!isAuthenticated()) { router.replace('/login'); return; }
    setReady(true);
  }, [router]);

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

        setDetections((prev) => [det, ...prev]);
      } catch {
        // ignore malformed messages
      }
    };

    return () => ws.close();
  }, [ready]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  }

  const sorted = useMemo(() => {
    const filtered = filterPriority === 'all'
      ? detections
      : detections.filter((d) => d.priority === filterPriority);

    return [...filtered].sort((a, b) => {
      let delta = 0;
      if (sortKey === 'confidence') delta = a.confidence - b.confidence;
      else if (sortKey === 'id') delta = a.id - b.id;
      else delta = a.time.localeCompare(b.time);
      return sortDir === 'asc' ? delta : -delta;
    });
  }, [detections, sortKey, sortDir, filterPriority]);

  if (!ready) return null;

  return (
    <div className="flex h-screen bg-white">
      <AppNav />

      <PageWrapper>
        <div className="flex flex-col flex-1 p-10 gap-7 overflow-hidden min-h-0">
          {/* Title row */}
          <div className="flex items-center w-full shrink-0">
            <div className="flex flex-col gap-1 flex-1">
              <h1 className="text-[36px] font-bold text-black leading-tight">detections</h1>
              <p className="text-[#888888] text-sm">// all person detections — live feed via websocket</p>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <span
                className="w-1.5 h-1.5 rounded-full"
                style={{ backgroundColor: wsStatusColor[wsStatus] }}
              />
              <span className="text-[#888888] text-xs font-semibold" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                ws: {wsStatus}
              </span>
            </div>
          </div>

          {/* Controls row */}
          <div className="flex items-center gap-4 shrink-0">
            <div className="flex items-center gap-1">
              <span className="text-[#888888] text-xs mr-2" style={{ fontFamily: "'JetBrains Mono', monospace" }}>filter:</span>
              {PRIORITY_FILTERS.map((f) => (
                <button
                  key={f.value}
                  onClick={() => setFilterPriority(f.value)}
                  className={`px-3 py-1.5 text-[10px] font-semibold border transition-colors ${
                    filterPriority === f.value
                      ? 'bg-black text-white border-black'
                      : 'bg-white text-[#777777] border-[#E0E0E0] hover:border-black hover:text-black'
                  }`}
                  style={{ fontFamily: "'JetBrains Mono', monospace" }}
                >
                  {f.label}
                </button>
              ))}
            </div>

            <div className="flex-1" />

            <div className="flex items-center gap-1">
              <span className="text-[#888888] text-xs mr-2" style={{ fontFamily: "'JetBrains Mono', monospace" }}>sort:</span>
              {SORT_OPTIONS.map((s) => (
                <button
                  key={s.value}
                  onClick={() => toggleSort(s.value)}
                  className={`flex items-center gap-1 px-3 py-1.5 text-[10px] font-semibold border transition-colors ${
                    sortKey === s.value
                      ? 'bg-black text-white border-black'
                      : 'bg-white text-[#777777] border-[#E0E0E0] hover:border-black hover:text-black'
                  }`}
                  style={{ fontFamily: "'JetBrains Mono', monospace" }}
                >
                  {s.label}
                  {sortKey === s.value && (
                    <span className="text-[9px]">{sortDir === 'desc' ? '↓' : '↑'}</span>
                  )}
                </button>
              ))}
            </div>

            <span className="text-[#888888] text-xs" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
              {sorted.length} result{sorted.length !== 1 ? 's' : ''}
            </span>
          </div>

          {/* Table header */}
          <div className="flex items-center px-4 py-2 bg-[#F5F5F5] border border-[#E8E8E8] shrink-0">
            <span className="w-16 text-[10px] text-[#888888] font-semibold" style={{ fontFamily: "'JetBrains Mono', monospace" }}>det_id</span>
            <span className="w-32 text-[10px] text-[#888888] font-semibold" style={{ fontFamily: "'JetBrains Mono', monospace" }}>timestamp</span>
            <span className="flex-1 text-[10px] text-[#888888] font-semibold" style={{ fontFamily: "'JetBrains Mono', monospace" }}>confidence</span>
            <span className="w-40 text-[10px] text-[#888888] font-semibold" style={{ fontFamily: "'JetBrains Mono', monospace" }}>coordinates</span>
            <span className="w-36 text-[10px] text-[#888888] font-semibold" style={{ fontFamily: "'JetBrains Mono', monospace" }}>priority</span>
            <span className="w-20 text-[10px] text-[#888888] font-semibold" style={{ fontFamily: "'JetBrains Mono', monospace" }}>image</span>
          </div>

          {/* Detection rows */}
          <div className="flex flex-col overflow-y-auto flex-1 min-h-0 border border-[#E8E8E8] divide-y divide-[#F0F0F0]">
            {sorted.map((det) => (
              <button
                key={det.id}
                onClick={() => setActiveDetection(det)}
                className="flex items-center px-4 py-3 hover:bg-[#FAFAFA] transition-colors text-left w-full shrink-0"
              >
                <span className="w-16 text-[11px] font-semibold text-[#000000]" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                  #DET-00{det.id}
                </span>
                <span className="w-32 text-[11px] text-[#555555]" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                  {det.time}
                </span>
                <div className="flex-1 pr-6">
                  <ConfBar value={det.confidence} />
                </div>
                <span className="w-40 text-[11px] text-[#555555]" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                  {det.lat.toFixed(4)}, {det.lng.toFixed(4)}
                </span>
                <div className="w-36">
                  <span
                    className="inline-block px-2 py-0.5 text-[10px] font-semibold"
                    style={{
                      fontFamily: "'JetBrains Mono', monospace",
                      color: det.priorityColor,
                      backgroundColor: det.priorityColor + '22',
                    }}
                  >
                    {det.priority}
                  </span>
                </div>
                <div className="w-20">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={det.image} alt={`Detection ${det.id}`} className="w-14 h-9 object-cover" />
                </div>
              </button>
            ))}

            {sorted.length === 0 && (
              <div className="flex flex-col items-center justify-center flex-1 gap-2 py-20">
                <span className="text-[#CCCCCC] text-2xl font-bold">$</span>
                <span className="text-[#888888] text-sm" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                  {wsStatus === 'connected' ? '// awaiting_detections...' : '// ws_disconnected'}
                </span>
              </div>
            )}
          </div>
        </div>
      </PageWrapper>

      {activeDetection && (
        <DetectionModal detection={activeDetection} onClose={() => setActiveDetection(null)} />
      )}
    </div>
  );
}
