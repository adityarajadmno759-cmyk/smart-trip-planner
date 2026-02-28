import './globals.css';
import { Inter } from 'next/font/google';
import { AuthProvider } from '@/contexts/AuthContext';
import Navbar from '@/components/Navbar';
import { Toaster } from 'react-hot-toast';

const inter = Inter({ subsets: ['latin'], display: 'swap' });

export const metadata = {
    title: 'Smart Trip Planner',
    description: 'Plan smarter trips with real-time routes, hotels, ride booking, tourist tickets, and live safety tracking.',
    keywords: 'trip planner, route planning, hotel booking, ride booking, tourist tickets, safety tracking',
    openGraph: {
        title: 'Smart Trip Planner',
        description: 'Plan smarter trips with AI-powered route planning and real-time data.',
        type: 'website',
    },
};

export default function RootLayout({ children }) {
    return (
        <html lang="en">
            <body className={inter.className}>
                <AuthProvider>
                    <Navbar />
                    <main className="page-wrapper">
                        {children}
                    </main>
                    <Toaster
                        position="top-right"
                        toastOptions={{
                            style: {
                                background: 'var(--bg-card)',
                                color: 'var(--text-primary)',
                                border: '1px solid var(--border-default)',
                                borderRadius: '12px',
                                fontSize: '14px',
                            },
                            success: { iconTheme: { primary: '#00D9A5', secondary: 'white' } },
                            error: { iconTheme: { primary: '#FF6B6B', secondary: 'white' } },
                        }}
                    />
                </AuthProvider>
            </body>
        </html>
    );
}
