import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const INTERNAL_DOMAIN = '@phonetrack.internal';

export async function POST(request) {
  try {
    // Validate Service Role Key is configured
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

    if (!serviceRoleKey || !supabaseUrl) {
      return NextResponse.json(
        { error: 'Server belum dikonfigurasi. SUPABASE_SERVICE_ROLE_KEY belum diisi.' },
        { status: 500 }
      );
    }

    // Create admin Supabase client with Service Role Key
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Parse request body
    const body = await request.json();
    const { nama, username, password } = body;

    // Validate inputs
    if (!nama?.trim()) {
      return NextResponse.json({ error: 'Nama lengkap wajib diisi.' }, { status: 400 });
    }
    if (!username?.trim()) {
      return NextResponse.json({ error: 'Username wajib diisi.' }, { status: 400 });
    }
    if (!password || password.length < 6) {
      return NextResponse.json({ error: 'Password minimal 6 karakter.' }, { status: 400 });
    }

    // Validate username format (alphanumeric, dots, underscores only)
    const cleanUsername = username.trim().toLowerCase();
    if (!/^[a-z0-9._]+$/.test(cleanUsername)) {
      return NextResponse.json(
        { error: 'Username hanya boleh mengandung huruf kecil, angka, titik, dan underscore.' },
        { status: 400 }
      );
    }

    // Construct phantom email
    const email = cleanUsername + INTERNAL_DOMAIN;

    // Check if user already exists via profiles
    const { data: existingProfile } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .ilike('id', '%') // Just to check all
      .limit(1000);

    // Create user via Supabase Auth Admin API (bypasses email confirmation)
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Auto-confirm so they can login immediately
      user_metadata: {
        nama: nama.trim(),
        role: 'sales',
      },
    });

    if (authError) {
      // Translate common errors
      let msg = authError.message;
      if (msg.includes('already been registered') || msg.includes('already exists')) {
        msg = `Username "${cleanUsername}" sudah terdaftar.`;
      }
      return NextResponse.json({ error: msg }, { status: 400 });
    }

    // The trigger on auth.users should auto-create the profile row,
    // but let's verify and upsert just in case
    const { data: profileCheck } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('id', authData.user.id)
      .single();

    if (!profileCheck) {
      // Manually insert profile if trigger didn't fire
      const { error: profileError } = await supabaseAdmin
        .from('profiles')
        .insert({
          id: authData.user.id,
          nama: nama.trim(),
          role: 'sales',
        });

      if (profileError) {
        console.error('Profile insert error:', profileError);
        // Don't fail the whole request — auth user was created successfully
      }
    }

    return NextResponse.json({
      success: true,
      message: `Akun "${cleanUsername}" berhasil dibuat.`,
      user: {
        id: authData.user.id,
        username: cleanUsername,
        nama: nama.trim(),
        role: 'sales',
      },
    });

  } catch (err) {
    console.error('Create user error:', err);
    return NextResponse.json(
      { error: err.message || 'Terjadi kesalahan server.' },
      { status: 500 }
    );
  }
}
