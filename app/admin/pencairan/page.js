'use client';

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { CheckCircle, Send } from 'lucide-react';

export default function PencairanHakSales() {
  const [txs, setTxs] = useState([]);
  const [profiles, setProfiles] = useState({});
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    try {
      const { data: profileData } = await supabase.from('profiles').select('id, nama');
      const pMap = {};
      (profileData || []).forEach(p => { pMap[p.id] = p.nama; });
      setProfiles(pMap);

      // Transfer transactions that are validated but hak_sales not yet paid
      const { data } = await supabase
        .from('transactions')
        .select('*, inventory:inventory_id(merk, tipe, imei)')
        .eq('tipe_pembayaran', 'transfer')
        .eq('status', 'validated')
        .eq('status_pencairan_hak_sales', 'pending')
        .order('created_at', { ascending: false });

      setTxs(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  async function markPaid(txId) {
    const { error } = await supabase
      .from('transactions')
      .update({ status_pencairan_hak_sales: 'lunas' })
      .eq('id', txId);

    if (error) { alert('Gagal: ' + error.message); return; }
    loadData();
  }

  async function markAllPaidForSales(salesId) {
    const salesTxs = txs.filter(t => t.sales_id === salesId);
    for (const tx of salesTxs) {
      await supabase
        .from('transactions')
        .update({ status_pencairan_hak_sales: 'lunas' })
        .eq('id', tx.id);
    }
    loadData();
  }

  function formatRp(val) {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(val);
  }

  function formatDate(d) {
    return new Date(d).toLocaleDateString('id-ID', {
      day: 'numeric', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  }

  // Group by sales
  const bySales = {};
  txs.forEach(tx => {
    if (!bySales[tx.sales_id]) bySales[tx.sales_id] = [];
    bySales[tx.sales_id].push(tx);
  });

  const totalHutang = txs.reduce((s, t) => s + (t.hak_sales || 0), 0);

  if (loading) {
    return (
      <div className="loading-wrapper">
        <div className="spinner"></div>
        <span>Memuat data pencairan...</span>
      </div>
    );
  }

  return (
    <>
      <div className="page-header">
        <h1>Pencairan Hak Sales</h1>
        <p>Hutang perusahaan ke Sales dari transaksi Transfer</p>
      </div>

      <div className="stat-grid" style={{ gridTemplateColumns: '1fr 1fr', marginBottom: '1.5rem' }}>
        <div className="stat-card">
          <div className="stat-icon"></div>
          <div className="stat-value" style={{ color: 'var(--accent-green)', fontSize: 'var(--font-size-lg)' }}>
            {formatRp(totalHutang)}
          </div>
          <div className="stat-label">Total Hutang ke Sales</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon"></div>
          <div className="stat-value">{txs.length}</div>
          <div className="stat-label">Transaksi Belum Cair</div>
        </div>
      </div>

      <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--accent-green)', padding: '0.75rem', background: 'var(--accent-green-subtle)', borderRadius: 'var(--radius-md)', marginBottom: '1rem', border: '1px solid var(--border-active)' }}>
        Saat pembeli membayar via <strong>Transfer</strong>, seluruh uang masuk ke rekening perusahaan. Bagian ini mencatat <strong>hak margin Sales</strong> (Harga Jual Aktual − Harga Wajib Setor) yang perlu ditransfer balik ke Sales.
      </div>

      {Object.keys(bySales).length === 0 ? (
        <div className="glass-card">
          <div className="empty-state" style={{ padding: '2rem' }}>
            <div className="empty-icon">✅</div>
            <p>Semua hak Sales sudah dicairkan!</p>
          </div>
        </div>
      ) : (
        Object.entries(bySales).map(([salesId, salesTxs]) => {
          const salesTotal = salesTxs.reduce((s, t) => s + (t.hak_sales || 0), 0);
          return (
            <div key={salesId} className="glass-card" style={{ marginBottom: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <div>
                  <div style={{ fontWeight: 700 }}>{profiles[salesId] || 'Unknown'}</div>
                  <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
                    {salesTxs.length} transaksi belum dicairkan
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>Total Hak</div>
                  <div style={{ fontWeight: 800, color: 'var(--accent-green)' }}>{formatRp(salesTotal)}</div>
                </div>
              </div>

              {/* Batch pay button */}
              <button
                className="btn btn-primary btn-sm btn-block"
                onClick={() => markAllPaidForSales(salesId)}
                style={{ marginBottom: '0.75rem' }}
              >
                <Send size={14} strokeWidth={1.5} />
                Cairkan Semua ({formatRp(salesTotal)})
              </button>

              {salesTxs.map(tx => (
                <div key={tx.id} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '0.5rem 0', borderTop: '1px solid var(--border-subtle)',
                  fontSize: 'var(--font-size-xs)',
                }}>
                  <div>
                    <div style={{ fontWeight: 600 }}>{tx.inventory?.merk} {tx.inventory?.tipe}</div>
                    <div style={{ color: 'var(--text-muted)' }}>
                      Hak: {formatRp(tx.hak_sales)} • {formatDate(tx.created_at)}
                    </div>
                  </div>
                  <button className="btn btn-success btn-sm" style={{ fontSize: '0.65rem' }} onClick={() => markPaid(tx.id)}>
                    <CheckCircle size={12} strokeWidth={1.5} />
                    Lunas
                  </button>
                </div>
              ))}
            </div>
          );
        })
      )}
    </>
  );
}
