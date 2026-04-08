'use client';

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { UserPlus, Pencil, Trash2, X, AlertTriangle } from 'lucide-react';

const INTERNAL_DOMAIN = '@phonetrack.internal';
const ICON_PROPS = { size: 16, strokeWidth: 1.5 };

export default function ManajemenAkun() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  // Create form state
  const [nama, setNama] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');

  // Edit modal state
  const [editModal, setEditModal] = useState(null); // user object or null
  const [editNama, setEditNama] = useState('');
  const [editPassword, setEditPassword] = useState('');
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editError, setEditError] = useState('');

  // Delete confirmation modal state
  const [deleteModal, setDeleteModal] = useState(null); // user object or null
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  const loadUsers = useCallback(async () => {
    try {
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      setUsers(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadUsers(); }, [loadUsers]);

  // ─── CREATE ───
  async function handleCreateUser(e) {
    e.preventDefault();
    setFormError('');
    setFormSuccess('');
    setSubmitting(true);

    try {
      const res = await fetch('/api/admin/create-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nama: nama.trim(),
          username: username.trim().toLowerCase(),
          password,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal membuat akun.');

      setFormSuccess(data.message);
      setNama('');
      setUsername('');
      setPassword('');
      loadUsers();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  // ─── UPDATE ───
  function openEditModal(user) {
    setEditModal(user);
    setEditNama(user.nama || '');
    setEditPassword('');
    setEditError('');
  }

  async function handleUpdateUser(e) {
    e.preventDefault();
    setEditError('');
    setEditSubmitting(true);

    try {
      const body = { userId: editModal.id, nama: editNama };
      if (editPassword) body.password = editPassword;

      const res = await fetch('/api/admin/manage-user', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal memperbarui akun.');

      setEditModal(null);
      loadUsers();
    } catch (err) {
      setEditError(err.message);
    } finally {
      setEditSubmitting(false);
    }
  }

  // ─── DELETE ───
  async function handleDeleteUser() {
    setDeleteError('');
    setDeleting(true);

    try {
      const res = await fetch(`/api/admin/manage-user?userId=${deleteModal.id}`, {
        method: 'DELETE',
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menghapus akun.');

      setDeleteModal(null);
      loadUsers();
    } catch (err) {
      setDeleteError(err.message);
    } finally {
      setDeleting(false);
    }
  }

  function formatDate(d) {
    return new Date(d).toLocaleDateString('id-ID', {
      day: 'numeric', month: 'short', year: 'numeric',
    });
  }

  const salesUsers = users.filter(u => u.role === 'sales');
  const adminUsers = users.filter(u => u.role === 'admin');

  if (loading) {
    return (
      <div className="loading-wrapper">
        <div className="spinner"></div>
        <span>Memuat data akun...</span>
      </div>
    );
  }

  return (
    <>
      <div className="page-header">
        <h1>Manajemen Akun</h1>
        <p>Kelola akun Sales dan Admin — Sistem Invite-Only</p>
      </div>

      {/* Stats */}
      <div className="stat-grid" style={{ gridTemplateColumns: '1fr 1fr 1fr', marginBottom: '1.5rem' }}>
        <div className="stat-card">
          <div className="stat-icon"></div>
          <div className="stat-value">{users.length}</div>
          <div className="stat-label">Total Akun</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon"></div>
          <div className="stat-value">{salesUsers.length}</div>
          <div className="stat-label">Sales Aktif</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon"></div>
          <div className="stat-value">{adminUsers.length}</div>
          <div className="stat-label">Admin</div>
        </div>
      </div>

      {/* Create New Sales Account */}
      <div className="glass-card" style={{ marginBottom: '1.5rem', maxWidth: '600px' }}>
        <div className="section-title">Tambah Akun Sales Baru</div>

        {formError && (
          <div style={{
            background: 'var(--color-danger-bg)', border: '1px solid var(--color-danger-border)',
            borderRadius: 'var(--radius-md)', padding: '0.75rem 1rem', marginBottom: '1rem',
            color: 'var(--color-danger)', fontSize: 'var(--font-size-sm)',
            display: 'flex', alignItems: 'center', gap: '0.5rem',
          }}>
            <AlertTriangle size={14} strokeWidth={1.5} />
            {formError}
          </div>
        )}

        {formSuccess && (
          <div style={{
            background: 'var(--color-success-bg)', border: '1px solid var(--color-success-border)',
            borderRadius: 'var(--radius-md)', padding: '0.75rem 1rem', marginBottom: '1rem',
            color: 'var(--color-success)', fontSize: 'var(--font-size-sm)',
          }}>
            {formSuccess}
          </div>
        )}

        <form onSubmit={handleCreateUser}>
          <div className="input-group">
            <label htmlFor="newNama">Nama Lengkap</label>
            <input
              id="newNama"
              type="text"
              className="input-field"
              placeholder="Nama lengkap sales"
              value={nama}
              onChange={e => setNama(e.target.value)}
              required
            />
          </div>

          <div className="input-group">
            <label htmlFor="newUsername">Username</label>
            <input
              id="newUsername"
              type="text"
              className="input-field"
              placeholder="contoh: budi123"
              value={username}
              onChange={e => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9._]/g, ''))}
              required
              autoCapitalize="off"
              spellCheck="false"
            />
            {username && (
              <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                Internal: <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent-blue)' }}>
                  {username}{INTERNAL_DOMAIN}
                </span>
              </div>
            )}
          </div>

          <div className="input-group">
            <label htmlFor="newPassword">Password</label>
            <input
              id="newPassword"
              type="password"
              className="input-field"
              placeholder="Minimal 6 karakter"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              minLength={6}
            />
          </div>

          <div style={{
            fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)',
            padding: '0.5rem 0.75rem', background: 'var(--bg-surface)',
            borderRadius: 'var(--radius-sm)', marginBottom: '1rem',
          }}>
            Akun baru otomatis mendapat peran <strong>Sales</strong>. Informasikan username dan password kepada sales yang bersangkutan.
          </div>

          <button
            type="submit"
            className="btn btn-primary btn-block"
            disabled={submitting}
          >
            {submitting ? (
              <span className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }}></span>
            ) : (
              <>
                <UserPlus {...ICON_PROPS} />
                Buat Akun Sales
              </>
            )}
          </button>
        </form>
      </div>

      {/* User List Table */}
      <div className="section-title">Daftar Akun Terdaftar</div>
      <div className="table-wrapper">
        <table className="data-table">
          <thead>
            <tr>
              <th>Nama</th>
              <th>Peran</th>
              <th>Terdaftar</th>
              <th style={{ textAlign: 'right' }}>Aksi</th>
            </tr>
          </thead>
          <tbody>
            {users.length === 0 ? (
              <tr>
                <td colSpan={4} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                  Belum ada akun terdaftar.
                </td>
              </tr>
            ) : (
              users.map(user => (
                <tr key={user.id}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <div style={{
                        width: 32, height: 32, borderRadius: '50%',
                        background: user.role === 'admin' ? 'var(--accent-blue-dim)' : 'var(--accent-blue-subtle)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 'var(--font-size-xs)', fontWeight: 700,
                        color: user.role === 'admin' ? '#fff' : 'var(--accent-blue)',
                        flexShrink: 0,
                      }}>
                        {(user.nama || '?').charAt(0).toUpperCase()}
                      </div>
                      <div style={{ fontWeight: 600, fontSize: 'var(--font-size-sm)' }}>{user.nama || '-'}</div>
                    </div>
                  </td>
                  <td>
                    <span className={`badge ${user.role === 'admin' ? 'badge-sold' : 'badge-on-hand'}`}>
                      {user.role === 'admin' ? 'Admin' : 'Sales'}
                    </span>
                  </td>
                  <td style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
                    {formatDate(user.created_at)}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <div style={{ display: 'flex', gap: '0.25rem', justifyContent: 'flex-end' }}>
                      <button
                        className="btn-icon"
                        title="Edit akun"
                        onClick={() => openEditModal(user)}
                      >
                        <Pencil {...ICON_PROPS} />
                      </button>
                      <button
                        className="btn-icon btn-icon-danger"
                        title="Hapus akun"
                        onClick={() => { setDeleteModal(user); setDeleteError(''); }}
                      >
                        <Trash2 {...ICON_PROPS} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* ─── EDIT MODAL ─── */}
      {editModal && (
        <div className="modal-overlay" onClick={() => setEditModal(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h3 style={{ fontWeight: 700, fontSize: 'var(--font-size-md)' }}>Edit Akun</h3>
              <button className="btn-icon" onClick={() => setEditModal(null)}>
                <X size={18} strokeWidth={1.5} />
              </button>
            </div>

            {editError && (
              <div style={{
                background: 'var(--color-danger-bg)', border: '1px solid var(--color-danger-border)',
                borderRadius: 'var(--radius-md)', padding: '0.75rem 1rem', marginBottom: '1rem',
                color: 'var(--color-danger)', fontSize: 'var(--font-size-sm)',
                display: 'flex', alignItems: 'center', gap: '0.5rem',
              }}>
                <AlertTriangle size={14} strokeWidth={1.5} />
                {editError}
              </div>
            )}

            <form onSubmit={handleUpdateUser}>
              <div className="input-group">
                <label htmlFor="editNama">Nama Lengkap</label>
                <input
                  id="editNama"
                  type="text"
                  className="input-field"
                  value={editNama}
                  onChange={e => setEditNama(e.target.value)}
                  required
                />
              </div>

              <div className="input-group">
                <label htmlFor="editPassword">Password Baru (opsional)</label>
                <input
                  id="editPassword"
                  type="password"
                  className="input-field"
                  placeholder="Kosongkan jika tidak ingin mengubah"
                  value={editPassword}
                  onChange={e => setEditPassword(e.target.value)}
                  minLength={6}
                />
              </div>

              <div style={{
                fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)',
                padding: '0.5rem 0.75rem', background: 'var(--bg-surface)',
                borderRadius: 'var(--radius-sm)', marginBottom: '1rem',
              }}>
                Peran akun: <strong>{editModal.role === 'admin' ? 'Admin' : 'Sales'}</strong>
              </div>

              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button type="button" className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setEditModal(null)}>
                  Batal
                </button>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={editSubmitting}>
                  {editSubmitting ? (
                    <span className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }}></span>
                  ) : 'Simpan Perubahan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── DELETE CONFIRMATION MODAL ─── */}
      {deleteModal && (
        <div className="modal-overlay" onClick={() => setDeleteModal(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ fontWeight: 700, fontSize: 'var(--font-size-md)', color: 'var(--color-danger)' }}>Hapus Akun</h3>
              <button className="btn-icon" onClick={() => setDeleteModal(null)}>
                <X size={18} strokeWidth={1.5} />
              </button>
            </div>

            <div style={{
              background: 'var(--color-danger-bg)',
              border: '1px solid var(--color-danger-border)',
              borderRadius: 'var(--radius-md)',
              padding: '1rem',
              marginBottom: '1rem',
              display: 'flex',
              gap: '0.75rem',
              alignItems: 'flex-start',
            }}>
              <AlertTriangle size={20} strokeWidth={1.5} style={{ color: 'var(--color-danger)', flexShrink: 0, marginTop: 2 }} />
              <div style={{ fontSize: 'var(--font-size-sm)' }}>
                <p style={{ color: 'var(--color-danger)', fontWeight: 600, marginBottom: '0.25rem' }}>
                  Apakah Anda yakin ingin menghapus akun &ldquo;{deleteModal.nama}&rdquo;?
                </p>
                <p style={{ color: 'var(--text-muted)' }}>
                  Tindakan ini tidak dapat dibatalkan. Semua data login akun ini akan dihapus secara permanen.
                </p>
              </div>
            </div>

            {deleteError && (
              <div style={{
                background: 'var(--color-danger-bg)', border: '1px solid var(--color-danger-border)',
                borderRadius: 'var(--radius-md)', padding: '0.75rem 1rem', marginBottom: '1rem',
                color: 'var(--color-danger)', fontSize: 'var(--font-size-sm)',
              }}>
                {deleteError}
              </div>
            )}

            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setDeleteModal(null)}>
                Batal
              </button>
              <button className="btn btn-danger" style={{ flex: 1 }} disabled={deleting} onClick={handleDeleteUser}>
                {deleting ? (
                  <span className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }}></span>
                ) : (
                  <>
                    <Trash2 size={14} strokeWidth={1.5} />
                    Ya, Hapus Akun
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
