import React from 'react';
import { Inbox } from 'lucide-react';

export default function EmptyState({ icon: Icon = Inbox, title = 'No records found', description = 'There are no active records in this category.', actionLabel, onAction }) {
  return (
    <div className="empty-state">
      <div className="empty-icon">
        <Icon size={24} />
      </div>
      <h4 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.35rem' }}>{title}</h4>
      <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', maxWidth: '360px', marginBottom: onAction ? '1.25rem' : '0' }}>
        {description}
      </p>
      {onAction && actionLabel && (
        <button type="button" className="btn btn-primary btn-sm" onClick={onAction}>
          {actionLabel}
        </button>
      )}
    </div>
  );
}
