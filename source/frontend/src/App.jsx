import { useState, useEffect } from 'react'
import { useNormalizedData } from './hooks/NormalizedDataHook'

function App() {
    const { latest, history } = useNormalizedData();

    return (
        <div className="dashboard">
            <h1>Mission Control</h1>

            <div className="grid">
                {/* Iterate through the 'latest' map to show all sensors */}
                {Object.values(latest).map((data) => (
                    <div key={`${data.id}-${data.metric}`} className={`card ${data.status}`}>
                        <h3>{data.source} - {data.metric}</h3>
                        <p className="value">
                            {data.value} <span className="unit">{data.unit}</span>
                        </p>
                        <span className="status-badge">{data.status}</span>
                    </div>
                ))}
            </div>

            {/* Example: If you have no data yet */}
            {Object.keys(latest).length === 0 && (
                <p>Connecting to telemetry stream...</p>
            )}
        </div>
    );
}

export default App
