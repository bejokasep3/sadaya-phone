'use client';

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import { RotateCcw, ShoppingCart, AlertTriangle } from 'lucide-react';

export default function MyItemsPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadItems = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const { data } = await supabase
      .from('inventory_sales_view')
      .select('*')
      .eq('sales_id', session.user.id)
      .in('status', ['requested', 'on_hand'])
      .order('waktu_diambil', { ascending: false });

    setItems(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { loadItems(); }, [loadItems]);

  async function handleReturn(item) {
    if (!confirm(`Kembalikan ${item.merk} ${item.tipe}?`)) return;

    const { error } = await supabase
      .from('inventory')
      .update({ status: 'available', sales_id: null, waktu_diambil: null })
      .eq('id', item.id);

    if (error) { alert('Gagal: ' + error.message); return; }
    loadItems();
  }

  function formatRp(val) {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(val);
  }

  function getElapsed(waktu) {
    if (!waktu) return null;
    const diff = Date.now() - new Date(waktu).getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    return { hours, minutes, isOverSLA: hours >= 48 };
  }

  if (loading) {
    return (
      <div className="loading-wrapper">
        <div className="spinner"></div>
        <span>Memuat...</span>
      </div>
    );
  }

  return (
    <>
      <div className="page-header">
        <h1>Barang Saya</h1>
        <p>{items.length} item sedang Anda bawa / request</p>
      </div>

      {items.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon"></div>
          <p>Belum ada barang yang Anda bawa.</p>
        </div>
      ) : (
        <div className="catalog-grid">
          {items.map(item => {
            const elapsed = getElapsed(item.waktu_diambil);
            return (
              <div key={item.id} className="phone-card">
                <div className="phone-header">
                  <div>
                    <div className="phone-brand">{item.merk}</div>
                    <div className="phone-name">{item.tipe}</div>
                    <div className="phone-imei">IMEI: {item.imei}</div>
                  </div>
                  <span className={`badge badge-${item.status.replace('_', '-')} ${elapsed?.isOverSLA ? 'badge-danger' : ''}`}>
                    {item.status === 'requested' ? 'Menunggu Approval' : 'Di Tangan'}
                  </span>
                </div>

                <div className="phone-price">{formatRp(item.harga_wajib_setor)}</div>

                {elapsed && item.status === 'on_hand' && (
                  <div style={{
                    fontSize: 'var(--font-size-xs)',
                    color: elapsed.isOverSLA ? 'var(--color-danger)' : 'var(--text-muted)',
                    marginTop: '0.375rem',
                    fontWeight: elapsed.isOverSLA ? 700 : 400,
                  }}>
                    Dipegang: {elapsed.hours}j {elapsed.minutes}m
                    {elapsed.isOverSLA && ' MELEBIHI SLA!'}
                  </div>
                )}

                <div className="phone-footer">
                  {item.status === 'on_hand' && (
                    <>
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => handleReturn(item)}
                      >
                        <RotateCcw size={14} strokeWidth={1.5} />
                        Kembalikan
                      </button>
                      <Link
                        href={`/sales/checkout/${item.id}`}
                        className="btn btn-success btn-sm"
                      >
                        <ShoppingCart size={14} strokeWidth={1.5} />
                        Jual
                      </Link>
                    </>
                  )}
                  {item.status === 'requested' && (
                    <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
                      Menunggu approval Admin...
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
