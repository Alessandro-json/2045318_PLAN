import { useState, useEffect, useMemo, useCallback } from 'react'
import { useNormalizedData } from './hooks/NormalizedDataHook'

function App() {
    const { latest, history, updateRate, setUpdateRate } = useNormalizedData();
    const [expandedGraphs, setExpandedGraphs] = useState({});
    const [showSettings, setShowSettings] = useState(false);
    const [activeTab, setActiveTab] = useState('sensors');

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

    const formatUnit = (unit) => {
        const unitMap = {
            'ug_m3': 'μg/m³',
            'mg_m3': 'mg/m³',
            'ppm': 'ppm',
            'C': '°C',
            'F': '°F',
            'K': 'K',
            'Pa': 'Pa',
            'kPa': 'kPa',
            'W': 'W',
            'kW': 'kW',
            'A': 'A',
            'V': 'V',
            '%': '%',
            'L_min': 'L/min',
            'kg_s': 'kg/s',
            'm_s': 'm/s',
            'rpm': 'rpm'
        };
        return unitMap[unit] || unit;
    };

    const formatName = (name) => {
        return name.replace(/_/g, ' ');
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
                            <span className="title-line-1">SPACEY</span>
                            <span className="title-line-2">MONITORING SYSTEM</span>
                        </h1>
                    </div>

                    {/* Row 3: Subtitle + Status */}
                    <div className="header-row-3">
                        <div className="subtitle">Real-time Habitat Environmental Control & Life Support. Please don't die.</div>
                        <div className="system-status">
                            <div className="status-indicator status-warning"></div>
                            <span className="status-text">SYSTEM DEGRADED</span>
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
                        <span className="tab-count">0</span>
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
                        <div className="actuators-placeholder">
                            <div className="placeholder-content">
                                <p className="placeholder-text">⚠ ACTUATOR INTERFACE OFFLINE</p>
                                <p className="placeholder-subtext">Awaiting automation system initialization</p>
                            </div>
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
                        <span className="status-indicator status-standby"></span>
                        <span>STANDBY</span>
                    </div>
                </div>
                <div className="rule-manager-content">
                    <div className="placeholder-message">
                        <div className="placeholder-icon">⚙</div>
                        <p>RULE COMPILER</p>
                        <p className="placeholder-subtitle">System pending initialization</p>
                        <div className="system-notice">
                            <p>⚠ AUTOMATION CORE OFFLINE</p>
                            <p className="notice-detail">Manual control required</p>
                        </div>
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
