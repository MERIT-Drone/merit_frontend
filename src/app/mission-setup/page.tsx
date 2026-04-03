'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { isAuthenticated, getToken } from '@/lib/auth';
import AppNav from '@/components/layout/AppNav';
import PageWrapper from '@/components/layout/PageWrapper';

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <span className="text-[#888888] text-xs">{children}</span>;
}

function TextInput({
  placeholder, value, onChange,
}: {
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <input
      type="text"
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-10 px-4 bg-[#F5F5F5] border border-[#E0E0E0] text-sm text-black placeholder-[#CCCCCC] outline-none focus:border-[#00D084] transition-colors w-full"
      style={{ fontFamily: 'inherit' }}
    />
  );
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5 w-full">
      <FieldLabel>{label}</FieldLabel>
      {children}
    </div>
  );
}

type MissionStatus = 'idle' | 'launching' | 'active' | 'error';

export default function MissionSetupPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  // Form state
  const [missionName,       setMissionName]       = useState('');
  const [description,       setDescription]       = useState('');
  const [centerLat,         setCenterLat]         = useState('37.7749');
  const [centerLon,         setCenterLon]         = useState('-122.4194');
  const [searchRadius,      setSearchRadius]      = useState('2.5');
  const [flightAltitude,    setFlightAltitude]    = useState('120');
  const [droneUnit,         setDroneUnit]         = useState('SKY-07');
  const [minConfidence,     setMinConfidence]     = useState('60');

  const [status,   setStatus]   = useState<MissionStatus>('idle');
  const [error,    setError]    = useState('');
  const [missionId, setMissionId] = useState('');

  useEffect(() => {
    if (!isAuthenticated()) { router.replace('/login'); return; }
    setReady(true);
  }, [router]);

  async function handleLaunch() {
    setError('');
    if (!missionName.trim()) { setError('// mission_name is required'); return; }

    setStatus('launching');
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
      const res = await fetch(`${apiUrl}/api/mission/launch`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getToken()}`,
        },
        body: JSON.stringify({
          mission_name:       missionName.trim(),
          center_lat:         parseFloat(centerLat)  || 37.7749,
          center_lon:         parseFloat(centerLon)  || -122.4194,
          search_radius_km:   parseFloat(searchRadius)  || 2.5,
          flight_altitude_m:  parseFloat(flightAltitude) || 120,
          drone_unit:         droneUnit,
          min_confidence_pct: parseInt(minConfidence)  || 60,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        setError(`// ${err.detail || 'launch_failed'}`);
        setStatus('error');
        return;
      }

      const data = await res.json();
      setMissionId(data.mission_id);
      setStatus('active');
    } catch {
      setError('// connection_failed: unable to reach server');
      setStatus('error');
    }
  }

  async function handleEnd() {
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
      await fetch(`${apiUrl}/api/mission/end`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${getToken()}` },
      });
    } finally {
      setStatus('idle');
      setMissionId('');
    }
  }

  if (!ready) return null;

  const isActive = status === 'active';

  return (
    <div className="flex h-screen bg-white">
      <AppNav />

      <PageWrapper>
        <div className="flex flex-col flex-1 p-10 gap-7 overflow-y-auto">
          {/* Title Row */}
          <div className="flex items-center w-full">
            <div className="flex flex-col gap-1 flex-1">
              <h1 className="text-[42px] font-bold text-black leading-tight">mission_control</h1>
              <p className="text-[#888888] text-sm">// configure and launch search_and_rescue operations</p>
            </div>
            <div
              className="flex items-center px-5 py-2.5"
              style={{ backgroundColor: isActive ? '#00D084' : '#FFB800' }}
            >
              <span className="text-black text-xs font-semibold">
                {isActive ? `[ACTIVE: ${missionId.slice(0, 8)}...]` : '[NO_ACTIVE_MISSION]'}
              </span>
            </div>
          </div>

          {/* Status banner */}
          {isActive ? (
            <div className="flex items-center gap-4 bg-white px-6 py-5 border border-[#00D084] w-full">
              <span className="text-[#00D084] text-xl font-bold shrink-0">$</span>
              <div className="flex flex-col gap-1 flex-1">
                <span className="text-black text-sm font-semibold">&gt; mission active — drone instructions deployed</span>
                <span className="text-[#888888] text-xs">
                  // drone will pick up instructions on next poll · TTL refreshes every 30s
                </span>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-4 bg-white px-6 py-5 border border-[#E0E0E0] w-full">
              <span className="text-[#CCCCCC] text-xl font-bold shrink-0">$</span>
              <div className="flex flex-col gap-1 flex-1">
                <span className="text-black text-sm font-semibold">&gt; no mission is currently running</span>
                <span className="text-[#888888] text-xs">
                  // configure mission parameters below and execute $ launch_mission to begin drone deployment
                </span>
              </div>
            </div>
          )}

          {/* Form Columns */}
          <div className="flex gap-6 flex-1">
            {/* Left Col */}
            <div className="flex flex-col gap-5 flex-1">
              {/* Mission Details */}
              <div className="flex flex-col gap-5 bg-white p-6 border border-[#E0E0E0]">
                <span className="text-black text-sm font-semibold">&gt; mission_details</span>

                <FormField label="mission_name">
                  <TextInput
                    placeholder="Hurricane Delta - Sector 7"
                    value={missionName}
                    onChange={setMissionName}
                  />
                </FormField>

                <FormField label="description">
                  <textarea
                    placeholder="// brief mission objectives..."
                    rows={3}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full px-4 py-2 bg-[#F5F5F5] border border-[#E0E0E0] text-sm text-black placeholder-[#CCCCCC] outline-none focus:border-[#00D084] transition-colors resize-none"
                    style={{ fontFamily: 'inherit' }}
                  />
                </FormField>

                <FormField label="drone_unit">
                  <TextInput placeholder="SKY-07" value={droneUnit} onChange={setDroneUnit} />
                </FormField>
              </div>

              {/* Launch Bar */}
              <div className="flex flex-col gap-2">
                {error && (
                  <span className="text-[#FF4444] text-xs px-1">{error}</span>
                )}
                <div className="flex items-center justify-end gap-3 bg-white px-6 py-4 border border-[#E0E0E0]">
                  {isActive ? (
                    <button
                      onClick={handleEnd}
                      className="flex items-center gap-2 px-6 py-3 bg-[#FF4444] text-white text-sm font-semibold hover:bg-[#e03030] transition-colors"
                    >
                      <span className="font-bold">$</span>
                      <span>end_mission</span>
                    </button>
                  ) : (
                    <button
                      onClick={handleLaunch}
                      disabled={status === 'launching'}
                      className="flex items-center gap-2 px-6 py-3 bg-[#00D084] text-black text-sm font-semibold hover:bg-[#00b873] transition-colors disabled:opacity-60"
                    >
                      <span className="font-bold">$</span>
                      <span>{status === 'launching' ? '// deploying...' : 'launch_mission'}</span>
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Right Col */}
            <div className="flex flex-col gap-5 flex-1">
              {/* Search Area Params */}
              <div className="flex flex-col gap-5 bg-white p-6 border border-[#E0E0E0]">
                <span className="text-black text-sm font-semibold">&gt; search_area_params</span>

                <div className="flex gap-3 w-full">
                  <FormField label="center_lat">
                    <TextInput placeholder="37.7749" value={centerLat} onChange={setCenterLat} />
                  </FormField>
                  <FormField label="center_lon">
                    <TextInput placeholder="-122.4194" value={centerLon} onChange={setCenterLon} />
                  </FormField>
                </div>

                <div className="flex gap-3 w-full">
                  <FormField label="search_radius_km">
                    <TextInput placeholder="2.5" value={searchRadius} onChange={setSearchRadius} />
                  </FormField>
                  <FormField label="flight_altitude_m">
                    <TextInput placeholder="120" value={flightAltitude} onChange={setFlightAltitude} />
                  </FormField>
                </div>
              </div>

              {/* Drone Configuration */}
              <div className="flex flex-col gap-5 bg-white p-6 border border-[#E0E0E0]">
                <span className="text-black text-sm font-semibold">&gt; drone_configuration</span>

                <FormField label="min_detection_confidence_%">
                  <TextInput placeholder="60" value={minConfidence} onChange={setMinConfidence} />
                </FormField>
              </div>
            </div>
          </div>
        </div>
      </PageWrapper>
    </div>
  );
}
