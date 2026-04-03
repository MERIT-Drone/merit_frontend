'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { setToken, isAuthenticated } from '@/lib/auth';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isAuthenticated()) router.replace('/dashboard');
  }, [router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!email || !password) { setError('// missing credentials'); return; }
    setLoading(true);
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
      const res = await fetch(`${apiUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) {
        const err = await res.json();
        setError(`// ${err.detail || 'authentication_failed'}`);
        setLoading(false);
        return;
      }
      const data = await res.json();
      setToken(data.access_token);
      router.push('/dashboard');
    } catch {
      setError('// connection_failed: unable to reach server');
      setLoading(false);
    }
  }

  return (
    <div className="flex h-screen">
      {/* Left panel - black terminal */}
      <div className="flex flex-col justify-center gap-8 bg-black p-20" style={{ width: '790px', minWidth: '790px' }}>
        <div className="flex items-end gap-4">
          <span className="text-[#00D084] font-bold leading-none" style={{ fontSize: '120px', lineHeight: 1 }}>&gt;</span>
          <div className="flex flex-col gap-1 pb-4">
            <span className="text-white font-bold text-[42px] leading-tight">SKYLINE_SAR</span>
            <span className="text-[#888888] text-sm">// search_and_rescue intelligence platform</span>
          </div>
        </div>
        <div className="flex flex-col gap-3">
          <span className="text-[#777777] text-sm">$ system.auth --verify</span>
          <span className="text-[#00AF6F] text-sm font-medium">[OK] drone_fleet: online</span>
          <span className="text-[#00AF6F] text-sm font-medium">[OK] satellite_uplink: connected</span>
          <span className="text-[#00AF6F] text-sm font-medium">[OK] thermal_sensors: calibrated</span>
          <span className="text-[#777777] text-sm">$ awaiting_credentials...</span>
        </div>
        <div className="h-px bg-[#777777] w-[200px]" />
        <span className="text-[#777777] text-xs">v3.2.1 // classification: restricted</span>
      </div>

      {/* Right panel - white form */}
      <div className="flex flex-col justify-center gap-8 bg-white flex-1 p-20">
        <div className="flex flex-col gap-2">
          <h1 className="text-[42px] font-bold text-black">sign_in</h1>
          <p className="text-[#888888] text-sm">// enter your credentials to continue</p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <div className="flex flex-col gap-1.5">
            <label className="text-[#777777] text-xs font-medium">email_address</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="operator@skyline-sar.gov"
              className="h-12 px-4 bg-[#F5F5F5] border border-[#E0E0E0] text-sm text-black placeholder-[#CCCCCC] outline-none focus:border-[#00D084] transition-colors w-full"
              style={{ fontFamily: 'inherit' }}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-[#777777] text-xs font-medium">password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••••••"
              className="h-12 px-4 bg-[#F5F5F5] border border-[#E0E0E0] text-sm text-black placeholder-[#CCCCCC] outline-none focus:border-[#00D084] transition-colors w-full"
              style={{ fontFamily: 'inherit' }}
            />
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="remember"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
              className="w-4 h-4 border border-[#E0E0E0] accent-[#00D084]"
            />
            <label htmlFor="remember" className="text-[#777777] text-xs cursor-pointer">remember_me</label>
          </div>
          {error && <span className="text-[#FF4444] text-xs">{error}</span>}
          <div className="flex flex-col gap-4 w-full">
            <button
              type="submit"
              disabled={loading}
              className="flex items-center justify-center h-12 w-full bg-[#00D084] text-black text-sm font-medium hover:bg-[#00b873] transition-colors disabled:opacity-60"
            >
              {loading ? '// authenticating...' : '$ authenticate'}
            </button>
            <div className="flex items-center gap-4 w-full">
              <div className="flex-1 h-px bg-[#E0E0E0]" />
              <span className="text-[#888888] text-xs">// or</span>
              <div className="flex-1 h-px bg-[#E0E0E0]" />
            </div>
            <Link
              href="/signup"
              className="flex items-center justify-center h-12 w-full bg-white border border-[#E0E0E0] text-black text-sm font-medium hover:bg-[#F5F5F5] transition-colors"
            >
              &gt; request_access
            </Link>
          </div>
        </form>

        <span className="text-[#888888] text-xs">// authorized_personnel_only</span>
      </div>
    </div>
  );
}
