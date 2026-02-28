'use client';
import { useEffect, useRef, useState, useCallback } from 'react';

/**
 * PlannerMap - OpenStreetMap + Leaflet + OSRM routing + OpenAQ pollution
 * Drop-in replacement for Google Maps in the planner page.
 */
export default function PlannerMap({ origin, destination, onRouteFound }) {
    const mapRef = useRef(null);
    const leafletMapRef = useRef(null);
    const routingControlRef = useRef(null);

    useEffect(() => {
        if (typeof window === 'undefined') return;

        if (!document.getElementById('leaflet-css')) {
            const link = document.createElement('link');
            link.id = 'leaflet-css';
            link.rel = 'stylesheet';
            link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
            document.head.appendChild(link);
        }
        if (!document.getElementById('lrm-css')) {
            const link = document.createElement('link');
            link.id = 'lrm-css';
            link.rel = 'stylesheet';
            link.href = 'https://unpkg.com/leaflet-routing-machine@3.2.12/dist/leaflet-routing-machine.css';
            document.head.appendChild(link);
        }

        import('leaflet').then((L) => {
            if (!mapRef.current || leafletMapRef.current) return;

            delete L.default.Icon.Default.prototype._getIconUrl;
            L.default.Icon.Default.mergeOptions({
                iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
                iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
                shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
            });

            const map = L.default.map(mapRef.current).setView([20.5937, 78.9629], 5);
            L.default.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
                maxZoom: 19,
            }).addTo(map);
            leafletMapRef.current = map;

            // Inject dark theme CSS for LRM directions panel
            if (!document.getElementById('lrm-dark-css')) {
                const style = document.createElement('style');
                style.id = 'lrm-dark-css';
                style.textContent = `
                    .leaflet-routing-container {
                        background: #1a1b2e !important;
                        border: 1px solid rgba(255,255,255,0.1) !important;
                        border-radius: 10px !important;
                        box-shadow: 0 4px 20px rgba(0,0,0,0.4) !important;
                        max-height: 260px;
                        overflow-y: auto;
                    }
                    .leaflet-routing-container h2,
                    .leaflet-routing-container h3,
                    .leaflet-routing-container td,
                    .leaflet-routing-container th,
                    .leaflet-routing-container span,
                    .leaflet-routing-container div {
                        color: #e2e8f0 !important;
                        font-size: 12px !important;
                    }
                    .leaflet-routing-container tr:hover td {
                        background: rgba(255,255,255,0.07) !important;
                    }
                    .leaflet-routing-container table {
                        background: transparent !important;
                    }
                    .leaflet-routing-alt {
                        background: #252640 !important;
                    }
                    .leaflet-routing-alt h3 {
                        background: #2a2b45 !important;
                        border-bottom: 1px solid rgba(255,255,255,0.1) !important;
                        padding: 8px 12px !important;
                        font-size: 13px !important;
                        font-weight: 700 !important;
                        color: #a78bfa !important;
                    }
                    .leaflet-routing-collapse-btn { color: #a78bfa !important; }
                `;
                document.head.appendChild(style);
            }
        });

        return () => {
            if (leafletMapRef.current) {
                leafletMapRef.current.remove();
                leafletMapRef.current = null;
                routingControlRef.current = null;
            }
        };
    }, []);

    useEffect(() => {
        if (!origin || !destination || !leafletMapRef.current) return;

        import('leaflet').then(async (L) => {
            const LRM = await import('leaflet-routing-machine');
            const map = leafletMapRef.current;
            if (!map) return;

            if (routingControlRef.current) {
                try { map.removeControl(routingControlRef.current); } catch (_) { }
                routingControlRef.current = null;
            }

            const ctrl = L.default.Routing.control({
                waypoints: [
                    L.default.latLng(origin.lat, origin.lng),
                    L.default.latLng(destination.lat, destination.lng),
                ],
                routeWhileDragging: true,
                lineOptions: {
                    styles: [{ color: '#111827', weight: 6, opacity: 1 }],
                    extendToWaypoints: true,
                    missingRouteTolerance: 0,
                },
                createMarker: (i, wp) => {
                    return L.default.marker(wp.latLng).bindPopup(i === 0 ? '📍 Origin' : '🏁 Destination');
                },
                addWaypoints: false,
                draggableWaypoints: false,
                fitSelectedRoutes: true,
                showAlternatives: true,
                altLineOptions: {
                    styles: [{ color: '#555', weight: 4, opacity: 0.5, dashArray: '8 6' }],
                },
            });

            ctrl.on('routesfound', (e) => {
                const route = e.routes[0];
                if (onRouteFound && route) {
                    onRouteFound({
                        distance: { text: `${(route.summary.totalDistance / 1000).toFixed(1)} km`, value: route.summary.totalDistance },
                        duration: { text: `${Math.round(route.summary.totalTime / 60)} mins`, value: route.summary.totalTime },
                    });
                }
            });

            ctrl.addTo(map);
            routingControlRef.current = ctrl;
        });
    }, [origin, destination]);

    return (
        <div
            ref={mapRef}
            style={{ height: '450px', width: '100%', borderRadius: '12px', zIndex: 0 }}
        />
    );
}
