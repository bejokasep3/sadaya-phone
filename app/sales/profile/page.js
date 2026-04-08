'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { LogOut } from 'lucide-react';

export default function ProfilePage() {
  const router = useRouter();
  const [profile, setProfile] = useState(null);
  const [stats, setStats] = useState({ totalSold: 0, totalProfit: 0, pendingSaldo: 0 });
  const [loading, setLoading] = useState(true);
  const [deferredPrompt, setDeferredPrompt] = useState(null);

  useEffect(() => {
    function handler(e) {
      e.preventDefault();
      setDeferredPrompt(e);
    }
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  async function installPwa() {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    setDeferredPrompt(null);
  }

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data: p } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .single();
      setProfile(p);

      // Stats
      const { data: txs } = await supabase
        .from('transactions')
        .select('hak_sales, tipe_pembayaran, status, status_pencairan_hak_sales')
        .eq('sales_id', session.user.id)
        .eq('status', 'validated');

      const totalSold = txs?.length || 0;
      const totalProfit = (txs || []).reduce((s, t) => s + (t.hak_sales || 0), 0);
      const pendingSaldo = (txs || [])
        .filter(t => t.tipe_pembayaran === 'transfer' && t.status_pencairan_hak_sales === 'pending')
        .reduce((s, t) => s + (t.hak_sales || 0), 0);

      setStats({ totalSold, totalProfit, pendingSaldo });
      setLoading(false);
    }
    load();
  }, []);

  function formatRp(val) {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(val);
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    router.replace('/login');
  }

  if (loading) {
    return (
      <div className="loading-wrapper">
        <div className="spinner"></div>
        <span>Memuat profil...</span>
      </div>
    );
  }

  return (
    <>
      <div className="page-header">
        <h1>Profil Saya</h1>
      </div>

      {/* Profile Card */}
      <div className="glass-card" style={{ textAlign: 'center', marginBottom: '1rem', padding: '1.5rem' }}>
        <div style={{
          width: 64, height: 64, borderRadius: '50%', margin: '0 auto 0.75rem',
          background: 'var(--accent-blue-dim)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '1.75rem', fontWeight: 800, color: '#fff',
          boxShadow: 'var(--shadow-blue-glow)',
        }}>
          {(profile?.nama || 'S').charAt(0).toUpperCase()}
        </div>
        <div style={{ fontSize: 'var(--font-size-lg)', fontWeight: 700 }}>{profile?.nama}</div>
        <div className="badge badge-on-hand" style={{ marginTop: '0.375rem' }}>Sales</div>
      </div>

      {/* Stats */}
      <div className="stat-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
        <div className="stat-card">
          <div className="stat-value">{stats.totalSold}</div>
          <div className="stat-label">Unit Terjual</div>
        </div>
        <div className="stat-card">
          <div className="stat-value" style={{ color: 'var(--color-success)', fontSize: 'var(--font-size-lg)' }}>{formatRp(stats.totalProfit)}</div>
          <div className="stat-label">Total Keuntungan</div>
        </div>
      </div>

      {/* Pending Saldo */}
      {stats.pendingSaldo > 0 && (
        <div className="saldo-widget" style={{ marginBottom: '1rem' }}>
          <div className="saldo-info">
            <div className="saldo-label">Saldo Belum Dicairkan</div>
            <div className="saldo-amount">{formatRp(stats.pendingSaldo)}</div>
          </div>
          <div className="saldo-icon"></div>
        </div>
      )}

      {/* PWA Install */}
      <div className="glass-card" style={{ marginBottom: '1rem' }}>
        <div className="section-title" style={{ fontSize: 'var(--font-size-sm)' }}>Install Aplikasi</div>
        <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
          Install PhoneTrack ke layar utama HP Anda agar bisa mengakses tanpa buka browser dan otomatis ter-update.
        </p>
        {deferredPrompt ? (
          <button className="btn btn-primary btn-block" onClick={installPwa}>
            Install ke Homescreen
          </button>
        ) : (
          <div style={{
            fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)',
            padding: '0.75rem', background: 'var(--bg-surface)', borderRadius: 'var(--radius-md)',
          }}>
            <strong>Cara Manual:</strong><br/>
            Android: Tap menu ⋮ → "Add to Home screen"<br/>
            iOS: Tap tombol Share ↗ → "Add to Home Screen"
          </div>
        )}
      </div>

      <button className="btn btn-danger btn-block" onClick={handleLogout}>
        <LogOut size={16} strokeWidth={1.5} />
        Logout
      </button>
    </>
  );
}
