import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export async function PATCH(request) {
  try {
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

    if (!serviceRoleKey || !supabaseUrl) {
      return NextResponse.json({ error: 'Server belum dikonfigurasi.' }, { status: 500 });
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const body = await request.json();
    const { userId, nama, password } = body;

    if (!userId) {
      return NextResponse.json({ error: 'userId wajib diisi.' }, { status: 400 });
    }

    // Update profile name if provided
    if (nama?.trim()) {
      const { error: profileError } = await supabaseAdmin
        .from('profiles')
        .update({ nama: nama.trim() })
        .eq('id', userId);

      if (profileError) {
        return NextResponse.json({ error: profileError.message }, { status: 400 });
      }

      // Also update user_metadata in auth
      await supabaseAdmin.auth.admin.updateUserById(userId, {
        user_metadata: { nama: nama.trim() },
      });
    }

    // Update password if provided
    if (password && password.length >= 6) {
      const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
        password,
      });

      if (authError) {
        return NextResponse.json({ error: authError.message }, { status: 400 });
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Akun berhasil diperbarui.',
    });
  } catch (err) {
    console.error('Update user error:', err);
    return NextResponse.json({ error: err.message || 'Terjadi kesalahan server.' }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

    if (!serviceRoleKey || !supabaseUrl) {
      return NextResponse.json({ error: 'Server belum dikonfigurasi.' }, { status: 500 });
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ error: 'userId wajib diisi.' }, { status: 400 });
    }

    // Delete profile first (cascade should handle, but let's be explicit)
    await supabaseAdmin.from('profiles').delete().eq('id', userId);

    // Delete auth user
    const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(userId);

    if (authError) {
      return NextResponse.json({ error: authError.message }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      message: 'Akun berhasil dihapus.',
    });
  } catch (err) {
    console.error('Delete user error:', err);
    return NextResponse.json({ error: err.message || 'Terjadi kesalahan server.' }, { status: 500 });
  }
}
