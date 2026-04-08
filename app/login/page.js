'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Smartphone, AlertTriangle, Lock, Shield } from 'lucide-react';
import './login.css';

const INTERNAL_DOMAIN = '@phonetrack.internal';

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const cleanUsername = username.trim().toLowerCase();
      if (!cleanUsername) throw new Error('Username wajib diisi.');

      // Phantom domain: append internal domain behind the scenes
      const email = cleanUsername + INTERNAL_DOMAIN;

      const { data, error: loginErr } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (loginErr) throw loginErr;

      // Fetch profile to determine role redirect
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', data.user.id)
        .single();

      if (profile?.role === 'admin') {
        router.push('/admin');
      } else {
        router.push('/sales');
      }
    } catch (err) {
      // Translate common Supabase error messages to Indonesian
      let msg = err.message || 'Terjadi kesalahan.';
      if (msg.includes('Invalid login credentials')) {
        msg = 'Username atau password salah.';
      }
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-container">
      {/* Animated Background Orbs */}
      <div className="login-bg-orbs">
        <div className="orb orb-1"></div>
        <div className="orb orb-2"></div>
        <div className="orb orb-3"></div>
      </div>

      <div className="login-card">
        <div className="login-logo">
          <div className="logo-icon"><Smartphone size={32} strokeWidth={1.5} color="var(--accent-blue-bright)" /></div>
          <h1>PhoneTrack ERP</h1>
          <p>Administrasi Konter — Sistem Internal</p>
        </div>

        {/* Invite-only notice */}
        <div className="login-invite-notice">
          <Shield size={14} strokeWidth={1.5} style={{ marginRight: '6px', verticalAlign: 'middle' }} />
          Sistem tertutup — Hubungi Admin untuk mendapatkan akun
        </div>

        {error && <div className="login-error"><AlertTriangle size={14} strokeWidth={1.5} style={{ marginRight: '6px', verticalAlign: 'middle' }} /> {error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="input-group">
            <label htmlFor="username">Username</label>
            <div className="username-input-wrapper">
              <input
                id="username"
                type="text"
                className="input-field"
                placeholder="Masukkan username"
                value={username}
                onChange={e => setUsername(e.target.value)}
                required
                autoComplete="username"
                autoCapitalize="off"
                spellCheck="false"
              />
            </div>
          </div>

          <div className="input-group">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              className="input-field"
              placeholder="Masukkan password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              minLength={6}
              autoComplete="current-password"
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary btn-block btn-lg"
            disabled={loading}
          >
            {loading ? (
              <span className="spinner" style={{ width: 20, height: 20, borderWidth: 2 }}></span>
            ) : (
              <><Lock size={16} strokeWidth={1.5} style={{ marginRight: '8px', verticalAlign: 'middle' }} /> Masuk</>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
