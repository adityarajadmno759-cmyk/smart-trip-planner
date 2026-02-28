'use client';
import { useState, useRef, useEffect, useCallback } from 'react';

/**
 * Reusable Nominatim (OpenStreetMap) autocomplete search input.
 * Props:
 *   value          – controlled input string
 *   onChange       – (text) => void  — fires on every keystroke
 *   onSelect       – ({ lat, lng, address }) => void  — fires when user picks a suggestion
 *   placeholder    – string
 *   id             – string (for label htmlFor)
 *   style          – extra inline styles for the wrapper
 */
export default function NominatimSearch({ value, onChange, onSelect, placeholder, id, style = {} }) {
    const [suggestions, setSuggestions] = useState([]);
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const debounceRef = useRef(null);
    const wrapperRef = useRef(null);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handler = (e) => {
            if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
                setOpen(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const fetchSuggestions = useCallback(async (query) => {
        if (!query || query.length < 3) { setSuggestions([]); setOpen(false); return; }
        setLoading(true);
        try {
            const res = await fetch(
                `https://nominatim.openstreetmap.org/search?format=json&limit=6&q=${encodeURIComponent(query)}&addressdetails=1`,
                { headers: { 'User-Agent': 'SmartTripPlanner/1.0' } }
            );
            const data = await res.json();
            setSuggestions(data.map(item => ({
                lat: parseFloat(item.lat),
                lng: parseFloat(item.lon),
                address: item.display_name,
                shortName: [
                    item.address?.city || item.address?.town || item.address?.village || item.address?.county,
                    item.address?.state,
                    item.address?.country
                ].filter(Boolean).join(', ') || item.display_name.split(',').slice(0, 2).join(', '),
                type: item.type,
                class: item.class,
            })));
            setOpen(data.length > 0);
        } catch (err) {
            setSuggestions([]);
        } finally {
            setLoading(false);
        }
    }, []);

    const handleChange = (e) => {
        const val = e.target.value;
        onChange(val);
        clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => fetchSuggestions(val), 350);
    };

    const handleSelect = (suggestion) => {
        onChange(suggestion.shortName);
        onSelect({ lat: suggestion.lat, lng: suggestion.lng, address: suggestion.shortName });
        setSuggestions([]);
        setOpen(false);
    };

    const getIcon = (cls) => {
        if (!cls) return '📍';
        if (['amenity', 'building'].includes(cls)) return '🏢';
        if (cls === 'railway') return '🚉';
        if (cls === 'aeroway') return '✈️';
        if (cls === 'highway') return '🛣️';
        if (['natural', 'water'].includes(cls)) return '🌿';
        if (['tourism', 'leisure'].includes(cls)) return '🏛️';
        return '📍';
    };

    return (
        <div ref={wrapperRef} style={{ position: 'relative', ...style }}>
            <div style={{ position: 'relative' }}>
                <input
                    id={id}
                    type="text"
                    className="input-field"
                    placeholder={placeholder || 'Search location...'}
                    value={value}
                    onChange={handleChange}
                    onFocus={() => suggestions.length > 0 && setOpen(true)}
                    autoComplete="off"
                    style={{ paddingRight: loading ? '36px' : undefined }}
                />
                {loading && (
                    <span className="spinner" style={{
                        position: 'absolute', right: '12px', top: '50%',
                        transform: 'translateY(-50%)',
                        width: '14px', height: '14px', borderWidth: '2px',
                    }} />
                )}
            </div>

            {open && suggestions.length > 0 && (
                <div style={{
                    position: 'absolute',
                    top: 'calc(100% + 4px)',
                    left: 0, right: 0,
                    background: 'var(--bg-card, #1a1b2e)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '12px',
                    zIndex: 9999,
                    overflow: 'hidden',
                    boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
                }}>
                    {suggestions.map((s, i) => (
                        <div
                            key={i}
                            onMouseDown={() => handleSelect(s)}
                            style={{
                                padding: '10px 14px',
                                cursor: 'pointer',
                                borderBottom: i < suggestions.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none',
                                display: 'flex',
                                alignItems: 'flex-start',
                                gap: '10px',
                                transition: 'background 0.15s',
                            }}
                            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.07)'}
                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                        >
                            <span style={{ fontSize: '16px', flexShrink: 0, marginTop: '1px' }}>
                                {getIcon(s.class)}
                            </span>
                            <div style={{ minWidth: 0 }}>
                                <div style={{
                                    fontSize: '13px', fontWeight: 600,
                                    color: 'var(--text-primary, #fff)',
                                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                                }}>
                                    {s.shortName}
                                </div>
                                <div style={{
                                    fontSize: '11px',
                                    color: 'var(--text-secondary, #888)',
                                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                                }}>
                                    {s.address}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
