'use client';
import { useState, useEffect, useRef } from 'react';
import { userAPI } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import toast from 'react-hot-toast';
import styles from './page.module.css';

const TYPE_INFO = {
    hotel: { icon: '🏨', label: 'Hotel', color: '#6C63FF' },
    ride: { icon: '🚗', label: 'Ride', color: '#00D9A5' },
    rental: { icon: '🔑', label: 'Vehicle Rental', color: '#FFD166' },
    ticket: { icon: '🎟️', label: 'Ticket', color: '#FF6B6B' },
};

const PAYMENT_METHODS = [
    { id: 'upi', icon: '📲', label: 'UPI' },
    { id: 'card', icon: '💳', label: 'Card' },
    { id: 'cash', icon: '💵', label: 'Cash' },
];

const NAV_LINKS = [
    { href: '/dashboard', icon: '🏠', label: 'Dashboard' },
    { href: '/planner', icon: '🗺️', label: 'Route Planner' },
    { href: '/hotels', icon: '🏨', label: 'Hotels' },
    { href: '/rides', icon: '🚗', label: 'Rides & Rentals' },
    { href: '/tickets', icon: '🎟️', label: 'Tourist Spots' },
    { href: '/safety', icon: '🛡️', label: 'Live Safety' },
];

const QUICK_ACTIONS = [
    { href: '/planner', icon: '🗺️', label: 'Plan a Route', sub: 'Get directions & cost estimates', color: '#6C63FF' },
    { href: '/hotels', icon: '🏨', label: 'Find Hotels', sub: 'Compare prices & ratings', color: '#00D9A5' },
    { href: '/rides', icon: '🚗', label: 'Book a Ride', sub: 'Cab or self-drive rental', color: '#FFD166' },
    { href: '/tickets', icon: '🎟️', label: 'Tourist Spots', sub: 'Pre-book popular places', color: '#FF6B6B' },
    { href: '/safety', icon: '🛡️', label: 'Safety Tracking', sub: 'Live GPS & SOS alerts', color: '#FF6B6B' },
    { href: '/dashboard', icon: '📋', label: 'Trip History', sub: 'View past trips & bookings', color: '#FFD166' },
];

function getGreeting() {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
}

