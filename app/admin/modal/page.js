'use client';

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { 
  Banknote, 
  TrendingUp, 
  TrendingDown, 
  Box, 
  Wallet, 
  Plus, 
  Trash2, 
  Edit2, 
  AlertTriangle, 
  CheckCircle2,
  X,
  Lock
} from 'lucide-react';
import { formatRibuanInput, parseRibuan } from '@/lib/format';

export default function TrackingModalPage() {
  const { user } = useAuth();
  const [funds, setFunds] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  
  // Form states
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState(null);
  const [tipe, setTipe] = useState('setoran');
  const [jumlah, setJumlah] = useState('');
  const [keterangan, setKeterangan] = useState('');
  const [tanggal, setTanggal] = useState(new Date().toISOString().split('T')[0]);
  
  // Password Verification states
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [adminPassword, setAdminPassword] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [pendingAction, setPendingAction] = useState(null);
  
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      // 1. Fetch Capital Funds
      const { data: fundsData, error: fundsError } = await supabase
        .from('capital_funds')
        .select('*')
        .order('tanggal', { ascending: false })
        .order('created_at', { ascending: false });
      
      if (fundsError) throw fundsError;
      setFunds(fundsData || []);

      // 2. Fetch Inventory for capital distribution
      const { data: invData, error: invError } = await supabase
        .from('inventory')
        .select('merk, tipe, imei, harga_modal_lelang, status');
      
      if (invError) throw invError;
      setInventory(invData || []);
    } catch (err) {
      console.error('Error loading modal data:', err);
      setError('Gagal memuat data.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const totalSetoran = funds
    .filter(f => f.tipe === 'setoran')
    .reduce((acc, curr) => acc + Number(curr.jumlah), 0);
  
  const totalPenarikan = funds
    .filter(f => f.tipe === 'penarikan')
    .reduce((acc, curr) => acc + Number(curr.jumlah), 0);
  
  const modalTersebar = inventory.reduce((acc, curr) => acc + Number(curr.harga_modal_lelang), 0);
  const sisaSaldo = (totalSetoran - totalPenarikan) - modalTersebar;

  function formatRp(val) {
    return new Intl.NumberFormat('id-ID', { 
      style: 'currency', 
      currency: 'IDR', 
      minimumFractionDigits: 0 
    }).format(val);
  }

  const handleOpenForm = (item = null) => {
    if (item) {
      setEditId(item.id);
      setTipe(item.tipe);
      setJumlah(formatRibuanInput(item.jumlah.toString()));
      setKeterangan(item.keterangan);
      setTanggal(item.tanggal);
    } else {
      setEditId(null);
      setTipe('setoran');
      setJumlah('');
      setKeterangan('');
      setTanggal(new Date().toISOString().split('T')[0]);
    }
    setShowForm(true);
    setError('');
    setSuccess('');
  };

  const initiateAction = (e) => {
    e.preventDefault();
    setError('');
    
    const nominal = parseRibuan(jumlah);
    if (nominal <= 0) {
      setError('Jumlah harus lebih dari 0.');
      return;
    }

    if (tipe === 'penarikan' && !editId && nominal > sisaSaldo) {
      setError('Saldo tidak mencukupi untuk penarikan ini.');
      return;
    }

    setPendingAction({ type: editId ? 'update' : 'create' });
    setShowPasswordModal(true);
  };

  const confirmAction = async () => {
    setVerifying(true);
    setError('');
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const currentUserEmail = session?.user?.email;
      
      if (!currentUserEmail) {
        throw new Error('Sesi tidak valid, harap login ulang.');
      }

      // 1. Verify Password via API
      const res = await fetch('/api/admin/verify-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: currentUserEmail, password: adminPassword })
      });
      
      const authResult = await res.json();
      if (!authResult.verified) {
        throw new Error(authResult.error || 'Password salah.');
      }

      // 2. Perform Mutation
      const payload = {
        tipe,
        jumlah: parseRibuan(jumlah),
        keterangan: keterangan.trim(),
        tanggal,
        created_by: session.user.id
      };

      if (pendingAction.type === 'create') {
        const { error: insError } = await supabase
          .from('capital_funds')
          .insert(payload);
        if (insError) throw insError;
        setSuccess('Berhasil menambahkan transaksi modal.');
      } else if (pendingAction.type === 'update') {
        const { error: updError } = await supabase
          .from('capital_funds')
          .update(payload)
          .eq('id', editId);
        if (updError) throw updError;
        setSuccess('Berhasil memperbarui transaksi modal.');
      } else if (pendingAction.type === 'delete') {
        const { error: delError } = await supabase
          .from('capital_funds')
          .delete()
          .eq('id', pendingAction.id);
        if (delError) throw delError;
        setSuccess('Berhasil menghapus transaksi modal.');
      }

      // Cleanup
      setShowPasswordModal(false);
      setShowForm(false);
      setAdminPassword('');
      loadData();
    } catch (err) {
      setError(err.message || 'Terjadi kesalahan.');
    } finally {
      setVerifying(false);
    }
  };

  const handleDelete = (id) => {
    setPendingAction({ type: 'delete', id });
    setShowPasswordModal(true);
  };

  if (loading && funds.length === 0) {
    return (
      <div className="loading-wrapper">
        <div className="spinner"></div>
        <span>Memuat data modal...</span>
      </div>
    );
  }

  return (
    <>
      <div className="page-header">
        <h1>Tracking Modal</h1>
        <p>Kelola dana modal dan pantau distribusi ke inventori</p>
      </div>

      {/* Summary Cards */}
      <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', marginBottom: '2rem' }}>
        <div className="stat-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div className="stat-value" style={{ color: 'var(--color-success)' }}>{formatRp(totalSetoran)}</div>
              <div className="stat-label">Total Modal Disetor</div>
            </div>
            <TrendingUp size={24} color="var(--color-success)" strokeWidth={1.5} />
          </div>
        </div>

        <div className="stat-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div className="stat-value" style={{ color: 'var(--color-danger)' }}>{formatRp(totalPenarikan)}</div>
              <div className="stat-label">Total Penarikan</div>
            </div>
            <TrendingDown size={24} color="var(--color-danger)" strokeWidth={1.5} />
          </div>
        </div>

        <div className="stat-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div className="stat-value" style={{ color: 'var(--text-secondary)' }}>{formatRp(modalTersebar)}</div>
              <div className="stat-label">Modal Tersebar (Items)</div>
            </div>
            <Box size={24} color="var(--text-muted)" strokeWidth={1.5} />
          </div>
        </div>

        <div className="stat-card" style={{ background: 'var(--accent-green-subtle)', borderColor: 'var(--accent-green)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div className="stat-value" style={{ color: 'var(--accent-green-bright)' }}>{formatRp(sisaSaldo)}</div>
              <div className="stat-label">Sisa Saldo Tersedia</div>
            </div>
            <Wallet size={24} color="var(--accent-green)" strokeWidth={1.5} />
          </div>
        </div>
      </div>

      {error && (
        <div style={{
          background: 'var(--color-danger-bg)', border: '1px solid var(--color-danger-border)',
          borderRadius: 'var(--radius-md)', padding: '0.75rem 1rem', marginBottom: '1.5rem',
          display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--color-danger)', fontSize: 'var(--font-size-sm)'
        }}>
          <AlertTriangle size={16} strokeWidth={1.5} />
          {error}
        </div>
      )}

      {success && (
        <div style={{
          background: 'var(--color-success-bg)', border: '1px solid var(--color-success-border)',
          borderRadius: 'var(--radius-md)', padding: '0.75rem 1rem', marginBottom: '1.5rem',
          display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--color-success)', fontSize: 'var(--font-size-sm)'
        }}>
          <CheckCircle2 size={16} strokeWidth={1.5} />
          {success}
        </div>
      )}

      <div className="dashboard-grid">
        {/* History Section */}
        <div className="dashboard-block">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <div className="section-title mono-label">Riwayat Transaksi Modal</div>
            <button className="btn btn-primary btn-sm" onClick={() => handleOpenForm()}>
              <Plus size={16} /> Tambah
            </button>
          </div>

          <div className="table-wrapper glass-card" style={{ padding: 0 }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Tanggal</th>
                  <th>Tipe</th>
                  <th>Jumlah</th>
                  <th>Keterangan</th>
                  <th style={{ textAlign: 'right' }}>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {funds.length === 0 ? (
                  <tr>
                    <td colSpan="5" style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                      Belum ada riwayat transaksi.
                    </td>
                  </tr>
                ) : (
                  funds.map(item => (
                    <tr key={item.id}>
                      <td style={{ fontSize: 'var(--font-size-xs)' }}>{new Date(item.tanggal).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}</td>
                      <td>
                        <span className={`badge ${item.tipe === 'setoran' ? 'badge-available' : 'badge-danger'}`} style={{ fontSize: '9px' }}>
                          {item.tipe.toUpperCase()}
                        </span>
                      </td>
                      <td style={{ fontWeight: 600, color: item.tipe === 'setoran' ? 'var(--accent-green)' : 'var(--color-danger)' }}>
                        {item.tipe === 'penarikan' ? '-' : ''}{formatRp(item.jumlah)}
                      </td>
                      <td style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', maxWidth: '150px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {item.keterangan || '-'}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                          <button className="btn btn-ghost btn-sm" style={{ padding: '4px' }} onClick={() => handleOpenForm(item)}>
                            <Edit2 size={14} />
                          </button>
                          <button className="btn btn-ghost btn-sm" style={{ padding: '4px', color: 'var(--color-danger)' }} onClick={() => handleDelete(item.id)}>
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Distribution Section */}
        <div className="dashboard-block">
          <div className="section-title mono-label" style={{ marginBottom: '0.5rem' }}>Distribusi Modal ke Item</div>
          <div className="table-wrapper glass-card" style={{ padding: 0 }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Item</th>
                  <th>IMEI</th>
                  <th>Modal</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {inventory.length === 0 ? (
                  <tr>
                    <td colSpan="4" style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                      Belum ada data inventori.
                    </td>
                  </tr>
                ) : (
                  inventory.slice(0, 10).map((item, idx) => (
                    <tr key={idx}>
                      <td>
                        <div style={{ fontWeight: 600, fontSize: 'var(--font-size-xs)' }}>{item.merk}</div>
                        <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{item.tipe}</div>
                      </td>
                      <td style={{ fontFamily: 'var(--font-mono)', fontSize: '10px' }}>{item.imei}</td>
                      <td style={{ fontSize: 'var(--font-size-xs)' }}>{formatRp(item.harga_modal_lelang)}</td>
                      <td>
                        <span className={`badge badge-${item.status.replace('_', '-')}`} style={{ fontSize: '9px' }}>
                          {item.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
                {inventory.length > 10 && (
                  <tr>
                    <td colSpan="4" style={{ textAlign: 'center', padding: '0.75rem', fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', background: 'var(--bg-secondary)' }}>
                      Menampilkan 10 dari {inventory.length} item. Lihat selengkapnya di Tracking Inventori.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Form Overlay Modal */}
      {showForm && (
        <div className="modal-overlay" style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem'
        }}>
          <div className="glass-card" style={{ width: '100%', maxWidth: '450px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h2 style={{ fontSize: 'var(--font-size-md)' }}>{editId ? 'Edit Transaksi' : 'Tambah Transaksi Modal'}</h2>
              <button className="btn btn-ghost btn-sm" style={{ padding: '4px' }} onClick={() => setShowForm(false)}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={initiateAction}>
              <div className="input-group">
                <label>Tipe Transaksi</label>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    type="button"
                    className={`btn btn-block btn-sm ${tipe === 'setoran' ? 'btn-primary' : 'btn-ghost'}`}
                    onClick={() => setTipe('setoran')}
                  >
                    Setoran (Masuk)
                  </button>
                  <button
                    type="button"
                    className={`btn btn-block btn-sm ${tipe === 'penarikan' ? 'btn-danger' : 'btn-ghost'}`}
                    onClick={() => setTipe('penarikan')}
                  >
                    Penarikan (Keluar)
                  </button>
                </div>
              </div>

              <div className="input-group">
                <label htmlFor="jumlah">Jumlah Nominal</label>
                <input
                  id="jumlah"
                  type="text"
                  inputMode="numeric"
                  className="input-field"
                  placeholder="Rp"
                  value={jumlah}
                  onChange={e => setJumlah(formatRibuanInput(e.target.value))}
                  required
                />
              </div>

              <div className="input-group">
                <label htmlFor="tanggal">Tanggal</label>
                <input
                  id="tanggal"
                  type="date"
                  className="input-field"
                  value={tanggal}
                  onChange={e => setTanggal(e.target.value)}
                  required
                />
              </div>

              <div className="input-group">
                <label htmlFor="keterangan">Keterangan (Opsional)</label>
                <textarea
                  id="keterangan"
                  className="input-field"
                  style={{ minHeight: '80px', resize: 'none' }}
                  placeholder="Contoh: Tambahan modal lelang batch 5"
                  value={keterangan}
                  onChange={e => setKeterangan(e.target.value)}
                />
              </div>

              <button type="submit" className="btn btn-primary btn-block btn-lg" style={{ marginTop: '1rem' }}>
                {editId ? 'Perbarui Transaksi' : 'Simpan Transaksi'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Password Verification Modal */}
      {showPasswordModal && (
        <div className="modal-overlay" style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.9)', backdropFilter: 'blur(8px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, padding: '1rem'
        }}>
          <div className="glass-card" style={{ width: '100%', maxWidth: '380px', textAlign: 'center' }}>
            <div style={{
              width: '60px', height: '60px', borderRadius: '50%', background: 'var(--bg-secondary)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem',
              border: '1px solid var(--border-default)', color: 'var(--accent-green)'
            }}>
              <Lock size={28} strokeWidth={1.5} />
            </div>
            
            <h2 style={{ fontSize: 'var(--font-size-md)', marginBottom: '0.5rem' }}>Konfirmasi Admin</h2>
            <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
              Masukkan password admin Anda untuk melanjutkan tindakan ini.
            </p>

            <div className="input-group">
              <input
                type="password"
                className="input-field"
                placeholder="Password Admin"
                style={{ textAlign: 'center' }}
                value={adminPassword}
                onChange={e => setAdminPassword(e.target.value)}
                autoFocus
                onKeyDown={(e) => e.key === 'Enter' && confirmAction()}
              />
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem' }}>
              <button 
                className="btn btn-ghost btn-block" 
                onClick={() => { setShowPasswordModal(false); setAdminPassword(''); }}
                disabled={verifying}
              >
                Batal
              </button>
              <button 
                className="btn btn-primary btn-block" 
                onClick={confirmAction}
                disabled={verifying || !adminPassword}
              >
                {verifying ? <div className="spinner" style={{ width: 16, height: 16 }}></div> : 'Verifikasi'}
              </button>
            </div>
          </div>
        </div>
      )}
      
      <style jsx>{`
        .modal-overlay {
          animation: fadeIn 0.2s ease-out;
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
      `}</style>
    </>
  );
}
