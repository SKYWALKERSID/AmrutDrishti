'use client';

import React, { useState, useEffect, Suspense, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { RiskSeverity, BlockData } from '@/lib/types';
import { useRole } from '@/lib/context/RoleContext';
import { canMutateDemoWorkflows, demoRestrictionNotice } from '@/lib/demo/demoPolicy';
import { calculateDescriptiveGss } from '@/lib/services/scientificEngine';
import { ShieldCheckIcon, ActivityChartIcon, FilterIcon, InfoIcon, CheckCircleIcon } from '@/components/ui/Icons';
import { useLanguage } from '@/lib/context/LanguageContext';
import { ALL_NATIONWIDE_BLOCKS, ALL_NATIONWIDE_DISTRICTS, mergeWithLiveBlocks, normalizeStateName } from '@/lib/data/allNationwideBlocks';
import { ALL_INDIAN_STATES } from '@/lib/data/indiaStates';

function RiskAssessmentContent() {
  const { t } = useLanguage();
  const searchParams = useSearchParams();
  const urlBlockParam = searchParams.get('block');
  const { activeRole } = useRole();
  const [selectedState, setSelectedState] = useState<string>('all');
  const [selectedDistrictId, setSelectedDistrictId] = useState<string>('all');
  const [blocksData, setBlocksData] = useState<BlockData[]>(ALL_NATIONWIDE_BLOCKS);
  const [selectedBlockId, setSelectedBlockId] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [overrideReason, setOverrideReason] = useState<string>('');
  const [overrideSeverity, setOverrideSeverity] = useState<RiskSeverity>('severe');
  const [overrideApplied, setOverrideApplied] = useState<boolean>(false);
  const [isLive, setIsLive] = useState<boolean>(false);

  useEffect(() => {
    let active = true;
    fetch('/api/geospatial/blocks')
      .then(res => res.json())
      .then(data => {
        if (!active) return;
        if (data.blocks && data.blocks.length > 0) {
          const merged = mergeWithLiveBlocks(data.blocks);
          setBlocksData(merged);
          setIsLive(data.source === 'live_database');
          if (urlBlockParam && merged.some((b: any) => b.id === urlBlockParam)) {
            setSelectedBlockId(urlBlockParam);
            const target = merged.find((b: any) => b.id === urlBlockParam);
            if (target) {
              setSelectedState(target.state);
              setSelectedDistrictId(target.districtId);
            }
          } else {
            setSelectedBlockId(merged[0].id);
          }
        }
      })
      .catch(() => {})
      .finally(() => {
        if (active) setIsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [urlBlockParam]);

  // Derived filtered districts
  const availableDistricts = useMemo(() => {
    if (selectedState === 'all') return ALL_NATIONWIDE_DISTRICTS;
    return ALL_NATIONWIDE_DISTRICTS.filter(d => normalizeStateName(d.state) === selectedState);
  }, [selectedState]);

  // Derived filtered blocks
  const filteredBlocks = useMemo(() => {
    return blocksData.filter(b => {
      const matchState = selectedState === 'all' || normalizeStateName(b.state) === selectedState;
      const matchDistrict = selectedDistrictId === 'all' || b.districtId === selectedDistrictId;
      return matchState && matchDistrict;
    });
  }, [blocksData, selectedState, selectedDistrictId]);

  const handleStateChange = (stateName: string) => {
    setSelectedState(stateName);
    setSelectedDistrictId('all');
    const matched = blocksData.filter(b => stateName === 'all' || normalizeStateName(b.state) === stateName);
    if (matched.length > 0) {
      setSelectedBlockId(matched[0].id);
      setOverrideApplied(false);
    }
  };

  const handleDistrictChange = (distId: string) => {
    setSelectedDistrictId(distId);
    const matched = blocksData.filter(b => {
      const matchState = selectedState === 'all' || normalizeStateName(b.state) === selectedState;
      const matchDistrict = distId === 'all' || b.districtId === distId;
      return matchState && matchDistrict;
    });
    if (matched.length > 0) {
      setSelectedBlockId(matched[0].id);
      setOverrideApplied(false);
    }
  };

  const isReadOnly = !canMutateDemoWorkflows(activeRole);
  const restrictionNotice = demoRestrictionNotice(activeRole);
  const selectedBlock = blocksData.find(b => b.id === selectedBlockId) || null;

  const calculatedResult = selectedBlock ? calculateDescriptiveGss(selectedBlock.indicators) : {
    score: null,
    severity: 'gap' as const,
    confidenceInterval: null,
    primaryStressDriver: 'Data inputs missing',
    safeguardNotice: 'Risk score unavailable — Required verified inputs are missing.',
    normalizationBreakdown: { wellDepthNorm: null, rainDeficitNorm: null, graceTwsaNorm: null, ndviNorm: null }
  };

  const effectiveSeverity = overrideApplied ? overrideSeverity : (calculatedResult.severity !== 'gap' ? calculatedResult.severity : (selectedBlock?.riskSeverity ?? 'gap'));

  const handleApplyOverride = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canMutateDemoWorkflows(activeRole) || !selectedBlock) return;
    if (!overrideReason.trim()) return;
    setOverrideApplied(true);

    try {
      await fetch('/api/audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          actorRole: activeRole,
          action: 'record_risk_override',
          resourceTarget: `block:${selectedBlock.id}`,
          outcome: 'success',
          details: {
            blockName: selectedBlock.name,
            districtName: selectedBlock.districtName,
            originalScore: calculatedResult.score ?? selectedBlock.assessment?.descriptiveStressScore,
            overrideSeverity,
            overrideReason,
          },
        }),
      });
    } catch {
      // Non-blocking for client UX
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-surface border border-border rounded p-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-text-muted">
              <span className="font-semibold text-text-main">
                Groundwater Stress Assessment
              </span>
              <span>•</span>
              <span>Multi-Signal Indicator Index</span>
            </div>
            <h1 className="text-xl font-bold text-text-main mt-1.5">
              {t('risk.title')}
            </h1>
            <p className="text-xs text-text-muted mt-1 max-w-3xl leading-relaxed">
              {t('risk.subtitle')}
            </p>
          </div>
        </div>
      </div>

      {/* Operational Safety Safeguard Banner */}
      <div className="bg-subtle/80 border border-border rounded-lg p-5 text-xs text-text-muted space-y-2">
        <div className="flex items-center gap-2 font-bold text-text-main">
          <ShieldCheckIcon className="w-4 h-4 text-[#0d5c63]" />
          <span>Operational Safety Safeguard Gate (FR-033 & TRD Section 7.2)</span>
        </div>
        <p className="leading-relaxed">
          The score shown below is a combined index calculated from 4 environmental readings (wells, rain, satellite storage, and vegetation). It is designed to flag areas needing attention, not to serve as an automated order for government spending or crisis decrees without on-site field verification.
        </p>
      </div>

      {/* Main Grid: Block Selector & Formula Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Block Selection & Stress Score Card (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-surface border border-border rounded p-5 shadow-xs space-y-4">
            {isLoading ? (
              <div className="space-y-4 animate-pulse">
                <div className="flex items-center justify-between">
                  <div className="h-4 bg-subtle rounded w-28"></div>
                  <div className="h-8 bg-subtle rounded w-36"></div>
                </div>
                <div className="p-5 bg-subtle/40 rounded space-y-3">
                  <div className="h-3 bg-subtle rounded w-1/3 mx-auto"></div>
                  <div className="h-10 bg-subtle rounded w-24 mx-auto"></div>
                  <div className="h-4 bg-subtle rounded w-2/3 mx-auto"></div>
                </div>
                <div className="h-16 bg-subtle rounded"></div>
              </div>
            ) : selectedBlock ? (
              <>
                <div className="space-y-2 pb-3 border-b border-border">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-text-muted">Target Filter:</span>
                    <span className="text-[11px] text-text-muted">{selectedBlock.name} ({selectedBlock.state})</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                    {/* State */}
                    <select
                      value={selectedState}
                      onChange={(e) => handleStateChange(e.target.value)}
                      className="bg-subtle border border-border rounded px-2 py-1 text-xs font-medium text-text-main focus:outline-none cursor-pointer"
                    >
                      <option value="all">All States</option>
                      <optgroup label="Active Monitored States">
                        {ALL_INDIAN_STATES.filter(s => s.hasData).map((st) => (
                          <option key={st.code} value={st.name}>
                            {st.name}
                          </option>
                        ))}
                      </optgroup>
                      <optgroup label="Telemetry Pending">
                        {ALL_INDIAN_STATES.filter(s => !s.hasData).map((st) => (
                          <option key={st.code} value={st.name} disabled className="text-gray-400 italic">
                            {st.name} (Pending)
                          </option>
                        ))}
                      </optgroup>
                    </select>

                    {/* District */}
                    <select
                      value={selectedDistrictId}
                      onChange={(e) => handleDistrictChange(e.target.value)}
                      className="bg-subtle border border-border rounded px-2 py-1 text-xs font-medium text-text-main focus:outline-none cursor-pointer"
                    >
                      <option value="all">
                        {selectedState === 'all'
                          ? `All Districts`
                          : `All in ${selectedState}`}
                      </option>
                      {availableDistricts.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.name}
                        </option>
                      ))}
                    </select>

                    {/* Block */}
                    <select
                      value={selectedBlockId}
                      onChange={(e) => {
                        setSelectedBlockId(e.target.value);
                        setOverrideApplied(false);
                      }}
                      className="bg-subtle border border-border rounded px-2 py-1 text-xs font-medium text-text-main focus:outline-none cursor-pointer"
                    >
                      {filteredBlocks.map((b: any) => (
                        <option key={b.id} value={b.id}>
                          {b.name} ({b.districtName})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Score Display Card */}
                <div className="p-5 bg-subtle/30 rounded border border-border text-center space-y-2">
                  <div className="text-xs text-text-muted uppercase font-semibold">
                    Calculated Stress Score (0 to 100)
                  </div>
                  <div className="text-4xl font-extrabold text-[#0d5c63]">
                    {calculatedResult.score !== null ? calculatedResult.score : 'N/A'}{' '}
                    <span className="text-sm font-normal text-text-muted">/ 100</span>
                  </div>
                  <div className="text-xs text-text-muted">
                    Confidence Range: {calculatedResult.confidenceInterval
                      ? `[${calculatedResult.confidenceInterval[0]} - ${calculatedResult.confidenceInterval[1]}]`
                      : 'Pending field calibration (Mathematical indicator index)'}
                  </div>
                  <div className="pt-2">
                    <span className={`text-sm font-bold ${
                      effectiveSeverity === 'severe' ? 'text-red-700' : effectiveSeverity === 'normal' ? 'text-emerald-700' : 'text-amber-700'
                    }`}>
                      {effectiveSeverity.toUpperCase()} PRIORITY
                    </span>
                  </div>
                  <p className="text-[11px] text-text-muted pt-1">
                    Main Contributing Factor: <span className="font-semibold text-text-main">{calculatedResult.primaryStressDriver}</span>
                  </p>
                </div>

                {/* Assessment Note */}
                <div className="space-y-1 text-xs">
                  <span className="font-semibold text-text-main">Status Note:</span>
                  <p className="text-text-muted bg-surface p-2.5 rounded border border-border leading-relaxed">
                    {calculatedResult.safeguardNotice}
                  </p>
                </div>
              </>
            ) : (
              <div className="py-8 text-center text-xs text-text-muted space-y-1">
                <p className="font-semibold text-text-main">No Block Available</p>
                <p>No verified administrative units returned for risk assessment.</p>
              </div>
            )}
          </div>

          {/* Human Override Controls */}
          {restrictionNotice && (
            <div role="note" className="bg-amber-50 border border-amber-200 rounded p-4 text-xs text-amber-900">{restrictionNotice}</div>
          )}
          {!isReadOnly && (
            <div className="bg-surface border border-border rounded p-5 shadow-xs space-y-4">
              <h2 className="text-sm font-bold text-text-main flex items-center gap-2">
                <ShieldCheckIcon className="w-4 h-4 text-[#0d5c63]" /> {t('risk.humanOverrideTitle', 'Human Review & Risk Override')}
              </h2>
              <p className="text-xs text-text-muted">
                {t('risk.overrideSubtitle', 'Demo-only control. Nothing is persisted or audited. Authorized reviewers would adjust classification after physical ground inspection.')}
              </p>

              {overrideApplied ? (
                <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded text-xs space-y-1">
                  <div className="font-bold flex items-center gap-1.5">
                    <CheckCircleIcon className="w-4 h-4 text-emerald-700" /> {t('risk.overrideSuccessTitle', 'Review Note Held In Memory')}
                  </div>
                  <p>{t('risk.overrideSuccessMsg', 'Status shown for this page session only. Held in browser memory; not saved and not an audit trail.')}</p>
                </div>
              ) : (
                <form onSubmit={handleApplyOverride} className="space-y-3">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-text-main">{t('risk.overrideSeverityLabel', 'Override Severity Level')}:</label>
                    <select
                      value={overrideSeverity}
                      onChange={(e) => setOverrideSeverity(e.target.value as RiskSeverity)}
                      className="w-full bg-subtle border border-border rounded px-3 py-1.5 text-xs text-text-main focus:outline-none"
                    >
                      <option value="severe">{t('overview.severeCount', 'Severe Stress')}</option>
                      <option value="watch">{t('overview.watchCount', 'Watch Advisory')}</option>
                      <option value="normal">{t('overview.normalCount', 'Normal Baseline')}</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-text-main">{t('risk.reviewRationaleLabel', 'Review Rationale & Inspection Notes')}:</label>
                    <textarea
                      value={overrideReason}
                      onChange={(e) => setOverrideReason(e.target.value)}
                      placeholder={t('risk.reviewPlaceholder', 'Enter ground inspection evidence or hydrogeologist report reference...')}
                      rows={3}
                      className="w-full bg-subtle border border-border rounded p-2 text-xs text-text-main focus:outline-none"
                      required
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full bg-[#0d5c63] hover:bg-[#094348] text-white text-xs font-semibold py-2 rounded transition-colors"
                  >
                    {t('risk.recordNoteBtn', 'Record Review Note (this session only)')}
                  </button>
                </form>
              )}
            </div>
          )}
        </div>

        {/* Right Column: Model Governance & Indicator Weights (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          {/* Formula Breakdown */}
          <div className="bg-surface border border-border rounded p-6 shadow-xs space-y-4">
            <h2 className="text-base font-bold text-text-main">
              Calculated Multi-Criteria Breakdown
            </h2>

            {isLoading ? (
              <div className="space-y-3 animate-pulse">
                <div className="h-12 bg-subtle rounded"></div>
                <div className="h-14 bg-subtle rounded"></div>
                <div className="h-14 bg-subtle rounded"></div>
                <div className="h-14 bg-subtle rounded"></div>
                <div className="h-14 bg-subtle rounded"></div>
              </div>
            ) : selectedBlock ? (
              <div className="space-y-3 text-xs">
                <div className="p-3 bg-blue-50/60 rounded border border-blue-200 text-[11px] text-blue-950 leading-relaxed">
                  This score is calculated live by combining 4 environmental signals into a weighted 0–100 index. It provides a descriptive estimate of water pressure based on current readings. It is an index, not a ground-measured well depth.
                </div>

                <div className="divide-y divide-border border border-border rounded overflow-hidden">
                  {/* 1. CGWB Well Depth */}
                  <div className="flex justify-between items-center p-3 bg-surface hover:bg-subtle/30 transition-colors">
                    <div>
                      <span className="font-semibold text-text-main">CGWB Well Water Depth</span>
                      <p className="text-[11px] text-text-muted mt-0.5">
                        Current: {selectedBlock.indicators.cgwbWellDepthMbgl !== null ? `${selectedBlock.indicators.cgwbWellDepthMbgl} m below ground` : 'Missing data'} • Stress level: {calculatedResult.normalizationBreakdown.wellDepthNorm !== null ? `${Math.round(calculatedResult.normalizationBreakdown.wellDepthNorm * 100)}%` : 'N/A'}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="font-bold text-[#0d5c63]">35%</span>
                      <span className="block text-[10px] text-text-muted">Base Weight</span>
                    </div>
                  </div>

                  {/* 2. Rainfall Deficit */}
                  <div className="flex justify-between items-center p-3 bg-surface hover:bg-subtle/30 transition-colors">
                    <div>
                      <span className="font-semibold text-text-main">Monsoon Rainfall Deficit</span>
                      <p className="text-[11px] text-text-muted mt-0.5">
                        Current: {selectedBlock.indicators.rainfallAnomalyMm !== null ? `${selectedBlock.indicators.rainfallAnomalyMm} mm vs normal` : 'Missing data'} • Stress level: {calculatedResult.normalizationBreakdown.rainDeficitNorm !== null ? `${Math.round(calculatedResult.normalizationBreakdown.rainDeficitNorm * 100)}%` : 'N/A'}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="font-bold text-[#0d5c63]">30%</span>
                      <span className="block text-[10px] text-text-muted">Base Weight</span>
                    </div>
                  </div>

                  {/* 3. GRACE TWSA */}
                  <div className="flex justify-between items-center p-3 bg-surface hover:bg-subtle/30 transition-colors">
                    <div>
                      <span className="font-semibold text-text-main">Satellite Water Storage (GRACE-FO)</span>
                      <p className="text-[11px] text-text-muted mt-0.5">
                        Current: {selectedBlock.indicators.graceTwsaCm !== null ? `${selectedBlock.indicators.graceTwsaCm} cm regional anomaly` : 'Missing data'} • Stress level: {calculatedResult.normalizationBreakdown.graceTwsaNorm !== null ? `${Math.round(calculatedResult.normalizationBreakdown.graceTwsaNorm * 100)}%` : 'N/A'}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="font-bold text-[#0d5c63]">20%</span>
                      <span className="block text-[10px] text-text-muted">Base Weight</span>
                    </div>
                  </div>

                  {/* 4. Sentinel NDVI */}
                  <div className="flex justify-between items-center p-3 bg-surface hover:bg-subtle/30 transition-colors">
                    <div>
                      <span className="font-semibold text-text-main">Plant Health / Crop Greenness (NDVI)</span>
                      <p className="text-[11px] text-text-muted mt-0.5">
                        Current: {selectedBlock.indicators.sentinelNdvi !== null ? selectedBlock.indicators.sentinelNdvi : 'Missing data'} • Stress level: {calculatedResult.normalizationBreakdown.ndviNorm !== null ? `${Math.round(calculatedResult.normalizationBreakdown.ndviNorm * 100)}%` : 'N/A'}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="font-bold text-[#0d5c63]">15%</span>
                      <span className="block text-[10px] text-text-muted">Base Weight</span>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="py-8 text-center text-xs text-text-muted">
                Indicator details unavailable.
              </div>
            )}
          </div>

          {/* Validation & Operational Status */}
          <div className="bg-surface border border-border rounded p-6 shadow-xs space-y-4">
            <h2 className="text-base font-bold text-text-main">System Status & Safety Rules</h2>
            <p className="text-xs text-text-muted">
              How this score is calculated and how it should be used in day-to-day operations:
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              {[
                ['Score Calculation', 'Calculated live using the 4 weighted environmental indicators above.'],
                ['Ground Well Calibration', 'Ongoing. Scores provide early warnings but must be confirmed with local well tests.'],
                ['Decision Safety Rule', 'This score helps prioritize areas for review. It does not automatically approve funds or launch emergency orders.'],
                ['Missing Data Protection', 'If key sensors are offline, the system marks a data gap instead of assuming water is safe.'],
              ].map(([title, note]) => (
                <div key={title} className="flex items-start gap-2 p-3 bg-surface border border-border rounded text-text-main">
                  <InfoIcon className="w-4 h-4 text-[#0d5c63] shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold">{title}</span>
                    <p className="text-[11px] text-text-muted mt-0.5 leading-relaxed">{note}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function RiskAssessmentPage() {
  return (
    <Suspense fallback={<div className="p-6 text-xs text-text-muted">Loading Risk Governance Assessment...</div>}>
      <RiskAssessmentContent />
    </Suspense>
  );
}
