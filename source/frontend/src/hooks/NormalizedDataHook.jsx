import { useState, useEffect, useRef } from 'react';

export function useNormalizedData() {
    const [latest, setLatest] = useState({});
    const [history, setHistory] = useState({});

    useEffect(() => {
        const socket = new WebSocket(`ws://${window.location.host}/ws/dashboard`);

        socket.onmessage = (event) => {
            const data = JSON.parse(event.data);
            const key = `${data.id}_${data.metric}`;

            setLatest(prev => ({
                ...prev,
                [key]: data
            }));

            setHistory(prev => {
                const currentSeries = prev[key] || [];
                const updatedSeries = [...currentSeries, { x: data.timestamp, y: data.value }];

                return {
                    ...prev,
                    [key]: updatedSeries.slice(-50) // Keep the buffer lean
                };
            });
        };

        return () => socket.close();
    }, []);

    return { latest, history };
}