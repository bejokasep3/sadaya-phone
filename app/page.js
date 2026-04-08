'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    async function checkAuth() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.replace('/login');
        return;
      }
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', session.user.id)
        .single();

      if (profile?.role === 'admin') {
        router.replace('/admin');
      } else {
        router.replace('/sales');
      }
    }
    checkAuth();
  }, [router]);

  return (
    <div className="loading-wrapper" style={{ minHeight: '100vh' }}>
      <div className="spinner"></div>
      <span>Memuat...</span>
    </div>
  );
}
