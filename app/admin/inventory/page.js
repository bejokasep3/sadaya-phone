'use client';

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { AlertTriangle } from 'lucide-react';

export default function InventoryTracking() {
  const [items, setItems] = useState([]);
  const [profiles, setProfiles] = useState({});
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  const loadData = useCallback(async () => {
    try {
      const { data: profileData } = await supabase.from('profiles').select('id, nama');
      const pMap = {};
      (profileData || []).forEach(p => { pMap[p.id] = p.nama; });
      setProfiles(pMap);

      const { data } = await supabase
        .from('inventory')
        .select('*')
        .order('updated_at', { ascending: false });

      setItems(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  function formatRp(val) {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(val);
  }

  function getElapsed(waktu) {
    if (!waktu) return null;
    const diff = Date.now() - new Date(waktu).getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    return { hours, minutes, text: `${hours}j ${minutes}m`, isOverSLA: hours >= 48 };
  }

  function statusLabel(s) {
    const map = {
      available: 'Tersedia',
      requested: 'Diminta',
      on_hand: 'Dibawa',
      sold: 'Terjual',
      returned: 'Dikembalikan',
    };
    return map[s] || s;
  }

  const filteredItems = filter === 'all' ? items : items.filter(i => i.status === filter);
  const slaWarnings = items.filter(i => i.status === 'on_hand' && getElapsed(i.waktu_diambil)?.isOverSLA).length;

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
      <div className="page-header">
        <h1>Tracking Inventori</h1>
        <p>{items.length} total HP terdaftar</p>
      </div>

      {/* SLA Warning Banner */}
      {slaWarnings > 0 && (
        <div className="glass-card" style={{
          marginBottom: '1rem',
          borderColor: 'var(--color-danger-border)',
          background: 'var(--color-danger-bg)',
          animation: 'pulse-danger 3s ease-in-out infinite',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <span style={{ fontSize: '1.5rem' }}><AlertTriangle size={24} strokeWidth={1.5} style={{ color: 'var(--color-danger)' }} /></span>
            <div>
              <div style={{ fontWeight: 700, color: 'var(--color-danger)' }}>
                {slaWarnings} barang melebihi SLA 2×24 jam!
              </div>
              <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
                Segera hubungi Sales yang bersangkutan.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
        {['all', 'available', 'requested', 'on_hand', 'sold', 'returned'].map(f => (
          <button
            key={f}
            className={`btn btn-sm ${filter === f ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setFilter(f)}
          >
            {f === 'all' ? 'Semua' : statusLabel(f)}
            {f === 'all' ? ` (${items.length})` : ` (${items.filter(i => i.status === f).length})`}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="table-wrapper">
        <table className="data-table">
          <thead>
            <tr>
              <th>Merk / Tipe</th>
              <th>IMEI</th>
              <th>Modal</th>
              <th>Wajib Setor</th>
              <th>Status</th>
              <th>Sales</th>
              <th>Durasi</th>
            </tr>
          </thead>
          <tbody>
            {filteredItems.map(item => {
              const elapsed = item.status === 'on_hand' ? getElapsed(item.waktu_diambil) : null;
              return (
                <tr key={item.id} className={elapsed?.isOverSLA ? 'sla-warning' : ''}>
                  <td>
                    <div style={{ fontWeight: 600 }}>{item.merk}</div>
                    <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>{item.tipe}</div>
                  </td>
                  <td style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--font-size-xs)' }}>{item.imei}</td>
                  <td style={{ fontSize: 'var(--font-size-xs)' }}>{formatRp(item.harga_modal_lelang)}</td>
                  <td style={{ fontSize: 'var(--font-size-xs)' }}>{formatRp(item.harga_wajib_setor)}</td>
                  <td>
                    <span className={`badge badge-${item.status.replace('_', '-')}`}>
                      {statusLabel(item.status)}
                    </span>
                  </td>
                  <td style={{ fontSize: 'var(--font-size-xs)' }}>
                    {item.sales_id ? profiles[item.sales_id] || '-' : '-'}
                  </td>
                  <td>
                    {elapsed ? (
                      <span style={{
                        fontSize: 'var(--font-size-xs)',
                        fontWeight: elapsed.isOverSLA ? 700 : 400,
                        color: elapsed.isOverSLA ? 'var(--color-danger)' : 'var(--text-muted)',
                      }}>
                        {elapsed.text}
                        {elapsed.isOverSLA && ' ⚠'}
                      </span>
                    ) : '-'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
