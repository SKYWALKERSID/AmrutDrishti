'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { ALL_BLOCKS } from '@/lib/data/bundelkhand';
import { RiskSeverity } from '@/lib/types';
import { useRole } from '@/lib/context/RoleContext';
import { canMutateDemoWorkflows, demoRestrictionNotice, SCORE_FIXTURE_NOTICE } from '@/lib/demo/demoPolicy';
import { ShieldCheckIcon, ActivityChartIcon, FilterIcon, InfoIcon, CheckCircleIcon } from '@/components/ui/Icons';

function RiskAssessmentContent() {
  const searchParams = useSearchParams();
  const urlBlockParam = searchParams.get('block');
  const { activeRole } = useRole();
  const [selectedBlockId, setSelectedBlockId] = useState<string>(ALL_BLOCKS[0].id);
  const [overrideReason, setOverrideReason] = useState<string>('');
  const [overrideSeverity, setOverrideSeverity] = useState<RiskSeverity>('severe');
  const [overrideApplied, setOverrideApplied] = useState<boolean>(false);

  useEffect(() => {
    if (urlBlockParam) {
      const validBlock = ALL_BLOCKS.find(b => b.id === urlBlockParam);
      if (validBlock) {
        setSelectedBlockId(validBlock.id);
      }
    }
  }, [urlBlockParam]);

  const isReadOnly = !canMutateDemoWorkflows(activeRole);
  const restrictionNotice = demoRestrictionNotice(activeRole);
  const selectedBlock = ALL_BLOCKS.find(b => b.id === selectedBlockId) || ALL_BLOCKS[0];

  const handleApplyOverride = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canMutateDemoWorkflows(activeRole)) return;
    if (!overrideReason.trim()) return;
    setOverrideApplied(true);
  };


  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-surface border border-border rounded-lg p-6 shadow-card">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="bg-[#0d5c63] text-white text-xs font-semibold px-2 py-0.5 rounded">
                Demonstration Fixtures — Not Validated
              </span>
              <span className="text-xs text-text-muted">No model implemented</span>
            </div>
            <h1 className="text-xl font-bold text-text-main mt-2">
              Groundwater Stress Score & Model Governance
            </h1>
            <p className="text-xs text-text-muted mt-1 max-w-3xl leading-relaxed">
              Demonstration fixtures with candidate indicators and a human-review note form. Scores are not computed or validated.
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
                  {ALL_BLOCKS.map(b => (
                    <option key={b.id} value={b.id}>
                      {b.name} ({b.districtName})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Score Display Card */}
            <div className="p-5 bg-subtle/50 rounded-lg border border-border text-center space-y-2">
              <div className="text-xs text-text-muted uppercase font-semibold">Demonstration Stress Score (fixture)</div>
              <div className="text-4xl font-extrabold text-[#0d5c63]">
                {selectedBlock.assessment.descriptiveStressScore} <span className="text-sm font-normal text-text-muted">/ 100</span>
              </div>
              <div className="text-xs text-text-muted">
                Confidence Interval (fixture, not statistically derived): {selectedBlock.assessment.confidenceInterval
                  ? `[${selectedBlock.assessment.confidenceInterval[0]} - ${selectedBlock.assessment.confidenceInterval[1]}]`
                  : 'unavailable'}
              </div>
              <div className="pt-2">
                <span className={`inline-block px-3 py-1 rounded text-xs font-bold ${
                  selectedBlock.riskSeverity === 'severe' ? 'badge-severe' : selectedBlock.riskSeverity === 'normal' ? 'badge-normal' : 'badge-watch'
                }`}>
                  {selectedBlock.riskSeverity.toUpperCase()} (DEMO FIXTURE CLASS)
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
                <ShieldCheckIcon className="w-4 h-4 text-[#0d5c63]" /> Human Review & Risk Override
              </h2>
              <p className="text-xs text-text-muted">
                Demo-only control. Nothing is persisted or audited. Authorized reviewers would adjust classification after physical ground inspection.
              </p>

              {overrideApplied ? (
                <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-md text-xs space-y-1">
                  <div className="font-bold flex items-center gap-1.5">
                    <CheckCircleIcon className="w-4 h-4 text-emerald-700" /> Review Note Held In Memory
                  </div>
                  <p>Status shown as {overrideSeverity.toUpperCase()} for this page session only. Held in browser memory; not saved and not an audit trail.</p>
                </div>
              ) : (
                <form onSubmit={handleApplyOverride} className="space-y-3">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-text-main">Override Severity Level:</label>
                    <select
                      value={overrideSeverity}
                      onChange={(e) => setOverrideSeverity(e.target.value as RiskSeverity)}
                      className="w-full bg-subtle border border-border rounded-md px-3 py-1.5 text-xs text-text-main focus:outline-none"
                    >
                      <option value="severe">Severe Stress</option>
                      <option value="watch">Watch Advisory</option>
                      <option value="normal">Normal Baseline</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-text-main">Review Rationale & Inspection Notes:</label>
                    <textarea
                      value={overrideReason}
                      onChange={(e) => setOverrideReason(e.target.value)}
                      placeholder="Enter ground inspection evidence or hydrogeologist report reference..."
                      rows={3}
                      className="w-full bg-subtle border border-border rounded-md p-2 text-xs text-text-main focus:outline-none"
                      required
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full bg-[#0d5c63] hover:bg-[#094348] text-white text-xs font-semibold py-2 rounded-md transition-colors"
                  >
                    Record Review Note (this session only)
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
              <ActivityChartIcon className="w-4 h-4 text-[#0d5c63]" /> Candidate Input Indicators (formula not implemented)
            </h2>

            <div className="space-y-3 text-xs">
              <div className="p-3 bg-amber-50 rounded border border-amber-200 text-[11px] text-amber-900">
                No scoring formula is implemented. The score above is a hand-entered fixture. The indicators listed below are the candidate inputs only; no weights have been established or validated.
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-center p-2.5 bg-subtle/30 rounded border border-border">
                  <div>
                    <span className="font-semibold text-text-main">CGWB Well Level (m bgl)</span>
                    <p className="text-[11px] text-text-muted">Candidate input • hard-rock aquifer depth indicator</p>
                  </div>
                  <span className="text-[10px] font-semibold text-amber-800">no weight</span>
                </div>

                <div className="flex justify-between items-center p-2.5 bg-subtle/30 rounded border border-border">
                  <div>
                    <span className="font-semibold text-text-main">IMD Monsoon Rainfall Anomaly</span>
                    <p className="text-[11px] text-text-muted">Candidate input • rainfall deficit (SPI)</p>
                  </div>
                  <span className="text-[10px] font-semibold text-amber-800">no weight</span>
                </div>

                <div className="flex justify-between items-center p-2.5 bg-subtle/30 rounded border border-border">
                  <div>
                    <span className="font-semibold text-text-main">NASA GRACE-FO TWSA Anomaly</span>
                    <p className="text-[11px] text-text-muted">Candidate input • coarse regional storage anomaly</p>
                  </div>
                  <span className="text-[10px] font-semibold text-amber-800">no weight</span>
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
            <h2 className="text-base font-bold text-text-main">Validation Status: Not Yet Performed</h2>
            <p className="text-xs text-text-muted">No validation has been carried out on these demonstration scores. Items below are open work, not completed checks.</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              {[
                ['Score computation', 'Not implemented: scores are hand-entered fixtures'],
                ['Independent well calibration', 'Not performed; no CGWB observations are loaded'],
                ['Baseline model comparison', 'Not performed'],
                ['Uncertainty estimation', 'Not performed'],
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
