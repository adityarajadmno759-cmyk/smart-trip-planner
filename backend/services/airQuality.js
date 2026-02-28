const axios = require('axios');

/**
 * Get current air quality for a location
 * Uses OpenAQ API as the primary source
 */
const getAirQuality = async (lat, lng) => {
    try {
        const openAQResponse = await axios.get(
            `https://api.openaq.org/v2/latest?coordinates=${lat},${lng}&radius=10000&limit=1&order_by=distance`,
            { timeout: 8000 }
        );

        const results = openAQResponse.data.results?.[0];
        if (results) {
            const pm25 = results.measurements?.find((m) => m.parameter === 'pm25');
            const pm10 = results.measurements?.find((m) => m.parameter === 'pm10');
            const no2 = results.measurements?.find((m) => m.parameter === 'no2');

            // Calculate a rough AQI (simplified)
            const baseValue = (pm25?.value || pm10?.value || 20);
            const aqi = Math.round(baseValue * 4.2);

            return {
                aqi,
                category: aqi <= 50 ? 'Good' : aqi <= 100 ? 'Moderate' : aqi <= 150 ? 'Unhealthy for Sensitive Groups' : 'Unhealthy',
                dominantPollutant: pm25 ? 'PM2.5' : pm10 ? 'PM10' : 'Unknown',
                source: 'OpenAQ',
                measurements: results.measurements
            };
        }

        throw new Error('No OpenAQ data found');
    } catch (error) {
        console.error('Air quality fetch failed:', error.message);
        // Final fallback
        return {
            aqi: 75,
            category: 'Moderate',
            dominantPollutant: 'N/A',
            source: 'estimated',
        };
    }
};

/**
 * Estimate pollution exposure for a route
 */
const estimateRoutePollution = async (originLat, originLng, destLat, destLng) => {
    const midLat = (parseFloat(originLat) + parseFloat(destLat)) / 2;
    const midLng = (parseFloat(originLng) + parseFloat(destLng)) / 2;

    const [originAQ, midAQ, destAQ] = await Promise.allSettled([
        getAirQuality(originLat, originLng),
        getAirQuality(midLat, midLng),
        getAirQuality(destLat, destLng),
    ]);

    const points = [originAQ, midAQ, destAQ]
        .filter((r) => r.status === 'fulfilled')
        .map((r) => r.value);

    const avgAqi = Math.round(points.reduce((sum, p) => sum + p.aqi, 0) / (points.length || 1));
    const category =
        avgAqi <= 50 ? 'Good'
            : avgAqi <= 100 ? 'Moderate'
                : avgAqi <= 150 ? 'Unhealthy for Sensitive Groups'
                    : avgAqi <= 200 ? 'Unhealthy'
                        : 'Very Unhealthy';

    return {
        averageAqi: avgAqi,
        category,
        points: points.map((p, i) => ({
            label: i === 0 ? 'Origin' : i === 1 ? 'Midpoint' : 'Destination',
            ...p
        }))
    };
};

module.exports = { getAirQuality, estimateRoutePollution };
