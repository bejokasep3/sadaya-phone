'use client';

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { CheckCircle } from 'lucide-react';

export default function CashReconciliation() {
  const [txs, setTxs] = useState([]);
  const [profiles, setProfiles] = useState({});
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    try {
      const { data: profileData } = await supabase.from('profiles').select('id, nama');
      const pMap = {};
      (profileData || []).forEach(p => { pMap[p.id] = p.nama; });
      setProfiles(pMap);

      // Get all cash transactions that are validated but not yet settled
      const { data } = await supabase
        .from('transactions')
        .select('*, inventory:inventory_id(merk, tipe, imei)')
        .eq('tipe_pembayaran', 'cash')
        .eq('status', 'validated')
        .eq('status_setor_kas', 'belum')
        .order('created_at', { ascending: false });

      setTxs(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  async function markSettled(txId) {
    const { error } = await supabase
      .from('transactions')
      .update({ status_setor_kas: 'lunas' })
      .eq('id', txId);

    if (error) { alert('Gagal: ' + error.message); return; }
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

  const totalPiutang = txs.reduce((s, t) => s + (t.harga_wajib_setor || 0), 0);

  if (loading) {
    return (
      <div className="loading-wrapper">
        <div className="spinner"></div>
        <span>Memuat data kas...</span>
      </div>
    );
  }

  return (
    <>
      <div className="page-header">
        <h1>Rekonsiliasi Kas</h1>
        <p>Piutang Sales (Cash COD belum disetor ke toko)</p>
      </div>

      {/* Total piutang */}
      <div className="stat-grid" style={{ gridTemplateColumns: '1fr 1fr', marginBottom: '1.5rem' }}>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: 'var(--color-danger-bg)', color: 'var(--color-danger)' }}></div>
          <div className="stat-value" style={{ color: 'var(--color-danger)', fontSize: 'var(--font-size-lg)' }}>
            {formatRp(totalPiutang)}
          </div>
          <div className="stat-label">Total Piutang Belum Setor</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon"></div>
          <div className="stat-value">{txs.length}</div>
          <div className="stat-label">Transaksi Pending</div>
        </div>
      </div>

      <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--accent-green)', padding: '0.75rem', background: 'var(--accent-green-subtle)', borderRadius: 'var(--radius-md)', marginBottom: '1rem', border: '1px solid var(--border-active)' }}>
        Piutang hanya mencakup <strong>Harga Wajib Setor</strong>. Selisih dengan harga jual aktual adalah hak margin Sales yang telah diambil di lapangan.
      </div>

      {Object.keys(bySales).length === 0 ? (
        <div className="glass-card">
          <div className="empty-state" style={{ padding: '2rem' }}>
            <div className="empty-icon">✅</div>
            <p>Semua piutang kas sudah lunas!</p>
          </div>
        </div>
      ) : (
        Object.entries(bySales).map(([salesId, salesTxs]) => {
          const salesTotal = salesTxs.reduce((s, t) => s + (t.harga_wajib_setor || 0), 0);
          return (
            <div key={salesId} className="glass-card" style={{ marginBottom: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <div>
                  <div style={{ fontWeight: 700 }}>{profiles[salesId] || 'Unknown'}</div>
                  <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
                    {salesTxs.length} transaksi belum setor
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>Total Piutang</div>
                  <div style={{ fontWeight: 800, color: 'var(--color-danger)' }}>{formatRp(salesTotal)}</div>
                </div>
              </div>

              {salesTxs.map(tx => (
                <div key={tx.id} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '0.5rem 0', borderTop: '1px solid var(--border-subtle)',
                  fontSize: 'var(--font-size-xs)',
                }}>
                  <div>
                    <div style={{ fontWeight: 600 }}>{tx.inventory?.merk} {tx.inventory?.tipe}</div>
                    <div style={{ color: 'var(--text-muted)' }}>{formatDate(tx.created_at)}</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ fontWeight: 700, color: 'var(--color-danger)' }}>{formatRp(tx.harga_wajib_setor)}</span>
                    <button className="btn btn-success btn-sm" style={{ fontSize: '0.65rem' }} onClick={() => markSettled(tx.id)}>
                      <CheckCircle size={12} strokeWidth={1.5} />
                      Lunas
                    </button>
                  </div>
                </div>
              ))}
            </div>
          );
        })
      )}
    </>
  );
}
