import { useCallback, useEffect, useState } from 'react';

const ACTUATORS_API_BASE = (import.meta.env.VITE_ACTUATORS_API_URL || '/api/actuators').replace(/\/$/, '');
const ACTUATOR_ACTIVATE_STATE = (import.meta.env.VITE_ACTUATOR_ACTIVATE_STATE || 'ON').toUpperCase();

function normalizeActuator(item, fallbackId) {
    if (item == null) {
        return null;
    }

    if (typeof item === 'string') {
        return {
            id: item,
            state: 'unknown',
            isActive: false,
            raw: item
        };
    }

    if (typeof item !== 'object') {
        return null;
    }

    const id = item.id || item.actuator_id || item.name || fallbackId;
    if (!id) {
        return null;
    }

    const state = item.state ?? item.status ?? item.current_state ?? item.value ?? 'unknown';
    const normalizedState = String(state).toLowerCase();

    return {
        id: String(id),
        state: String(state),
        isActive: ['on', 'active', 'enabled', 'open', 'true', '1'].includes(normalizedState),
        raw: item
    };
}

function normalizeActuators(payload) {
    if (Array.isArray(payload)) {
        return payload
            .map((item) => normalizeActuator(item))
            .filter(Boolean);
    }

    if (payload && payload.actuators && typeof payload.actuators === 'object' && !Array.isArray(payload.actuators)) {
        return Object.entries(payload.actuators)
            .map(([id, state]) => normalizeActuator({ id, state }, id))
            .filter(Boolean);
    }

    if (payload && Array.isArray(payload.actuators)) {
        return payload.actuators
            .map((item) => normalizeActuator(item))
            .filter(Boolean);
    }

    if (payload && typeof payload === 'object') {
        return Object.entries(payload)
            .map(([id, value]) => {
                if (typeof value === 'object' && value !== null) {
                    return normalizeActuator({ id, ...value }, id);
                }

                return normalizeActuator({ id, state: value }, id);
            })
            .filter(Boolean);
    }

    return [];
}

export function useActuators() {
    const [actuators, setActuators] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isMutating, setIsMutating] = useState(false);
    const [error, setError] = useState(null);

    const fetchActuators = useCallback(async () => {
        setError(null);
        setIsLoading(true);
        try {
            const response = await fetch(ACTUATORS_API_BASE);
            if (!response.ok) {
                throw new Error(`Failed to fetch actuators (${response.status})`);
            }

            const payload = await response.json();
            setActuators(normalizeActuators(payload));
        } catch (err) {
            setError(err instanceof Error ? err : new Error('Failed to fetch actuators'));
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchActuators();
    }, [fetchActuators]);

    const activateActuator = useCallback(async (actuatorId, state = ACTUATOR_ACTIVATE_STATE) => {
        setError(null);
        setIsMutating(true);

        try {
            const response = await fetch(`${ACTUATORS_API_BASE}/${encodeURIComponent(actuatorId)}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ state })
            });

            if (!response.ok) {
                throw new Error(`Failed to activate actuator ${actuatorId} (${response.status})`);
            }

            await fetchActuators();
        } catch (err) {
            const typedError = err instanceof Error ? err : new Error('Failed to activate actuator');
            setError(typedError);
            throw typedError;
        } finally {
            setIsMutating(false);
        }
    }, [fetchActuators]);

    return {
        actuators,
        isLoading,
        isMutating,
        error,
        fetchActuators,
        activateActuator
    };
}
