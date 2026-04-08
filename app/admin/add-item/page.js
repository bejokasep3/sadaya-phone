'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { AlertTriangle } from 'lucide-react';

export default function AddItemPage() {
  const [merk, setMerk] = useState('');
  const [tipe, setTipe] = useState('');
  const [imei, setImei] = useState('');
  const [hargaModal, setHargaModal] = useState('');
  const [hargaSetor, setHargaSetor] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  // Quick templates for common brands
  const brands = ['Apple', 'Samsung', 'Xiaomi', 'OPPO', 'Vivo', 'Realme', 'Huawei', 'OnePlus', 'Infinix', 'Tecno'];

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSuccess('');
    setSubmitting(true);

    try {
      const { error: insertError } = await supabase
        .from('inventory')
        .insert({
          merk: merk.trim(),
          tipe: tipe.trim(),
          imei: imei.trim(),
          harga_modal_lelang: parseInt(hargaModal),
          harga_wajib_setor: parseInt(hargaSetor),
          status: 'available',
        });

      if (insertError) throw insertError;

      setSuccess(`✅ ${merk} ${tipe} berhasil ditambahkan!`);
      // Reset form
      setMerk('');
      setTipe('');
      setImei('');
      setHargaModal('');
      setHargaSetor('');
    } catch (err) {
      setError(err.message || 'Gagal menambahkan barang.');
    } finally {
      setSubmitting(false);
    }
  }

  const margin = parseInt(hargaSetor || 0) - parseInt(hargaModal || 0);

  function formatRp(val) {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(val);
  }

  return (
    <>
      <div className="page-header">
        <h1>Tambah Barang Baru</h1>
        <p>Masukkan data HP dari lelang ke inventori</p>
      </div>

      {error && (
        <div style={{
          background: 'var(--color-danger-bg)', border: '1px solid var(--color-danger-border)',
          borderRadius: 'var(--radius-md)', padding: '0.75rem 1rem', marginBottom: '1rem',
          display: 'flex', alignItems: 'center', gap: '0.5rem',
        }}>
          <AlertTriangle size={14} strokeWidth={1.5} />
          {error}
        </div>
      )}

      {success && (
        <div style={{
          background: 'var(--color-success-bg)', border: '1px solid var(--color-success-border)',
          borderRadius: 'var(--radius-md)', padding: '0.75rem 1rem', marginBottom: '1rem',
          color: 'var(--color-success)', fontSize: 'var(--font-size-sm)',
        }}>
          {success}
        </div>
      )}

      <div className="glass-card" style={{ maxWidth: '600px' }}>
        <form onSubmit={handleSubmit}>
          {/* Brand quick select */}
          <div className="input-group">
            <label>Merek</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem', marginBottom: '0.5rem' }}>
              {brands.map(b => (
                <button
                  key={b}
                  type="button"
                  className={`btn btn-sm ${merk === b ? 'btn-primary' : 'btn-ghost'}`}
                  onClick={() => setMerk(b)}
                  style={{ fontSize: '0.7rem' }}
                >
                  {b}
                </button>
              ))}
            </div>
            <input
              type="text"
              className="input-field"
              placeholder="Atau ketik merek lain..."
              value={merk}
              onChange={e => setMerk(e.target.value)}
              required
            />
          </div>

          <div className="input-group">
            <label htmlFor="tipe">Tipe / Model</label>
            <input
              id="tipe"
              type="text"
              className="input-field"
              placeholder="Contoh: iPhone 13 Pro Max 256GB"
              value={tipe}
              onChange={e => setTipe(e.target.value)}
              required
            />
          </div>

          <div className="input-group">
            <label htmlFor="imei">IMEI (Unique Identifier)</label>
            <input
              id="imei"
              type="text"
              className="input-field"
              placeholder="15-digit IMEI number"
              value={imei}
              onChange={e => setImei(e.target.value)}
              required
              minLength={15}
              maxLength={15}
              pattern="[0-9]{15}"
              title="IMEI harus 15 digit angka"
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div className="input-group">
              <label htmlFor="hargaModal">Harga Modal Lelang</label>
              <input
                id="hargaModal"
                type="number"
                className="input-field"
                placeholder="Rp"
                value={hargaModal}
                onChange={e => setHargaModal(e.target.value)}
                required
                min={0}
              />
            </div>

            <div className="input-group">
              <label htmlFor="hargaSetor">Harga Wajib Setor</label>
              <input
                id="hargaSetor"
                type="number"
                className="input-field"
                placeholder="Rp"
                value={hargaSetor}
                onChange={e => setHargaSetor(e.target.value)}
                required
                min={0}
              />
            </div>
          </div>

          {/* Margin preview */}
          {hargaModal && hargaSetor && (
            <div style={{
              padding: '0.75rem',
              background: margin >= 0 ? 'var(--color-success-bg)' : 'var(--color-danger-bg)',
              borderRadius: 'var(--radius-md)',
              marginBottom: '1rem',
              fontSize: 'var(--font-size-sm)',
              border: `1px solid ${margin >= 0 ? 'var(--color-success-border)' : 'var(--color-danger-border)'}`,
            }}>
              <span style={{ color: 'var(--text-muted)' }}>Margin Perusahaan: </span>
              <strong style={{ color: margin >= 0 ? 'var(--color-success)' : 'var(--color-danger)' }}>
                {formatRp(margin)}
              </strong>
            </div>
          )}

          <button
            type="submit"
            className="btn btn-primary btn-block btn-lg"
            disabled={submitting}
          >
            {submitting ? (
              <span className="spinner" style={{ width: 20, height: 20, borderWidth: 2 }}></span>
            ) : (
              '+ Tambah ke Inventori'
            )}
          </button>
        </form>
      </div>
    </>
  );
}
