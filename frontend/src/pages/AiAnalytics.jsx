import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Sparkles, MessageSquare, FileScan, TrendingUp, AlertTriangle, Send, CheckCircle2, 
  ArrowRight, FileBarChart, DollarSign, Calculator, Layers, Filter, UploadCloud, 
  FileText, CheckSquare, X, Edit3, ShieldAlert, ShieldCheck, Loader2
} from 'lucide-react';
import { aiService, projectService } from '../services/api';

// Helper Function to Normalize any Response Data Type safely into formatted text
function normalizeResponseToText(data) {
  if (data === null || data === undefined) {
    return "No data found";
  }
  if (typeof data === 'string') {
    return data;
  }
  if (typeof data === 'number' || typeof data === 'boolean') {
    return String(data);
  }
  if (Array.isArray(data)) {
    if (data.length === 0) return "No records found.";
    return data.map((item) => {
      if (typeof item === 'object' && item !== null) {
        return `• ${item.title || item.name || item.item_name || item.po_number || item.bill_number || JSON.stringify(item)}`;
      }
      return `• ${String(item)}`;
    }).join('\n');
  }
  if (typeof data === 'object') {
    if (data.answer && typeof data.answer === 'string') return data.answer;
    if (data.response && typeof data.response === 'string') return data.response;
    if (data.detail && typeof data.detail === 'string') return data.detail;
    if (data.error && typeof data.error === 'string') return data.error;

    try {
      const keys = Object.keys(data);
      if (keys.length === 0) return "No details available.";
      return keys.map(k => {
        const val = data[k];
        const formattedVal = typeof val === 'object' ? JSON.stringify(val) : String(val);
        return `• ${k}: ${formattedVal}`;
      }).join('\n');
    } catch (e) {
      return JSON.stringify(data);
    }
  }
  return String(data);
}

const PRESET_QUERIES = [
  "Which purchase orders are pending?",
  "Which projects are delayed?",
  "What is the budget status of construction projects?",
  "Show me contractor bills flagged with discrepancies.",
  "How many open HSE safety incidents are there?",
  "Show sales pipeline leads.",
  "Show incomplete WBS tasks.",
  "Show pending material requests."
];

