'use client';
import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import Cookies from 'js-cookie';
import { authAPI } from '@/lib/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    const fetchMe = useCallback(async () => {
        const token = Cookies.get('stp_token');
        if (!token) { setLoading(false); return; }
        try {
            const { data } = await authAPI.me();
            setUser(data.user);
        } catch {
            Cookies.remove('stp_token');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchMe();
        // Listen for auth:logout events (from api interceptor)
        const handleLogout = () => { setUser(null); };
        window.addEventListener('auth:logout', handleLogout);
        return () => window.removeEventListener('auth:logout', handleLogout);
    }, [fetchMe]);

    const login = (token, userData) => {
        Cookies.set('stp_token', token, { expires: 7, secure: process.env.NODE_ENV === 'production' });
        setUser(userData);
    };

    const logout = () => {
        Cookies.remove('stp_token');
        setUser(null);
    };

    return (
        <AuthContext.Provider value={{ user, loading, login, logout, fetchMe }}>
            {children}
        </AuthContext.Provider>
    );
}

export const useAuth = () => {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error('useAuth must be used within AuthProvider');
    return ctx;
};
