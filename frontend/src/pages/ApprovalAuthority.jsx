import React, { useState } from 'react';
import { Sliders, CheckCircle2, ArrowRight, Shield, Save, Plus, AlertTriangle } from 'lucide-react';

const INITIAL_WORKFLOWS = [
  {
    id: 1,
    workflow_name: 'Site Log & WBS Task Approvals',
    stages: [
      { sequence: 1, stage_name: 'Site Engineer', role: 'site_engineer', action: 'Submit Log', threshold: '$0.00' },
      { sequence: 2, stage_name: 'Project Manager', role: 'project_manager', action: 'Stage 1 Verification', threshold: 'All Tasks' },
      { sequence: 3, stage_name: 'Executive Management', role: 'management', action: 'Final Sign-off', threshold: 'All Tasks' }
    ],
    status: 'ACTIVE'
  },
  {
    id: 2,
    workflow_name: 'Contractor Billing & Vendor Payments',
    stages: [
      { sequence: 1, stage_name: 'Procurement Officer', role: 'procurement', action: 'Submit Bill', threshold: '$0.00' },
      { sequence: 2, stage_name: 'Finance & Accounting', role: 'finance', action: 'Stage 2 Audit', threshold: '< $50,000' },
      { sequence: 3, stage_name: 'Executive Management', role: 'management', action: 'Final Approval', threshold: '≥ $50,000' }
    ],
    status: 'ACTIVE'
  },
  {
    id: 3,
    workflow_name: 'Unit Booking & Discount Approvals',
    stages: [
      { sequence: 1, stage_name: 'CRM / Sales Executive', role: 'crm', action: 'Draft Booking', threshold: '$0.00' },
      { sequence: 2, stage_name: 'Finance & Accounting', role: 'finance', action: 'Verify Payment Schedule', threshold: 'Standard Discount' },
      { sequence: 3, stage_name: 'Executive Management', role: 'management', action: 'Special Discount Sign-off', threshold: '> 5% Discount' }
    ],
    status: 'ACTIVE'
  }
];

export default function ApprovalAuthority() {
  const [workflows, setWorkflows] = useState(INITIAL_WORKFLOWS);
  const [selectedWorkflow, setSelectedWorkflow] = useState(INITIAL_WORKFLOWS[0]);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const handleToggleStatus = (wfId) => {
    setWorkflows(prev => prev.map(w => w.id === wfId ? { ...w, status: w.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE' } : w));
    if (selectedWorkflow.id === wfId) {
      setSelectedWorkflow(prev => ({ ...prev, status: prev.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE' }));
    }
  };

  const handleSave = () => {
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  return (
    <div className="content-page">
      {/* Header */}
      <div style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 className="page-title">Approval Authority & Workflow Configuration</h1>
          <p className="page-subtitle">Configure multi-stage approval sequences, role permissions, escalation rules, and financial thresholds</p>
        </div>
        <button className="btn btn-primary" onClick={handleSave}>
          <Save size={16} /> Save Workflow Configuration
        </button>
      </div>

      {saveSuccess && (
        <div style={{ padding: '0.75rem', background: 'rgba(16,185,129,0.15)', border: '1px solid #10b981', borderRadius: '8px', color: '#10b981', fontSize: '0.85rem', marginBottom: '1.25rem' }}>
          ✓ Approval workflow authority configuration saved successfully!
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '1.5rem' }}>
        
        {/* Workflows List */}
        <div className="glass-card" style={{ padding: '1rem' }}>
          <h3 style={{ fontSize: '1rem', marginBottom: '1rem', color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Sliders size={18} color="#38bdf8" /> Approval Pipelines ({workflows.length})
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
            {workflows.map(w => {
              const isSelected = selectedWorkflow.id === w.id;
              return (
                <div
                  key={w.id}
                  style={{
                    padding: '0.85rem',
                    borderRadius: '8px',
                    background: isSelected ? 'rgba(56,189,248,0.15)' : 'rgba(15,23,42,0.6)',
                    border: isSelected ? '1px solid #38bdf8' : '1px solid rgba(255,255,255,0.05)',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                  onClick={() => setSelectedWorkflow(w)}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 600, color: isSelected ? '#38bdf8' : '#f8fafc', fontSize: '0.9rem' }}>
                      {w.workflow_name}
                    </span>
                    <span className={`tag-badge ${w.status === 'ACTIVE' ? 'tag-success' : 'tag-danger'}`} style={{ fontSize: '0.7rem' }}>
                      {w.status}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '0.3rem' }}>
                    {w.stages.length} Approval Stages Defined
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Selected Workflow Stage Sequence Configuration */}
        <div className="glass-card" style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '0.75rem' }}>
            <div>
              <h3 style={{ margin: 0, color: '#f8fafc', fontSize: '1.1rem' }}>{selectedWorkflow.workflow_name}</h3>
              <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '0.15rem' }}>Sequential Multi-Stage Sign-off Pipeline</div>
            </div>

            <button
              className={`btn ${selectedWorkflow.status === 'ACTIVE' ? 'btn-secondary' : 'btn-primary'}`}
              style={{ fontSize: '0.75rem', color: selectedWorkflow.status === 'ACTIVE' ? '#f43f5e' : '#10b981' }}
              onClick={() => handleToggleStatus(selectedWorkflow.id)}
            >
              {selectedWorkflow.status === 'ACTIVE' ? "Deactivate Workflow" : "Activate Workflow"}
            </button>
          </div>

          <h4 style={{ fontSize: '0.9rem', color: '#38bdf8', marginBottom: '1rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Sequential Stage Progression Hierarchy
          </h4>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.5rem' }}>
            {selectedWorkflow.stages.map((stg, idx) => (
              <div key={stg.sequence} style={{ position: 'relative' }}>
                <div
                  style={{
                    padding: '1rem',
                    background: 'rgba(15,23,42,0.8)',
                    borderRadius: '8px',
                    border: '1px solid rgba(56,189,248,0.2)',
                    display: 'grid',
                    gridTemplateColumns: 'auto 1fr 1fr 1fr',
                    gap: '1rem',
                    alignItems: 'center'
                  }}
                >
                  <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#38bdf8', color: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '0.9rem' }}>
                    {stg.sequence}
                  </div>

                  <div>
                    <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Stage Name</div>
                    <div style={{ fontWeight: 700, color: '#f8fafc', fontSize: '0.95rem' }}>{stg.stage_name}</div>
                  </div>

                  <div>
                    <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Action Required</div>
                    <div style={{ color: '#cbd5e1', fontSize: '0.85rem' }}>{stg.action}</div>
                  </div>

                  <div>
                    <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Threshold / Condition</div>
                    <div style={{ fontWeight: 600, color: '#f59e0b', fontSize: '0.85rem' }}>{stg.threshold}</div>
                  </div>
                </div>

                {idx < selectedWorkflow.stages.length - 1 && (
                  <div style={{ textAlign: 'center', padding: '0.3rem 0', color: '#38bdf8' }}>
                    <ArrowRight size={18} style={{ transform: 'rotate(90deg)' }} />
                  </div>
                )}
              </div>
            ))}
          </div>

          <div style={{ padding: '0.85rem', background: 'rgba(56,189,248,0.08)', borderRadius: '8px', border: '1px solid rgba(56,189,248,0.2)', fontSize: '0.8rem', color: '#cbd5e1' }}>
            <strong>System Admin Policy:</strong> Operational users can only process approvals at the exact stage permitted for their role. Users cannot bypass stages or sign off out of sequence.
          </div>

        </div>

      </div>
    </div>
  );
}
