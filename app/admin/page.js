'use client';

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { AlertTriangle } from 'lucide-react';

export default function AdminDashboard() {
  const [stats, setStats] = useState({
    totalSold: 0,
    totalRevenue: 0,
    grossProfit: 0,
    netProfit: 0,
    avgMarginSales: 0,
    totalInventory: 0,
    onHandCount: 0,
    requestedCount: 0,
  });
  const [weeklyData, setWeeklyData] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    try {
      // Get validated transactions
      const { data: txs } = await supabase
        .from('transactions')
        .select('harga_jual_aktual, harga_wajib_setor, harga_modal_lelang, hak_sales, profit_perusahaan, created_at')
        .eq('status', 'validated');

      const totalSold = txs?.length || 0;
      const totalRevenue = (txs || []).reduce((s, t) => s + (t.harga_wajib_setor || 0), 0);
      const totalModal = (txs || []).reduce((s, t) => s + (t.harga_modal_lelang || 0), 0);
      const netProfit = totalRevenue - totalModal;
      const grossProfit = totalRevenue;

      // Average margin sales (harga_jual_aktual - harga_wajib_setor)
      const margins = (txs || []).map(t => (t.harga_jual_aktual || 0) - (t.harga_wajib_setor || 0));
      const avgMarginSales = margins.length > 0
        ? Math.round(margins.reduce((a, b) => a + b, 0) / margins.length)
        : 0;

      // Inventory counts
      const { data: inv } = await supabase
        .from('inventory')
        .select('status');

      const totalInventory = inv?.length || 0;
      const onHandCount = (inv || []).filter(i => i.status === 'on_hand').length;
      const requestedCount = (inv || []).filter(i => i.status === 'requested').length;

      setStats({ totalSold, totalRevenue, grossProfit, netProfit, avgMarginSales, totalInventory, onHandCount, requestedCount });

      // Weekly trend (last 8 weeks)
      const weeks = [];
      for (let i = 7; i >= 0; i--) {
        const start = new Date();
        start.setDate(start.getDate() - (i * 7 + start.getDay()));
        start.setHours(0, 0, 0, 0);
        const end = new Date(start);
        end.setDate(end.getDate() + 7);

        const count = (txs || []).filter(t => {
          const d = new Date(t.created_at);
          return d >= start && d < end;
        }).length;

        const label = `${start.getDate()}/${start.getMonth() + 1}`;
        weeks.push({ label, count });
      }
      setWeeklyData(weeks);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  function formatRp(val) {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(val);
  }

  const maxWeekly = Math.max(...weeklyData.map(w => w.count), 1);

  if (loading) {
    return (
      <div className="loading-wrapper">
        <div className="spinner"></div>
        <span>Memuat dashboard...</span>
      </div>
    );
  }

  return (
    <>
      <div className="page-header">
        <h1>Dashboard P&L</h1>
        <p>Laporan keuangan dan tren bisnis real-time</p>
      </div>

      <div className="dashboard-grid">
        <div className="dashboard-block">
          <div className="section-title mono-label">Ringkasan Performa</div>
          {/* Stat Cards */}
          <div className="stat-grid">
            <div className="stat-card">
              <div className="stat-value">{stats.totalSold}</div>
              <div className="stat-label">Total Unit Terjual</div>
            </div>

            <div className="stat-card">
              <div className="stat-value" style={{ fontSize: 'var(--font-size-lg)', color: 'var(--accent-green)' }}>{formatRp(stats.grossProfit)}</div>
              <div className="stat-label">Total Harga Wajib Setor</div>
            </div>

            <div className="stat-card">
              <div className="stat-value" style={{ fontSize: 'var(--font-size-lg)', color: 'var(--color-success)' }}>{formatRp(stats.netProfit)}</div>
              <div className="stat-label">Net Profit (Perusahaan)</div>
            </div>

            <div className="stat-card">
              <div className="stat-value" style={{ fontSize: 'var(--font-size-lg)', color: 'var(--accent-green-bright)' }}>{formatRp(stats.avgMarginSales)}</div>
              <div className="stat-label">Rata-rata Margin Sales</div>
            </div>

            <div className="stat-card">
              <div className="stat-value">{stats.totalInventory}</div>
              <div className="stat-label">Total Inventori</div>
            </div>

            <div className="stat-card">
              {stats.onHandCount > 0 && (
                <div style={{ marginBottom: '0.5rem' }}>
                  <AlertTriangle size={18} strokeWidth={1.5} style={{ color: 'var(--color-danger)' }} />
                </div>
              )}
              <div className="stat-value">{stats.onHandCount}</div>
              <div className="stat-label">Dibawa Sales</div>
            </div>
          </div>
        </div>

        <div className="dashboard-block">
          <div className="section-title mono-label">Tren & Insights</div>
          {/* Weekly Trend Chart */}
          <div className="chart-container">
            <div className="chart-header">
              <div className="chart-title">Penjualan Mingguan (8 Minggu Terakhir)</div>
            </div>
            
            <div style={{ position: 'relative', height: '220px', width: '100%', padding: '0 1rem' }}>
              <svg viewBox="0 0 1000 200" preserveAspectRatio="none" style={{ width: '100%', height: '180px', overflow: 'visible' }}>
                <defs>
                  <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--accent-green)" stopOpacity="0.3" />
                    <stop offset="100%" stopColor="var(--accent-green)" stopOpacity="0" />
                  </linearGradient>
                </defs>
                
                {/* Grid Lines */}
                {[0, 0.5, 1].map((p) => (
                  <line 
                    key={p} 
                    x1="0" y1={p * 200} x2="1000" y2={p * 200} 
                    stroke="var(--border-subtle)" 
                    strokeDasharray="4 4"
                  />
                ))}

                {/* Area under the line */}
                <path
                  d={`
                    M 0 200
                    ${weeklyData.map((w, i) => `L ${(i * 1000) / (weeklyData.length - 1)} ${200 - (w.count / maxWeekly) * 180}`).join(' ')}
                    L 1000 200
                    Z
                  `}
                  fill="url(#chartGradient)"
                />

                {/* The Line */}
                <path
                  d={`
                    M 0 ${200 - (weeklyData[0]?.count / maxWeekly) * 180}
                    ${weeklyData.map((w, i) => `L ${(i * 1000) / (weeklyData.length - 1)} ${200 - (w.count / maxWeekly) * 180}`).join(' ')}
                  `}
                  fill="none"
                  stroke="var(--accent-green)"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />

                {/* Data Points */}
                {weeklyData.map((w, i) => (
                  <circle
                    key={i}
                    cx={(i * 1000) / (weeklyData.length - 1)}
                    cy={200 - (w.count / maxWeekly) * 180}
                    r="5"
                    fill="var(--bg-secondary)"
                    stroke="var(--accent-green)"
                    strokeWidth="2"
                  />
                ))}
              </svg>

              {/* Labels */}
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '1rem' }}>
                {weeklyData.map((w, i) => (
                  <div key={i} style={{ textAlign: 'center', flex: 1 }}>
                    <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{w.label}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-primary)', fontWeight: 600 }}>{w.count}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Quick alert */}
          {stats.requestedCount > 0 && (
            <div className="glass-card" style={{
              borderColor: 'var(--color-warning-border)',
              background: 'var(--color-warning-bg)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <AlertTriangle size={18} strokeWidth={1.5} style={{ color: 'var(--color-warning)', flexShrink: 0 }} />
                <div>
                  <div style={{ fontWeight: 600, fontSize: 'var(--font-size-sm)' }}>
                    {stats.requestedCount} barang menunggu approval
                  </div>
                  <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
                    Kunjungi Approval Hub untuk mengkonfirmasi
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
