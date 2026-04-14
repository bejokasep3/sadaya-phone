'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Search, ExternalLink, Activity } from 'lucide-react';

export default function HistoryPage() {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    async function loadData() {
      // Fetch all transactions including pending validation, mostly useful for history. 
      // Admin can search and filter.
      const { data, error } = await supabase
        .from('transactions')
        .select(`
          *,
          inventory:inventory_id (merk, tipe, imei),
          sales:sales_id (nama)
        `)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Failed to load history:', error.message);
      } else {
        setTransactions(data || []);
      }
      setLoading(false);
    }
    loadData();
  }, []);

  function formatRp(val) {
    if (val === undefined || val === null) return '-';
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(val);
  }

  function formatDate(dateStr) {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleString('id-ID', {
      day: 'numeric', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  }

  // Filter based on search query (merk, tipe, imei, nama sales, status)
  const filteredData = transactions.filter(tx => {
    const q = searchQuery.toLowerCase();
    const inventoryMatch = 
      tx.inventory?.merk?.toLowerCase().includes(q) ||
      tx.inventory?.tipe?.toLowerCase().includes(q) ||
      tx.inventory?.imei?.toLowerCase().includes(q);
    const salesMatch = tx.sales?.nama?.toLowerCase().includes(q);
    const statusMatch = tx.status?.toLowerCase().includes(q);
    
    return inventoryMatch || salesMatch || statusMatch;
  });

  if (loading) {
    return (
      <div className="loading-wrapper">
        <div className="spinner"></div>
        <span>Memuat Histori Penjualan...</span>
      </div>
    );
  }

  return (
    <>
      <div className="page-header">
        <h1>Histori Penjualan</h1>
        <p>Log lengkap seluruh transaksi barang dari awal hingga akhir</p>
      </div>

      <div className="glass-card" style={{ marginBottom: '1.5rem', padding: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <Search size={18} color="var(--text-muted)" />
          <input
            type="text"
            className="input-field"
            placeholder="Cari transaksi berdasarkan Merk, Tipe, IMEI, atau Nama Sales..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ width: '100%', maxWidth: '400px', margin: 0 }}
          />
        </div>
      </div>

      <div className="glass-card" style={{ padding: '0', overflowX: 'auto' }}>
        {filteredData.length === 0 ? (
          <div className="empty-state" style={{ padding: '3rem 1rem' }}>
            <Activity size={32} color="var(--border-active)" style={{ marginBottom: '1rem' }} />
            <p>Tidak ada transaksi yang cocok / ditemukan.</p>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Waktu & Status</th>
                <th>Barang</th>
                <th>Sales</th>
                <th>Pembayaran</th>
                <th>Laba Bersih</th>
                <th>Bukti</th>
              </tr>
            </thead>
            <tbody>
              {filteredData.map(tx => (
                <tr key={tx.id}>
                  <td style={{ verticalAlign: 'top' }}>
                    <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
                      {formatDate(tx.created_at)}
                    </div>
                    <div style={{ marginTop: '0.25rem' }}>
                      <span className={`badge ${tx.status === 'validated' ? 'badge-available' : 'badge-danger'}`}>
                        {tx.status === 'validated' ? 'Sah' : 'Pending'}
                      </span>
                    </div>
                  </td>
                  <td style={{ verticalAlign: 'top' }}>
                    <div style={{ fontWeight: 600 }}>{tx.inventory?.merk} {tx.inventory?.tipe}</div>
                    <div style={{ fontSize: 'var(--font-size-xs)', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
                      IMEI: {tx.inventory?.imei}
                    </div>
                  </td>
                  <td style={{ verticalAlign: 'top' }}>
                    <div style={{ fontWeight: 500 }}>{tx.sales?.nama || 'Unknown'}</div>
                  </td>
                  <td style={{ verticalAlign: 'top' }}>
                    <div>Deal: <strong>{formatRp(tx.harga_jual_aktual)}</strong></div>
                    <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
                      Setor: {formatRp(tx.harga_wajib_setor)}
                    </div>
                    <div style={{ fontSize: '9px', textTransform: 'uppercase', marginTop: '0.25rem', letterSpacing: '0.5px' }}>
                      Pilih: <span style={{ color: tx.tipe_pembayaran === 'cash' ? 'var(--color-warning)' : 'var(--accent-green)' }}>
                        {tx.tipe_pembayaran}
                      </span>
                    </div>
                  </td>
                  <td style={{ verticalAlign: 'top' }}>
                    {tx.status === 'validated' ? (
                      <div>
                        <div style={{ fontWeight: 700, color: 'var(--color-success)', fontSize: 'var(--font-size-md)' }}>
                          {formatRp(tx.profit_perusahaan)}
                        </div>
                        <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
                          Modal: {formatRp(tx.harga_modal_lelang)}
                        </div>
                      </div>
                    ) : (
                      <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                        Menunggu Validasi
                      </div>
                    )}
                  </td>
                  <td style={{ verticalAlign: 'top', textAlign: 'center' }}>
                    {tx.foto_bukti_url ? (
                      <a href={tx.foto_bukti_url} target="_blank" rel="noopener noreferrer" 
                         style={{ 
                            display: 'inline-flex', alignItems: 'center', gap: '0.25rem', 
                            padding: '4px 8px', borderRadius: 'var(--radius-sm)', 
                            background: 'var(--bg-elevated)', border: '1px solid var(--border-default)',
                            fontSize: '11px', fontWeight: 600
                         }}>
                        <ExternalLink size={12} /> Lihat
                      </a>
                    ) : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
