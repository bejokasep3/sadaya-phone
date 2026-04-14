'use client';

import { useState, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { AlertTriangle, Camera, Upload, X, ImageIcon } from 'lucide-react';
import { formatRibuanInput, parseRibuan } from '@/lib/format';

export default function AddItemPage() {
  const [merk, setMerk] = useState('');
  const [tipe, setTipe] = useState('');
  const [imei, setImei] = useState('');
  const [hargaModal, setHargaModal] = useState('');
  const [hargaSetor, setHargaSetor] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  
  // Photo states — now arrays for multi-upload (max 5)
  const [photos, setPhotos] = useState([]);
  const [photoPreviews, setPhotoPreviews] = useState([]);
  const fileInputRef = useRef(null);

  // Quick templates for common brands
  const brands = ['Apple', 'Samsung', 'Xiaomi', 'OPPO', 'Vivo', 'Realme', 'Huawei', 'OnePlus', 'Infinix', 'Tecno'];

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSuccess('');
    setSubmitting(true);
    let fotoUrls = [];
    
    try {
      // 1. Upload all photos if they exist
      if (photos.length > 0) {
        const uploadPromises = photos.map(async (file) => {
          const fileExt = file.name.split('.').pop();
          const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
          const filePath = `items/${fileName}`;

          const { error: uploadError } = await supabase.storage
            .from('inventory-photos')
            .upload(filePath, file);

          if (uploadError) throw new Error(`Upload gagal: ${uploadError.message}`);

          const { data: { publicUrl } } = supabase.storage
            .from('inventory-photos')
            .getPublicUrl(filePath);
          
          return publicUrl;
        });

        fotoUrls = await Promise.all(uploadPromises);
      }

      // 2. Insert into database
      const { error: insertError } = await supabase
        .from('inventory')
        .insert({
          merk: merk.trim(),
          tipe: tipe.trim(),
          imei: imei.trim(),
          harga_modal_lelang: parseRibuan(hargaModal),
          harga_wajib_setor: parseRibuan(hargaSetor),
          status: 'available',
          foto_url: fotoUrls, // Array of strings
        });

      if (insertError) throw insertError;

      setSuccess(`✅ ${merk} ${tipe} berhasil ditambahkan!`);
      // Reset form
      setMerk('');
      setTipe('');
      setImei('');
      setHargaModal('');
      setHargaSetor('');
      setPhotos([]);
      setPhotoPreviews([]);
    } catch (err) {
      setError(err.message || 'Gagal menambahkan barang.');
    } finally {
      setSubmitting(false);
    }
  }

  function handlePhotoChange(e) {
    const files = Array.from(e.target.files);
    if (!files.length) return;

    if (photos.length + files.length > 5) {
      setError('Maksimal 5 foto per produk');
      return;
    }

    const newPhotos = [...photos];
    const newPreviews = [...photoPreviews];

    files.forEach(file => {
      if (file.size > 5 * 1024 * 1024) {
        setError(`Ukuran foto ${file.name} terlalu besar (maks 5MB)`);
        return;
      }
      newPhotos.push(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        newPreviews.push(reader.result);
        setPhotoPreviews([...newPreviews]);
      };
      reader.readAsDataURL(file);
    });

    setPhotos(newPhotos);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  function removePhoto(index) {
    const newPhotos = [...photos];
    const newPreviews = [...photoPreviews];
    newPhotos.splice(index, 1);
    newPreviews.splice(index, 1);
    setPhotos(newPhotos);
    setPhotoPreviews(newPreviews);
  }

  const margin = parseRibuan(hargaSetor) - parseRibuan(hargaModal);

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
                type="text"
                inputMode="numeric"
                className="input-field"
                placeholder="Rp"
                value={hargaModal}
                onChange={e => setHargaModal(formatRibuanInput(e.target.value))}
                required
              />
            </div>

            <div className="input-group">
              <label htmlFor="hargaSetor">Harga Wajib Setor</label>
              <input
                id="hargaSetor"
                type="text"
                inputMode="numeric"
                className="input-field"
                placeholder="Rp"
                value={hargaSetor}
                onChange={e => setHargaSetor(formatRibuanInput(e.target.value))}
                required
              />
            </div>
          </div>

          {/* Photo Upload Section — Multi-Photo (Max 5) */}
          <div className="input-group" style={{ marginTop: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <label style={{ marginBottom: 0 }}>Foto Produk ({photos.length}/5)</label>
              {photos.length < 5 && (
                <button 
                  type="button" 
                  onClick={() => fileInputRef.current?.click()}
                  style={{ fontSize: '11px', color: 'var(--accent-green)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}
                >
                  + Tambah Foto
                </button>
              )}
            </div>
            
            <input 
              type="file" 
              ref={fileInputRef}
              onChange={handlePhotoChange}
              accept="image/*"
              multiple
              style={{ display: 'none' }}
            />
            
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', 
              gap: '1rem',
              marginTop: '0.5rem'
            }}>
              {photoPreviews.map((preview, idx) => (
                <div key={idx} style={{ position: 'relative', width: '100%', aspectRatio: '4/5', borderRadius: 'var(--radius-md)', overflow: 'hidden', border: '1px solid var(--border-default)' }}>
                  <img 
                    src={preview} 
                    alt={`Preview ${idx + 1}`} 
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                  />
                  <button
                    type="button"
                    onClick={() => removePhoto(idx)}
                    style={{
                      position: 'absolute', top: '5px', right: '5px',
                      width: '24px', height: '24px', borderRadius: '50%',
                      background: 'rgba(0,0,0,0.6)', border: 'none', color: '#fff',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      cursor: 'pointer', backdropFilter: 'blur(4px)', zIndex: 10
                    }}
                  >
                    <X size={14} />
                  </button>
                  <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '4px 8px', background: 'rgba(0,0,0,0.5)', color: '#fff', fontSize: '9px', textAlign: 'center' }}>
                    Foto {idx + 1}
                  </div>
                </div>
              ))}

              {photos.length < 5 && (
                <div 
                  onClick={() => fileInputRef.current?.click()}
                  style={{
                    width: '100%',
                    aspectRatio: '4/5',
                    border: '2px dashed var(--border-default)',
                    borderRadius: 'var(--radius-md)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.5rem',
                    cursor: 'pointer',
                    background: 'var(--bg-secondary)',
                    transition: 'all var(--transition-fast)',
                  }}
                  className="upload-placeholder"
                >
                  <Camera size={20} strokeWidth={1.5} color="var(--text-muted)" />
                  <span style={{ fontSize: '10px', color: 'var(--text-muted)', textAlign: 'center' }}>Klik untuk tambah</span>
                </div>
              )}
            </div>
            
            {photos.length === 0 && (
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '0.5rem', fontStyle: 'italic' }}>
                Atribut visual penting untuk membantu Sales mengenali unit barang.
              </div>
            )}
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
