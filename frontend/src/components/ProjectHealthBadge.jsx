import React from 'react';
import { ShieldCheck, AlertTriangle, ShieldAlert } from 'lucide-react';

export default function ProjectHealthBadge({ health, progress = 0, budgetUtilization = 0 }) {
  let status = health;

  if (!status) {
    if (progress < 40 && budgetUtilization > 70) {
      status = 'red';
    } else if (progress < 60 || budgetUtilization > 85) {
      status = 'amber';
    } else {
      status = 'green';
    }
  }

  const s = status.toLowerCase();

  if (s === 'red' || s === 'critical' || s === 'high risk') {
    return (
      <span className="health-badge health-red">
        <ShieldAlert size={14} /> HIGH RISK
      </span>
    );
  }

  if (s === 'amber' || s === 'warning' || s === 'at risk') {
    return (
      <span className="health-badge health-amber">
        <AlertTriangle size={14} /> NEEDS ATTENTION
      </span>
    );
  }

  return (
    <span className="health-badge health-green">
      <ShieldCheck size={14} /> ON TRACK
    </span>
  );
}
