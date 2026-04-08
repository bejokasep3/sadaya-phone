'use client';

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import { Hand, ShoppingCart, Download } from 'lucide-react';

export default function SalesCatalog() {
  const [items, setItems] = useState([]);
  const [profiles, setProfiles] = useState({});
  const [saldo, setSaldo] = useState(0);
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // all, available, on_hand
  const [search, setSearch] = useState('');
  const [deferredPrompt, setDeferredPrompt] = useState(null);

  // Capture PWA install prompt
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

  const loadData = useCallback(async () => {
    try {
      // Get current user
      const { data: { session } } = await supabase.auth.getSession();
      const userId = session?.user?.id;

      // Get inventory (using view that excludes harga_modal_lelang)
      const { data: invData } = await supabase
        .from('inventory_sales_view')
        .select('*')
        .in('status', ['available', 'requested', 'on_hand'])
        .order('created_at', { ascending: false });

      setItems(invData || []);

      // Get all profiles for "who is holding" info
      const { data: profileData } = await supabase
        .from('profiles')
        .select('id, nama');
      const profileMap = {};
      (profileData || []).forEach(p => { profileMap[p.id] = p.nama; });
      setProfiles(profileMap);

      // Calculate saldo belum dicairkan (for transfer transactions)
      if (userId) {
        const { data: txData } = await supabase
          .from('transactions')
          .select('hak_sales')
          .eq('sales_id', userId)
          .eq('tipe_pembayaran', 'transfer')
          .eq('status', 'validated')
          .eq('status_pencairan_hak_sales', 'pending');

        const total = (txData || []).reduce((sum, t) => sum + (t.hak_sales || 0), 0);
        setSaldo(total);
      }

      // Leaderboard — top 5 sales this month
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);

      const { data: soldTx } = await supabase
        .from('transactions')
        .select('sales_id')
        .eq('status', 'validated')
        .gte('created_at', startOfMonth.toISOString());

      // Count per sales
      const counts = {};
      (soldTx || []).forEach(t => {
        counts[t.sales_id] = (counts[t.sales_id] || 0) + 1;
      });

      const lb = Object.entries(counts)
        .map(([id, count]) => ({ id, nama: profileMap[id] || 'Unknown', count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      setLeaderboard(lb);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // Request item
  async function handleRequest(item) {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const { error } = await supabase
      .from('inventory')
      .update({
        status: 'requested',
        sales_id: session.user.id,
      })
      .eq('id', item.id)
      .eq('status', 'available');

    if (error) {
      alert('Gagal request: ' + error.message);
      return;
    }
    loadData();
  }

  function formatRp(val) {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(val);
  }

  const filteredItems = items.filter(item => {
    const matchFilter = filter === 'all' || item.status === filter;
    const q = search.toLowerCase();
    const matchSearch = !q ||
      item.merk?.toLowerCase().includes(q) ||
      item.tipe?.toLowerCase().includes(q) ||
      item.imei?.toLowerCase().includes(q);
    return matchFilter && matchSearch;
  });

  if (loading) {
    return (
      <div className="loading-wrapper">
        <div className="spinner"></div>
        <span>Memuat inventori...</span>
      </div>
    );
  }

  return (
    <>
      {/* PWA Install Banner */}
      {deferredPrompt && (
        <div className="glass-card" style={{
          marginBottom: '0.75rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0.75rem 1rem',
          background: 'var(--accent-blue-subtle)',
          borderColor: 'var(--border-active)',
        }}>
          <span style={{ fontSize: 'var(--font-size-sm)' }}>
            Install PhoneTrack ke layar utama HP
          </span>
          <button className="btn btn-primary btn-sm" onClick={installPwa}>
            Install
          </button>
        </div>
      )}

      {/* Saldo Widget */}
      <div className="saldo-widget">
        <div className="saldo-info">
          <div className="saldo-label">Saldo Belum Dicairkan</div>
          <div className="saldo-amount">{formatRp(saldo)}</div>
        </div>
        <div className="saldo-icon"></div>
      </div>

      {/* Leaderboard */}
      {leaderboard.length > 0 && (
        <div className="glass-card" style={{ marginBottom: '1rem' }}>
          <div className="section-title">Leaderboard Bulan Ini</div>
          {leaderboard.map((entry, idx) => (
            <div key={entry.id} className="leaderboard-item">
              <div className={`leaderboard-rank ${idx === 0 ? 'rank-1' : idx === 1 ? 'rank-2' : idx === 2 ? 'rank-3' : 'rank-other'}`}>
                {idx + 1}
              </div>
              <div className="leaderboard-name">{entry.nama}</div>
              <div className="leaderboard-count">{entry.count} unit</div>
            </div>
          ))}
        </div>
      )}

      {/* Search & Filter */}
      <div style={{ marginBottom: '1rem' }}>
        <input
          type="text"
          className="input-field"
          placeholder="Cari merk, tipe, atau IMEI..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ marginBottom: '0.5rem' }}
        />
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {['all', 'available', 'on_hand'].map(f => (
            <button
              key={f}
              className={`btn btn-sm ${filter === f ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setFilter(f)}
            >
              {f === 'all' ? 'Semua' : f === 'available' ? 'Tersedia' : 'Dibawa'}
            </button>
          ))}
        </div>
      </div>

      {/* Page title */}
      <div className="page-header">
        <h1>Katalog HP</h1>
        <p>{filteredItems.length} item ditemukan</p>
      </div>

      {/* Catalog Grid */}
      {filteredItems.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon"></div>
          <p>Tidak ada HP yang ditemukan.</p>
        </div>
      ) : (
        <div className="catalog-grid">
          {filteredItems.map(item => (
            <div key={item.id} className="phone-card">
              <div className="phone-header">
                <div>
                  <div className="phone-brand">{item.merk}</div>
                  <div className="phone-name">{item.tipe}</div>
                  <div className="phone-imei">IMEI: {item.imei}</div>
                </div>
                <span className={`badge badge-${item.status.replace('_', '-')}`}>
                  {item.status === 'available' ? 'Tersedia' :
                   item.status === 'requested' ? 'Diminta' :
                   'Dibawa'}
                </span>
              </div>

              <div className="phone-price">{formatRp(item.harga_wajib_setor)}</div>

              <div className="phone-footer">
                {item.status === 'on_hand' && item.sales_id && (
                  <div className="phone-holder">
                    {profiles[item.sales_id] || 'Sales'}
                  </div>
                )}
                {item.status === 'available' && (
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={() => handleRequest(item)}
                  >
                    <Hand size={14} strokeWidth={1.5} />
                    Ambil Barang
                  </button>
                )}
                {item.status === 'on_hand' && (
                  <Link
                    href={`/sales/checkout/${item.id}`}
                    className="btn btn-success btn-sm"
                  >
                    <ShoppingCart size={14} strokeWidth={1.5} />
                    Jual
                  </Link>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
