import { useState, useEffect, useRef, useCallback } from 'react';

// Configurable update throttle (in milliseconds)
const UPDATE_THROTTLE_MS = 500; // Update UI every 500ms instead of every message
const MAX_HISTORY_POINTS = 50; // Maximum points to keep in history

export function useNormalizedData() {
    const [latest, setLatest] = useState({});
    const [history, setHistory] = useState({});
    const [updateRate, setUpdateRate] = useState(UPDATE_THROTTLE_MS);

    // Use refs to accumulate data without triggering re-renders
    const latestBufferRef = useRef({});
    const historyBufferRef = useRef({});
    const historyStateRef = useRef({});
    const throttleTimerRef = useRef(null);
    const updateRateRef = useRef(updateRate);

    // Flush accumulated data to state (throttled)
    const flushUpdates = useCallback(() => {
        if (Object.keys(latestBufferRef.current).length > 0) {
            setLatest({ ...latestBufferRef.current });
            setHistory({ ...historyBufferRef.current });
        }
    }, []);

    // Keep updateRate ref in sync
    useEffect(() => {
        updateRateRef.current = updateRate;
        // If there's a pending timer and rate changed, clear it and reschedule
        if (throttleTimerRef.current) {
            console.log('Update rate changed to', updateRate, 'ms - rescheduling');
            clearTimeout(throttleTimerRef.current);
            throttleTimerRef.current = setTimeout(() => {
                flushUpdates();
                throttleTimerRef.current = null;
            }, updateRate);
        }
    }, [updateRate, flushUpdates]);

    // Keep history state ref in sync
    useEffect(() => {
        historyStateRef.current = history;
    }, [history]);

    useEffect(() => {
        console.log('WebSocket connecting...');
        const socket = new WebSocket(`ws://${window.location.host}/ws/dashboard`);

        socket.onopen = () => {
            console.log('WebSocket connected successfully');
        };

        socket.onerror = (error) => {
            console.error('WebSocket error:', error);
        };

        socket.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                const key = `${data.id}_${data.metric}`;

                console.log('Received data:', key, data.value);

                // Accumulate in buffer instead of immediate state update
                latestBufferRef.current = {
                    ...latestBufferRef.current,
                    [key]: data
                };

                // Update history buffer
                const currentSeries = historyBufferRef.current[key] || historyStateRef.current[key] || [];
                const newPoint = { x: data.timestamp, y: data.value };

                // Only add if value changed or enough time passed
                const lastPoint = currentSeries[currentSeries.length - 1];
                if (!lastPoint || lastPoint.y !== newPoint.y ||
                    (newPoint.x - lastPoint.x) > 1000) {
                    const updatedSeries = [...currentSeries, newPoint].slice(-MAX_HISTORY_POINTS);

                    historyBufferRef.current = {
                        ...historyBufferRef.current,
                        [key]: updatedSeries
                    };
                }

                // Throttle UI updates
                if (!throttleTimerRef.current) {
                    console.log('Scheduling update in', updateRateRef.current, 'ms');
                    throttleTimerRef.current = setTimeout(() => {
                        console.log('Flushing updates to state');
                        flushUpdates();
                        throttleTimerRef.current = null;
                    }, updateRateRef.current);
                }
            } catch (error) {
                console.error('Error processing message:', error);
            }
        };

        socket.onclose = () => {
            console.log('WebSocket connection closed');
            // Clear any pending updates
            if (throttleTimerRef.current) {
                clearTimeout(throttleTimerRef.current);
                throttleTimerRef.current = null;
            }
        };

        // Cleanup on unmount
        return () => {
            if (throttleTimerRef.current) {
                clearTimeout(throttleTimerRef.current);
            }
            socket.close();
        };
        // WebSocket only created once on mount
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return { latest, history, updateRate, setUpdateRate };
}