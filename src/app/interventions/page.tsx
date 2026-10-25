'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { INTERVENTION_SCHEMES } from '@/lib/data/schemes';
import { InterventionProposal, UserRole } from '@/lib/types';
import { useRole } from '@/lib/context/RoleContext';
import { canMutateDemoWorkflows, demoRestrictionNotice, SCHEME_UNVERIFIED_NOTICE } from '@/lib/demo/demoPolicy';
import { DocumentTextIcon, ShieldCheckIcon, UserRoleIcon, InfoIcon, FilterIcon } from '@/components/ui/Icons';
import { ALL_NATIONWIDE_BLOCKS, ALL_NATIONWIDE_DISTRICTS, ACTIVE_TARGET_BLOCKS, mergeWithLiveBlocks, normalizeStateName } from '@/lib/data/allNationwideBlocks';
import { ALL_INDIAN_STATES, ALL_TARGET_STATES, isTargetState } from '@/lib/data/indiaStates';
import { sortBlocksHierarchy } from '@/lib/data/geographicSorting';
import { INITIAL_INTERVENTIONS } from '@/lib/data/interventions';
import { matchInterventionRecommendations, SchemeRecommendationMatch } from '@/lib/services/scientificEngine';
import { detectIntegratedSituation, generateSituationAwareInterventions, IntegratedSituationAssessment, SituationAwareInterventionRecommendation } from '@/lib/services/situationAwareInterventionEngine';
import { BlockData } from '@/lib/types';

const STORAGE_KEY_PROPOSALS = 'jaldrishti_interventions_v1';

import { useLanguage } from '@/lib/context/LanguageContext';

