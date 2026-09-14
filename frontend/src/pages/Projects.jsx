import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  HardHat, Plus, Calendar, MapPin, ArrowRight, Settings, 
  Building2, AlertTriangle, CheckCircle, Info, ShieldAlert, Layers, X,
  Trash2, User, Coins, Check, RotateCcw, ShieldCheck
} from 'lucide-react';
import { projectService, customerService, authService } from '../services/api';

export const STANDARD_CURRENCIES = [
  { code: 'INR', symbol: '₹', label: 'INR — Indian Rupee (₹)', locale: 'en-IN' },
  { code: 'USD', symbol: '$', label: 'USD — US Dollar ($)', locale: 'en-US' },
  { code: 'EUR', symbol: '€', label: 'EUR — Euro (€)', locale: 'de-DE' },
  { code: 'GBP', symbol: '£', label: 'GBP — British Pound (£)', locale: 'en-GB' },
  { code: 'AED', symbol: 'AED ', label: 'AED — UAE Dirham', locale: 'en-AE' },
  { code: 'SAR', symbol: 'SAR ', label: 'SAR — Saudi Riyal', locale: 'ar-SA' },
  { code: 'SGD', symbol: 'S$', label: 'SGD — Singapore Dollar', locale: 'en-SG' },
  { code: 'AUD', symbol: 'A$', label: 'AUD — Australian Dollar', locale: 'en-AU' },
  { code: 'CAD', symbol: 'CA$', label: 'CAD — Canadian Dollar', locale: 'en-CA' },
  { code: 'JPY', symbol: '¥', label: 'JPY — Japanese Yen', locale: 'ja-JP' },
];

