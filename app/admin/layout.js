'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import {
  BarChart3,
  CheckCircle,
  Smartphone,
  Wallet,
  Landmark,
  PlusCircle,
  Users,
  Menu,
  LogOut,
} from 'lucide-react';
import './admin.css';

const ICON_PROPS = { size: 18, strokeWidth: 1.5 };

export default function AdminLayout({ children }) {
  const router = useRouter();
  const pathname = usePathname();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    async function checkAuth() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.replace('/login'); return; }

      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .single();

      if (!data || data.role !== 'admin') {
        router.replace(data?.role === 'sales' ? '/sales' : '/login');
        return;
      }
      setProfile(data);
      setLoading(false);
    }
    checkAuth();
  }, [router]);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.replace('/login');
  }

  if (loading) {
    return (
      <div className="loading-wrapper" style={{ minHeight: '100vh' }}>
        <div className="spinner"></div>
        <span>Memuat...</span>
      </div>
    );
  }

  const navItems = [
    { section: 'Utama' },
    { href: '/admin', icon: <BarChart3 {...ICON_PROPS} />, label: 'Dashboard P&L' },
    { href: '/admin/approval', icon: <CheckCircle {...ICON_PROPS} />, label: 'Approval Hub' },
    { section: 'Inventori & Keuangan' },
    { href: '/admin/inventory', icon: <Smartphone {...ICON_PROPS} />, label: 'Tracking Inventori' },
    { href: '/admin/cash', icon: <Wallet {...ICON_PROPS} />, label: 'Rekonsiliasi Kas' },
    { href: '/admin/pencairan', icon: <Landmark {...ICON_PROPS} />, label: 'Pencairan Hak Sales' },
    { section: 'Manajemen' },
    { href: '/admin/add-item', icon: <PlusCircle {...ICON_PROPS} />, label: 'Tambah Barang' },
    { href: '/admin/accounts', icon: <Users {...ICON_PROPS} />, label: 'Manajemen Akun' },
  ];

  return (
    <div className="admin-layout">
      {/* Sidebar Overlay (mobile) */}
      <div
        className={`sidebar-overlay ${sidebarOpen ? 'visible' : ''}`}
        onClick={() => setSidebarOpen(false)}
      />

      {/* Sidebar */}
      <aside className={`admin-sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-brand">
          <div className="brand-icon"><Smartphone size={20} strokeWidth={1.5} /></div>
          <div>
            <h2>PhoneTrack</h2>
            <small>Admin Panel</small>
          </div>
        </div>

        <nav className="sidebar-nav">
          {navItems.map((item, i) => {
            if (item.section) {
              return <div key={i} className="sidebar-section-label">{item.section}</div>;
            }
            return (
              <Link
                key={item.href}
                href={item.href}
                className={pathname === item.href ? 'active' : ''}
                onClick={() => setSidebarOpen(false)}
                style={{ position: 'relative' }}
              >
                <span className="nav-icon">{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="sidebar-footer">
          <div className="user-info">
            <div className="user-avatar">
              {(profile?.nama || 'A').charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="user-name">{profile?.nama || 'Admin'}</div>
              <div className="user-role">Administrator</div>
            </div>
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="admin-main">
        <header className="admin-topbar">
          <div className="topbar-left">
            <button
              className="burger-btn"
              onClick={() => setSidebarOpen(!sidebarOpen)}
            >
              <Menu size={18} strokeWidth={1.5} />
            </button>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={handleLogout}>
            <LogOut size={16} strokeWidth={1.5} />
            Logout
          </button>
        </header>

        <main className="admin-content">
          {children}
        </main>
      </div>
    </div>
  );
}
