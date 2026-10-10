'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { ALL_BLOCKS } from '@/lib/data/bundelkhand';
import { INTERVENTION_SCHEMES } from '@/lib/data/schemes';
import { INITIAL_INTERVENTIONS } from '@/lib/data/interventions';
import { InterventionProposal, UserRole } from '@/lib/types';
import { useRole } from '@/lib/context/RoleContext';
import { canMutateDemoWorkflows, demoRestrictionNotice, SCHEME_UNVERIFIED_NOTICE } from '@/lib/demo/demoPolicy';
import { DocumentTextIcon, ShieldCheckIcon, UserRoleIcon, InfoIcon } from '@/components/ui/Icons';

const STORAGE_KEY_PROPOSALS = 'jaldrishti_interventions_v1';

import { useLanguage } from '@/lib/context/LanguageContext';

function InterventionsContent() {
  const { t } = useLanguage();
  const searchParams = useSearchParams();
  const urlBlockParam = searchParams.get('block');
  const { activeRole } = useRole();

  const [proposals, setProposals] = useState<InterventionProposal[]>(INITIAL_INTERVENTIONS);
  const [selectedProposal, setSelectedProposal] = useState<InterventionProposal>(INITIAL_INTERVENTIONS[0]);
  const [showNewModal, setShowNewModal] = useState<boolean>(false);
  const [storageError, setStorageError] = useState<string | null>(null);

  const isReadOnly = !canMutateDemoWorkflows(activeRole);
  const restrictionNotice = demoRestrictionNotice(activeRole);

  // New Proposal Form State
  const [title, setTitle] = useState('');
  const [blockId, setBlockId] = useState(ALL_BLOCKS[0].id);
  const [schemeId, setSchemeId] = useState(INTERVENTION_SCHEMES[0].id);
  const [targetVillage, setTargetVillage] = useState('');
  const [estimatedCost, setEstimatedCost] = useState('2000000');
  const [beneficiaries, setBeneficiaries] = useState('3500');
  const [evidenceRationale, setEvidenceRationale] = useState('');
  const [missingEvidence, setMissingEvidence] = useState('');
  const [reviewOwnerRole, setReviewOwnerRole] = useState<UserRole>('district_collector');

  // New Comment State
  const [commentText, setCommentText] = useState('');

  // 1. Client-side Hydration from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_PROPOSALS);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setProposals(parsed);
          setSelectedProposal(parsed[0]);
        }
      }
    } catch (err) {
      console.warn('JalDrishti: Failed to load stored interventions:', err);
    }
  }, []);

  // 2. Query Context Pre-selection from Map Explorer Link
  useEffect(() => {
    if (urlBlockParam) {
      const validBlock = ALL_BLOCKS.find(b => b.id === urlBlockParam);
      if (validBlock) {
        setBlockId(validBlock.id);
        const matchingProp = proposals.find(p => p.blockId === validBlock.id);
        if (matchingProp) {
          setSelectedProposal(matchingProp);
        }
      }
    }
  }, [urlBlockParam, proposals]);

  // Safe localStorage saver helper
  const saveProposalsToStorage = (updatedList: InterventionProposal[]) => {
    try {
      localStorage.setItem(STORAGE_KEY_PROPOSALS, JSON.stringify(updatedList));
      setStorageError(null);
    } catch (err) {
      console.error('JalDrishti: Browser storage error:', err);
      setStorageError('Warning: Browser storage quota exceeded or unavailable. Changes shown in UI but may not persist across reload.');
    }
  };

  const selectedBlock = ALL_BLOCKS.find(b => b.id === blockId) || ALL_BLOCKS[0];
  const selectedScheme = INTERVENTION_SCHEMES.find(s => s.id === schemeId) || INTERVENTION_SCHEMES[0];

  const handleCreateProposal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canMutateDemoWorkflows(activeRole)) return;
    const newProp: InterventionProposal = {
      id: `prop_${Date.now()}`,
      title: title || `Intervention for ${selectedBlock.name}`,
      blockId: selectedBlock.id,
      blockName: selectedBlock.name,
      districtName: selectedBlock.districtName,
      schemeId: selectedScheme.id,
      schemeName: selectedScheme.name,
      proposedByRole: activeRole,
      proposedByName: `${activeRole.toUpperCase()} Office`,
      targetVillage: targetVillage || `${selectedBlock.name} Central Panchayat`,
      estimatedCostInr: parseInt(estimatedCost) || 1500000,
      beneficiariesCount: parseInt(beneficiaries) || 2000,
      evidenceRationale: evidenceRationale || `Evidence based on CGWB well depth (${selectedBlock.indicators.cgwbWellDepthMbgl}m bgl) and rainfall deficit (${selectedBlock.indicators.rainfallAnomalyMm}mm).`,
      missingEvidenceNotes: missingEvidence || 'Field hydrogeological survey required.',
      reviewOwnerRole: reviewOwnerRole,
      reviewOwnerName: `${reviewOwnerRole.toUpperCase()} Office`,
      status: 'under_review',
      createdDate: new Date().toISOString().split('T')[0],
      lastUpdatedDate: new Date().toISOString().split('T')[0],
      comments: [
        {
          authorName: 'System User',
          authorRole: activeRole,
          date: new Date().toISOString().split('T')[0],
          text: 'Proposal created and submitted for review.'
        }
      ]
    };

    const updatedList = [newProp, ...proposals];
    setProposals(updatedList);
    setSelectedProposal(newProp);
    saveProposalsToStorage(updatedList);
    setShowNewModal(false);
  };

  const handleUpdateStatus = (newStatus: InterventionProposal['status']) => {
    if (!canMutateDemoWorkflows(activeRole)) return;
    const updated = proposals.map(p => {
      if (p.id === selectedProposal.id) {
        return {
          ...p,
          status: newStatus,
          lastUpdatedDate: new Date().toISOString().split('T')[0]
        };
      }
      return p;
    });
    setProposals(updated);
    setSelectedProposal({
      ...selectedProposal,
      status: newStatus,
      lastUpdatedDate: new Date().toISOString().split('T')[0]
    });
    saveProposalsToStorage(updated);
  };

  const handleAddComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canMutateDemoWorkflows(activeRole)) return;
    if (!commentText.trim()) return;

    const newComment = {
      authorName: 'Authorized Reviewer',
      authorRole: activeRole,
      date: new Date().toISOString().split('T')[0],
      text: commentText
    };

    const updated = proposals.map(p => {
      if (p.id === selectedProposal.id) {
        return {
          ...p,
          comments: [...p.comments, newComment],
          lastUpdatedDate: new Date().toISOString().split('T')[0]
        };
      }
      return p;
    });

    setProposals(updated);
    setSelectedProposal({
      ...selectedProposal,
      comments: [...selectedProposal.comments, newComment],
      lastUpdatedDate: new Date().toISOString().split('T')[0]
    });
    saveProposalsToStorage(updated);
    setCommentText('');
  };

  const getStatusBadgeClass = (status: InterventionProposal['status']) => {
    switch (status) {
      case 'approved':
      case 'in_execution':
        return 'badge-normal';
      case 'under_review':
      case 'field_verification_requested':
        return 'badge-watch';
      case 'rejected':
        return 'badge-severe';
      default:
        return 'badge-gap';
    }
  };

  return (
    <div className="space-y-6">
      {storageError && (
        <div className="p-3 bg-amber-50 border border-amber-300 text-amber-900 rounded-lg text-xs font-semibold flex items-center justify-between">
          <span>{storageError}</span>
          <button onClick={() => setStorageError(null)} className="text-amber-700 hover:text-amber-900 font-bold ml-2">×</button>
        </div>
      )}

      {restrictionNotice && (
        <div role="note" className="p-3 bg-amber-50 border border-amber-300 text-amber-900 rounded-lg text-xs font-semibold">
          {restrictionNotice}
        </div>
      )}

      <div className="bg-surface border border-border rounded-lg p-6 shadow-card flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-text-main flex items-center gap-2">
            <DocumentTextIcon className="w-5 h-5 text-[#0d5c63]" /> {t('interventions.title')}
          </h1>
          <p className="text-xs text-text-muted mt-1">
            {t('interventions.subtitle')}
          </p>
        </div>

        {!isReadOnly && (
          <button
            onClick={() => setShowNewModal(true)}
            className="bg-[#0d5c63] hover:bg-[#094348] text-white text-xs font-semibold px-4 py-2.5 rounded-md shadow-sm transition-colors flex items-center gap-2"
          >
            {t('interventions.draftBtn')}
          </button>
        )}
      </div>

      {/* Main Grid: Proposals List + Detail Review Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Proposals List (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-surface border border-border rounded-lg p-4 shadow-card">
            <h2 className="text-xs font-bold text-text-muted uppercase tracking-wider mb-3">
              Active Intervention Proposals ({proposals.length})
            </h2>

            <div className="space-y-3">
              {proposals.map((prop) => {
                const isSelected = selectedProposal.id === prop.id;
                return (
                  <button
                    key={prop.id}
                    onClick={() => setSelectedProposal(prop)}
                    className={`w-full text-left p-3.5 rounded-lg border transition-all ${
                      isSelected
                        ? 'bg-subtle/80 border-[#0d5c63] ring-1 ring-[#0d5c63]'
                        : 'bg-surface hover:bg-subtle/40 border-border'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-text-main line-clamp-1">{prop.title}</span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-semibold shrink-0 ${getStatusBadgeClass(prop.status)}`}>
                        {prop.status.replace('_', ' ').toUpperCase()}
                      </span>
                    </div>

                    <div className="text-[11px] text-text-muted mt-1 flex items-center justify-between">
                      <span>{prop.blockName} ({prop.districtName})</span>
                      <span className="font-semibold text-text-main">₹{(prop.estimatedCostInr / 100000).toFixed(1)} Lakhs</span>
                    </div>

                    <div className="text-[10px] text-text-muted mt-1.5 line-clamp-2 italic">
                      &ldquo;{prop.evidenceRationale}&rdquo;
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Government Scheme Reference Cards */}
          <div className="bg-surface border border-border rounded-lg p-4 shadow-card space-y-3">
            <h2 className="text-xs font-bold text-text-main flex items-center gap-1.5">
              <ShieldCheckIcon className="w-4 h-4 text-[#0d5c63]" /> Supported Government Schemes
            </h2>
            <p className="text-[11px] text-amber-900 bg-amber-50 p-2 rounded border border-amber-200">
              {SCHEME_UNVERIFIED_NOTICE}
            </p>

            <div className="space-y-2 text-xs">
              {INTERVENTION_SCHEMES.map((sch) => (
                <div key={sch.id} className="p-2.5 bg-subtle/50 rounded border border-border space-y-1">
                  <div className="flex justify-between font-bold text-text-main">
                    <span>{sch.name}</span>
                    <span className="text-[10px] text-[#0d5c63]">Demonstration Cap: ₹{(sch.maxSanctionUnitAmountInr / 100000).toFixed(1)}L (unverified)</span>
                  </div>
                  <p className="text-[11px] text-text-muted">{sch.primaryFocus}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: Proposal Inspection & Governance Review Panel (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          <div className="bg-surface border border-border rounded-lg p-6 shadow-card space-y-5">
            {/* Header & Status Switcher */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-border">
              <div>
                <span className={`px-2.5 py-0.5 rounded text-xs font-semibold ${getStatusBadgeClass(selectedProposal.status)}`}>
                  STATUS: {selectedProposal.status.replace('_', ' ').toUpperCase()}
                </span>
                <h2 className="text-lg font-bold text-text-main mt-1">{selectedProposal.title}</h2>
                <p className="text-xs text-text-muted">
                  Proposal ID: {selectedProposal.id} • Created: {selectedProposal.createdDate}
                </p>
              </div>

              {/* Status Action Buttons */}
              {!isReadOnly && (
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => handleUpdateStatus('under_review')}
                    className="px-2.5 py-1 bg-subtle hover:bg-subtle/80 text-text-main text-xs font-semibold rounded border border-border"
                  >
                    Under Review
                  </button>
                  <button
                    onClick={() => handleUpdateStatus('field_verification_requested')}
                    className="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-900 text-xs font-semibold rounded border border-amber-300"
                  >
                    Request Field Survey
                  </button>
                  <button
                    onClick={() => handleUpdateStatus('approved')}
                    className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded"
                  >
                    Approve Proposal
                  </button>
                </div>
              )}
            </div>

            {/* Proposal Details Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="p-3 bg-subtle/40 rounded border border-border space-y-1">
                <span className="text-text-muted">Target Location & Panchayat:</span>
                <div className="font-bold text-text-main">{selectedProposal.targetVillage}</div>
                <div className="text-[11px] text-text-muted">{selectedProposal.blockName} Block, {selectedProposal.districtName}</div>
              </div>

              <div className="p-3 bg-subtle/40 rounded border border-border space-y-1">
                <span className="text-text-muted">Mapped Government Scheme:</span>
                <div className="font-bold text-[#0d5c63]">{selectedProposal.schemeName}</div>
                <div className="text-[11px] text-text-muted">Est. Cost: ₹{selectedProposal.estimatedCostInr.toLocaleString()}</div>
              </div>

              <div className="p-3 bg-subtle/40 rounded border border-border space-y-1">
                <span className="text-text-muted">Review Assignment:</span>
                <div className="font-bold text-text-main">{selectedProposal.reviewOwnerName}</div>
                <div className="text-[11px] text-text-muted">Role: {selectedProposal.reviewOwnerRole.toUpperCase()}</div>
              </div>

              <div className="p-3 bg-subtle/40 rounded border border-border space-y-1">
                <span className="text-text-muted">Target Beneficiaries:</span>
                <div className="font-bold text-text-main">{selectedProposal.beneficiariesCount.toLocaleString()} Rural Residents</div>
              </div>
            </div>

            {/* Evidence Rationale */}
            <div className="space-y-2">
              <span className="text-xs font-bold text-text-main">Environmental Evidence Rationale:</span>
              <p className="text-xs text-text-main bg-surface p-3 rounded border border-border leading-relaxed">
                {selectedProposal.evidenceRationale}
              </p>
            </div>

            {/* Missing Evidence Notes */}
            {selectedProposal.missingEvidenceNotes && (
              <div className="space-y-2">
                <span className="text-xs font-bold text-amber-900 flex items-center gap-1">
                  <InfoIcon className="w-3.5 h-3.5 text-amber-700" /> Missing Evidence & Survey Gaps:
                </span>
                <p className="text-xs text-amber-900 bg-amber-50/60 p-3 rounded border border-amber-200 leading-relaxed">
                  {selectedProposal.missingEvidenceNotes}
                </p>
              </div>
            )}

            {/* Comments & Governance Audit Trail */}
            <div className="space-y-3 pt-4 border-t border-border">
              <h3 className="text-xs font-bold text-text-main">Review Trail & Comments ({selectedProposal.comments.length})</h3>

              <div className="space-y-2.5 max-h-48 overflow-y-auto pr-1">
                {selectedProposal.comments.map((c, idx) => (
                  <div key={idx} className="p-2.5 bg-subtle/50 rounded border border-border text-xs space-y-1">
                    <div className="flex justify-between items-center text-text-muted text-[11px]">
                      <span className="font-bold text-text-main">{c.authorName} ({c.authorRole.toUpperCase()})</span>
                      <span>{c.date}</span>
                    </div>
                    <p className="text-text-main leading-snug">{c.text}</p>
                  </div>
                ))}
              </div>

              {/* Add Comment Form */}
              {!isReadOnly && (
                <form onSubmit={handleAddComment} className="flex gap-2 pt-2">
                  <input
                    type="text"
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    placeholder="Add review note or field survey observation..."
                    className="flex-1 bg-subtle border border-border rounded-md px-3 py-1.5 text-xs text-text-main focus:outline-none"
                  />
                  <button
                    type="submit"
                    className="bg-[#0d5c63] hover:bg-[#094348] text-white text-xs font-semibold px-4 py-1.5 rounded-md transition-colors"
                  >
                    Add Note
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* New Proposal Modal */}
      {showNewModal && !isReadOnly && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface border border-border rounded-lg max-w-lg w-full p-6 shadow-xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center pb-3 border-b border-border">
              <h3 className="text-base font-bold text-text-main">Draft New Intervention Proposal</h3>
              <button
                onClick={() => setShowNewModal(false)}
                className="text-text-muted hover:text-text-main text-lg font-bold"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleCreateProposal} className="space-y-3 text-xs">
              <div className="space-y-1">
                <label className="font-semibold text-text-main">Proposal Title:</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Check Dam & Piezometer Construction"
                  className="w-full bg-subtle border border-border rounded p-2 text-text-main focus:outline-none"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-semibold text-text-main">Target Block:</label>
                  <select
                    value={blockId}
                    onChange={(e) => setBlockId(e.target.value)}
                    className="w-full bg-subtle border border-border rounded p-2 text-text-main focus:outline-none"
                  >
                    {ALL_BLOCKS.map(b => (
                      <option key={b.id} value={b.id}>{b.name} ({b.districtName})</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-text-main">Scheme:</label>
                  <select
                    value={schemeId}
                    onChange={(e) => setSchemeId(e.target.value)}
                    className="w-full bg-subtle border border-border rounded p-2 text-text-main focus:outline-none"
                  >
                    {INTERVENTION_SCHEMES.map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-semibold text-text-main">Estimated Cost (INR):</label>
                  <input
                    type="number"
                    value={estimatedCost}
                    onChange={(e) => setEstimatedCost(e.target.value)}
                    className="w-full bg-subtle border border-border rounded p-2 text-text-main focus:outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-text-main">Beneficiaries:</label>
                  <input
                    type="number"
                    value={beneficiaries}
                    onChange={(e) => setBeneficiaries(e.target.value)}
                    className="w-full bg-subtle border border-border rounded p-2 text-text-main focus:outline-none"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-text-main">Evidence Rationale:</label>
                <textarea
                  value={evidenceRationale}
                  onChange={(e) => setEvidenceRationale(e.target.value)}
                  placeholder="Describe satellite TWSA anomaly, rainfall deficit, or well depth observations..."
                  rows={3}
                  className="w-full bg-subtle border border-border rounded p-2 text-text-main focus:outline-none"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-text-main">Missing Evidence & Hydrogeological Gaps:</label>
                <input
                  type="text"
                  value={missingEvidence}
                  onChange={(e) => setMissingEvidence(e.target.value)}
                  placeholder="e.g. Lithological core test required"
                  className="w-full bg-subtle border border-border rounded p-2 text-text-main focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-border">
                <button
                  type="button"
                  onClick={() => setShowNewModal(false)}
                  className="px-4 py-2 bg-subtle text-text-main font-semibold rounded hover:bg-subtle/80"
                >
                    Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#0d5c63] text-white font-semibold rounded hover:bg-[#094348]"
                >
                  Submit Proposal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default function InterventionsPage() {
  return (
    <Suspense fallback={<div className="p-6 text-xs text-text-muted">Loading Governance Workspace...</div>}>
      <InterventionsContent />
    </Suspense>
  );
}
