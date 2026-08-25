import React from 'react';

export default function StockBar({ current = 0, minimum = 0, required = 0, label }) {
  const target = required > 0 ? required : (minimum > 0 ? minimum * 2 : 100);
  const pct = Math.min(100, Math.max(0, Math.round((current / target) * 100)));

  let color = '#10b981'; // Green
  let statusText = 'IN STOCK';

  if (current === 0) {
    color = '#f43f5e'; // Red
    statusText = 'OUT OF STOCK';
  } else if (minimum > 0 && current <= minimum) {
    color = '#f59e0b'; // Amber
    statusText = 'LOW STOCK';
  }

  return (
    <div style={{ width: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem', fontSize: '0.78rem' }}>
        <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>{label || 'Stock Level'}</span>
        <span className={`tag-badge ${current === 0 ? 'tag-danger' : current <= minimum ? 'tag-warning' : 'tag-success'}`} style={{ fontSize: '0.68rem', padding: '0.1rem 0.4rem' }}>
          {statusText} ({pct}%)
        </span>
      </div>
      <div className="stock-bar-container">
        <div
          className="stock-bar-fill"
          style={{
            width: `${pct}%`,
            background: color
          }}
        />
      </div>
    </div>
  );
}
