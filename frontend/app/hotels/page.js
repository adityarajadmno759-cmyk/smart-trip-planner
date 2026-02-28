'use client';
import { useState } from 'react';
import { hotelsAPI } from '@/lib/api';
import toast from 'react-hot-toast';
import { useAuth } from '@/contexts/AuthContext';
import NominatimSearch from '@/components/NominatimSearch';
import styles from './page.module.css';

const STARS = (r) => {
    if (!r) return null;
    const full = Math.floor(r);
    return '★'.repeat(full) + '☆'.repeat(5 - full);
};

const SORT_OPTIONS = [
    { value: 'rating', label: '⭐ Best Rating' },
    { value: 'price_asc', label: '💰 Price: Low → High' },
    { value: 'price_desc', label: '💰 Price: High → Low' },
    { value: 'popular', label: '🔥 Most Popular' },
];

export default function HotelsPage() {
    const { user } = useAuth();
    const [destination, setDestination] = useState({ lat: '', lng: '', name: '' });
    const [searchInput, setSearchInput] = useState('');
    const [hotels, setHotels] = useState([]);
    const [loading, setLoading] = useState(false);
    const [searched, setSearched] = useState(false);
    const [sortBy, setSortBy] = useState('rating');
    const [minRating, setMinRating] = useState('');
    const [priceRange, setPriceRange] = useState([500, 20000]);
    const [radius, setRadius] = useState(5000);
    const [bookedHotel, setBookedHotel] = useState(null);

    const searchHotels = async (lat, lng, name = '') => {
        setLoading(true); setSearched(false);
        try {
            const { data } = await hotelsAPI.search({ lat, lng, radius, minRating, sortBy });
            let list = data.hotels || [];

            // Client-side sort & price filter
            list = list.filter(h => {
                const price = h.estimatedPrice || h.pricePerNight || 0;
                return price >= priceRange[0] && price <= priceRange[1];
            });

            if (sortBy === 'price_asc') list.sort((a, b) => (a.estimatedPrice || 0) - (b.estimatedPrice || 0));
            else if (sortBy === 'price_desc') list.sort((a, b) => (b.estimatedPrice || 0) - (a.estimatedPrice || 0));
            else if (sortBy === 'popular') list.sort((a, b) => (b.userRatingCount || 0) - (a.userRatingCount || 0));
            else list.sort((a, b) => (b.rating || 0) - (a.rating || 0));

            setHotels(list);
            setDestination({ lat, lng, name });
            setSearched(true);
            toast.success(`Found ${list.length} hotels near ${name || 'location'}`);
        } catch (err) {
            toast.error(err.response?.data?.error || 'Failed to fetch hotels');
        } finally { setLoading(false); }
    };

    const handleBook = (hotel) => {
        if (!user) { toast.error('Please login to book hotels'); return; }
        setBookedHotel(hotel);
        toast.success(`🏨 ${hotel.name} booked successfully!`);
    };

    return (
        <div className={styles.page}>
            <div className="container">
                <div className={styles.pageHeader}>
                    <h1>🏨 Find Hotels</h1>
                    <p className="text-secondary">Discover and compare hotels near your destination</p>
                </div>

                {/* Search Card */}
                <div className={`card p-6 ${styles.searchCard}`}>
                    <div className={styles.searchRow}>
                        <NominatimSearch
                            value={searchInput}
                            onChange={setSearchInput}
                            onSelect={({ lat, lng, address }) => {
                                setSearchInput(address);
                                searchHotels(lat, lng, address);
                            }}
                            placeholder="Search city or destination (e.g. Agra, Mumbai, Goa...)"
                            style={{ flex: 1 }}
                        />
                        <select
                            className="input-field"
                            style={{ width: 'auto', flexShrink: 0, color: 'var(--text-primary)', background: 'var(--bg-card)' }}
                            value={radius}
                            onChange={e => setRadius(Number(e.target.value))}
                        >
                            <option value={2000}>2 km</option>
                            <option value={5000}>5 km</option>
                            <option value={10000}>10 km</option>
                            <option value={20000}>20 km</option>
                        </select>
                        <button className="btn btn-primary" onClick={() => destination.lat && searchHotels(destination.lat, destination.lng, destination.name)} disabled={loading}>
                            {loading ? <span className="spinner" style={{ width: '18px', height: '18px', borderWidth: '2px', borderTopColor: 'white' }} /> : '🔍 Search'}
                        </button>
                    </div>

                    {/* Filters */}
                    <div className={styles.filterRow} style={{ marginTop: '14px', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
                        <select
                            className="input-field"
                            style={{ width: 'auto', color: 'var(--text-primary)', background: 'var(--bg-card)' }}
                            value={sortBy}
                            onChange={e => setSortBy(e.target.value)}
                        >
                            {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </select>
                        <select
                            className="input-field"
                            style={{ width: 'auto', color: 'var(--text-primary)', background: 'var(--bg-card)' }}
                            value={minRating}
                            onChange={e => setMinRating(e.target.value)}
                        >
                            <option value="">⭐ Any Rating</option>
                            <option value="3">3+ Stars</option>
                            <option value="4">4+ Stars</option>
                            <option value="4.5">4.5+ Stars</option>
                        </select>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--text-secondary)' }}>
                            <span>₹{priceRange[0].toLocaleString()}</span>
                            <input type="range" min={500} max={20000} step={500}
                                value={priceRange[1]}
                                onChange={e => setPriceRange([priceRange[0], Number(e.target.value)])}
                                style={{ width: '120px', accentColor: '#6C63FF' }}
                            />
                            <span>₹{priceRange[1].toLocaleString()}</span>
                        </div>
                        {searched && (
                            <button className="btn btn-secondary btn-sm" onClick={() => searchHotels(destination.lat, destination.lng, destination.name)}>
                                Apply Filters
                            </button>
                        )}
                    </div>
                </div>

                {/* Booked Notification */}
                {bookedHotel && (
                    <div className="card p-5" style={{ background: 'rgba(0,217,165,0.08)', borderColor: 'rgba(0,217,165,0.3)', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '14px' }}>
                        <span style={{ fontSize: '32px' }}>✅</span>
                        <div>
                            <div style={{ fontWeight: 700, color: '#00D9A5' }}>Booking Confirmed!</div>
                            <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{bookedHotel.name} · {bookedHotel.address}</div>
                        </div>
                        <button className="btn btn-ghost btn-sm" style={{ marginLeft: 'auto' }} onClick={() => setBookedHotel(null)}>✕</button>
                    </div>
                )}

                {/* Loading Skeletons */}
                {loading && (
                    <div className={styles.hotelGrid}>
                        {[1, 2, 3, 4, 5, 6].map(i => (
                            <div key={i} className="card p-4">
                                <div className="skeleton" style={{ height: '160px', borderRadius: '8px', marginBottom: '12px' }} />
                                <div className="skeleton" style={{ height: '18px', width: '70%', marginBottom: '8px' }} />
                                <div className="skeleton" style={{ height: '14px', width: '50%', marginBottom: '8px' }} />
                                <div className="skeleton" style={{ height: '14px', width: '40%' }} />
                            </div>
                        ))}
                    </div>
                )}

                {!loading && searched && hotels.length === 0 && (
                    <div className={styles.emptyState}>
                        <span style={{ fontSize: '64px' }}>🏨</span>
                        <h3>No Hotels Found</h3>
                        <p>Try increasing the search radius or adjusting your filters.</p>
                    </div>
                )}

                {!loading && hotels.length > 0 && (
                    <>
                        <p className={styles.resultCount}>{hotels.length} hotels near <strong>{destination.name}</strong></p>
                        <div className={styles.hotelGrid}>
                            {hotels.map((hotel, i) => (
                                <div key={hotel.id || i} className={`card ${styles.hotelCard}`} style={{ animationDelay: `${i * 0.05}s` }}>
                                    <div className={styles.hotelImagePlaceholder}>
                                        <span style={{ fontSize: '40px' }}>🏨</span>
                                        {hotel.isOpen === true && <span className={`badge badge-success ${styles.openBadge}`}>Open</span>}
                                        {hotel.isOpen === false && <span className={`badge badge-danger ${styles.openBadge}`}>Closed</span>}
                                    </div>
                                    <div className={styles.hotelBody}>
                                        <h3 className={styles.hotelName}>{hotel.name}</h3>
                                        <p className={styles.hotelAddress}>📍 {hotel.address}</p>
                                        {hotel.rating && (
                                            <div className={styles.hotelRating}>
                                                <span style={{ color: '#FFD166' }}>{STARS(hotel.rating)}</span>
                                                <span className={styles.ratingText}>{hotel.rating} ({hotel.userRatingCount?.toLocaleString() || '—'} reviews)</span>
                                            </div>
                                        )}
                                        {hotel.description && <p className={styles.hotelDesc}>{hotel.description.slice(0, 100)}...</p>}
                                        <div className={styles.hotelFooter}>
                                            <div className={styles.hotelPrice}>{hotel.priceDisplay || (hotel.estimatedPrice ? `₹${hotel.estimatedPrice?.toLocaleString()}/night` : 'Price on request')}</div>
                                            <div className={styles.hotelActions}>
                                                {hotel.website && <a href={hotel.website} target="_blank" rel="noopener noreferrer" className="btn btn-secondary btn-sm">🌐</a>}
                                                <button className="btn btn-primary btn-sm" onClick={() => handleBook(hotel)}>Book Now</button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </>
                )}

                {!searched && !loading && (
                    <div className={styles.emptyState}>
                        <span style={{ fontSize: '64px' }}>🏨</span>
                        <h3>Search Hotels Near Your Destination</h3>
                        <p>Type a city or destination above to discover nearby hotels.</p>
                    </div>
                )}
            </div>
        </div>
    );
}
