import React from 'react';

export default function KpiCard({ title, value, icon: Icon, color, trend }) {
  return (
    <div className="glass-card kpi-card">
      <div>
        <div className="kpi-title">{title}</div>
        <div className="kpi-value">{value}</div>
        {trend && (
          <div style={{ fontSize: '0.75rem', color: '#10b981', marginTop: '0.25rem', fontWeight: 500 }}>
            {trend}
          </div>
        )}
      </div>
      <div className="kpi-icon" style={{ background: `${color}20`, color: color }}>
        <Icon size={24} />
      </div>
    </div>
  );
}