export function formatProjectCurrency(amount, currencyCode = 'INR') {
  const code = (currencyCode || 'INR').toUpperCase();
  const found = STANDARD_CURRENCIES.find(c => c.code === code);
  const num = parseFloat(amount || 0);
  if (isNaN(num)) return `${found ? found.symbol : code + ' '}0`;
  const locale = found ? found.locale : 'en-IN';
  const symbol = found ? found.symbol : `${code} `;
  return `${symbol}${num.toLocaleString(locale, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

export default function Projects() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [userRole, setUserRole] = useState(localStorage.getItem('erp_role') || 'admin');

  // Master lists
  const [divisions, setDivisions] = useState([]);
  const [allDivisions, setAllDivisions] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [users, setUsers] = useState([]);
  const [tenantSettings, setTenantSettings] = useState({
    is_p2_enabled: false,
    is_funding_mode_enabled: false,
    custom_funding_modes: null,
    custom_currencies: null
  });

  // Master Data Modal State
  const [masterModal, setMasterModal] = useState({
    isOpen: false,
    category: 'division', // 'division' | 'client' | 'manager' | 'funding_mode' | 'currency'
    tab: 'add', // 'add' | 'manage'
    error: '',
    success: '',
    loading: false
  });

  // Master Data Form Inputs
  const [newDivName, setNewDivName] = useState('');
  const [newDivCode, setNewDivCode] = useState('');
  const [newClientName, setNewClientName] = useState('');
  const [newClientCompany, setNewClientCompany] = useState('');
  const [newClientEmail, setNewClientEmail] = useState('');
  const [newClientPhone, setNewClientPhone] = useState('');
  const [newManagerUsername, setNewManagerUsername] = useState('');
  const [newManagerFullName, setNewManagerFullName] = useState('');
  const [newManagerEmail, setNewManagerEmail] = useState('');
  const [newManagerPassword, setNewManagerPassword] = useState('password123');
  const [newFundingModeName, setNewFundingModeName] = useState('');
  const [newCurrencyCode, setNewCurrencyCode] = useState('');
  const [newCurrencyLabel, setNewCurrencyLabel] = useState('');

  // Project Creation Form State
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    tenant_name: 'Default Tenant',
    division_id: '',
    contract_type: 'Item Rate',
    funding_mode: 'Budgeted',
    currency: 'INR',
    client_id: '',
    manager_id: '',
    location: '',
    latitude: '',
    longitude: '',
    start_date: '',
    end_date: '',
    budget: ''
  });

  const [formErrors, setFormErrors] = useState({});
  const [formWarnings, setFormWarnings] = useState({});
  const [submitError, setSubmitError] = useState('');

  const isAdmin = ['admin', 'administrator', 'tenant_admin'].includes((userRole || '').toLowerCase());

  // Parse custom funding modes and currencies from tenantSettings
  const customFundingModesList = useMemo(() => {
    if (!tenantSettings.custom_funding_modes) return [];
    try {
      const parsed = JSON.parse(tenantSettings.custom_funding_modes);
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      return [];
    }
  }, [tenantSettings.custom_funding_modes]);

  const customCurrenciesList = useMemo(() => {
    if (!tenantSettings.custom_currencies) return [];
    try {
      const parsed = JSON.parse(tenantSettings.custom_currencies);
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      return [];
    }
  }, [tenantSettings.custom_currencies]);

  const availableCurrencies = useMemo(() => {
    const list = [...STANDARD_CURRENCIES];
    customCurrenciesList.forEach(c => {
      const code = typeof c === 'object' ? c.code : String(c);
      if (!list.some(item => item.code.toUpperCase() === code.toUpperCase())) {
        list.push({
          code: code.toUpperCase(),
          symbol: typeof c === 'object' && c.symbol ? c.symbol : `${code.toUpperCase()} `,
          label: typeof c === 'object' && c.label ? c.label : `${code.toUpperCase()} — Custom Currency`,
          locale: 'en-US'
        });
      }
    });
    return list;
  }, [customCurrenciesList]);

  const availableFundingModes = useMemo(() => {
    const base = ['Budgeted', 'Deposit', 'CSSA'];
    customFundingModesList.forEach(m => {
      if (!base.some(b => b.toLowerCase() === m.toLowerCase())) {
        base.push(m);
      }
    });
    return base;
  }, [customFundingModesList]);

  const loadInitialData = () => {
    setLoading(true);
    const storedRole = localStorage.getItem('erp_role');
    if (storedRole) setUserRole(storedRole);

    Promise.all([
      projectService.getProjects().catch((err) => {
        console.error("Error fetching projects:", err);
        return { data: [] };
      }),
      projectService.getDivisions(true).catch(() => ({ data: [] })),
      projectService.getDivisions(false).catch(() => ({ data: [] })),
      projectService.getTenantSettings().catch((err) => {
        console.warn("Tenant settings fallback:", err);
        return { data: { is_p2_enabled: false, is_funding_mode_enabled: false, custom_funding_modes: null, custom_currencies: null } };
      }),
      customerService.getCustomers().catch(() => ({ data: [] })),
      authService.getUsers().catch(() => ({ data: [] }))
    ])
      .then(([projRes, activeDivRes, allDivRes, settingsRes, custRes, userRes]) => {
        setProjects(projRes.data || []);
        setDivisions(activeDivRes.data || []);
        setAllDivisions(allDivRes.data || []);
        if (settingsRes.data) {
          setTenantSettings({
            is_p2_enabled: !!settingsRes.data.is_p2_enabled,
            is_funding_mode_enabled: !!settingsRes.data.is_funding_mode_enabled,
            custom_funding_modes: settingsRes.data.custom_funding_modes,
            custom_currencies: settingsRes.data.custom_currencies
          });
        }
        setCustomers(custRes.data || []);
        setUsers(userRes.data || []);
      })
      .catch((err) => console.error("Error loading project setup data:", err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadInitialData();
  }, []);

  // Calculate Duration in Days automatically
  const calculateDurationDays = (start, end) => {
    if (!start || !end) return 0;
    const s = new Date(start);
    const e = new Date(end);
    const diffMs = e.getTime() - s.getTime();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    return diffDays > 0 ? diffDays : 0;
  };

  // Real-time Validation Engine
  const validateField = (field, value, currentFormData = formData) => {
    const errors = { ...formErrors };
    const warnings = { ...formWarnings };

    if (field === 'name') {
      if (!value.trim()) {
        errors.name = "Project / Contract Name is required.";
      } else if (value.trim().length > 120) {
        errors.name = "Project Name cannot exceed 120 characters.";
      } else {
        const isDuplicate = projects.some(
          p => p.name.trim().toLowerCase() === value.trim().toLowerCase()
        );
        if (isDuplicate) {
          errors.name = "A project with this name already exists in your organization.";
        } else {
          delete errors.name;
        }
      }
    }

    if (field === 'code') {
      if (!value.trim()) {
        errors.code = "Project Code is required.";
      } else {
        delete errors.code;
      }
    }

    if (field === 'budget') {
      if (value !== '' && value !== null && value !== undefined) {
        const valNum = parseFloat(value);
        if (isNaN(valNum) || valNum < 0) {
          errors.budget = "Estimated Contract Value cannot be negative.";
        } else {
          delete errors.budget;
        }
      } else {
        delete errors.budget;
      }
    }

    if (field === 'start_date' || field === 'end_date') {
      const startDateVal = field === 'start_date' ? value : currentFormData.start_date;
      const endDateVal = field === 'end_date' ? value : currentFormData.end_date;

      if (startDateVal) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const sDate = new Date(startDateVal);
        sDate.setHours(0, 0, 0, 0);
        if (sDate < today) {
          warnings.start_date = "Note: Start Date is in the past. (Allowed for backdating)";
        } else {
          delete warnings.start_date;
        }
      } else {
        delete warnings.start_date;
      }

      if (startDateVal && endDateVal) {
        if (new Date(endDateVal) <= new Date(startDateVal)) {
          errors.end_date = "Scheduled Completion Date must be after Start Date.";
        } else {
          delete errors.end_date;
        }
      } else {
        delete errors.end_date;
      }
    }

    setFormErrors(errors);
    setFormWarnings(warnings);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    const updated = { ...formData, [name]: value };
    setFormData(updated);
    validateField(name, value, updated);
  };

  const handleCreateProjectSubmit = (e) => {
    e.preventDefault();
    setSubmitError('');

    const nameClean = formData.name.trim();
    if (!nameClean) {
      setFormErrors(prev => ({ ...prev, name: "Project / Contract Name is required." }));
      return;
    }
    if (nameClean.length > 120) {
      setFormErrors(prev => ({ ...prev, name: "Project Name cannot exceed 120 characters." }));
      return;
    }

    const codeClean = formData.code.trim();
    if (!codeClean) {
      setFormErrors(prev => ({ ...prev, code: "Project Code is required." }));
      return;
    }

    const isDuplicate = projects.some(
      p => p.name.trim().toLowerCase() === nameClean.toLowerCase()
    );
    if (isDuplicate) {
      setFormErrors(prev => ({ ...prev, name: "A project with this name already exists in your organization." }));
      return;
    }

    if (formData.budget !== '' && formData.budget !== null && formData.budget !== undefined) {
      const budgetNum = parseFloat(formData.budget);
      if (isNaN(budgetNum) || budgetNum < 0) {
        setFormErrors(prev => ({ ...prev, budget: "Estimated Contract Value cannot be negative." }));
        return;
      }
    }

    if (formData.start_date && formData.end_date) {
      if (new Date(formData.end_date) <= new Date(formData.start_date)) {
        setFormErrors(prev => ({ ...prev, end_date: "Scheduled Completion Date must be after Start Date." }));
        return;
      }
    }

    // Safety fallback for contract type if P2 is disabled
    let contractType = formData.contract_type || 'Item Rate';
    if (!tenantSettings.is_p2_enabled && ['Percentage Rate', 'EPC'].includes(contractType)) {
      contractType = 'Item Rate';
    }

    const payload = {
      name: nameClean,
      code: codeClean,
      tenant_name: formData.tenant_name || 'Default Tenant',
      division_id: formData.division_id ? parseInt(formData.division_id) : null,
      contract_type: contractType,
      funding_mode: tenantSettings.is_funding_mode_enabled ? (formData.funding_mode || 'Budgeted') : 'Budgeted',
      currency: formData.currency || 'INR',
      client_id: formData.client_id ? parseInt(formData.client_id) : null,
      manager_id: formData.manager_id ? parseInt(formData.manager_id) : null,
      location: formData.location ? formData.location.trim() : null,
      latitude: formData.latitude ? parseFloat(formData.latitude) : null,
      longitude: formData.longitude ? parseFloat(formData.longitude) : null,
      start_date: formData.start_date ? new Date(formData.start_date).toISOString() : null,
      end_date: formData.end_date ? new Date(formData.end_date).toISOString() : null,
      budget: (formData.budget !== '' && !isNaN(parseFloat(formData.budget))) ? parseFloat(formData.budget) : 0,
      status: 'DRAFT'
    };

    projectService.createProject(payload)
      .then(() => {
        setShowModal(false);
        setFormData({
          name: '', code: '', tenant_name: 'Default Tenant', division_id: '',
          contract_type: 'Item Rate', funding_mode: 'Budgeted', currency: 'INR',
          client_id: '', manager_id: '', location: '', latitude: '', longitude: '',
          start_date: '', end_date: '', budget: ''
        });
        setFormErrors({});
        setFormWarnings({});
        loadInitialData();
      })
      .catch((err) => {
        const msg = err.response?.data?.detail || "Failed to register construction project.";
        setSubmitError(msg);
      });
  };

  // Tenant Settings Toggles (P2 and Funding Mode)
  const handleToggleP2 = () => {
    if (!isAdmin) {
      alert("Forbidden: Only tenant administrators are authorized to modify feature flags.");
      return;
    }
    const updated = !tenantSettings.is_p2_enabled;
    projectService.updateTenantSettings({ is_p2_enabled: updated })
      .then(res => {
        setTenantSettings(prev => ({ ...prev, is_p2_enabled: res.data.is_p2_enabled }));
        if (!res.data.is_p2_enabled && ['Percentage Rate', 'EPC'].includes(formData.contract_type)) {
          setFormData(prev => ({ ...prev, contract_type: 'Item Rate' }));
        }
      })
      .catch(err => {
        const msg = err.response?.data?.detail || "Failed to update feature flags.";
        alert(msg);
      });
  };

  const handleToggleFundingMode = () => {
    if (!isAdmin) {
      alert("Forbidden: Only tenant administrators are authorized to modify feature flags.");
      return;
    }
    const updated = !tenantSettings.is_funding_mode_enabled;
    projectService.updateTenantSettings({ is_funding_mode_enabled: updated })
      .then(res => {
        setTenantSettings(prev => ({ ...prev, is_funding_mode_enabled: res.data.is_funding_mode_enabled }));
      })
      .catch(err => {
        const msg = err.response?.data?.detail || "Failed to update feature flags.";
        alert(msg);
      });
  };

  // Master Data Modal Actions
  const openMasterModal = (category, tab = 'add') => {
    setMasterModal({
      isOpen: true,
      category,
      tab,
      error: '',
      success: '',
      loading: false
    });
  };

  const closeMasterModal = () => {
    setMasterModal(prev => ({ ...prev, isOpen: false, error: '', success: '' }));
  };

  // Add Option Submit Handlers
  const handleAddMasterOption = (e) => {
    e.preventDefault();
    setMasterModal(prev => ({ ...prev, error: '', success: '', loading: true }));

    if (masterModal.category === 'division') {
      if (!newDivName.trim() || !newDivCode.trim()) {
        setMasterModal(prev => ({ ...prev, error: "Division Name and Code are required.", loading: false }));
        return;
      }
      projectService.createDivision({ name: newDivName.trim(), code: newDivCode.trim() })
        .then(res => {
          setNewDivName('');
          setNewDivCode('');
          setMasterModal(prev => ({ ...prev, success: `Division '${res.data.name}' added successfully.`, loading: false }));
          setFormData(prev => ({ ...prev, division_id: res.data.id }));
          loadInitialData();
        })
        .catch(err => {
          setMasterModal(prev => ({ ...prev, error: err.response?.data?.detail || "Failed to add division.", loading: false }));
        });

    } else if (masterModal.category === 'client') {
      if (!newClientName.trim()) {
        setMasterModal(prev => ({ ...prev, error: "Client Name is required.", loading: false }));
        return;
      }
      customerService.createCustomer({
        name: newClientName.trim(),
        company: newClientCompany.trim() || 'Client',
        email: newClientEmail.trim() || null,
        phone: newClientPhone.trim() || null,
        customer_type: 'Corporate',
        status: 'active'
      })
        .then(res => {
          setNewClientName('');
          setNewClientCompany('');
          setNewClientEmail('');
          setNewClientPhone('');
          setMasterModal(prev => ({ ...prev, success: `Client '${res.data.name}' created successfully.`, loading: false }));
          setFormData(prev => ({ ...prev, client_id: res.data.id }));
          loadInitialData();
        })
        .catch(err => {
          setMasterModal(prev => ({ ...prev, error: err.response?.data?.detail || "Failed to add client.", loading: false }));
        });

    } else if (masterModal.category === 'manager') {
      if (!newManagerUsername.trim() || !newManagerFullName.trim()) {
        setMasterModal(prev => ({ ...prev, error: "Username and Full Name are required.", loading: false }));
        return;
      }
      authService.register({
        username: newManagerUsername.trim(),
        full_name: newManagerFullName.trim(),
        email: newManagerEmail.trim() || `${newManagerUsername.trim().toLowerCase()}@erp.local`,
        password: newManagerPassword || 'password123',
        role: 'project_manager'
      })
        .then(res => {
          setNewManagerUsername('');
          setNewManagerFullName('');
          setNewManagerEmail('');
          setMasterModal(prev => ({ ...prev, success: `Project Manager '${res.data.full_name}' created successfully.`, loading: false }));
          setFormData(prev => ({ ...prev, manager_id: res.data.id }));
          loadInitialData();
        })
        .catch(err => {
          setMasterModal(prev => ({ ...prev, error: err.response?.data?.detail || "Failed to add project manager.", loading: false }));
        });

    } else if (masterModal.category === 'funding_mode') {
      const modeVal = newFundingModeName.trim();
      if (!modeVal) {
        setMasterModal(prev => ({ ...prev, error: "Funding Mode name is required.", loading: false }));
        return;
      }
      projectService.addMasterDataOption('funding_mode', modeVal)
        .then(() => {
          setNewFundingModeName('');
          setMasterModal(prev => ({ ...prev, success: `Funding Mode '${modeVal}' added successfully.`, loading: false }));
          setFormData(prev => ({ ...prev, funding_mode: modeVal }));
          loadInitialData();
        })
        .catch(err => {
          setMasterModal(prev => ({ ...prev, error: err.response?.data?.detail || "Failed to add funding mode.", loading: false }));
        });

    } else if (masterModal.category === 'currency') {
      const codeVal = newCurrencyCode.trim().toUpperCase();
      if (!codeVal) {
        setMasterModal(prev => ({ ...prev, error: "Currency Code (e.g. SGD) is required.", loading: false }));
        return;
      }
      const labelVal = newCurrencyLabel.trim() || `${codeVal} — Custom Currency`;
      projectService.addMasterDataOption('currency', codeVal, labelVal)
        .then(() => {
          setNewCurrencyCode('');
          setNewCurrencyLabel('');
          setMasterModal(prev => ({ ...prev, success: `Currency '${codeVal}' added successfully.`, loading: false }));
          setFormData(prev => ({ ...prev, currency: codeVal }));
          loadInitialData();
        })
        .catch(err => {
          setMasterModal(prev => ({ ...prev, error: err.response?.data?.detail || "Failed to add currency.", loading: false }));
        });
    }
  };

  // Delete Option Handlers with In-Use Safety Rejection
  const handleDeleteOption = (category, identifier) => {
    setMasterModal(prev => ({ ...prev, error: '', success: '', loading: true }));

    if (category === 'division') {
      projectService.deleteDivision(identifier)
        .then(() => {
          setMasterModal(prev => ({ ...prev, success: "Division deleted successfully.", loading: false }));
          loadInitialData();
        })
        .catch(err => {
          const msg = err.response?.data?.detail || "Failed to delete division.";
          setMasterModal(prev => ({ ...prev, error: msg, loading: false }));
        });

    } else if (category === 'client') {
      customerService.deleteCustomer(identifier)
        .then(() => {
          setMasterModal(prev => ({ ...prev, success: "Client deleted successfully.", loading: false }));
          loadInitialData();
        })
        .catch(err => {
          const msg = err.response?.data?.detail || "Failed to delete client.";
          setMasterModal(prev => ({ ...prev, error: msg, loading: false }));
        });

    } else if (category === 'manager') {
      authService.deleteUser(identifier)
        .then(() => {
          setMasterModal(prev => ({ ...prev, success: "Project manager deleted successfully.", loading: false }));
          loadInitialData();
        })
        .catch(err => {
          const msg = err.response?.data?.detail || "Failed to delete project manager.";
          setMasterModal(prev => ({ ...prev, error: msg, loading: false }));
        });

    } else if (category === 'funding_mode') {
      projectService.deleteMasterDataOption('funding_mode', identifier)
        .then(() => {
          setMasterModal(prev => ({ ...prev, success: `Funding mode '${identifier}' removed successfully.`, loading: false }));
          loadInitialData();
        })
        .catch(err => {
          const msg = err.response?.data?.detail || "Failed to remove funding mode.";
          setMasterModal(prev => ({ ...prev, error: msg, loading: false }));
        });

    } else if (category === 'currency') {
      projectService.deleteMasterDataOption('currency', identifier)
        .then(() => {
          setMasterModal(prev => ({ ...prev, success: `Currency '${identifier}' removed successfully.`, loading: false }));
          loadInitialData();
        })
        .catch(err => {
          const msg = err.response?.data?.detail || "Failed to remove currency.";
          setMasterModal(prev => ({ ...prev, error: msg, loading: false }));
        });
    }
  };

  const handleToggleDivisionActive = (divId, currentActive) => {
    projectService.toggleDivisionActive(divId, !currentActive)
      .then(() => loadInitialData())
      .catch(err => setMasterModal(prev => ({ ...prev, error: "Failed to toggle division active status." })));
  };

  const handleToggleUserStatus = (userId) => {
    authService.toggleUserStatus(userId)
      .then(() => loadInitialData())
      .catch(err => setMasterModal(prev => ({ ...prev, error: "Failed to toggle user status." })));
  };

  const isSE = (userRole || '').toLowerCase() === 'site_engineer';
  const durationCalculated = calculateDurationDays(formData.start_date, formData.end_date);

  return (
    <div className="content-page">
      {/* Header */}
      <div style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 className="page-title">{isSE ? "My Sites" : "Construction Projects"}</h1>
          <p className="page-subtitle">
            {isSE ? "View and execute your assigned construction sites" : "PSC-01 Enterprise Project & Contract Management System"}
          </p>
        </div>
        
        {!isSE && (
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <button 
              className="btn btn-secondary"
              style={{ fontSize: '0.85rem', display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
              onClick={() => setShowSettingsModal(true)}
              title="Configure Feature Flags & Settings"
            >
              <Settings size={16} /> Feature Flags
            </button>
            <button 
              className="btn btn-secondary"
              style={{ fontSize: '0.85rem', display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
              onClick={() => openMasterModal('division', 'manage')}
              title="Manage Tenant Divisions / Circles"
            >
              <Building2 size={16} /> Divisions / Circles
            </button>
            <button className="btn btn-primary" onClick={() => setShowModal(true)}>
              <Plus size={18} /> New Construction Project
            </button>
          </div>
        )}
      </div>

      {/* Feature Flags Active Status Bar */}
      <div style={{ background: 'rgba(15,23,42,0.6)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', padding: '0.75rem 1.25rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.82rem', color: '#cbd5e1', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', flexWrap: 'wrap' }}>
          <span style={{ fontWeight: 600, color: '#f8fafc' }}>Tenant Config:</span>
          <span>
            P2 (Percentage Rate / EPC):{' '}
            <strong style={{ color: tenantSettings.is_p2_enabled ? '#10b981' : '#f59e0b' }}>
              {tenantSettings.is_p2_enabled ? 'ENABLED' : 'DISABLED (Item Rate Default Only)'}
            </strong>
          </span>
          <span>
            Funding Mode Field:{' '}
            <strong style={{ color: tenantSettings.is_funding_mode_enabled ? '#10b981' : '#64748b' }}>
              {tenantSettings.is_funding_mode_enabled ? 'ENABLED' : 'HIDDEN (Defaults to Budgeted)'}
            </strong>
          </span>
        </div>
        <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
          Active Divisions: {divisions.length}
        </span>
      </div>

      {/* Site / Project Cards Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '1.5rem' }}>
        {projects.length === 0 ? (
          <div className="glass-card" style={{ gridColumn: '1 / -1', padding: '3rem', textAlign: 'center', color: '#64748b' }}>
            {loading ? "Loading sites..." : "No assigned sites registered."}
          </div>
        ) : (
          projects.map((p) => {
            const isDraft = (p.status || '').toUpperCase() === 'DRAFT';
            const currentPhase = p.current_phase || (isDraft ? 'PHASE 1 — PROJECT CREATION' : 'PHASE 1 — PROJECT CREATION');

            return (
              <div
                key={p.id}
                className="glass-card"
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  padding: '1.25rem',
                  border: isDraft ? '1px solid rgba(245,158,11,0.3)' : '1px solid rgba(255,255,255,0.08)',
                  transition: 'all 0.2s ease',
                  position: 'relative',
                  minWidth: 0
                }}
              >
                <div>
                  {/* Title & Status Row */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.65rem', gap: '0.75rem' }}>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      {/* CHANGE 2: Standardized Project Name + Project Code Format */}
                      <h3 
                        style={{ 
                          margin: 0, 
                          color: '#f8fafc', 
                          fontSize: '1.08rem', 
                          fontWeight: 700,
                          lineHeight: '1.35',
                          wordBreak: 'break-word',
                          overflowWrap: 'break-word'
                        }}
                        title={p.name}
                      >
                        🏗️ {p.name}
                      </h3>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '0.35rem', flexWrap: 'wrap' }}>
                        <span 
                          className="tag-badge tag-info" 
                          style={{ 
                            fontSize: '0.72rem', 
                            fontFamily: 'monospace', 
                            fontWeight: 700,
                            letterSpacing: '0.03em',
                            maxWidth: '100%',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap'
                          }}
                          title={p.code}
                        >
                          {p.code}
                        </span>
                        {p.contract_type && (
                          <span className="tag-badge" style={{ fontSize: '0.72rem', background: 'rgba(56,189,248,0.15)', color: '#38bdf8' }}>
                            {p.contract_type}
                          </span>
                        )}
                      </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', flexShrink: 0 }}>
                      <span style={{ fontSize: '0.65rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.05em' }}>
                        PROJECT STATUS
                      </span>
                      <span 
                        className={`tag-badge ${isDraft ? 'tag-warning' : 'tag-success'}`} 
                        style={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.05em', marginTop: '0.15rem' }}
                      >
                        {p.status ? p.status.toUpperCase() : 'DRAFT'}
                      </span>
                    </div>
                  </div>

                  {/* CHANGE 1: Current Project Phase Indicator */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    background: 'rgba(15, 23, 42, 0.7)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    borderRadius: '6px',
                    padding: '0.35rem 0.65rem',
                    marginBottom: '0.85rem'
                  }}>
                    <span style={{ fontSize: '0.67rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.05em' }}>
                      CURRENT PHASE
                    </span>
                    <span style={{
                      fontSize: '0.74rem',
                      fontWeight: 700,
                      letterSpacing: '0.02em',
                      color: currentPhase.includes('PHASE 1') ? '#38bdf8' :
                             currentPhase.includes('PHASE 2') ? '#f59e0b' :
                             currentPhase.includes('PHASE 3') ? '#10b981' :
                             currentPhase.includes('PHASE 4') ? '#818cf8' : '#c084fc'
                    }}>
                      {currentPhase}
                    </span>
                  </div>

                  {/* Division Snapshot, Location, Schedule & Currency-Aware Budget */}
                  <div style={{ fontSize: '0.85rem', color: '#94a3b8', marginBottom: '1rem', display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                    {p.division_name && (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', color: '#cbd5e1' }}>
                        <Building2 size={14} color="#818cf8" /> Division: <strong>{p.division_name}</strong>
                      </span>
                    )}
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
                      <MapPin size={14} color="#06b6d4" /> {p.location || 'Location not specified'}
                    </span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
                      <Calendar size={14} color="#818cf8" /> {new Date(p.start_date).toLocaleDateString()} ──► {new Date(p.end_date).toLocaleDateString()}
                      {p.contract_duration_days ? ` (${p.contract_duration_days} Days)` : ''}
                    </span>
                    {/* CHANGE 5: Currency-aware Estimated Contract Value */}
                    <span style={{ fontSize: '0.82rem', color: '#e2e8f0', marginTop: '0.2rem' }}>
                      Estimated Contract Value: <strong>{formatProjectCurrency(p.budget, p.currency)}</strong>
                    </span>
                  </div>

                  {/* Physical Progress */}
                  <div style={{ marginBottom: '1rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '0.35rem' }}>
                      <span style={{ color: '#94a3b8' }}>Physical Progress</span>
                      <strong style={{ color: '#10b981' }}>{p.progress_pct || 0}%</strong>
                    </div>
                    <div style={{ height: '8px', background: 'rgba(255,255,255,0.08)', borderRadius: '9999px', overflow: 'hidden' }}>
                      <div style={{ width: `${p.progress_pct || 0}%`, height: '100%', background: 'linear-gradient(90deg, #10b981, #06b6d4)', borderRadius: '9999px' }} />
                    </div>
                  </div>

                  {/* Activation Notice for Draft projects */}
                  {isDraft && (
                    <div style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', padding: '0.5rem 0.75rem', borderRadius: '6px', fontSize: '0.75rem', color: '#fbbf24', marginBottom: '0.85rem' }}>
                      🔒 Project is in DRAFT. Activation requires attached BOQ + Detailed Estimate + Technical Sanction.
                    </div>
                  )}
                </div>

                {/* Card Footer Action */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '0.75rem', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                  <button
                    className="btn btn-primary"
                    style={{
                      fontSize: '0.82rem',
                      padding: '0.45rem 0.9rem',
                      borderRadius: '6px',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.4rem',
                      background: isSE ? 'linear-gradient(135deg, #10b981, #059669)' : undefined
                    }}
                    onClick={() => navigate(`/projects/${p.id}`)}
                  >
                    <span>{isSE ? "Open Site" : "Open Project"}</span> <ArrowRight size={15} />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* --- CREATE PROJECT MODAL (PSC-01 IMPLEMENTATION) --- */}
      {showModal && !isSE && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.82)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
          <div className="glass-card custom-modal-scroll" style={{ width: '100%', maxWidth: '840px', maxHeight: '90vh', overflowY: 'auto', overflowX: 'hidden', background: '#1e293b', padding: '1.75rem', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '12px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.7)' }}>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '0.85rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <h3 style={{ margin: 0, color: '#f8fafc', fontSize: '1.3rem', fontWeight: 700 }}>Register Construction Project</h3>
                <span className="tag-badge tag-warning" style={{ fontSize: '0.8rem', fontWeight: 700 }}>STATUS: DRAFT</span>
              </div>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#94a3b8', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '32px', height: '32px', borderRadius: '6px', transition: 'all 0.2s' }}
                onMouseEnter={e => { e.currentTarget.style.color = '#f8fafc'; e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; }}
                onMouseLeave={e => { e.currentTarget.style.color = '#94a3b8'; e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; }}
                title="Close modal"
              >
                <X size={18} />
              </button>
            </div>

            {submitError && (
              <div style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid #ef4444', color: '#fca5a5', padding: '0.75rem 1rem', borderRadius: '6px', marginBottom: '1.25rem', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <AlertTriangle size={18} color="#ef4444" />
                <span>{submitError}</span>
              </div>
            )}

            <form onSubmit={handleCreateProjectSubmit}>
              {/* SECTION 1: PROJECT / CONTRACT DETAILS */}
              <div style={{ background: 'rgba(15,23,42,0.4)', padding: '1.1rem', borderRadius: '8px', marginBottom: '1.25rem', border: '1px solid rgba(255,255,255,0.05)' }}>
                <h4 style={{ margin: '0 0 0.85rem 0', color: '#38bdf8', fontSize: '0.9rem', letterSpacing: '0.05em' }}>
                  1. PROJECT / CONTRACT DETAILS
                </h4>

                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1rem', marginBottom: '0.85rem' }}>
                  <div className="form-group" style={{ margin: 0, minWidth: 0 }}>
                    <label style={{ fontSize: '0.82rem' }}>Project / Contract Name <span style={{ color: '#ef4444' }}>*</span></label>
                    <input
                      required
                      type="text"
                      maxLength={120}
                      className="form-control"
                      placeholder="e.g. Greenfield Data Center Park"
                      value={formData.name}
                      onChange={handleInputChange}
                      name="name"
                      style={{ borderColor: formErrors.name ? '#ef4444' : undefined }}
                    />
                    {formErrors.name && (
                      <span style={{ color: '#fca5a5', fontSize: '0.78rem', marginTop: '0.25rem', display: 'block' }}>
                        ⚠️ {formErrors.name}
                      </span>
                    )}
                    <span style={{ fontSize: '0.72rem', color: '#64748b', textAlign: 'right', display: 'block', marginTop: '0.2rem' }}>
                      {formData.name.length} / 120 chars
                    </span>
                  </div>

                  <div className="form-group" style={{ margin: 0, minWidth: 0 }}>
                    <label style={{ fontSize: '0.82rem' }}>Project Code <span style={{ color: '#ef4444' }}>*</span></label>
                    <input
                      required
                      type="text"
                      className="form-control"
                      placeholder="PROJ-GREENFIELD-01"
                      value={formData.code}
                      onChange={handleInputChange}
                      name="code"
                      style={{ borderColor: formErrors.code ? '#ef4444' : undefined }}
                    />
                    {formErrors.code && (
                      <span style={{ color: '#fca5a5', fontSize: '0.78rem', marginTop: '0.25rem', display: 'block' }}>
                        ⚠️ {formErrors.code}
                      </span>
                    )}
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '1rem' }}>
                  <div className="form-group" style={{ margin: 0, minWidth: 0 }}>
                    <label style={{ fontSize: '0.82rem' }}>Tenant (System)</label>
                    <input
                      readOnly
                      disabled
                      type="text"
                      className="form-control"
                      value={formData.tenant_name}
                      style={{ background: 'rgba(0,0,0,0.3)', color: '#94a3b8', cursor: 'not-allowed' }}
                    />
                  </div>

                  {/* CHANGE 6: Division Dropdown with [ + Add ] [ Manage / Delete ] */}
                  <div className="form-group" style={{ margin: 0, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                      <label style={{ fontSize: '0.82rem', margin: 0 }}>Division / Circle</label>
                      <div style={{ display: 'flex', gap: '0.35rem', fontSize: '0.72rem' }}>
                        <button 
                          type="button" 
                          onClick={() => openMasterModal('division', 'add')}
                          style={{ background: 'transparent', border: 'none', color: '#38bdf8', cursor: 'pointer', padding: 0, textDecoration: 'underline' }}
                        >
                          + Add
                        </button>
                        <span style={{ color: '#64748b' }}>|</span>
                        <button 
                          type="button" 
                          onClick={() => openMasterModal('division', 'manage')}
                          style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: 0, textDecoration: 'underline' }}
                        >
                          Manage / Delete
                        </button>
                      </div>
                    </div>
                    <select
                      className="form-control"
                      name="division_id"
                      value={formData.division_id}
                      onChange={handleInputChange}
                    >
                      <option value="">-- Select Active Division --</option>
                      {divisions.map(d => (
                        <option key={d.id} value={d.id}>{d.name} ({d.code})</option>
                      ))}
                    </select>
                  </div>

                  {/* CHANGE 4: Contract Type Governed by P2 Feature Flag (Fixed/System Controlled) */}
                  <div className="form-group" style={{ margin: 0, minWidth: 0 }}>
                    <label style={{ fontSize: '0.82rem' }}>Contract Type</label>
                    <select
                      className="form-control"
                      name="contract_type"
                      value={formData.contract_type}
                      onChange={handleInputChange}
                    >
                      <option value="Item Rate">Item Rate (Default)</option>
                      {tenantSettings.is_p2_enabled ? (
                        <>
                          <option value="Percentage Rate">Percentage Rate</option>
                          <option value="EPC">EPC</option>
                        </>
                      ) : null}
                    </select>
                    {!tenantSettings.is_p2_enabled && (
                      <span style={{ fontSize: '0.72rem', color: '#f59e0b', marginTop: '0.3rem', display: 'block', lineHeight: '1.3' }}>
                        ℹ️ Percentage Rate & EPC require tenant P2 feature.
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* SECTION 2: PROJECT INFORMATION */}
              <div style={{ background: 'rgba(15,23,42,0.4)', padding: '1.1rem', borderRadius: '8px', marginBottom: '1.25rem', border: '1px solid rgba(255,255,255,0.05)' }}>
                <h4 style={{ margin: '0 0 0.85rem 0', color: '#38bdf8', fontSize: '0.9rem', letterSpacing: '0.05em' }}>
                  2. PROJECT INFORMATION
                </h4>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '1rem', marginBottom: '0.85rem' }}>
                  {/* CHANGE 6: Client Dropdown with [ + Add ] [ Manage / Delete ] */}
                  <div className="form-group" style={{ margin: 0, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                      <label style={{ fontSize: '0.82rem', margin: 0 }}>Client</label>
                      <div style={{ display: 'flex', gap: '0.35rem', fontSize: '0.72rem' }}>
                        <button 
                          type="button" 
                          onClick={() => openMasterModal('client', 'add')}
                          style={{ background: 'transparent', border: 'none', color: '#38bdf8', cursor: 'pointer', padding: 0, textDecoration: 'underline' }}
                        >
                          + Add
                        </button>
                        <span style={{ color: '#64748b' }}>|</span>
                        <button 
                          type="button" 
                          onClick={() => openMasterModal('client', 'manage')}
                          style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: 0, textDecoration: 'underline' }}
                        >
                          Manage / Delete
                        </button>
                      </div>
                    </div>
                    <select
                      className="form-control"
                      name="client_id"
                      value={formData.client_id}
                      onChange={handleInputChange}
                    >
                      <option value="">-- Select Client --</option>
                      {customers.map(c => (
                        <option key={c.id} value={c.id}>{c.name} ({c.company || 'Client'})</option>
                      ))}
                    </select>
                  </div>

                  {/* CHANGE 6: Project Manager Dropdown with [ + Add ] [ Manage / Delete ] */}
                  <div className="form-group" style={{ margin: 0, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                      <label style={{ fontSize: '0.82rem', margin: 0 }}>Project Manager</label>
                      <div style={{ display: 'flex', gap: '0.35rem', fontSize: '0.72rem' }}>
                        <button 
                          type="button" 
                          onClick={() => openMasterModal('manager', 'add')}
                          style={{ background: 'transparent', border: 'none', color: '#38bdf8', cursor: 'pointer', padding: 0, textDecoration: 'underline' }}
                        >
                          + Add
                        </button>
                        <span style={{ color: '#64748b' }}>|</span>
                        <button 
                          type="button" 
                          onClick={() => openMasterModal('manager', 'manage')}
                          style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: 0, textDecoration: 'underline' }}
                        >
                          Manage / Delete
                        </button>
                      </div>
                    </div>
                    <select
                      className="form-control"
                      name="manager_id"
                      value={formData.manager_id}
                      onChange={handleInputChange}
                    >
                      <option value="">-- Select Project Manager --</option>
                      {users
                        .filter(u => u.is_active !== false && (['project_manager', 'contractor_pm', 'admin', 'management'].includes((u.role || '').toLowerCase()) || users.length <= 5))
                        .map(u => (
                          <option key={u.id} value={u.id}>{u.full_name} ({u.role})</option>
                        ))}
                    </select>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '1rem', marginBottom: '0.85rem' }}>
                  <div className="form-group" style={{ margin: 0, minWidth: 0 }}>
                    <label style={{ fontSize: '0.82rem' }}>Site Location</label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="Financial District Plaza, Central Avenue"
                      value={formData.location}
                      onChange={handleInputChange}
                      name="location"
                    />
                  </div>

                  <div className="form-group" style={{ margin: 0, minWidth: 0 }}>
                    <label style={{ fontSize: '0.82rem' }}>Latitude (GPS Pin)</label>
                    <input
                      type="number"
                      step="any"
                      className="form-control"
                      placeholder="30.2672"
                      value={formData.latitude}
                      onChange={handleInputChange}
                      name="latitude"
                    />
                  </div>

                  <div className="form-group" style={{ margin: 0, minWidth: 0 }}>
                    <label style={{ fontSize: '0.82rem' }}>Longitude (GPS Pin)</label>
                    <input
                      type="number"
                      step="any"
                      className="form-control"
                      placeholder="-97.7431"
                      value={formData.longitude}
                      onChange={handleInputChange}
                      name="longitude"
                    />
                  </div>
                </div>

                {/* CHANGE 5: Currency Selection and CHANGE 4: Funding Mode */}
                <div style={{ display: 'grid', gridTemplateColumns: tenantSettings.is_funding_mode_enabled ? '1fr 1.5fr 1.5fr' : '1fr 2fr', gap: '1rem' }}>
                  {/* Currency Selection Dropdown */}
                  <div className="form-group" style={{ margin: 0, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                      <label style={{ fontSize: '0.82rem', margin: 0 }}>Currency</label>
                      <div style={{ display: 'flex', gap: '0.35rem', fontSize: '0.72rem' }}>
                        <button 
                          type="button" 
                          onClick={() => openMasterModal('currency', 'add')}
                          style={{ background: 'transparent', border: 'none', color: '#38bdf8', cursor: 'pointer', padding: 0, textDecoration: 'underline' }}
                        >
                          + Add
                        </button>
                        <span style={{ color: '#64748b' }}>|</span>
                        <button 
                          type="button" 
                          onClick={() => openMasterModal('currency', 'manage')}
                          style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: 0, textDecoration: 'underline' }}
                        >
                          Manage
                        </button>
                      </div>
                    </div>
                    <select
                      className="form-control"
                      name="currency"
                      value={formData.currency}
                      onChange={handleInputChange}
                    >
                      {availableCurrencies.map(c => (
                        <option key={c.code} value={c.code}>{c.label}</option>
                      ))}
                    </select>
                  </div>

                  {/* Estimated Contract Value Input (Displays selected currency symbol) */}
                  <div className="form-group" style={{ margin: 0, minWidth: 0 }}>
                    <label style={{ fontSize: '0.82rem' }}>
                      Estimated Contract Value ({formData.currency || 'INR'})
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      className="form-control"
                      placeholder="4500000.00"
                      value={formData.budget}
                      onChange={handleInputChange}
                      name="budget"
                      style={{ borderColor: formErrors.budget ? '#ef4444' : undefined }}
                    />
                    {formErrors.budget && (
                      <span style={{ color: '#fca5a5', fontSize: '0.78rem', marginTop: '0.25rem', display: 'block' }}>
                        ⚠️ {formErrors.budget}
                      </span>
                    )}
                  </div>

                  {/* CHANGE 4 & 6: Funding Mode Field (Only if enabled via Tenant Feature Flags) */}
                  {tenantSettings.is_funding_mode_enabled && (
                    <div className="form-group" style={{ margin: 0, minWidth: 0 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                        <label style={{ fontSize: '0.82rem', margin: 0 }}>Funding Mode</label>
                        <div style={{ display: 'flex', gap: '0.35rem', fontSize: '0.72rem' }}>
                          <button 
                            type="button" 
                            onClick={() => openMasterModal('funding_mode', 'add')}
                            style={{ background: 'transparent', border: 'none', color: '#38bdf8', cursor: 'pointer', padding: 0, textDecoration: 'underline' }}
                          >
                            + Add
                          </button>
                          <span style={{ color: '#64748b' }}>|</span>
                          <button 
                            type="button" 
                            onClick={() => openMasterModal('funding_mode', 'manage')}
                            style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: 0, textDecoration: 'underline' }}
                          >
                            Manage
                          </button>
                        </div>
                      </div>
                      <select
                        className="form-control"
                        name="funding_mode"
                        value={formData.funding_mode}
                        onChange={handleInputChange}
                      >
                        {availableFundingModes.map(m => (
                          <option key={m} value={m}>{m}</option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              </div>

              {/* SECTION 3: SCHEDULE & DURATION */}
              <div style={{ background: 'rgba(15,23,42,0.4)', padding: '1.1rem', borderRadius: '8px', marginBottom: '1.25rem', border: '1px solid rgba(255,255,255,0.05)' }}>
                <h4 style={{ margin: '0 0 0.85rem 0', color: '#38bdf8', fontSize: '0.9rem', letterSpacing: '0.05em' }}>
                  3. SCHEDULE & DURATION
                </h4>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '1rem' }}>
                  <div className="form-group" style={{ margin: 0, minWidth: 0 }}>
                    <label style={{ fontSize: '0.82rem' }}>Start Date</label>
                    <input
                      type="date"
                      className="form-control"
                      value={formData.start_date}
                      onChange={handleInputChange}
                      name="start_date"
                    />
                    {formWarnings.start_date && (
                      <span style={{ color: '#fbbf24', fontSize: '0.75rem', marginTop: '0.25rem', display: 'block' }}>
                        ⚠️ {formWarnings.start_date}
                      </span>
                    )}
                  </div>

                  <div className="form-group" style={{ margin: 0, minWidth: 0 }}>
                    <label style={{ fontSize: '0.82rem' }}>Scheduled Completion Date</label>
                    <input
                      type="date"
                      className="form-control"
                      value={formData.end_date}
                      onChange={handleInputChange}
                      name="end_date"
                      style={{ borderColor: formErrors.end_date ? '#ef4444' : undefined }}
                    />
                    {formErrors.end_date && (
                      <span style={{ color: '#fca5a5', fontSize: '0.78rem', marginTop: '0.25rem', display: 'block' }}>
                        ⚠️ {formErrors.end_date}
                      </span>
                    )}
                  </div>

                  <div className="form-group" style={{ margin: 0, minWidth: 0 }}>
                    <label style={{ fontSize: '0.82rem' }}>Contract Duration (Calculated)</label>
                    <input
                      readOnly
                      disabled
                      type="text"
                      className="form-control"
                      value={`${durationCalculated} Days`}
                      style={{ background: 'rgba(0,0,0,0.3)', color: '#38bdf8', fontWeight: 700, cursor: 'not-allowed' }}
                    />
                  </div>
                </div>
              </div>

              {/* SECTION 4: STATUS */}
              <div style={{ background: 'rgba(245,158,11,0.08)', padding: '0.85rem 1rem', borderRadius: '8px', marginBottom: '1.5rem', border: '1px solid rgba(245,158,11,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', fontSize: '0.85rem', color: '#fbbf24' }}>
                  <Info size={18} />
                  <span><strong>Status Rule:</strong> Newly registered projects automatically enter <strong>DRAFT</strong> status.</span>
                </div>
                <span className="tag-badge tag-warning" style={{ fontSize: '0.8rem', fontWeight: 700 }}>DRAFT</span>
              </div>

              {/* Modal Actions */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" style={{ padding: '0.55rem 1.5rem' }}>
                  Register Construction Project
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- CHANGE 6: UNIFIED MASTER DATA MANAGEMENT MODAL --- */}
      {masterModal.isOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, padding: '1rem' }}>
          <div className="glass-card" style={{ width: '100%', maxWidth: '680px', maxHeight: '90vh', overflowY: 'auto', background: '#1e293b', padding: '1.5rem', borderRadius: '12px' }}>
            
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '0.75rem' }}>
              <div>
                <h3 style={{ margin: 0, color: '#f8fafc', fontSize: '1.15rem', textTransform: 'capitalize' }}>
                  Manage {masterModal.category.replace('_', ' ')} Options
                </h3>
                <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                  Configure user-maintainable dropdown options for {masterModal.category.replace('_', ' ')}
                </span>
              </div>
              <button className="btn btn-sm btn-secondary" onClick={closeMasterModal}>Close</button>
            </div>

            {/* Error / Success Feedback Alerts */}
            {masterModal.error && (
              <div style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid #ef4444', color: '#fca5a5', padding: '0.65rem 0.85rem', borderRadius: '6px', marginBottom: '1rem', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <AlertTriangle size={16} color="#ef4444" style={{ flexShrink: 0 }} />
                <span>{masterModal.error}</span>
              </div>
            )}
            {masterModal.success && (
              <div style={{ background: 'rgba(16,185,129,0.15)', border: '1px solid #10b981', color: '#6ee7b7', padding: '0.65rem 0.85rem', borderRadius: '6px', marginBottom: '1rem', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Check size={16} color="#10b981" style={{ flexShrink: 0 }} />
                <span>{masterModal.success}</span>
              </div>
            )}

            {/* Tab Selector: [ + Add New ] / [ View & Manage Existing ] */}
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '0.5rem' }}>
              <button
                type="button"
                className={`btn btn-sm ${masterModal.tab === 'add' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ fontSize: '0.8rem' }}
                onClick={() => setMasterModal(prev => ({ ...prev, tab: 'add', error: '', success: '' }))}
              >
                + Add Option
              </button>
              <button
                type="button"
                className={`btn btn-sm ${masterModal.tab === 'manage' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ fontSize: '0.8rem' }}
                onClick={() => setMasterModal(prev => ({ ...prev, tab: 'manage', error: '', success: '' }))}
              >
                Manage / Delete Options
              </button>
            </div>

            {/* TAB 1: ADD OPTION FORM */}
            {masterModal.tab === 'add' && (
              <form onSubmit={handleAddMasterOption} style={{ background: 'rgba(0,0,0,0.2)', padding: '1rem', borderRadius: '8px' }}>
                {masterModal.category === 'division' && (
                  <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr auto', gap: '0.75rem', alignItems: 'flex-end' }}>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label style={{ fontSize: '0.78rem' }}>Division Name</label>
                      <input
                        required
                        type="text"
                        className="form-control"
                        placeholder="e.g. Infrastructure Circle B"
                        value={newDivName}
                        onChange={e => setNewDivName(e.target.value)}
                      />
                    </div>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label style={{ fontSize: '0.78rem' }}>Code</label>
                      <input
                        required
                        type="text"
                        className="form-control"
                        placeholder="DIV-INFRA-B"
                        value={newDivCode}
                        onChange={e => setNewDivCode(e.target.value)}
                      />
                    </div>
                    <button type="submit" className="btn btn-primary" style={{ fontSize: '0.8rem', height: '38px' }} disabled={masterModal.loading}>
                      Add Division
                    </button>
                  </div>
                )}

                {masterModal.category === 'client' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                      <div className="form-group" style={{ margin: 0 }}>
                        <label style={{ fontSize: '0.78rem' }}>Client / Contact Name <span style={{ color: '#ef4444' }}>*</span></label>
                        <input
                          required
                          type="text"
                          className="form-control"
                          placeholder="e.g. Acme Corp Ltd"
                          value={newClientName}
                          onChange={e => setNewClientName(e.target.value)}
                        />
                      </div>
                      <div className="form-group" style={{ margin: 0 }}>
                        <label style={{ fontSize: '0.78rem' }}>Company / Organization</label>
                        <input
                          type="text"
                          className="form-control"
                          placeholder="e.g. Acme Infrastructure"
                          value={newClientCompany}
                          onChange={e => setNewClientCompany(e.target.value)}
                        />
                      </div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                      <div className="form-group" style={{ margin: 0 }}>
                        <label style={{ fontSize: '0.78rem' }}>Email</label>
                        <input
                          type="email"
                          className="form-control"
                          placeholder="client@acme.com"
                          value={newClientEmail}
                          onChange={e => setNewClientEmail(e.target.value)}
                        />
                      </div>
                      <div className="form-group" style={{ margin: 0 }}>
                        <label style={{ fontSize: '0.78rem' }}>Phone</label>
                        <input
                          type="text"
                          className="form-control"
                          placeholder="+91 9876543210"
                          value={newClientPhone}
                          onChange={e => setNewClientPhone(e.target.value)}
                        />
                      </div>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                      <button type="submit" className="btn btn-primary" style={{ fontSize: '0.8rem' }} disabled={masterModal.loading}>
                        Add Client
                      </button>
                    </div>
                  </div>
                )}

                {masterModal.category === 'manager' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                      <div className="form-group" style={{ margin: 0 }}>
                        <label style={{ fontSize: '0.78rem' }}>Username <span style={{ color: '#ef4444' }}>*</span></label>
                        <input
                          required
                          type="text"
                          className="form-control"
                          placeholder="e.g. pm_sharma"
                          value={newManagerUsername}
                          onChange={e => setNewManagerUsername(e.target.value)}
                        />
                      </div>
                      <div className="form-group" style={{ margin: 0 }}>
                        <label style={{ fontSize: '0.78rem' }}>Full Name <span style={{ color: '#ef4444' }}>*</span></label>
                        <input
                          required
                          type="text"
                          className="form-control"
                          placeholder="e.g. Rajesh Sharma"
                          value={newManagerFullName}
                          onChange={e => setNewManagerFullName(e.target.value)}
                        />
                      </div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                      <div className="form-group" style={{ margin: 0 }}>
                        <label style={{ fontSize: '0.78rem' }}>Email</label>
                        <input
                          type="email"
                          className="form-control"
                          placeholder="pm@company.com"
                          value={newManagerEmail}
                          onChange={e => setNewManagerEmail(e.target.value)}
                        />
                      </div>
                      <div className="form-group" style={{ margin: 0 }}>
                        <label style={{ fontSize: '0.78rem' }}>Initial Password</label>
                        <input
                          type="password"
                          className="form-control"
                          value={newManagerPassword}
                          onChange={e => setNewManagerPassword(e.target.value)}
                        />
                      </div>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                      <button type="submit" className="btn btn-primary" style={{ fontSize: '0.8rem' }} disabled={masterModal.loading}>
                        Add Project Manager
                      </button>
                    </div>
                  </div>
                )}

                {masterModal.category === 'funding_mode' && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '0.75rem', alignItems: 'flex-end' }}>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label style={{ fontSize: '0.78rem' }}>Funding Mode Name <span style={{ color: '#ef4444' }}>*</span></label>
                      <input
                        required
                        type="text"
                        className="form-control"
                        placeholder="e.g. Multilateral Aid / Grant"
                        value={newFundingModeName}
                        onChange={e => setNewFundingModeName(e.target.value)}
                      />
                    </div>
                    <button type="submit" className="btn btn-primary" style={{ fontSize: '0.8rem', height: '38px' }} disabled={masterModal.loading}>
                      Add Mode
                    </button>
                  </div>
                )}

                {masterModal.category === 'currency' && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr auto', gap: '0.75rem', alignItems: 'flex-end' }}>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label style={{ fontSize: '0.78rem' }}>Currency Code <span style={{ color: '#ef4444' }}>*</span></label>
                      <input
                        required
                        type="text"
                        maxLength={5}
                        className="form-control"
                        placeholder="e.g. SGD"
                        value={newCurrencyCode}
                        onChange={e => setNewCurrencyCode(e.target.value.toUpperCase())}
                      />
                    </div>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label style={{ fontSize: '0.78rem' }}>Display Label</label>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="e.g. SGD — Singapore Dollar"
                        value={newCurrencyLabel}
                        onChange={e => setNewCurrencyLabel(e.target.value)}
                      />
                    </div>
                    <button type="submit" className="btn btn-primary" style={{ fontSize: '0.8rem', height: '38px' }} disabled={masterModal.loading}>
                      Add Currency
                    </button>
                  </div>
                )}
              </form>
            )}

            {/* TAB 2: MANAGE & DELETE EXISTING OPTIONS */}
            {masterModal.tab === 'manage' && (
              <div style={{ maxHeight: '380px', overflowY: 'auto' }}>
                {masterModal.category === 'division' && (
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', color: '#94a3b8', textAlign: 'left' }}>
                        <th style={{ padding: '0.5rem' }}>Division Name</th>
                        <th style={{ padding: '0.5rem' }}>Code</th>
                        <th style={{ padding: '0.5rem' }}>Status</th>
                        <th style={{ padding: '0.5rem', textAlign: 'right' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {allDivisions.map(d => (
                        <tr key={d.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', color: '#e2e8f0' }}>
                          <td style={{ padding: '0.5rem' }}>{d.name}</td>
                          <td style={{ padding: '0.5rem' }}><code>{d.code}</code></td>
                          <td style={{ padding: '0.5rem' }}>
                            <span className={`tag-badge ${d.is_active ? 'tag-success' : 'tag-danger'}`}>
                              {d.is_active ? 'ACTIVE' : 'INACTIVE'}
                            </span>
                          </td>
                          <td style={{ padding: '0.5rem', textAlign: 'right', display: 'flex', justifyContent: 'flex-end', gap: '0.4rem' }}>
                            <button
                              className={`btn btn-sm ${d.is_active ? 'btn-secondary' : 'btn-primary'}`}
                              style={{ fontSize: '0.72rem', padding: '0.2rem 0.5rem' }}
                              onClick={() => handleToggleDivisionActive(d.id, d.is_active)}
                            >
                              {d.is_active ? 'Deactivate' : 'Reactivate'}
                            </button>
                            <button
                              className="btn btn-sm btn-danger"
                              style={{ fontSize: '0.72rem', padding: '0.2rem 0.5rem' }}
                              onClick={() => handleDeleteOption('division', d.id)}
                            >
                              Delete
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}

                {masterModal.category === 'client' && (
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', color: '#94a3b8', textAlign: 'left' }}>
                        <th style={{ padding: '0.5rem' }}>Client Name</th>
                        <th style={{ padding: '0.5rem' }}>Company</th>
                        <th style={{ padding: '0.5rem' }}>Status</th>
                        <th style={{ padding: '0.5rem', textAlign: 'right' }}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {customers.map(c => (
                        <tr key={c.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', color: '#e2e8f0' }}>
                          <td style={{ padding: '0.5rem' }}>{c.name}</td>
                          <td style={{ padding: '0.5rem' }}>{c.company || '—'}</td>
                          <td style={{ padding: '0.5rem' }}>
                            <span className="tag-badge tag-success">{c.status || 'ACTIVE'}</span>
                          </td>
                          <td style={{ padding: '0.5rem', textAlign: 'right' }}>
                            <button
                              className="btn btn-sm btn-danger"
                              style={{ fontSize: '0.72rem', padding: '0.2rem 0.5rem' }}
                              onClick={() => handleDeleteOption('client', c.id)}
                            >
                              Delete
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}

                {masterModal.category === 'manager' && (
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', color: '#94a3b8', textAlign: 'left' }}>
                        <th style={{ padding: '0.5rem' }}>Full Name</th>
                        <th style={{ padding: '0.5rem' }}>Username</th>
                        <th style={{ padding: '0.5rem' }}>Role</th>
                        <th style={{ padding: '0.5rem', textAlign: 'right' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {users
                        .filter(u => ['project_manager', 'contractor_pm', 'admin', 'management'].includes((u.role || '').toLowerCase()) || users.length <= 8)
                        .map(u => (
                          <tr key={u.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', color: '#e2e8f0' }}>
                            <td style={{ padding: '0.5rem' }}>{u.full_name}</td>
                            <td style={{ padding: '0.5rem' }}><code>{u.username}</code></td>
                            <td style={{ padding: '0.5rem' }}>{u.role}</td>
                            <td style={{ padding: '0.5rem', textAlign: 'right', display: 'flex', justifyContent: 'flex-end', gap: '0.4rem' }}>
                              <button
                                className={`btn btn-sm ${u.is_active ? 'btn-secondary' : 'btn-primary'}`}
                                style={{ fontSize: '0.72rem', padding: '0.2rem 0.5rem' }}
                                onClick={() => handleToggleUserStatus(u.id)}
                              >
                                {u.is_active ? 'Deactivate' : 'Reactivate'}
                              </button>
                              <button
                                className="btn btn-sm btn-danger"
                                style={{ fontSize: '0.72rem', padding: '0.2rem 0.5rem' }}
                                onClick={() => handleDeleteOption('manager', u.id)}
                              >
                                Delete
                              </button>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                )}

                {masterModal.category === 'funding_mode' && (
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', color: '#94a3b8', textAlign: 'left' }}>
                        <th style={{ padding: '0.5rem' }}>Funding Mode</th>
                        <th style={{ padding: '0.5rem' }}>Type</th>
                        <th style={{ padding: '0.5rem', textAlign: 'right' }}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {availableFundingModes.map(m => {
                        const isDefault = ['Budgeted', 'Deposit', 'CSSA'].includes(m);
                        return (
                          <tr key={m} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', color: '#e2e8f0' }}>
                            <td style={{ padding: '0.5rem', fontWeight: 600 }}>{m}</td>
                            <td style={{ padding: '0.5rem', color: '#94a3b8' }}>
                              {isDefault ? 'Standard Default' : 'Custom Added'}
                            </td>
                            <td style={{ padding: '0.5rem', textAlign: 'right' }}>
                              <button
                                className="btn btn-sm btn-danger"
                                style={{ fontSize: '0.72rem', padding: '0.2rem 0.5rem' }}
                                onClick={() => handleDeleteOption('funding_mode', m)}
                              >
                                Delete
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}

                {masterModal.category === 'currency' && (
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', color: '#94a3b8', textAlign: 'left' }}>
                        <th style={{ padding: '0.5rem' }}>Code</th>
                        <th style={{ padding: '0.5rem' }}>Label</th>
                        <th style={{ padding: '0.5rem' }}>Type</th>
                        <th style={{ padding: '0.5rem', textAlign: 'right' }}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {availableCurrencies.map(c => {
                        const isStandard = STANDARD_CURRENCIES.some(sc => sc.code === c.code);
                        return (
                          <tr key={c.code} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', color: '#e2e8f0' }}>
                            <td style={{ padding: '0.5rem' }}><code>{c.code}</code> ({c.symbol})</td>
                            <td style={{ padding: '0.5rem' }}>{c.label}</td>
                            <td style={{ padding: '0.5rem', color: '#94a3b8' }}>
                              {isStandard ? 'Standard List' : 'Custom Added'}
                            </td>
                            <td style={{ padding: '0.5rem', textAlign: 'right' }}>
                              <button
                                className="btn btn-sm btn-danger"
                                style={{ fontSize: '0.72rem', padding: '0.2rem 0.5rem' }}
                                onClick={() => handleDeleteOption('currency', c.code)}
                              >
                                Delete
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* --- CHANGE 4: FEATURE FLAGS MODAL --- */}
      {showSettingsModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1050, padding: '1rem' }}>
          <div className="glass-card" style={{ width: '100%', maxWidth: '520px', background: '#1e293b', padding: '1.5rem', borderRadius: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '0.75rem' }}>
              <h3 style={{ margin: 0, color: '#f8fafc', fontSize: '1.15rem' }}>Tenant Feature Flags (PSC-01)</h3>
              <button className="btn btn-sm btn-secondary" onClick={() => setShowSettingsModal(false)}>Close</button>
            </div>

            {!isAdmin && (
              <div style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid #ef4444', color: '#fca5a5', padding: '0.75rem 1rem', borderRadius: '6px', marginBottom: '1.25rem', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <ShieldAlert size={18} color="#ef4444" style={{ flexShrink: 0 }} />
                <span>Forbidden: Only tenant administrators are authorized to modify feature flags.</span>
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {/* P2 Feature Flag */}
              <div style={{ background: 'rgba(0,0,0,0.2)', padding: '1rem', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ paddingRight: '1rem' }}>
                  <h4 style={{ margin: '0 0 0.25rem 0', color: '#f8fafc', fontSize: '0.95rem' }}>P2 Feature Flag</h4>
                  <p style={{ margin: 0, color: '#94a3b8', fontSize: '0.78rem' }}>
                    Enables Percentage Rate & EPC Contract Types during project registration.
                  </p>
                </div>
                <button
                  className={`btn ${tenantSettings.is_p2_enabled ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ fontSize: '0.8rem', minWidth: '96px', opacity: isAdmin ? 1 : 0.6, cursor: isAdmin ? 'pointer' : 'not-allowed' }}
                  onClick={handleToggleP2}
                  disabled={!isAdmin}
                >
                  {tenantSettings.is_p2_enabled ? 'ENABLED' : 'DISABLED'}
                </button>
              </div>

              {/* Funding Mode Feature Flag */}
              <div style={{ background: 'rgba(0,0,0,0.2)', padding: '1rem', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ paddingRight: '1rem' }}>
                  <h4 style={{ margin: '0 0 0.25rem 0', color: '#f8fafc', fontSize: '0.95rem' }}>Funding Mode Feature Flag</h4>
                  <p style={{ margin: 0, color: '#94a3b8', fontSize: '0.78rem' }}>
                    Displays the Funding Mode dropdown (Budgeted, Deposit, CSSA) in Project Creation.
                  </p>
                </div>
                <button
                  className={`btn ${tenantSettings.is_funding_mode_enabled ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ fontSize: '0.8rem', minWidth: '96px', opacity: isAdmin ? 1 : 0.6, cursor: isAdmin ? 'pointer' : 'not-allowed' }}
                  onClick={handleToggleFundingMode}
                  disabled={!isAdmin}
                >
                  {tenantSettings.is_funding_mode_enabled ? 'ENABLED' : 'DISABLED'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
