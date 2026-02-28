'use client';
import { useState, useCallback } from 'react';
import { mapsAPI } from '@/lib/api';
import toast from 'react-hot-toast';
import dynamic from 'next/dynamic';
import NominatimSearch from '@/components/NominatimSearch';
import styles from './page.module.css';
import axios from 'axios';

const PlannerMap = dynamic(() => import('@/components/PlannerMap'), { ssr: false });

const TRANSPORT_MODES = [
    { mode: 'driving', label: 'Driving', icon: '🚗', color: '#6C63FF' },
    { mode: 'transit', label: 'Transit', icon: '🚌', color: '#00D9A5' },
    { mode: 'walking', label: 'Walking', icon: '🚶', color: '#FFD166' },
    { mode: 'bicycling', label: 'Cycling', icon: '🚴', color: '#FF6B6B' },
];

const AQI_LABELS = {
    'Good': { color: '#00D9A5', icon: '✅' },
    'Moderate': { color: '#FFD166', icon: '⚠️' },
    'Unhealthy for Sensitive Groups': { color: '#FF9F43', icon: '😷' },
    'Unhealthy': { color: '#FF6B6B', icon: '🚫' },
    'Very Unhealthy': { color: '#C44FFF', icon: '☠️' },
};

// Reverse geocode with Nominatim
async function nominatimReverseGeocode(lat, lng) {
    try {
        const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`,
            { headers: { 'User-Agent': 'SmartTripPlanner/1.0' } }
        );
        const data = await res.json();
        const addr = data.address;
        return [addr?.city || addr?.town || addr?.village, addr?.state, addr?.country].filter(Boolean).join(', ')
            || data.display_name;
    } catch {
        return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
    }
}

export default function HomePage() {
    const [originInput, setOriginInput] = useState('');
    const [destInput, setDestInput] = useState('');
    const [originCoords, setOriginCoords] = useState(null);
    const [destCoords, setDestCoords] = useState(null);
    const [selectedModes, setSelectedModes] = useState(['driving', 'transit']);
    const [loading, setLoading] = useState(false);
    const [gettingLocation, setGettingLocation] = useState(false);
    const [routeData, setRouteData] = useState(null);
    const [pollution, setPollution] = useState(null);
    const [pollutionLoading, setPollutionLoading] = useState(false);
    const [selectedRoute, setSelectedRoute] = useState(null);
    const [mapOrigin, setMapOrigin] = useState(null);
    const [mapDest, setMapDest] = useState(null);

    const detectLocation = () => {
        if (!navigator.geolocation) { toast.error('Geolocation not supported'); return; }
        setGettingLocation(true);
        navigator.geolocation.getCurrentPosition(
            async (pos) => {
                const { latitude: lat, longitude: lng } = pos.coords;
                setOriginCoords({ lat, lng });
                const address = await nominatimReverseGeocode(lat, lng);
                setOriginInput(address);
                toast.success('📍 Location detected!');
                setGettingLocation(false);
            },
            () => { toast.error('Could not detect location.'); setGettingLocation(false); },
            { timeout: 10000 }
        );
    };

    const fetchAirQuality = useCallback(async (lat, lng) => {
        setPollutionLoading(true);
        const apiKey = process.env.NEXT_PUBLIC_OPENAQ_API_KEY;
        const headers = {};
        if (apiKey && apiKey !== 'your_openaq_api_key_here') {
            headers['X-API-Key'] = apiKey;
        }
        try {
            const res = await axios.get(
                `https://api.openaq.org/v2/latest?coordinates=${lat},${lng}&radius=25000&limit=3&order_by=distance`,
                { headers, timeout: 10000 }
            );
            const results = res.data.results?.[0];
            if (results?.measurements?.length > 0) {
                const pm25 = results.measurements.find(m => m.parameter === 'pm25');
                const pm10 = results.measurements.find(m => m.parameter === 'pm10');
                const no2 = results.measurements.find(m => m.parameter === 'no2');
                const o3 = results.measurements.find(m => m.parameter === 'o3');
                // Proper PM2.5 → AQI formula (US EPA simplified)
                const pm25v = pm25?.value;
                let aqi;
                if (pm25v != null) {
                    if (pm25v <= 12) aqi = Math.round((pm25v / 12) * 50);
                    else if (pm25v <= 35.4) aqi = Math.round(50 + ((pm25v - 12) / 23.4) * 50);
                    else if (pm25v <= 55.4) aqi = Math.round(100 + ((pm25v - 35.4) / 20) * 50);
                    else if (pm25v <= 150.4) aqi = Math.round(150 + ((pm25v - 55.4) / 95) * 50);
                    else aqi = Math.round(200 + ((pm25v - 150.4) / 99.6) * 100);
                } else {
                    const fallback = pm10?.value ?? 20;
                    aqi = Math.round(fallback * 3.8);
                }
                aqi = Math.max(0, Math.min(500, aqi));
                const category = aqi <= 50 ? 'Good' : aqi <= 100 ? 'Moderate' : aqi <= 150 ? 'Unhealthy for Sensitive Groups' : aqi <= 200 ? 'Unhealthy' : 'Very Unhealthy';
                setPollution({
                    averageAqi: aqi, category,
                    station: results.location,
                    measurements: [pm25, pm10, no2, o3].filter(Boolean).slice(0, 4),
                    source: 'OpenAQ',
                    dominantPollutant: pm25 ? 'PM2.5' : pm10 ? 'PM10' : no2 ? 'NO₂' : 'Unknown',
                });
            } else {
                setPollution({ averageAqi: 72, category: 'Moderate', source: 'estimated', station: null });
            }
        } catch { setPollution({ averageAqi: 72, category: 'Moderate', source: 'estimated', station: null }); }
        finally { setPollutionLoading(false); }
    }, []);


    const planTrip = async () => {
        if (!originInput.trim() || !destInput.trim()) { toast.error('Please enter both origin and destination'); return; }
        setLoading(true); setRouteData(null); setPollution(null); setSelectedRoute(null);

        try {
            let oCoords = originCoords;
            let dCoords = destCoords;

            if (!oCoords) {
                const r = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(originInput)}`, { headers: { 'User-Agent': 'SmartTripPlanner/1.0' } });
                const d = await r.json();
                if (!d.length) throw new Error(`Could not find "${originInput}"`);
                oCoords = { lat: parseFloat(d[0].lat), lng: parseFloat(d[0].lon) };
                setOriginCoords(oCoords);
            }
            if (!dCoords) {
                const r = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(destInput)}`, { headers: { 'User-Agent': 'SmartTripPlanner/1.0' } });
                const d = await r.json();
                if (!d.length) throw new Error(`Could not find "${destInput}"`);
                dCoords = { lat: parseFloat(d[0].lat), lng: parseFloat(d[0].lon) };
                setDestCoords(dCoords);
            }

            setMapOrigin(oCoords);
            setMapDest(dCoords);

            // Fetch OSRM route for driving as baseline
            const osrmRes = await fetch(`https://router.project-osrm.org/route/v1/driving/${oCoords.lng},${oCoords.lat};${dCoords.lng},${dCoords.lat}?overview=false&steps=false`);
            const osrmData = await osrmRes.json();
            const routesByMode = {};

            if (osrmData.code === 'Ok' && osrmData.routes?.[0]) {
                const r = osrmData.routes[0];
                const distKm = r.distance / 1000;
                const durationMin = Math.round(r.duration / 60);

                const fuelCostDriving = Math.round((distKm / 15) * 106);
                const transitFare = distKm <= 2 ? 10 : distKm <= 5 ? 20 : distKm <= 12 ? 30 : distKm <= 21 ? 40 : distKm <= 32 ? 50 : Math.round(50 + (distKm - 32) * 1.5);

                if (selectedModes.includes('driving')) {
                    routesByMode.driving = [{ summary: 'Fastest route', distance: { text: `${distKm.toFixed(1)} km`, value: r.distance }, duration: { text: `${durationMin} mins`, value: r.duration }, fuelCost: fuelCostDriving, mode: 'driving' }];
                }
                if (selectedModes.includes('transit')) {
                    routesByMode.transit = [{ summary: 'Public transport', distance: { text: `${distKm.toFixed(1)} km`, value: r.distance }, duration: { text: `${Math.round(durationMin * 1.4)} mins`, value: r.duration * 1.4 }, transitFare, mode: 'transit' }];
                }
                if (selectedModes.includes('walking')) {
                    routesByMode.walking = [{ summary: 'Walking route', distance: { text: `${distKm.toFixed(1)} km`, value: r.distance }, duration: { text: `${Math.round(distKm * 12)} mins`, value: distKm * 720 }, fuelCost: 0, mode: 'walking' }];
                }
                if (selectedModes.includes('bicycling')) {
                    routesByMode.bicycling = [{ summary: 'Cycling route', distance: { text: `${distKm.toFixed(1)} km`, value: r.distance }, duration: { text: `${Math.round(distKm * 4)} mins`, value: distKm * 240 }, fuelCost: 0, mode: 'bicycling' }];
                }
            }

            setRouteData(routesByMode);
            const total = Object.values(routesByMode).flat().length;
            toast.success(`Found ${total} route option${total !== 1 ? 's' : ''}!`);

            // Fetch air quality for midpoint
            const midLat = (oCoords.lat + dCoords.lat) / 2;
            const midLng = (oCoords.lng + dCoords.lng) / 2;
            fetchAirQuality(midLat, midLng);
        } catch (err) {
            toast.error(err.message || 'Failed to find route. Please try again.');
        } finally { setLoading(false); }
    };

    const allRoutes = routeData ? Object.entries(routeData).flatMap(([mode, routes]) =>
        (routes || []).map((r, i) => ({ ...r, mode, routeIdx: i }))
    ) : [];

    const aqiInfo = pollution ? AQI_LABELS[pollution.category] || AQI_LABELS['Moderate'] : null;

    return (
        <div className={styles.page}>
            <section className={styles.hero}>
                <div className={styles.heroContent}>
                    <div className={styles.heroBadge}><span>🌍</span> Open-Source Trip Intelligence</div>
                    <h1 className={styles.heroTitle}>Plan Your<br /><span className="text-gradient">Perfect Journey</span></h1>
                    <p className={styles.heroSubtitle}>Real-time routes via OpenStreetMap · Pollution data from OpenAQ</p>
                </div>
            </section>

            <div className={styles.mainGrid}>
                {/* Left Controls */}
                <div className={styles.controlPanel}>
                    <div className="card p-6">
                        <h2 className={styles.sectionTitle}>📍 Plan Your Route</h2>
                        <div className={styles.inputStack}>
                            <div className="input-group">
                                <label className="input-label">📍 From</label>
                                <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                                    <div style={{ flex: 1 }}>
                                        <NominatimSearch
                                            id="origin-input"
                                            value={originInput}
                                            onChange={(v) => { setOriginInput(v); setOriginCoords(null); }}
                                            onSelect={({ lat, lng, address }) => { setOriginCoords({ lat, lng }); setOriginInput(address); }}
                                            placeholder="Current location or city name"
                                        />
                                    </div>
                                    <button className={styles.detectBtn} onClick={detectLocation} disabled={gettingLocation} title="Auto-detect location">
                                        {gettingLocation ? <span className="spinner" style={{ width: '13px', height: '13px', borderWidth: '2px' }} /> : '🎯'} Auto
                                    </button>
                                </div>
                            </div>
                            <div className="input-group">
                                <label className="input-label">🏁 To</label>
                                <NominatimSearch
                                    id="dest-input"
                                    value={destInput}
                                    onChange={(v) => { setDestInput(v); setDestCoords(null); }}
                                    onSelect={({ lat, lng, address }) => { setDestCoords({ lat, lng }); setDestInput(address); }}
                                    placeholder="Enter destination city or address"
                                />
                            </div>
                        </div>

                        <div className={styles.modeSection}>
                            <p className={styles.modeLabel}>Transport Modes</p>
                            <div className={styles.modeGrid}>
                                {TRANSPORT_MODES.map((tm) => (
                                    <button
                                        key={tm.mode}
                                        className={`${styles.modeBtn} ${selectedModes.includes(tm.mode) ? styles.modeBtnActive : ''}`}
                                        onClick={() => setSelectedModes(prev => prev.includes(tm.mode) ? prev.length > 1 ? prev.filter(m => m !== tm.mode) : prev : [...prev, tm.mode])}
                                        style={selectedModes.includes(tm.mode) ? { '--mode-color': tm.color } : {}}
                                    >
                                        <span>{tm.icon}</span><span>{tm.label}</span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        <button className="btn btn-primary btn-full btn-lg" onClick={planTrip} disabled={loading}>
                            {loading ? <><span className="spinner" style={{ width: '18px', height: '18px', borderWidth: '2px', borderTopColor: 'white' }} /> Planning...</> : '🗺️ Plan My Trip'}
                        </button>
                    </div>

                    {/* Air Quality Card */}
                    {(pollution || pollutionLoading) && (
                        <div className={`card p-6 ${styles.pollutionCard}`} style={aqiInfo ? { borderColor: `${aqiInfo.color}44` } : {}}>
                            <h3 className={styles.cardTitle}>💨 Air Quality Along Route</h3>
                            {pollutionLoading ? (
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#999', fontSize: '13px' }}>
                                    <span className="spinner" style={{ width: '16px', height: '16px', borderWidth: '2px' }} />
                                    Fetching OpenAQ data...
                                </div>
                            ) : pollution && aqiInfo && (
                                <>
                                    <div className={styles.aqiMain}>
                                        <div className={styles.aqiScore} style={{ color: aqiInfo.color }}>{aqiInfo.icon}</div>
                                        <div>
                                            <div className={styles.aqiCategory} style={{ color: aqiInfo.color }}>
                                                {pollution.averageAqi <= 50 ? 'LOW' : pollution.averageAqi <= 100 ? 'MEDIUM' : 'HIGH'} — {pollution.category}
                                            </div>
                                            <div style={{ fontSize: '11px', color: '#888', marginTop: '4px' }}>
                                                {pollution.station ? `📡 ${pollution.station}` : '📍 Route midpoint'} · {pollution.source}
                                                {pollution.dominantPollutant && ` · Main: ${pollution.dominantPollutant}`}
                                            </div>
                                        </div>
                                    </div>
                                    {pollution.measurements?.length > 0 && (
                                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '12px' }}>
                                            {pollution.measurements.map((m, i) => {
                                                // Per-parameter thresholds for level labels
                                                const thresholds = {
                                                    pm25: { low: 12, med: 35 },
                                                    pm10: { low: 50, med: 100 },
                                                    no2: { low: 40, med: 80 },
                                                    o3: { low: 60, med: 120 },
                                                };
                                                const t = thresholds[m.parameter] || { low: 50, med: 100 };
                                                const level = m.value <= t.low ? 'Low' : m.value <= t.med ? 'Medium' : 'High';
                                                const levelColor = level === 'Low' ? '#00D9A5' : level === 'Medium' ? '#FFD166' : '#FF6B6B';
                                                return (
                                                    <div key={i} style={{ background: 'var(--bg-tertiary,#252640)', padding: '8px 12px', borderRadius: '8px', fontSize: '12px', minWidth: '70px', textAlign: 'center' }}>
                                                        <span style={{ color: '#888', fontSize: '10px', display: 'block', marginBottom: '3px' }}>{m.parameter.toUpperCase()}</span>
                                                        <strong style={{ color: levelColor, fontSize: '13px' }}>{level}</strong>
                                                        <span style={{ color: '#666', fontSize: '10px', display: 'block' }}>{m.value?.toFixed(1)} {m.unit}</span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}

                                </>
                            )}
                        </div>
                    )}
                </div>

                {/* Right: Map + Routes */}
                <div className={styles.rightPanel}>
                    <div className={styles.mapWrapper} style={{ position: 'relative' }}>
                        {!mapOrigin && (
                            <div style={{
                                position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
                                alignItems: 'center', justifyContent: 'center', zIndex: 10,
                                background: 'rgba(10,11,26,0.75)', borderRadius: '12px', gap: '10px',
                                color: 'white', pointerEvents: 'none',
                            }}>
                                <span style={{ fontSize: '40px' }}>🗺️</span>
                                <p style={{ fontWeight: 600, margin: 0 }}>Enter locations to see route on map</p>
                                <p style={{ fontSize: '12px', color: '#aaa', margin: 0 }}>Powered by OpenStreetMap · Free</p>
                            </div>
                        )}
                        <PlannerMap origin={mapOrigin} destination={mapDest} />
                    </div>

                    {loading && (
                        <div className={styles.routeCards}>
                            {[1, 2, 3].map(i => (
                                <div key={i} className={`card p-4 ${styles.routeCardSkeleton}`}>
                                    <div className="skeleton" style={{ height: '20px', width: '60%', marginBottom: '12px' }} />
                                    <div className="skeleton" style={{ height: '16px', width: '80%', marginBottom: '8px' }} />
                                    <div className="skeleton" style={{ height: '16px', width: '40%' }} />
                                </div>
                            ))}
                        </div>
                    )}

                    {allRoutes.length > 0 && (
                        <div className={styles.routeCards}>
                            <h3 className={styles.routeCardsTitle}>🛣️ {allRoutes.length} Route{allRoutes.length > 1 ? 's' : ''} Found</h3>
                            {allRoutes.map((route, i) => {
                                const modeInfo = TRANSPORT_MODES.find(m => m.mode === route.mode);
                                const isSelected = selectedRoute?.mode === route.mode && selectedRoute?.routeIdx === route.routeIdx;
                                const minDuration = Math.min(...allRoutes.map(r => r.duration?.value ?? Infinity));
                                const maxDuration = Math.max(...allRoutes.map(r => r.duration?.value ?? 0));
                                const minDistance = Math.min(...allRoutes.map(r => r.distance?.value ?? Infinity));
                                const maxDistance = Math.max(...allRoutes.map(r => r.distance?.value ?? 0));
                                const distancesAllSame = maxDistance - minDistance < 500; // within 500m = same
                                const isFastest = route.duration?.value === minDuration;
                                const isSlowest = allRoutes.length > 1 && route.duration?.value === maxDuration && !isFastest;
                                // Only show Shortest badge if distances genuinely differ
                                const isShortest = !distancesAllSame && route.distance?.value === minDistance && !isFastest;
                                const isZeroCost = route.mode === 'walking' || route.mode === 'bicycling';
                                return (
                                    <div key={i}
                                        className={`${styles.routeCard} ${isSelected ? styles.routeCardSelected : ''}`}
                                        onClick={() => setSelectedRoute({ mode: route.mode, routeIdx: route.routeIdx, ...route })}
                                        style={isSelected ? { '--route-color': modeInfo?.color || '#6C63FF' } : {}}
                                    >
                                        <div className={styles.routeCardHeader}>
                                            <div className={styles.routeMode}>
                                                <span style={{ fontSize: '20px' }}>{modeInfo?.icon}</span>
                                                <div>
                                                    <span className={styles.routeModeLabel}>{modeInfo?.label}</span>
                                                    {route.summary && <span className={styles.routeSummary}> via {route.summary}</span>}
                                                </div>
                                            </div>
                                            <div className={styles.routeBadges}>
                                                {isFastest && <span className="badge badge-primary">Fastest</span>}
                                                {isSlowest && <span className="badge badge-warning">Slowest</span>}
                                                {isShortest && <span className="badge badge-success">Shortest</span>}
                                                {isZeroCost && <span className="badge badge-success">Free</span>}
                                            </div>
                                        </div>
                                        <div className={styles.routeStats}>
                                            <div className={styles.routeStat}>
                                                <span className={styles.routeStatIcon}>📏</span>
                                                <div><div className={styles.routeStatValue}>{route.distance?.text}</div><div className={styles.routeStatLabel}>Distance</div></div>
                                            </div>
                                            <div className={styles.routeStat}>
                                                <span className={styles.routeStatIcon}>⏱️</span>
                                                <div><div className={styles.routeStatValue}>{route.duration?.text}</div><div className={styles.routeStatLabel}>Duration</div></div>
                                            </div>
                                            {route.fuelCost != null && (
                                                <div className={styles.routeStat}>
                                                    <span className={styles.routeStatIcon}>{isZeroCost ? '🆓' : '⛽'}</span>
                                                    <div>
                                                        <div className={styles.routeStatValue} style={isZeroCost ? { color: '#00D9A5' } : {}}>{isZeroCost ? 'Free' : `₹${route.fuelCost}`}</div>
                                                        <div className={styles.routeStatLabel}>Cost</div>
                                                    </div>
                                                </div>
                                            )}
                                            {route.transitFare != null && (
                                                <div className={styles.routeStat}>
                                                    <span className={styles.routeStatIcon}>🎫</span>
                                                    <div><div className={styles.routeStatValue}>₹{route.transitFare}</div><div className={styles.routeStatLabel}>Est. Fare</div></div>
                                                </div>
                                            )}
                                            {/* Pollution per route — show level not raw AQI */}
                                            {aqiInfo && (
                                                <div className={styles.routeStat}>
                                                    <span className={styles.routeStatIcon}>💨</span>
                                                    <div>
                                                        <div className={styles.routeStatValue} style={{ color: aqiInfo.color }}>
                                                            {pollution.averageAqi <= 50 ? 'Low' : pollution.averageAqi <= 100 ? 'Medium' : 'High'}
                                                        </div>
                                                        <div className={styles.routeStatLabel}>Air Quality</div>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
