'use client';
import { useState } from 'react';
import { ticketsAPI } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import toast from 'react-hot-toast';
import TouristSearch from '@/components/TouristSearch';
import styles from './page.module.css';

export default function TicketsPage() {
    const { user } = useAuth();
    const [destination, setDestination] = useState('');
    const [destCoords, setDestCoords] = useState(null);
    const [places, setPlaces] = useState([]);
    const [loading, setLoading] = useState(false);
    const [searched, setSearched] = useState(false);
    const [booking, setBooking] = useState({ placeId: '', placeName: '', placeAddress: '', visitDate: '', timeSlot: '', numberOfPersons: 1, placeTypes: [] });
    const [bookModal, setBookModal] = useState(null);
    const [bookResult, setBookResult] = useState(null);
    const [bookLoading, setBookLoading] = useState(false);

    const search = async (lat, lng) => {
        setLoading(true); setPlaces([]); setSearched(false);
        try {
            const { data } = await ticketsAPI.getPlaces({ lat, lng, radius: 15000 });
            setPlaces(data.places);
            setSearched(true);
            toast.success(`Found ${data.total} attractions`);
        } catch (e) { toast.error(e.response?.data?.error || 'Failed to fetch attractions'); }
        finally { setLoading(false); }
    };

    const openBookModal = (place) => {
        setBookModal(place);
        setBooking(p => ({ ...p, placeId: place.id, placeName: place.name, placeAddress: place.address, placeTypes: place.types }));
        setBookResult(null);
    };

    const submitBooking = async () => {
        if (!user) { toast.error('Please login to book tickets'); return; }
        if (!booking.visitDate || !booking.timeSlot) { toast.error('Select visit date and time slot'); return; }
        setBookLoading(true);
        try {
            const { data } = await ticketsAPI.book(booking);
            setBookResult(data);
            toast.success(`🎟️ Ticket booked for ${bookModal.name}!`);
        } catch (e) { toast.error(e.response?.data?.error || 'Booking failed'); }
        finally { setBookLoading(false); }
    };

    const today = new Date().toISOString().split('T')[0];

    return (
        <div className={styles.page}>
            <div className="container">
                <div className={styles.pageHeader}>
                    <h1>🎟️ Tourist Tickets</h1>
                    <p className="text-secondary">Pre-book attraction tickets and skip the queue</p>
                </div>

                <div className={`card p-6 ${styles.searchCard}`}>
                    <div className={styles.searchRow}>
                        <TouristSearch
                            value={destination}
                            onChange={setDestination}
                            onSelect={({ lat, lng, name }) => {
                                setDestination(name);
                                setDestCoords({ lat, lng });
                                search(lat, lng);
                            }}
                            placeholder="Search tourist spot or city (e.g. Taj Mahal, Jaipur...)"
                        />
                        <button className="btn btn-primary" onClick={() => { if (destCoords) search(destCoords.lat, destCoords.lng); }} disabled={loading || !destCoords}>
                            {loading ? <span className="spinner" style={{ width: '16px', height: '16px', borderWidth: '2px', borderTopColor: 'white' }} /> : '🔍 Find Attractions'}
                        </button>
                    </div>

                    {/* Quick suggestions strip — shows top 3 as soon as results arrive */}
                    {!loading && places.length > 0 && (
                        <div style={{ marginTop: '14px', borderTop: '1px solid rgba(255,255,255,0.07)', paddingTop: '12px' }}>
                            <p style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                📍 Nearby Attractions — {destination.split(',')[0]}
                            </p>
                            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                {places.slice(0, 5).map((place, i) => (
                                    <button
                                        key={place.id || i}
                                        onClick={() => openBookModal(place)}
                                        style={{
                                            display: 'inline-flex', alignItems: 'center', gap: '6px',
                                            background: 'rgba(108,99,255,0.1)', border: '1px solid rgba(108,99,255,0.25)',
                                            borderRadius: '20px', padding: '5px 12px', fontSize: '12px', fontWeight: 600,
                                            color: 'var(--text-primary)', cursor: 'pointer', transition: 'all 0.15s',
                                        }}
                                        onMouseEnter={e => e.currentTarget.style.background = 'rgba(108,99,255,0.22)'}
                                        onMouseLeave={e => e.currentTarget.style.background = 'rgba(108,99,255,0.1)'}
                                    >
                                        🏛️ {place.name}
                                        {place.rating && <span style={{ color: '#FFD166', fontSize: '11px' }}>★{place.rating}</span>}
                                        {place.isFree && <span style={{ color: '#00D9A5', fontSize: '10px' }}>FREE</span>}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Loading hint */}
                    {loading && (
                        <div style={{ marginTop: '12px', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-muted)', fontSize: '12px' }}>
                            <span className="spinner" style={{ width: '14px', height: '14px', borderWidth: '2px' }} />
                            Fetching nearby attractions...
                        </div>
                    )}
                </div>

                {loading && (
                    <div className={styles.placesGrid}>
                        {[1, 2, 3, 4, 5, 6].map(i => (
                            <div key={i} className="card p-4">
                                <div className="skeleton" style={{ height: '120px', borderRadius: '8px', marginBottom: '12px' }} />
                                <div className="skeleton" style={{ height: '18px', width: '70%', marginBottom: '8px' }} />
                                <div className="skeleton" style={{ height: '14px', width: '50%' }} />
                            </div>
                        ))}
                    </div>
                )}

                {!loading && searched && places.length === 0 && (
                    <div className={styles.emptyState}><span style={{ fontSize: '64px' }}>🗺️</span><h3>No Attractions Found</h3><p>Try a different city.</p></div>
                )}

                {!loading && places.length > 0 && (
                    <div className={styles.placesGrid}>
                        {places.map((place, i) => (
                            <div key={place.id || i} className={`card ${styles.placeCard}`} style={{ animationDelay: `${i * 0.04}s` }}>
                                <div className={styles.placeImage}>
                                    <span style={{ fontSize: '40px' }}>🏛️</span>
                                    {place.isFree && <span className={`badge badge-success ${styles.topBadge}`}>FREE</span>}
                                    {!place.isFree && <span className={`badge badge-primary ${styles.topBadge}`}>₹{place.pricing?.adult}/adult</span>}
                                </div>
                                <div className={styles.placeBody}>
                                    <h3 className={styles.placeName}>{place.name}</h3>
                                    <p className={styles.placeAddress}>📍 {place.address}</p>
                                    {place.rating && (
                                        <div className={styles.placeRating}>
                                            <span style={{ color: '#FFD166' }}>{'★'.repeat(Math.floor(place.rating))}</span>
                                            <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}> {place.rating} ({place.userRatingCount?.toLocaleString()})</span>
                                        </div>
                                    )}
                                    {place.description && <p className={styles.placeDesc}>{place.description.slice(0, 90)}...</p>}
                                    <div className={styles.placeQueue}>
                                        <span>⏳ Queue: ~{place.queueEstimate} min</span>
                                        <span style={{ color: place.isOpen ? '#00D9A5' : '#FF6B6B' }}>{place.isOpen ? '✅ Open' : '🔒 Closed'}</span>
                                    </div>
                                    <button className="btn btn-primary btn-full btn-sm" style={{ marginTop: '12px' }} onClick={() => openBookModal(place)}>
                                        🎟️ Book Ticket
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {!searched && !loading && (
                    <div className={styles.emptyState}>
                        <span style={{ fontSize: '64px' }}>🏛️</span>
                        <h3>Discover Tourist Attractions</h3>
                        <p>Search a destination to find popular attractions and pre-book tickets.</p>
                    </div>
                )}
            </div>

            {/* Booking Modal */}
            {bookModal && (
                <div className={styles.modalOverlay} onClick={() => setBookModal(null)}>
                    <div className={styles.modal} onClick={e => e.stopPropagation()}>
                        <button className={styles.modalClose} onClick={() => setBookModal(null)}>✕</button>
                        {!bookResult ? (
                            <>
                                <h2 className={styles.modalTitle}>🎟️ Book Ticket</h2>
                                <p className={styles.modalPlace}>{bookModal.name}</p>
                                <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '16px' }}>📍 {bookModal.address}</p>
                                <div className={styles.modalGrid}>
                                    <div className="input-group">
                                        <label className="input-label">Visit Date</label>
                                        <input type="date" className="input-field"
                                            value={booking.visitDate} min={today}
                                            onChange={e => setBooking(p => ({ ...p, visitDate: e.target.value }))} />
                                    </div>
                                    <div className="input-group">
                                        <label className="input-label">Time Slot</label>
                                        <select className="input-field" style={{ color: 'var(--text-primary)', background: 'var(--bg-card)' }}
                                            value={booking.timeSlot} onChange={e => setBooking(p => ({ ...p, timeSlot: e.target.value }))}>
                                            <option value="">Select time slot</option>
                                            {bookModal.timeSlots?.map(s => <option key={s} value={s}>{s}</option>)}
                                        </select>
                                    </div>
                                    <div className="input-group">
                                        <label className="input-label">Number of Persons</label>
                                        <input type="number" min="1" max="20" className="input-field"
                                            value={booking.numberOfPersons}
                                            onChange={e => setBooking(p => ({ ...p, numberOfPersons: parseInt(e.target.value) }))} />
                                    </div>
                                </div>
                                <div className={styles.priceSummary}>
                                    <span>Price per person</span>
                                    <strong>{bookModal.isFree ? 'FREE' : `₹${bookModal.pricing?.adult}`}</strong>
                                    <span>Total</span>
                                    <strong style={{ color: 'var(--brand-secondary)' }}>
                                        {bookModal.isFree ? 'FREE' : `₹${(bookModal.pricing?.adult || 0) * booking.numberOfPersons}`}
                                    </strong>
                                </div>
                                <div className={styles.queueInfo}>⏳ Current queue: ~{bookModal.queueEstimate} min</div>
                                <button className="btn btn-primary btn-full" onClick={submitBooking} disabled={bookLoading}>
                                    {bookLoading ? 'Booking...' : '✅ Confirm Booking'}
                                </button>
                            </>
                        ) : (
                            <div className={styles.bookSuccess}>
                                <div style={{ fontSize: '56px' }}>🎉</div>
                                <h2>Ticket Booked!</h2>
                                <p style={{ color: 'var(--text-secondary)', marginTop: '8px', fontSize: '14px' }}>{bookResult.message}</p>
                                <div className={styles.bookSummaryGrid}>
                                    <div><span>Ref</span><strong>{bookResult.booking?.bookingRef}</strong></div>
                                    <div><span>Entry</span><strong>{bookResult.booking?.ticket?.expectedEntryTime}</strong></div>
                                    <div><span>Queue</span><strong>~{bookResult.booking?.ticket?.queueEstimate} min</strong></div>
                                    <div><span>Paid</span><strong style={{ color: 'var(--brand-secondary)' }}>₹{bookResult.booking?.paidAmount || 0}</strong></div>
                                </div>
                                <button className="btn btn-secondary btn-full" style={{ marginTop: '20px' }} onClick={() => setBookModal(null)}>Close</button>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
