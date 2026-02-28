'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { authAPI } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import toast from 'react-hot-toast';
import styles from '../auth.module.css';

export default function LoginPage() {
    const { login } = useAuth();
    const router = useRouter();
    const [form, setForm] = useState({ email: '', password: '' });
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            const { data } = await authAPI.login(form);
            login(data.token, data.user);
            toast.success(`Welcome back, ${data.user.name.split(' ')[0]}!`);
            router.push('/dashboard');
        } catch (err) {
            toast.error(err.response?.data?.error || 'Login failed');
        } finally { setLoading(false); }
    };

    return (
        <div className={styles.authPage}>
            <div className={styles.authCard}>
                <div className={styles.authHeader}>
                    <Link href="/" className={styles.authLogo}>✈️ SmartTrip</Link>
                    <h1 className={styles.authTitle}>Welcome back</h1>
                    <p className="text-secondary" style={{ fontSize: '14px' }}>Sign in to your account</p>
                </div>

                <button className={`btn btn-secondary btn-full ${styles.googleBtn}`} onClick={authAPI.googleLogin}>
                    <svg width="18" height="18" viewBox="0 0 18 18"><path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 01-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4" /><path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" fill="#34A853" /><path d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05" /><path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335" /></svg>
                    Continue with Google
                </button>

                <div className={styles.divider}><span>or sign in with email</span></div>

                <form onSubmit={handleSubmit} className={styles.authForm}>
                    <div className="input-group">
                        <label className="input-label">Email Address</label>
                        <input className="input-field" type="email" placeholder="john@example.com" value={form.email}
                            onChange={e => setForm(p => ({ ...p, email: e.target.value }))} required />
                    </div>
                    <div className="input-group">
                        <label className="input-label">Password</label>
                        <input className="input-field" type="password" placeholder="••••••••" value={form.password}
                            onChange={e => setForm(p => ({ ...p, password: e.target.value }))} required />
                    </div>
                    <button className="btn btn-primary btn-full" type="submit" disabled={loading} style={{ marginTop: '8px' }}>
                        {loading ? 'Signing in...' : '🔑 Sign In'}
                    </button>
                </form>

                <p className={styles.authFooter}>
                    Don&apos;t have an account? <Link href="/auth/register" style={{ color: 'var(--brand-primary)' }}>Create one →</Link>
                </p>
            </div>
        </div>
    );
}
