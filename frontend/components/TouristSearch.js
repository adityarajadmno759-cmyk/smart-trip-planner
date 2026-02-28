'use client';
import { useState, useRef, useCallback } from 'react';

const PLACE_ICONS = {
    // Cities / regions
    city: '🏙️', town: '🏘️', village: '🏡', state: '🗾', country: '🌍',
    county: '📍', district: '📍', region: '📍', suburb: '📍',
    // Tourist attractions
    tourism: '🏛️', attraction: '⭐', museum: '🖼️', monument: '🗿',
    viewpoint: '🔭', artwork: '🎨', gallery: '🖼️',
    // Historic
    historic: '🏯', ruins: '🏚️', castle: '🏰', fort: '🏰',
    archaeological_site: '⛏️', memorial: '🕍',
    // Religious
    temple: '🛕', church: '⛪', mosque: '🕌', place_of_worship: '🙏',
    // Nature / leisure
    natural: '🌿', park: '🌳', garden: '🌸', zoo: '🦁',
    waterfall: '💧', beach: '🏖️', mountain: '⛰️',
    // Amenity
    amenity: '📍', theatre: '🎭', cinema: '🎬', aquarium: '🐟',
};

const TOURIST_TYPES = new Set([
    'tourism', 'historic', 'monument', 'museum', 'castle', 'fort', 'ruins',
    'temple', 'church', 'mosque', 'place_of_worship', 'viewpoint', 'gallery',
    'artwork', 'zoo', 'aquarium', 'theme_park', 'garden', 'waterfall',
    'archaeological_site', 'memorial', 'attraction',
]);

function getIcon(place) {
    const t = place.type;
    const c = place.class;
    return PLACE_ICONS[t] || PLACE_ICONS[c] || '📍';
}

function getLabel(place) {
    const t = place.type;
    const c = place.class;
    if (t === 'city' || t === 'town' || t === 'village') return t.charAt(0).toUpperCase() + t.slice(1);
    if (c === 'boundary' || t === 'state' || t === 'county') return 'Region';
    if (TOURIST_TYPES.has(t) || TOURIST_TYPES.has(c)) return 'Tourist Spot';
    if (c === 'amenity') return place.type || 'Place';
    return place.type || place.class || 'Place';
}

function debounce(fn, delay) {
    let t;
    return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), delay); };
}

/**
 * TouristSearch — autocomplete showing both cities/states AND tourist attractions.
 * Props: value, onChange, onSelect({ lat, lng, address, name })
 */
export default function TouristSearch({ value, onChange, onSelect, placeholder }) {
    const [suggestions, setSuggestions] = useState([]);
    const [loading, setLoading] = useState(false);
    const [open, setOpen] = useState(false);

    const fetchSuggestions = useCallback(
        debounce(async (query) => {
            if (!query || query.length < 2) { setSuggestions([]); setOpen(false); return; }
            setLoading(true);
            try {
                // Single call — get all types, sort tourist ones to top
                const res = await fetch(
                    `https://nominatim.openstreetmap.org/search?format=json&limit=12&q=${encodeURIComponent(query)}&addressdetails=1&extratags=1`,
                    { headers: { 'User-Agent': 'SmartTripPlanner/1.0' } }
                );
                const all = await res.json();

                // Separate: cities/regions first, then tourist spots, then others
                const cities = all.filter(p =>
                    ['city', 'town', 'village', 'county', 'state', 'country', 'suburb', 'region', 'district'].includes(p.type) ||
                    p.class === 'boundary' || p.class === 'place'
                );
                const tourist = all.filter(p =>
                    TOURIST_TYPES.has(p.type) || TOURIST_TYPES.has(p.class) ||
                    p.extratags?.tourism || p.extratags?.historic
                );
                const rest = all.filter(p => !cities.includes(p) && !tourist.includes(p));

                // Merge: cities first, then tourist, then rest — deduplicate
                const seen = new Set();
                const merged = [];
                for (const item of [...cities, ...tourist, ...rest]) {
                    if (!seen.has(item.osm_id) && merged.length < 8) {
                        seen.add(item.osm_id);
                        merged.push(item);
                    }
                }
                setSuggestions(merged);
                setOpen(merged.length > 0);
            } catch {
                setSuggestions([]);
            } finally {
                setLoading(false);
            }
        }, 320),
        []
    );

    const handleChange = (e) => {
        const v = e.target.value;
        onChange(v);
        fetchSuggestions(v);
    };

    const handleSelect = (place) => {
        const name = place.name || place.display_name?.split(',')[0];
        onSelect({ lat: parseFloat(place.lat), lng: parseFloat(place.lon), address: place.display_name, name });
        onChange(name);
        setSuggestions([]);
        setOpen(false);
    };

    return (
        <div style={{ position: 'relative', flex: 1 }}>
            <div style={{ position: 'relative' }}>
                <input
                    type="text"
                    className="input-field"
                    value={value}
                    onChange={handleChange}
                    onFocus={() => suggestions.length > 0 && setOpen(true)}
                    onBlur={() => setTimeout(() => setOpen(false), 180)}
                    placeholder={placeholder || 'Search city, state or tourist attraction...'}
                    autoComplete="off"
                    style={{ paddingRight: '36px' }}
                />
                {loading && (
                    <span className="spinner" style={{
                        position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)',
                        width: '16px', height: '16px', borderWidth: '2px',
                    }} />
                )}
                {!loading && value && (
                    <button type="button"
                        style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontSize: '16px', lineHeight: 1 }}
                        onMouseDown={() => { onChange(''); setSuggestions([]); setOpen(false); }}>✕</button>
                )}
            </div>

            {open && suggestions.length > 0 && (
                <div style={{
                    position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0,
                    background: '#1a1b2e', border: '1px solid rgba(255,255,255,0.12)',
                    borderRadius: '12px', boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
                    zIndex: 1000, overflow: 'hidden',
                }}>
                    {suggestions.map((place, i) => {
                        const name = place.name || place.display_name?.split(',')[0];
                        const sub = place.display_name?.split(',').slice(1, 3).join(', ');
                        const icon = getIcon(place);
                        const label = getLabel(place);
                        const isTourist = TOURIST_TYPES.has(place.type) || TOURIST_TYPES.has(place.class);
                        return (
                            <div key={place.osm_id || i}
                                onMouseDown={() => handleSelect(place)}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: '10px',
                                    padding: '9px 12px', cursor: 'pointer',
                                    borderTop: i > 0 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                                    transition: 'background 0.12s',
                                }}
                                onMouseEnter={e => e.currentTarget.style.background = 'rgba(108,99,255,0.12)'}
                                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                            >
                                <span style={{
                                    fontSize: '18px', width: '30px', height: '30px',
                                    background: isTourist ? 'rgba(0,217,165,0.12)' : 'rgba(108,99,255,0.12)',
                                    borderRadius: '7px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                                }}>{icon}</span>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontWeight: 600, fontSize: '13px', color: '#e2e8f0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{name}</div>
                                    {sub && <div style={{ fontSize: '11px', color: '#666', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{sub}</div>}
                                </div>
                                <span style={{
                                    fontSize: '10px', padding: '2px 7px', borderRadius: '10px', flexShrink: 0,
                                    background: isTourist ? 'rgba(0,217,165,0.15)' : 'rgba(108,99,255,0.15)',
                                    color: isTourist ? '#00D9A5' : '#a78bfa',
                                }}>{label}</span>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
