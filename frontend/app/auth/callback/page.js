'use client';
import { Suspense } from 'react';
import { useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { authAPI } from '@/lib/api';
import Cookies from 'js-cookie';
import toast from 'react-hot-toast';

function CallbackContent() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const { login } = useAuth();

    useEffect(() => {
        const token = searchParams.get('token');
        const error = searchParams.get('error');

        if (error) {
            toast.error('Google login failed. Please try again.');
            router.push('/auth/login');
            return;
        }

        if (token) {
            Cookies.set('stp_token', token, { expires: 7 });
            authAPI.me().then(({ data }) => {
                login(token, data.user);
                toast.success(`Welcome, ${data.user.name.split(' ')[0]}!`);
                router.push('/dashboard');
            }).catch(() => {
                toast.error('Authentication failed');
                router.push('/auth/login');
            });
        }
    }, [searchParams, router, login]);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60vh', gap: '16px' }}>
            <span className="spinner" style={{ width: '40px', height: '40px', borderWidth: '4px' }} />
            <p style={{ color: 'var(--text-secondary)' }}>Completing sign in...</p>
        </div>
    );
}

export default function AuthCallbackPage() {
    return (
        <Suspense fallback={
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
                <span className="spinner" style={{ width: '40px', height: '40px', borderWidth: '4px' }} />
            </div>
        }>
            <CallbackContent />
        </Suspense>
    );
}