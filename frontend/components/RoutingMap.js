'use client';
import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet-routing-machine';

export default function RoutingMap({ currentPosition }) {
    const mapRef = useRef(null);
    const routingControlRef = useRef(null);

    useEffect(() => {
        if (!mapRef.current) {
            mapRef.current = L.map('map').setView([currentPosition?.lat || 20.5937, currentPosition?.lng || 78.9629], 5);
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            }).addTo(mapRef.current);
        }

        if (currentPosition && mapRef.current) {
            mapRef.current.setView([currentPosition.lat, currentPosition.lng], 13);
            L.marker([currentPosition.lat, currentPosition.lng]).addTo(mapRef.current)
                .bindPopup('Your Location')
                .openPopup();
        }

        return () => {
            if (mapRef.current) {
                mapRef.current.remove();
                mapRef.current = null;
            }
        };
    }, []);

    useEffect(() => {
        if (currentPosition && mapRef.current) {
            // Setup routing if we have a destination (placeholder for now, search box will set destination)
            if (routingControlRef.current) {
                mapRef.current.removeControl(routingControlRef.current);
            }
        }
    }, [currentPosition]);

    const handleSearch = async (e) => {
        e.preventDefault();
        const query = e.target.destination.value;
        if (!query) return;

        try {
            const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}`);
            const data = await res.json();
            if (data.length > 0) {
                const dest = { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };

                if (routingControlRef.current) {
                    mapRef.current.removeControl(routingControlRef.current);
                }

                routingControlRef.current = L.Routing.control({
                    waypoints: [
                        L.latLng(currentPosition.lat, currentPosition.lng),
                        L.latLng(dest.lat, dest.lng)
                    ],
                    routeWhileDragging: true,
                    lineOptions: {
                        styles: [{ color: 'var(--brand-primary)', weight: 6 }]
                    }
                }).addTo(mapRef.current);
            }
        } catch (err) {
            console.error('Search failed:', err);
        }
    };

    return (
        <div className="routing-container">
            <form onSubmit={handleSearch} className="map-search-bar">
                <input name="destination" placeholder="Enter destination for safe route..." className="input-field" />
                <button type="submit" className="btn btn-primary">Get Route</button>
            </form>
            <div id="map" style={{ height: '400px', width: '100%', borderRadius: '12px', marginTop: '1rem' }}></div>
            <style jsx>{`
                .routing-container {
                    margin-bottom: 2rem;
                }
                .map-search-bar {
                    display: flex;
                    gap: 10px;
                    margin-bottom: 10px;
                }
            `}</style>
        </div>
    );
}