function InterventionsContent() {
  const { t } = useLanguage();
  const searchParams = useSearchParams();
  const urlBlockParam = searchParams.get('block');
  const { activeRole } = useRole();

  const [proposals, setProposals] = useState<InterventionProposal[]>(INITIAL_INTERVENTIONS);
  const [selectedProposal, setSelectedProposal] = useState<InterventionProposal | null>(INITIAL_INTERVENTIONS[0] || null);
  const [blocksData, setBlocksData] = useState<BlockData[]>(ACTIVE_TARGET_BLOCKS);
  const [selectedBlockId, setSelectedBlockId] = useState<string>(urlBlockParam || ACTIVE_TARGET_BLOCKS[0]?.id || '');
  const [selectedStateFilter, setSelectedStateFilter] = useState<string>('all');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [storageError, setStorageError] = useState<string | null>(null);
  const [showNewModal, setShowNewModal] = useState<boolean>(false);

  // Situation-Aware Intelligence States
  const [rainfallIntel, setRainfallIntel] = useState<any | null>(null);
  const [rainfallForecast, setRainfallForecast] = useState<any | null>(null);
  const [groundwaterForecast90, setGroundwaterForecast90] = useState<any | null>(null);
  const [isSituationLoading, setIsSituationLoading] = useState<boolean>(false);

  const isReadOnly = !canMutateDemoWorkflows(activeRole);
  const restrictionNotice = demoRestrictionNotice(activeRole, t);

  // New Proposal Form State
  const [title, setTitle] = useState('');
  const [blockId, setBlockId] = useState(ACTIVE_TARGET_BLOCKS[0]?.id || '');
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
          fetch('/api/interventions', {
            headers: {
              'x-jaldrishti-role': activeRole,
            },
          }),
          fetch('/api/geospatial/blocks')
        ]);

        if (geoRes.status === 'fulfilled' && geoRes.value.ok && active) {
          const geoJson = await geoRes.value.json();
          if (Array.isArray(geoJson.blocks)) {
            const merged = sortBlocksHierarchy(
              mergeWithLiveBlocks(geoJson.blocks).filter(b => isTargetState(b.state))
            );
            setBlocksData(merged);
            if (merged.length > 0 && !blockId) {
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
        setProposals(INITIAL_INTERVENTIONS);
        setSelectedProposal(INITIAL_INTERVENTIONS[0] || null);
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
        setSelectedBlockId(validBlock.id);
        setBlockId(validBlock.id);
        const matchingProp = proposals.find(p => p.blockId === validBlock.id);
        if (matchingProp) {
          setSelectedProposal(matchingProp);
        }
      }
    }
  }, [urlBlockParam, proposals, blocksData]);

  // 3. Load Rainfall Intelligence & Station Groundwater Forecast for Selected Block
  useEffect(() => {
    const activeBlock = blocksData.find(b => b.id === selectedBlockId);
    if (!activeBlock) return;
    let active = true;
    setIsSituationLoading(true);

    Promise.allSettled([
      fetch(`/api/rainfall?district=${encodeURIComponent(activeBlock.districtName)}&state=${encodeURIComponent(activeBlock.state)}`).then(r => r.json()),
      fetch('/api/station-forecast?stations=true').then(r => r.json()).then(async (dir) => {
        if (dir.status === 'available' && Array.isArray(dir.stations)) {
          const match = dir.stations.find((s: any) =>
            s.district.toLowerCase() === activeBlock.districtName.toLowerCase() ||
            s.state.toLowerCase() === activeBlock.state.toLowerCase()
          );
          if (match) {
            const fcRes = await fetch(`/api/station-forecast?stationId=${encodeURIComponent(match.stationId)}&horizonDays=90`);
            return fcRes.json();
          }
        }
        return null;
      })
    ]).then(([rainRes, gwRes]) => {
      if (!active) return;
      if (rainRes.status === 'fulfilled' && rainRes.value.status === 'available') {
        setRainfallIntel(rainRes.value.historicalIntelligence || null);
        setRainfallForecast(rainRes.value.forecast || null);
      } else {
        setRainfallIntel(null);
        setRainfallForecast(null);
      }

      if (gwRes.status === 'fulfilled' && gwRes.value && gwRes.value.status === 'experimental') {
        setGroundwaterForecast90(gwRes.value);
      } else {
        setGroundwaterForecast90(null);
      }
    }).catch(() => {
      if (active) {
        setRainfallIntel(null);
        setRainfallForecast(null);
        setGroundwaterForecast90(null);
      }
    }).finally(() => {
      if (active) setIsSituationLoading(false);
    });

    return () => {
      active = false;
    };
  }, [selectedBlockId, blocksData]);

  // Server API & localStorage synchronized persistence helper
  const persistProposal = async (proposal: InterventionProposal, updatedList: InterventionProposal[]) => {
    try {
      localStorage.setItem(STORAGE_KEY_PROPOSALS, JSON.stringify(updatedList));
      setStorageError(null);
    } catch (err) {
      console.warn('JalDrishti: localStorage quota issue:', err);
    }

    try {
      const res = await fetch('/api/interventions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-jaldrishti-role': activeRole,
          'x-jaldrishti-district': proposal.districtName,
        },
        body: JSON.stringify({ proposal }),
      });
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        console.warn('JalDrishti: Proposal persistence warning:', errJson.error || res.statusText);
      }
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

  const currentBlock: BlockData | null = blocksData.find(b => b.id === selectedBlockId) || blocksData[0] || null;
  const legacyRecommendations: SchemeRecommendationMatch[] = currentBlock ? matchInterventionRecommendations(currentBlock) : [];
  
  // Situation Assessment integrating groundwater observations, telemetry forecast, and unified rainfall
  const situationAssessment: IntegratedSituationAssessment | null = currentBlock
    ? detectIntegratedSituation(currentBlock, rainfallIntel, rainfallForecast, groundwaterForecast90)
    : null;
  const situationInterventions: SituationAwareInterventionRecommendation[] = situationAssessment
    ? generateSituationAwareInterventions(situationAssessment)
    : [];

  return (
    <div className="space-y-6">
      {storageError && (
        <div className="p-3 bg-amber-50 border border-amber-300 text-amber-900 rounded text-xs font-semibold flex items-center justify-between">
          <span>{storageError}</span>
          <button onClick={() => setStorageError(null)} className="text-amber-700 hover:text-amber-900 font-bold ml-2">×</button>
        </div>
      )}

      {restrictionNotice && (
        <div role="note" className="p-3 bg-amber-50 border border-amber-300 text-amber-900 rounded text-xs font-semibold">
          {restrictionNotice}
        </div>
      )}

      <div className="border-b border-border pb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-text-muted mb-2">
            <span className="font-semibold text-text-main">
              Intervention Planning Workspace*
            </span>
            <span aria-hidden="true">•</span>
            <span>MoJS / PMKSY / Atal Bhujal Yojana Guidelines</span>
            <span aria-hidden="true">•</span>
            <span>Observation Cutoff: October 2026</span>
          </div>
          <h1 className="dbim-heading-1 text-text-main flex items-center gap-2 flex-wrap">
            <DocumentTextIcon className="w-6 h-6 text-primary" /> {t('interventions.title')}*
          </h1>
          <p className="text-xs sm:text-sm text-text-muted mt-1.5 leading-relaxed">
            {t('interventions.subtitle')}
          </p>
        </div>

        {!isReadOnly && (
          <button
            onClick={() => setShowNewModal(true)}
            className="bg-primary hover:bg-primary-hover text-text-inverted text-xs font-semibold px-4 py-2 transition-colors flex items-center gap-2 cursor-pointer"
          >
            {t('interventions.draftBtn')}
          </button>
        )}
      </div>

      {/* Scientific Pre-Feasibility Recommendations Section */}
      <section aria-labelledby="scientific-recommendations-title" className="p-5 border border-border bg-card space-y-4" data-testid="intervention-recommendations-panel">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-border">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-primary">
                Scientific Engine
              </span>
              <span className="text-text-muted">•</span>
              <span className="text-xs text-text-muted">Multi-Criteria Policy Rule Matching</span>
            </div>
            <h2 id="scientific-recommendations-title" className="text-base font-bold text-text-main mt-0.5">
              Target Block Pre-Feasibility Scheme Recommendations
            </h2>
          </div>

          <div className="flex items-center gap-2">
            <label htmlFor="block-recom-select" className="text-xs text-text-muted shrink-0">
              Selected Block:
            </label>
            <select
              id="block-recom-select"
              value={selectedBlockId}
              onChange={(e) => {
                setSelectedBlockId(e.target.value);
                setBlockId(e.target.value);
              }}
              className="bg-subtle border border-border px-2.5 py-1 text-xs font-medium text-text-main focus:outline-none cursor-pointer max-w-[220px]"
            >
              {blocksData.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name} ({b.districtName}, {b.state})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Mandatory Pre-Feasibility Disclaimer */}
        <div className="p-3 bg-subtle/80 border border-border text-xs text-text-muted leading-relaxed">
          <span className="font-semibold text-text-main">Rule-Based Pre-feasibility Suggestion</span> — Detailed Project Report (DPR) and field hydrogeological survey required before financial sanction.
        </div>

        {currentBlock ? (
          <div className="space-y-4">
            {/* Indicator Evaluation Audit */}
            <div className="p-3 bg-subtle/40 border border-border text-xs space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-bold text-text-main">
                  Evaluated Hydrogeological Criteria for {currentBlock.name} ({currentBlock.districtName}):
                </span>
                <span className={`text-[10px] font-bold px-2 py-0.5 border ${
                  currentBlock.riskSeverity === 'severe'
                    ? 'bg-red-500/10 text-red-800 border-red-500/30'
                    : currentBlock.riskSeverity === 'watch'
                    ? 'bg-amber-500/10 text-amber-800 border-amber-500/30'
                    : 'bg-emerald-500/10 text-emerald-800 border-emerald-500/30'
                }`}>
                  STRESS: {currentBlock.riskSeverity.toUpperCase()}
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 pt-2 text-[11px]">
                <div>
                  <span className="text-text-muted block">Well Depth:</span>
                  <span className="font-mono font-medium text-text-main">
                    {currentBlock.indicators.cgwbWellDepthMbgl !== null ? `${currentBlock.indicators.cgwbWellDepthMbgl} m bgl` : 'Missing'}
                  </span>
                </div>
                <div>
                  <span className="text-text-muted block">Drawdown Trend:</span>
                  <span className="font-mono font-medium text-text-main">
                    {currentBlock.indicators.wellDepthTrendMperYr !== null ? `${currentBlock.indicators.wellDepthTrendMperYr} m/yr` : 'Unavailable'}
                  </span>
                </div>
                <div>
                  <span className="text-text-muted block">Rainfall Anomaly:</span>
                  <span className="font-mono font-medium text-text-main">
                    {currentBlock.indicators.rainfallAnomalyMm !== null ? `${currentBlock.indicators.rainfallAnomalyMm} mm` : 'Missing'}
                  </span>
                </div>
                <div>
                  <span className="text-text-muted block">Surface Water (NDWI):</span>
                  <span className="font-mono font-medium text-text-main">
                    {currentBlock.indicators.sentinelNdwi !== null ? currentBlock.indicators.sentinelNdwi : 'Unavailable'}
                  </span>
                </div>
                <div>
                  <span className="text-text-muted block">Soil Moisture:</span>
                  <span className="font-mono font-medium text-text-main">
                    {currentBlock.indicators.smapSoilMoisture !== null ? `${currentBlock.indicators.smapSoilMoisture} m³/m³` : 'Unavailable'}
                  </span>
                </div>
              </div>

              <p className="text-[10px] text-text-muted italic pt-1 border-t border-border/50">
                Notice: Recommendations are rule-matched against available hydrogeological indicators only. GIS terrain slope (DEM) and soil permeability layers are unverified for this block.
              </p>
            </div>

            {/* Integrated Situation Assessment Card */}
            {situationAssessment && (
              <div className="p-3.5 border border-primary/30 bg-primary/5 space-y-2.5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/80 pb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider bg-primary text-text-inverted px-2 py-0.5 rounded-xs">
                      Situation Detected
                    </span>
                    <h3 className="text-sm font-bold text-text-main">{situationAssessment.title}</h3>
                  </div>
                  <span className={`text-[11px] font-bold px-2 py-0.5 border ${
                    situationAssessment.urgency === 'immediate'
                      ? 'bg-red-500/10 text-red-800 border-red-500/30'
                      : situationAssessment.urgency === 'high'
                      ? 'bg-amber-500/10 text-amber-800 border-amber-500/30'
                      : 'bg-emerald-500/10 text-emerald-800 border-emerald-500/30'
                  }`}>
                    URGENCY: {situationAssessment.urgency.toUpperCase()}
                  </span>
                </div>

                <p className="text-xs text-text-main leading-relaxed">
                  {situationAssessment.situationSummary}
                </p>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-[11px] bg-subtle p-2 border border-border">
                  <div>
                    <span className="text-text-muted block text-[10px] uppercase">Rainfall Anomaly (30d)</span>
                    <span className="font-mono font-bold text-text-main">
                      {situationAssessment.triggeringEvidence.rainfallAnomalyMm !== null && situationAssessment.triggeringEvidence.rainfallAnomalyMm !== undefined
                        ? `${situationAssessment.triggeringEvidence.rainfallAnomalyMm} mm`
                        : 'Missing'}
                    </span>
                  </div>
                  <div>
                    <span className="text-text-muted block text-[10px] uppercase">Monitored Well Depth</span>
                    <span className="font-mono font-bold text-text-main">
                      {situationAssessment.triggeringEvidence.groundwaterDepthMbgl !== null && situationAssessment.triggeringEvidence.groundwaterDepthMbgl !== undefined
                        ? `${situationAssessment.triggeringEvidence.groundwaterDepthMbgl} m bgl`
                        : 'Missing'}
                    </span>
                  </div>
                  <div>
                    <span className="text-text-muted block text-[10px] uppercase">Drawdown Trend (Rate)</span>
                    <span className="font-mono font-bold text-text-main">
                      {situationAssessment.triggeringEvidence.drawdownRateMperYr !== null && situationAssessment.triggeringEvidence.drawdownRateMperYr !== undefined
                        ? `${situationAssessment.triggeringEvidence.drawdownRateMperYr} m/yr`
                        : 'Unavailable'}
                    </span>
                  </div>
                  <div>
                    <span className="text-text-muted block text-[10px] uppercase">Telemetry Forecast (+90d)</span>
                    <span className="font-mono font-bold text-primary">
                      {situationAssessment.triggeringEvidence.predictedDepthHorizon90d !== null && situationAssessment.triggeringEvidence.predictedDepthHorizon90d !== undefined
                        ? `${situationAssessment.triggeringEvidence.predictedDepthHorizon90d.toFixed(2)} m bgl`
                        : 'N/A (Station)'}
                    </span>
                  </div>
                </div>

                <div className="text-[10px] text-text-muted italic pt-1 border-t border-border/50">
                  <span className="font-semibold text-text-main">Detection Logic: </span>
                  {situationAssessment.ruleExplanation}
                </div>
              </div>
            )}

            {/* Prioritized Situation-Aware Interventions Grid */}
            <div className="space-y-2">
              <div className="flex items-center justify-between pb-1">
                <span className="text-xs font-bold text-text-muted uppercase tracking-wider">
                  Situation-Aware Prioritized Interventions ({situationInterventions.length} Schemes Analyzed)
                </span>
                <span className="text-[10px] text-text-muted">
                  Ranked by Multi-Criteria Urgency &amp; Aquifer Vulnerability
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {situationInterventions.map((rec) => (
                  <div key={rec.id} className="p-3.5 border border-border bg-subtle/20 space-y-2.5 flex flex-col justify-between">
                    <div className="space-y-1.5">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] bg-subtle text-text-muted border border-border px-1.5 py-0.2 font-mono">
                              Priority {rec.priorityScore}/100
                            </span>
                            <span className="text-[10px] text-text-muted font-semibold">
                              {rec.schemeName}
                            </span>
                          </div>
                          <h4 className="text-xs font-bold text-text-main mt-0.5">{rec.interventionType}</h4>
                        </div>
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 border shrink-0 ${
                          rec.eligible
                            ? 'bg-emerald-500/10 text-emerald-800 border-emerald-500/30'
                            : 'bg-subtle text-text-muted border-border'
                        }`}>
                          {rec.eligible ? 'ELIGIBLE' : 'CRITERIA NOT MET'}
                        </span>
                      </div>

                      <p className="text-xs text-text-muted leading-relaxed">
                        {rec.rationale}
                      </p>

                      {rec.feasibilityConstraints.length > 0 && (
                        <div className="text-[11px] text-text-muted bg-surface p-2 border border-border space-y-0.5">
                          <span className="font-semibold text-text-main block text-[10px] uppercase">Feasibility Constraints:</span>
                          <ul className="list-disc list-inside space-y-0.5">
                            {rec.feasibilityConstraints.map((c, idx) => (
                              <li key={idx}>{c}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>

                    <div className="pt-2 border-t border-border space-y-1 text-[11px]">
                      <div className="flex items-center justify-between text-text-muted">
                        <span>Approval Authority:</span>
                        <span className="font-medium text-text-main">{rec.requiredApprovalAuthority}</span>
                      </div>
                      <div className="flex items-center justify-between text-text-muted">
                        <span>Indicative Sanction Range:</span>
                        <span className="font-mono font-semibold text-text-main">
                          ₹{(rec.estimatedCostRangeInr[0] / 100000).toFixed(1)}L – ₹{(rec.estimatedCostRangeInr[1] / 100000).toFixed(1)}L
                        </span>
                      </div>
                      <div className="text-[10px] text-text-muted/80 pt-1 border-t border-border/40">
                        <span className="font-semibold text-text-main">Monitoring Key: </span>
                        {rec.measurableMonitoringIndicator}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="p-6 text-center text-xs text-text-muted italic bg-subtle/30 border border-border">
            Select a monitored block to evaluate pre-feasibility intervention schemes.
          </div>
        )}
      </section>

      {/* Main Grid: Proposals List + Detail Review Panel (Open Layout) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Proposals List (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2 pb-2 border-b border-border">
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
                className="bg-subtle border border-border px-2 py-1 text-xs font-medium text-text-main focus:outline-none cursor-pointer"
              >
                <option value="all">All 9 Active Target States</option>
                {ALL_TARGET_STATES.map(st => (
                  <option key={st.code} value={st.name}>{st.name}</option>
                ))}
              </select>
            </div>

            {isLoading ? (
              <div className="space-y-3 animate-pulse">
                <div className="h-16 bg-subtle"></div>
                <div className="h-16 bg-subtle"></div>
              </div>
            ) : proposals.length > 0 ? (
              <div className="divide-y divide-border border-y border-border">
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
                      className={`w-full text-left py-3.5 px-3 transition-colors cursor-pointer ${
                        isSelected
                          ? 'bg-primary/5 border-l-2 border-l-primary'
                          : 'hover:bg-subtle/40'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold text-text-main line-clamp-1">{t(`interventions.${prop.id}.title`, prop.title)}</span>
                        <span className={`text-xs shrink-0 ${getStatusBadgeClass(prop.status)}`}>
                          ● {t(`status.${prop.status}`, prop.status.replace('_', ' ').toUpperCase())}
                        </span>
                      </div>

                      <div className="text-[11px] text-text-muted mt-1 flex items-center justify-between">
                        <span>{prop.blockName} ({prop.districtName})</span>
                        <span className="font-semibold text-text-main">₹{(prop.estimatedCostInr / 100000).toFixed(1)} {t('interventions.lakhs', 'Lakhs')}</span>
                      </div>

                      <div className="text-xs text-text-muted mt-1 line-clamp-2 italic">
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

          {/* Government Scheme Reference List (Unboxed Editorial) */}
          <div className="pt-6 border-t border-border space-y-3">
            <h2 className="text-xs font-bold text-text-main flex items-center gap-1.5 uppercase tracking-wider">
              <ShieldCheckIcon className="w-4 h-4 text-primary" /> {t('interventions.supportedSchemes', 'Supported Government Schemes')}
            </h2>
            <p className="text-[11px] text-amber-900 bg-amber-50 p-2.5 border border-amber-200 leading-relaxed">
              {t('interventions.schemesNotice', SCHEME_UNVERIFIED_NOTICE)}
            </p>

            <div className="divide-y divide-border border-y border-border text-xs">
              {INTERVENTION_SCHEMES.map((sch) => (
                <div key={sch.id} className="py-3 space-y-1">
                  <div className="flex justify-between font-bold text-text-main">
                    <span>{sch.name}</span>
                    <span className="text-[10px] text-primary">{t('interventions.demonstrationCap', 'Demonstration Cap')}: ₹{(sch.maxSanctionUnitAmountInr / 100000).toFixed(1)}{t('interventions.unverifiedCap', 'L (unverified)')}</span>
                  </div>
                  <p className="text-[11px] text-text-muted leading-relaxed">{t(`scheme.${sch.id}.focus`, sch.primaryFocus)}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: Proposal Inspection & Governance Review Panel (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          <div className="space-y-5">
            {isLoading ? (
              <div className="space-y-4 animate-pulse">
                <div className="h-6 bg-subtle w-1/3"></div>
                <div className="h-8 bg-subtle w-2/3"></div>
                <div className="h-4 bg-subtle w-1/2"></div>
              </div>
            ) : selectedProposal ? (
              <>
                {/* Header & Status Switcher */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-border">
                  <div>
                    <span className={`text-xs font-semibold ${getStatusBadgeClass(selectedProposal.status)}`}>
                      ● {t('interventions.statusLabel', 'STATUS')}: {t(`status.${selectedProposal.status}`, selectedProposal.status.replace('_', ' ').toUpperCase())}
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
                        className="px-2.5 py-1 bg-subtle hover:bg-subtle/80 text-text-main text-xs font-semibold border border-border cursor-pointer"
                      >
                        {t('interventions.underReview', 'Under Review')}
                      </button>
                      <button
                        onClick={() => handleUpdateStatus('field_verification_requested')}
                        className="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-900 text-xs font-semibold border border-amber-300 cursor-pointer"
                      >
                        {t('interventions.requestSurvey', 'Request Field Survey')}
                      </button>
                      <button
                        onClick={() => handleUpdateStatus('approved')}
                        className="px-2.5 py-1 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold cursor-pointer"
                      >
                        {t('interventions.approveProposal', 'Approve Proposal')}
                      </button>
                    </div>
                  )}
                </div>

                {/* Proposal Details (Aligned Metadata Rows, Unboxed) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <div className="py-2 border-b border-border space-y-0.5">
                    <span className="text-text-muted">{t('interventions.targetLocation', 'Target Location & Panchayat')}:</span>
                    <div className="font-bold text-text-main">{selectedProposal.targetVillage}</div>
                    <div className="text-[11px] text-text-muted">{selectedProposal.blockName} Block, {selectedProposal.districtName}</div>
                  </div>

                  <div className="py-2 border-b border-border space-y-0.5">
                    <span className="text-text-muted">{t('interventions.mappedScheme', 'Mapped Government Scheme')}:</span>
                    <div className="font-bold text-primary">{selectedProposal.schemeName}</div>
                    <div className="text-[11px] text-text-muted">{t('interventions.estCost', 'Est. Cost')}: ₹{selectedProposal.estimatedCostInr.toLocaleString()}</div>
                  </div>

                  <div className="py-2 border-b border-border space-y-0.5">
                    <span className="text-text-muted">{t('interventions.reviewAssignment', 'Review Assignment')}:</span>
                    <div className="font-bold text-text-main">{selectedProposal.reviewOwnerName}</div>
                    <div className="text-[11px] text-text-muted">{t('interventions.roleLabel', 'Role')}: {t(`role.${selectedProposal.reviewOwnerRole}`, selectedProposal.reviewOwnerRole.toUpperCase())}</div>
                  </div>

                  <div className="py-2 border-b border-border space-y-0.5">
                    <span className="text-text-muted">{t('interventions.targetBeneficiaries', 'Target Beneficiaries')}:</span>
                    <div className="font-bold text-text-main">{selectedProposal.beneficiariesCount.toLocaleString()} {t('interventions.ruralResidents', 'Rural Residents')}</div>
                  </div>
                </div>

                {/* Evidence Rationale */}
                <div className="space-y-1 text-xs">
                  <span className="font-bold text-text-main">{t('interventions.environmentalRationale', 'Environmental Evidence Rationale')}:</span>
                  <p className="text-text-muted leading-relaxed">
                    {t(`interventions.${selectedProposal.id}.rationale`, selectedProposal.evidenceRationale)}
                  </p>
                </div>

                {/* Missing Evidence Notes */}
                {selectedProposal.missingEvidenceNotes && (
                  <div className="space-y-1 text-xs">
                    <span className="font-bold text-amber-900 flex items-center gap-1">
                      <InfoIcon className="w-3.5 h-3.5 text-amber-700" /> {t('interventions.missingEvidenceGap', 'Missing Evidence & Survey Gaps')}:
                    </span>
                    <p className="text-amber-900 bg-amber-50 p-2.5 border border-amber-200 leading-relaxed">
                      {t(`interventions.${selectedProposal.id}.missingNotes`, selectedProposal.missingEvidenceNotes)}
                    </p>
                  </div>
                )}

                {/* Comments & Governance Audit Trail */}
                <div className="space-y-3 pt-4 border-t border-border">
                  <h3 className="text-xs font-bold text-text-main">{t('interventions.reviewTrail', 'Review Trail & Comments')} ({selectedProposal.comments.length})</h3>

                  <div className="divide-y divide-border border-y border-border max-h-48 overflow-y-auto">
                    {selectedProposal.comments.map((c, idx) => (
                      <div key={idx} className="py-2.5 text-xs space-y-1">
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
                        className="flex-1 bg-subtle border border-border px-3 py-1.5 text-xs text-text-main focus:outline-none"
                      />
                      <button
                        type="submit"
                        className="bg-primary hover:bg-primary-hover text-text-inverted text-xs font-semibold px-4 py-1.5 transition-colors cursor-pointer"
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
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-surface border border-border rounded max-w-lg w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
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
                  className="px-4 py-2 bg-primary text-white font-semibold rounded hover:bg-primary-hover"
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
