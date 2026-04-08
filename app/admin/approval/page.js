'use client';

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { AlertTriangle, CheckCircle, XCircle, ExternalLink } from 'lucide-react';

const ICON_SM = { size: 14, strokeWidth: 1.5 };

export default function ApprovalHub() {
  const [requestedItems, setRequestedItems] = useState([]);
  const [pendingTx, setPendingTx] = useState([]);
  const [profiles, setProfiles] = useState({});
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    try {
      // Profiles map
      const { data: profileData } = await supabase.from('profiles').select('id, nama');
      const pMap = {};
      (profileData || []).forEach(p => { pMap[p.id] = p.nama; });
      setProfiles(pMap);

      // Items requesting approval (status = 'requested')
      const { data: reqItems } = await supabase
        .from('inventory')
        .select('*')
        .eq('status', 'requested')
        .order('updated_at', { ascending: false });
      setRequestedItems(reqItems || []);

      // Transactions pending validation
      const { data: pTx } = await supabase
        .from('transactions')
        .select('*, inventory:inventory_id(merk, tipe, imei, harga_modal_lelang)')
        .eq('status', 'pending_validation')
        .order('created_at', { ascending: false });
      setPendingTx(pTx || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // Approve item release (Requested → On Hand)
  async function approveRelease(item) {
    const { error } = await supabase
      .from('inventory')
      .update({
        status: 'on_hand',
        waktu_diambil: new Date().toISOString(),
      })
      .eq('id', item.id);

    if (error) { alert('Gagal: ' + error.message); return; }
    loadData();
  }

  // Reject item release (Requested → Available)
  async function rejectRelease(item) {
    const { error } = await supabase
      .from('inventory')
      .update({ status: 'available', sales_id: null })
      .eq('id', item.id);

    if (error) { alert('Gagal: ' + error.message); return; }
    loadData();
  }

  // Validate transaction (pending_validation → validated)
  async function validateTransaction(tx) {
    // First, update harga_modal_lelang on the transaction from inventory data
    const hargaModal = tx.inventory?.harga_modal_lelang || 0;

    const { error } = await supabase
      .from('transactions')
      .update({
        status: 'validated',
        harga_modal_lelang: hargaModal,
      })
      .eq('id', tx.id);

    if (error) { alert('Gagal: ' + error.message); return; }
    loadData();
  }

  // Reject transaction → revert inventory to on_hand
  async function rejectTransaction(tx) {
    // Revert inventory to on_hand
    await supabase
      .from('inventory')
      .update({ status: 'on_hand' })
      .eq('id', tx.inventory_id);

    // Delete transaction
    await supabase.from('transactions').delete().eq('id', tx.id);
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

  if (loading) {
    return (
      <div className="loading-wrapper">
        <div className="spinner"></div>
        <span>Memuat approval hub...</span>
      </div>
    );
  }

  return (
    <>
      <div className="page-header">
        <h1>Approval Hub</h1>
        <p>Kelola permintaan barang dan validasi transaksi</p>
      </div>

      {/* Section 1: Item Release Approvals */}
      <div className="section-title">Permintaan Ambil Barang ({requestedItems.length})</div>

      {requestedItems.length === 0 ? (
        <div className="glass-card" style={{ marginBottom: '1.5rem' }}>
          <div className="empty-state" style={{ padding: '1.5rem' }}>
            <p>Tidak ada permintaan menunggu.</p>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.5rem' }}>
          {requestedItems.map(item => (
            <div key={item.id} className="approval-card">
              <div className="approval-top">
                <div>
                  <div className="approval-phone">{item.merk} {item.tipe}</div>
                  <div className="approval-meta">
                    IMEI: {item.imei} — Harga Setor: {formatRp(item.harga_wajib_setor)}
                  </div>
                </div>
                <span className="badge badge-requested">Requested</span>
              </div>
              <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
                Diminta oleh: <strong>{profiles[item.sales_id] || 'Unknown'}</strong>
              </div>
              <div className="approval-actions">
                <button className="btn btn-success btn-sm" onClick={() => approveRelease(item)}>
                  <CheckCircle {...ICON_SM} />
                  Approve
                </button>
                <button className="btn btn-danger btn-sm" onClick={() => rejectRelease(item)}>
                  <XCircle {...ICON_SM} />
                  Tolak
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Section 2: Transaction Validations */}
      <div className="section-title">Validasi Penjualan ({pendingTx.length})</div>

      {pendingTx.length === 0 ? (
        <div className="glass-card">
          <div className="empty-state" style={{ padding: '1.5rem' }}>
            <p>Tidak ada transaksi menunggu validasi.</p>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {pendingTx.map(tx => (
            <div key={tx.id} className="approval-card">
              <div className="approval-top">
                <div>
                  <div className="approval-phone">{tx.inventory?.merk} {tx.inventory?.tipe}</div>
                  <div className="approval-meta">IMEI: {tx.inventory?.imei}</div>
                </div>
                <span className="badge badge-requested">Pending</span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', fontSize: 'var(--font-size-xs)', margin: '0.75rem 0' }}>
                <div>
                  <span style={{ color: 'var(--text-muted)' }}>Harga Jual: </span>
                  <strong>{formatRp(tx.harga_jual_aktual)}</strong>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)' }}>Wajib Setor: </span>
                  <strong>{formatRp(tx.harga_wajib_setor)}</strong>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)' }}>Pembeli: </span>
                  <span>{tx.nama_pembeli}</span>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)' }}>WA: </span>
                  <span>{tx.no_wa_pembeli}</span>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)' }}>Lokasi: </span>
                  <span>{tx.lokasi_cod || '-'}</span>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)' }}>Bayar: </span>
                  <span className={`badge badge-${tx.tipe_pembayaran === 'cash' ? 'available' : 'on-hand'}`} style={{ fontSize: '0.6rem' }}>
                    {tx.tipe_pembayaran === 'cash' ? 'Cash' : 'Transfer'}
                  </span>
                </div>
              </div>

              <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
                Sales: <strong>{profiles[tx.sales_id] || 'Unknown'}</strong> — {formatDate(tx.created_at)}
              </div>

              {/* Foto Bukti */}
              {tx.foto_bukti_url && (
                <div style={{ marginTop: '0.5rem' }}>
                  <a href={tx.foto_bukti_url} target="_blank" rel="noopener noreferrer"
                     className="btn btn-ghost btn-sm" style={{ fontSize: 'var(--font-size-xs)' }}>
                    <ExternalLink size={12} strokeWidth={1.5} />
                    Lihat Bukti Foto
                  </a>
                </div>
              )}

              <div className="approval-actions">
                <button className="btn btn-success btn-sm" onClick={() => validateTransaction(tx)}>
                  <CheckCircle {...ICON_SM} />
                  Validasi
                </button>
                <button className="btn btn-danger btn-sm" onClick={() => rejectTransaction(tx)}>
                  <XCircle {...ICON_SM} />
                  Tolak
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
