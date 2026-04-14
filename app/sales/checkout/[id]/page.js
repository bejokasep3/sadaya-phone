'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { MapPin, AlertTriangle, CheckCircle } from 'lucide-react';

export default function CheckoutPage() {
  const router = useRouter();
  const params = useParams();
  const itemId = params.id;

  const [item, setItem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [hargaJual, setHargaJual] = useState('');
  const [namaPembeli, setNamaPembeli] = useState('');
  const [noWa, setNoWa] = useState('');
  const [lokasi, setLokasi] = useState('');
  const [tipePembayaran, setTipePembayaran] = useState('cash');
  const [foto, setFoto] = useState(null);
  const [loadingLokasi, setLoadingLokasi] = useState(false);

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('inventory_sales_view')
        .select('*')
        .eq('id', itemId)
        .single();

      setItem(data);
      setLoading(false);
    }
    load();
  }, [itemId]);

  function getGeolocation() {
    if (!navigator.geolocation) {
      alert('Geolokasi tidak didukung browser Anda.');
      return;
    }
    setLoadingLokasi(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLokasi(`${pos.coords.latitude}, ${pos.coords.longitude}`);
        setLoadingLokasi(false);
      },
      (err) => {
        console.error(err);
        alert('Gagal mendapatkan lokasi. Silakan input manual.');
        setLoadingLokasi(false);
      },
      { enableHighAccuracy: true }
    );
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!item) return;

    const jual = parseInt(hargaJual);
    if (isNaN(jual) || jual < item.harga_wajib_setor) {
      alert(`Harga jual minimal harus sama dengan Harga Wajib Setor: ${formatRp(item.harga_wajib_setor)}`);
      return;
    }

    setSubmitting(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Sesi tidak valid. Silakan login ulang.');

      // Upload foto bukti ke Supabase Storage
      let fotoUrl = '';
      if (foto) {
        const ext = foto.name.split('.').pop();
        const fileName = `${Date.now()}_${item.imei}.${ext}`;
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('bukti-transaksi')
          .upload(fileName, foto, { contentType: foto.type });

        if (uploadError) throw new Error('Gagal upload foto: ' + uploadError.message);

        const { data: urlData } = supabase.storage
          .from('bukti-transaksi')
          .getPublicUrl(fileName);

        fotoUrl = urlData?.publicUrl || '';
      }

      // Get harga_modal from the full inventory table via the transaction record
      // (We embed it from the server side. Sales never sees harga_modal but the
      //  transaction record needs it for computed columns.)
      // We rely on the API route; but since the RLS allows sales to insert transactions
      // and the generated columns compute automatically, we can set harga_modal_lelang = 0 here.
      // Admin will fill in the correct values upon validation.

      // Insert transaction
      const { error: txError } = await supabase
        .from('transactions')
        .insert({
          inventory_id: item.id,
          sales_id: session.user.id,
          harga_jual_aktual: jual,
          harga_wajib_setor: item.harga_wajib_setor,
          harga_modal_lelang: 0, // Will be filled from inventory by admin validation or trigger
          tipe_pembayaran: tipePembayaran,
          nama_pembeli: namaPembeli,
          no_wa_pembeli: noWa,
          lokasi_cod: lokasi,
          foto_bukti_url: fotoUrl,
          status_pencairan_hak_sales: tipePembayaran === 'transfer' ? 'pending' : 'not_applicable',
          status_setor_kas: tipePembayaran === 'cash' ? 'belum' : 'not_applicable',
        });

      if (txError) throw new Error('Gagal membuat transaksi: ' + txError.message);

      // Update inventory status to "sold" (pending validation)
      const { error: invError } = await supabase
        .from('inventory')
        .update({ status: 'sold' })
        .eq('id', item.id);

      if (invError) console.error('Gagal update status inventory:', invError);

      alert('Transaksi berhasil dicatat! Menunggu validasi Admin.');
      router.push('/sales');
    } catch (err) {
      alert(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  function formatRp(val) {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(val);
  }

  if (loading) {
    return (
      <div className="loading-wrapper">
        <div className="spinner"></div>
        <span>Memuat data barang...</span>
      </div>
    );
  }

  if (!item) {
    return (
      <div className="empty-state">
        <div className="empty-icon"></div>
        <p>Barang tidak ditemukan.</p>
      </div>
    );
  }

  const hakSalesPreview = parseInt(hargaJual || 0) - item.harga_wajib_setor;

  return (
    <>
      <div className="page-header">
        <h1>Form Penjualan COD</h1>
        <p>Protokol Anti-Scam — Isi semua field sebelum serah terima</p>
      </div>

      {/* Item summary */}
      <div className="glass-card" style={{ marginBottom: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', textTransform: 'uppercase' }}>{item.merk}</div>
            <div style={{ fontSize: 'var(--font-size-md)', fontWeight: 700 }}>{item.tipe}</div>
            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>IMEI: {item.imei}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>Harga Wajib Setor</div>
            <div style={{ fontSize: 'var(--font-size-lg)', fontWeight: 800, color: 'var(--color-success)' }}>{formatRp(item.harga_wajib_setor)}</div>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        {/* Harga Jual Aktual */}
        <div className="input-group">
          <label htmlFor="hargaJual">Harga Jual Aktual (Deal di Lapangan) *</label>
          <input
            id="hargaJual"
            type="number"
            className="input-field"
            placeholder="Contoh: 3500000"
            value={hargaJual}
            onChange={e => setHargaJual(e.target.value)}
            required
            min={item.harga_wajib_setor}
          />
          {hakSalesPreview > 0 && (
            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-success)', marginTop: '0.25rem', fontWeight: 600 }}>
              Keuntungan Anda: {formatRp(hakSalesPreview)}
            </div>
          )}
        </div>

        {/* Info Pembeli */}
        <div className="glass-card" style={{ marginBottom: '1rem', padding: '1rem' }}>
          <div className="section-title" style={{ fontSize: 'var(--font-size-sm)', marginBottom: '0.75rem' }}>
            Informasi Pembeli
          </div>

          <div className="input-group">
            <label htmlFor="namaPembeli">Nama Pembeli *</label>
            <input
              id="namaPembeli"
              type="text"
              className="input-field"
              placeholder="Nama lengkap pembeli"
              value={namaPembeli}
              onChange={e => setNamaPembeli(e.target.value)}
              required
            />
          </div>

          <div className="input-group">
            <label htmlFor="noWa">No. WhatsApp Pembeli *</label>
            <input
              id="noWa"
              type="tel"
              className="input-field"
              placeholder="08xxxxxxxxxx"
              value={noWa}
              onChange={e => setNoWa(e.target.value)}
              required
            />
          </div>

          <div className="input-group">
            <label htmlFor="lokasi">Lokasi COD *</label>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <input
                id="lokasi"
                type="text"
                className="input-field"
                placeholder="Koordinat atau alamat"
                value={lokasi}
                onChange={e => setLokasi(e.target.value)}
                required
                style={{ flex: 1 }}
              />
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={getGeolocation}
                disabled={loadingLokasi}
              >
                {loadingLokasi ? '...' : <MapPin size={14} strokeWidth={1.5} />} GPS
              </button>
            </div>
          </div>
        </div>

        {/* Tipe Pembayaran */}
        <div className="input-group">
          <label>Tipe Pembayaran *</label>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <div
              className={`role-option ${tipePembayaran === 'cash' ? 'selected' : ''}`}
              onClick={() => setTipePembayaran('cash')}
              style={{ cursor: 'pointer', flex: 1, padding: '0.75rem', borderRadius: 'var(--radius-md)', background: tipePembayaran === 'cash' ? 'var(--color-success-bg)' : 'var(--bg-surface)', border: `2px solid ${tipePembayaran === 'cash' ? 'var(--color-success)' : 'var(--border-subtle)'}` }}
            >
              <div style={{ fontSize: 'var(--font-size-sm)', marginBottom: '0.25rem', fontWeight: 600 }}>Cash</div>

            </div>
            <div
              className={`role-option ${tipePembayaran === 'transfer' ? 'selected' : ''}`}
              onClick={() => setTipePembayaran('transfer')}
              style={{ cursor: 'pointer', flex: 1, padding: '0.75rem', borderRadius: 'var(--radius-md)', background: tipePembayaran === 'transfer' ? 'var(--accent-green-subtle)' : 'var(--bg-surface)', border: `2px solid ${tipePembayaran === 'transfer' ? 'var(--accent-green)' : 'var(--border-subtle)'}` }}
            >
              <div style={{ fontSize: 'var(--font-size-sm)', marginBottom: '0.25rem', fontWeight: 600 }}>Transfer</div>

            </div>
          </div>

          {tipePembayaran === 'cash' && (
            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-warning)', marginTop: '0.5rem', padding: '0.5rem', background: 'var(--color-warning-bg)', borderRadius: 'var(--radius-sm)', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
              <AlertTriangle size={12} strokeWidth={1.5} />
              Anda wajib menyetorkan <strong>{formatRp(item.harga_wajib_setor)}</strong> ke Admin. Sisanya adalah keuntungan Anda.
            </div>
          )}
          {tipePembayaran === 'transfer' && (
            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--accent-green)', marginTop: '0.5rem', padding: '0.5rem', background: 'var(--accent-green-subtle)', borderRadius: 'var(--radius-sm)' }}>
              Transfer masuk ke rekening perusahaan. Keuntungan Anda akan dicairkan oleh Admin.
            </div>
          )}
        </div>

        {/* Upload Foto */}
        <div className="input-group">
          <label htmlFor="foto">Foto Bukti Pembayaran / Fisik Uang *</label>
          <input
            id="foto"
            type="file"
            accept="image/*"
            capture="environment"
            className="input-field"
            onChange={e => setFoto(e.target.files?.[0] || null)}
            required
            style={{ padding: '0.5rem' }}
          />
          {foto && (
            <div style={{ marginTop: '0.5rem', fontSize: 'var(--font-size-xs)', color: 'var(--color-success)' }}>
              {foto.name} ({(foto.size / 1024).toFixed(0)} KB)
            </div>
          )}
        </div>

        <button
          type="submit"
          className="btn btn-success btn-block btn-lg"
          disabled={submitting}
          style={{ marginTop: '1rem' }}
        >
          {submitting ? (
            <span className="spinner" style={{ width: 20, height: 20, borderWidth: 2 }}></span>
          ) : (
            'Konfirmasi Penjualan'
          )}
        </button>
      </form>
    </>
  );
}
