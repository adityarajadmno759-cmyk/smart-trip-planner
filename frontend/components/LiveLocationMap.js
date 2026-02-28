'use client';
import { useEffect, useRef } from 'react';

export default function LiveLocationMap({ location, tracking }) {
    const mapRef = useRef(null);
    const leafletMapRef = useRef(null);
    const markerRef = useRef(null);
    const circleRef = useRef(null);

    useEffect(() => {
        if (typeof window === 'undefined') return;

        // Dynamically load Leaflet CSS
        if (!document.getElementById('leaflet-css')) {
            const link = document.createElement('link');
            link.id = 'leaflet-css';
            link.rel = 'stylesheet';
            link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
            document.head.appendChild(link);
        }

        import('leaflet').then((L) => {
            if (!mapRef.current || leafletMapRef.current) return;

            // Fix default icon paths
            delete L.default.Icon.Default.prototype._getIconUrl;
            L.default.Icon.Default.mergeOptions({
                iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
                iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
                shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
            });

            const map = L.default.map(mapRef.current, { zoomControl: true }).setView([20.5937, 78.9629], 5);

            L.default.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
                maxZoom: 19,
            }).addTo(map);

            leafletMapRef.current = map;
        });

        return () => {
            if (leafletMapRef.current) {
                leafletMapRef.current.remove();
                leafletMapRef.current = null;
                markerRef.current = null;
                circleRef.current = null;
            }
        };
    }, []);

    useEffect(() => {
        if (!location || !leafletMapRef.current) return;

        import('leaflet').then((L) => {
            const map = leafletMapRef.current;
            if (!map) return;

            // Remove old marker & circle
            if (markerRef.current) markerRef.current.remove();
            if (circleRef.current) circleRef.current.remove();

            // Animated pulsing live marker
            const pulseIcon = L.default.divIcon({
                className: '',
                html: `
                    <div style="position:relative;width:28px;height:28px;">
                        <div style="
                            position:absolute;inset:0;
                            border-radius:50%;
                            background:rgba(99,102,241,0.3);
                            animation:pulse-ring 1.5s ease-out infinite;
                        "></div>
                        <div style="
                            position:absolute;top:6px;left:6px;
                            width:16px;height:16px;
                            border-radius:50%;
                            background:#6366F1;
                            border:2px solid white;
                            box-shadow:0 0 8px rgba(99,102,241,0.8);
                        "></div>
                    </div>
                    <style>
                        @keyframes pulse-ring {
                            0% { transform:scale(0.5); opacity:1; }
                            100% { transform:scale(2); opacity:0; }
                        }
                    </style>
                `,
                iconSize: [28, 28],
                iconAnchor: [14, 14],
            });

            markerRef.current = L.default.marker([location.lat, location.lng], { icon: pulseIcon })
                .addTo(map)
                .bindPopup(`<b>You are here</b><br>Accuracy: ±${Math.round(location.accuracy)}m`)
                .openPopup();

            // Accuracy circle
            circleRef.current = L.default.circle([location.lat, location.lng], {
                radius: location.accuracy,
                color: '#6366F1',
                fillColor: '#6366F1',
                fillOpacity: 0.1,
                weight: 1,
            }).addTo(map);

            map.setView([location.lat, location.lng], 15);
        });
    }, [location]);

    return (
        <div
            ref={mapRef}
            style={{ height: '350px', width: '100%', borderRadius: '12px', zIndex: 0 }}
        />
    );
}
