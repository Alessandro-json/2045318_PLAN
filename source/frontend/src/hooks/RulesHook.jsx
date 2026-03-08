import { useCallback, useEffect, useState } from 'react';

const RULES_API_BASE = (import.meta.env.VITE_RULES_API_URL || '/api/rules').replace(/\/$/, '');

async function parseResponse(response) {
    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
        return null;
    }

    try {
        return await response.json();
    } catch {
        return null;
    }
}

function toErrorMessage(response, payload) {
    if (payload && typeof payload === 'object' && payload.detail) {
        return payload.detail;
    }
    return `Request failed with status ${response.status}`;
}

async function request(path = '', options = {}) {
    const response = await fetch(`${RULES_API_BASE}${path}`, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            ...(options.headers || {})
        }
    });

    const payload = await parseResponse(response);
    if (!response.ok) {
        throw new Error(toErrorMessage(response, payload));
    }

    return payload;
}

export function useRules() {
    const [rules, setRules] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isMutating, setIsMutating] = useState(false);
    const [error, setError] = useState(null);

    const fetchRules = useCallback(async () => {
        setError(null);
        setIsLoading(true);
        try {
            const data = await request();
            setRules(Array.isArray(data) ? data : []);
        } catch (err) {
            setError(err);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchRules();
    }, [fetchRules]);

    const createRule = useCallback(async (ruleData) => {
        setError(null);
        setIsMutating(true);
        try {
            const createdRule = await request('', {
                method: 'POST',
                body: JSON.stringify(ruleData)
            });
            setRules((previous) => [...previous, createdRule]);
            return createdRule;
        } catch (err) {
            setError(err);
            throw err;
        } finally {
            setIsMutating(false);
        }
    }, []);

    const updateRule = useCallback(async (ruleId, ruleData) => {
        setError(null);
        setIsMutating(true);

        try {
            let updatedRule;
            try {
                updatedRule = await request(`/${ruleId}`, {
                    method: 'PUT',
                    body: JSON.stringify(ruleData)
                });
            } catch (putError) {
                // Some deployments expose PATCH instead of PUT for updates.
                updatedRule = await request(`/${ruleId}`, {
                    method: 'PATCH',
                    body: JSON.stringify(ruleData)
                });
                if (!updatedRule && putError instanceof Error) {
                    throw putError;
                }
            }

            setRules((previous) => previous.map((rule) => (
                rule.id === ruleId
                    ? { ...rule, ...ruleData, ...(updatedRule || {}) }
                    : rule
            )));

            return updatedRule;
        } catch (err) {
            setError(err);
            throw err;
        } finally {
            setIsMutating(false);
        }
    }, []);

    const deleteRule = useCallback(async (ruleId) => {
        setError(null);
        setIsMutating(true);
        try {
            await request(`/${ruleId}`, { method: 'DELETE' });
            setRules((previous) => previous.filter((rule) => rule.id !== ruleId));
        } catch (err) {
            setError(err);
            throw err;
        } finally {
            setIsMutating(false);
        }
    }, []);

    const deleteAllRules = useCallback(async () => {
        setError(null);
        setIsMutating(true);
        try {
            await request('', { method: 'DELETE' });
            setRules([]);
        } catch (err) {
            setError(err);
            throw err;
        } finally {
            setIsMutating(false);
        }
    }, []);

    const enableAllRules = useCallback(async () => {
        setError(null);
        setIsMutating(true);
        try {
            await request('/enable-all', { method: 'PATCH' });
            setRules((previous) => previous.map((rule) => ({ ...rule, is_active: true })));
        } catch (err) {
            setError(err);
            throw err;
        } finally {
            setIsMutating(false);
        }
    }, []);

    const disableAllRules = useCallback(async () => {
        setError(null);
        setIsMutating(true);
        try {
            await request('/disable-all', { method: 'PATCH' });
            setRules((previous) => previous.map((rule) => ({ ...rule, is_active: false })));
        } catch (err) {
            setError(err);
            throw err;
        } finally {
            setIsMutating(false);
        }
    }, []);

    const toggleRule = useCallback(async (ruleId) => {
        setError(null);
        setIsMutating(true);
        try {
            const updatedRule = await request(`/${ruleId}/toggle`, { method: 'PATCH' });
            setRules((previous) => previous.map((rule) => (
                rule.id === ruleId
                    ? { ...rule, ...(updatedRule || {}), is_active: updatedRule?.is_active ?? !rule.is_active }
                    : rule
            )));
            return updatedRule;
        } catch (err) {
            setError(err);
            throw err;
        } finally {
            setIsMutating(false);
        }
    }, []);

    return {
        rules,
        isLoading,
        isMutating,
        error,
        fetchRules,
        createRule,
        updateRule,
        deleteRule,
        deleteAllRules,
        enableAllRules,
        disableAllRules,
        toggleRule
    };
}
