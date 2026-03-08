import { useState, useEffect, useCallback } from 'react';

const HEALTH_CHECK_INTERVAL = 5000; // Check every 5 seconds

export function useHealth() {
    const [isHealthy, setIsHealthy] = useState(true);
    const [isLoading, setIsLoading] = useState(true);

    const checkHealth = useCallback(async () => {
        try {
            const response = await fetch('http://localhost:8080/health');
            const data = await response.json();
            setIsHealthy(data.status === 'ok');
        } catch (error) {
            setIsHealthy(false);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        checkHealth();
        const interval = setInterval(checkHealth, HEALTH_CHECK_INTERVAL);
        return () => clearInterval(interval);
    }, [checkHealth]);

    return {
        isHealthy,
        isLoading
    };
}
