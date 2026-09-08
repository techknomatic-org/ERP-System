import React, { useState, useEffect, useMemo } from 'react';
import { 
  Calculator, Plus, Search, Filter, Save, Send, AlertTriangle, 
  CheckCircle, AlertCircle, RefreshCw, FileSpreadsheet, Building2, Check, Layers, ChevronRight, Lock, FileCheck, Copy, ShieldCheck, XCircle
} from 'lucide-react';
import { projectService, sorService, estimationService, nonSorService, technicalSanctionService } from '../services/api';
import EmptyState from '../components/EmptyState';

export default function ProjectEstimation() {
  const [projects, setProjects] = useState([]);
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [loadingProjects, setLoadingProjects] = useState(true);

  // Active SOR Items for Dropdown
  const [sorMasterList, setSorMasterList] = useState([]);
  const [approvedNonSorList, setApprovedNonSorList] = useState([]);

  // Estimate State
  const [estimateData, setEstimateData] = useState(null);
  const [loadingEstimate, setLoadingEstimate] = useState(false);
  const [saving, setSaving] = useState(false);

  // Contingency & Departmental Charges State
  const [contingencyPercent, setContingencyPercent] = useState(5.0);
  const [deptChargesPercent, setDeptChargesPercent] = useState(2.0);

  // Local Line Mappings: { boq_item_id: { boq_item_id, sor_item_id, rate_source, quantity, manual_rate, is_manual_override, justification_note, sor_rate, estimated_amount, sor_unit, is_compatible } }
  const [lineMappings, setLineMappings] = useState({});

  // Review Modal State
  const [showReviewModal, setShowReviewModal] = useState(false);

  // Technical Sanction (PSC-07) State
  const [latestTs, setLatestTs] = useState(null);
  const [showTsSubmitModal, setShowTsSubmitModal] = useState(false);
  const [showTsRejectModal, setShowTsRejectModal] = useState(false);
  const [tsRemarks, setTsRemarks] = useState('');
  const [tsRejectionReason, setTsRejectionReason] = useState('');
  const [submittingTs, setSubmittingTs] = useState(false);
  const [vacantEeError, setVacantEeError] = useState('');
  const userRole = (localStorage.getItem('erp_role') || 'admin').toLowerCase().trim();

  // Toast Notification State
  const [toast, setToast] = useState(null);

  const showToastNotification = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => {
      setToast(null);
    }, 4500);
  };

  // Unit Compatibility Check
  const checkUnitCompatibility = (unit1, unit2) => {
    if (!unit1 || !unit2) return false;
    const u1 = unit1.trim().toLowerCase();
    const u2 = unit2.trim().toLowerCase();
    const aliases = {
      'cum': 'm³', 'cu.m': 'm³', 'm3': 'm³', 'cubic meter': 'm³', 'cubic metre': 'm³',
      'sqm': 'm²', 'sq.m': 'm2', 'm2': 'm²', 'square meter': 'm²', 'square metre': 'm²',
      'rm': 'm', 'meter': 'm', 'metre': 'm',
      'mt': 'tonnes', 'tonne': 'tonnes', 'tons': 'tonnes', 'ton': 'tonnes',
      'nos': 'nos', 'number': 'nos', 'numbers': 'nos', 'each': 'nos',
      'ls': 'lumpsum', 'lump sum': 'lumpsum', 'bags': 'bags', 'bag': 'bags'
    };
    return (aliases[u1] || u1) === (aliases[u2] || u2);
  };

  // Currency Formatter
  const formatCurrency = (val) => {
    if (val === null || val === undefined || isNaN(val)) return '—';
    const num = parseFloat(val);
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(num);
  };

  // Round helper
  const round = (num, decimals = 2) => {
    return Number(Math.round(num + 'e' + decimals) + 'e-' + decimals);
  };

  // Validate Quantity helper
  const validateQuantity = (val) => {
    if (val === '' || val === null || val === undefined) return "Quantity is required.";
    const num = parseFloat(val);
    if (isNaN(num) || num <= 0) return "Quantity must be > 0.";
    const parts = val.toString().split('.');
    if (parts.length > 1 && parts[1].length > 3) return "Maximum 3 decimal places allowed.";
    return null;
  };

  // Fetch initial projects & SOR master list
  useEffect(() => {
    setLoadingProjects(true);
    Promise.all([
      projectService.getProjects(),
      sorService.getSorItems()
    ])
      .then(([projRes, sorRes]) => {
        setProjects(projRes.data || []);
        setSorMasterList(sorRes.data || []);
        if (projRes.data && projRes.data.length > 0) {
          setSelectedProjectId(projRes.data[0].id.toString());
        }
      })
      .catch((err) => {
        console.error("Error loading initial estimation data:", err);
        showToastNotification("Failed to load projects or Schedule of Rates list.", "error");
      })
      .finally(() => setLoadingProjects(false));
  }, []);

  // Fetch estimate for selected project
  const loadEstimateForProject = (projId) => {
    if (!projId) {
      setEstimateData(null);
      setLineMappings({});
      setApprovedNonSorList([]);
      return;
    }

    setLoadingEstimate(true);
    nonSorService.getApprovedRates(projId)
      .then(res => setApprovedNonSorList(res.data || []))
      .catch(() => setApprovedNonSorList([]));

    technicalSanctionService.getByProject(projId)
      .then(res => setLatestTs(res.data && res.data.length > 0 ? res.data[0] : null))
      .catch(() => setLatestTs(null));

    estimationService.getEstimateByProject(projId)
      .then((res) => {
        const est = res.data;
        setEstimateData(est);
        setContingencyPercent(est.contingency_percent !== null && est.contingency_percent !== undefined ? parseFloat(est.contingency_percent) : 5.0);
        setDeptChargesPercent(est.departmental_charges_percent !== null && est.departmental_charges_percent !== undefined ? parseFloat(est.departmental_charges_percent) : 2.0);

        // Build local lineMappings dictionary
        const initialMap = {};
        if (est && est.lines) {
          est.lines.forEach((line) => {
            const hasSor = line.sor_item_id !== null && line.sor_item_id !== undefined;
            const compatible = hasSor ? checkUnitCompatibility(line.boq_unit, line.sor_unit) : true;
            const sorRate = (hasSor && compatible) 
              ? (line.sor_rate_snapshot !== null && line.sor_rate_snapshot !== undefined ? line.sor_rate_snapshot : line.sor_rate) 
              : null;
            
            const rateSrc = line.rate_source || (hasSor ? "SOR" : "NON_SOR");
            const manualRate = line.manual_rate !== undefined && line.manual_rate !== null ? line.manual_rate : (rateSrc === "NON_SOR" ? (line.boq_rate || 0) : null);
            const isOverride = Boolean(line.is_manual_override);

            const effectiveRate = (rateSrc === "NON_SOR" || isOverride) 
              ? (manualRate !== null ? parseFloat(manualRate) : 0)
              : (sorRate !== null ? parseFloat(sorRate) : (line.boq_rate || 0));

            const estAmt = line.estimated_amount !== null && line.estimated_amount !== undefined 
              ? line.estimated_amount 
              : round(parseFloat(line.quantity || 0) * effectiveRate, 2);

            initialMap[line.boq_item_id] = {
              boq_item_id: line.boq_item_id,
              sor_item_id: (hasSor && compatible) ? line.sor_item_id.toString() : '',
              rate_source: rateSrc,
              quantity: line.quantity,
              manual_rate: manualRate !== null ? manualRate : '',
              is_manual_override: isOverride,
              justification_note: line.justification_note || '',
              sor_rate: sorRate,
              estimated_amount: estAmt,
              sor_unit: line.sor_unit || '',
              is_compatible: compatible
            };
          });
        }
        setLineMappings(initialMap);
      })
      .catch((err) => {
        console.error("Error loading project estimate:", err);
        showToastNotification("Failed to load project estimate.", "error");
      })
      .finally(() => setLoadingEstimate(false));
  };

  useEffect(() => {
    if (selectedProjectId) {
      loadEstimateForProject(selectedProjectId);
    }
  }, [selectedProjectId]);

  // Handle Rate Source Change
  const handleRateSourceChange = (boqItemId, newSource, boqUnit) => {
    setLineMappings(prev => {
      const current = prev[boqItemId] || { boq_item_id: boqItemId, quantity: 0 };
      const qty = parseFloat(current.quantity || 0);
      let isOverride = current.is_manual_override;
      let sorRate = current.sor_rate;
      let manualRate = current.manual_rate;
      let estAmt = current.estimated_amount;

      if (newSource === "NON_SOR") {
        isOverride = false;
        sorRate = null;
        if (!manualRate || manualRate === '') manualRate = current.boq_rate || 0;
        estAmt = round(qty * parseFloat(manualRate || 0), 2);
      } else if (newSource === "MANUAL_OVERRIDE") {
        isOverride = true;
        if (!manualRate || manualRate === '') manualRate = sorRate || current.boq_rate || 0;
        estAmt = round(qty * parseFloat(manualRate || 0), 2);
      } else {
        // SOR
        const selectedSor = sorMasterList.find(s => s.id.toString() === (current.sor_item_id || '').toString());
        const compatible = selectedSor ? checkUnitCompatibility(boqUnit, selectedSor.unit) : true;
        sorRate = (selectedSor && compatible) ? parseFloat(selectedSor.rate) : null;
        isOverride = false;
        estAmt = (sorRate !== null && compatible) ? round(qty * sorRate, 2) : null;
      }

      return {
        ...prev,
        [boqItemId]: {
          ...current,
          rate_source: newSource,
          is_manual_override: isOverride,
          sor_rate: sorRate,
          manual_rate: manualRate,
          estimated_amount: estAmt
        }
      };
    });
  };

  // Handle SOR selection for a BOQ item
  const handleSelectSor = (boqItemId, sorIdStr, boqUnit) => {
    const sorId = sorIdStr ? parseInt(sorIdStr, 10) : null;
    const selectedSor = sorMasterList.find(s => s.id === sorId);

    setLineMappings(prev => {
      const currentLine = prev[boqItemId] || { boq_item_id: boqItemId, quantity: 0 };
      const compatible = selectedSor ? checkUnitCompatibility(boqUnit, selectedSor.unit) : true;
      const sorRate = (selectedSor && compatible) ? parseFloat(selectedSor.rate) : null;
      const qty = parseFloat(currentLine.quantity || 0);

      const rateSrc = currentLine.rate_source === "NON_SOR" ? "SOR" : currentLine.rate_source;
      const isOverride = currentLine.is_manual_override;
      const effectiveRate = (isOverride && currentLine.manual_rate) ? parseFloat(currentLine.manual_rate) : sorRate;

      const estAmt = (effectiveRate !== null && !isNaN(effectiveRate) && compatible) ? round(qty * effectiveRate, 2) : null;

      return {
        ...prev,
        [boqItemId]: {
          ...currentLine,
          rate_source: rateSrc,
          sor_item_id: sorIdStr || '',
          sor_rate: sorRate,
          estimated_amount: estAmt,
          sor_unit: selectedSor ? selectedSor.unit : '',
          is_compatible: compatible
        }
      };
    });
  };

  // Handle Quantity Change
  const handleQuantityChange = (boqItemId, newQtyStr) => {
    setLineMappings(prev => {
      const current = prev[boqItemId] || { boq_item_id: boqItemId };
      const qtyNum = parseFloat(newQtyStr || 0);
      const isOverride = current.rate_source === "NON_SOR" || current.is_manual_override;
      const effectiveRate = isOverride 
        ? parseFloat(current.manual_rate || 0) 
        : (current.sor_rate !== null && current.is_compatible !== false ? parseFloat(current.sor_rate) : 0);

      const estAmt = (!isNaN(qtyNum) && qtyNum > 0 && effectiveRate !== null) ? round(qtyNum * effectiveRate, 2) : 0;

      return {
        ...prev,
        [boqItemId]: {
          ...current,
          quantity: newQtyStr,
          estimated_amount: estAmt
        }
      };
    });
  };

  // Handle Manual Rate Change
  const handleManualRateChange = (boqItemId, newRateStr) => {
    setLineMappings(prev => {
      const current = prev[boqItemId] || { boq_item_id: boqItemId };
      const rateNum = parseFloat(newRateStr || 0);
      const qty = parseFloat(current.quantity || 0);
      
      const isOverride = current.rate_source !== "NON_SOR" ? true : false;
      const rateSrc = current.rate_source === "SOR" ? "MANUAL_OVERRIDE" : current.rate_source;
      const estAmt = (!isNaN(qty) && !isNaN(rateNum)) ? round(qty * rateNum, 2) : 0;

      return {
        ...prev,
        [boqItemId]: {
          ...current,
          rate_source: rateSrc,
          manual_rate: newRateStr,
          is_manual_override: isOverride,
          estimated_amount: estAmt
        }
      };
    });
  };

  // Handle Selection of Approved Non-SOR Market Rate
  const handleSelectApprovedNonSor = (boqItemId, nonSorIdStr) => {
    const nonSorId = nonSorIdStr ? parseInt(nonSorIdStr, 10) : null;
    const selectedItem = approvedNonSorList.find(n => n.id === nonSorId);

    setLineMappings(prev => {
      const current = prev[boqItemId] || { boq_item_id: boqItemId, quantity: 0 };
      const qty = parseFloat(current.quantity || 0);
      const mRate = selectedItem ? selectedItem.market_rate : (current.manual_rate || 0);
      const estAmt = (mRate !== null && !isNaN(mRate)) ? round(qty * parseFloat(mRate), 2) : 0;

      return {
        ...prev,
        [boqItemId]: {
          ...current,
          non_sor_id: nonSorIdStr || '',
          rate_source: "NON_SOR",
          manual_rate: mRate,
          is_manual_override: false,
          estimated_amount: estAmt
        }
      };
    });
  };

  // Handle Justification Change Change
  const handleJustificationChange = (boqItemId, note) => {
    setLineMappings(prev => {
      const current = prev[boqItemId] || { boq_item_id: boqItemId };
      return {
        ...prev,
        [boqItemId]: {
          ...current,
          justification_note: note
        }
      };
    });
  };

  // Live Summary Statistics & Category Breakdown
  const liveStats = useMemo(() => {
    if (!estimateData || !estimateData.lines) {
      return { 
        totalBoq: 0, validMappedCount: 0, unmappedCount: 0, hasUnitMismatch: false, 
        baseEstimate: 0, contingencyAmount: 0, deptChargesAmount: 0, deTotal: 0, 
        isContingencyOutOfBounds: false, isLocked: false, status: 'DRAFT', categoryMap: {} 
      };
    }

    const isLocked = Boolean(estimateData.is_ts_locked || estimateData.ts_status === "APPROVED");
    let validMapped = 0;
    let baseEstCost = 0;
    let hasMismatch = false;
    const catMap = {};

    estimateData.lines.forEach((line) => {
      const mapping = lineMappings[line.boq_item_id] || {};
      const rateSrc = mapping.rate_source || "SOR";
      const isSelected = (rateSrc === "NON_SOR") || (mapping.sor_item_id !== '' && mapping.sor_item_id !== null && mapping.sor_item_id !== undefined);
      const isCompatible = rateSrc === "NON_SOR" ? true : (mapping.is_compatible !== false);

      if (mapping.sor_item_id && !isCompatible && rateSrc === "SOR") {
        hasMismatch = true;
      }

      const qtyErr = validateQuantity(mapping.quantity);
      const qtyNum = parseFloat(mapping.quantity || 0);

      const effectiveRate = (rateSrc === "NON_SOR" || mapping.is_manual_override) 
        ? parseFloat(mapping.manual_rate || 0) 
        : (mapping.sor_rate !== null && mapping.sor_rate !== undefined ? parseFloat(mapping.sor_rate) : null);

      const isValidLine = isSelected && isCompatible && !qtyErr && effectiveRate !== null && effectiveRate >= 0;

      if (isValidLine) {
        const estAmt = round(qtyNum * effectiveRate, 2);
        validMapped += 1;
        baseEstCost += estAmt;

        let sorObj = sorMasterList.find(s => s.id.toString() === (mapping.sor_item_id || '').toString());
        let category = (sorObj && isCompatible) ? sorObj.category : (line.boq_category || "General");

        if (!catMap[category]) {
          catMap[category] = { category, total_amount: 0, item_count: 0 };
        }
        catMap[category].total_amount += estAmt;
        catMap[category].item_count += 1;
      } else {
        const itemCost = line.estimated_amount ?? line.boq_amount ?? 0;
        if (itemCost) {
          let category = line.boq_category || "General";
          if (!catMap[category]) {
            catMap[category] = { category, total_amount: 0, item_count: 0 };
          }
        }
      }
    });

    const totalBoq = estimateData.lines.length;
    const unmapped = totalBoq - validMapped;

    const contingencyAmt = round(baseEstCost * (contingencyPercent / 100.0), 2);
    const deptChargesAmt = round(baseEstCost * (deptChargesPercent / 100.0), 2);
    const deTotalCost = round(baseEstCost + contingencyAmt + deptChargesAmt, 2);

    const isOutOfBounds = contingencyPercent < 3.0 || contingencyPercent > 5.0;

    let computedStatus = estimateData.status;
    if (isLocked) {
      computedStatus = 'APPROVED';
    } else if (totalBoq === 0 || validMapped === 0) {
      computedStatus = 'DRAFT';
    } else if (validMapped < totalBoq || hasMismatch) {
      computedStatus = 'PARTIALLY_MAPPED';
    } else {
      computedStatus = estimateData.status === 'SUBMITTED' ? 'SUBMITTED' : 'READY_FOR_REVIEW';
    }

    return {
      totalBoq,
      validMappedCount: validMapped,
      unmappedCount: unmapped,
      hasUnitMismatch: hasMismatch,
      baseEstimate: baseEstCost,
      contingencyAmount: contingencyAmt,
      deptChargesAmount: deptChargesAmt,
      deTotal: deTotalCost,
      isContingencyOutOfBounds: isOutOfBounds,
      isLocked,
      status: computedStatus,
      categoryMap: catMap
    };
  }, [estimateData, lineMappings, sorMasterList, contingencyPercent, deptChargesPercent]);

  // Save Draft Handler
  const handleSaveDraft = async () => {
    if (!selectedProjectId || !estimateData) return;
    if (liveStats.isLocked) {
      showToastNotification("Technical Sanction Approved — Detailed Estimate is locked.", "error");
      return;
    }

    // Client-side validations before sending
    for (const line of estimateData.lines) {
      const mapping = lineMappings[line.boq_item_id] || {};
      const qtyErr = validateQuantity(mapping.quantity);
      if (qtyErr) {
        showToastNotification(`Invalid quantity for BOQ item '${line.boq_item_name}': ${qtyErr}`, "error");
        return;
      }

      if (mapping.is_manual_override || mapping.rate_source === "MANUAL_OVERRIDE") {
        if (!mapping.justification_note || !mapping.justification_note.trim()) {
          showToastNotification(`Manual rate override for '${line.boq_item_name}' requires a justification note.`, "error");
          return;
        }
      }
    }

    setSaving(true);
    const linesPayload = estimateData.lines.map((line) => {
      const mapping = lineMappings[line.boq_item_id] || {};
      const rateSrc = mapping.rate_source || "SOR";
      const isSelected = rateSrc === "NON_SOR" || (mapping.sor_item_id !== '' && mapping.sor_item_id !== null);
      const isCompatible = mapping.is_compatible !== false;

      return {
        boq_item_id: line.boq_item_id,
        sor_item_id: (rateSrc === "SOR" && isSelected && isCompatible) ? parseInt(mapping.sor_item_id, 10) : null,
        rate_source: rateSrc,
        quantity: parseFloat(mapping.quantity),
        manual_rate: (mapping.manual_rate !== '' && mapping.manual_rate !== null) ? parseFloat(mapping.manual_rate) : null,
        is_manual_override: Boolean(mapping.is_manual_override),
        justification_note: mapping.justification_note || null,
        sor_rate_snapshot: mapping.sor_rate,
        estimated_amount: mapping.estimated_amount
      };
    });

    const payload = {
      project_id: parseInt(selectedProjectId, 10),
      status: liveStats.status,
      contingency_percent: contingencyPercent,
      departmental_charges_percent: deptChargesPercent,
      lines: linesPayload
    };

    try {
      const res = await estimationService.saveEstimate(payload);
      setEstimateData(res.data);
      showToastNotification("Draft estimate saved successfully.", "success");
    } catch (err) {
      console.error("Error saving estimate draft:", err);
      const msg = err.response?.data?.detail || "Failed to save draft estimate.";
      showToastNotification(msg, "error");
    } finally {
      setSaving(false);
    }
  };

  // Submit for Review Handler
  const handleSubmitReview = async () => {
    if (!estimateData) return;
    if (liveStats.isLocked) {
      showToastNotification("Technical Sanction Approved — Detailed Estimate is locked.", "error");
      return;
    }

    if (liveStats.totalBoq === 0) {
      showToastNotification("Add at least one item", "error");
      return;
    }

    if (liveStats.unmappedCount > 0 || liveStats.hasUnitMismatch) {
      showToastNotification(
        `Cannot submit: ${liveStats.unmappedCount} BOQ item(s) are unmapped or have unit mismatches.`, 
        "error"
      );
      return;
    }

    // Check justification notes
    for (const line of estimateData.lines) {
      const mapping = lineMappings[line.boq_item_id] || {};
      if (mapping.is_manual_override || mapping.rate_source === "MANUAL_OVERRIDE") {
        if (!mapping.justification_note || !mapping.justification_note.trim()) {
          showToastNotification(`Manual rate override for '${line.boq_item_name}' requires a justification note.`, "error");
          return;
        }
      }
    }

    setSaving(true);
    try {
      const linesPayload = estimateData.lines.map((line) => {
        const mapping = lineMappings[line.boq_item_id] || {};
        const rateSrc = mapping.rate_source || "SOR";
        return {
          boq_item_id: line.boq_item_id,
          sor_item_id: rateSrc === "SOR" && mapping.sor_item_id ? parseInt(mapping.sor_item_id, 10) : null,
          rate_source: rateSrc,
          quantity: parseFloat(mapping.quantity),
          manual_rate: (mapping.manual_rate !== '' && mapping.manual_rate !== null) ? parseFloat(mapping.manual_rate) : null,
          is_manual_override: Boolean(mapping.is_manual_override),
          justification_note: mapping.justification_note || null,
          sor_rate_snapshot: mapping.sor_rate,
          estimated_amount: mapping.estimated_amount
        };
      });

      await estimationService.saveEstimate({
        project_id: parseInt(selectedProjectId, 10),
        status: liveStats.status,
        contingency_percent: contingencyPercent,
        departmental_charges_percent: deptChargesPercent,
        lines: linesPayload
      });

      const res = await estimationService.submitForReview(estimateData.id);
      setEstimateData(res.data);
      setShowReviewModal(false);
      showToastNotification("Project Estimate submitted for review successfully!", "success");
    } catch (err) {
      console.error("Error submitting estimate for review:", err);
      const msg = err.response?.data?.detail || "Failed to submit estimate for review.";
      showToastNotification(msg, "error");
    } finally {
      setSaving(false);
    }
  };

  // Approve Technical Sanction Handler
  const handleApproveTs = async () => {
    if (!estimateData) return;
    setSaving(true);
    try {
      const res = await estimationService.approveTs(estimateData.id);
      setEstimateData(res.data);
      showToastNotification("Technical Sanction Approved successfully! Estimate is now locked.", "success");
    } catch (err) {
      console.error("Error approving TS:", err);
      const msg = err.response?.data?.detail || "Failed to approve Technical Sanction.";
      showToastNotification(msg, "error");
    } finally {
      setSaving(false);
    }
  };

  // Create Revised DE Handler
  const handleCreateRevisedDe = async () => {
    if (!estimateData) return;
    setSaving(true);
    try {
      const res = await estimationService.createRevisedDe(estimateData.id);
      setEstimateData(res.data);
      loadEstimateForProject(selectedProjectId);
      showToastNotification(`Revised DE created successfully! Revision #${res.data.revision_number} is ready for editing.`, "success");
    } catch (err) {
      console.error("Error creating revised DE:", err);
      const msg = err.response?.data?.detail || "Failed to create Revised DE.";
      showToastNotification(msg, "error");
    } finally {
      setSaving(false);
    }
  };

  // Technical Sanction Action Handlers (PSC-07)
  const handleTsSubmit = async (e) => {
    if (e) e.preventDefault();
    if (!estimateData || !selectedProjectId) return;
    if (liveStats.totalBoq === 0) {
      showToastNotification("Add at least one item", "error");
      return;
    }

    setSubmittingTs(true);
    setVacantEeError('');

    try {
      const res = await technicalSanctionService.submit({
        project_id: parseInt(selectedProjectId, 10),
        estimate_id: estimateData.id,
        remarks: tsRemarks
      });
      setLatestTs(res.data);
      setShowTsSubmitModal(false);
      setTsRemarks('');
      loadEstimateForProject(selectedProjectId);
      showToastNotification("Detailed Estimate submitted for Technical Sanction successfully!", "success");
    } catch (err) {
      console.error("Error submitting TS:", err);
      const msg = err.response?.data?.detail || "Failed to submit for Technical Sanction.";
      if (msg.includes("Sanctioning Authority (EE) is not assigned")) {
        setVacantEeError(msg);
      } else {
        showToastNotification(msg, "error");
      }
    } finally {
      setSubmittingTs(false);
    }
  };

  const handleTsApprove = async () => {
    if (!latestTs) return;
    setSubmittingTs(true);
    try {
      const res = await technicalSanctionService.approve(latestTs.id, { remarks: tsRemarks });
      setLatestTs(res.data);
      loadEstimateForProject(selectedProjectId);
      showToastNotification(`Technical Sanction APPROVED! Ref: ${res.data.sanction_reference_number}`, "success");
    } catch (err) {
      console.error("Error approving TS:", err);
      const msg = err.response?.data?.detail || "Failed to approve Technical Sanction.";
      showToastNotification(msg, "error");
      loadEstimateForProject(selectedProjectId);
    } finally {
      setSubmittingTs(false);
    }
  };

  const handleTsRejectSubmit = async (e) => {
    if (e) e.preventDefault();
    if (!latestTs) return;

    if (!tsRejectionReason || !tsRejectionReason.trim()) {
      showToastNotification("Rejection reason is mandatory.", "error");
      return;
    }

    setSubmittingTs(true);
    try {
      const res = await technicalSanctionService.reject(latestTs.id, { rejection_reason: tsRejectionReason });
      setLatestTs(res.data);
      setShowTsRejectModal(false);
      setTsRejectionReason('');
      loadEstimateForProject(selectedProjectId);
      showToastNotification("Technical Sanction REJECTED / Sent Back to Draft.", "info");
    } catch (err) {
      console.error("Error rejecting TS:", err);
      const msg = err.response?.data?.detail || "Failed to reject Technical Sanction.";
      showToastNotification(msg, "error");
    } finally {
      setSubmittingTs(false);
    }
  };

  const activeProjectObj = projects.find(p => p.id.toString() === selectedProjectId);

  return (
    <div className="content-page">
      {/* Toast Notification */}
      {toast && (
        <div 
          style={{
            position: 'fixed',
            bottom: '2rem',
            right: '2rem',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            padding: '0.85rem 1.25rem',
            borderRadius: '8px',
            background: toast.type === 'error' ? 'rgba(239, 68, 68, 0.95)' : 'rgba(16, 185, 129, 0.95)',
            color: '#ffffff',
            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.4)',
            backdropFilter: 'blur(8px)',
            fontWeight: 600,
            fontSize: '0.88rem',
            animation: 'fadeIn 0.25s ease-out'
          }}
        >
          {toast.type === 'error' ? <AlertCircle size={20} /> : <CheckCircle size={20} />}
          <span>{toast.message}</span>
        </div>
      )}

      {/* TS Approved Lock Banner */}
      {estimateData && (estimateData.is_ts_locked || estimateData.ts_status === "APPROVED") && (
        <div 
          style={{ 
            marginBottom: '1.25rem', 
            padding: '1rem 1.25rem', 
            borderRadius: '10px', 
            background: 'rgba(239, 68, 68, 0.12)', 
            border: '1px solid rgba(239, 68, 68, 0.3)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '1rem'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: '#f87171' }}>
            <Lock size={22} />
            <div>
              <strong style={{ fontSize: '0.98rem', display: 'block' }}>
                Technical Sanction Approved — Detailed Estimate is locked.
              </strong>
              <span style={{ fontSize: '0.82rem', color: '#fca5a5' }}>
                Quantities, rates, SOR mappings, contingency, and departmental charges are read-only.
              </span>
            </div>
          </div>
          <button
            className="btn btn-primary"
            onClick={handleCreateRevisedDe}
            disabled={saving}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', background: '#6366f1', borderColor: '#6366f1', fontWeight: 600 }}
          >
            <Copy size={16} />
            <span>Create Revised DE</span>
          </button>
        </div>
      )}

      {/* EE Review Required Warning Banner */}
      {estimateData && estimateData.is_ee_review_required && !estimateData.is_ts_locked && (
        <div 
          style={{ 
            marginBottom: '1.25rem', 
            padding: '0.85rem 1.25rem', 
            borderRadius: '8px', 
            background: 'rgba(245, 158, 11, 0.12)', 
            border: '1px solid rgba(245, 158, 11, 0.3)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            color: '#fbbf24'
          }}
        >
          <AlertTriangle size={20} />
          <span style={{ fontSize: '0.88rem', fontWeight: 600 }}>
            {estimateData.ee_review_reason || "Contingency is outside the configured tenant range (3.0% - 5.0%) and requires EE review."}
          </span>
        </div>
      )}

      {/* Header */}
      <div style={{ marginBottom: '1.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <div style={{ padding: '0.45rem', background: 'rgba(99, 102, 241, 0.15)', borderRadius: '8px', color: '#818cf8' }}>
              <Calculator size={24} />
            </div>
            <h1 className="page-title" style={{ margin: 0 }}>
              PROJECT ESTIMATION {estimateData?.revision_number > 0 ? `(Rev ${estimateData.revision_number})` : ''}
            </h1>
          </div>
          <p className="page-subtitle" style={{ marginTop: '0.35rem' }}>
            Detailed Estimate Builder — BOQ items, SOR/Non-SOR rate analysis, Contingency %, Departmental Charges %, & TS Approval.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          {/* Action: Approve Technical Sanction (if ready for review and not locked) */}
          {estimateData && !liveStats.isLocked && estimateData.status === "READY_FOR_REVIEW" && (
            <button 
              className="btn btn-secondary" 
              onClick={handleApproveTs}
              disabled={saving}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontWeight: 600, color: '#10b981', borderColor: 'rgba(16, 185, 129, 0.4)' }}
            >
              <FileCheck size={16} />
              <span>Approve Technical Sanction</span>
            </button>
          )}

          {/* Action: Save Draft */}
          <button 
            className="btn btn-secondary" 
            onClick={handleSaveDraft}
            disabled={saving || !estimateData || liveStats.isLocked}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontWeight: 600 }}
          >
            <Save size={16} />
            <span>{saving ? 'Saving...' : 'Save Draft'}</span>
          </button>

          {/* Action: Submit for Review */}
          <button 
            className="btn btn-primary" 
            onClick={() => {
              if (liveStats.totalBoq === 0) {
                showToastNotification("Add at least one item", "error");
              } else if (liveStats.unmappedCount > 0 || liveStats.hasUnitMismatch) {
                showToastNotification(
                  `Cannot submit for review: ${liveStats.unmappedCount} BOQ item(s) are unmapped or have unit mismatches.`, 
                  "error"
                );
              } else {
                setShowReviewModal(true);
              }
            }}
            disabled={saving || !estimateData || liveStats.isLocked || liveStats.totalBoq === 0 || liveStats.unmappedCount > 0 || liveStats.hasUnitMismatch}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontWeight: 600 }}
          >
            <Send size={16} />
            <span>Submit for Review</span>
          </button>

          {/* Action: Create Revised DE (if TS Approved) */}
          {liveStats.isLocked && (
            <button 
              className="btn btn-primary" 
              onClick={handleCreateRevisedDe}
              disabled={saving}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontWeight: 600 }}
            >
              <Copy size={16} />
              <span>Create Revised DE</span>
            </button>
          )}
        </div>
      </div>

      {/* Project Selector Toolbar */}
      <div className="glass-card" style={{ marginBottom: '1.5rem', padding: '1rem 1.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600, color: '#f8fafc', fontSize: '0.9rem' }}>
            <Building2 size={18} color="#06b6d4" />
            <span>Select Project:</span>
          </div>
          <div style={{ minWidth: '320px', flex: 1 }}>
            <select 
              className="form-control"
              value={selectedProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value)}
              style={{ fontWeight: 600, cursor: 'pointer' }}
            >
              <option value="">-- Select Project --</option>
              {projects.map(p => (
                <option key={p.id} value={p.id}>{p.code} - {p.name}</option>
              ))}
            </select>
          </div>
          {estimateData && (
            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
              <div style={{ fontSize: '0.8rem', color: '#94a3b8', background: 'rgba(255,255,255,0.05)', padding: '0.4rem 0.8rem', borderRadius: '6px' }}>
                Estimate Code: <strong style={{ color: '#818cf8', fontFamily: 'monospace' }}>{estimateData.estimate_number}</strong>
              </div>
              {estimateData.revision_number > 0 && (
                <div style={{ fontSize: '0.8rem', color: '#38bdf8', background: 'rgba(56, 189, 248, 0.12)', padding: '0.4rem 0.8rem', borderRadius: '6px', fontWeight: 700 }}>
                  Revision #{estimateData.revision_number}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Top Estimation Summary KPI Cards */}
      {selectedProjectId && estimateData && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
          
          {/* Card 1: Base Estimate */}
          <div className="glass-card" style={{ padding: '1rem 1.25rem' }}>
            <div style={{ fontSize: '0.72rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.05em' }}>
              BASE ESTIMATE
            </div>
            <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#38bdf8', marginTop: '0.2rem', fontFamily: 'monospace' }}>
              {formatCurrency(liveStats.baseEstimate)}
            </div>
          </div>

          {/* Card 2: Contingency (5%) */}
          <div className="glass-card" style={{ padding: '1rem 1.25rem' }}>
            <div style={{ fontSize: '0.72rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.05em' }}>
              CONTINGENCY ({contingencyPercent}%)
            </div>
            <div style={{ fontSize: '1.25rem', fontWeight: 800, color: liveStats.isContingencyOutOfBounds ? '#f59e0b' : '#a7f3d0', marginTop: '0.2rem', fontFamily: 'monospace' }}>
              {formatCurrency(liveStats.contingencyAmount)}
            </div>
          </div>

          {/* Card 3: Departmental Charges (2%) */}
          <div className="glass-card" style={{ padding: '1rem 1.25rem' }}>
            <div style={{ fontSize: '0.72rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.05em' }}>
              DEPT CHARGES ({deptChargesPercent}%)
            </div>
            <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#c084fc', marginTop: '0.2rem', fontFamily: 'monospace' }}>
              {formatCurrency(liveStats.deptChargesAmount)}
            </div>
          </div>

          {/* Card 4: DE Total */}
          <div className="glass-card" style={{ padding: '1rem 1.25rem' }}>
            <div style={{ fontSize: '0.72rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.05em' }}>
              DETAILED ESTIMATE TOTAL
            </div>
            <div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#10b981', marginTop: '0.2rem', fontFamily: 'monospace' }}>
              {formatCurrency(liveStats.deTotal)}
            </div>
          </div>

          {/* Card 5: Status */}
          <div className="glass-card" style={{ padding: '1rem 1.25rem' }}>
            <div style={{ fontSize: '0.72rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.05em' }}>
              ESTIMATE STATUS
            </div>
            <div style={{ marginTop: '0.35rem' }}>
              <span className={`tag-badge ${
                liveStats.status === 'APPROVED' ? 'tag-success' :
                liveStats.status === 'READY_FOR_REVIEW' || liveStats.status === 'SUBMITTED' ? 'tag-warning' :
                liveStats.status === 'PARTIALLY_MAPPED' ? 'tag-danger' : 'tag-secondary'
              }`} style={{ fontSize: '0.8rem', fontWeight: 700 }}>
                {liveStats.status.replace(/_/g, ' ')}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* TECHNICAL SANCTION WORKFLOW CARD (PSC-07) */}
      {selectedProjectId && estimateData && (
        <div className="glass-card" style={{ marginBottom: '1.5rem', padding: '1.25rem', borderLeft: '4px solid #818cf8' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '0.85rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <ShieldCheck size={20} color="#818cf8" />
              <h3 style={{ margin: 0, fontSize: '1.05rem', color: '#f8fafc', fontWeight: 700 }}>
                TECHNICAL SANCTION WORKFLOW
              </h3>
              <span className={`tag-badge ${
                latestTs?.status === 'APPROVED' ? 'tag-success' :
                latestTs?.status === 'PENDING_APPROVAL' ? 'tag-warning' :
                (latestTs?.status === 'REJECTED' || latestTs?.status === 'INVALIDATED') ? 'tag-danger' : 'tag-secondary'
              }`} style={{ fontSize: '0.78rem', fontWeight: 700 }}>
                {latestTs?.status === 'PENDING_APPROVAL' ? 'PENDING EE REVIEW' : (latestTs?.status || 'DRAFT').replace(/_/g, ' ')}
              </span>
            </div>

            <div style={{ display: 'flex', gap: '0.6rem' }}>
              {/* Submit Button */}
              {(!latestTs || latestTs.status === 'DRAFT' || latestTs.status === 'REJECTED' || latestTs.status === 'INVALIDATED') && !liveStats.isLocked && (
                <button
                  className="btn btn-primary"
                  onClick={() => setShowTsSubmitModal(true)}
                  disabled={submittingTs || liveStats.totalBoq === 0}
                  style={{ fontSize: '0.82rem', padding: '0.4rem 0.85rem', display: 'inline-flex', alignItems: 'center', gap: '0.4rem', background: '#6366f1', borderColor: '#6366f1' }}
                >
                  <Send size={15} />
                  <span>Submit for Technical Sanction</span>
                </button>
              )}

              {/* EE Approval & Rejection Buttons */}
              {latestTs && latestTs.status === 'PENDING_APPROVAL' && (
                <>
                  <button
                    className="btn btn-primary"
                    onClick={handleTsApprove}
                    disabled={submittingTs}
                    style={{ fontSize: '0.82rem', padding: '0.4rem 0.85rem', display: 'inline-flex', alignItems: 'center', gap: '0.4rem', background: '#10b981', borderColor: '#10b981' }}
                  >
                    <Check size={15} />
                    <span>Approve Technical Sanction</span>
                  </button>
                  <button
                    className="btn btn-secondary"
                    onClick={() => setShowTsRejectModal(true)}
                    disabled={submittingTs}
                    style={{ fontSize: '0.82rem', padding: '0.4rem 0.85rem', display: 'inline-flex', alignItems: 'center', gap: '0.4rem', color: '#ef4444', borderColor: 'rgba(239, 68, 68, 0.4)' }}
                  >
                    <XCircle size={15} />
                    <span>Reject / Send Back</span>
                  </button>
                </>
              )}

              {/* Approved Badge */}
              {latestTs && latestTs.status === 'APPROVED' && (
                <span style={{ fontSize: '0.82rem', color: '#10b981', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '0.3rem', background: 'rgba(16, 185, 129, 0.12)', padding: '0.4rem 0.85rem', borderRadius: '6px' }}>
                  <CheckCircle size={16} /> Technical Sanction Approved
                </span>
              )}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', background: 'rgba(0,0,0,0.2)', padding: '0.85rem 1rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
            <div>
              <span style={{ fontSize: '0.73rem', color: '#94a3b8', display: 'block', fontWeight: 600 }}>SANCTIONING AUTHORITY</span>
              <span style={{ fontSize: '0.88rem', color: '#cbd5e1', fontWeight: 700 }}>
                {latestTs ? latestTs.sanctioning_authority_name : "Executive Engineer (Auto-resolved)"}
              </span>
            </div>
            <div>
              <span style={{ fontSize: '0.73rem', color: '#94a3b8', display: 'block', fontWeight: 600 }}>SANCTION REFERENCE NUMBER</span>
              <span style={{ fontSize: '0.88rem', color: latestTs?.sanction_reference_number ? '#38bdf8' : '#64748b', fontWeight: 700, fontFamily: 'monospace' }}>
                {latestTs?.sanction_reference_number || "— (Auto-generated on Approval)"}
              </span>
            </div>
            <div>
              <span style={{ fontSize: '0.73rem', color: '#94a3b8', display: 'block', fontWeight: 600 }}>SANCTION DATE</span>
              <span style={{ fontSize: '0.88rem', color: '#cbd5e1', fontWeight: 600 }}>
                {latestTs?.sanction_date ? new Date(latestTs.sanction_date).toLocaleString('en-IN') : "—"}
              </span>
            </div>
          </div>

          {/* Invalidation Alert Banner */}
          {latestTs && latestTs.status === 'INVALIDATED' && (
            <div style={{ marginTop: '0.85rem', color: '#ef4444', fontSize: '0.83rem', background: 'rgba(239, 68, 68, 0.12)', border: '1px solid rgba(239, 68, 68, 0.3)', padding: '0.65rem 0.85rem', borderRadius: '6px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <AlertTriangle size={18} />
              <span>This Technical Sanction request is no longer valid because the Detailed Estimate was changed after submission. Please resubmit the revised estimate for Technical Sanction.</span>
            </div>
          )}

          {/* Rejection Reason Banner */}
          {latestTs && latestTs.status === 'REJECTED' && latestTs.rejection_reason && (
            <div style={{ marginTop: '0.85rem', color: '#f87171', fontSize: '0.83rem', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.25)', padding: '0.65rem 0.85rem', borderRadius: '6px', fontWeight: 600 }}>
              <strong>Rejection Reason:</strong> {latestTs.rejection_reason}
            </div>
          )}

          {/* Vacant EE Inline Error */}
          {vacantEeError && (
            <div style={{ marginTop: '0.85rem', color: '#ef4444', fontSize: '0.83rem', background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.4)', padding: '0.65rem 0.85rem', borderRadius: '6px', fontWeight: 600 }}>
              ⚠ {vacantEeError}
            </div>
          )}
        </div>
      )}

      {/* Main Table / State Logic */}
      {!selectedProjectId ? (
        <div className="glass-card" style={{ padding: '3rem 1rem' }}>
          <EmptyState 
            icon={Building2}
            title="Select a project to begin estimation"
            description="Choose an existing construction project from the dropdown above to load its BOQ items."
          />
        </div>
      ) : loadingEstimate ? (
        <div className="glass-card" style={{ textAlign: 'center', padding: '3.5rem 1rem', color: '#94a3b8' }}>
          <RefreshCw size={28} className="spin-icon" style={{ marginBottom: '0.75rem', color: '#6366f1' }} />
          <p style={{ fontSize: '0.92rem' }}>Loading project Detailed Estimate...</p>
        </div>
      ) : !estimateData || !estimateData.lines || estimateData.lines.length === 0 ? (
        <div className="glass-card" style={{ padding: '3rem 1rem' }}>
          <EmptyState 
            icon={FileSpreadsheet}
            title="No BOQ items found for this project"
            description="Create BOQ items for this project before preparing a detailed estimate."
          />
        </div>
      ) : (
        <>
          {/* BOQ Items Detailed Estimate Builder Table */}
          <div className="table-container desktop-only-view" style={{ marginBottom: '1.75rem' }}>
            <table className="custom-table">
              <thead>
                <tr>
                  <th style={{ width: '40px' }}>#</th>
                  <th style={{ width: '220px' }}>BOQ Item</th>
                  <th style={{ width: '60px' }}>Unit</th>
                  <th style={{ width: '100px' }}>Quantity</th>
                  <th style={{ width: '130px' }}>Rate Source</th>
                  <th style={{ width: '220px' }}>SOR / Non-SOR Lookup</th>
                  <th style={{ width: '110px', textAlign: 'right' }}>Rate (₹)</th>
                  <th style={{ width: '180px' }}>Justification Note</th>
                  <th style={{ width: '130px', textAlign: 'right' }}>Amount (₹)</th>
                  <th style={{ width: '100px', textAlign: 'center' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {estimateData.lines.map((line, idx) => {
                  const mapping = lineMappings[line.boq_item_id] || {};
                  const rateSrc = mapping.rate_source || "SOR";
                  const isSelected = rateSrc === "NON_SOR" || (mapping.sor_item_id !== '' && mapping.sor_item_id !== null);
                  const isCompatible = rateSrc === "NON_SOR" ? true : (mapping.is_compatible !== false);
                  const isOverride = Boolean(mapping.is_manual_override);

                  const qtyErr = validateQuantity(mapping.quantity);
                  const isValid = isSelected && isCompatible && !qtyErr;
                  const needJustification = isOverride || rateSrc === "MANUAL_OVERRIDE";
                  const hasJustificationErr = needJustification && (!mapping.justification_note || !mapping.justification_note.trim());

                  const rateVal = (rateSrc === "NON_SOR" || isOverride) 
                    ? mapping.manual_rate 
                    : (isValid ? mapping.sor_rate : null);

                  const estAmount = mapping.estimated_amount;
                  const selectedSorObj = sorMasterList.find(s => s.id.toString() === (mapping.sor_item_id || '').toString());

                  return (
                    <tr 
                      key={line.boq_item_id} 
                      style={{ 
                        background: liveStats.isLocked 
                          ? 'transparent' 
                          : (qtyErr || hasJustificationErr || (isSelected && !isCompatible)) 
                            ? 'rgba(239, 68, 68, 0.05)' 
                            : isValid ? 'rgba(255,255,255,0.01)' : 'rgba(245, 158, 11, 0.03)' 
                      }}
                    >
                      <td style={{ color: '#64748b', fontSize: '0.82rem' }}>{idx + 1}</td>
                      
                      {/* BOQ Description */}
                      <td>
                        <div style={{ fontWeight: 600, color: '#f8fafc', fontSize: '0.88rem' }}>{line.boq_item_name}</div>
                        {selectedSorObj && rateSrc === "SOR" && (
                          <div style={{ fontSize: '0.73rem', color: '#94a3b8', marginTop: '0.2rem' }}>
                            Code: <span style={{ color: '#818cf8', fontWeight: 600 }}>{selectedSorObj.sor_code}</span>
                          </div>
                        )}
                      </td>

                      {/* Unit */}
                      <td style={{ color: '#cbd5e1', fontSize: '0.85rem', fontWeight: 600 }}>{line.boq_unit}</td>

                      {/* Quantity Input */}
                      <td>
                        <div>
                          <input
                            type="number"
                            step="0.001"
                            disabled={liveStats.isLocked}
                            className="form-control"
                            value={mapping.quantity !== undefined ? mapping.quantity : line.quantity}
                            onChange={(e) => handleQuantityChange(line.boq_item_id, e.target.value)}
                            style={{
                              fontSize: '0.82rem',
                              padding: '0.3rem 0.5rem',
                              borderColor: qtyErr ? '#ef4444' : undefined,
                              textAlign: 'right',
                              fontWeight: 600
                            }}
                          />
                          {qtyErr && (
                            <div style={{ color: '#ef4444', fontSize: '0.7rem', marginTop: '0.2rem', fontWeight: 600 }}>
                              {qtyErr}
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Rate Source Selector */}
                      <td>
                        <select
                          disabled={liveStats.isLocked}
                          className="form-control"
                          value={rateSrc}
                          onChange={(e) => handleRateSourceChange(line.boq_item_id, e.target.value, line.boq_unit)}
                          style={{ fontSize: '0.78rem', padding: '0.3rem 0.4rem', cursor: liveStats.isLocked ? 'default' : 'pointer' }}
                        >
                          <option value="SOR">SOR Rate</option>
                          <option value="NON_SOR">Market Rate</option>
                          <option value="MANUAL_OVERRIDE">Manual Override</option>
                        </select>
                      </td>

                      {/* SOR / Non-SOR Select Dropdown */}
                      <td>
                        {rateSrc === "SOR" || rateSrc === "MANUAL_OVERRIDE" ? (
                          <div>
                            <select 
                              disabled={liveStats.isLocked}
                              className="form-control"
                              value={mapping.sor_item_id || ''}
                              onChange={(e) => handleSelectSor(line.boq_item_id, e.target.value, line.boq_unit)}
                              style={{ 
                                fontSize: '0.8rem', 
                                padding: '0.3rem 0.5rem',
                                borderColor: (isSelected && !isCompatible) ? '#ef4444' : undefined,
                                cursor: liveStats.isLocked ? 'default' : 'pointer'
                              }}
                            >
                              <option value="">[ Select SOR Item ]</option>
                              {sorMasterList.map(s => (
                                <option key={s.id} value={s.id} disabled={s.status !== 'Active' && s.id.toString() !== (mapping.sor_item_id || '').toString()}>
                                  {s.sor_code} | {s.description} ({s.unit}) — {formatCurrency(s.rate)}
                                </option>
                              ))}
                            </select>

                            {/* Unit Compatibility Warning */}
                            {isSelected && !isCompatible && (
                              <div style={{ color: '#ef4444', fontSize: '0.72rem', marginTop: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.2rem', fontWeight: 600 }}>
                                <AlertTriangle size={12} />
                                <span>Unit mismatch: BOQ ({line.boq_unit}) vs SOR ({mapping.sor_unit})</span>
                              </div>
                            )}
                          </div>
                        ) : (
                          <div>
                            {approvedNonSorList.length > 0 ? (
                              <select
                                disabled={liveStats.isLocked}
                                className="form-control"
                                value={mapping.non_sor_id || ''}
                                onChange={(e) => handleSelectApprovedNonSor(line.boq_item_id, e.target.value)}
                                style={{ 
                                  fontSize: '0.8rem', 
                                  padding: '0.3rem 0.5rem',
                                  borderColor: '#06b6d4',
                                  cursor: liveStats.isLocked ? 'default' : 'pointer'
                                }}
                              >
                                <option value="">No SOR Match — Select Approved Market Rate</option>
                                {approvedNonSorList.map(ns => (
                                  <option key={ns.id} value={ns.id}>
                                    Market Rate | {ns.item_description} ({ns.unit}) — {formatCurrency(ns.market_rate)}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              <div style={{ fontSize: '0.76rem', color: '#f59e0b', padding: '0.2rem 0' }}>
                                No approved Market Rate. Create & approve Non-SOR Analysis first.
                              </div>
                            )}
                          </div>
                        )}
                      </td>

                      {/* Rate (Editable if Non-SOR or Override) */}
                      <td style={{ textAlign: 'right' }}>
                        {(rateSrc === "NON_SOR" || isOverride) ? (
                          <input
                            type="number"
                            step="0.01"
                            disabled={liveStats.isLocked}
                            className="form-control"
                            value={mapping.manual_rate !== undefined ? mapping.manual_rate : ''}
                            onChange={(e) => handleManualRateChange(line.boq_item_id, e.target.value)}
                            placeholder="Enter rate"
                            style={{
                              fontSize: '0.82rem',
                              padding: '0.3rem 0.5rem',
                              textAlign: 'right',
                              fontFamily: 'monospace',
                              fontWeight: 600,
                              color: '#38bdf8'
                            }}
                          />
                        ) : (
                          <div style={{ fontWeight: 600, color: (isValid && rateVal) ? '#38bdf8' : '#64748b', fontFamily: 'monospace', fontSize: '0.88rem' }}>
                            {isValid && rateVal !== null ? formatCurrency(rateVal) : '—'}
                          </div>
                        )}
                      </td>

                      {/* Justification Note Input */}
                      <td>
                        {(isOverride || rateSrc === "MANUAL_OVERRIDE") ? (
                          <div>
                            <input
                              type="text"
                              disabled={liveStats.isLocked}
                              className="form-control"
                              value={mapping.justification_note || ''}
                              onChange={(e) => handleJustificationChange(line.boq_item_id, e.target.value)}
                              placeholder="Required: Override reason..."
                              style={{
                                fontSize: '0.78rem',
                                padding: '0.3rem 0.5rem',
                                borderColor: hasJustificationErr ? '#ef4444' : undefined
                              }}
                            />
                            {hasJustificationErr && (
                              <div style={{ color: '#ef4444', fontSize: '0.68rem', marginTop: '0.15rem', fontWeight: 600 }}>
                                Justification note required
                              </div>
                            )}
                          </div>
                        ) : (
                          <span style={{ fontSize: '0.78rem', color: '#64748b' }}>N/A (Standard SOR)</span>
                        )}
                      </td>

                      {/* Line Amount */}
                      <td style={{ textAlign: 'right', fontWeight: 700, color: estAmount ? '#10b981' : '#64748b', fontSize: '0.9rem', fontFamily: 'monospace' }}>
                        {estAmount ? formatCurrency(estAmount) : '—'}
                      </td>

                      {/* Status */}
                      <td style={{ textAlign: 'center' }}>
                        {isValid ? (
                          <span className={`tag-badge ${rateSrc === "NON_SOR" ? 'tag-primary' : 'tag-success'}`} style={{ fontSize: '0.7rem' }}>
                            {rateSrc === "NON_SOR" ? 'Market Rate' : (isOverride ? 'Overridden' : 'Mapped')}
                          </span>
                        ) : isSelected && !isCompatible ? (
                          <span className="tag-badge tag-danger" style={{ fontSize: '0.7rem' }}>Unit Mismatch</span>
                        ) : (
                          <span className="tag-badge tag-warning" style={{ fontSize: '0.7rem' }}>Pending</span>
                        )}
                      </td>

                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Bottom Calculations Summary Box */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
            
            {/* Detailed Estimate Calculation Breakdown */}
            <div className="glass-card" style={{ padding: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '0.6rem' }}>
                <Calculator size={18} color="#818cf8" />
                <h3 style={{ margin: 0, fontSize: '1rem', color: '#f8fafc', fontWeight: 700 }}>DETAILED ESTIMATE BREAKDOWN</h3>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', fontSize: '0.88rem' }}>
                
                {/* 1. Base Estimate */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#cbd5e1' }}>
                  <span>Base Estimate (Sum of Line Items):</span>
                  <strong style={{ color: '#38bdf8', fontFamily: 'monospace', fontSize: '0.95rem' }}>{formatCurrency(liveStats.baseEstimate)}</strong>
                </div>

                {/* 2. Contingency Input & Calculation */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#cbd5e1' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span>Contingency %:</span>
                    <input
                      type="number"
                      step="0.1"
                      disabled={liveStats.isLocked}
                      className="form-control"
                      value={contingencyPercent}
                      onChange={(e) => setContingencyPercent(parseFloat(e.target.value) || 0)}
                      style={{ width: '70px', padding: '0.2rem 0.4rem', fontSize: '0.82rem', textAlign: 'right', fontWeight: 700 }}
                    />
                  </div>
                  <strong style={{ color: liveStats.isContingencyOutOfBounds ? '#f59e0b' : '#a7f3d0', fontFamily: 'monospace', fontSize: '0.95rem' }}>
                    + {formatCurrency(liveStats.contingencyAmount)}
                  </strong>
                </div>

                {/* Contingency Warning */}
                {liveStats.isContingencyOutOfBounds && (
                  <div style={{ color: '#f59e0b', fontSize: '0.75rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.3rem', background: 'rgba(245, 158, 11, 0.1)', padding: '0.35rem 0.6rem', borderRadius: '4px' }}>
                    <AlertTriangle size={13} />
                    <span>Contingency is outside configured tenant range (3.0% - 5.0%) and requires EE review.</span>
                  </div>
                )}

                {/* 3. Departmental Charges Input & Calculation */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#cbd5e1' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span>Departmental Charges %:</span>
                    <input
                      type="number"
                      step="0.1"
                      disabled={liveStats.isLocked}
                      className="form-control"
                      value={deptChargesPercent}
                      onChange={(e) => setDeptChargesPercent(parseFloat(e.target.value) || 0)}
                      style={{ width: '70px', padding: '0.2rem 0.4rem', fontSize: '0.82rem', textAlign: 'right', fontWeight: 700 }}
                    />
                  </div>
                  <strong style={{ color: '#c084fc', fontFamily: 'monospace', fontSize: '0.95rem' }}>
                    + {formatCurrency(liveStats.deptChargesAmount)}
                  </strong>
                </div>

                {/* Final DE Total */}
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#cbd5e1', paddingTop: '0.75rem', borderTop: '1px solid rgba(255,255,255,0.12)', fontSize: '1.08rem', fontWeight: 800 }}>
                  <span style={{ color: '#f8fafc' }}>Detailed Estimate Total:</span>
                  <span style={{ color: '#10b981', fontFamily: 'monospace' }}>{formatCurrency(liveStats.deTotal)}</span>
                </div>
              </div>
            </div>

            {/* Estimate By Category Box */}
            <div className="glass-card" style={{ padding: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '0.6rem' }}>
                <Layers size={18} color="#38bdf8" />
                <h3 style={{ margin: 0, fontSize: '1rem', color: '#f8fafc', fontWeight: 700 }}>ESTIMATE BY CATEGORY</h3>
              </div>

              {Object.keys(liveStats.categoryMap).length === 0 ? (
                <div style={{ color: '#94a3b8', fontSize: '0.83rem', textAlign: 'center', padding: '1rem 0' }}>
                  Map valid SOR / Non-SOR items to see category breakdown.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                  {Object.values(liveStats.categoryMap).map((cat) => (
                    <div key={cat.category} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.85rem' }}>
                      <span style={{ color: '#cbd5e1' }}>
                        {cat.category} <span style={{ fontSize: '0.72rem', color: '#64748b' }}>({cat.item_count} items)</span>
                      </span>
                      <strong style={{ color: '#38bdf8', fontFamily: 'monospace' }}>{formatCurrency(cat.total_amount)}</strong>
                    </div>
                  ))}
                  <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '0.5rem', borderTop: '1px solid rgba(255,255,255,0.08)', fontSize: '0.95rem', fontWeight: 700 }}>
                    <span style={{ color: '#f8fafc' }}>Base Estimate Total</span>
                    <span style={{ color: '#10b981', fontFamily: 'monospace' }}>{formatCurrency(liveStats.baseEstimate)}</span>
                  </div>
                </div>
              )}
            </div>

          </div>
        </>
      )}

      {/* Review & Submit Modal */}
      {showReviewModal && estimateData && (
        <div 
          style={{ 
            position: 'fixed', 
            inset: 0, 
            background: 'rgba(15, 23, 42, 0.85)', 
            backdropFilter: 'blur(8px)', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            zIndex: 1000, 
            padding: '1rem'
          }}
        >
          <div 
            className="glass-card" 
            style={{ 
              width: '100%', 
              maxWidth: '520px', 
              background: '#1e293b', 
              border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: '12px',
              padding: '1.5rem',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
            }}
          >
            <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.1rem', color: '#f8fafc', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Send size={18} color="#818cf8" /> Submit Estimate for Review
            </h3>

            <p style={{ fontSize: '0.85rem', color: '#cbd5e1', marginBottom: '1.25rem' }}>
              Please review the final Detailed Estimate totals before submitting:
            </p>

            <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: '8px', padding: '1rem', marginBottom: '1.5rem', fontSize: '0.88rem', display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#94a3b8' }}>Project:</span>
                <strong style={{ color: '#f8fafc' }}>{activeProjectObj ? activeProjectObj.name : 'N/A'}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#94a3b8' }}>Estimate Number:</span>
                <strong style={{ color: '#818cf8', fontFamily: 'monospace' }}>{estimateData.estimate_number}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#94a3b8' }}>Base Estimate:</span>
                <strong style={{ color: '#38bdf8', fontFamily: 'monospace' }}>{formatCurrency(liveStats.baseEstimate)}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#94a3b8' }}>Contingency ({contingencyPercent}%):</span>
                <strong style={{ color: liveStats.isContingencyOutOfBounds ? '#f59e0b' : '#a7f3d0', fontFamily: 'monospace' }}>{formatCurrency(liveStats.contingencyAmount)}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#94a3b8' }}>Departmental Charges ({deptChargesPercent}%):</span>
                <strong style={{ color: '#c084fc', fontFamily: 'monospace' }}>{formatCurrency(liveStats.deptChargesAmount)}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '0.5rem', borderTop: '1px solid rgba(255,255,255,0.08)', fontWeight: 800, fontSize: '1rem' }}>
                <span style={{ color: '#f8fafc' }}>Detailed Estimate Total:</span>
                <span style={{ color: '#10b981', fontFamily: 'monospace' }}>{formatCurrency(liveStats.deTotal)}</span>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button 
                type="button" 
                className="btn btn-secondary"
                onClick={() => setShowReviewModal(false)}
                disabled={saving}
              >
                Cancel
              </button>
              <button 
                type="button" 
                className="btn btn-primary"
                onClick={handleSubmitReview}
                disabled={saving}
              >
                {saving ? 'Submitting...' : 'Confirm & Submit'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Submit for Technical Sanction */}
      {showTsSubmitModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.85)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
          <div className="glass-card" style={{ width: '100%', maxWidth: '520px', background: '#1e293b', border: '1px solid rgba(99, 102, 241, 0.3)', borderRadius: '12px', padding: '1.5rem' }}>
            <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.1rem', color: '#818cf8', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <ShieldCheck size={20} /> Submit for Technical Sanction
            </h3>
            <p style={{ fontSize: '0.85rem', color: '#cbd5e1', marginBottom: '1rem' }}>
              Submitting Detailed Estimate <strong>{estimateData?.estimate_number}</strong> (Total: {formatCurrency(liveStats.deTotal)}) for statutory Technical Sanction review.
            </p>

            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', fontSize: '0.8rem', color: '#cbd5e1', marginBottom: '0.35rem', fontWeight: 600 }}>
                Sanctioning Authority (Auto-resolved)
              </label>
              <input type="text" readOnly className="form-control" value={latestTs ? latestTs.sanctioning_authority_name : "Executive Engineer (Auto-resolved from Workflow Engine)"} style={{ fontSize: '0.85rem', background: 'rgba(255,255,255,0.05)', color: '#94a3b8' }} />
            </div>

            <div style={{ marginBottom: '1.25rem' }}>
              <label style={{ display: 'block', fontSize: '0.8rem', color: '#cbd5e1', marginBottom: '0.35rem', fontWeight: 600 }}>
                Submission Remarks (Optional)
              </label>
              <textarea className="form-control" rows={3} placeholder="Optional technical sanction submission notes..." value={tsRemarks} onChange={(e) => setTsRemarks(e.target.value)} style={{ fontSize: '0.82rem' }} />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button type="button" className="btn btn-secondary" onClick={() => setShowTsSubmitModal(false)} disabled={submittingTs}>Cancel</button>
              <button type="button" className="btn btn-primary" onClick={handleTsSubmit} disabled={submittingTs} style={{ background: '#6366f1', borderColor: '#6366f1' }}>
                {submittingTs ? 'Submitting...' : 'Confirm Submission'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Reject Technical Sanction */}
      {showTsRejectModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.85)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
          <div className="glass-card" style={{ width: '100%', maxWidth: '480px', background: '#1e293b', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '12px', padding: '1.5rem' }}>
            <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.05rem', color: '#f87171', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <XCircle size={18} /> Reject / Send Back Technical Sanction
            </h3>
            <p style={{ fontSize: '0.85rem', color: '#cbd5e1', marginBottom: '1rem' }}>
              Rejecting Technical Sanction for estimate <strong>{estimateData?.estimate_number}</strong>. This will return the estimate to DRAFT state for revision.
            </p>

            <div style={{ marginBottom: '1.25rem' }}>
              <label style={{ display: 'block', fontSize: '0.8rem', color: '#cbd5e1', marginBottom: '0.35rem', fontWeight: 600 }}>
                Rejection Reason <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <textarea required className="form-control" rows={3} placeholder="Specify mandatory rejection reason..." value={tsRejectionReason} onChange={(e) => setTsRejectionReason(e.target.value)} style={{ fontSize: '0.82rem' }} />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button type="button" className="btn btn-secondary" onClick={() => setShowTsRejectModal(false)} disabled={submittingTs}>Cancel</button>
              <button type="button" className="btn btn-primary" onClick={handleTsRejectSubmit} disabled={submittingTs || !tsRejectionReason.trim()} style={{ background: '#ef4444', borderColor: '#ef4444' }}>
                {submittingTs ? 'Rejecting...' : 'Confirm Rejection'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Style Overrides */}
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .spin-icon {
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
