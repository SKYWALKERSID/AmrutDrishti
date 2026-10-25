'use client';

import React, { useState, useEffect, Suspense, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { RiskSeverity, BlockData } from '@/lib/types';
import { useRole } from '@/lib/context/RoleContext';
import { canMutateDemoWorkflows, demoRestrictionNotice } from '@/lib/demo/demoPolicy';
import { calculateDescriptiveGss, evaluateGroundwaterIntelligence } from '@/lib/services/scientificEngine';
import { ShieldCheckIcon, ActivityChartIcon, FilterIcon, InfoIcon, CheckCircleIcon } from '@/components/ui/Icons';
import { useLanguage } from '@/lib/context/LanguageContext';
import { ACTIVE_TARGET_BLOCKS, ACTIVE_TARGET_DISTRICTS, mergeWithLiveBlocks, normalizeStateName } from '@/lib/data/allNationwideBlocks';
import { ALL_INDIAN_STATES, ALL_TARGET_STATES, HISTORICAL_REFERENCE_STATES, EXPANSION_INDIAN_STATES, TARGET_REGIONS, isTargetState, getTargetStatesAlphabetically } from '@/lib/data/indiaStates';
import { sortDistrictsAlphabetically, sortBlocksByName, sortBlocksHierarchy } from '@/lib/data/geographicSorting';
import type { BlockForecastResponse, ForecastPoint } from '@/app/api/forecast/route';
import { TermHelp, WhatAmILookingAt } from '@/components/ui/PlainLanguageHelp';

function RiskAssessmentContent() {
  const { t } = useLanguage();
  const searchParams = useSearchParams();
  const urlBlockParam = searchParams.get('block');
  const { activeRole } = useRole();
  const targetStatesAtoZ = useMemo(() => getTargetStatesAlphabetically(), []);
  const initialFirstState = targetStatesAtoZ[0]?.name || 'Haryana';
  const initialDistricts = useMemo(() => {
    return sortDistrictsAlphabetically(
      ACTIVE_TARGET_DISTRICTS.filter(d => normalizeStateName(d.state) === initialFirstState)
    );
  }, [initialFirstState]);
  const initialFirstDistrict = initialDistricts[0];
  const initialBlocks = useMemo(() => {
    return sortBlocksByName(
      ACTIVE_TARGET_BLOCKS.filter(b => normalizeStateName(b.state) === initialFirstState && b.districtId === initialFirstDistrict?.id)
    );
  }, [initialFirstState, initialFirstDistrict]);
  const initialFirstBlock = initialBlocks[0];

  const [selectedState, setSelectedState] = useState<string>(initialFirstState);
  const [selectedDistrictId, setSelectedDistrictId] = useState<string>(initialFirstDistrict?.id || 'all');
  const [blocksData, setBlocksData] = useState<BlockData[]>(ACTIVE_TARGET_BLOCKS);
  const [selectedBlockId, setSelectedBlockId] = useState<string>(urlBlockParam || initialFirstBlock?.id || '');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [forecastData, setForecastData] = useState<BlockForecastResponse | null>(null);
  const [isForecastLoading, setIsForecastLoading] = useState<boolean>(true);

  // Forward-Looking Station Forecast Pipeline State (/api/station-forecast)
  const [telemetryStationsList, setTelemetryStationsList] = useState<Array<{
    stationId: string;
    state: string;
    district: string;
    stationName: string;
    latestDate: string;
    horizonDays: number[] | number;
  }>>([]);
  const [selectedStationId, setSelectedStationId] = useState<string>('');
  const [stationForecast90, setStationForecast90] = useState<any | null>(null);
  const [stationForecast180, setStationForecast180] = useState<any | null>(null);
  const [isStationForecastLoading, setIsStationForecastLoading] = useState<boolean>(false);
  const [stationForecastError, setStationForecastError] = useState<string | null>(null);
  const [showHistoricalBenchmark, setShowHistoricalBenchmark] = useState<boolean>(false);

  // Rainfall Intelligence & Forecasting Pipeline State (/api/rainfall)
  const [rainfallData, setRainfallData] = useState<any | null>(null);
  const [isRainfallLoading, setIsRainfallLoading] = useState<boolean>(false);

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
          } else if (!selectedBlockId) {
            setSelectedState(initialFirstState);
            if (initialFirstDistrict) setSelectedDistrictId(initialFirstDistrict.id);
            if (initialFirstBlock) setSelectedBlockId(initialFirstBlock.id);
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

  // Load Telemetry Stations List once
  useEffect(() => {
    let active = true;
    fetch('/api/station-forecast?stations=true')
      .then(res => res.json())
      .then(data => {
        if (!active) return;
        if (data.status === 'available' && Array.isArray(data.stations)) {
          setTelemetryStationsList(data.stations);
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  // Filter stations compatible with currently selected geography
  const compatibleStations = useMemo(() => {
    if (!telemetryStationsList.length) return [];
    const block = blocksData.find(b => b.id === selectedBlockId);
    const targetState = block ? normalizeStateName(block.state) : (selectedState !== 'all' ? selectedState : null);
    const targetDistrict = block?.districtName || null;

    if (!targetState) {
      return telemetryStationsList;
    }

    // 1. Try exact district match within state
    if (targetDistrict) {
      const distMatch = telemetryStationsList.filter(s =>
        normalizeStateName(s.state).toLowerCase() === targetState.toLowerCase() &&
        s.district.trim().toLowerCase() === targetDistrict.trim().toLowerCase()
      );
      if (distMatch.length > 0) return distMatch;
    }

    // 2. Fall back to state-level stations
    return telemetryStationsList.filter(s =>
      normalizeStateName(s.state).toLowerCase() === targetState.toLowerCase()
    );
  }, [telemetryStationsList, selectedBlockId, selectedState, blocksData]);

  // Sync selectedStationId when compatible stations change
  useEffect(() => {
    if (compatibleStations.length > 0) {
      if (!selectedStationId || !compatibleStations.some(s => s.stationId === selectedStationId)) {
        setSelectedStationId(compatibleStations[0].stationId);
      }
    } else {
      setSelectedStationId('');
    }
  }, [compatibleStations, selectedStationId]);

  // Load Forward-Looking Station Forecasts (90-day & 180-day) from /api/station-forecast
  useEffect(() => {
    if (!selectedStationId) {
      setStationForecast90(null);
      setStationForecast180(null);
      setIsStationForecastLoading(false);
      setStationForecastError(null);
      return;
    }
    let active = true;
    setIsStationForecastLoading(true);
    setStationForecastError(null);

    Promise.allSettled([
      fetch(`/api/station-forecast?stationId=${encodeURIComponent(selectedStationId)}&horizonDays=90`).then(r => r.json()),
      fetch(`/api/station-forecast?stationId=${encodeURIComponent(selectedStationId)}&horizonDays=180`).then(r => r.json())
    ]).then(([res90, res180]) => {
      if (!active) return;
      if (res90.status === 'fulfilled' && res90.value.status === 'experimental') {
        setStationForecast90(res90.value);
      } else {
        setStationForecast90(null);
      }
      if (res180.status === 'fulfilled' && res180.value.status === 'experimental') {
        setStationForecast180(res180.value);
      } else {
        setStationForecast180(null);
      }
      if (
        (res90.status === 'rejected' || (res90.status === 'fulfilled' && res90.value.status !== 'experimental')) &&
        (res180.status === 'rejected' || (res180.status === 'fulfilled' && res180.value.status !== 'experimental'))
      ) {
        setStationForecastError('Station model output temporarily unavailable or uncalibrated for this station.');
      }
    }).catch(() => {
      if (active) {
        setStationForecastError('Failed to retrieve station forecast.');
      }
    }).finally(() => {
      if (active) {
        setIsStationForecastLoading(false);
      }
    });

    return () => {
      active = false;
    };
  }, [selectedStationId]);

  // Load Unified Rainfall Intelligence & Forecasting for selected block's district
  useEffect(() => {
    const block = blocksData.find(b => b.id === selectedBlockId);
    if (!block || !block.districtName) {
      setRainfallData(null);
      setIsRainfallLoading(false);
      return;
    }
    let active = true;
    setIsRainfallLoading(true);
    fetch(`/api/rainfall?district=${encodeURIComponent(block.districtName)}&state=${encodeURIComponent(block.state)}`)
      .then(r => r.json())
      .then(d => {
        if (active) {
          if (d.status === 'available') {
            setRainfallData(d);
          } else {
            setRainfallData(null);
          }
        }
      })
      .catch(() => {
        if (active) setRainfallData(null);
      })
      .finally(() => {
        if (active) setIsRainfallLoading(false);
      });

    return () => {
      active = false;
    };
  }, [selectedBlockId, blocksData]);

  // Load Historical Research Benchmark Forecast for selected block from legacy /api/forecast endpoint
  useEffect(() => {
    if (!selectedBlockId) {
      setForecastData(null);
      setIsForecastLoading(false);
      return;
    }
    let active = true;
    setIsForecastLoading(true);
    const endpoint = `/api/forecast?block=${encodeURIComponent(selectedBlockId)}`;
    fetch(endpoint)
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

  // Derived filtered districts (Sorted alphabetically A-Z)
  const availableDistricts = useMemo(() => {
    const list = selectedState === 'all'
      ? ACTIVE_TARGET_DISTRICTS
      : ACTIVE_TARGET_DISTRICTS.filter(d => normalizeStateName(d.state) === selectedState);
    return sortDistrictsAlphabetically(list);
  }, [selectedState]);

  // Derived filtered blocks (Sorted alphabetically A-Z within hierarchy)
  const filteredBlocks = useMemo(() => {
    const list = blocksData.filter(b => {
      const matchState = selectedState === 'all'
        ? isTargetState(b.state)
        : normalizeStateName(b.state) === selectedState;
      const matchDistrict = selectedDistrictId === 'all' || b.districtId === selectedDistrictId;
      return matchState && matchDistrict;
    });
    return selectedDistrictId === 'all' ? sortBlocksHierarchy(list) : sortBlocksByName(list);
  }, [blocksData, selectedState, selectedDistrictId]);

  const handleStateChange = (stateName: string) => {
    setSelectedState(stateName);
    if (stateName === 'all') {
      setSelectedDistrictId('all');
      const matched = sortBlocksHierarchy(blocksData);
      if (matched.length > 0) {
        setSelectedBlockId(matched[0].id);
        setOverrideApplied(false);
      }
      return;
    }
    const dists = sortDistrictsAlphabetically(
      ACTIVE_TARGET_DISTRICTS.filter(d => normalizeStateName(d.state) === stateName)
    );
    if (dists.length > 0) {
      const firstDist = dists[0];
      setSelectedDistrictId(firstDist.id);
      const blks = sortBlocksByName(
        blocksData.filter(b => normalizeStateName(b.state) === stateName && b.districtId === firstDist.id)
      );
      if (blks.length > 0) {
        setSelectedBlockId(blks[0].id);
        setOverrideApplied(false);
      }
    } else {
      setSelectedDistrictId('all');
    }
  };

  const handleDistrictChange = (distId: string) => {
    setSelectedDistrictId(distId);
    if (distId === 'all') {
      const blks = sortBlocksHierarchy(
        blocksData.filter(b => selectedState === 'all' || normalizeStateName(b.state) === selectedState)
      );
      if (blks.length > 0) {
        setSelectedBlockId(blks[0].id);
        setOverrideApplied(false);
      }
      return;
    }
    const blks = sortBlocksByName(
      blocksData.filter(b => b.districtId === distId)
    );
    if (blks.length > 0) {
      setSelectedBlockId(blks[0].id);
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
    <div className="space-y-6">
      {/* Header - Editorial Layout */}
      <div className="border-b border-border pb-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-text-muted">
            <span className="font-semibold text-text-main">
              Groundwater Assessment &amp; Model Governance*
            </span>
            <span aria-hidden="true">•</span>
            <span>Descriptive Heuristic Baseline (0–100) &amp; ML Depth Forecasting (m bgl)</span>
            <span aria-hidden="true">•</span>
            <span>Latest Observation: {selectedBlock?.indicators.lastUpdatedDate || '2026-10-12'}</span>
          </div>
          <h1 className="dbim-heading-1 text-text-main flex items-center gap-2 flex-wrap mt-1">
            {t('risk.title')}*
          </h1>
          <p className="text-xs sm:text-sm text-text-muted mt-1 max-w-3xl leading-relaxed">
            {t('risk.subtitle')}
          </p>
        </div>
      </div>

      {/* Main Content Layout: Block Selector & Analysis */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Target Selector & Descriptive Stress Score Baseline (5 cols) */}
        <div className="lg:col-span-5 space-y-5">
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
                      <option value="all">All 9 Active Target States</option>
                      {getTargetStatesAlphabetically().map((st) => (
                        <option key={st.code} value={st.name}>
                          {st.name}
                        </option>
                      ))}
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
                <div className="py-3 border-y border-border text-center space-y-1.5">
                  <div className="text-xs text-text-muted uppercase font-semibold">
                    <span>Descriptive Stress Score (GSS Baseline: 0 to 100)*</span>
                  </div>
                  <p className="text-[11px] text-text-muted max-w-sm mx-auto">
                    An overall 0-100 guide showing where water stress needs investigation (0–39 Normal, 40–69 Watch, 70–100 Severe).
                  </p>
                  <div className="text-3xl font-extrabold text-primary my-1">
                    {calculatedResult.score !== null ? calculatedResult.score : 'Data Gap'}{' '}
                    {calculatedResult.score !== null && <span className="text-xs font-normal text-text-muted">/ 100</span>}
                  </div>
                  <div className="text-[11px] text-text-muted">
                    Confidence Interval: Uncalibrated descriptive index (Statistical confidence intervals require physical observation well calibration)
                  </div>
                  <div className="pt-0.5">
                    <span className={`text-xs font-bold ${
                      effectiveSeverity === 'severe' ? 'text-status-errorText' : effectiveSeverity === 'normal' ? 'text-status-successText' : effectiveSeverity === 'gap' ? 'text-text-muted' : 'text-status-warningText'
                    }`}>
                      {effectiveSeverity.toUpperCase()} PRIORITY
                    </span>
                  </div>
                  <p className="text-xs text-text-muted pt-0.5">
                    Main Contributing Factor: <span className="font-semibold text-text-main">{calculatedResult.primaryStressDriver}</span>
                  </p>
                  <p className="text-[11px] text-text-muted/80 italic pt-0.5">
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
              <div className="py-6 text-center text-xs text-text-muted space-y-1">
                <p className="font-semibold text-text-main">No Block Available</p>
                <p>No verified administrative units returned for risk assessment.</p>
              </div>
            )}
          </div>

          {/* Human Override Controls */}
          {restrictionNotice && (
            <div role="note" className="bg-status-warningBg border border-status-warning p-2.5 text-xs text-status-warningText">{restrictionNotice}</div>
          )}
          {!isReadOnly && (
            <div className="pt-3.5 border-t border-border space-y-2.5">
              <h2 className="text-sm font-bold text-text-main flex items-center gap-2">
                <ShieldCheckIcon className="w-4 h-4 text-primary" /> {t('risk.humanOverrideTitle', 'Human Review & Risk Override')}
              </h2>
              <p className="text-xs text-text-muted">
                {t('risk.overrideSubtitle', 'Demo-only control. Nothing is persisted or audited. Authorized reviewers would adjust classification after physical ground inspection.')}
              </p>

              {overrideApplied ? (
                <div className="p-2.5 bg-status-successBg border border-status-success text-status-successText text-xs space-y-1">
                  <div className="font-bold flex items-center gap-1.5">
                    <CheckCircleIcon className="w-4 h-4 text-status-successText" /> {t('risk.overrideSuccessTitle', 'Review Note Held In Memory')}
                  </div>
                  <p>{t('risk.overrideSuccessMsg', 'Status shown for this page session only. Held in browser memory; not saved and not an audit trail.')}</p>
                </div>
              ) : (
                <form onSubmit={handleApplyOverride} className="space-y-2.5">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-text-main">{t('risk.overrideSeverityLabel', 'Override Severity Level')}:</label>
                    <select
                      value={overrideSeverity}
                      onChange={(e) => setOverrideSeverity(e.target.value as RiskSeverity)}
                      className="w-full bg-subtle border border-border px-2.5 py-1.5 text-xs text-text-main focus:outline-none"
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
                      rows={2}
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

          {/* Validation & Operational Status: System Status & Safety Rules */}
          <div className="pt-3.5 border-t border-border space-y-2">
            <h2 className="text-sm font-bold text-text-main">System Status &amp; Safety Rules</h2>
            <p className="text-xs text-text-muted">
              How these scores are calculated and how they must be used in day-to-day operations:
            </p>
            <div className="divide-y divide-border border-y border-border text-xs">
              {[
                ['Score Calculation', 'The GSS score is calculated live using the 4 weighted empirical environmental indicators. It is a descriptive heuristic, not an ML prediction.'],
                ['ML Depth Forecasting', 'Machine learning forecasts physical water table depth (m bgl) where station models are packaged. It does not output a composite stress score.'],
                ['Ground Well Calibration', 'Ongoing. Scores provide early warnings but must be confirmed with local well tests and physical inspection before administrative action.'],
                ['Decision Safety Rule', 'This score helps prioritize areas for review. It does not automatically approve funds or launch emergency orders.'],
                ['Missing Data Protection', 'If key sensors are offline, the system marks an explicit data gap instead of assuming water is safe.'],
              ].map(([title, note]) => (
                <div key={title} className="py-2 flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-2">
                  <span className="font-semibold text-text-main sm:w-36 shrink-0">{title}</span>
                  <span className="text-text-muted leading-relaxed">{note}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: Multi-Criteria Breakdown & Machine Learning Physical Depth Forecast (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          {/* Section 1: Descriptive Multi-Criteria Breakdown */}
          <div className="space-y-3">
            <div className="border-b border-border pb-2.5">
              <h2 className="text-base font-bold text-text-main">
                Descriptive Multi-Criteria Breakdown (Heuristic Baseline)
              </h2>
              <p className="text-xs text-text-muted mt-0.5 leading-relaxed">
                This score combines 4 empirical environmental signals into a weighted 0–100 index. It provides a descriptive estimate of hydrological stress based on current observations. It is a mathematical heuristic index, not a machine learning prediction.*
              </p>
            </div>

            {isLoading ? (
              <div className="space-y-2 animate-pulse">
                <div className="h-10 bg-subtle"></div>
                <div className="h-12 bg-subtle"></div>
                <div className="h-12 bg-subtle"></div>
              </div>
            ) : selectedBlock ? (
              <div className="overflow-x-auto border-t border-b border-border">
                <table className="w-full text-left text-xs border-collapse dbim-table">
                  <thead>
                    <tr className="border-b border-border bg-subtle text-text-muted font-bold text-[11px] uppercase tracking-wider">
                      <th className="py-2 px-2.5 text-left">Environmental Indicator</th>
                      <th className="py-2 px-2.5 text-right">Current Observation</th>
                      <th className="py-2 px-2.5 text-right">Stress Level</th>
                      <th className="py-2 px-2.5 text-right">Base Weight</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {/* 1. CGWB Well Depth */}
                    <tr className="hover:bg-subtle/40 transition-colors">
                      <td className="py-2.5 px-2.5">
                        <span className="font-bold text-text-main block">
                          CGWB Well Water Depth
                        </span>
                        <span className="text-[11px] text-text-muted block">How deep you must dig or drill to reach water (meters below ground level).</span>
                      </td>
                      <td className="py-2.5 px-2.5 text-right tabular-nums">
                        {selectedBlock.indicators.cgwbWellDepthMbgl !== null ? `${selectedBlock.indicators.cgwbWellDepthMbgl} m bgl` : 'Missing data'}
                      </td>
                      <td className="py-2.5 px-2.5 text-right tabular-nums">
                        {calculatedResult.normalizationBreakdown.wellDepthNorm !== null ? `${Math.round(calculatedResult.normalizationBreakdown.wellDepthNorm * 100)}%` : 'N/A'}
                      </td>
                      <td className="py-2.5 px-2.5 text-right font-bold text-primary tabular-nums">
                        35%
                      </td>
                    </tr>

                    {/* 2. Rainfall Deficit */}
                    <tr className="hover:bg-subtle/40 transition-colors">
                      <td className="py-2.5 px-2.5">
                        <span className="font-bold text-text-main block">
                          Monsoon Rainfall Deficit
                        </span>
                        <span className="text-[11px] text-text-muted block">How much more or less rain fell compared to the 30-year average.</span>
                      </td>
                      <td className="py-2.5 px-2.5 text-right tabular-nums">
                        {selectedBlock.indicators.rainfallAnomalyMm !== null ? `${selectedBlock.indicators.rainfallAnomalyMm} mm` : 'Missing data'}
                      </td>
                      <td className="py-2.5 px-2.5 text-right tabular-nums">
                        {calculatedResult.normalizationBreakdown.rainDeficitNorm !== null ? `${Math.round(calculatedResult.normalizationBreakdown.rainDeficitNorm * 100)}%` : 'N/A'}
                      </td>
                      <td className="py-2.5 px-2.5 text-right font-bold text-primary tabular-nums">
                        30%
                      </td>
                    </tr>

                    {/* 3. GRACE TWSA */}
                    <tr className="hover:bg-subtle/40 transition-colors">
                      <td className="py-2.5 px-2.5">
                        <span className="font-bold text-text-main block">
                          Satellite Water Storage (GRACE-FO)
                        </span>
                        <span className="text-[11px] text-text-muted block">Regional water gain or loss measured from space (NASA GRACE satellite gravity).</span>
                      </td>
                      <td className="py-2.5 px-2.5 text-right tabular-nums">
                        {selectedBlock.indicators.graceTwsaCm !== null ? `${selectedBlock.indicators.graceTwsaCm} cm` : 'Missing data'}
                      </td>
                      <td className="py-2.5 px-2.5 text-right tabular-nums">
                        {calculatedResult.normalizationBreakdown.graceTwsaNorm !== null ? `${Math.round(calculatedResult.normalizationBreakdown.graceTwsaNorm * 100)}%` : 'N/A'}
                      </td>
                      <td className="py-2.5 px-2.5 text-right font-bold text-primary tabular-nums">
                        20%
                      </td>
                    </tr>

                    {/* 4. Sentinel NDVI */}
                    <tr className="hover:bg-subtle/40 transition-colors">
                      <td className="py-2.5 px-2.5">
                        <span className="font-bold text-text-main block">
                          Vegetation Health (NDVI)
                        </span>
                        <span className="text-[11px] text-text-muted block">How green and healthy crops appear from satellite images (0.0 to 1.0 index).</span>
                      </td>
                      <td className="py-2.5 px-2.5 text-right tabular-nums">
                        {selectedBlock.indicators.sentinelNdvi !== null ? selectedBlock.indicators.sentinelNdvi : 'Missing data'}
                      </td>
                      <td className="py-2.5 px-2.5 text-right tabular-nums">
                        {calculatedResult.normalizationBreakdown.ndviNorm !== null ? `${Math.round(calculatedResult.normalizationBreakdown.ndviNorm * 100)}%` : 'N/A'}
                      </td>
                      <td className="py-2.5 px-2.5 text-right font-bold text-primary tabular-nums">
                        15%
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="py-6 text-center text-xs text-text-muted">
                Indicator details unavailable.
              </div>
            )}
          </div>

          {/* Section 1.5: Unified Rainfall Intelligence & Multi-Horizon Forward Forecast */}
          <div className="space-y-3 pt-3.5 border-t border-border">
            <div className="border-b border-border pb-2.5 flex flex-col sm:flex-row sm:items-start justify-between gap-2">
              <div>
                <h2 className="text-base font-bold text-text-main flex items-center gap-2">
                  <ShieldCheckIcon className="w-4 h-4 text-primary" />
                  Unified Rainfall Intelligence &amp; Multi-Horizon Forward Forecast
                </h2>
                <p className="text-xs text-text-muted mt-0.5 leading-relaxed">
                  Harmonized IMD daily observations and state department telemetry (2021–2026) informing seasonal groundwater recharge windows and meteorological drought risk.
                </p>
              </div>
              <span className="text-[11px] font-mono text-text-muted bg-subtle px-2 py-1 shrink-0">
                Resolution: District Daily
              </span>
            </div>

            {isRainfallLoading ? (
              <div className="space-y-2.5 animate-pulse p-3.5 bg-subtle/40 border border-border">
                <div className="h-4 bg-subtle w-1/3"></div>
                <div className="h-12 bg-subtle w-full"></div>
              </div>
            ) : rainfallData && rainfallData.status === 'available' ? (
              <div className="space-y-3">
                {/* Historical Rainfall Intelligence Metrics Strip */}
                <div className="p-3 bg-subtle border border-border space-y-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/80 pb-1.5">
                    <span className="font-bold text-xs text-text-main uppercase tracking-wider">
                      Meteorological Intelligence for {rainfallData.districtName} ({rainfallData.stateName})
                    </span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 border ${
                      rainfallData.historicalIntelligence.meteorological_condition.includes('Dry')
                        ? 'bg-amber-500/10 text-amber-800 border-amber-500/30'
                        : 'bg-emerald-500/10 text-emerald-800 border-emerald-500/30'
                    }`}>
                      {rainfallData.historicalIntelligence.meteorological_condition.toUpperCase()}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
                    <div>
                      <span className="text-[10px] uppercase font-semibold text-text-muted block">Observed Rain (30d)</span>
                      <span className="font-bold text-text-main font-mono">
                        {rainfallData.historicalIntelligence.recent_30d_actual_mm} mm
                      </span>
                      <span className="text-[10px] text-text-muted block">
                        Normal: {rainfallData.historicalIntelligence.recent_30d_normal_mm} mm
                      </span>
                    </div>

                    <div>
                      <span className="text-[10px] uppercase font-semibold text-text-muted block">Rainfall Anomaly (30d)</span>
                      <span className={`font-bold font-mono ${rainfallData.historicalIntelligence.recent_30d_anomaly_mm < 0 ? 'text-amber-800' : 'text-emerald-800'}`}>
                        {rainfallData.historicalIntelligence.recent_30d_anomaly_mm > 0 ? '+' : ''}{rainfallData.historicalIntelligence.recent_30d_anomaly_mm} mm
                      </span>
                      <span className="text-[10px] text-text-muted block">
                        Departure: {rainfallData.historicalIntelligence.recent_30d_departure_pct}%
                      </span>
                    </div>

                    <div>
                      <span className="text-[10px] uppercase font-semibold text-text-muted block">Dry Spell Duration</span>
                      <span className="font-bold text-text-main font-mono">
                        {rainfallData.historicalIntelligence.current_dry_spell_days} Days
                      </span>
                      <span className="text-[10px] text-text-muted block">
                        Longest: {rainfallData.historicalIntelligence.longest_dry_spell_days}d
                      </span>
                    </div>

                    <div>
                      <span className="text-[10px] uppercase font-semibold text-text-muted block">SPI-3 Equiv. Index</span>
                      <span className="font-bold font-mono text-primary">
                        {rainfallData.historicalIntelligence.spi_3month_equivalent}
                      </span>
                      <span className="text-[10px] text-text-muted block">
                        Ref: {rainfallData.historicalIntelligence.historical_climatology_ref.slice(0, 9)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Machine-Learning Forward Rainfall Forecast Table */}
                {rainfallData.forecast && rainfallData.forecast.horizons && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between pb-1">
                      <span className="text-xs font-bold text-text-muted uppercase tracking-wider">
                        Machine Learning Forward Precipitation Forecast (NWDP-Rainfall-QuantileGB-v1)
                      </span>
                      <span className="text-[10px] text-text-muted font-mono">
                        Origin: {rainfallData.forecast.forecast_origin_date}
                      </span>
                    </div>

                    <div className="overflow-x-auto border-t border-b border-border">
                      <table className="w-full text-left text-xs border-collapse dbim-table">
                        <thead>
                          <tr className="border-b border-border bg-subtle text-text-muted font-bold text-[11px] uppercase tracking-wider">
                            <th className="py-2 px-2.5 text-left">Forecast Horizon</th>
                            <th className="py-2 px-2.5 text-right">Target Window</th>
                            <th className="py-2 px-2.5 text-right">Expected (P50)</th>
                            <th className="py-2 px-2.5 text-right">P10–P90 Range</th>
                            <th className="py-2 px-2.5 text-right">Climatological Normal</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {['30d', '60d', '90d'].map((hz) => {
                            const item = rainfallData.forecast.horizons[hz];
                            if (!item) return null;
                            return (
                              <tr key={hz} className="hover:bg-subtle/40 transition-colors">
                                <td className="py-2 px-2.5">
                                  <span className="font-bold text-text-main block">
                                    {hz.toUpperCase()} Horizon
                                  </span>
                                  <span className="text-[10px] text-text-muted">
                                    {item.uncertainty_interval.interval_status}
                                  </span>
                                </td>
                                <td className="py-2 px-2.5 text-right tabular-nums text-text-main text-[11px]">
                                  {item.target_period_start} to {item.target_period_end}
                                </td>
                                <td className="py-2 px-2.5 text-right font-bold text-primary tabular-nums">
                                  {item.expected_cumulative_rainfall_mm} mm
                                </td>
                                <td className="py-2 px-2.5 text-right tabular-nums text-text-main">
                                  [{item.uncertainty_interval.p10_mm} – {item.uncertainty_interval.p90_mm}] mm
                                  <span className="block text-[10px] text-text-muted">
                                    Spread: {item.uncertainty_interval.spread_mm} mm
                                  </span>
                                </td>
                                <td className="py-2 px-2.5 text-right tabular-nums text-text-muted">
                                  {item.climatological_normal_mm} mm
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    {/* Calibrated Event Probabilities Strip */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 p-2.5 bg-subtle/60 border border-border text-xs">
                      <div className="p-2 bg-surface border border-border">
                        <span className="text-[10px] uppercase font-semibold text-text-muted block">Severe Deficit Probability (&gt;50%)</span>
                        <span className="font-bold text-amber-800 text-sm font-mono">
                          {Math.round(rainfallData.forecast.event_probabilities.probability_severe_deficit_gt_50pct * 100)}%
                        </span>
                      </div>
                      <div className="p-2 bg-surface border border-border">
                        <span className="text-[10px] uppercase font-semibold text-text-muted block">Normal / Surplus Probability</span>
                        <span className="font-bold text-emerald-800 text-sm font-mono">
                          {Math.round(rainfallData.forecast.event_probabilities.probability_normal_or_excess * 100)}%
                        </span>
                      </div>
                      <div className="p-2 bg-surface border border-border">
                        <span className="text-[10px] uppercase font-semibold text-text-muted block">Extended Dry Spell Probability (&gt;14d)</span>
                        <span className="font-bold text-text-main text-sm font-mono">
                          {Math.round(rainfallData.forecast.event_probabilities.probability_extended_dry_spell_gt_14d * 100)}%
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="p-3 bg-subtle border border-border text-xs text-text-muted space-y-1">
                <span className="font-bold text-text-main block">Rainfall Intelligence Unavailable for this District</span>
                <p>
                  No verified IMD-NWDP rainfall time series is registered for {selectedBlock?.districtName || 'this district'}.
                  JalDrishti does not synthesize unverified rainfall observations.
                </p>
              </div>
            )}
          </div>

          {/* Section 2: Machine Learning Physical Forecast & Model Registry */}
          <div className="space-y-4 pt-3.5 border-t border-border">
            <div className="border-b border-border pb-2.5 flex flex-col sm:flex-row sm:items-start justify-between gap-2">
              <div>
                <h2 className="text-base font-bold text-text-main flex items-center gap-2">
                  <ActivityChartIcon className="w-4 h-4 text-primary" />
                  Station Telemetry Physical Depth Forecast (Forward-Looking)
                </h2>
                <p className="text-xs text-text-muted mt-0.5 leading-relaxed">
                  Station-autonomous Quantile Gradient Boosting predicting physical water table depth below ground level (m bgl) directly from verified high-frequency telemetry.
                  The ML model predicts physical water level depth; it does NOT predict a composite stress index.*
                </p>
              </div>
              <span className="text-[11px] font-mono text-text-muted bg-subtle px-2 py-1 shrink-0">
                Target: Depth (m bgl)
              </span>
            </div>

            {/* Geographic Station Selector & Disambiguation Notice */}
            <div className="p-3 bg-subtle border border-border space-y-2 text-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <label className="font-semibold text-text-main flex items-center gap-1.5">
                  <FilterIcon className="w-3.5 h-3.5 text-primary" />
                  <span>Telemetry Monitoring Station ({compatibleStations.length} available in {selectedBlock?.districtName || selectedState}):</span>
                </label>
                {compatibleStations.length > 0 && (
                  <select
                    value={selectedStationId}
                    onChange={(e) => setSelectedStationId(e.target.value)}
                    className="bg-surface border border-border px-2 py-1 text-xs text-text-main font-mono focus:outline-none max-w-full sm:max-w-md"
                  >
                    {compatibleStations.map((st) => (
                      <option key={st.stationId} value={st.stationId}>
                        {st.district} — {st.stationName} ({st.stationId.split('::')[2]})
                      </option>
                    ))}
                  </select>
                )}
              </div>
              <div className="text-[11px] text-text-muted leading-relaxed border-t border-border/60 pt-1.5">
                <span className="font-semibold text-text-main">Station-Level Geographic Coverage Notice: </span>
                This machine learning forecast is computed specifically for the selected monitoring piezometer/borehole. It represents point-level groundwater depth at this telemetry site. It is <strong className="text-text-main">not an aggregated block-wide spatial average</strong>. Blocks lacking verified telemetry stations do not fabricate synthetic predictions.
              </div>
            </div>

            {/* Station Forecast Content: Live 90-Day & 180-Day Horizons OR Explicit Unavailable State */}
            {isStationForecastLoading ? (
              <div className="space-y-2.5 animate-pulse p-3.5 bg-subtle/40 border border-border">
                <div className="h-4 bg-subtle w-1/3"></div>
                <div className="h-16 bg-subtle w-full"></div>
              </div>
            ) : compatibleStations.length === 0 ? (
              <div className="p-3.5 bg-subtle border border-border text-xs text-text-muted space-y-1.5">
                <div className="font-bold text-text-main flex items-center gap-1.5">
                  <InfoIcon className="w-4 h-4 text-text-muted" />
                  <span>ML Depth Forecast Unavailable for this Geography</span>
                </div>
                <p className="leading-relaxed">
                  No verified high-frequency groundwater telemetry station is registered in {selectedBlock?.districtName || selectedBlock?.name || 'this district'} ({selectedBlock?.state || selectedState}).
                  Predictions are not extrapolated to uncalibrated regions to prevent spurious spatial inference, and JalDrishti does not fall back to stale or unvalidated data when local telemetry is absent.
                </p>
                <p className="text-[11px] text-text-muted/80 italic">
                  The descriptive Groundwater Stress Score (GSS Baseline) in Section 1 continues to provide multi-signal decision support from available observed indicators.
                </p>
              </div>
            ) : (stationForecast90 || stationForecast180) ? (
              <div className="space-y-3">
                {/* Station Model Governance Strip */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs bg-subtle p-2.5 border border-border">
                  <div>
                    <span className="text-[10px] uppercase font-semibold text-text-muted block">Active Station ID</span>
                    <span className="font-bold text-text-main font-mono truncate block" title={selectedStationId}>
                      {selectedStationId.split('::')[2] || selectedStationId}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-semibold text-text-muted block">Observation Origin</span>
                    <span className="font-bold text-text-main tabular-nums">
                      {stationForecast90?.originDate || stationForecast180?.originDate || 'N/A'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-semibold text-text-muted block">Model Pipeline</span>
                    <span className="font-medium text-text-main font-mono text-[11px]">
                      {stationForecast90?.modelIdentifier || stationForecast180?.modelIdentifier || 'NWDP-Station-Experimental'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-semibold text-text-muted block">Operational Status</span>
                    <span className="font-medium text-text-muted">
                      Experimental (P10–P90 Ordered)
                    </span>
                  </div>
                </div>

                {/* Forward Forecast Quantile Horizon Table */}
                <div className="overflow-x-auto border-t border-b border-border">
                  <table className="w-full text-left text-xs border-collapse dbim-table">
                    <thead>
                      <tr className="border-b border-border bg-subtle text-text-muted font-bold text-[11px] uppercase tracking-wider">
                        <th className="py-2 px-2.5 text-left">Forecast Horizon</th>
                        <th className="py-2 px-2.5 text-right">Observation Origin</th>
                        <th className="py-2 px-2.5 text-right">Future Target Date</th>
                        <th className="py-2 px-2.5 text-right">Predicted Depth (P50)</th>
                        <th className="py-2 px-2.5 text-right">P10–P90 Uncertainty Interval</th>
                        <th className="py-2 px-2.5 text-right">Interval Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {/* 90-Day Horizon */}
                      {stationForecast90 && stationForecast90.status === 'experimental' && (
                        <tr className="hover:bg-subtle/40 transition-colors bg-primary/5 font-medium">
                          <td className="py-2.5 px-2.5">
                            <span className="font-bold text-text-main block">
                              90 Days [Quarterly Horizon]
                            </span>
                            <span className="text-[11px] font-mono text-text-muted">
                              {stationForecast90.modelIdentifier}
                            </span>
                          </td>
                          <td className="py-2.5 px-2.5 text-right tabular-nums text-text-main">
                            {stationForecast90.originDate}
                          </td>
                          <td className="py-2.5 px-2.5 text-right font-bold text-text-main tabular-nums">
                            {stationForecast90.targetDate}
                          </td>
                          <td className="py-2.5 px-2.5 text-right font-bold text-primary tabular-nums">
                            {typeof stationForecast90.prediction?.p50 === 'number'
                              ? `${stationForecast90.prediction.p50.toFixed(2)} m bgl`
                              : 'N/A'}
                          </td>
                          <td className="py-2.5 px-2.5 text-right tabular-nums text-text-main">
                            {typeof stationForecast90.prediction?.p10 === 'number' && typeof stationForecast90.prediction?.p90 === 'number'
                              ? `[${stationForecast90.prediction.p10.toFixed(2)} – ${stationForecast90.prediction.p90.toFixed(2)}] m bgl`
                              : 'Unavailable'}
                            {typeof stationForecast90.prediction?.p10 === 'number' && typeof stationForecast90.prediction?.p90 === 'number' && (
                              <span className="block text-[11px] text-text-muted">
                                Spread: {(stationForecast90.prediction.p90 - stationForecast90.prediction.p10).toFixed(2)} m
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-2.5 text-right text-text-muted text-[11px]">
                            {stationForecast90.intervalStatus || 'ordered_uncalibrated'}
                          </td>
                        </tr>
                      )}

                      {/* 180-Day Horizon */}
                      {stationForecast180 && stationForecast180.status === 'experimental' && (
                        <tr className="hover:bg-subtle/40 transition-colors">
                          <td className="py-2.5 px-2.5">
                            <span className="font-bold text-text-main block">
                              180 Days [Bi-Annual Horizon]
                            </span>
                            <span className="text-[11px] font-mono text-text-muted">
                              {stationForecast180.modelIdentifier}
                            </span>
                          </td>
                          <td className="py-2.5 px-2.5 text-right tabular-nums text-text-main">
                            {stationForecast180.originDate}
                          </td>
                          <td className="py-2.5 px-2.5 text-right font-bold text-text-main tabular-nums">
                            {stationForecast180.targetDate}
                          </td>
                          <td className="py-2.5 px-2.5 text-right font-bold text-primary tabular-nums">
                            {typeof stationForecast180.prediction?.p50 === 'number'
                              ? `${stationForecast180.prediction.p50.toFixed(2)} m bgl`
                              : 'N/A'}
                          </td>
                          <td className="py-2.5 px-2.5 text-right tabular-nums text-text-main">
                            {typeof stationForecast180.prediction?.p10 === 'number' && typeof stationForecast180.prediction?.p90 === 'number'
                              ? `[${stationForecast180.prediction.p10.toFixed(2)} – ${stationForecast180.prediction.p90.toFixed(2)}] m bgl`
                              : 'Unavailable'}
                            {typeof stationForecast180.prediction?.p10 === 'number' && typeof stationForecast180.prediction?.p90 === 'number' && (
                              <span className="block text-[11px] text-text-muted">
                                Spread: {(stationForecast180.prediction.p90 - stationForecast180.prediction.p10).toFixed(2)} m
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-2.5 text-right text-text-muted text-[11px]">
                            {stationForecast180.intervalStatus || 'ordered_uncalibrated'}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Station Model Scientific Notice */}
                <div className="p-2.5 bg-subtle border border-border text-[11px] text-text-muted space-y-1">
                  <div className="font-semibold text-text-main">Station Prediction Provenance &amp; Scientific Limitations:</div>
                  <p className="leading-relaxed">
                    Forecast generated from 6-hourly automated telemetry recorded at borehole station <span className="font-mono text-text-main">{selectedStationId}</span>.
                    Target predictions project future water table depth across verified forward dates.
                    Model interval status is <em>ordered_uncalibrated</em>; predictions reflect point measurements at this specific telemetry well and must not be used as an automated substitute for local physical well soundings or statutory emergency declarations.
                  </p>
                </div>
              </div>
            ) : (
              <div className="p-3 bg-subtle border border-border text-xs text-text-muted space-y-1.5">
                <div className="font-bold text-text-main flex items-center gap-1.5">
                  <InfoIcon className="w-4 h-4 text-text-muted" />
                  <span>Station Forecast Temporarily Unavailable</span>
                </div>
                <p className="leading-relaxed">
                  {stationForecastError || 'The selected telemetry station did not return valid calibrated quantile predictions. JalDrishti enforces fail-closed safety and does not synthesize unverified estimates.'}
                </p>
              </div>
            )}

            {/* Separated Section: Historical Research Benchmark (Legacy CGWB Archive) */}
            <div className="mt-4 pt-3.5 border-t border-border space-y-2.5">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-text-muted flex items-center gap-1.5">
                    <span>Historical Research Benchmark</span>
                    <span className="bg-subtle text-text-muted border border-border px-1.5 py-0.5 text-[10px] font-normal">
                      Retrospective Archive
                    </span>
                  </h3>
                  <p className="text-[11px] text-text-muted mt-0.5">
                    Retrospective baseline model (GlobalBlockAwareQuantileGB-v1) evaluated on historical 2023 CGWB manual records.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowHistoricalBenchmark(!showHistoricalBenchmark)}
                  className="text-xs text-primary hover:underline font-semibold cursor-pointer shrink-0"
                >
                  {showHistoricalBenchmark ? 'Hide Historical Benchmark' : 'View Historical Benchmark'}
                </button>
              </div>

              {showHistoricalBenchmark && (
                <div className="p-3 bg-subtle/50 border border-border space-y-3">
                  <div className="border-l-4 border-amber-600 bg-amber-50/80 p-2.5 text-xs text-amber-950 space-y-1">
                    <div className="font-bold tracking-wide uppercase flex items-center gap-1.5">
                      <InfoIcon className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                      <span>HISTORICAL RESEARCH BENCHMARK — NOT A CURRENT OPERATIONAL PREDICTION</span>
                    </div>
                    <p className="leading-relaxed text-[11px]">
                      This section displays the retrospective research baseline generated from historical CGWB quarterly measurements up to late 2023.
                      Model identifier: <span className="font-mono">GlobalBlockAwareQuantileGB-v1</span>.
                      Observation origin: <strong className="font-mono">{forecastData?.observationDatesRange?.latest || '2023-11-01'}</strong>.
                      This historical benchmark does NOT reflect current groundwater conditions or forward-looking telemetry.
                    </p>
                  </div>

                  {isForecastLoading ? (
                    <div className="space-y-2 animate-pulse p-2">
                      <div className="h-4 bg-subtle w-1/4"></div>
                      <div className="h-10 bg-subtle w-full"></div>
                    </div>
                  ) : forecastData && forecastData.forecasts && forecastData.forecasts.length > 0 ? (
                    <div className="space-y-2">
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs bg-subtle p-2 border border-border">
                        <div>
                          <span className="text-[10px] uppercase font-semibold text-text-muted block">Benchmark Model</span>
                          <span className="font-bold text-text-main font-mono text-[11px]">{forecastData.modelIdentifier}</span>
                        </div>
                        <div>
                          <span className="text-[10px] uppercase font-semibold text-text-muted block">Archive Origin</span>
                          <span className="font-medium text-text-main">{forecastData.observationDatesRange?.latest || '2023-11-01'}</span>
                        </div>
                        <div>
                          <span className="text-[10px] uppercase font-semibold text-text-muted block">Model Status</span>
                          <span className="font-medium text-text-main">Historical Research Prototype</span>
                        </div>
                        <div>
                          <span className="text-[10px] uppercase font-semibold text-text-muted block">Operational Use</span>
                          <span className="font-medium text-text-muted">Prohibited (Historical Only)</span>
                        </div>
                      </div>

                      <div className="overflow-x-auto border-t border-b border-border">
                        <table className="w-full text-left text-xs border-collapse dbim-table">
                          <thead>
                            <tr className="border-b border-border bg-subtle text-text-muted font-bold text-[11px] uppercase tracking-wider">
                              <th className="py-1.5 px-2 text-left">Archive Horizon</th>
                              <th className="py-1.5 px-2 text-right">Target Period</th>
                              <th className="py-1.5 px-2 text-right">Predicted Depth</th>
                              <th className="py-1.5 px-2 text-right">P10–P90 Uncertainty</th>
                              <th className="py-1.5 px-2 text-right">Baseline Depth</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border">
                            {forecastData.forecasts.map((f: ForecastPoint) => {
                              const horizonDays = f.forecastHorizonDays ?? (f.forecastHorizonMonths ? f.forecastHorizonMonths * 30 : f.horizonQuarter * 90);
                              return (
                                <tr key={f.horizonQuarter} className="hover:bg-subtle/40 transition-colors">
                                  <td className="py-2 px-2">
                                    <span className="font-semibold text-text-main block">
                                      {horizonDays} Days (Q{f.horizonQuarter})
                                    </span>
                                  </td>
                                  <td className="py-2 px-2 text-right tabular-nums text-text-main">
                                    {f.targetSeason}
                                  </td>
                                  <td className="py-2 px-2 text-right font-semibold text-primary tabular-nums">
                                    {f.expectedDepthMbgl.toFixed(2)} m bgl
                                  </td>
                                  <td className="py-2 px-2 text-right tabular-nums text-text-main">
                                    {f.uncertaintyInterval.lowerBoundP10Mbgl !== null && f.uncertaintyInterval.upperBoundP90Mbgl !== null
                                      ? `[${f.uncertaintyInterval.lowerBoundP10Mbgl.toFixed(2)} – ${f.uncertaintyInterval.upperBoundP90Mbgl.toFixed(2)}] m bgl`
                                      : 'N/A'}
                                  </td>
                                  <td className="py-2 px-2 text-right tabular-nums text-text-muted">
                                    {f.baselinePersistence?.lastObservationPersistenceMbgl !== null && f.baselinePersistence?.lastObservationPersistenceMbgl !== undefined
                                      ? `${f.baselinePersistence.lastObservationPersistenceMbgl} m bgl`
                                      : 'N/A'}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                      <p className="text-[10px] text-text-muted italic">
                        {forecastData.safeguardDisclaimer}
                      </p>
                    </div>
                  ) : (
                    <div className="py-3 text-center text-xs text-text-muted">
                      No historical benchmark series available for this block.
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Scientific Methodological Comparison Notice */}
            <div className="border-l-2 border-primary bg-subtle p-2.5 text-[11px] text-text-muted space-y-0.5">
              <span className="font-semibold text-text-main block">Distinct Targets — GSS vs. Machine Learning:</span>
              <p className="leading-relaxed">
                The Groundwater Stress Score (0–100) measures composite hydrological pressure by normalizing 4 cross-domain indicators. In contrast, the ML model predicts physical water table depth (m bgl) from historical well telemetry. The two methodologies serve complementary decision-support roles; machine learning depth forecasts do not replace or validate the composite stress score.
              </p>
            </div>

            {/* Section 2.1: Actionable Groundwater Intelligence & Drought Risk Assessment */}
            {selectedBlock && (() => {
              const intel = evaluateGroundwaterIntelligence(selectedBlock.indicators);
              return (
                <div className="p-3 bg-subtle/70 border border-border space-y-2.5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 border-b border-border pb-1.5">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-text-main text-xs uppercase tracking-wider">Groundwater Intelligence &amp; Drought Risk Assessment</span>
                      <span className={`text-[11px] font-semibold px-2 py-0.5 rounded border ${
                        intel.droughtRisk.category === 'Severe Drought Watch'
                          ? 'bg-red-50 text-red-800 border-red-300'
                          : intel.droughtRisk.category === 'Watch / Moderate Deficit'
                          ? 'bg-amber-50 text-amber-800 border-amber-300'
                          : 'bg-emerald-50 text-emerald-800 border-emerald-300'
                      }`}>
                        {intel.droughtRisk.category}
                      </span>
                    </div>
                    <span className="text-[10px] text-text-muted font-mono">
                      Rule-Based Synthesis • Scientific Transparency
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 text-xs">
                    <div className="space-y-1 p-2 bg-surface border border-border">
                      <span className="text-[10px] uppercase font-bold text-text-muted block">Meteorological Drought Category</span>
                      <div className="font-bold text-text-main">{intel.droughtRisk.category}</div>
                      <p className="text-[11px] text-text-muted leading-relaxed">{intel.droughtRisk.basis}</p>
                      <p className="text-[10px] text-text-muted/80">{intel.droughtRisk.ruleExplanation}</p>
                    </div>

                    <div className="space-y-1 p-2 bg-surface border border-border">
                      <span className="text-[10px] uppercase font-bold text-text-muted block">Water Availability &amp; Aquifer Storage</span>
                      <div className="font-bold text-text-main capitalize">Trend: {intel.waterAvailability.direction}</div>
                      <p className="text-[11px] text-text-muted leading-relaxed">
                        {intel.waterAvailability.drawdownRateMperYr !== null ? `Piezometric drawdown: ${intel.waterAvailability.drawdownRateMperYr} m/yr.` : 'Piezometric trend unverified.'}
                      </p>
                      <p className="text-[10px] text-text-muted/80">{intel.waterAvailability.storageLimitationNotice}</p>
                    </div>

                    <div className="space-y-1 p-2 bg-surface border border-border">
                      <span className="text-[10px] uppercase font-bold text-text-muted block">Recharge &amp; Anomaly Intelligence</span>
                      <div className="font-bold text-text-main capitalize">Recharge: {intel.rechargeIntelligence.rechargePotential}</div>
                      <p className="text-[11px] text-text-muted leading-relaxed">{intel.rechargeIntelligence.naturalReplenishmentSummary}</p>
                      <p className="text-[10px] text-text-muted/80">{intel.rechargeIntelligence.satelliteTwsaStatus}</p>
                    </div>
                  </div>

                  <div className="p-2.5 bg-surface border border-border rounded text-xs space-y-0.5">
                    <span className="font-semibold text-text-main flex items-center gap-1.5 text-[11px]">
                      <InfoIcon className="w-3.5 h-3.5 text-primary shrink-0" /> Actionable Interpretation &amp; Next Steps:
                    </span>
                    <p className="text-text-muted leading-relaxed text-[11px]">
                      {intel.actionableSummary} Connects with Atal Bhujal Yojana community water security planning and PMKSY watershed recharge works.
                    </p>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      </div>

      {/* Operational Safety Safeguard Section */}
      <div className="space-y-2 pt-4 border-t border-border max-w-5xl">
        <h3 className="dbim-heading-3 text-text-main">
          Operational Safety Safeguard Gate (FR-033 &amp; TRD Section 7.2)
        </h3>
        <div className="dbim-paragraph text-text-muted leading-relaxed space-y-2 text-xs sm:text-sm">
          <p>
            The Groundwater Stress Score (GSS) is a descriptive, multi-criteria index calculated from 4 environmental readings (wells, rain, satellite storage, and vegetation). It is a rule-based indicator index, not a trained ML result. It serves to identify areas requiring investigation, not as an automated authorization for financial sanctions or emergency decrees without local physical verification.
          </p>
          <p>
            This page provides two complementary evaluations: (1) an immediate Water Stress Score (0–100) based on today&apos;s environmental measurements, and (2) a machine learning forecast predicting physical well water levels (in meters below ground) for upcoming seasons.
          </p>
          <p>
            A Water Stress Score above 70 means the block is experiencing acute depletion across multiple indicators (deep wells, low rain, declining storage). A projected increase in well depth (e.g. from 12 m to 16 m) means the water table is dropping further.
          </p>
          <p>
            Comparing current stress against future projections helps water managers identify not only which blocks are suffering right now, but which will reach critical depth in the next 3 to 12 months.
          </p>
          <p>
            Observations are updated per government schedule (IMD rain: daily; CGWB wells: quarterly; Sentinel &amp; GRACE satellites: 10–30 days). The ML model is trained on historical data and provides calibrated P10–P90 uncertainty intervals.
          </p>
          <p>
            Examine the indicator breakdown to see what is driving stress (e.g. deficient monsoon vs continuous over-extraction), and use the Interventions tab to explore targeted conservation measures.
          </p>
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
