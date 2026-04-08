'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export default function HistoryPage() {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data } = await supabase
        .from('transactions')
        .select('*, inventory:inventory_id(merk, tipe, imei)')
        .eq('sales_id', session.user.id)
        .order('created_at', { ascending: false });

      setTransactions(data || []);
      setLoading(false);
    }
    load();
  }, []);

  function formatRp(val) {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(val);
  }

  function formatDate(d) {
    return new Date(d).toLocaleDateString('id-ID', {
      day: 'numeric', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  }

  if (loading) {
    return (
      <div className="loading-wrapper">
        <div className="spinner"></div>
        <span>Memuat riwayat...</span>
      </div>
    );
  }

  return (
    <>
      <div className="page-header">
        <h1>Riwayat Transaksi</h1>
        <p>{transactions.length} transaksi tercatat</p>
      </div>

      {transactions.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon"></div>
          <p>Belum ada transaksi.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {transactions.map(tx => (
            <div key={tx.id} className="glass-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 'var(--font-size-base)' }}>
                    {tx.inventory?.merk} {tx.inventory?.tipe}
                  </div>
                  <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                    {tx.inventory?.imei}
                  </div>
                </div>
                <span className={`badge ${tx.status === 'validated' ? 'badge-sold' : 'badge-requested'}`}>
                  {tx.status === 'validated' ? 'Tervalidasi' : 'Menunggu Validasi'}
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', fontSize: 'var(--font-size-xs)', marginBottom: '0.5rem' }}>
                <div>
                  <span style={{ color: 'var(--text-muted)' }}>Harga Jual: </span>
                  <span style={{ fontWeight: 600 }}>{formatRp(tx.harga_jual_aktual)}</span>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)' }}>Keuntungan: </span>
                  <span style={{ fontWeight: 600, color: 'var(--color-success)' }}>{formatRp(tx.hak_sales)}</span>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)' }}>Pembeli: </span>
                  <span>{tx.nama_pembeli}</span>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)' }}>Bayar: </span>
                  <span className={`badge badge-${tx.tipe_pembayaran === 'cash' ? 'available' : 'on-hand'}`} style={{ fontSize: '0.65rem' }}>
                    {tx.tipe_pembayaran === 'cash' ? 'Cash' : 'Transfer'}
                  </span>
                </div>
              </div>

              {/* Pencairan status for transfer */}
              {tx.tipe_pembayaran === 'transfer' && (
                <div style={{
                  fontSize: 'var(--font-size-xs)',
                  padding: '0.375rem 0.5rem',
                  borderRadius: 'var(--radius-sm)',
                  background: tx.status_pencairan_hak_sales === 'lunas' ? 'var(--color-success-bg)' : 'var(--color-warning-bg)',
                  color: tx.status_pencairan_hak_sales === 'lunas' ? 'var(--color-success)' : 'var(--color-warning)',
                }}>
                  {tx.status_pencairan_hak_sales === 'lunas' ? 'Keuntungan sudah dicairkan' : 'Menunggu pencairan dari Admin'}
                </div>
              )}

              <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
                {formatDate(tx.created_at)}
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
