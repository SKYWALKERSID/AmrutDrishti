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
import type { BlockForecastResponse, ForecastPoint } from '@/app/api/forecast/route';

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
  const [forecastData, setForecastData] = useState<BlockForecastResponse | null>(null);
  const [isForecastLoading, setIsForecastLoading] = useState<boolean>(true);
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

  // Load Machine Learning Forecast for selected block from verified forecast API
  useEffect(() => {
    if (!selectedBlockId) {
      setForecastData(null);
      setIsForecastLoading(false);
      return;
    }
    let active = true;
    setIsForecastLoading(true);
    fetch(`/api/forecast?block=${encodeURIComponent(selectedBlockId)}`)
      .then(res => res.json())
      .then(data => {
        if (active) {
          setForecastData(data);
        }
      })
      .catch(() => {
        if (active) {
          setForecastData(null);
        }
      })
      .finally(() => {
        if (active) {
          setIsForecastLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, [selectedBlockId]);

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
        headers: {
          'Content-Type': 'application/json',
          'x-jaldrishti-role': activeRole,
          'x-jaldrishti-district': selectedBlock.districtName,
        },
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
    <div className="space-y-8">
      {/* Header - Editorial Layout */}
      <div className="border-b border-border pb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-text-muted">
            <span className="font-semibold text-text-main">
              Groundwater Assessment &amp; Model Governance*
            </span>
            <span aria-hidden="true">•</span>
            <span>Descriptive Heuristic Baseline (0–100) &amp; ML Depth Forecasting (m bgl)</span>
            <span aria-hidden="true">•</span>
            <span>Latest Observation: {selectedBlock?.indicators.lastUpdatedDate || '2026-10-12'}</span>
          </div>
          <h1 className="dbim-heading-1 text-text-main flex items-center gap-2 flex-wrap">
            {t('risk.title')}*
          </h1>
          <p className="text-xs sm:text-sm text-text-muted mt-1.5 max-w-3xl leading-relaxed">
            {t('risk.subtitle')}
          </p>
        </div>
      </div>

      {/* Operational Safety Safeguard Banner */}
      <div className="border-l-2 border-primary bg-subtle p-4 text-xs text-text-muted space-y-1.5">
        <div className="flex items-center gap-2 font-bold text-text-main">
          <ShieldCheckIcon className="w-4 h-4 text-primary" />
          <span>Operational Safety Safeguard Gate (FR-033 &amp; TRD Section 7.2)</span>
        </div>
        <p className="leading-relaxed">
          The Groundwater Stress Score (GSS) is a descriptive, multi-criteria index calculated from 4 environmental readings (wells, rain, satellite storage, and vegetation). It is a rule-based indicator index, not a trained ML result. It serves to identify areas requiring investigation, not as an automated authorization for financial sanctions or emergency decrees without local physical verification.
        </p>
      </div>

      {/* Main Content Layout: Block Selector & Analysis */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Target Selector & Descriptive Stress Score Baseline (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          <div className="space-y-5">
            {isLoading ? (
              <div className="space-y-4 animate-pulse">
                <div className="h-8 bg-subtle w-full"></div>
                <div className="h-32 bg-subtle w-full"></div>
              </div>
            ) : selectedBlock ? (
              <>
                <div className="space-y-2 pb-3 border-b border-border">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-text-muted">Target Filter:</span>
                    <span className="text-xs font-bold text-text-main">{selectedBlock.name} ({selectedBlock.state})</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                    {/* State */}
                    <select
                      value={selectedState}
                      onChange={(e) => handleStateChange(e.target.value)}
                      className="bg-subtle border border-border px-2 py-1.5 text-xs font-medium text-text-main focus:outline-none cursor-pointer"
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
                      className="bg-subtle border border-border px-2 py-1.5 text-xs font-medium text-text-main focus:outline-none cursor-pointer"
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
                      className="bg-subtle border border-border px-2 py-1.5 text-xs font-medium text-text-main focus:outline-none cursor-pointer"
                    >
                      {filteredBlocks.map((b: any) => (
                        <option key={b.id} value={b.id}>
                          {b.name} ({b.districtName})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Descriptive Stress Score Display */}
                <div className="py-4 border-y border-border text-center space-y-2">
                  <div className="text-xs text-text-muted uppercase font-semibold">
                    Descriptive Stress Score (GSS Baseline: 0 to 100)*
                  </div>
                  <div className="text-4xl font-extrabold text-primary">
                    {calculatedResult.score !== null ? calculatedResult.score : 'Data Gap'}{' '}
                    {calculatedResult.score !== null && <span className="text-sm font-normal text-text-muted">/ 100</span>}
                  </div>
                  <div className="text-xs text-text-muted">
                    Confidence Interval: Uncalibrated descriptive index (Statistical confidence intervals require physical observation well calibration)
                  </div>
                  <div className="pt-1">
                    <span className={`text-sm font-bold ${
                      effectiveSeverity === 'severe' ? 'text-status-errorText' : effectiveSeverity === 'normal' ? 'text-status-successText' : effectiveSeverity === 'gap' ? 'text-text-muted' : 'text-status-warningText'
                    }`}>
                      {effectiveSeverity.toUpperCase()} PRIORITY
                    </span>
                  </div>
                  <p className="text-xs text-text-muted pt-1">
                    Main Contributing Factor: <span className="font-semibold text-text-main">{calculatedResult.primaryStressDriver}</span>
                  </p>
                  <p className="text-[11px] text-text-muted/80 italic pt-1">
                    Note: GSS is an empirical multi-signal heuristic baseline. It is not an ML model output.
                  </p>
                </div>

                {/* Assessment Note */}
                <div className="space-y-1 text-xs">
                  <span className="font-semibold text-text-main">Status Note:</span>
                  <p className="text-text-muted leading-relaxed">
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
            <div role="note" className="bg-status-warningBg border border-status-warning p-3 text-xs text-status-warningText">{restrictionNotice}</div>
          )}
          {!isReadOnly && (
            <div className="pt-4 border-t border-border space-y-3">
              <h2 className="text-sm font-bold text-text-main flex items-center gap-2">
                <ShieldCheckIcon className="w-4 h-4 text-primary" /> {t('risk.humanOverrideTitle', 'Human Review & Risk Override')}
              </h2>
              <p className="text-xs text-text-muted">
                {t('risk.overrideSubtitle', 'Demo-only control. Nothing is persisted or audited. Authorized reviewers would adjust classification after physical ground inspection.')}
              </p>

              {overrideApplied ? (
                <div className="p-3 bg-status-successBg border border-status-success text-status-successText text-xs space-y-1">
                  <div className="font-bold flex items-center gap-1.5">
                    <CheckCircleIcon className="w-4 h-4 text-status-successText" /> {t('risk.overrideSuccessTitle', 'Review Note Held In Memory')}
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
                      className="w-full bg-subtle border border-border px-3 py-1.5 text-xs text-text-main focus:outline-none"
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
                      className="w-full bg-subtle border border-border p-2 text-xs text-text-main focus:outline-none"
                      required
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full bg-primary hover:bg-primary-hover text-text-inverted text-xs font-semibold py-2 transition-colors cursor-pointer"
                  >
                    {t('risk.recordNoteBtn', 'Record Review Note (this session only)')}
                  </button>
                </form>
              )}
            </div>
          )}
        </div>

        {/* Right Column: Multi-Criteria Breakdown & Machine Learning Physical Depth Forecast (7 cols) */}
        <div className="lg:col-span-7 space-y-8">
          {/* Section 1: Descriptive Multi-Criteria Breakdown */}
          <div className="space-y-4">
            <div className="border-b border-border pb-3">
              <h2 className="text-base font-bold text-text-main">
                Descriptive Multi-Criteria Breakdown (Heuristic Baseline)
              </h2>
              <p className="text-xs text-text-muted mt-1 leading-relaxed">
                This score combines 4 empirical environmental signals into a weighted 0–100 index. It provides a descriptive estimate of hydrological stress based on current observations. It is a mathematical heuristic index, not a machine learning prediction.*
              </p>
            </div>

            {isLoading ? (
              <div className="space-y-3 animate-pulse">
                <div className="h-12 bg-subtle"></div>
                <div className="h-14 bg-subtle"></div>
                <div className="h-14 bg-subtle"></div>
              </div>
            ) : selectedBlock ? (
              <div className="overflow-x-auto border-t border-b border-border">
                <table className="w-full text-left text-xs border-collapse dbim-table">
                  <thead>
                    <tr className="border-b border-border bg-subtle text-text-muted font-bold text-[11px] uppercase tracking-wider">
                      <th className="py-2.5 px-3 text-left">Environmental Indicator</th>
                      <th className="py-2.5 px-3 text-right">Current Observation</th>
                      <th className="py-2.5 px-3 text-right">Stress Level</th>
                      <th className="py-2.5 px-3 text-right">Base Weight</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {/* 1. CGWB Well Depth */}
                    <tr className="hover:bg-subtle/40 transition-colors">
                      <td className="py-3 px-3">
                        <span className="font-bold text-text-main block">CGWB Well Water Depth</span>
                        <span className="text-[11px] text-text-muted">Digital Water Level Recorder (DWLR)</span>
                      </td>
                      <td className="py-3 px-3 text-right tabular-nums">
                        {selectedBlock.indicators.cgwbWellDepthMbgl !== null ? `${selectedBlock.indicators.cgwbWellDepthMbgl} m bgl` : 'Missing data'}
                      </td>
                      <td className="py-3 px-3 text-right tabular-nums">
                        {calculatedResult.normalizationBreakdown.wellDepthNorm !== null ? `${Math.round(calculatedResult.normalizationBreakdown.wellDepthNorm * 100)}%` : 'N/A'}
                      </td>
                      <td className="py-3 px-3 text-right font-bold text-primary tabular-nums">
                        35%
                      </td>
                    </tr>

                    {/* 2. Rainfall Deficit */}
                    <tr className="hover:bg-subtle/40 transition-colors">
                      <td className="py-3 px-3">
                        <span className="font-bold text-text-main block">Monsoon Rainfall Deficit</span>
                        <span className="text-[11px] text-text-muted">IMD 30-Year LPA Deviation</span>
                      </td>
                      <td className="py-3 px-3 text-right tabular-nums">
                        {selectedBlock.indicators.rainfallAnomalyMm !== null ? `${selectedBlock.indicators.rainfallAnomalyMm} mm` : 'Missing data'}
                      </td>
                      <td className="py-3 px-3 text-right tabular-nums">
                        {calculatedResult.normalizationBreakdown.rainDeficitNorm !== null ? `${Math.round(calculatedResult.normalizationBreakdown.rainDeficitNorm * 100)}%` : 'N/A'}
                      </td>
                      <td className="py-3 px-3 text-right font-bold text-primary tabular-nums">
                        30%
                      </td>
                    </tr>

                    {/* 3. GRACE TWSA */}
                    <tr className="hover:bg-subtle/40 transition-colors">
                      <td className="py-3 px-3">
                        <span className="font-bold text-text-main block">Satellite Water Storage (GRACE-FO)</span>
                        <span className="text-[11px] text-text-muted">Regional Terrestrial Storage Anomaly</span>
                      </td>
                      <td className="py-3 px-3 text-right tabular-nums">
                        {selectedBlock.indicators.graceTwsaCm !== null ? `${selectedBlock.indicators.graceTwsaCm} cm` : 'Missing data'}
                      </td>
                      <td className="py-3 px-3 text-right tabular-nums">
                        {calculatedResult.normalizationBreakdown.graceTwsaNorm !== null ? `${Math.round(calculatedResult.normalizationBreakdown.graceTwsaNorm * 100)}%` : 'N/A'}
                      </td>
                      <td className="py-3 px-3 text-right font-bold text-primary tabular-nums">
                        20%
                      </td>
                    </tr>

                    {/* 4. Sentinel NDVI */}
                    <tr className="hover:bg-subtle/40 transition-colors">
                      <td className="py-3 px-3">
                        <span className="font-bold text-text-main block">Vegetation Health (NDVI)</span>
                        <span className="text-[11px] text-text-muted">Sentinel-2 Canopy Reflectance</span>
                      </td>
                      <td className="py-3 px-3 text-right tabular-nums">
                        {selectedBlock.indicators.sentinelNdvi !== null ? selectedBlock.indicators.sentinelNdvi : 'Missing data'}
                      </td>
                      <td className="py-3 px-3 text-right tabular-nums">
                        {calculatedResult.normalizationBreakdown.ndviNorm !== null ? `${Math.round(calculatedResult.normalizationBreakdown.ndviNorm * 100)}%` : 'N/A'}
                      </td>
                      <td className="py-3 px-3 text-right font-bold text-primary tabular-nums">
                        15%
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="py-8 text-center text-xs text-text-muted">
                Indicator details unavailable.
              </div>
            )}
          </div>

          {/* Section 2: Machine Learning Physical Forecast & Model Registry */}
          <div className="space-y-4 pt-4 border-t border-border">
            <div className="border-b border-border pb-3 flex flex-col sm:flex-row sm:items-start justify-between gap-2">
              <div>
                <h2 className="text-base font-bold text-text-main flex items-center gap-2">
                  <ActivityChartIcon className="w-4 h-4 text-primary" />
                  Machine Learning Physical Depth Forecast (QuantileGB-v2.0)
                </h2>
                <p className="text-xs text-text-muted mt-1 leading-relaxed">
                  Station-autonomous Quantile Gradient Boosting predicting physical water table depth below ground level (m bgl).
                  The ML model predicts physical water level depth; it does NOT predict a composite stress index.*
                </p>
              </div>
              <span className="text-[11px] font-mono text-text-muted bg-subtle px-2 py-1 shrink-0">
                Target: Depth (m bgl)
              </span>
            </div>

            {/* Model Governance Metadata Strip */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs bg-subtle p-3 border border-border">
              <div>
                <span className="text-[10px] uppercase font-semibold text-text-muted block">Model Identifier</span>
                <span className="font-bold text-text-main">{forecastData?.modelIdentifier || (isForecastLoading ? 'Loading...' : 'None')}</span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-semibold text-text-muted block">Version</span>
                <span className="font-medium text-text-main">{forecastData?.modelVersion || 'N/A'}</span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-semibold text-text-muted block">Operational Status</span>
                <span className="font-medium text-text-main">
                  {forecastData?.modelStatus === 'research_prototype' ? 'Research Prototype' : forecastData?.modelStatus === 'calibrated_operational' ? 'Operational' : 'Unavailable'}
                </span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-semibold text-text-muted block">Statutory Eligibility</span>
                <span className="font-medium text-text-muted">
                  {forecastData?.operationalEligibility ? 'Eligible' : 'Non-operational (Research only)'}
                </span>
              </div>
            </div>

            {/* Forecast Content: Active Multi-Horizon Predictions OR Honest Unavailable State */}
            {isForecastLoading ? (
              <div className="space-y-3 animate-pulse p-4 bg-subtle/40 border border-border">
                <div className="h-4 bg-subtle w-1/3"></div>
                <div className="h-16 bg-subtle w-full"></div>
              </div>
            ) : forecastData && forecastData.forecasts && forecastData.forecasts.length > 0 ? (
              <div className="space-y-3">
                <div className="overflow-x-auto border-t border-b border-border">
                  <table className="w-full text-left text-xs border-collapse dbim-table">
                    <thead>
                      <tr className="border-b border-border bg-subtle text-text-muted font-bold text-[11px] uppercase tracking-wider">
                        <th className="py-2.5 px-3 text-left">Forecast Horizon</th>
                        <th className="py-2.5 px-3 text-right">Target Period</th>
                        <th className="py-2.5 px-3 text-right">Expected Depth (m bgl)</th>
                        <th className="py-2.5 px-3 text-right">P10–P90 Uncertainty Interval</th>
                        <th className="py-2.5 px-3 text-right">Baseline Depth</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {forecastData.forecasts.map((f: ForecastPoint) => (
                        <tr key={f.horizonQuarter} className="hover:bg-subtle/40 transition-colors">
                          <td className="py-3 px-3">
                            <span className="font-bold text-text-main block">
                              Horizon Q{f.horizonQuarter} ({f.forecastHorizonMonths || f.horizonQuarter * 3} Months)
                            </span>
                            <span className="text-[11px] text-text-muted">
                              {f.uncertaintyInterval.intervalStatus === 'calibrated_ordered' ? 'Calibrated & Ordered' : 'Uncalibrated'}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-right tabular-nums text-text-main">
                            {f.targetSeason}
                          </td>
                          <td className="py-3 px-3 text-right font-bold text-primary tabular-nums">
                            {f.expectedDepthMbgl.toFixed(2)} m bgl
                          </td>
                          <td className="py-3 px-3 text-right tabular-nums text-text-main">
                            {f.uncertaintyInterval.lowerBoundP10Mbgl !== null && f.uncertaintyInterval.upperBoundP90Mbgl !== null
                              ? `[${f.uncertaintyInterval.lowerBoundP10Mbgl.toFixed(2)} – ${f.uncertaintyInterval.upperBoundP90Mbgl.toFixed(2)}] m bgl`
                              : 'Uncertainty unavailable'}
                            {f.uncertaintyInterval.intervalWidthM !== null && (
                              <span className="block text-[11px] text-text-muted">
                                Spread: {f.uncertaintyInterval.intervalWidthM} m
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-3 text-right tabular-nums text-text-muted">
                            {f.baselinePersistence?.lastObservationPersistenceMbgl !== null && f.baselinePersistence?.lastObservationPersistenceMbgl !== undefined
                              ? `${f.baselinePersistence.lastObservationPersistenceMbgl} m bgl`
                              : 'N/A'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Model Disclaimer */}
                <div className="p-3 bg-subtle border border-border text-[11px] text-text-muted space-y-1">
                  <div className="font-semibold text-text-main">Scientific Disclaimer &amp; Pipeline Notice:</div>
                  <p className="leading-relaxed">{forecastData.safeguardDisclaimer}</p>
                </div>
              </div>
            ) : (
              <div className="p-4 bg-subtle border border-border text-xs text-text-muted space-y-2">
                <div className="font-bold text-text-main flex items-center gap-1.5">
                  <InfoIcon className="w-4 h-4 text-text-muted" />
                  <span>ML Depth Forecast Unavailable for this Geography</span>
                </div>
                <p className="leading-relaxed">
                  No verified machine learning model artifact exists in the offline model registry for {selectedBlock?.name || 'this block'} ({selectedBlock?.state || 'selected region'}).
                  JAL DRISHTI's Quantile Gradient Boosting (v2.0) models are currently packaged for 5 priority states (Punjab, Haryana, Rajasthan, Assam, and Arunachal Pradesh).
                  Per Section 5 scientific rules, predictions are not extrapolated to uncalibrated regions or fabricated with synthetic defaults.
                </p>
                <p className="text-[11px] text-text-muted/80 italic">
                  The descriptive Groundwater Stress Score (GSS Baseline) in Section 1 continues to provide multi-signal decision support from available observed indicators.
                </p>
              </div>
            )}

            {/* Scientific Methodological Comparison Notice */}
            <div className="border-l-2 border-primary bg-subtle p-3 text-[11px] text-text-muted space-y-1">
              <span className="font-semibold text-text-main block">Distinct Targets — GSS vs. Machine Learning:</span>
              <p className="leading-relaxed">
                The Groundwater Stress Score (0–100) measures composite hydrological pressure by normalizing 4 cross-domain indicators. In contrast, the ML model predicts physical water table depth (m bgl) from historical well telemetry. The two methodologies serve complementary decision-support roles; machine learning depth forecasts do not replace or validate the composite stress score.
              </p>
            </div>
          </div>

          {/* Validation & Operational Status */}
          <div className="pt-6 border-t border-border space-y-3">
            <h2 className="text-base font-bold text-text-main">System Status &amp; Safety Rules</h2>
            <p className="text-xs text-text-muted">
              How these scores are calculated and how they must be used in day-to-day operations:
            </p>
            <div className="divide-y divide-border border-y border-border text-xs">
              {[
                ['Score Calculation', 'The GSS score is calculated live using the 4 weighted empirical environmental indicators above. It is a descriptive heuristic, not an ML prediction.'],
                ['ML Depth Forecasting', 'Machine learning forecasts physical water table depth (m bgl) where station models are packaged. It does not output a composite stress score.'],
                ['Ground Well Calibration', 'Ongoing. Scores provide early warnings but must be confirmed with local well tests and physical inspection before administrative action.'],
                ['Decision Safety Rule', 'This score helps prioritize areas for review. It does not automatically approve funds or launch emergency orders.'],
                ['Missing Data Protection', 'If key sensors are offline, the system marks an explicit data gap instead of assuming water is safe.'],
              ].map(([title, note]) => (
                <div key={title} className="py-3 flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-4">
                  <span className="font-semibold text-text-main sm:w-48 shrink-0">{title}</span>
                  <span className="text-text-muted leading-relaxed">{note}</span>
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