export default function DashboardPage() {
    const { user, loading: authLoading, logout } = useAuth();
    const router = useRouter();
    const [trips, setTrips] = useState([]);
    const [bookings, setBookings] = useState([]);
    const [activeSection, setActiveSection] = useState('overview');
    const [dataLoading, setDataLoading] = useState(false);
    const [payModal, setPayModal] = useState(null);
    const [payMethod, setPayMethod] = useState('upi');
    const [paying, setPaying] = useState(false);
    const [paidIds, setPaidIds] = useState(new Set());
    const [cancelledIds, setCancelledIds] = useState(new Set());
    const statsRef = useRef(null);

    useEffect(() => {
        if (!authLoading && !user) router.push('/auth/login');
        if (user) loadData();
    }, [user, authLoading]);

    const loadData = async () => {
        setDataLoading(true);
        try {
            const [tRes, bRes] = await Promise.all([userAPI.getTrips(), userAPI.getBookings()]);
            setTrips(tRes.data.trips);
            setBookings(bRes.data.bookings);
        } catch { toast.error('Failed to load dashboard data'); }
        finally { setDataLoading(false); }
    };

    const cancelBooking = (booking) => {
        const id = booking._id || booking.bookingRef;
        setCancelledIds(prev => new Set([...prev, id]));
        toast.success(`🚫 Booking ${booking.bookingRef} cancelled.`);
    };

    const handlePay = async () => {
        setPaying(true);
        await new Promise(r => setTimeout(r, 1500));
        if (payModal === 'all') {
            const ids = unpaidBookings.map(b => b._id || b.bookingRef).filter(Boolean);
            setPaidIds(new Set(ids));
            toast.success(`✅ Payment of ₹${totalUnpaid.toLocaleString('en-IN')} via ${payMethod.toUpperCase()} successful!`);
        } else if (payModal) {
            setPaidIds(prev => new Set([...prev, payModal._id || payModal.bookingRef]));
            toast.success(`✅ ₹${payModal.paidAmount} paid via ${payMethod.toUpperCase()}!`);
        }
        setPaying(false);
        setPayModal(null);
    };

    if (authLoading || !user) return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
            <span className="spinner" style={{ width: '40px', height: '40px', borderWidth: '4px' }} />
        </div>
    );

    const totalSpent = bookings.reduce((s, b) => s + (b.paidAmount || 0), 0);
    const activeBookings = bookings.filter(b => !cancelledIds.has(b._id) && !cancelledIds.has(b.bookingRef));
    const unpaidBookings = activeBookings.filter(b => !(paidIds.has(b._id) || paidIds.has(b.bookingRef)) && b.paidAmount > 0);
    const totalUnpaid = unpaidBookings.reduce((s, b) => s + (b.paidAmount || 0), 0);

    return (
        <div className={styles.layout}>
            {/* ── Sidebar ── */}
            <aside className={styles.sidebar}>
                <div className={styles.sidebarBrand}>
                    <span style={{ fontSize: '22px' }}>✈️</span>
                    <div>
                        <div className={styles.brandName}>Smart Trip</div>
                        <div className={styles.brandSub}>Planner</div>
                    </div>
                </div>

                <div className={styles.sidebarUser}>
                    <div className={styles.sidebarAvatar}>
                        {user.avatar ? <img src={user.avatar} alt={user.name} /> : user.name?.[0]?.toUpperCase()}
                    </div>
                    <div>
                        <div className={styles.sidebarUserName}>{user.name}</div>
                        <div className={styles.sidebarUserEmail}>{user.email}</div>
                    </div>
                </div>

                <nav className={styles.sidebarNav}>
                    {NAV_LINKS.map(link => (
                        <Link key={link.href + link.label}
                            href={link.href}
                            className={`${styles.navLink} ${link.href === '/dashboard' && activeSection !== 'trips' && activeSection !== 'bookings' ? styles.navLinkActive : ''}`}
                            onClick={() => link.href === '/dashboard' && setActiveSection('overview')}
                        >
                            <span className={styles.navIcon}>{link.icon}</span>
                            {link.label}
                        </Link>
                    ))}
                </nav>

                <button className={styles.signOutBtn} onClick={() => { logout?.(); router.push('/auth/login'); }}>
                    <span>→</span> Sign Out
                </button>
            </aside>

            {/* ── Main ── */}
            <main className={styles.main}>
                {/* Greeting Header */}
                <div className={styles.greetCard}>
                    <div style={{ flex: 1 }}>
                        <div className={styles.greetTime}>{getGreeting()},</div>
                        <div className={styles.greetName}>{user.name?.split(' ')[0]} 👋</div>
                        <div className={styles.greetSub}>Where are you headed today?</div>
                        <Link href="/planner" className={styles.planBtn}>🗺️ Plan a Trip →</Link>
                    </div>
                    <div className={styles.greetIcon}>📍</div>
                </div>

                {/* Inner Tabs */}
                <div className={styles.innerTabs}>
                    {[['overview', '🏠 Overview'], ['trips', '🗺️ Trips'], ['history', '📜 Booking History']].map(([id, label]) => (
                        <button key={id} className={`${styles.innerTab} ${activeSection === id ? styles.innerTabActive : ''}`} onClick={() => setActiveSection(id)}>{label}</button>
                    ))}
                </div>

                {dataLoading && (
                    <div style={{ display: 'flex', justifyContent: 'center', padding: '60px' }}>
                        <span className="spinner" style={{ width: '36px', height: '36px', borderWidth: '3px' }} />
                    </div>
                )}

                {/* ── Overview ── */}
                {!dataLoading && activeSection === 'overview' && (
                    <>
                        {/* Quick Stats Row */}
                        <div className={styles.statsRow}>
                            {[
                                { icon: '🗺️', label: 'Trips', value: trips.length },
                                { icon: '📋', label: 'Bookings', value: bookings.length },
                                { icon: '💸', label: 'Saved Routes', value: 0 },
                            ].map((s, i) => (
                                <div key={i} className={styles.statPill}>
                                    <span style={{ fontSize: '22px' }}>{s.icon}</span>
                                    <div>
                                        <div className={styles.statPillValue}>{s.value}</div>
                                        <div className={styles.statPillLabel}>{s.label}</div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Quick Actions */}
                        <h3 className={styles.sectionHeading}>⚡ Quick Actions</h3>
                        <p className={styles.sectionSub}>Jump right into what you need</p>
                        <div className={styles.actionsGrid}>
                            {QUICK_ACTIONS.map((a, i) => (
                                <Link key={i} href={a.href} className={styles.actionCard}>
                                    <div className={styles.actionIconWrap} style={{ background: `${a.color}22` }}>
                                        <span style={{ fontSize: '22px' }}>{a.icon}</span>
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <div className={styles.actionLabel}>{a.label}</div>
                                        <div className={styles.actionSub}>{a.sub}</div>
                                    </div>
                                    <span className={styles.actionArrow}>→</span>
                                </Link>
                            ))}
                        </div>
                    </>
                )}

                {/* ── Trips ── */}
                {!dataLoading && activeSection === 'trips' && (
                    <div className={styles.list}>
                        {trips.length === 0
                            ? <div className={styles.empty}><span style={{ fontSize: '48px' }}>🗺️</span><h3>No trips yet</h3><Link href="/planner" style={{ color: 'var(--brand-primary)' }}>Plan your first trip →</Link></div>
                            : trips.map((t, i) => (
                                <div key={i} className={styles.listCard}>
                                    <div className={styles.tripRoute}>
                                        <span className={styles.tripDot} style={{ background: '#6C63FF' }} />{t.origin?.name || 'Origin'}
                                        <span className={styles.tripArrow}>→</span>
                                        <span className={styles.tripDot} style={{ background: '#00D9A5' }} />{t.destination?.name || 'Destination'}
                                    </div>
                                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '8px' }}>
                                        <span className={`badge ${t.status === 'completed' ? 'badge-success' : 'badge-primary'}`}>{t.status}</span>
                                        <span className="text-muted" style={{ fontSize: '12px' }}>{new Date(t.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                                    </div>
                                </div>
                            ))
                        }
                    </div>
                )}

                {/* ── Booking History (new section) ── */}
                {!dataLoading && activeSection === 'history' && (
                    <div className={styles.list}>
                        {/* Stats Slide at top */}
                        <div className={styles.statsSlide} style={{ marginBottom: '20px' }}>
                            {[
                                { icon: '📋', label: 'Total Bookings', value: bookings.length, color: '#6C63FF' },
                                { icon: '💸', label: 'Total Cost', value: `₹${totalSpent.toLocaleString('en-IN')}`, color: '#FFD166' },
                                { icon: '🚫', label: 'Cancelled', value: cancelledIds.size, color: '#FF6B6B' },
                                { icon: '✅', label: 'Paid', value: paidIds.size, color: '#00D9A5' },
                                { icon: '⏳', label: 'Outstanding', value: totalUnpaid > 0 ? `₹${totalUnpaid.toLocaleString('en-IN')}` : '₹0', color: totalUnpaid > 0 ? '#FF6B6B' : '#00D9A5' },
                                { icon: '🏨', label: 'Hotels', value: bookings.filter(b => b.type === 'hotel').length, color: '#6C63FF' },
                                { icon: '🎟️', label: 'Tickets', value: bookings.filter(b => b.type === 'ticket').length, color: '#00D9A5' },
                                { icon: '🚗', label: 'Rides', value: bookings.filter(b => b.type === 'ride' || b.type === 'rental').length, color: '#FFD166' },
                            ].map((s, i) => (
                                <div key={i} className={styles.statCard}>
                                    <div className={styles.statCardIcon} style={{ color: s.color }}>{s.icon}</div>
                                    <div className={styles.statCardValue}>{s.value}</div>
                                    <div className={styles.statCardLabel}>{s.label}</div>
                                </div>
                            ))}
                        </div>

                        {/* Pay All button */}
                        {totalUnpaid > 0 && (
                            <button className="btn btn-primary btn-full" style={{ fontSize: '15px', fontWeight: 700, marginBottom: '16px' }} onClick={() => setPayModal('all')}>
                                💳 Pay All Outstanding — ₹{totalUnpaid.toLocaleString('en-IN')}
                            </button>
                        )}

                        {bookings.length === 0
                            ? <div className={styles.empty}><span style={{ fontSize: '48px' }}>📜</span><h3>No booking history yet</h3></div>
                            : bookings.map((b, i) => {
                                const info = TYPE_INFO[b.type] || TYPE_INFO.hotel;
                                const id = b._id || b.bookingRef;
                                const isCancelled = cancelledIds.has(id);
                                const isPaid = paidIds.has(id);
                                const detail = b.hotel || b.ride || b.ticket || {};
                                return (
                                    <div key={i} className={`${styles.listCard} ${isCancelled ? styles.cancelledCard : ''}`}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                            <div style={{ width: 44, height: 44, borderRadius: 10, background: `${info.color}22`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                                <span style={{ fontSize: '22px' }}>{info.icon}</span>
                                            </div>
                                            <div style={{ flex: 1 }}>
                                                <div style={{ fontWeight: 700, fontSize: '15px' }}>
                                                    {detail.hotelName || detail.placeName || detail.vehicleType || info.label}
                                                </div>
                                                <div style={{ fontFamily: 'monospace', fontSize: '11px', color: 'var(--text-muted)' }}>{b.bookingRef}</div>
                                                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                                                    {new Date(b.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                                                    {detail.visitDate && ` · Visit: ${new Date(detail.visitDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`}
                                                    {detail.checkIn && ` · Check-in: ${new Date(detail.checkIn).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`}
                                                </div>
                                            </div>
                                            <div style={{ textAlign: 'right', flexShrink: 0 }}>
                                                <div style={{ fontWeight: 800, fontSize: '16px', color: 'var(--brand-secondary)' }}>
                                                    {b.paidAmount > 0 ? `₹${b.paidAmount.toLocaleString('en-IN')}` : 'FREE'}
                                                </div>
                                                <span className={`badge ${isCancelled ? 'badge-danger' : isPaid ? 'badge-success' : 'badge-warning'}`}>
                                                    {isCancelled ? 'Cancelled' : isPaid ? 'Paid' : b.status || 'Pending'}
                                                </span>
                                            </div>
                                        </div>
                                        {!isCancelled && (
                                            <div style={{ display: 'flex', gap: '8px', marginTop: '12px', paddingTop: '10px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                                                {b.paidAmount > 0 && !isPaid && (
                                                    <button className="btn btn-primary btn-sm" style={{ flex: 1 }} onClick={() => setPayModal(b)}>
                                                        💳 Pay ₹{b.paidAmount.toLocaleString('en-IN')}
                                                    </button>
                                                )}
                                                {isPaid && (
                                                    <div style={{ flex: 1, padding: '6px 12px', background: 'rgba(0,217,165,0.08)', border: '1px solid rgba(0,217,165,0.2)', borderRadius: '8px', color: '#00D9A5', fontSize: '13px', fontWeight: 600, textAlign: 'center' }}>
                                                        ✅ Payment Done
                                                    </div>
                                                )}
                                                <button className="btn btn-ghost btn-sm" style={{ color: '#FF6B6B', border: '1px solid rgba(255,107,107,0.2)', flex: isPaid ? 1 : 'none' }} onClick={() => cancelBooking(b)}>
                                                    🚫 Cancel
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                );
                            })
                        }
                    </div>
                )}

            </main>

            {/* Payment Modal */}
            {payModal && (
                <div className={styles.modalOverlay} onClick={() => !paying && setPayModal(null)}>
                    <div className={styles.modal} onClick={e => e.stopPropagation()}>
                        <button className={styles.modalClose} onClick={() => !paying && setPayModal(null)}>✕</button>
                        <div style={{ textAlign: 'center', marginBottom: '20px' }}>
                            <div style={{ fontSize: '40px', marginBottom: '8px' }}>💳</div>
                            <h2 style={{ fontSize: '20px', fontWeight: 700 }}>Complete Payment</h2>
                            <p className="text-secondary" style={{ fontSize: '14px', marginTop: '6px' }}>
                                {payModal === 'all' ? `Pay all ${unpaidBookings.length} bookings` : `${TYPE_INFO[payModal.type]?.label} · ${payModal.bookingRef}`}
                            </p>
                            <div style={{ fontSize: '28px', fontWeight: 800, color: 'var(--brand-secondary)', margin: '16px 0 8px' }}>
                                ₹{(payModal === 'all' ? totalUnpaid : payModal.paidAmount).toLocaleString('en-IN')}
                            </div>
                        </div>
                        <p style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '10px' }}>Select Payment Method</p>
                        <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
                            {PAYMENT_METHODS.map(pm => (
                                <button key={pm.id} onClick={() => setPayMethod(pm.id)} style={{
                                    flex: 1, padding: '12px 8px', borderRadius: '12px', cursor: 'pointer', fontSize: '13px', fontWeight: 700,
                                    border: `2px solid ${payMethod === pm.id ? '#6C63FF' : 'rgba(255,255,255,0.1)'}`,
                                    background: payMethod === pm.id ? 'rgba(108,99,255,0.15)' : 'transparent',
                                    color: 'var(--text-primary)', textAlign: 'center',
                                }}>
                                    <div style={{ fontSize: '22px', marginBottom: '4px' }}>{pm.icon}</div>{pm.label}
                                </button>
                            ))}
                        </div>
                        <button className="btn btn-primary btn-full" onClick={handlePay} disabled={paying} style={{ fontSize: '15px' }}>
                            {paying ? <><span className="spinner" style={{ width: '16px', height: '16px', borderWidth: '2px', borderTopColor: 'white' }} /> Processing...</> : `✅ Pay via ${PAYMENT_METHODS.find(p => p.id === payMethod)?.label}`}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
