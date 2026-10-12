'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { ALL_BLOCKS } from '@/lib/data/bundelkhand';
import { RiskSeverity } from '@/lib/types';
import { useRole } from '@/lib/context/RoleContext';
import { canMutateDemoWorkflows, demoRestrictionNotice } from '@/lib/demo/demoPolicy';
import { calculateDescriptiveGss } from '@/lib/services/scientificEngine';
import { ShieldCheckIcon, ActivityChartIcon, FilterIcon, InfoIcon, CheckCircleIcon } from '@/components/ui/Icons';

import { useLanguage } from '@/lib/context/LanguageContext';

function RiskAssessmentContent() {
  const { t } = useLanguage();
  const searchParams = useSearchParams();
  const urlBlockParam = searchParams.get('block');
  const { activeRole } = useRole();
  const [blocksData, setBlocksData] = useState<any[]>([]);
  const [selectedBlockId, setSelectedBlockId] = useState<string>(ALL_BLOCKS[0].id);
  const [overrideReason, setOverrideReason] = useState<string>('');
  const [overrideSeverity, setOverrideSeverity] = useState<RiskSeverity>('severe');
  const [overrideApplied, setOverrideApplied] = useState<boolean>(false);
  const [isLive, setIsLive] = useState<boolean>(false);

  useEffect(() => {
    fetch('/api/geospatial/blocks')
      .then(res => res.json())
      .then(data => {
        if (data.blocks && data.blocks.length > 0) {
          setBlocksData(data.blocks);
          setIsLive(data.source === 'live_database');
          if (!urlBlockParam) {
            setSelectedBlockId(data.blocks[0].id);
          }
        }
      })
      .catch(() => {});
  }, [urlBlockParam]);

  const displayBlocks = blocksData.length > 0 ? blocksData : ALL_BLOCKS;

  useEffect(() => {
    if (urlBlockParam) {
      const validBlock = displayBlocks.find(b => b.id === urlBlockParam);
      if (validBlock) {
        setSelectedBlockId(validBlock.id);
      }
    }
  }, [urlBlockParam, displayBlocks]);

  const isReadOnly = !canMutateDemoWorkflows(activeRole);
  const restrictionNotice = demoRestrictionNotice(activeRole);
  const selectedBlock = displayBlocks.find(b => b.id === selectedBlockId) || displayBlocks[0];

  const calculatedResult = calculateDescriptiveGss(selectedBlock.indicators);
  const effectiveSeverity = overrideApplied ? overrideSeverity : (calculatedResult.severity !== 'gap' ? calculatedResult.severity : selectedBlock.riskSeverity);

  const handleApplyOverride = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canMutateDemoWorkflows(activeRole)) return;
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
          <div className="bg-surface border border-border rounded-lg p-5 shadow-card space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-text-muted">Select Target Block:</span>
              <div className="flex items-center gap-1.5 text-xs">
                <FilterIcon className="w-3.5 h-3.5 text-text-muted" />
                <select
                  value={selectedBlockId}
                  onChange={(e) => {
                    setSelectedBlockId(e.target.value);
                    setOverrideApplied(false);
                  }}
                  className="bg-subtle border border-border rounded px-2.5 py-1 text-xs font-medium text-text-main focus:outline-none"
                >
                  {displayBlocks.map((b: any) => (
                    <option key={b.id} value={b.id}>
                      {b.name} ({b.districtName})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Score Display Card */}
            <div className="p-5 bg-subtle/50 rounded-lg border border-border text-center space-y-2">
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
                <span className={`inline-block px-3 py-1 rounded text-xs font-bold ${
                  effectiveSeverity === 'severe' ? 'badge-severe' : effectiveSeverity === 'normal' ? 'badge-normal' : 'badge-watch'
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
          </div>

          {/* Human Override Controls */}
          {restrictionNotice && (
            <div role="note" className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-xs text-amber-900">{restrictionNotice}</div>
          )}
          {!isReadOnly && (
            <div className="bg-surface border border-border rounded-lg p-5 shadow-card space-y-4">
              <h2 className="text-sm font-bold text-text-main flex items-center gap-2">
                <ShieldCheckIcon className="w-4 h-4 text-[#0d5c63]" /> {t('risk.humanOverrideTitle', 'Human Review & Risk Override')}
              </h2>
              <p className="text-xs text-text-muted">
                {t('risk.overrideSubtitle', 'Demo-only control. Nothing is persisted or audited. Authorized reviewers would adjust classification after physical ground inspection.')}
              </p>

              {overrideApplied ? (
                <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-md text-xs space-y-1">
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
                      className="w-full bg-subtle border border-border rounded-md px-3 py-1.5 text-xs text-text-main focus:outline-none"
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
                      className="w-full bg-subtle border border-border rounded-md p-2 text-xs text-text-main focus:outline-none"
                      required
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full bg-[#0d5c63] hover:bg-[#094348] text-white text-xs font-semibold py-2 rounded-md transition-colors"
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
          <div className="bg-surface border border-border rounded-lg p-6 shadow-card space-y-4">
            <h2 className="text-base font-bold text-text-main flex items-center gap-2">
              <ActivityChartIcon className="w-4 h-4 text-[#0d5c63]" /> Calculated Multi-Criteria Breakdown
            </h2>

            <div className="space-y-3 text-xs">
              <div className="p-3 bg-blue-50 rounded border border-blue-200 text-[11px] text-blue-950 leading-relaxed">
                This score is calculated live by combining 4 environmental signals into a weighted 0–100 index. It provides a descriptive estimate of water pressure based on current readings. It is an index, not a ground-measured well depth.
              </div>

              <div className="space-y-2">
                {/* 1. CGWB Well Depth */}
                <div className="flex justify-between items-center p-2.5 bg-subtle/30 rounded border border-border">
                  <div>
                    <span className="font-semibold text-text-main">CGWB Well Water Depth</span>
                    <p className="text-[11px] text-text-muted">
                      Current: {selectedBlock.indicators.cgwbWellDepthMbgl !== null ? `${selectedBlock.indicators.cgwbWellDepthMbgl} m below ground` : 'Missing data'} • Stress level: {calculatedResult.normalizationBreakdown.wellDepthNorm !== null ? `${Math.round(calculatedResult.normalizationBreakdown.wellDepthNorm * 100)}%` : 'N/A'}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="font-bold text-[#0d5c63]">35%</span>
                    <span className="block text-[10px] text-text-muted">Base Weight</span>
                  </div>
                </div>

                {/* 2. Rainfall Deficit */}
                <div className="flex justify-between items-center p-2.5 bg-subtle/30 rounded border border-border">
                  <div>
                    <span className="font-semibold text-text-main">Monsoon Rainfall Deficit</span>
                    <p className="text-[11px] text-text-muted">
                      Current: {selectedBlock.indicators.rainfallAnomalyMm !== null ? `${selectedBlock.indicators.rainfallAnomalyMm} mm vs normal` : 'Missing data'} • Stress level: {calculatedResult.normalizationBreakdown.rainDeficitNorm !== null ? `${Math.round(calculatedResult.normalizationBreakdown.rainDeficitNorm * 100)}%` : 'N/A'}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="font-bold text-[#0d5c63]">30%</span>
                    <span className="block text-[10px] text-text-muted">Base Weight</span>
                  </div>
                </div>

                {/* 3. GRACE TWSA */}
                <div className="flex justify-between items-center p-2.5 bg-subtle/30 rounded border border-border">
                  <div>
                    <span className="font-semibold text-text-main">Satellite Water Storage (GRACE-FO)</span>
                    <p className="text-[11px] text-text-muted">
                      Current: {selectedBlock.indicators.graceTwsaCm !== null ? `${selectedBlock.indicators.graceTwsaCm} cm regional anomaly` : 'Missing data'} • Stress level: {calculatedResult.normalizationBreakdown.graceTwsaNorm !== null ? `${Math.round(calculatedResult.normalizationBreakdown.graceTwsaNorm * 100)}%` : 'N/A'}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="font-bold text-[#0d5c63]">20%</span>
                    <span className="block text-[10px] text-text-muted">Base Weight</span>
                  </div>
                </div>

                {/* 4. Sentinel NDVI */}
                <div className="flex justify-between items-center p-2.5 bg-subtle/30 rounded border border-border">
                  <div>
                    <span className="font-semibold text-text-main">Plant Health / Crop Greenness (NDVI)</span>
                    <p className="text-[11px] text-text-muted">
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
          </div>

          {/* Validation & Operational Status */}
          <div className="bg-surface border border-border rounded-lg p-6 shadow-card space-y-4">
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
                <div key={title} className="flex items-start gap-2 p-2.5 bg-subtle/50 border border-border rounded text-text-main">
                  <InfoIcon className="w-4 h-4 text-[#0d5c63] shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold">{title}</span>
                    <p className="text-[11px] text-text-muted mt-0.5">{note}</p>
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