export default function AiAnalytics() {
  const navigate = useNavigate();
  const [userRole, setUserRole] = useState(localStorage.getItem('erp_role') || 'admin');
  const [projects, setProjects] = useState([]);

  // Active Report Tab for Finance
  const [activeReportTab, setActiveReportTab] = useState('revenue_expense');

  const [insights, setInsights] = useState(null);
  const [loading, setLoading] = useState(true);

  // Conversational AI Chat State
  const [chatPrompt, setChatPrompt] = useState('');
  const [isAiThinking, setIsAiThinking] = useState(false);
  const [chatMessages, setChatMessages] = useState([
    { 
      sender: 'ai', 
      text: 'Hello! I am your AI ERP Assistant. Ask me natural-language questions about construction budget status, contractor bill discrepancies, HSE safety records, sales leads, delayed projects, or BOQ execution.', 
      route: null 
    }
  ]);

  // OCR Document Upload & Extraction State
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [ocrData, setOcrData] = useState(null);
  const [isEditingOcr, setIsEditingOcr] = useState(false);
  const [editForm, setEditForm] = useState({
    invoice_number: 'INV-2024-001',
    vendor_name: 'ABC Concrete & Construction Supplies Pvt. Ltd.',
    po_number: 'PO-8001',
    pr_number: 'PR-101',
    gst_number: '27AAAAA0000A1Z5',
    project_name: 'Skyline Commercial Tower - Phase 1',
    total_amount: '120000',
    item_description: 'Ready Mix Concrete M30 Grade',
    quantity: '800',
    unit_rate: '150'
  });

  // 3-Way Match & Approval State
  const [matchResult, setMatchResult] = useState(null);
  const [submissionResult, setSubmissionResult] = useState(null);
  const [isMatchingOcr, setIsMatchingOcr] = useState(false);
  const [isSubmittingOcr, setIsSubmittingOcr] = useState(false);

  const handleRun3WayMatch = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (isMatchingOcr) return;

    setIsMatchingOcr(true);
    setMatchResult(null);
    setSubmissionResult(null);

    const payload = {
      invoice_number: editForm.invoice_number || "INV-2024-001",
      po_number: editForm.po_number || "PO-8001",
      invoice_qty: parseFloat(editForm.quantity || 800),
      unit_rate: parseFloat(editForm.unit_rate || 150),
      total_amount: parseFloat(editForm.total_amount || 120000),
      vendor_name: editForm.vendor_name || "ABC Concrete & Construction Supplies Pvt. Ltd.",
      item_description: editForm.item_description || "Ready Mix Concrete M30 Grade",
      unit: editForm.unit || "cu.m"
    };

    try {
      const res = await aiService.verifyAndMatchOcr(payload);
      setMatchResult(res.data || {});
    } catch (err) {
      console.error("3-Way Match Error:", err);
      let errMsg = "3-Way Verification failed. Please check PO number and values.";
      if (err.response?.data?.detail) {
        errMsg = typeof err.response.data.detail === 'string' 
          ? err.response.data.detail 
          : JSON.stringify(err.response.data.detail);
      }
      setMatchResult({
        overallStatus: "CANNOT VERIFY",
        status: "CANNOT VERIFY",
        discrepancies: [errMsg]
      });
    } finally {
      setIsMatchingOcr(false);
    }
  };

  const handleSubmitFinancialRequest = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (isSubmittingOcr) return;

    setIsSubmittingOcr(true);
    try {
      const payload = {
        invoice_number: editForm.invoice_number || "INV-2024-001",
        po_number: editForm.po_number || "PO-8001",
        vendor_name: editForm.vendor_name || "ABC Concrete & Construction Supplies Pvt. Ltd.",
        total_amount: parseFloat(editForm.total_amount || 120000)
      };
      const res = await aiService.submitOcrFinancialRequest(payload);
      setSubmissionResult(res.data || { success: true, message: "Submitted for 4-Stage Financial Approval!" });
    } catch (err) {
      console.error("Financial Request Submission Error:", err);
      setSubmissionResult({ success: false, error: "Failed to submit financial request." });
    } finally {
      setIsSubmittingOcr(false);
    }
  };

  useEffect(() => {
    const storedRole = localStorage.getItem('erp_role');
    if (storedRole) setUserRole(storedRole);

    Promise.all([
      aiService.getInsights(),
      projectService.getProjects()
    ])
      .then(([insightsRes, projRes]) => {
        setInsights(insightsRes.data);
        setProjects(projRes.data || []);
      })
      .catch((err) => console.error("Error loading AI analytics data:", err))
      .finally(() => setLoading(false));
  }, []);

  const executeChatQuery = async (userQuery) => {
    if (!userQuery || !userQuery.trim() || isAiThinking) return;

    const trimmedQuery = userQuery.trim();
    setChatMessages(prev => [...prev, { sender: 'user', text: trimmedQuery }]);
    setChatPrompt('');
    setIsAiThinking(true);

    try {
      const res = await aiService.queryChat(trimmedQuery, userRole);
      const data = res.data || {};
      const isSuccess = data.success !== false;
      const rawAnswer = data.answer || data.response || data.error || "No matching records were found in the ERP database.";
      const normalizedAnswer = normalizeResponseToText(rawAnswer);
      const modelName = data.model || data.model_used || "openai/gpt-4o-mini";

      setChatMessages(prev => [...prev, {
        sender: 'ai',
        text: normalizedAnswer,
        route: data.target_route || null,
        source: data.source || null,
        model: modelName,
        elapsed: data.elapsed_ms || null,
        isError: !isSuccess
      }]);
    } catch (err) {
      console.error("AI Assistant API Error:", err);
      let errMsg = "AI service is currently unavailable. Please try again.";
      setChatMessages(prev => [...prev, { 
        sender: 'ai', 
        text: errMsg, 
        route: null, 
        source: "Error Handler", 
        model: "Error Handler", 
        isError: true 
      }]);
    } finally {
      setIsAiThinking(false);
    }
  };

  const handleSendChat = (e) => {
    e.preventDefault();
    executeChatQuery(chatPrompt);
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setSelectedFile(file);
    setUploadProgress(30);

    const formData = new FormData();
    formData.append('file', file);

    setUploadProgress(60);
    aiService.uploadInvoiceOcr(formData)
      .then((res) => {
        setUploadProgress(100);
        const data = res.data.extracted_data;
        setOcrData(data);
        setEditForm({
          invoice_number: data.invoice_number,
          vendor_name: data.vendor_name,
          po_number: data.po_number,
          pr_number: data.pr_number,
          gst_number: data.gst_number,
          project_name: data.project_name,
          total_amount: data.total_amount.toString(),
          item_description: data.line_items[0]?.description || '',
          quantity: data.line_items[0]?.quantity.toString() || '800',
          unit_rate: data.line_items[0]?.unit_rate.toString() || '150'
        });
        setMatchResult(null);
        setSubmissionResult(null);
      })
      .catch((err) => {
        setMatchResult({
          overallStatus: "CANNOT VERIFY",
          discrepancies: [err.response?.data?.detail || "OCR Extraction failed."]
        });
      })
      .finally(() => setUploadProgress(0));
  };

  const isFinance = (userRole || '').toLowerCase() === 'finance';

  return (
    <div className="content-page">
      <div className="section-header">
        <div>
          <h1 className="page-title">
            {isFinance ? <FileBarChart color="var(--accent-emerald)" size={28} /> : <Sparkles color="var(--primary)" size={28} />}
            {isFinance ? "Financial Reports & Analytics" : "Executive AI Analytics & Intelligence Hub"}
          </h1>
          <p className="page-subtitle">
            {isFinance ? "Consolidated financial performance, receivables aging & project profitability" : "Live ERP Data Queries, Invoice OCR Extraction, PO 3-Way Match Verification & Financial Approvals"}
          </p>
        </div>
      </div>

      {/* EXECUTIVE KPI PREDICTIONS GRID */}
      {insights && !isFinance && (
        <div className="kpi-grid">
          <div className="kpi-card">
            <div>
              <div className="kpi-title">Portfolio Budget Committed</div>
              <div className="kpi-value" style={{ color: 'var(--accent-cyan)' }}>
                ₹{insights.summary.total_portfolio_spent.toLocaleString()} / ₹{insights.summary.total_portfolio_budget.toLocaleString()}
              </div>
              <div className="kpi-subtext">
                <span className="tag-badge tag-info">Utilization: {insights.summary.budget_utilization_pct}%</span>
              </div>
            </div>
            <div className="kpi-icon-box" style={{ background: 'rgba(6,182,212,0.15)', color: 'var(--accent-cyan)' }}>
              <DollarSign size={22} />
            </div>
          </div>

          <div className="kpi-card">
            <div>
              <div className="kpi-title">HSE Portfolio Safety Score</div>
              <div className="kpi-value" style={{ color: insights.summary.safety_risk_level === 'HIGH RISK' ? 'var(--accent-rose)' : 'var(--accent-emerald)' }}>
                {insights.summary.safety_risk_level}
              </div>
              <div className="kpi-subtext">
                <span className={`tag-badge ${insights.summary.safety_risk_level === 'HIGH RISK' ? 'tag-danger' : 'tag-success'}`}>
                  {insights.summary.open_safety_incidents} Active Incidents
                </span>
              </div>
            </div>
            <div className="kpi-icon-box" style={{ background: 'rgba(244,63,94,0.15)', color: 'var(--accent-rose)' }}>
              <ShieldAlert size={22} />
            </div>
          </div>

          <div className="kpi-card">
            <div>
              <div className="kpi-title">Contractor Discrepancy Rate</div>
              <div className="kpi-value" style={{ color: 'var(--accent-amber)' }}>
                {insights.summary.contractor_bill_discrepancy_rate_pct}%
              </div>
              <div className="kpi-subtext">
                <span className="tag-badge tag-warning">3-Way PO-GRN Match Active</span>
              </div>
            </div>
            <div className="kpi-icon-box" style={{ background: 'rgba(245,158,11,0.15)', color: 'var(--accent-amber)' }}>
              <AlertTriangle size={22} />
            </div>
          </div>
        </div>
      )}

      {/* AI PREDICTIONS CARDS */}
      {!isFinance && (
        <div className="glass-card" style={{ marginBottom: '1.5rem' }}>
          <div className="card-header">
            <div className="card-title">
              <TrendingUp size={18} color="var(--accent-emerald)" /> Predictive Executive Forecasts & Insights
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1rem' }}>
            {insights?.ai_predictions.map((p, idx) => (
              <div key={idx} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-color)', padding: '1.1rem', borderRadius: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.65rem' }}>
                  <span className="tag-badge tag-info">{p.category}</span>
                  <span className="tag-badge tag-success">Confidence: {p.confidence_score}%</span>
                </div>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{p.prediction}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
        {/* PART 1: CONVERSATIONAL ERP AI ASSISTANT */}
        <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', height: '560px' }}>
          <div className="card-header">
            <div className="card-title">
              <MessageSquare size={18} color="var(--primary)" /> Conversational ERP AI Assistant
            </div>
          </div>

          {/* Chat Thread */}
          <div style={{ flex: 1, overflowY: 'auto', paddingRight: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1rem' }}>
            {chatMessages.map((msg, i) => (
              <div key={i} style={{ alignSelf: msg.sender === 'user' ? 'flex-end' : 'flex-start', maxWidth: '88%' }}>
                <div style={{ 
                  background: msg.sender === 'user' ? 'var(--primary)' : msg.isError ? 'var(--status-danger-bg)' : 'rgba(255,255,255,0.04)', 
                  border: msg.isError ? '1px solid var(--status-danger-border)' : '1px solid var(--border-color)',
                  color: msg.isError ? 'var(--status-danger-text)' : 'var(--text-primary)', 
                  padding: '0.75rem 1rem', 
                  borderRadius: '12px', 
                  fontSize: '0.85rem',
                  whiteSpace: 'pre-wrap'
                }}>
                  {normalizeResponseToText(msg.text)}
                </div>
                {msg.sender === 'ai' && (msg.model || msg.source) && (
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.25rem', display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                    {msg.source && (
                      <span className="tag-badge tag-success" style={{ fontSize: '0.65rem', padding: '0.1rem 0.4rem' }}>
                        Source: {msg.source}
                      </span>
                    )}
                    {msg.model && (
                      <span className="tag-badge tag-info" style={{ fontSize: '0.65rem', padding: '0.1rem 0.4rem' }}>
                        Model: {msg.model}
                      </span>
                    )}
                  </div>
                )}
                {msg.route && (
                  <button type="button" className="btn btn-secondary btn-sm" style={{ marginTop: '0.35rem' }} onClick={() => navigate(msg.route)}>
                    Open ERP Module <ArrowRight size={12} />
                  </button>
                )}
              </div>
            ))}

            {isAiThinking && (
              <div style={{ alignSelf: 'flex-start', maxWidth: '85%' }}>
                <div style={{ background: 'rgba(255,255,255,0.04)', color: 'var(--accent-cyan)', padding: '0.75rem 1rem', borderRadius: '12px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Loader2 size={16} className="spin-animation" /> Querying ERP ground-truth database...
                </div>
              </div>
            )}
          </div>

          {/* Preset Pills */}
          <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginBottom: '0.75rem', maxHeight: '70px', overflowY: 'auto' }}>
            {PRESET_QUERIES.map((pq, i) => (
              <button 
                key={i} 
                type="button" 
                disabled={isAiThinking}
                className="btn btn-secondary btn-sm" 
                style={{ fontSize: '0.72rem' }} 
                onClick={(e) => {
                  e.preventDefault();
                  executeChatQuery(pq);
                }}
              >
                {pq}
              </button>
            ))}
          </div>

          {/* Chat Form */}
          <form onSubmit={handleSendChat} style={{ display: 'flex', gap: '0.5rem' }}>
            <input 
              required 
              type="text" 
              disabled={isAiThinking}
              className="form-control" 
              placeholder="Ask AI Assistant about budget, bills, delayed tasks..." 
              value={chatPrompt} 
              onChange={e => setChatPrompt(e.target.value)} 
            />
            <button type="submit" disabled={isAiThinking} className="btn btn-primary">
              {isAiThinking ? <Loader2 size={16} className="spin-animation" /> : <Send size={16} />}
            </button>
          </form>
        </div>

        {/* PART 2: OCR DOCUMENT & 3-WAY MATCH */}
        <div className="glass-card" style={{ display: 'flex', flexDirection: 'column' }}>
          <div className="card-header">
            <div className="card-title">
              <FileScan size={18} color="var(--accent-cyan)" /> Document & Invoice OCR Extraction Engine
            </div>
          </div>

          <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
            Upload contractor invoices (PDF, JPG, PNG) to extract data fields, run PO 3-Way Match verification, and submit for 4-Stage Financial Approval.
          </p>

          <div 
            style={{
              border: '2px dashed var(--border-color)',
              borderRadius: '12px',
              padding: '1.5rem',
              textAlign: 'center',
              background: 'rgba(255,255,255,0.02)',
              cursor: 'pointer',
              marginBottom: '1rem'
            }}
            onClick={() => document.getElementById('ocr-file-input').click()}
          >
            <UploadCloud size={32} color="var(--primary)" style={{ margin: '0 auto 0.5rem' }} />
            <div style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-primary)' }}>
              {selectedFile ? selectedFile.name : "Click or Drag Invoice Document"}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
              PDF, PNG, JPG up to 10MB
            </div>
            <input
              id="ocr-file-input"
              type="file"
              accept=".pdf,.jpg,.jpeg,.png"
              style={{ display: 'none' }}
              onChange={handleFileUpload}
            />
          </div>

          {/* Form Actions for 3-Way Match Verification */}
          <div style={{ display: 'flex', gap: '0.75rem', marginTop: 'auto' }}>
            <button
              type="button"
              className="btn btn-primary"
              style={{ flex: 1 }}
              onClick={handleRun3WayMatch}
              disabled={isMatchingOcr}
            >
              {isMatchingOcr ? <Loader2 size={16} className="spin-animation" /> : <CheckCircle2 size={16} />}
              Run PO 3-Way Match
            </button>

            <button
              type="button"
              className="btn btn-success"
              style={{ flex: 1 }}
              onClick={handleSubmitFinancialRequest}
              disabled={isSubmittingOcr}
            >
              {isSubmittingOcr ? <Loader2 size={16} className="spin-animation" /> : <Send size={16} />}
              Submit Financial Request
            </button>
          </div>

          {/* Match Result Output */}
          {matchResult && (
            <div style={{ marginTop: '1rem', padding: '0.85rem', borderRadius: '8px', background: matchResult.overallStatus === 'VERIFIED_MATCH' ? 'var(--status-success-bg)' : 'var(--status-warning-bg)', border: `1px solid ${matchResult.overallStatus === 'VERIFIED_MATCH' ? 'var(--status-success-border)' : 'var(--status-warning-border)'}` }}>
              <div style={{ fontSize: '0.85rem', fontWeight: 700, color: matchResult.overallStatus === 'VERIFIED_MATCH' ? 'var(--status-success-text)' : 'var(--status-warning-text)' }}>
                3-Way Match Result: {matchResult.overallStatus || matchResult.status || 'VERIFIED'}
              </div>
            </div>
          )}

          {submissionResult && (
            <div style={{ marginTop: '0.75rem', padding: '0.85rem', borderRadius: '8px', background: 'var(--status-success-bg)', border: '1px solid var(--status-success-border)', color: 'var(--status-success-text)', fontSize: '0.85rem' }}>
              ✓ {submissionResult.message || "Request submitted for 4-Stage Financial Approval."}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
