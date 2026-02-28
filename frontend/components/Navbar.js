'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import styles from './Navbar.module.css';

const NAV_LINKS = [
    { href: '/dashboard', label: 'Dashboard', icon: '📊' },
    { href: '/planner', label: 'Planner', icon: '🗺️' },
    { href: '/hotels', label: 'Hotels', icon: '🏨' },
    { href: '/rides', label: 'Rides', icon: '🚗' },
    { href: '/tickets', label: 'Tickets', icon: '🎟️' },
    { href: '/safety', label: 'Safety', icon: '🛡️' },
];

export default function Navbar() {
    const { user, logout } = useAuth();
    const pathname = usePathname();
    const router = useRouter();
    const [scrolled, setScrolled] = useState(false);
    const [menuOpen, setMenuOpen] = useState(false);

    useEffect(() => {
        const onScroll = () => setScrolled(window.scrollY > 20);
        window.addEventListener('scroll', onScroll);
        return () => window.removeEventListener('scroll', onScroll);
    }, []);

    const handleLogout = () => {
        logout();
        router.push('/dashboard');
        setMenuOpen(false);
    };

    return (
        <nav className={`${styles.nav} ${scrolled ? styles.scrolled : ''}`}>
            <div className={styles.inner}>
                {/* Logo */}
                <Link href="/dashboard" className={styles.logo}>
                    <span className={styles.logoIcon}>✈️</span>
                    <span className={styles.logoText}>
                        Smart<span className="text-gradient">Trip</span>
                    </span>
                </Link>

                {/* Desktop Links */}
                <div className={styles.links}>
                    {NAV_LINKS.map((link) => (
                        <Link
                            key={link.href}
                            href={link.href}
                            className={`${styles.link} ${pathname === link.href ? styles.active : ''}`}
                        >
                            <span className={styles.linkIcon}>{link.icon}</span>
                            {link.label}
                        </Link>
                    ))}
                </div>

                {/* Auth Controls */}
                <div className={styles.authArea}>
                    {user ? (
                        <div className={styles.userMenu}>
                            <div className={styles.avatar}>
                                {user.avatar
                                    ? <img src={user.avatar} alt={user.name} />
                                    : <span>{user.name?.[0]?.toUpperCase() || 'U'}</span>}
                            </div>
                            <div className={styles.dropdown}>
                                <p className={styles.dropdownName}>{user.name}</p>
                                <p className={styles.dropdownEmail}>{user.email}</p>
                                <div className={styles.dropdownDivider} />
                                <Link href="/dashboard" className={styles.dropdownItem} onClick={() => setMenuOpen(false)}>📊 Dashboard</Link>
                                <button className={`${styles.dropdownItem} ${styles.logoutBtn}`} onClick={handleLogout}>🚪 Logout</button>
                            </div>
                        </div>
                    ) : (
                        <div className={styles.authButtons}>
                            <Link href="/auth/login" className="btn btn-ghost btn-sm">Login</Link>
                            <Link href="/auth/register" className="btn btn-primary btn-sm">Sign Up</Link>
                        </div>
                    )}

                    {/* Mobile hamburger */}
                    <button className={styles.hamburger} onClick={() => setMenuOpen(!menuOpen)} aria-label="Toggle menu">
                        <span className={menuOpen ? styles.barOpen : ''}></span>
                        <span className={menuOpen ? styles.barOpen : ''}></span>
                        <span className={menuOpen ? styles.barOpen : ''}></span>
                    </button>
                </div>
            </div>

            {/* Mobile Menu */}
            {menuOpen && (
                <div className={styles.mobileMenu}>
                    {NAV_LINKS.map((link) => (
                        <Link key={link.href} href={link.href} className={`${styles.mobileLink} ${pathname === link.href ? styles.active : ''}`} onClick={() => setMenuOpen(false)}>
                            {link.icon} {link.label}
                        </Link>
                    ))}
                    {user
                        ? <button className={styles.mobileLink} onClick={handleLogout}>🚪 Logout</button>
                        : <>
                            <Link href="/auth/login" className={styles.mobileLink} onClick={() => setMenuOpen(false)}>🔑 Login</Link>
                            <Link href="/auth/register" className={styles.mobileLink} onClick={() => setMenuOpen(false)}>✨ Sign Up</Link>
                        </>
                    }
                </div>
            )}
        </nav>
    );
}
