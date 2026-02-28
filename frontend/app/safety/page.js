'use client';
import { useState, useEffect, useRef } from 'react';
import { safetyAPI, userAPI } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import toast from 'react-hot-toast';
import emailjs from 'emailjs-com';
import dynamic from 'next/dynamic';
import styles from './page.module.css';

const LiveLocationMap = dynamic(() => import('@/components/LiveLocationMap'), { ssr: false });

// Tracking state machine: idle → tracking → paused → tracking ...
const TRACK_STATES = { IDLE: 'idle', TRACKING: 'tracking', PAUSED: 'paused' };

export default function SafetyPage() {
    const { user } = useAuth();
    const [location, setLocation] = useState(null);
    const [trackState, setTrackState] = useState(TRACK_STATES.IDLE);
    const [gpsError, setGpsError] = useState(null);
    const [sosLoading, setSosLoading] = useState(false);
    const [sosResult, setSosResult] = useState(null);
    const [contacts, setContacts] = useState([]);
    const [newContact, setNewContact] = useState({ name: '', email: '', relation: '' });
    const [addingContact, setAddingContact] = useState(false);
    const [contactsLoading, setContactsLoading] = useState(false);
    const watchIdRef = useRef(null);
    const pathRef = useRef([]);
    const [pathLength, setPathLength] = useState(0);

    useEffect(() => {
        if (user) loadContacts();
        // Don't auto-start — let user press Start explicitly
        return () => stopWatcher();
    }, [user]);

    const stopWatcher = () => {
        if (watchIdRef.current != null) {
            navigator.geolocation.clearWatch(watchIdRef.current);
            watchIdRef.current = null;
        }
    };

    const startTracking = () => {
        if (!navigator.geolocation) { setGpsError('Geolocation not supported by your browser.'); return; }
        setGpsError(null);
        setTrackState(TRACK_STATES.TRACKING);
        watchIdRef.current = navigator.geolocation.watchPosition(
            (pos) => {
                const pt = { lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy };
                setLocation(pt);
                pathRef.current.push({ ...pt, timestamp: new Date().toISOString() });
                setPathLength(pathRef.current.length);
            },
            (err) => {
                setGpsError(`GPS error: ${err.message}. Please allow location access.`);
                setTrackState(TRACK_STATES.IDLE);
            },
            { enableHighAccuracy: true, maximumAge: 5000 }
        );
    };

    const stopTracking = () => {
        stopWatcher();
        setTrackState(TRACK_STATES.PAUSED);
        toast(`⏸ Tracking paused. ${pathRef.current.length} points recorded.`);
    };

    const resumeTracking = () => {
        startTracking();
        toast.success('▶️ Tracking resumed');
    };

    const restartTracking = () => {
        stopWatcher();
        pathRef.current = [];
        setPathLength(0);
        setLocation(null);
        setTrackState(TRACK_STATES.IDLE);
        toast('⏹ Tracking stopped.');
    };

    const loadContacts = async () => {
        try { const { data } = await userAPI.getEmergencyContacts(); setContacts(data.contacts); } catch { }
    };

    const sendSOS = async () => {
        if (!location) { toast.error('Waiting for GPS — please wait a moment'); return; }
        if (!user) { toast.error('Please login to send SOS'); return; }
        setSosLoading(true); setSosResult(null);
        const mapsLink = `https://www.openstreetmap.org/?mlat=${location.lat}&mlon=${location.lng}#map=16/${location.lat}/${location.lng}`;
        const templateParams = {
            user_name: user.name, user_email: user.email,
            latitude: location.lat.toFixed(6), longitude: location.lng.toFixed(6),
            maps_link: mapsLink,
            message: `🆘 EMERGENCY! ${user.name} needs help! Location: ${mapsLink}`,
            emergency_contacts: contacts.map(c => `${c.name} (${c.email})`).join(', '),
        };
        try {
            const { data } = await safetyAPI.sendSOS({ lat: location.lat, lng: location.lng, message: templateParams.message });
            await emailjs.send(
                process.env.NEXT_PUBLIC_EMAILJS_SERVICE_ID,
                process.env.NEXT_PUBLIC_EMAILJS_TEMPLATE_ID,
                templateParams,
                process.env.NEXT_PUBLIC_EMAILJS_PUBLIC_KEY
            ).catch(err => console.error('EmailJS:', err));
            setSosResult(data.alert);
            toast.success(`🆘 SOS sent! ${data.alert.contactsNotified} contacts notified.`);
        } catch (e) { toast.error(e.response?.data?.error || 'SOS failed'); }
        finally { setSosLoading(false); }
    };

    const deleteContact = async (id) => {
        try { const { data } = await userAPI.deleteEmergencyContact(id); setContacts(data.contacts); toast.success('Contact removed'); } catch { }
    };

    const addContact = async (e) => {
        e.preventDefault();
        if (!newContact.name || !newContact.email) { toast.error('Name and email are required'); return; }
        setContactsLoading(true);
        try {
            const { data } = await userAPI.addEmergencyContact({ ...newContact, phone: newContact.email });
            setContacts(data.contacts);
            setNewContact({ name: '', email: '', relation: '' });
            setAddingContact(false);
            toast.success('Emergency contact added');
        } catch { toast.error('Failed to add contact'); }
        finally { setContactsLoading(false); }
    };

    const isTracking = trackState === TRACK_STATES.TRACKING;
    const isPaused = trackState === TRACK_STATES.PAUSED;

    return (
        <div className={styles.page}>
            <div className="container">
                <div className={styles.pageHeader}>
                    <h1>🛡️ Live Safety Tracker</h1>
                    <p className="text-secondary">Real-time GPS tracking · SOS via EmailJS · Emergency contacts</p>
                </div>

                <div className={styles.mainGrid}>
                    {/* Left: Live Map */}
                    <div className={styles.leftCol}>
                        <div className="card p-6">
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                                <h2 className={styles.sectionTitle}>📍 Live Location</h2>
                                {isTracking && (
                                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'rgba(0,217,165,0.12)', color: '#00D9A5', padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: 700 }}>
                                        <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#00D9A5', animation: 'pulse 1.5s ease-in-out infinite' }} />
                                        LIVE
                                    </span>
                                )}
                                {isPaused && (
                                    <span style={{ background: 'rgba(255,209,102,0.12)', color: '#FFD166', padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: 700 }}>⏸ PAUSED</span>
                                )}
                            </div>

                            {gpsError && (
                                <div style={{ background: 'rgba(255,107,107,0.1)', border: '1px solid rgba(255,107,107,0.3)', borderRadius: '10px', padding: '12px', marginBottom: '14px', color: '#FF6B6B', fontSize: '13px' }}>
                                    ⚠️ {gpsError}
                                </div>
                            )}

                            {location && (
                                <div className={styles.locationDisplay} style={{ marginBottom: '12px' }}>
                                    <div className={`${styles.trackingDot} ${isTracking ? styles.trackingDotActive : ''}`} />
                                    <div>
                                        <div className={styles.coordsText}>{location.lat.toFixed(6)}, {location.lng.toFixed(6)}</div>
                                        <div className={styles.accuracyText}>±{Math.round(location.accuracy)}m accuracy · {pathLength} points tracked</div>
                                    </div>
                                </div>
                            )}

                            {!location && !gpsError && trackState !== TRACK_STATES.IDLE && (
                                <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-secondary)' }}>
                                    <span className="spinner" style={{ width: '32px', height: '32px', borderWidth: '3px', display: 'inline-block' }} />
                                    <p style={{ marginTop: '12px' }}>Getting your location...</p>
                                </div>
                            )}

                            <LiveLocationMap location={location} tracking={isTracking} />

                            {/* Tracking Controls — always show all 3 */}
                            <div style={{ display: 'flex', gap: '8px', marginTop: '14px' }}>
                                {/* START — always visible; restarts if already tracking */}
                                <button
                                    className={`btn ${trackState === TRACK_STATES.IDLE ? 'btn-primary' : 'btn-ghost'}`}
                                    style={{ flex: 1, ...(isTracking ? { border: '1px solid rgba(0,217,165,0.4)', color: '#00D9A5', background: 'rgba(0,217,165,0.1)' } : isPaused ? { border: '1px solid rgba(108,99,255,0.3)', color: '#a78bfa' } : {}) }}
                                    onClick={() => { stopWatcher(); pathRef.current = []; setPathLength(0); setLocation(null); setTimeout(startTracking, 200); }}
                                >
                                    {isTracking ? '✅ Started' : '▶️ Start'}
                                </button>

                                {/* PAUSE ↔ RESUME */}
                                <button
                                    className="btn btn-secondary"
                                    style={{ flex: 1, opacity: trackState === TRACK_STATES.IDLE ? 0.4 : 1 }}
                                    disabled={trackState === TRACK_STATES.IDLE}
                                    onClick={isPaused ? resumeTracking : stopTracking}
                                >
                                    {isPaused ? '▶️ Resume' : '⏸ Pause'}
                                </button>

                                {/* STOP */}
                                <button
                                    className="btn btn-ghost"
                                    style={{ flex: 1, border: '1px solid rgba(255,107,107,0.3)', color: '#FF6B6B', opacity: trackState === TRACK_STATES.IDLE ? 0.4 : 1 }}
                                    disabled={trackState === TRACK_STATES.IDLE}
                                    onClick={restartTracking}
                                >
                                    ⏹ Stop
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Right: SOS + Contacts */}
                    <div className={styles.rightCol}>
                        {/* SOS Card */}
                        <div className={`card p-6 ${styles.sosCard}`}>
                            <h2 className={styles.sectionTitle}>🆘 Emergency Alert</h2>
                            <p className="text-secondary" style={{ fontSize: '13px', marginBottom: '20px', lineHeight: 1.7 }}>
                                Pressing SOS instantly notifies all emergency contacts with your live location via email.
                            </p>
                            <button
                                className={`${styles.sosButton} ${sosLoading ? styles.sosLoading : ''}`}
                                onClick={sendSOS} disabled={sosLoading}
                            >
                                {sosLoading ? '⏳ Sending...' : '🆘 SOS'}
                            </button>
                            <p className={styles.sosHint}>Notifies all emergency contacts instantly</p>
                            {sosResult && (
                                <div className={styles.sosResult}>
                                    <div className={styles.sosResultHeader}>✅ SOS Alert Sent!</div>
                                    <div className={styles.sosResultBody}>
                                        <div><span>Time</span><strong>{new Date(sosResult.timestamp).toLocaleTimeString()}</strong></div>
                                        <div><span>Contacts</span><strong>{sosResult.contactsNotified} notified</strong></div>
                                        {location && (
                                            <div>
                                                <span>Location</span>
                                                <a href={`https://www.openstreetmap.org/?mlat=${location.lat}&mlon=${location.lng}#map=16/${location.lat}/${location.lng}`}
                                                    target="_blank" rel="noopener noreferrer" style={{ color: 'var(--brand-primary)' }}>
                                                    View on Map →
                                                </a>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Emergency Contacts */}
                        <div className="card p-6">
                            <div className={styles.contactsHeader}>
                                <h2 className={styles.sectionTitle}>📞 Emergency Contacts</h2>
                                {user && (
                                    <button className="btn btn-secondary btn-sm" onClick={() => setAddingContact(p => !p)}>
                                        {addingContact ? '✕ Cancel' : '+ Add'}
                                    </button>
                                )}
                            </div>

                            {!user && <div className={styles.loginPrompt}><span style={{ fontSize: '32px' }}>🔐</span><p>Login to manage emergency contacts</p></div>}

                            {user && addingContact && (
                                <form onSubmit={addContact} className={styles.addContactForm}>
                                    <div className="input-group"><label className="input-label">Name *</label>
                                        <input className="input-field" placeholder="Contact name" value={newContact.name} onChange={e => setNewContact(p => ({ ...p, name: e.target.value }))} required />
                                    </div>
                                    <div className="input-group"><label className="input-label">Email *</label>
                                        <input className="input-field" type="email" placeholder="email@example.com" value={newContact.email} onChange={e => setNewContact(p => ({ ...p, email: e.target.value }))} required />
                                    </div>
                                    <div className="input-group"><label className="input-label">Relation</label>
                                        <select className="input-field" style={{ color: 'var(--text-primary)', background: 'var(--bg-card)' }} value={newContact.relation} onChange={e => setNewContact(p => ({ ...p, relation: e.target.value }))}>
                                            <option value="">Select relation</option>
                                            {['Parent', 'Spouse', 'Sibling', 'Friend', 'Other'].map(r => <option key={r} value={r}>{r}</option>)}
                                        </select>
                                    </div>
                                    <button className="btn btn-primary btn-full" type="submit" disabled={contactsLoading}>
                                        {contactsLoading ? 'Saving...' : '✅ Save Contact'}
                                    </button>
                                </form>
                            )}

                            {user && contacts.length === 0 && !addingContact && (
                                <div className={styles.loginPrompt}><span style={{ fontSize: '32px' }}>📵</span><p>No emergency contacts yet.</p></div>
                            )}

                            {contacts.map(c => (
                                <div key={c._id} className={styles.contactCard}>
                                    <div className={styles.contactAvatar}>{c.name?.[0]?.toUpperCase()}</div>
                                    <div className={styles.contactInfo}>
                                        <div className={styles.contactName}>{c.name}</div>
                                        <div className={styles.contactPhone}>{c.email || c.phone}</div>
                                        {c.relation && <span className="badge badge-primary" style={{ marginTop: '4px', fontSize: '10px' }}>{c.relation}</span>}
                                    </div>
                                    <button className="btn btn-ghost btn-icon" onClick={() => deleteContact(c._id)} style={{ color: 'var(--status-danger)', flexShrink: 0 }}>🗑️</button>
                                </div>
                            ))}
                        </div>

                        {/* Safety Tips */}
                        <div className="card p-6">
                            <h3 className={styles.sectionTitle}>💡 Safety Tips</h3>
                            <div className={styles.tipsGrid}>
                                {[
                                    { icon: '📱', tip: 'Keep your phone charged while travelling' },
                                    { icon: '📍', tip: 'Share your itinerary with trusted contacts' },
                                    { icon: '🌐', tip: 'Save offline maps for poor connectivity areas' },
                                    { icon: '🆘', tip: 'Add at least 2 contacts before travel' },
                                    { icon: '🏥', tip: 'Note local emergency numbers at destination' },
                                    { icon: '💳', tip: 'Keep digital copies of important documents' },
                                ].map((t, i) => (
                                    <div key={i} className={styles.tip}>
                                        <span className={styles.tipIcon}>{t.icon}</span>
                                        <span className={styles.tipText}>{t.tip}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
