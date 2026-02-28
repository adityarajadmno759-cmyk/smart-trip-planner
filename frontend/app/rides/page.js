'use client';
import { useState, useEffect } from 'react';
import { ridesAPI, rentalsAPI } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import toast from 'react-hot-toast';
import NominatimSearch from '@/components/NominatimSearch';
import styles from './page.module.css';

const RENTAL_CATEGORIES = [
    { id: 'all', label: 'All Vehicles', icon: '🚘' },
    { id: 'two-wheeler', label: 'Two-Wheelers', icon: '🏍️' },
    { id: 'four-wheeler', label: 'Four-Wheelers', icon: '🚗' },
];

function calcRentalPrice(vehicle, startDate, startTime, endDate, endTime) {
    if (!startDate || !startTime || !endDate || !endTime) return null;
    const start = new Date(`${startDate}T${startTime}`);
    const end = new Date(`${endDate}T${endTime}`);
    if (isNaN(start) || isNaN(end) || end <= start) return null;
    const hours = Math.max(1, Math.round((end - start) / 3600000));
    const days = Math.floor(hours / 24);
    const remHours = hours % 24;
    if (days >= 1 && vehicle.pricePerDay) {
        return { total: days * vehicle.pricePerDay + remHours * vehicle.pricePerHour, hours, days, remHours };
    }
    return { total: hours * vehicle.pricePerHour, hours, days: 0, remHours: hours };
}

