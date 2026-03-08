import { useState, useMemo, useCallback } from 'react'
import { useNormalizedData } from './hooks/NormalizedDataHook'
import { useRules } from './hooks/RulesHook'
import { useActuators } from './hooks/ActuatorsHook';
import { useHealth } from './hooks/HealthHook';

const DEFAULT_RULE_FORM = {
    name: '',
    sensor_id: '',
    sensor_metric: '',
    condition: '>',
    threshold: '',
    actuator_id: '',
    action: 'ON'
};

function App() {
    const { latest, history, updateRate, setUpdateRate } = useNormalizedData();
    const {
        rules,
        isLoading: rulesLoading,
        isMutating: rulesMutating,
        error: rulesError,
        createRule,
        updateRule,
        deleteRule,
        deleteAllRules,
        enableAllRules,
        disableAllRules,
        toggleRule
    } = useRules();
    const { isHealthy } = useHealth();
    const [expandedGraphs, setExpandedGraphs] = useState({});
    const [showSettings, setShowSettings] = useState(false);
    const [activeTab, setActiveTab] = useState('sensors');
    const [ruleForm, setRuleForm] = useState(DEFAULT_RULE_FORM);
    const [editingRuleId, setEditingRuleId] = useState(null);
    const [ruleFormError, setRuleFormError] = useState('');
    const {
        actuators,
        isLoading: actuatorsLoading,
        isMutating: actuatorsMutating,
        error: actuatorsError,
        activateActuator
    } = useActuators();

    const getStatusIcon = (source, metric, status) => {
        const lowerSource = source.toLowerCase();
        const lowerMetric = metric.toLowerCase();

        // Determine icon based on metric type
        let iconSvg = '';

        if (lowerSource.includes('power') || lowerSource.includes('solar') || lowerMetric.includes('power') || lowerMetric.includes('voltage') || lowerMetric.includes('current')) {
            iconSvg = (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M13 2L3 14h8l-1 8 10-12h-8l1-8z" />
                </svg>
            );
        } else if (lowerMetric.includes('temp') || lowerMetric.includes('thermal') || lowerMetric.includes('heat')) {
            iconSvg = (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M14 14.76V3.5a2.5 2.5 0 0 0-5 0v11.26a4.5 4.5 0 1 0 5 0z" />
                </svg>
            );
        } else if (lowerMetric.includes('pressure') || lowerMetric.includes('flow') || lowerSource.includes('airlock') || lowerSource.includes('corridor')) {
            iconSvg = (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 2v4" />
                    <path d="M12 18v4" />
                    <circle cx="12" cy="12" r="8" />
                    <path d="M12 12l-6 4" />
                    <path d="M12 12h6" />
                </svg>
            );
        } else if (lowerMetric.includes('radiation') || lowerMetric.includes('particle')) {
            iconSvg = (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="3" />
                    <path d="M12 1v6m0 6v6M4.93 4.93l4.24 4.24m5.66 5.66l4.24 4.24M1 12h6m6 0h6M4.93 19.07l4.24-4.24m5.66-5.66l4.24-4.24" />
                </svg>
            );
        } else if (lowerMetric.includes('co2') || lowerMetric.includes('o2') || lowerMetric.includes('air') || lowerSource.includes('life_support') || lowerSource.includes('environment')) {
            iconSvg = (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M3 8c0 3.5 2.5 6 5 8s4.5 4 4.5 4S15 18.5 17.5 16S23 11.5 23 8" />
                    <path d="M1 8c0 3.5 2.5 6 5 8" />
                    <path d="M12.5 4.5c1.5-1.5 4-1.5 5.5 0s1.5 4 0 5.5" />
                </svg>
            );
        } else if (lowerMetric.includes('humidity') || lowerMetric.includes('water') || lowerMetric.includes('moisture')) {
            iconSvg = (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0L12 2.69z" />
                </svg>
            );
        } else {
            // Default sensor icon
            iconSvg = (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" />
                    <circle cx="12" cy="12" r="3" />
                </svg>
            );
        }

        return iconSvg;
    };

    const calculateTrend = useCallback((key) => {
        const data = history[key];
        if (!data || data.length < 2) return { direction: 'stable', percentage: 0 };

        const recent = data.slice(-10);
        const firstValue = recent[0].y;
        const lastValue = recent[recent.length - 1].y;

        if (firstValue === 0) return { direction: 'stable', percentage: 0 };

        const percentChange = ((lastValue - firstValue) / Math.abs(firstValue)) * 100;

        if (Math.abs(percentChange) < 1) {
            return { direction: 'stable', percentage: 0 };
        } else if (percentChange > 0) {
            return { direction: 'up', percentage: percentChange };
        } else {
            return { direction: 'down', percentage: Math.abs(percentChange) };
        }
    }, [history]);

    const getTrendIcon = (direction) => {
        switch (direction) {
            case 'up': return '↗';
            case 'down': return '↘';
            default: return '→';
        }
    };

    const prettifyChemicals = useCallback((value) => (
        String(value || '')
            .replace(/\bco2\b/gi, 'CO₂')
            .replace(/\bo2\b/gi, 'O₂')
    ), []);

    const formatUnit = useCallback((unit) => {
        const normalizedUnit = String(unit || '')
            .trim()
            .replace(/\//g, '_')
            .replace(/\s+/g, '_')
            .toLowerCase();

        const unitMap = {
            ug_m3: 'μg/m³',
            mg_m3: 'mg/m³',
            ppm: 'ppm',
            c: '°C',
            f: '°F',
            k: 'K',
            pa: 'Pa',
            kpa: 'kPa',
            w: 'W',
            kw: 'kW',
            a: 'A',
            v: 'V',
            '%': '%',
            l_min: 'L/min',
            kg_s: 'kg/s',
            m_s: 'm/s',
            rpm: 'rpm',
            usv_h: 'μSv/h',
            uSv_h: 'μSv/h',
            sv_h: 'Sv/h',
            kwh: 'kWh'
        };

        return unitMap[normalizedUnit] || prettifyChemicals(unit);
    }, [prettifyChemicals]);

    const formatName = useCallback((name) => {
        const withoutPrefix = String(name || '')
            .replace(/^mars[\/_-]?telemetry[\/_-]?/i, '')
            .replace(/^telemetry[\/_-]?/i, '');

        const spaced = withoutPrefix
            .replace(/[\/_-]+/g, ' ')
            .replace(/\s+/g, ' ')
            .trim()
            .toLowerCase();

        const titleCase = spaced
            .split(' ')
            .filter(Boolean)
            .map((token) => token.charAt(0).toUpperCase() + token.slice(1))
            .join(' ');

        return prettifyChemicals(titleCase);
    }, [prettifyChemicals]);

    const getActuatorIcon = (actuatorId) => {
        const normalizedId = String(actuatorId || '').toLowerCase();

        if (normalizedId.includes('cooling_fan') || normalizedId.includes('hall_ventilation')) {
            return (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="2.5" />
                    <path d="M12 4c2 0 3 1.2 3 2.7 0 1.7-1.3 2.6-3 2.6" />
                    <path d="M19 12c0 2-1.2 3-2.7 3-1.7 0-2.6-1.3-2.6-3" />
                    <path d="M12 20c-2 0-3-1.2-3-2.7 0-1.7 1.3-2.6 3-2.6" />
                    <path d="M5 12c0-2 1.2-3 2.7-3 1.7 0 2.6 1.3 2.6 3" />
                </svg>
            );
        }

        if (normalizedId.includes('entrance_humidifier')) {
            return (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0L12 2.69z" />
                </svg>
            );
        }

        if (normalizedId.includes('habitat_heater')) {
            return (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M7 21c0-2 1.1-3.2 1.1-4.8 0-1.7-1.1-2.9-1.1-4.8 0-1.7 1.1-2.9 1.1-4.5" />
                    <path d="M12 21c0-2 1.1-3.2 1.1-4.8 0-1.7-1.1-2.9-1.1-4.8 0-1.7 1.1-2.9 1.1-4.5" />
                    <path d="M17 21c0-2 1.1-3.2 1.1-4.8 0-1.7-1.1-2.9-1.1-4.8 0-1.7 1.1-2.9 1.1-4.5" />
                </svg>
            );
        }

        return (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="4" y="9" width="16" height="9" rx="2" />
                <path d="M8 9V6" />
                <path d="M16 9V6" />
                <path d="M12 18v2" />
            </svg>
        );
    };

    const categorizeSensor = (source, metric) => {
        const telemetrySources = ['power', 'environment', 'thermal', 'airlock', 'solar', 'radiation', 'life_support', 'life support', 'primary'];
        const lowerSource = source.toLowerCase();
        const lowerMetric = metric.toLowerCase();

        if (telemetrySources.some(keyword =>
            lowerSource.includes(keyword) || lowerMetric.includes(keyword)
        )) {
            return 'telemetry';
        }
        return 'sensor';
    };

    const { telemetryData, sensorData } = useMemo(() => {
        const telemetry = [];
        const sensors = [];

        Object.values(latest).forEach((data) => {
            const category = categorizeSensor(data.source, data.metric);
            if (category === 'telemetry') {
                telemetry.push(data);
            } else {
                sensors.push(data);
            }
        });

        return { telemetryData: telemetry, sensorData: sensors };
    }, [latest]);

    const sensorSuggestions = useMemo(() => {
        const fromLatest = Object.values(latest)
            .filter((data) => data.id && data.metric)
            .map((data) => ({ id: data.id, metric: data.metric, unit: data.unit || '' }));

        const fromRules = rules
            .filter((rule) => rule.sensor_id && rule.sensor_metric)
            .map((rule) => ({ id: rule.sensor_id, metric: rule.sensor_metric, unit: '' }));

        const uniqueMap = new Map();
        [...fromLatest, ...fromRules].forEach((entry) => {
            const key = `${entry.id}::${entry.metric}`;
            const existing = uniqueMap.get(key);
            if (!existing) {
                uniqueMap.set(key, entry);
            } else if (!existing.unit && entry.unit) {
                uniqueMap.set(key, { ...existing, unit: entry.unit });
            }
        });

        return Array.from(uniqueMap.values()).sort((a, b) => {
            if (a.id === b.id) {
                return a.metric.localeCompare(b.metric);
            }
            return a.id.localeCompare(b.id);
        });
    }, [latest, rules]);

    const actuatorSuggestions = useMemo(() => {
        const ids = rules.map((rule) => rule.actuator_id).filter(Boolean);
        const fromActuators = actuators.map((actuator) => actuator.id).filter(Boolean);
        return Array.from(new Set([...ids, ...fromActuators])).sort();
    }, [rules, actuators]);

    const sensorOptions = useMemo(() => {
        const base = [...sensorSuggestions];
        if (ruleForm.sensor_id && ruleForm.sensor_metric) {
            const exists = base.some((option) => (
                option.id === ruleForm.sensor_id && option.metric === ruleForm.sensor_metric
            ));
            if (!exists) {
                base.unshift({ id: ruleForm.sensor_id, metric: ruleForm.sensor_metric });
            }
        }
        return base;
    }, [sensorSuggestions, ruleForm.sensor_id, ruleForm.sensor_metric]);

    const actuatorOptions = useMemo(() => {
        const base = [...actuatorSuggestions];
        if (ruleForm.actuator_id && !base.includes(ruleForm.actuator_id)) {
            base.unshift(ruleForm.actuator_id);
        }
        return base;
    }, [actuatorSuggestions, ruleForm.actuator_id]);

    const unitBySensorMetric = useMemo(() => {
        const unitMap = new Map();
        Object.values(latest).forEach((data) => {
            if (data?.id && data?.metric && data?.unit) {
                unitMap.set(`${data.id}::${data.metric}`, data.unit);
            }
        });
        return unitMap;
    }, [latest]);

    const handleSetActuatorState = useCallback(async (actuatorId, state) => {
        try {
            await activateActuator(actuatorId, state);
        } catch {
            // Error state is surfaced by the hook.
        }
    }, [activateActuator]);

    const activeRulesCount = useMemo(
        () => rules.filter((rule) => rule.is_active).length,
        [rules]
    );

    const activeRuleActuators = useMemo(() => {
        const byActuator = new Map();

        rules
            .filter((rule) => rule.is_active)
            .forEach((rule) => {
                const actuatorId = rule.actuator_id;
                if (!actuatorId) {
                    return;
                }

                const list = byActuator.get(actuatorId) || [];
                list.push(rule);
                byActuator.set(actuatorId, list);
            });

        return byActuator;
    }, [rules]);

    const handleRuleFormChange = useCallback((event) => {
        const { name, value } = event.target;
        setRuleForm((previous) => ({ ...previous, [name]: value }));
    }, []);

    const handleSensorSelectionChange = useCallback((event) => {
        const value = event.target.value;
        const [sensorId, sensorMetric] = value.split('::');

        setRuleForm((previous) => ({
            ...previous,
            sensor_id: sensorId || '',
            sensor_metric: sensorMetric || ''
        }));
    }, []);

    const resetRuleEditor = useCallback(() => {
        setEditingRuleId(null);
        setRuleForm(DEFAULT_RULE_FORM);
        setRuleFormError('');
    }, []);

    const handleEditRule = useCallback((rule) => {
        setEditingRuleId(rule.id);
        setRuleForm({
            name: rule.name || '',
            sensor_id: rule.sensor_id,
            sensor_metric: rule.sensor_metric || '',
            condition: rule.condition,
            threshold: String(rule.threshold),
            actuator_id: rule.actuator_id,
            action: (rule.action || 'ON').toUpperCase()
        });
        setRuleFormError('');
    }, []);

    const handleSubmitRule = useCallback(async (event) => {
        event.preventDefault();
        setRuleFormError('');

        const thresholdValue = Number(ruleForm.threshold);
        const payload = {
            name: ruleForm.name.trim(),
            sensor_id: ruleForm.sensor_id.trim(),
            sensor_metric: ruleForm.sensor_metric.trim(),
            condition: ruleForm.condition,
            threshold: thresholdValue,
            actuator_id: ruleForm.actuator_id.trim(),
            action: ruleForm.action
        };

        if (!payload.name || !payload.sensor_id || !payload.sensor_metric || !payload.actuator_id || Number.isNaN(thresholdValue)) {
            setRuleFormError('Please provide rule name, sensor metric, actuator, and a numeric threshold.');
            return;
        }

        try {
            if (editingRuleId) {
                await updateRule(editingRuleId, payload);
            } else {
                await createRule(payload);
            }
            resetRuleEditor();
        } catch (error) {
            setRuleFormError(error instanceof Error ? error.message : 'Failed to save rule');
        }
    }, [ruleForm, editingRuleId, createRule, updateRule, resetRuleEditor]);

    const handleDeleteRule = useCallback(async (ruleId) => {
        try {
            await deleteRule(ruleId);
            if (editingRuleId === ruleId) {
                resetRuleEditor();
            }
        } catch {
            // Error state is surfaced by the hook.
        }
    }, [deleteRule, editingRuleId, resetRuleEditor]);

    const handleToggleRule = useCallback(async (ruleId) => {
        try {
            await toggleRule(ruleId);
        } catch {
            // Error state is surfaced by the hook.
        }
    }, [toggleRule]);

    const handleToggleRuleAction = useCallback(() => {
        setRuleForm((previous) => ({
            ...previous,
            action: previous.action === 'ON' ? 'OFF' : 'ON'
        }));
    }, []);

    const handleDeleteAllRules = useCallback(async () => {
        if (rules.length === 0) {
            return;
        }

        try {
            await deleteAllRules();
            resetRuleEditor();
        } catch {
            // Error state is surfaced by the hook.
        }
    }, [rules.length, deleteAllRules, resetRuleEditor]);

    const handleEnableAllRules = useCallback(async () => {
        if (rules.length === 0) {
            return;
        }

        try {
            await enableAllRules();
        } catch {
            // Error state is surfaced by the hook.
        }
    }, [rules.length, enableAllRules]);

    const handleDisableAllRules = useCallback(async () => {
        if (rules.length === 0) {
            return;
        }

        try {
            await disableAllRules();
        } catch {
            // Error state is surfaced by the hook.
        }
    }, [rules.length, disableAllRules]);

    const toggleGraph = useCallback((key) => {
        setExpandedGraphs(prev => ({
            ...prev,
            [key]: !prev[key]
        }));
    }, []);

    const MiniChart = useCallback(({ data, status, chartId }) => {
        if (!data || data.length < 2) return <div className="mini-chart-empty">No data</div>;

        const values = data.map(d => d.y);
        const min = Math.min(...values);
        const max = Math.max(...values);
        const range = max - min || 1;

        const points = data.map((d, i) => {
            const x = (i / (data.length - 1)) * 100;
            const y = 100 - ((d.y - min) / range) * 100;
            return `${x},${y}`;
        }).join(' ');

        const gradientId = `gradient-${chartId}`;

        return (
            <div className="mini-chart">
                <svg viewBox="0 0 100 100" preserveAspectRatio="none">
                    <defs>
                        <linearGradient id={gradientId} x1="0%" y1="0%" x2="0%" y2="100%">
                            <stop offset="0%" stopColor="currentColor" stopOpacity="0.3" />
                            <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
                        </linearGradient>
                    </defs>
                    <polyline
                        points={points}
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        vectorEffect="non-scaling-stroke"
                    />
                    <polyline
                        points={`0,100 ${points} 100,100`}
                        fill={`url(#${gradientId})`}
                        stroke="none"
                    />
                </svg>
                <div className="chart-stats">
                    <span>Min: {min.toFixed(2)}</span>
                    <span>Max: {max.toFixed(2)}</span>
                    <span>Points: {data.length}</span>
                </div>
            </div>
        );
    }, []);

    const renderDataCard = useCallback((data) => {
        const key = `${data.id}_${data.metric}`;
        const trend = calculateTrend(key);
        const isGraphExpanded = expandedGraphs[key];
        const formattedUnit = formatUnit(data.unit);
        const formattedSource = formatName(data.source);
        const formattedMetric = formatName(data.metric);

        return (
            <div key={key} className={`telemetry-card status-${data.status} ${isGraphExpanded ? 'expanded' : ''}`}>
                <div className="card-header">
                    <span className="status-icon">{getStatusIcon(data.source, data.metric, data.status)}</span>
                    <span className="card-source">{formattedSource}</span>
                </div>
                <div className="card-body">
                    <h3 className="metric-name">{formattedMetric}</h3>
                    <div className="value-row">
                        <p className="metric-value">
                            {data.value} <span className="metric-unit">{formattedUnit}</span>
                        </p>
                        <div className={`trend-indicator trend-${trend.direction}`}>
                            <span className="trend-icon">{getTrendIcon(trend.direction)}</span>
                            {trend.percentage > 0 && (
                                <span className="trend-percent">{trend.percentage.toFixed(1)}%</span>
                            )}
                        </div>
                    </div>
                </div>
                <div className="card-footer">
                    <span className={`status-badge status-badge-${data.status}`}>{data.status}</span>
                    <button
                        className="graph-toggle"
                        onClick={() => toggleGraph(key)}
                        title={isGraphExpanded ? "Hide graph" : "Show graph"}
                    >
                        {isGraphExpanded ? '📉 Hide' : '📊 Show'}
                    </button>
                </div>
                {isGraphExpanded && (
                    <div className="graph-container">
                        <MiniChart data={history[key]} status={data.status} chartId={key} />
                    </div>
                )}
            </div>
        );
    }, [expandedGraphs, history, calculateTrend, toggleGraph, MiniChart]);

    return (
        <div className="app-container">
            <div className="dashboard">
                <header className="dashboard-header">
                    {/* Row 1: Mission Info Bar */}
                    <div className="header-row-1">
                        <div className="mission-id">
                            <div className="mission-icon">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <circle cx="12" cy="12" r="10" />
                                    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                                    <path d="M2 12h20" />
                                </svg>
                            </div>
                            <div className="mission-details">
                                <span className="mission-code">HABITAT α-7</span>
                                <span className="mission-location">OLYMPUS MONS SECTOR</span>
                            </div>
                        </div>
                        <div className="mission-time">
                            <span className="time-label">MARS UTC</span>
                            <span className="time-value">{new Date().toLocaleTimeString('en-US', { hour12: false })}</span>
                        </div>
                    </div>

                    {/* Row 2: Main Title */}
                    <div className="header-row-2">
                        <h1 className="main-title">
                            <span className="title-line-1">PLAN(ET)</span>
                            <span className="title-line-2">MONITORING SYSTEM</span>
                        </h1>
                    </div>

                    {/* Row 3: Subtitle + Status */}
                    <div className="header-row-3">
                        <div className="subtitle">Real-time Habitat Environmental Control & Life Support. Please don't die.</div>
                        <div className={`system-status ${isHealthy ? 'system-status-operational' : 'system-status-degraded'}`}>
                            <div className={`status-indicator ${isHealthy ? 'status-standby' : 'status-warning'}`}></div>
                            <span className="status-text">{isHealthy ? 'SYSTEM OPERATIONAL' : 'SYSTEM DEGRADED'}</span>
                        </div>
                    </div>
                </header>

                {/* Tab Navigation */}
                <div className="tab-navigation">
                    <button
                        className={`tab-button ${activeTab === 'sensors' ? 'active' : ''}`}
                        onClick={() => setActiveTab('sensors')}
                    >
                        <span className="tab-icon">📡</span>
                        <span className="tab-label">SENSORS</span>
                        <span className="tab-count">{sensorData.length}</span>
                    </button>
                    <button
                        className={`tab-button ${activeTab === 'telemetry' ? 'active' : ''}`}
                        onClick={() => setActiveTab('telemetry')}
                    >
                        <span className="tab-icon">⚡</span>
                        <span className="tab-label">TELEMETRY</span>
                        <span className="tab-count">{telemetryData.length}</span>
                    </button>
                    <button
                        className={`tab-button ${activeTab === 'actuators' ? 'active' : ''}`}
                        onClick={() => setActiveTab('actuators')}
                    >
                        <span className="tab-icon">🔧</span>
                        <span className="tab-label">ACTUATORS</span>
                        <span className="tab-count">{actuators.length}</span>
                    </button>
                </div>

                {/* Tab Content */}
                <div className="tab-content">
                    {activeTab === 'telemetry' && (
                        <div className="telemetry-grid">
                            {telemetryData.length > 0 ? (
                                telemetryData.map(renderDataCard)
                            ) : (
                                <div className="loading-state">
                                    <p>⚠ NO TELEMETRY DATA</p>
                                </div>
                            )}
                        </div>
                    )}

                    {activeTab === 'sensors' && (
                        <div className="telemetry-grid">
                            {sensorData.length > 0 ? (
                                sensorData.map(renderDataCard)
                            ) : (
                                <div className="loading-state">
                                    <p>⚠ NO SENSOR DATA</p>
                                </div>
                            )}
                        </div>
                    )}

                    {activeTab === 'actuators' && (
                        <div className="actuators-section">
                            <div className="actuators-toolbar">
                                {actuatorsError && <span className="actuator-error-text">{actuatorsError.message}</span>}
                            </div>

                            {actuatorsLoading ? (
                                <div className="loading-state">
                                    <p>Loading actuators...</p>
                                </div>
                            ) : actuators.length === 0 ? (
                                <div className="actuators-placeholder">
                                    <div className="placeholder-content">
                                        <p className="placeholder-text">NO ACTUATORS AVAILABLE</p>
                                        <p className="placeholder-subtext">The OCI simulator did not return actuator data.</p>
                                    </div>
                                </div>
                            ) : (
                                <div className="actuators-grid">
                                    {actuators.map((actuator) => (
                                        (() => {
                                            const matchingRule = (activeRuleActuators.get(actuator.id) || []).find((rule) => (
                                                String(rule.action || 'ON').toUpperCase() === (actuator.isActive ? 'ON' : 'OFF')
                                            ));

                                            return (
                                                <div
                                                    key={actuator.id}
                                                    className={`actuator-card telemetry-card status-${actuator.isActive ? 'normal' : 'warning'}`}
                                                >
                                                    <div className="actuator-card-header">
                                                        <span className="status-icon">
                                                            {getActuatorIcon(actuator.id)}
                                                        </span>
                                                        <span className="card-source">Actuator</span>
                                                        <button
                                                            className={`actuator-switch ${actuator.isActive ? 'is-on' : 'is-off'}`}
                                                            type="button"
                                                            onClick={() => handleSetActuatorState(actuator.id, actuator.isActive ? 'OFF' : 'ON')}
                                                            disabled={actuatorsMutating}
                                                            aria-label={actuator.isActive ? `Deactivate ${actuator.id}` : `Activate ${actuator.id}`}
                                                            title={actuator.isActive ? 'Turn OFF' : 'Turn ON'}
                                                        >
                                                            <span className="actuator-switch-track">
                                                                <span className="actuator-switch-thumb"></span>
                                                            </span>
                                                        </button>
                                                    </div>

                                                    <div className="card-body actuator-card-body">
                                                        <h3 className="metric-name actuator-name">{formatName(actuator.id)}</h3>
                                                        <p className="metric-value actuator-value">{actuator.isActive ? 'ON' : 'OFF'}</p>
                                                    </div>

                                                    <div className="card-footer actuator-card-footer">
                                                        <span className={`status-badge ${matchingRule ? 'status-badge-critical' : 'status-badge-warning'}`}>
                                                            {matchingRule ? `Rule: ${matchingRule.name || 'Unnamed Rule'}` : 'Manual/Idle'}
                                                        </span>
                                                    </div>
                                                </div>
                                            );
                                        })()
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {Object.keys(latest).length === 0 && (
                    <div className="loading-state">
                        <div className="loading-spinner"></div>
                        <p>ESTABLISHING TELEMETRY LINK...</p>
                    </div>
                )}
            </div>

            <aside className="rule-manager">
                <div className="rule-manager-header">
                    <h2 className="rule-manager-title">AUTOMATION RULES</h2>
                    <div className="rule-status">
                        <span className={`status-indicator ${rulesError ? 'status-warning' : 'status-normal'}`}></span>
                        <span>{rulesError ? 'ERROR' : 'ONLINE'}</span>
                    </div>
                </div>
                <div className="rule-manager-content">
                    <div className="rule-manager-summary">
                        <span>Total: {rules.length}</span>
                        <span>Active: {activeRulesCount}</span>
                        <button
                            className="rule-action-btn rule-refresh-btn"
                            onClick={handleEnableAllRules}
                            disabled={rulesLoading || rulesMutating}
                        >
                            Enable All
                        </button>
                        <button
                            className="rule-action-btn rule-refresh-btn"
                            onClick={handleDisableAllRules}
                            disabled={rulesLoading || rulesMutating}
                        >
                            Disable All
                        </button>
                        <button
                            className="rule-action-btn rule-refresh-btn rule-danger-btn"
                            onClick={handleDeleteAllRules}
                            disabled={rulesLoading || rulesMutating}
                        >
                            Delete All
                        </button>
                    </div>

                    <form className="rule-form" onSubmit={handleSubmitRule}>
                        <label className="rule-field">
                            <span>Rule Name</span>
                            <input
                                type="text"
                                name="name"
                                value={ruleForm.name}
                                onChange={handleRuleFormChange}
                                placeholder="Cool Habitat If Hot"
                                required
                            />
                        </label>

                        <div className="rule-row rule-row-three">
                            <label className="rule-field">
                                <span>Sensor Name</span>
                                <select
                                    name="sensor_id"
                                    value={ruleForm.sensor_id && ruleForm.sensor_metric ? `${ruleForm.sensor_id}::${ruleForm.sensor_metric}` : ''}
                                    onChange={handleSensorSelectionChange}
                                    required
                                >
                                    <option value="" disabled>Select sensor</option>
                                    {sensorOptions.map((sensor) => (
                                        <option key={`${sensor.id}::${sensor.metric}`} value={`${sensor.id}::${sensor.metric}`}>
                                            {formatName(sensor.id)} - {formatName(sensor.metric)}{sensor.unit ? ` (${formatUnit(sensor.unit)})` : ''}
                                        </option>
                                    ))}
                                </select>
                            </label>

                            <label className="rule-field rule-field-operator">
                                <span>Operator</span>
                                <select
                                    name="condition"
                                    value={ruleForm.condition}
                                    onChange={handleRuleFormChange}
                                >
                                    <option value=">">&gt;</option>
                                    <option value=">=">&gt;=</option>
                                    <option value="<">&lt;</option>
                                    <option value="<=">&lt;=</option>
                                    <option value="==">==</option>
                                </select>
                            </label>

                            <label className="rule-field rule-field-threshold">
                                <span>Threshold</span>
                                <input
                                    type="number"
                                    step="any"
                                    name="threshold"
                                    value={ruleForm.threshold}
                                    onChange={handleRuleFormChange}
                                    placeholder="75"
                                    required
                                />
                            </label>
                        </div>

                        <div className="rule-row rule-row-two">
                            <label className="rule-field">
                                <span>Actuator Name</span>
                                <select
                                    name="actuator_id"
                                    value={ruleForm.actuator_id}
                                    onChange={handleRuleFormChange}
                                    required
                                >
                                    <option value="" disabled>Select actuator</option>
                                    {actuatorOptions.map((actuatorId) => (
                                        <option key={actuatorId} value={actuatorId}>{formatName(actuatorId)}</option>
                                    ))}
                                </select>
                            </label>

                            <div className="rule-field rule-field-action-toggle">
                                <span>Action</span>
                                <button
                                    type="button"
                                    className={`rule-form-toggle ${ruleForm.action === 'ON' ? 'is-on' : 'is-off'}`}
                                    onClick={handleToggleRuleAction}
                                    aria-label={`Set rule action to ${ruleForm.action === 'ON' ? 'OFF' : 'ON'}`}
                                >
                                    <span className={`rule-form-toggle-option ${ruleForm.action === 'ON' ? 'is-active' : ''}`}>
                                        ON
                                    </span>
                                    <span className={`rule-form-toggle-option ${ruleForm.action === 'OFF' ? 'is-active' : ''}`}>
                                        OFF
                                    </span>
                                </button>
                            </div>
                        </div>

                        <div className="rule-form-actions rule-form-actions-full">
                            <button className="rule-action-btn rule-submit-btn" type="submit" disabled={rulesMutating}>
                                {editingRuleId ? 'Update Rule' : 'Create Rule'}
                            </button>
                        </div>

                        {ruleFormError && <p className="rule-form-error">{ruleFormError}</p>}
                        {rulesError && !ruleFormError && <p className="rule-form-error">{rulesError.message}</p>}
                    </form>

                    <div className="rules-list">
                        {rulesLoading ? (
                            <p className="rule-list-message">Loading rules...</p>
                        ) : rules.length === 0 ? (
                            <p className="rule-list-message">No rules configured yet.</p>
                        ) : (
                            rules.map((rule) => (
                                (() => {
                                    const unit = unitBySensorMetric.get(`${rule.sensor_id}::${rule.sensor_metric}`);
                                    const thresholdWithUnit = unit
                                        ? `${rule.threshold} ${formatUnit(unit)}`
                                        : `${rule.threshold}`;

                                    return (
                                        <div key={rule.id} className={`rule-item ${rule.is_active ? 'rule-item-active' : 'rule-item-inactive'}`}>
                                            <div className="rule-item-header">
                                                <button
                                                    className={`actuator-switch rule-toggle ${rule.is_active ? 'is-on' : 'is-off'}`}
                                                    type="button"
                                                    onClick={() => handleToggleRule(rule.id)}
                                                    disabled={rulesMutating}
                                                    aria-label={rule.is_active ? `Disable ${rule.name}` : `Enable ${rule.name}`}
                                                    title={rule.is_active ? 'Disable Rule' : 'Enable Rule'}
                                                >
                                                    <span className="actuator-switch-track">
                                                        <span className="actuator-switch-thumb"></span>
                                                    </span>
                                                </button>
                                                <div className="rule-item-actions">
                                                    <button
                                                        className="rule-icon-btn"
                                                        type="button"
                                                        onClick={() => handleEditRule(rule)}
                                                        disabled={rulesMutating}
                                                        aria-label="Edit rule"
                                                        title="Edit rule"
                                                    >
                                                        ✎
                                                    </button>
                                                    <button
                                                        className="rule-icon-btn rule-delete-btn"
                                                        type="button"
                                                        onClick={() => handleDeleteRule(rule.id)}
                                                        disabled={rulesMutating}
                                                        aria-label="Delete rule"
                                                        title="Delete rule"
                                                    >
                                                        ✕
                                                    </button>
                                                </div>
                                            </div>
                                            <div className="rule-item-main">
                                                <div className="rule-name">{rule.name || 'Unnamed Rule'}</div>
                                                <div className="rule-condition">
                                                    Condition: {formatName(rule.sensor_id)} ({formatName(rule.sensor_metric || 'any')}) {rule.condition} {thresholdWithUnit}
                                                </div>
                                                <div className="rule-action">
                                                    Action: {formatName(rule.actuator_id)} → {(rule.action || 'ON').toUpperCase()}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })()
                            ))
                        )}
                    </div>
                </div>
            </aside>

            {/* Floating Settings Button */}
            <button
                className="floating-settings-btn"
                onClick={() => setShowSettings(!showSettings)}
                title="Configure update rate"
            >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="3" />
                    <path d="M10.2 3.2a2 2 0 0 1 3.6 0l.5 1.2a2 2 0 0 0 2.4 1.1l1.2-.4a2 2 0 0 1 2.5 2.5l-.4 1.2a2 2 0 0 0 1.1 2.4l1.2.5a2 2 0 0 1 0 3.6l-1.2.5a2 2 0 0 0-1.1 2.4l.4 1.2a2 2 0 0 1-2.5 2.5l-1.2-.4a2 2 0 0 0-2.4 1.1l-.5 1.2a2 2 0 0 1-3.6 0l-.5-1.2a2 2 0 0 0-2.4-1.1l-1.2.4a2 2 0 0 1-2.5-2.5l.4-1.2a2 2 0 0 0-1.1-2.4l-1.2-.5a2 2 0 0 1 0-3.6l1.2-.5a2 2 0 0 0 1.1-2.4l-.4-1.2a2 2 0 0 1 2.5-2.5l1.2.4a2 2 0 0 0 2.4-1.1l.5-1.2z" />
                </svg>
            </button>

            {/* Floating Settings Panel */}
            {showSettings && (
                <div className="floating-settings-panel">
                    <div className="floating-panel-header">
                        <span className="panel-title">SYSTEM CONFIG</span>
                        <button className="panel-close" onClick={() => setShowSettings(false)}>✕</button>
                    </div>
                    <label htmlFor="update-rate" className="slider-control">
                        <div className="setting-header">
                            <span className="setting-label">UPDATE THROTTLE:</span>
                            <span className="setting-value">{updateRate} ms</span>
                        </div>
                        <input
                            id="update-rate"
                            type="range"
                            min="100"
                            max="5000"
                            step="100"
                            value={updateRate}
                            onChange={(e) => setUpdateRate(Number(e.target.value))}
                            className="update-slider"
                        />
                        <span className="setting-hint">Lower = faster updates, higher CPU usage</span>
                    </label>
                </div>
            )}
        </div>
    );
}

export default App
