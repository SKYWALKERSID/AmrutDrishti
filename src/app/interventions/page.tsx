'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { INTERVENTION_SCHEMES } from '@/lib/data/schemes';
import { InterventionProposal, UserRole } from '@/lib/types';
import { useRole } from '@/lib/context/RoleContext';
import { canMutateDemoWorkflows, demoRestrictionNotice, SCHEME_UNVERIFIED_NOTICE } from '@/lib/demo/demoPolicy';
import { DocumentTextIcon, ShieldCheckIcon, UserRoleIcon, InfoIcon, FilterIcon } from '@/components/ui/Icons';
import { ALL_NATIONWIDE_BLOCKS, ALL_NATIONWIDE_DISTRICTS, mergeWithLiveBlocks, normalizeStateName } from '@/lib/data/allNationwideBlocks';
import { ALL_INDIAN_STATES } from '@/lib/data/indiaStates';
import { INITIAL_INTERVENTIONS } from '@/lib/data/interventions';

const STORAGE_KEY_PROPOSALS = 'jaldrishti_interventions_v1';

import { useLanguage } from '@/lib/context/LanguageContext';

function InterventionsContent() {
  const { t } = useLanguage();
  const searchParams = useSearchParams();
  const urlBlockParam = searchParams.get('block');
  const { activeRole } = useRole();

  const [proposals, setProposals] = useState<InterventionProposal[]>(INITIAL_INTERVENTIONS);
  const [selectedProposal, setSelectedProposal] = useState<InterventionProposal | null>(INITIAL_INTERVENTIONS[0] || null);
  const [blocksData, setBlocksData] = useState<any[]>(ALL_NATIONWIDE_BLOCKS);
  const [selectedStateFilter, setSelectedStateFilter] = useState<string>('all');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [showNewModal, setShowNewModal] = useState<boolean>(false);
  const [storageError, setStorageError] = useState<string | null>(null);

  const isReadOnly = !canMutateDemoWorkflows(activeRole);
  const restrictionNotice = demoRestrictionNotice(activeRole, t);

  // New Proposal Form State
  const [title, setTitle] = useState('');
  const [blockId, setBlockId] = useState(ALL_NATIONWIDE_BLOCKS[0]?.id || '');
  const [schemeId, setSchemeId] = useState(INTERVENTION_SCHEMES[0].id);
  const [targetVillage, setTargetVillage] = useState('');
  const [estimatedCost, setEstimatedCost] = useState('2000000');
  const [beneficiaries, setBeneficiaries] = useState('3500');
  const [evidenceRationale, setEvidenceRationale] = useState('');
  const [missingEvidence, setMissingEvidence] = useState('');
  const [reviewOwnerRole, setReviewOwnerRole] = useState<UserRole>('district_collector');

  // New Comment State
  const [commentText, setCommentText] = useState('');

  // 1. Client-side Hydration from Server API / PostgreSQL Database
  useEffect(() => {
    let active = true;
    async function loadData() {
      try {
        const [propRes, geoRes] = await Promise.allSettled([
          fetch('/api/interventions'),
          fetch('/api/geospatial/blocks')
        ]);

        if (geoRes.status === 'fulfilled' && geoRes.value.ok && active) {
          const geoJson = await geoRes.value.json();
          if (Array.isArray(geoJson.blocks)) {
            const merged = mergeWithLiveBlocks(geoJson.blocks);
            setBlocksData(merged);
            if (merged.length > 0) {
              setBlockId(merged[0].id);
            }
          }
        }

        if (propRes.status === 'fulfilled' && propRes.value.ok && active) {
          const json = await propRes.value.json();
          if (Array.isArray(json.proposals) && json.proposals.length > 0) {
            setProposals(json.proposals);
            setSelectedProposal(json.proposals[0]);
            return;
          }
        }
      } catch (err) {
        console.warn('JalDrishti: Remote proposals fetch fallback to local store:', err);
      }

      // Local storage fallback for user-authored proposals
      try {
        const saved = localStorage.getItem(STORAGE_KEY_PROPOSALS);
        if (saved && active) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setProposals(parsed);
            setSelectedProposal(parsed[0]);
            return;
          }
        }
      } catch {}

      if (active) {
        setProposals([]);
        setSelectedProposal(null);
      }
    }

    loadData().finally(() => {
      if (active) setIsLoading(false);
    });

    return () => {
      active = false;
    };
  }, []);

  // 2. Query Context Pre-selection from Map Explorer Link
  useEffect(() => {
    if (urlBlockParam && blocksData.length > 0) {
      const validBlock = blocksData.find(b => b.id === urlBlockParam);
      if (validBlock) {
        setBlockId(validBlock.id);
        const matchingProp = proposals.find(p => p.blockId === validBlock.id);
        if (matchingProp) {
          setSelectedProposal(matchingProp);
        }
      }
    }
  }, [urlBlockParam, proposals, blocksData]);

  // Server API & localStorage synchronized persistence helper
  const persistProposal = async (proposal: InterventionProposal, updatedList: InterventionProposal[]) => {
    try {
      localStorage.setItem(STORAGE_KEY_PROPOSALS, JSON.stringify(updatedList));
      setStorageError(null);
    } catch (err) {
      console.warn('JalDrishti: localStorage quota issue:', err);
    }

    try {
      await fetch('/api/interventions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ proposal }),
      });
    } catch (err) {
      console.warn('JalDrishti: Failed to post proposal to /api/interventions:', err);
    }
  };

  const selectedBlock = blocksData.find(b => b.id === blockId) || blocksData[0] || null;
  const selectedScheme = INTERVENTION_SCHEMES.find(s => s.id === schemeId) || INTERVENTION_SCHEMES[0];

  const handleCreateProposal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canMutateDemoWorkflows(activeRole) || !selectedBlock) return;
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
      evidenceRationale: evidenceRationale || `Evidence based on CGWB well depth (${selectedBlock.indicators?.cgwbWellDepthMbgl ?? 'N/A'}m bgl) and rainfall deficit (${selectedBlock.indicators?.rainfallAnomalyMm ?? 'N/A'}mm).`,
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
    persistProposal(newProp, updatedList);
    setShowNewModal(false);
  };

  const handleUpdateStatus = (newStatus: InterventionProposal['status']) => {
    if (!canMutateDemoWorkflows(activeRole) || !selectedProposal) return;
    let modifiedTarget: InterventionProposal | null = null;
    const updated = proposals.map(p => {
      if (p.id === selectedProposal.id) {
        modifiedTarget = {
          ...p,
          status: newStatus,
          lastUpdatedDate: new Date().toISOString().split('T')[0]
        };
        return modifiedTarget;
      }
      return p;
    });
    setProposals(updated);
    if (modifiedTarget) {
      setSelectedProposal(modifiedTarget);
      persistProposal(modifiedTarget, updated);
    } else {
      try {
        localStorage.setItem(STORAGE_KEY_PROPOSALS, JSON.stringify(updated));
      } catch {}
    }
  };

  const handleAddComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canMutateDemoWorkflows(activeRole) || !selectedProposal) return;
    if (!commentText.trim()) return;

    const newComment = {
      authorName: 'Authorized Reviewer',
      authorRole: activeRole,
      date: new Date().toISOString().split('T')[0],
      text: commentText
    };

    let modifiedTarget: InterventionProposal | null = null;
    const updated = proposals.map(p => {
      if (p.id === selectedProposal.id) {
        modifiedTarget = {
          ...p,
          comments: [...p.comments, newComment],
          lastUpdatedDate: new Date().toISOString().split('T')[0]
        };
        return modifiedTarget;
      }
      return p;
    });

    setProposals(updated);
    if (modifiedTarget) {
      setSelectedProposal(modifiedTarget);
      persistProposal(modifiedTarget, updated);
    } else {
      try {
        localStorage.setItem(STORAGE_KEY_PROPOSALS, JSON.stringify(updated));
      } catch {}
    }
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

      <div className="bg-surface border border-border rounded p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-text-muted mb-1.5">
            <span className="font-semibold text-text-main">
              Intervention Planning Workspace
            </span>
            <span>•</span>
            <span>State & Central Scheme Catalog</span>
          </div>
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
            className="bg-[#0d5c63] hover:bg-[#094348] text-white text-xs font-semibold px-4 py-2 rounded shadow-xs transition-colors flex items-center gap-2"
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
            <div className="flex items-center justify-between gap-2 mb-3">
              <h2 className="text-xs font-bold text-text-muted uppercase tracking-wider">
                {t('interventions.activeProposals', 'Active Intervention Proposals')} ({proposals.filter(p => {
                  if (selectedStateFilter === 'all') return true;
                  const b = blocksData.find(blk => blk.id === p.blockId);
                  return b ? normalizeStateName(b.state) === selectedStateFilter : true;
                }).length})
              </h2>
              <select
                value={selectedStateFilter}
                onChange={(e) => setSelectedStateFilter(e.target.value)}
                className="bg-subtle border border-border rounded px-2 py-1 text-[11px] font-medium text-text-main focus:outline-none cursor-pointer"
              >
                <option value="all">All States</option>
                {ALL_INDIAN_STATES.filter(s => s.hasData).map(st => (
                  <option key={st.code} value={st.name}>{st.name}</option>
                ))}
              </select>
            </div>

            {isLoading ? (
              <div className="space-y-3 animate-pulse">
                <div className="h-20 bg-subtle rounded-lg"></div>
                <div className="h-20 bg-subtle rounded-lg"></div>
                <div className="h-20 bg-subtle rounded-lg"></div>
              </div>
            ) : proposals.length > 0 ? (
              <div className="space-y-3">
                {proposals.filter(p => {
                  if (selectedStateFilter === 'all') return true;
                  const b = blocksData.find(blk => blk.id === p.blockId);
                  return b ? normalizeStateName(b.state) === selectedStateFilter : true;
                }).map((prop) => {
                  const isSelected = selectedProposal?.id === prop.id;
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
                        <span className="text-xs font-bold text-text-main line-clamp-1">{t(`interventions.${prop.id}.title`, prop.title)}</span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-semibold shrink-0 ${getStatusBadgeClass(prop.status)}`}>
                          {t(`status.${prop.status}`, prop.status.replace('_', ' ').toUpperCase())}
                        </span>
                      </div>

                      <div className="text-[11px] text-text-muted mt-1 flex items-center justify-between">
                        <span>{prop.blockName} ({prop.districtName})</span>
                        <span className="font-semibold text-text-main">₹{(prop.estimatedCostInr / 100000).toFixed(1)} {t('interventions.lakhs', 'Lakhs')}</span>
                      </div>

                      <div className="text-[10px] text-text-muted mt-1.5 line-clamp-2 italic">
                        &ldquo;{t(`interventions.${prop.id}.rationale`, prop.evidenceRationale)}&rdquo;
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="py-8 text-center text-xs text-text-muted space-y-1">
                <p className="font-semibold text-text-main">No Proposals Recorded</p>
                <p>Click &apos;Draft New Proposal&apos; to prepare an intervention proposal.</p>
              </div>
            )}
          </div>

          {/* Government Scheme Reference Cards */}
          <div className="bg-surface border border-border rounded-lg p-4 shadow-card space-y-3">
            <h2 className="text-xs font-bold text-text-main flex items-center gap-1.5">
              <ShieldCheckIcon className="w-4 h-4 text-[#0d5c63]" /> {t('interventions.supportedSchemes', 'Supported Government Schemes')}
            </h2>
            <p className="text-[11px] text-amber-900 bg-amber-50 p-2 rounded border border-amber-200">
              {t('interventions.schemesNotice', SCHEME_UNVERIFIED_NOTICE)}
            </p>

            <div className="space-y-2 text-xs">
              {INTERVENTION_SCHEMES.map((sch) => (
                <div key={sch.id} className="p-2.5 bg-subtle/50 rounded border border-border space-y-1">
                  <div className="flex justify-between font-bold text-text-main">
                    <span>{sch.name}</span>
                    <span className="text-[10px] text-[#0d5c63]">{t('interventions.demonstrationCap', 'Demonstration Cap')}: ₹{(sch.maxSanctionUnitAmountInr / 100000).toFixed(1)}{t('interventions.unverifiedCap', 'L (unverified)')}</span>
                  </div>
                  <p className="text-[11px] text-text-muted">{t(`scheme.${sch.id}.focus`, sch.primaryFocus)}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: Proposal Inspection & Governance Review Panel (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          <div className="bg-surface border border-border rounded-lg p-6 shadow-card space-y-5">
            {isLoading ? (
              <div className="space-y-4 animate-pulse">
                <div className="h-6 bg-subtle rounded w-1/3"></div>
                <div className="h-8 bg-subtle rounded w-2/3"></div>
                <div className="h-4 bg-subtle rounded w-1/2"></div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="h-16 bg-subtle rounded"></div>
                  <div className="h-16 bg-subtle rounded"></div>
                  <div className="h-16 bg-subtle rounded"></div>
                </div>
              </div>
            ) : selectedProposal ? (
              <>
                {/* Header & Status Switcher */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-border">
                  <div>
                    <span className={`px-2.5 py-0.5 rounded text-xs font-semibold ${getStatusBadgeClass(selectedProposal.status)}`}>
                      {t('interventions.statusLabel', 'STATUS')}: {t(`status.${selectedProposal.status}`, selectedProposal.status.replace('_', ' ').toUpperCase())}
                    </span>
                    <h2 className="text-lg font-bold text-text-main mt-1">{t(`interventions.${selectedProposal.id}.title`, selectedProposal.title)}</h2>
                    <p className="text-xs text-text-muted">
                      {t('interventions.proposalId', 'Proposal ID')}: {selectedProposal.id} • {t('interventions.createdDate', 'Created')}: {selectedProposal.createdDate}
                    </p>
                  </div>

                  {/* Status Action Buttons */}
                  {!isReadOnly && (
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        onClick={() => handleUpdateStatus('under_review')}
                        className="px-2.5 py-1 bg-subtle hover:bg-subtle/80 text-text-main text-xs font-semibold rounded border border-border"
                      >
                        {t('interventions.underReview', 'Under Review')}
                      </button>
                      <button
                        onClick={() => handleUpdateStatus('field_verification_requested')}
                        className="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-900 text-xs font-semibold rounded border border-amber-300"
                      >
                        {t('interventions.requestSurvey', 'Request Field Survey')}
                      </button>
                      <button
                        onClick={() => handleUpdateStatus('approved')}
                        className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded"
                      >
                        {t('interventions.approveProposal', 'Approve Proposal')}
                      </button>
                    </div>
                  )}
                </div>

            {/* Proposal Details Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="p-3 bg-subtle/40 rounded border border-border space-y-1">
                <span className="text-text-muted">{t('interventions.targetLocation', 'Target Location & Panchayat')}:</span>
                <div className="font-bold text-text-main">{selectedProposal.targetVillage}</div>
                <div className="text-[11px] text-text-muted">{selectedProposal.blockName} Block, {selectedProposal.districtName}</div>
              </div>

              <div className="p-3 bg-subtle/40 rounded border border-border space-y-1">
                <span className="text-text-muted">{t('interventions.mappedScheme', 'Mapped Government Scheme')}:</span>
                <div className="font-bold text-[#0d5c63]">{selectedProposal.schemeName}</div>
                <div className="text-[11px] text-text-muted">{t('interventions.estCost', 'Est. Cost')}: ₹{selectedProposal.estimatedCostInr.toLocaleString()}</div>
              </div>

              <div className="p-3 bg-subtle/40 rounded border border-border space-y-1">
                <span className="text-text-muted">{t('interventions.reviewAssignment', 'Review Assignment')}:</span>
                <div className="font-bold text-text-main">{selectedProposal.reviewOwnerName}</div>
                <div className="text-[11px] text-text-muted">{t('interventions.roleLabel', 'Role')}: {t(`role.${selectedProposal.reviewOwnerRole}`, selectedProposal.reviewOwnerRole.toUpperCase())}</div>
              </div>

              <div className="p-3 bg-subtle/40 rounded border border-border space-y-1">
                <span className="text-text-muted">{t('interventions.targetBeneficiaries', 'Target Beneficiaries')}:</span>
                <div className="font-bold text-text-main">{selectedProposal.beneficiariesCount.toLocaleString()} {t('interventions.ruralResidents', 'Rural Residents')}</div>
              </div>
            </div>

            {/* Evidence Rationale */}
            <div className="space-y-2">
              <span className="text-xs font-bold text-text-main">{t('interventions.environmentalRationale', 'Environmental Evidence Rationale')}:</span>
              <p className="text-xs text-text-main bg-surface p-3 rounded border border-border leading-relaxed">
                {t(`interventions.${selectedProposal.id}.rationale`, selectedProposal.evidenceRationale)}
              </p>
            </div>

            {/* Missing Evidence Notes */}
            {selectedProposal.missingEvidenceNotes && (
              <div className="space-y-2">
                <span className="text-xs font-bold text-amber-900 flex items-center gap-1">
                  <InfoIcon className="w-3.5 h-3.5 text-amber-700" /> {t('interventions.missingEvidenceGap', 'Missing Evidence & Survey Gaps')}:
                </span>
                <p className="text-xs text-amber-900 bg-amber-50/60 p-3 rounded border border-amber-200 leading-relaxed">
                  {t(`interventions.${selectedProposal.id}.missingNotes`, selectedProposal.missingEvidenceNotes)}
                </p>
              </div>
            )}

            {/* Comments & Governance Audit Trail */}
            <div className="space-y-3 pt-4 border-t border-border">
              <h3 className="text-xs font-bold text-text-main">{t('interventions.reviewTrail', 'Review Trail & Comments')} ({selectedProposal.comments.length})</h3>

              <div className="space-y-2.5 max-h-48 overflow-y-auto pr-1">
                {selectedProposal.comments.map((c, idx) => (
                  <div key={idx} className="p-2.5 bg-subtle/50 rounded border border-border text-xs space-y-1">
                    <div className="flex justify-between items-center text-text-muted text-[11px]">
                      <span className="font-bold text-text-main">{c.authorName} ({t(`role.${c.authorRole}`, c.authorRole.toUpperCase())})</span>
                      <span>{c.date}</span>
                    </div>
                    <p className="text-text-main leading-snug">{t(`interventions.${selectedProposal.id}.comment${idx+1}`, c.text)}</p>
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
                    placeholder={t('interventions.addNotePlaceholder', 'Add review note or field survey observation...')}
                    className="flex-1 bg-subtle border border-border rounded-md px-3 py-1.5 text-xs text-text-main focus:outline-none"
                  />
                  <button
                    type="submit"
                    className="bg-[#0d5c63] hover:bg-[#094348] text-white text-xs font-semibold px-4 py-1.5 rounded-md transition-colors"
                  >
                    {t('interventions.addNoteBtn', 'Add Note')}
                  </button>
                </form>
              )}
            </div>
          </>
        ) : (
          <div className="py-12 text-center text-xs text-text-muted space-y-1">
            <p className="font-semibold text-text-main">No Proposal Selected</p>
            <p>Select a proposal from the list or click &apos;Draft New Proposal&apos; to submit an intervention.</p>
          </div>
        )}
      </div>
    </div>
  </div>

      {/* New Proposal Modal */}
      {showNewModal && !isReadOnly && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface border border-border rounded-lg max-w-lg w-full p-6 shadow-xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center pb-3 border-b border-border">
              <h3 className="text-base font-bold text-text-main">{t('interventions.modalTitle', 'Draft New Intervention Proposal')}</h3>
              <button
                onClick={() => setShowNewModal(false)}
                className="text-text-muted hover:text-text-main text-lg font-bold"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleCreateProposal} className="space-y-3 text-xs">
              <div className="space-y-1">
                <label className="font-semibold text-text-main">{t('interventions.proposalTitleLabel', 'Proposal Title')}:</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={t('interventions.proposalTitlePlaceholder', 'e.g. Check Dam & Piezometer Construction')}
                  className="w-full bg-subtle border border-border rounded p-2 text-text-main focus:outline-none"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-semibold text-text-main">{t('interventions.targetBlockLabel', 'Target Block')}:</label>
                  <select
                    value={blockId}
                    onChange={(e) => setBlockId(e.target.value)}
                    className="w-full bg-subtle border border-border rounded p-2 text-text-main focus:outline-none"
                  >
                    {blocksData.map((b: any) => (
                      <option key={b.id} value={b.id}>{b.name} ({b.districtName})</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-text-main">{t('interventions.schemeLabel', 'Scheme')}:</label>
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
                  <label className="font-semibold text-text-main">{t('interventions.estCostLabel', 'Estimated Cost (INR)')}:</label>
                  <input
                    type="number"
                    value={estimatedCost}
                    onChange={(e) => setEstimatedCost(e.target.value)}
                    className="w-full bg-subtle border border-border rounded p-2 text-text-main focus:outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-text-main">{t('interventions.beneficiariesLabel', 'Beneficiaries')}:</label>
                  <input
                    type="number"
                    value={beneficiaries}
                    onChange={(e) => setBeneficiaries(e.target.value)}
                    className="w-full bg-subtle border border-border rounded p-2 text-text-main focus:outline-none"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-text-main">{t('interventions.evidenceRationaleLabel', 'Evidence Rationale')}:</label>
                <textarea
                  value={evidenceRationale}
                  onChange={(e) => setEvidenceRationale(e.target.value)}
                  placeholder={t('interventions.evidenceRationalePlaceholder', 'Describe satellite TWSA anomaly, rainfall deficit, or well depth observations...')}
                  rows={3}
                  className="w-full bg-subtle border border-border rounded p-2 text-text-main focus:outline-none"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-text-main">{t('interventions.missingEvidenceLabel', 'Missing Evidence & Hydrogeological Gaps')}:</label>
                <input
                  type="text"
                  value={missingEvidence}
                  onChange={(e) => setMissingEvidence(e.target.value)}
                  placeholder={t('interventions.missingEvidencePlaceholder', 'e.g. Lithological core test required')}
                  className="w-full bg-subtle border border-border rounded p-2 text-text-main focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-border">
                <button
                  type="button"
                  onClick={() => setShowNewModal(false)}
                  className="px-4 py-2 bg-subtle text-text-main font-semibold rounded hover:bg-subtle/80"
                >
                    {t('interventions.cancelBtn', 'Cancel')}
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#0d5c63] text-white font-semibold rounded hover:bg-[#094348]"
                >
                  {t('interventions.submitBtn', 'Submit Proposal')}
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
