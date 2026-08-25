import React from 'react';

export default function KpiCard({ title, value, subtext, icon: Icon, color = '#6366f1', trend }) {
  return (
    <div className="kpi-card">
      <div>
        <div className="kpi-title">{title}</div>
        <div className="kpi-value">{value}</div>
        {subtext && <div className="kpi-subtext">{subtext}</div>}
        {trend && (
          <div style={{ fontSize: '0.75rem', fontWeight: 600, marginTop: '0.35rem', color: trend.startsWith('+') || trend.includes('up') ? '#34d399' : '#f87171' }}>
            {trend}
          </div>
        )}
      </div>
      {Icon && (
        <div
          className="kpi-icon-box"
          style={{
            background: `${color}18`,
            color: color,
            border: `1px solid ${color}33`
          }}
        >
          <Icon size={22} />
        </div>
      )}
    </div>
  );
}