export default function RidesPage() {
    const { user } = useAuth();
    const [activeTab, setActiveTab] = useState('driver');

    // Driver ride state
    const [rideOrigin, setRideOrigin] = useState('');
    const [rideDest, setRideDest] = useState('');
    const [rideLoading, setRideLoading] = useState(false);
    const [vehicles, setVehicles] = useState([]);
    const [selectedVehicle, setSelectedVehicle] = useState(null);
    const [booking, setBooking] = useState(null);
    const [bookingLoading, setBookingLoading] = useState(false);

    // Rental state
    const [rentalCat, setRentalCat] = useState('all');
    const [rentalVehicles, setRentalVehicles] = useState([]);
    const [rentalLoaded, setRentalLoaded] = useState(false);
    const [rentalLoading, setRentalLoading] = useState(false);
    const [rentalPickup, setRentalPickup] = useState('');
    const [startDate, setStartDate] = useState('');
    const [startTime, setStartTime] = useState('');
    const [endDate, setEndDate] = useState('');
    const [endTime, setEndTime] = useState('');
    const [rentalResult, setRentalResult] = useState(null);
    const [selectedRentalVehicle, setSelectedRentalVehicle] = useState(null);

    const priceCalc = selectedRentalVehicle ? calcRentalPrice(selectedRentalVehicle, startDate, startTime, endDate, endTime) : null;

    const estimateRide = async () => {
        if (!rideOrigin || !rideDest) { toast.error('Enter both pickup and destination'); return; }
        setRideLoading(true); setVehicles([]); setSelectedVehicle(null); setBooking(null);
        try {
            const { data } = await ridesAPI.estimate({ origin: rideOrigin, destination: rideDest });
            setVehicles(data.vehicles);
            toast.success(`${data.vehicles.length} vehicle types available`);
        } catch (e) { toast.error(e.response?.data?.error || 'Failed to estimate ride'); }
        finally { setRideLoading(false); }
    };

    const bookRide = async () => {
        if (!selectedVehicle) { toast.error('Select a vehicle first'); return; }
        if (!user) { toast.error('Please login to book a ride'); return; }
        setBookingLoading(true);
        try {
            const { data } = await ridesAPI.book({
                origin: rideOrigin, destination: rideDest,
                vehicleType: selectedVehicle.type,
                estimatedFare: selectedVehicle.fare,
                distanceKm: selectedVehicle.distanceKm,
            });
            setBooking(data);
            toast.success('🚗 Ride booked successfully!');
        } catch (e) { toast.error(e.response?.data?.error || 'Booking failed'); }
        finally { setBookingLoading(false); }
    };

    const loadRentals = async (cat) => {
        setRentalCat(cat); setRentalLoading(true);
        try {
            const { data } = await rentalsAPI.getVehicles(cat !== 'all' ? { category: cat } : {});
            setRentalVehicles(data.vehicles);
            setRentalLoaded(true);
        } catch { toast.error('Failed to load vehicles'); }
        finally { setRentalLoading(false); }
    };

    const bookRental = async () => {
        if (!user) { toast.error('Please login to rent a vehicle'); return; }
        if (!selectedRentalVehicle) { toast.error('Select a vehicle first'); return; }
        if (!rentalPickup || !startDate || !startTime || !endDate || !endTime) {
            toast.error('Fill in pickup location, start and end date/time'); return;
        }
        if (!priceCalc) { toast.error('Invalid date/time range'); return; }
        setRentalLoading(true);
        try {
            const { data } = await rentalsAPI.book({
                vehicleId: selectedRentalVehicle.id,
                startTime: `${startDate}T${startTime}`,
                endTime: `${endDate}T${endTime}`,
                location: rentalPickup,
            });
            setRentalResult(data);
            toast.success('🔑 Vehicle booked successfully!');
        } catch (e) { toast.error(e.response?.data?.error || 'Rental booking failed'); }
        finally { setRentalLoading(false); }
    };

    return (
        <div className={styles.page}>
            <div className="container">
                <div className={styles.pageHeader}>
                    <h1>🚗 Ride Booking</h1>
                    <p className="text-secondary">Book a driver or rent a vehicle for your journey</p>
                </div>

                <div className="tabs mb-4" style={{ maxWidth: '400px' }}>
                    <button className={`tab-btn ${activeTab === 'driver' ? 'active' : ''}`} onClick={() => setActiveTab('driver')}>🚕 Driver Ride</button>
                    <button className={`tab-btn ${activeTab === 'rental' ? 'active' : ''}`} onClick={() => { setActiveTab('rental'); if (!rentalLoaded) loadRentals('all'); }}>🔑 Self Drive</button>
                </div>

                {/* ── Driver Ride ── */}
                {activeTab === 'driver' && (
                    <div className={styles.tabContent}>
                        <div className={`card p-6 ${styles.searchCard}`}>
                            <h2 className={styles.sectionTitle}>📍 Enter Ride Details</h2>
                            <div className={styles.inputPair}>
                                <div className="input-group">
                                    <label className="input-label">Pickup Location</label>
                                    <NominatimSearch
                                        value={rideOrigin}
                                        onChange={setRideOrigin}
                                        onSelect={({ address }) => setRideOrigin(address)}
                                        placeholder="Enter pickup address or city"
                                    />
                                </div>
                                <div className="input-group">
                                    <label className="input-label">Drop-off Location</label>
                                    <NominatimSearch
                                        value={rideDest}
                                        onChange={setRideDest}
                                        onSelect={({ address }) => setRideDest(address)}
                                        placeholder="Enter destination"
                                    />
                                </div>
                            </div>
                            <button className="btn btn-primary mt-4" onClick={estimateRide} disabled={rideLoading}>
                                {rideLoading ? <><span className="spinner" style={{ width: '16px', height: '16px', borderWidth: '2px', borderTopColor: 'white' }} /> Calculating...</> : '💰 Get Fare Estimate'}
                            </button>
                        </div>

                        {vehicles.length > 0 && (
                            <div className={styles.vehicleGrid}>
                                {vehicles.map(v => (
                                    <div key={v.type}
                                        className={`card ${styles.vehicleCard} ${selectedVehicle?.type === v.type ? styles.vehicleCardSelected : ''}`}
                                        onClick={() => setSelectedVehicle(v)}
                                    >
                                        <div className={styles.vehicleEmoji}>{v.emoji}</div>
                                        <h3 className={styles.vehicleLabel}>{v.label}</h3>
                                        <p className={styles.vehicleSeats}>{v.seats} seats</p>
                                        <div className={styles.vehicleFare}>₹{v.fare}</div>
                                        <p className={styles.vehicleEta}>ETA {v.eta} min</p>
                                        <p className={styles.vehicleDist}>{v.distanceKm} km · {v.duration}</p>
                                    </div>
                                ))}
                            </div>
                        )}

                        {selectedVehicle && !booking && (
                            <div className={`card p-6 ${styles.bookingPanel}`}>
                                <h3>Confirm: {selectedVehicle.emoji} {selectedVehicle.label}</h3>
                                <div className={styles.bookingSummary}>
                                    <div><span>From</span><strong>{rideOrigin}</strong></div>
                                    <div><span>To</span><strong>{rideDest}</strong></div>
                                    <div><span>Distance</span><strong>{selectedVehicle.distanceKm} km</strong></div>
                                    <div><span>ETA</span><strong>{selectedVehicle.eta} min</strong></div>
                                    <div><span>Fare</span><strong style={{ color: 'var(--brand-secondary)' }}>₹{selectedVehicle.fare}</strong></div>
                                </div>
                                <button className="btn btn-primary btn-full mt-4" onClick={bookRide} disabled={bookingLoading}>
                                    {bookingLoading ? 'Booking...' : '✅ Confirm Booking'}
                                </button>
                            </div>
                        )}

                        {booking && (
                            <div className={`card p-6 ${styles.confirmCard}`}>
                                <div className={styles.confirmIcon}>✅</div>
                                <h3>Ride Booked!</h3>
                                <p className="text-secondary" style={{ fontSize: '14px', margin: '8px 0 16px' }}>{booking.message}</p>
                                <div className={styles.bookingSummary}>
                                    <div><span>Driver</span><strong>{booking.booking?.ride?.driverName}</strong></div>
                                    <div><span>Phone</span><strong>{booking.booking?.ride?.driverPhone}</strong></div>
                                    <div><span>Plate</span><strong>{booking.booking?.ride?.plateNumber}</strong></div>
                                    <div><span>Ref</span><strong>{booking.booking?.bookingRef}</strong></div>
                                </div>
                                <button className="btn btn-ghost btn-sm mt-4" onClick={() => { setBooking(null); setSelectedVehicle(null); setVehicles([]); }}>Book Another</button>
                            </div>
                        )}
                    </div>
                )}

                {/* ── Self Drive ── */}
                {activeTab === 'rental' && (
                    <div className={styles.tabContent}>
                        <div className={styles.rentalCats}>
                            {RENTAL_CATEGORIES.map(c => (
                                <button key={c.id} className={`btn ${rentalCat === c.id ? 'btn-primary' : 'btn-secondary'}`} onClick={() => loadRentals(c.id)}>
                                    {c.icon} {c.label}
                                </button>
                            ))}
                        </div>

                        {/* Rental Details */}
                        <div className={`card p-6 ${styles.rentalForm}`}>
                            <h3 style={{ marginBottom: '16px', fontSize: '15px', fontWeight: '700' }}>📅 Rental Details</h3>
                            <div className={styles.rentalFormGrid}>
                                <div className="input-group">
                                    <label className="input-label">Start Date</label>
                                    <input type="date" className="input-field"
                                        min={new Date().toISOString().split('T')[0]}
                                        value={startDate} onChange={e => setStartDate(e.target.value)} />
                                </div>
                                <div className="input-group">
                                    <label className="input-label">Start Time</label>
                                    <input type="time" className="input-field"
                                        value={startTime} onChange={e => setStartTime(e.target.value)} />
                                </div>
                                <div className="input-group">
                                    <label className="input-label">End Date</label>
                                    <input type="date" className="input-field"
                                        min={startDate || new Date().toISOString().split('T')[0]}
                                        value={endDate} onChange={e => setEndDate(e.target.value)} />
                                </div>
                                <div className="input-group">
                                    <label className="input-label">End Time</label>
                                    <input type="time" className="input-field"
                                        value={endTime} onChange={e => setEndTime(e.target.value)} />
                                </div>
                                <div className="input-group" style={{ gridColumn: '1 / -1' }}>
                                    <label className="input-label">Pickup Location</label>
                                    <NominatimSearch
                                        value={rentalPickup}
                                        onChange={setRentalPickup}
                                        onSelect={({ address }) => setRentalPickup(address)}
                                        placeholder="Search pickup location..."
                                    />
                                </div>
                            </div>
                        </div>

                        {rentalLoading && (
                            <div className={styles.vehicleGrid}>
                                {[1, 2, 3, 4].map(i => <div key={i} className="card" style={{ height: '200px' }}><div className="skeleton" style={{ height: '100%', borderRadius: '12px' }} /></div>)}
                            </div>
                        )}

                        {!rentalLoading && rentalVehicles.length > 0 && (
                            <>
                                <div className={styles.vehicleGrid}>
                                    {rentalVehicles.map(v => {
                                        const calc = calcRentalPrice(v, startDate, startTime, endDate, endTime);
                                        const isSelected = selectedRentalVehicle?.id === v.id;
                                        return (
                                            <div key={v.id}
                                                className={`card ${styles.rentalCard} ${!v.available ? styles.unavailable : ''} ${isSelected ? styles.vehicleCardSelected : ''}`}
                                                onClick={() => v.available && setSelectedRentalVehicle(v)}
                                                style={{ cursor: v.available ? 'pointer' : 'default' }}
                                            >
                                                <div className={styles.vehicleEmoji}>{v.emoji}</div>
                                                <div className={`badge ${v.category === 'two-wheeler' ? 'badge-primary' : 'badge-success'}`} style={{ marginBottom: '8px' }}>{v.type}</div>
                                                <h3 className={styles.vehicleLabel}>{v.name}</h3>
                                                <p className={styles.vehicleSeats}>{v.seats} seats · {v.fuelType}</p>
                                                <div className={styles.rentalPricing}>
                                                    <div><span className={styles.rentalPrice}>₹{v.pricePerHour}</span><span className={styles.rentalPriceLabel}>/hr</span></div>
                                                    <div><span className={styles.rentalPrice}>₹{v.pricePerDay}</span><span className={styles.rentalPriceLabel}>/day</span></div>
                                                </div>
                                                {calc && v.available && (
                                                    <div style={{ marginTop: '8px', padding: '6px 10px', background: 'rgba(108,99,255,0.15)', borderRadius: '8px', fontSize: '12px', textAlign: 'center' }}>
                                                        <strong style={{ color: '#6C63FF' }}>Total: ₹{calc.total}</strong>
                                                        <div style={{ color: '#888', fontSize: '11px' }}>{calc.hours}h duration</div>
                                                    </div>
                                                )}
                                                {!v.available
                                                    ? <span className="badge badge-danger" style={{ marginTop: '12px' }}>Not Available</span>
                                                    : <div style={{ fontSize: '11px', marginTop: '8px', color: '#00D9A5' }}>{isSelected ? '✅ Selected' : 'Click to select'}</div>
                                                }
                                            </div>
                                        );
                                    })}
                                </div>

                                {selectedRentalVehicle && priceCalc && (
                                    <div className={`card p-6 ${styles.bookingPanel}`} style={{ maxWidth: '480px', margin: '20px auto 0' }}>
                                        <h3>Confirm Rental: {selectedRentalVehicle.emoji} {selectedRentalVehicle.name}</h3>
                                        <div className={styles.bookingSummary}>
                                            <div><span>Pickup</span><strong>{rentalPickup}</strong></div>
                                            <div><span>Duration</span><strong>{priceCalc.hours} hour{priceCalc.hours > 1 ? 's' : ''}</strong></div>
                                            <div><span>Total Cost</span><strong style={{ color: 'var(--brand-secondary)' }}>₹{priceCalc.total}</strong></div>
                                        </div>
                                        <button className="btn btn-primary btn-full mt-4" onClick={bookRental} disabled={rentalLoading}>
                                            {rentalLoading ? 'Booking...' : '✅ Confirm Booking'}
                                        </button>
                                    </div>
                                )}

                                {rentalResult && (
                                    <div className={`card p-6 ${styles.confirmCard}`} style={{ maxWidth: '480px', margin: '20px auto 0' }}>
                                        <div className={styles.confirmIcon}>🔑</div>
                                        <h3>Rental Booked!</h3>
                                        <p className="text-secondary" style={{ fontSize: '13px', marginTop: '8px' }}>{rentalResult.message}</p>
                                        <div className={styles.bookingSummary} style={{ marginTop: '16px' }}>
                                            <div><span>Ref</span><strong>{rentalResult.booking?.bookingRef}</strong></div>
                                            <div><span>Duration</span><strong>{rentalResult.hours}h</strong></div>
                                            <div><span>Total</span><strong style={{ color: 'var(--brand-secondary)' }}>₹{rentalResult.totalPrice}</strong></div>
                                        </div>
                                        <button className="btn btn-ghost btn-sm mt-4" onClick={() => { setRentalResult(null); setSelectedRentalVehicle(null); }}>Book Another</button>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
