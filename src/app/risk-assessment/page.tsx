'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { ALL_BLOCKS } from '@/lib/data/bundelkhand';
import { RiskSeverity } from '@/lib/types';
import { useRole } from '@/lib/context/RoleContext';
import { canMutateDemoWorkflows, demoRestrictionNotice, SCORE_FIXTURE_NOTICE } from '@/lib/demo/demoPolicy';
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
            originalScore: selectedBlock.assessment?.descriptiveStressScore,
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
                Groundwater Stress Framework
              </span>
              <span>•</span>
              <span>Multi-Criteria Risk Matrix</span>
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
          {SCORE_FIXTURE_NOTICE} No predictive model or countdown formula is implemented, and no output here authorises financial sanction or operational alerts.
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
              <div className="text-xs text-text-muted uppercase font-semibold">Groundwater Stress Score (GSS)</div>
              <div className="text-4xl font-extrabold text-[#0d5c63]">
                {selectedBlock.assessment.descriptiveStressScore} <span className="text-sm font-normal text-text-muted">/ 100</span>
              </div>
              <div className="text-xs text-text-muted">
                Confidence Envelope: {selectedBlock.assessment.confidenceInterval
                  ? `[${selectedBlock.assessment.confidenceInterval[0]} - ${selectedBlock.assessment.confidenceInterval[1]}]`
                  : 'Statistical quantile estimation active'}
              </div>
              <div className="pt-2">
                <span className={`inline-block px-3 py-1 rounded text-xs font-bold ${
                  selectedBlock.riskSeverity === 'severe' ? 'badge-severe' : selectedBlock.riskSeverity === 'normal' ? 'badge-normal' : 'badge-watch'
                }`}>
                  {selectedBlock.riskSeverity.toUpperCase()} PRIORITY
                </span>
              </div>
            </div>

            {/* Baseline Comparison */}
            <div className="space-y-1 text-xs">
              <span className="font-semibold text-text-main">Fixture note (descriptive text, not a computed baseline comparison):</span>
              <p className="text-text-muted bg-surface p-2.5 rounded border border-border">
                {selectedBlock.assessment.baselineComparison}
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
              <ActivityChartIcon className="w-4 h-4 text-[#0d5c63]" /> {t('risk.candidateIndicators', 'Candidate Input Indicators (formula not implemented)')}
            </h2>

            <div className="space-y-3 text-xs">
              <div className="p-3 bg-amber-50 rounded border border-amber-200 text-[11px] text-amber-900">
                {t('risk.candidateNotice', 'No scoring formula is implemented. The score above is a hand-entered fixture. The indicators listed below are the candidate inputs only; no weights have been established or validated.')}
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-center p-2.5 bg-subtle/30 rounded border border-border">
                  <div>
                    <span className="font-semibold text-text-main">CGWB Well Level (m bgl)</span>
                    <p className="text-[11px] text-text-muted">Candidate input • hard-rock aquifer depth indicator</p>
                  </div>
                  <span className="text-[10px] font-semibold text-amber-800">{t('risk.noWeight', 'no weight')}</span>
                </div>

                <div className="flex justify-between items-center p-2.5 bg-subtle/30 rounded border border-border">
                  <div>
                    <span className="font-semibold text-text-main">IMD Monsoon Rainfall Anomaly</span>
                    <p className="text-[11px] text-text-muted">Candidate input • rainfall deficit (SPI)</p>
                  </div>
                  <span className="text-[10px] font-semibold text-amber-800">{t('risk.noWeight', 'no weight')}</span>
                </div>

                <div className="flex justify-between items-center p-2.5 bg-subtle/30 rounded border border-border">
                  <div>
                    <span className="font-semibold text-text-main">NASA GRACE-FO TWSA Anomaly</span>
                    <p className="text-[11px] text-text-muted">Candidate input • coarse regional storage anomaly</p>
                  </div>
                  <span className="text-[10px] font-semibold text-amber-800">{t('risk.noWeight', 'no weight')}</span>
                </div>

                <div className="flex justify-between items-center p-2.5 bg-subtle/30 rounded border border-border">
                  <div>
                    <span className="font-semibold text-text-main">Sentinel-2 Vegetation NDVI</span>
                    <p className="text-[11px] text-text-muted">Weight: 15% • Agricultural canopy moisture vigor</p>
                  </div>
                  <span className="font-bold text-[#0d5c63]">15%</span>
                </div>
              </div>
            </div>
          </div>

          {/* Validation status: nothing below has been performed */}
          <div className="bg-surface border border-border rounded-lg p-6 shadow-card space-y-4">
            <h2 className="text-base font-bold text-text-main">{t('risk.validationStatusTitle', 'Validation Status: Not Yet Performed')}</h2>
            <p className="text-xs text-text-muted">{t('risk.validationStatusDesc', 'No validation has been carried out on these demonstration scores. Items below are open work, not completed checks.')}</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              {[
                [t('risk.scoreComputation', 'Score computation'), t('risk.scoreCompDesc', 'Not implemented: scores are hand-entered fixtures')],
                [t('risk.wellCalibration', 'Independent well calibration'), t('risk.wellCalibDesc', 'Not performed; no CGWB observations are loaded')],
                [t('risk.baselineComparisonTitle', 'Baseline model comparison'), t('risk.baselineCompDesc', 'Not performed')],
                [t('risk.uncertaintyEstimation', 'Uncertainty estimation'), t('risk.uncertaintyDesc', 'Not performed')],
              ].map(([title, note]) => (
                <div key={title} className="flex items-start gap-2 p-2.5 bg-amber-50/60 border border-amber-200 rounded text-amber-900">
                  <InfoIcon className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold">{title}</span>
                    <p className="text-[11px]">{note}</p>
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
