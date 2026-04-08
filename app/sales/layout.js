'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import { Package, Hand, ClipboardList, User, LogOut, Smartphone } from 'lucide-react';
import './sales.css';

const NAV_ICON_PROPS = { size: 20, strokeWidth: 1.5 };

export default function SalesLayout({ children }) {
  const router = useRouter();
  const pathname = usePathname();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function checkAuth() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.replace('/login'); return; }

      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .single();

      if (!data || data.role !== 'sales') {
        router.replace(data?.role === 'admin' ? '/admin' : '/login');
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
    { href: '/sales', icon: <Package {...NAV_ICON_PROPS} />, label: 'Katalog' },
    { href: '/sales/my-items', icon: <Hand {...NAV_ICON_PROPS} />, label: 'Barang Saya' },
    { href: '/sales/history', icon: <ClipboardList {...NAV_ICON_PROPS} />, label: 'Riwayat' },
    { href: '/sales/profile', icon: <User {...NAV_ICON_PROPS} />, label: 'Profil' },
  ];

  return (
    <div className="sales-layout">
      {/* Top Bar */}
      <header className="sales-topbar">
        <div className="topbar-brand">
          <div className="brand-icon"><Smartphone size={16} strokeWidth={1.5} /></div>
          <h2>PhoneTrack</h2>
        </div>
        <div className="topbar-actions">
          <div className="topbar-user">
            <strong>{profile?.nama || 'Sales'}</strong>
            <span>Sales</span>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={handleLogout}>
            <LogOut size={16} strokeWidth={1.5} />
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="sales-main">
        {children}
      </main>

      {/* Bottom Navigation */}
      <nav className="sales-bottom-nav">
        {navItems.map(item => (
          <Link
            key={item.href}
            href={item.href}
            className={pathname === item.href ? 'active' : ''}
          >
            <span className="nav-icon">{item.icon}</span>
            {item.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
