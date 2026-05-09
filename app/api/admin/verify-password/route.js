import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json(
        { error: 'Server configuration error.' },
        { status: 500 }
      );
    }

    // Create a fresh client for verification
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: false,
      },
    });

    const body = await request.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json({ error: 'Email dan password wajib diisi.' }, { status: 400 });
    }

    // Attempt sign in to verify password
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      return NextResponse.json({ verified: false, error: 'Password salah atau akun tidak ditemukan.' }, { status: 401 });
    }

    // Verify the user is actually an admin
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', data.user.id)
      .single();

    if (profileError || profile?.role !== 'admin') {
      return NextResponse.json({ verified: false, error: 'Akses ditolak. Bukan akun admin.' }, { status: 403 });
    }

    return NextResponse.json({ verified: true });
  } catch (err) {
    console.error('Verify password error:', err);
    return NextResponse.json(
      { error: 'Terjadi kesalahan server saat verifikasi password.' },
      { status: 500 }
    );
  }
}
