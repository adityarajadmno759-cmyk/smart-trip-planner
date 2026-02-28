'use client';
import { useState, useEffect } from 'react';
import axios from 'axios';

export default function PollutionExposure({ lat, lng }) {
    const [aqData, setAqData] = useState(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (lat && lng) {
            fetchPollutionData();
        }
    }, [lat, lng]);

    const fetchPollutionData = async () => {
        setLoading(true);
        try {
            // OpenAQ API
            const response = await axios.get(`https://api.openaq.org/v2/latest?coordinates=${lat},${lng}&radius=10000&limit=1`);
            const results = response.data.results?.[0];
            if (results) {
                setAqData(results);
            } else {
                setAqData({ no_data: true });
            }
        } catch (err) {
            console.error('OpenAQ fetch failed:', err);
            setAqData({ error: true });
        } finally {
            setLoading(false);
        }
    };

    if (loading) return <div>Loading pollution data...</div>;
    if (!aqData) return null;

    if (aqData.error) return <div className="aq-card error">Unable to load air quality data.</div>;
    if (aqData.no_data) return <div className="aq-card">No air quality data available for this area.</div>;

    return (
        <div className="aq-card">
            <h4>🌬️ Pollution Exposure</h4>
            <div className="aq-grid">
                {aqData.measurements.map((m, i) => (
                    <div key={i} className="aq-item">
                        <span className="aq-label">{m.parameter.toUpperCase()}</span>
                        <span className="aq-value">{m.value.toFixed(1)} {m.unit}</span>
                    </div>
                ))}
            </div>
            <p className="aq-source">Source: OpenAQ Station ({aqData.location})</p>
            <style jsx>{`
                .aq-card {
                    background: var(--bg-secondary, #f8f9fa);
                    padding: 1rem;
                    border-radius: 12px;
                    border: 1px solid var(--border-color, #eee);
                    margin-top: 1rem;
                }
                .aq-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
                    gap: 10px;
                    margin-top: 10px;
                }
                .aq-item {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    background: white;
                    padding: 8px;
                    border-radius: 8px;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.05);
                }
                .aq-label {
                    font-size: 10px;
                    color: #666;
                    font-weight: bold;
                }
                .aq-value {
                    font-size: 14px;
                    font-weight: 600;
                    color: var(--brand-primary);
                }
                .aq-source {
                    font-size: 10px;
                    color: #888;
                    margin-top: 10px;
                    text-align: right;
                }
            `}</style>
        </div>
    );
}
