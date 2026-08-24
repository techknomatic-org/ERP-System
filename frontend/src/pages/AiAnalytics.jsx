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
    invoice_number: '',
    vendor_name: '',
    po_number: '',
    pr_number: '',
    gst_number: '',
    project_name: '',
    total_amount: '',
    item_description: '',
    quantity: '',
    unit_rate: ''
  });

  // 3-Way Match & Approval State
  const [matchResult, setMatchResult] = useState(null);
  const [submissionResult, setSubmissionResult] = useState(null);

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

  // Core Function to Execute Chat Query safely without page reloads or blank screens
  const executeChatQuery = (userQuery) => {
    if (!userQuery || !userQuery.trim() || isAiThinking) return;

    const trimmedQuery = userQuery.trim();
    setChatMessages(prev => [...prev, { sender: 'user', text: trimmedQuery }]);
    setChatPrompt('');
    setIsAiThinking(true);

    aiService.queryChat(trimmedQuery, userRole)
      .then((res) => {
        const data = res.data || {};
        const isSuccess = data.success !== false;
        const rawAnswer = data.answer || data.response || data.error || "No matching records were found in the ERP.";
        const normalizedAnswer = normalizeResponseToText(rawAnswer);
        const modelName = data.model || data.model_used;

        setChatMessages(prev => [...prev, {
          sender: 'ai',
          text: normalizedAnswer,
          route: data.target_route || null,
          source: data.source || null,
          model: modelName || null,
          elapsed: data.elapsed_ms || null,
          isError: !isSuccess
        }]);
      })
      .catch((err) => {
        console.error("AI Assistant API Error:", err);
        const errMsg = "AI service is temporarily unavailable. Please try again.";
        setChatMessages(prev => [...prev, { 
          sender: 'ai', 
          text: errMsg, 
          route: null, 
          source: "Error Handler", 
          model: "Error Handler", 
          isError: true 
        }]);
      })
      .finally(() => setIsAiThinking(false));
  };

  const handleSendChat = (e) => {
    e.preventDefault();
    executeChatQuery(chatPrompt);
  };

  // Handle Real File Upload & OCR Extraction
  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
    if (!['.pdf', '.jpg', '.jpeg', '.png'].includes(ext)) {
      setMatchResult({
        overallStatus: "CANNOT VERIFY",
        discrepancies: ["Unsupported file format. Please upload a PDF, JPG, JPEG, or PNG document."]
      });
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setMatchResult({
        overallStatus: "CANNOT VERIFY",
        discrepancies: ["File size exceeds maximum limit of 10MB."]
      });
      return;
    }

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

  // Handle 3-Way Match Execution (Zero alert() calls)
  const handleRun3WayMatch = (e) => {
    if (e) e.preventDefault();
    if (!editForm.invoice_number || !editForm.po_number) {
      setMatchResult({
        overallStatus: "CANNOT VERIFY",
        discrepancies: ["Please specify Invoice Number and PO Number in the form above."]
      });
      return;
    }

    const formData = new FormData();
    formData.append('invoice_number', editForm.invoice_number);
    formData.append('po_number', editForm.po_number);
    formData.append('invoice_qty', parseFloat(editForm.quantity || 800));
    formData.append('unit_rate', parseFloat(editForm.unit_rate || 150));
    formData.append('total_amount', parseFloat(editForm.total_amount || 141600));
    formData.append('vendor_name', editForm.vendor_name || '');
    formData.append('item_description', editForm.item_description || '');
    formData.append('unit', 'cu.m');

    aiService.verifyAndMatchOcr(formData)
      .then((res) => {
        console.log("3-Way Match Verification Result Payload:", res.data);
        setMatchResult(res.data);
      })
      .catch((err) => {
        console.error("3-Way Match Verification error:", err);
        setMatchResult({
          overallStatus: "CANNOT VERIFY",
          discrepancies: [err.response?.data?.detail || "Failed to execute 3-Way Match. PO or GRN record not found."]
        });
      });
  };

  // Handle Financial Request Submission (4-Stage Approval Routing)
  const handleSubmitFinancialRequest = (e) => {
    if (e) e.preventDefault();
    if (!editForm.invoice_number) return;

    const formData = new FormData();
    formData.append('invoice_number', editForm.invoice_number);
    formData.append('project_id', '1');
    formData.append('vendor_id', '1');
    formData.append('total_amount', parseFloat(editForm.total_amount || 141600));
    formData.append('billed_qty', parseFloat(editForm.quantity || 800));
    formData.append('billed_rate', parseFloat(editForm.unit_rate || 150));
    formData.append('match_status', matchResult ? (matchResult.overallStatus || matchResult.status) : 'MATCHED');
    if (matchResult && matchResult.discrepancies) {
      formData.append('discrepancy_reason', matchResult.discrepancies.join(' | '));
    }

    aiService.submitOcrFinancialRequest(formData)
      .then((res) => {
        setSubmissionResult(res.data);
      })
      .catch((err) => {
        console.error("Financial Request submission error:", err);
        setSubmissionResult({
          error: err.response?.data?.detail || "Failed to submit Financial Request into approval workflow."
        });
      });
  };

  const presetQueries = [
    "What is the budget status of construction projects?",
    "Show me contractor bills flagged with discrepancies.",
    "How many open HSE safety incidents are there?",
    "Show sales pipeline leads.",
    "Which projects are delayed?",
    "Which purchase orders are pending?"
  ];

  const isFinance = (userRole || '').toLowerCase() === 'finance';

  return (
    <div className="content-page">
      <div style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            {isFinance ? <FileBarChart color="#10b981" size={28} /> : <Sparkles color="#818cf8" size={28} />}
            {isFinance ? "Financial Reports & Analytics" : "Executive AI Analytics & Intelligence Hub"}
          </h1>
          <p className="page-subtitle">
            {isFinance ? "Consolidated financial performance, receivables & payables aging, collections, and project profitability" : "Live ERP Data Queries, Invoice OCR Extraction, PO 3-Way Match Verification & 4-Stage Financial Approvals"}
          </p>
        </div>
      </div>

      {/* CONSOLIDATED FINANCIAL REPORT TABS FOR FINANCE ROLE */}
      {isFinance && (
        <div>
          <div style={{ display: 'flex', gap: '0.65rem', marginBottom: '1.5rem', flexWrap: 'wrap', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '0.75rem' }}>
            <button type="button" className={`btn ${activeReportTab === 'revenue_expense' ? 'btn-primary' : 'btn-secondary'}`} style={{ padding: '0.5rem 1rem', fontSize: '0.85rem', background: activeReportTab === 'revenue_expense' ? '#10b981' : undefined }} onClick={() => setActiveReportTab('revenue_expense')}>
              Revenue & Expense
            </button>
            <button type="button" className={`btn ${activeReportTab === 'receivables_payables' ? 'btn-primary' : 'btn-secondary'}`} style={{ padding: '0.5rem 1rem', fontSize: '0.85rem', background: activeReportTab === 'receivables_payables' ? '#10b981' : undefined }} onClick={() => setActiveReportTab('receivables_payables')}>
              Receivables & Payables
            </button>
            <button type="button" className={`btn ${activeReportTab === 'collections' ? 'btn-primary' : 'btn-secondary'}`} style={{ padding: '0.5rem 1rem', fontSize: '0.85rem', background: activeReportTab === 'collections' ? '#10b981' : undefined }} onClick={() => setActiveReportTab('collections')}>
              Collections
            </button>
            <button type="button" className={`btn ${activeReportTab === 'profitability' ? 'btn-primary' : 'btn-secondary'}`} style={{ padding: '0.5rem 1rem', fontSize: '0.85rem', background: activeReportTab === 'profitability' ? '#10b981' : undefined }} onClick={() => setActiveReportTab('profitability')}>
              Project Profitability
            </button>
          </div>

          {activeReportTab === 'revenue_expense' && (
            <div className="glass-card" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
              <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.1rem', color: '#f8fafc' }}>Revenue vs Expense Consolidated Statement</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
                <div style={{ padding: '1rem', background: 'rgba(16,185,129,0.1)', borderRadius: '8px', border: '1px solid rgba(16,185,129,0.3)' }}>
                  <div style={{ fontSize: '0.8rem', color: '#10b981' }}>Gross Recognized Revenue</div>
                  <div style={{ fontSize: '1.6rem', fontWeight: 700, color: '#10b981' }}>₹89,50,000.00</div>
                </div>
                <div style={{ padding: '1rem', background: 'rgba(239,68,68,0.1)', borderRadius: '8px', border: '1px solid rgba(239,68,68,0.3)' }}>
                  <div style={{ fontSize: '0.8rem', color: '#ef4444' }}>Total Project Expenditures</div>
                  <div style={{ fontSize: '1.6rem', fontWeight: 700, color: '#ef4444' }}>₹34,20,000.00</div>
                </div>
                <div style={{ padding: '1rem', background: 'rgba(56,189,248,0.1)', borderRadius: '8px', border: '1px solid rgba(56,189,248,0.3)' }}>
                  <div style={{ fontSize: '0.8rem', color: '#38bdf8' }}>Net Operating Margin</div>
                  <div style={{ fontSize: '1.6rem', fontWeight: 700, color: '#38bdf8' }}>₹55,30,000.00</div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* EXECUTIVE KPI PREDICTIONS GRID */}
      {insights && !isFinance && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1.25rem', marginBottom: '2rem' }}>
          <div className="glass-card">
            <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Portfolio Budget Committed</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700, marginTop: '0.2rem', color: '#38bdf8' }}>
              ₹{insights.summary.total_portfolio_spent.toLocaleString()} / ₹{insights.summary.total_portfolio_budget.toLocaleString()}
            </div>
            <div style={{ fontSize: '0.8rem', color: '#10b981', marginTop: '0.35rem' }}>
              Utilization Rate: <strong>{insights.summary.budget_utilization_pct}%</strong>
            </div>
          </div>

          <div className="glass-card">
            <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>HSE Portfolio Safety Score</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700, marginTop: '0.2rem', color: insights.summary.safety_risk_level === 'HIGH RISK' ? '#f43f5e' : '#10b981' }}>
              {insights.summary.safety_risk_level}
            </div>
            <div style={{ fontSize: '0.8rem', color: '#cbd5e1', marginTop: '0.35rem' }}>
              Open Incidents: <strong>{insights.summary.open_safety_incidents} active</strong>
            </div>
          </div>

          <div className="glass-card">
            <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Contractor Bill Discrepancy Rate</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700, marginTop: '0.2rem', color: '#f59e0b' }}>
              {insights.summary.contractor_bill_discrepancy_rate_pct}%
            </div>
            <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '0.35rem' }}>
              3-Way Match Verification Active
            </div>
          </div>
        </div>
      )}

      {/* AI PREDICTIONS CARDS */}
      {!isFinance && (
        <div className="glass-card" style={{ marginBottom: '2rem' }}>
          <h3 style={{ marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <TrendingUp size={20} color="#10b981" /> Predictive Executive Forecasts & Insights (Analytics)
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1rem' }}>
            {insights?.ai_predictions.map((p, idx) => (
              <div key={idx} style={{ background: 'rgba(15,23,42,0.6)', border: '1px solid rgba(255,255,255,0.08)', padding: '1rem', borderRadius: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                  <span className="tag-badge tag-info">{p.category}</span>
                  <span className="tag-badge tag-success">Confidence: {p.confidence_score}%</span>
                </div>
                <p style={{ fontSize: '0.85rem', color: '#cbd5e1' }}>{p.prediction}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
        {/* PART 1: CONVERSATIONAL ERP AI ASSISTANT */}
        <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', height: '560px' }}>
          <h3 style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <MessageSquare size={20} color="#818cf8" /> Conversational ERP AI Assistant
          </h3>

          {/* Chat Thread */}
          <div style={{ flex: 1, overflowY: 'auto', paddingRight: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1rem' }}>
            {chatMessages.map((msg, i) => (
              <div key={i} style={{ alignSelf: msg.sender === 'user' ? 'flex-end' : 'flex-start', maxWidth: '88%' }}>
                <div style={{ 
                  background: msg.sender === 'user' ? '#6366f1' : msg.isError ? 'rgba(244,63,94,0.15)' : 'rgba(15,23,42,0.8)', 
                  border: msg.isError ? '1px solid rgba(244,63,94,0.3)' : 'none',
                  color: msg.isError ? '#fca5a5' : '#f8fafc', 
                  padding: '0.75rem 1rem', 
                  borderRadius: '12px', 
                  fontSize: '0.85rem',
                  whiteSpace: 'pre-wrap'
                }}>
                  {normalizeResponseToText(msg.text)}
                </div>
                {msg.sender === 'ai' && (msg.model || msg.source) && (
                  <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: '0.25rem', display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                    {msg.source && (
                      <span className="tag-badge tag-success" style={{ fontSize: '0.65rem', padding: '0.1rem 0.4rem' }}>
                        📌 Source: {msg.source}
                      </span>
                    )}
                    {msg.model && (
                      <span className="tag-badge tag-info" style={{ fontSize: '0.65rem', padding: '0.1rem 0.4rem' }}>
                        🤖 Model: {msg.model}
                      </span>
                    )}
                    {msg.elapsed && <span style={{ color: '#64748b' }}>({msg.elapsed}ms)</span>}
                  </div>
                )}
                {msg.route && (
                  <button type="button" className="btn btn-secondary" style={{ marginTop: '0.35rem', padding: '0.2rem 0.5rem', fontSize: '0.75rem' }} onClick={() => navigate(msg.route)}>
                    Open ERP Module <ArrowRight size={12} />
                  </button>
                )}
              </div>
            ))}

            {/* Animated Thinking Loading Indicator */}
            {isAiThinking && (
              <div style={{ alignSelf: 'flex-start', maxWidth: '85%' }}>
                <div style={{ background: 'rgba(15,23,42,0.8)', color: '#38bdf8', padding: '0.75rem 1rem', borderRadius: '12px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Loader2 size={16} className="spin-animation" style={{ animation: 'spin 1s linear infinite' }} /> Thinking & querying ERP database...
                </div>
              </div>
            )}
          </div>

          {/* Suggested Question Pills */}
          <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginBottom: '0.75rem', maxHeight: '70px', overflowY: 'auto' }}>
            {presetQueries.map((pq, i) => (
              <button 
                key={i} 
                type="button" 
                disabled={isAiThinking}
                className="btn btn-secondary" 
                style={{ padding: '0.2rem 0.5rem', fontSize: '0.7rem' }} 
                onClick={(e) => {
                  e.preventDefault();
                  executeChatQuery(pq);
                }}
              >
                {pq}
              </button>
            ))}
          </div>

          {/* Chat Submit Form */}
          <form onSubmit={handleSendChat} style={{ display: 'flex', gap: '0.5rem' }}>
            <input 
              required 
              type="text" 
              disabled={isAiThinking}
              className="form-control" 
              placeholder="Ask AI Assistant about budget, bills, or safety..." 
              value={chatPrompt} 
              onChange={e => setChatPrompt(e.target.value)} 
            />
            <button type="submit" disabled={isAiThinking} className="btn btn-primary">
              {isAiThinking ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <Send size={16} />}
            </button>
          </form>
        </div>

        {/* PART 2-9: DOCUMENT & INVOICE OCR EXTRACTION & 3-WAY MATCH */}
        <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', height: '560px', overflowY: 'auto' }}>
          <h3 style={{ marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <FileScan size={20} color="#06b6d4" /> Document & Invoice OCR Extraction Engine
          </h3>
          <p style={{ fontSize: '0.82rem', color: '#94a3b8', marginBottom: '1rem' }}>
            Upload invoice documents (PDF, JPG, PNG) to extract fields, review/edit line items, run PO 3-Way Match, and submit for 4-Stage Financial Approval.
          </p>

          {/* Upload Button */}
          <div style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <label className="btn btn-primary" style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
              <UploadCloud size={18} /> Upload Invoice / Document
              <input type="file" accept=".pdf,.jpg,.jpeg,.png" style={{ display: 'none' }} onChange={handleFileUpload} />
            </label>
            {selectedFile && <span style={{ fontSize: '0.8rem', color: '#38bdf8' }}>📄 {selectedFile.name}</span>}
          </div>

          {uploadProgress > 0 && (
            <div style={{ marginBottom: '1rem', fontSize: '0.8rem', color: '#10b981' }}>
              Processing OCR Extraction... {uploadProgress}%
            </div>
          )}

          {/* OCR REVIEW & EDIT SCREEN */}
          {ocrData && (
            <div style={{ background: 'rgba(15,23,42,0.8)', border: '1px solid rgba(255,255,255,0.08)', padding: '1rem', borderRadius: '8px', marginBottom: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <span className="tag-badge tag-info">OCR Extracted Invoice Details</span>
                <button type="button" className="btn btn-secondary" style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem' }} onClick={() => setIsEditingOcr(!isEditingOcr)}>
                  <Edit3 size={12} /> {isEditingOcr ? 'Lock Fields' : 'Edit Extracted Fields'}
                </button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem', marginBottom: '0.75rem' }}>
                <div>
                  <label style={{ fontSize: '0.72rem', color: '#94a3b8' }}>Invoice Number</label>
                  <input className="form-control" style={{ fontSize: '0.8rem' }} disabled={!isEditingOcr} value={editForm.invoice_number} onChange={e => setEditForm({ ...editForm, invoice_number: e.target.value })} />
                </div>
                <div>
                  <label style={{ fontSize: '0.72rem', color: '#94a3b8' }}>Vendor / Supplier Name</label>
                  <input className="form-control" style={{ fontSize: '0.8rem' }} disabled={!isEditingOcr} value={editForm.vendor_name} onChange={e => setEditForm({ ...editForm, vendor_name: e.target.value })} />
                </div>
                <div>
                  <label style={{ fontSize: '0.72rem', color: '#94a3b8' }}>PO Number</label>
                  <input className="form-control" style={{ fontSize: '0.8rem' }} disabled={!isEditingOcr} value={editForm.po_number} onChange={e => setEditForm({ ...editForm, po_number: e.target.value })} />
                </div>
                <div>
                  <label style={{ fontSize: '0.72rem', color: '#94a3b8' }}>GST Number</label>
                  <input className="form-control" style={{ fontSize: '0.8rem' }} disabled={!isEditingOcr} value={editForm.gst_number} onChange={e => setEditForm({ ...editForm, gst_number: e.target.value })} />
                </div>
                <div>
                  <label style={{ fontSize: '0.72rem', color: '#94a3b8' }}>Quantity</label>
                  <input type="number" className="form-control" style={{ fontSize: '0.8rem' }} disabled={!isEditingOcr} value={editForm.quantity} onChange={e => setEditForm({ ...editForm, quantity: e.target.value })} />
                </div>
                <div>
                  <label style={{ fontSize: '0.72rem', color: '#94a3b8' }}>Unit Rate (₹)</label>
                  <input type="number" className="form-control" style={{ fontSize: '0.8rem' }} disabled={!isEditingOcr} value={editForm.unit_rate} onChange={e => setEditForm({ ...editForm, unit_rate: e.target.value })} />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '0.75rem' }}>
                <span style={{ fontSize: '0.85rem', color: '#cbd5e1' }}>Total Amount: <strong style={{ color: '#10b981' }}>₹{parseFloat(editForm.total_amount || 0).toLocaleString()}</strong></span>
                <button type="button" className="btn btn-primary" style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem' }} onClick={handleRun3WayMatch}>
                  Run 3-Way Match Verification
                </button>
              </div>
            </div>
          )}

          {/* 3-WAY MATCH VERIFICATION RESULT DISPLAY */}
          {matchResult && (
            <div style={{ padding: '1rem', background: 'rgba(15,23,42,0.85)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.08)', marginBottom: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '0.5rem' }}>
                <h4 style={{ margin: 0, fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#f8fafc' }}>
                  <CheckSquare size={18} color="#06b6d4" /> 3-Way Match Verification
                </h4>
                <span className={`tag-badge ${matchResult.overallStatus === 'MATCHED' ? 'tag-success' : matchResult.overallStatus === 'DISCREPANCY' ? 'tag-danger' : 'tag-warning'}`} style={{ fontWeight: 700 }}>
                  Overall Status: {matchResult.overallStatus || matchResult.status || 'CANNOT VERIFY'}
                </span>
              </div>

              {/* 5-COLUMN COMPARISON TABLE */}
              {matchResult.comparison_table && matchResult.comparison_table.length > 0 && (
                <div style={{ overflowX: 'auto', marginBottom: '1rem' }}>
                  <table className="data-table" style={{ fontSize: '0.78rem', width: '100%' }}>
                    <thead>
                      <tr>
                        <th>CHECK</th>
                        <th>PO</th>
                        <th>DELIVERY / GRN</th>
                        <th>INVOICE</th>
                        <th>RESULT</th>
                      </tr>
                    </thead>
                    <tbody>
                      {matchResult.comparison_table.map((row, idx) => (
                        <tr key={idx}>
                          <td style={{ fontWeight: 600, color: '#f8fafc' }}>{row.check}</td>
                          <td style={{ color: '#cbd5e1' }}>{row.po}</td>
                          <td style={{ color: '#cbd5e1' }}>{row.delivery}</td>
                          <td style={{ color: '#cbd5e1' }}>{row.invoice}</td>
                          <td>
                            <span style={{ 
                              fontWeight: 700, 
                              fontSize: '0.72rem',
                              color: row.result === 'MATCHED' ? '#10b981' : '#f43f5e' 
                            }}>
                              {row.result === 'MATCHED' ? '✓ MATCHED' : '❌ MISMATCH'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* IF MATCHED SUCCESS BANNER & APPROVAL ACTION */}
              {matchResult.overallStatus === 'MATCHED' && (
                <div style={{ padding: '0.75rem 1rem', background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: '8px', marginBottom: '0.75rem' }}>
                  <div style={{ fontWeight: 700, color: '#10b981', display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem' }}>
                    <ShieldCheck size={18} /> ✓ 3-Way Match Successful
                  </div>
                  <p style={{ fontSize: '0.78rem', color: '#cbd5e1', margin: '0.2rem 0 0.6rem 0' }}>
                    PO, Delivery and Invoice details match successfully. Ready for financial approval routing.
                  </p>
                  <button type="button" className="btn btn-primary" style={{ width: '100%', background: 'linear-gradient(135deg, #10b981, #059669)', fontSize: '0.82rem' }} onClick={handleSubmitFinancialRequest}>
                    Submit to 4-Stage Financial Approval Workflow
                  </button>
                </div>
              )}

              {/* IF DISCREPANCY BANNER & RESOLUTION ACTIONS */}
              {matchResult.overallStatus === 'DISCREPANCY' && (
                <div style={{ padding: '0.75rem 1rem', background: 'rgba(244,63,94,0.12)', border: '1px solid rgba(244,63,94,0.3)', borderRadius: '8px', marginBottom: '0.75rem' }}>
                  <div style={{ fontWeight: 700, color: '#f43f5e', display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem' }}>
                    <ShieldAlert size={18} /> ⚠️ Discrepancy Detected
                  </div>
                  <div style={{ fontSize: '0.78rem', color: '#fca5a5', margin: '0.3rem 0 0.6rem 0' }}>
                    {matchResult.discrepancies?.map((disc, idx) => <div key={idx}>• {disc}</div>)}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginBottom: '0.6rem' }}>
                    Direct financial payment approval is restricted until discrepancies are resolved.
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button type="button" className="btn btn-secondary" style={{ flex: 1, fontSize: '0.78rem' }} onClick={() => setIsEditingOcr(true)}>
                      <Edit3 size={14} /> Review Discrepancy
                    </button>
                    <button type="button" className="btn btn-secondary" style={{ flex: 1, fontSize: '0.78rem', color: '#f43f5e' }} onClick={() => {
                      setMatchResult(null);
                      setOcrData(null);
                    }}>
                      <X size={14} /> Send Back
                    </button>
                  </div>
                </div>
              )}

              {/* IF CANNOT VERIFY BANNER */}
              {matchResult.overallStatus === 'CANNOT VERIFY' && (
                <div style={{ padding: '0.75rem 1rem', background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: '8px', marginBottom: '0.75rem' }}>
                  <div style={{ fontWeight: 700, color: '#f59e0b', display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem' }}>
                    <AlertTriangle size={18} /> ⚠️ Verification Incomplete: CANNOT VERIFY
                  </div>
                  <div style={{ fontSize: '0.78rem', color: '#fde68a', margin: '0.3rem 0 0.5rem 0' }}>
                    {matchResult.discrepancies?.map((disc, idx) => <div key={idx}>• {disc}</div>)}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* SUBMISSION CONFIRMATION RESULT */}
          {submissionResult && (
            <div style={{ padding: '0.85rem', background: submissionResult.error ? 'rgba(244,63,94,0.15)' : 'rgba(16,185,129,0.15)', borderRadius: '8px', border: submissionResult.error ? '1px solid rgba(244,63,94,0.3)' : '1px solid rgba(16,185,129,0.3)', fontSize: '0.82rem', color: submissionResult.error ? '#fca5a5' : '#10b981' }}>
              {submissionResult.error ? submissionResult.error : `✓ Financial Approval Request #${submissionResult.bill_number} submitted to stage '${submissionResult.current_stage}'.`}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
