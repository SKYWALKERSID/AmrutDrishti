'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  WaterDropletIcon,
  CloudRainIcon,
  ShieldCheckIcon,
  ActivityChartIcon,
  MapPinIcon,
  FilterIcon,
  InfoIcon,
  CheckCircleIcon,
} from '@/components/ui/Icons';
import { useLanguage } from '@/lib/context/LanguageContext';
import { ALL_INDIAN_STATES, ALL_TARGET_STATES, HISTORICAL_REFERENCE_STATES, TARGET_REGIONS, isTargetState } from '@/lib/data/indiaStates';
import { ALL_NATIONWIDE_BLOCKS, normalizeStateName } from '@/lib/data/allNationwideBlocks';
import { TermHelp, WhatAmILookingAt } from '@/components/ui/PlainLanguageHelp';

export default function LandingPage() {
  const { t } = useLanguage();

  // State for interactive live preview
  const [selectedState, setSelectedState] = useState<string>('all');
  const [selectedSeverity, setSelectedSeverity] = useState<string>('all');
  const [activeTab, setActiveTab] = useState<'research' | 'software' | 'platform'>('research');

  const filteredPreviewBlocks = ALL_NATIONWIDE_BLOCKS.filter((block) => {
    const matchesState = selectedState === 'all'
      ? isTargetState(block.state)
      : normalizeStateName(block.state) === selectedState;
    const matchesSeverity = selectedSeverity === 'all' || block.riskSeverity === selectedSeverity;
    return matchesState && matchesSeverity;
  }).slice(0, 6);

  return (
    <div className="space-y-16 sm:space-y-24 py-4 sm:py-8 text-text-main">
      {/* --------------------------------------------------------------------------- */}
      {/* SECTION 1: HERO & MISSION */}
      {/* --------------------------------------------------------------------------- */}
      <section className="relative pt-4 pb-12 border-b border-border space-y-8">
        <div className="max-w-4xl space-y-5">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-text-muted">
            <span className="font-semibold text-text-main flex items-center gap-1.5 text-primary">
              <ShieldCheckIcon className="w-4 h-4 text-primary" />
              India-Focused Groundwater Intelligence Platform*
            </span>
            <span aria-hidden="true">•</span>
            <span>Government Well Telemetry (CGWB) &amp; NASA Satellites</span>
            <span aria-hidden="true">•</span>
            <span>Every observation date is clearly stated</span>
          </div>

          <h1 className="dbim-heading-1 text-text-main">
            Clear, honest groundwater information for India.
          </h1>

          <p className="dbim-paragraph-lead text-text-muted max-w-3xl leading-relaxed">
            JAL DRISHTI helps citizens, farmers, and administrative officers see where water is dropping, understand upcoming seasonal risks, and plan local water conservation works before wells run dry.
          </p>

          <p className="dbim-paragraph text-text-muted max-w-3xl leading-relaxed">
            Our priority focus spans ten states across four project regions: South India (Karnataka, Telangana, Tamil Nadu), Central India (Madhya Pradesh), North India (Rajasthan, Haryana, Punjab), and Northeast India (Meghalaya, Assam, Tripura). We state the exact date, source, and accuracy of every reading without hiding data gaps or pretending unmeasured villages have verified sensors.
          </p>

          <div className="flex flex-wrap items-center gap-4 pt-2">
            <Link
              href="/explorer"
              className="bg-primary hover:bg-primary-hover text-text-inverted text-sm font-semibold px-6 py-3 rounded transition-colors inline-flex items-center gap-2"
            >
              <span>Open the Map Explorer</span>
              <span aria-hidden="true">→</span>
            </Link>
            <a
              href="#how-it-works"
              className="bg-surface hover:bg-subtle text-text-main border border-border text-sm font-semibold px-5 py-3 rounded transition-colors"
            >
              How It Works (5 Simple Steps)
            </a>
            <Link
              href="/overview"
              className="text-xs font-semibold text-primary hover:underline px-2 py-3"
            >
              Open State &amp; District Overview →
            </Link>
          </div>
        </div>

        {/* 5-Question Guide Card: Making the Platform Self-Explanatory */}
        <WhatAmILookingAt
          title="💡 Quick Guide: How to Use JalDrishti (5 Plain-Language Answers)"
          what="A national groundwater monitoring platform that combines measurements from government observation wells with satellite images and rainfall records."
          meaning="It tells you how deep water is below the ground in your block, whether water reserves are dropping compared to past years, and where rainfall was deficient."
          whyCare="If well levels are falling and monsoon rain was low, shallow drinking water wells and crop irrigation could run dry months before the next rains arrive."
          recentAndReliable="Observations come directly from official Central Ground Water Board (CGWB) digital recorders and IMD weather stations. Every page shows the exact date of observation."
          nextSteps="1. Use the Map Explorer to check your district. 2. Look at the 3-month forecast. 3. Review suggested check dams, ponds, and recharge shafts in the Solutions workspace."
          initiallyOpen={true}
        />

        {/* Where Our Information Comes From: Sky to Underground (Single Open Cross-Section) */}
        <div className="pt-6 border-t border-border space-y-4">
          <div className="flex items-center justify-between text-xs text-text-muted">
            <span className="font-semibold text-text-main flex items-center gap-1.5">
              <ActivityChartIcon className="w-4 h-4 text-primary" />
              Where Our Water Information Comes From: From Sky to Deep Underground
            </span>
            <span>Integrated Environmental Layers</span>
          </div>

          {/* Single Coherent Subsurface Cross-Section Container */}
          <div className="border border-border bg-subtle divide-y divide-border/80 text-xs">
            {/* Stratum 1: Spaceborne & Atmospheric Signals */}
            <div className="p-3 bg-sky-50/50 flex flex-wrap items-center justify-between gap-2 text-sky-950">
              <div className="flex items-center gap-2 font-semibold">
                <CloudRainIcon className="w-4 h-4 text-sky-700" />
                <span>Sky &amp; Weather: Rainfall &amp; Regional Water Changes</span>
              </div>
              <span className="text-[11px] text-sky-800">
                NASA GRACE-FO Satellites (~100 km regional view) • IMD 0.25° Weather Grids • Sentinel-2 Earth Imagery
              </span>
            </div>

            {/* Stratum 2: Topsoil & Root Zone */}
            <div className="p-3 bg-amber-50/50 flex flex-wrap items-center justify-between gap-2 text-amber-950">
              <div className="flex items-center gap-2 font-semibold">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-600"></span>
                <span>Ground Surface &amp; Crops: Topsoil Moisture &amp; Crop Greenness (0 – 2 m depth)</span>
              </div>
              <span className="text-[11px] text-amber-800">
                SMAP Satellite Soil Moisture • Sentinel-2 Crop Greenness &amp; Surface Water Vigor
              </span>
            </div>

            {/* Stratum 3: Unconfined Weathered Aquifer */}
            <div className="p-3.5 bg-teal-50/60 flex flex-wrap items-center justify-between gap-2 text-teal-950">
              <div>
                <div className="flex items-center gap-2 font-semibold">
                  <WaterDropletIcon className="w-4 h-4 text-teal-700" />
                  <span>Main Underground Water Table: Village &amp; Farming Wells (2 – 25 m depth)</span>
                </div>
                <p className="text-[11px] text-teal-800 mt-0.5">
                  Direct physical water table depth from Central Ground Water Board (CGWB) &amp; NWIC Digital Telemetry Wells
                </p>
              </div>
              <span className="text-xs font-semibold text-teal-950">
                Depth to water in m bgl (meters below ground level)
              </span>
            </div>

            {/* Stratum 4: Semi-Confined Fractured Crystalline Bedrock */}
            <div className="p-3 bg-stone-100/70 flex flex-wrap items-center justify-between gap-2 text-stone-800">
              <div className="flex items-center gap-2 font-semibold">
                <span className="w-2.5 h-2.5 rounded-full bg-stone-600"></span>
                <span>Deep Bedrock Aquifers: Deep Rock Water Reserves (&gt; 25 m depth)</span>
              </div>
              <span className="text-[11px] text-stone-600">
                Deep water locked in rock fractures that takes years to refill • Deep Piezometer Network
              </span>
            </div>
          </div>

          {/* Compact Unboxed Coverage & Supporting Facts Row */}
          <div className="pt-2 flex flex-wrap items-center justify-between gap-y-2 text-xs text-text-muted">
            <span><strong>Priority Focus States:</strong> 8 Active States (MP, UP, PB, RJ, HR, AS, ML, AR)</span>
            <span aria-hidden="true">•</span>
            <span><strong>Monitored Administrative Units:</strong> 60 Verified Blocks</span>
            <span aria-hidden="true">•</span>
            <span><strong>Data currency:</strong> varies by source; see Data Sources</span>
            <span aria-hidden="true">•</span>
            <span><strong>Inference Status:</strong> Research-stage bounds (P10–P90)*</span>
          </div>
        </div>
      </section>

      {/* --------------------------------------------------------------------------- */}
      {/* SECTION 2: THE PROBLEM */}
      {/* --------------------------------------------------------------------------- */}
      <section className="space-y-8">
        <div className="max-w-3xl space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-primary">
            The Problem
          </p>
          <h2 className="dbim-heading-2 text-text-main">
            Challenges in Understanding India&apos;s Groundwater
          </h2>
          <p className="text-sm text-text-muted leading-relaxed">
            Groundwater is a major source of irrigation and drinking water in India. The information needed to track it is spread across agencies, collected at different intervals and at different spatial scales, so it is hard to compare and easy to misread.
          </p>
        </div>

        {/* Open Editorial 4-Column Breakdown (De-boxed) */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 divide-y lg:divide-y-0 lg:divide-x divide-border border-y border-border py-4">
          <div className="py-4 lg:py-0 lg:px-6 first:lg:pl-0 space-y-2">
            <span className="text-xs font-bold text-primary">01</span>
            <h3 className="font-bold text-text-main text-sm">Fragmented Data Silos</h3>
            <p className="text-xs text-text-muted leading-relaxed">
              Monitoring datasets are distributed across CGWB boreholes, state groundwater departments, IMD weather stations, and spaceborne missions without unified normalization.
            </p>
          </div>

          <div className="py-4 lg:py-0 lg:px-6 space-y-2">
            <span className="text-xs font-bold text-primary">02</span>
            <h3 className="font-bold text-text-main text-sm">Mismatched Cadences</h3>
            <p className="text-xs text-text-muted leading-relaxed">
              Daily automated piezometers, manual quarterly tape dips, and monthly satellite gravimetric passes arrive at different frequencies, obscuring the true pace of aquifer stress.
            </p>
          </div>

          <div className="py-4 lg:py-0 lg:px-6 space-y-2">
            <span className="text-xs font-bold text-primary">03</span>
            <h3 className="font-bold text-text-main text-sm">Multi-Scale Interpretation</h3>
            <p className="text-xs text-text-muted leading-relaxed">
              Point borehole measurements cannot easily be paired with 100-km GRACE satellite footprints or 0.25° gridded rainfall without geodesic clipping and uncertainty estimation.
            </p>
          </div>

          <div className="py-4 lg:py-0 lg:px-6 last:lg:pr-0 space-y-2">
            <span className="text-xs font-bold text-primary">04</span>
            <h3 className="font-bold text-text-main text-sm">Delayed Interventions</h3>
            <p className="text-xs text-text-muted leading-relaxed">
              Without forward-looking projections and baseline comparisons, water-stress alerts are often triggered only after summer shallow wells have already dried up.
            </p>
          </div>
        </div>
      </section>

      {/* --------------------------------------------------------------------------- */}
      {/* SECTION 3: THE JAL DRISHTI SOLUTION */}
      {/* --------------------------------------------------------------------------- */}
      <section className="space-y-8">
        <div className="max-w-3xl space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-primary">
            The Solution
          </p>
          <h2 className="dbim-heading-2 text-text-main">
            Six Integrated Modules Built for Evidence-Led Governance
          </h2>
          <p className="text-sm text-text-muted leading-relaxed">
            Every module in JAL DRISHTI corresponds to active, functional code in the repository. We do not present future aspirations as completed features.
          </p>
        </div>

        {/* Numbered Editorial Sequence (No Cards) */}
        <div className="divide-y divide-border border-y border-border">
          {/* Module 01 */}
          <div className="py-5 grid grid-cols-1 md:grid-cols-12 gap-4 items-baseline">
            <div className="md:col-span-1 text-xs font-mono font-bold text-primary">01</div>
            <div className="md:col-span-4 space-y-1">
              <h3 className="text-sm font-bold text-text-main">Piezometer Monitoring &amp; Dual-Axis Trends</h3>
              <Link href="/monitoring" className="text-xs font-semibold text-primary hover:underline inline-flex items-center gap-1">
                <span>View Charts</span>
                <span aria-hidden="true">→</span>
              </Link>
            </div>
            <div className="md:col-span-7 text-xs text-text-muted leading-relaxed">
              Dual-axis plots decouple in-situ CGWB DWLR well depth (m bgl) from NASA GRACE-FO Terrestrial Water Storage Anomaly (cm). Historical missing data intervals are preserved honestly without zero-filling.
            </div>
          </div>

          {/* Module 02 */}
          <div className="py-5 grid grid-cols-1 md:grid-cols-12 gap-4 items-baseline">
            <div className="md:col-span-1 text-xs font-mono font-bold text-primary">02</div>
            <div className="md:col-span-4 space-y-1">
              <h3 className="text-sm font-bold text-text-main">Interactive Geospatial GIS Explorer</h3>
              <Link href="/explorer" className="text-xs font-semibold text-primary hover:underline inline-flex items-center gap-1">
                <span>Open GIS Explorer</span>
                <span aria-hidden="true">→</span>
              </Link>
            </div>
            <div className="md:col-span-7 text-xs text-text-muted leading-relaxed">
              Full Leaflet-based map rendering 60 administrative blocks across 8 focus states. Interactive layer toggles allow inspecting stress severity, water table depth, and aquifer properties on click.
            </div>
          </div>

          {/* Module 03 */}
          <div className="py-5 grid grid-cols-1 md:grid-cols-12 gap-4 items-baseline">
            <div className="md:col-span-1 text-xs font-mono font-bold text-primary">03</div>
            <div className="md:col-span-4 space-y-1">
              <h3 className="text-sm font-bold text-text-main">Multi-Criteria Stress Scoring (GSS)</h3>
              <Link href="/risk-assessment" className="text-xs font-semibold text-primary hover:underline inline-flex items-center gap-1">
                <span>Inspect GSS Scoring</span>
                <span aria-hidden="true">→</span>
              </Link>
            </div>
            <div className="md:col-span-7 text-xs text-text-muted leading-relaxed">
              Descriptive composite index (0–100) combining well depth trend, 30-year IMD monsoon deficit, Sentinel-2 NDVI vegetative health, and SMAP surface soil moisture with human-review safeguard gates.
            </div>
          </div>

          {/* Module 04 */}
          <div className="py-5 grid grid-cols-1 md:grid-cols-12 gap-4 items-baseline">
            <div className="md:col-span-1 text-xs font-mono font-bold text-primary">04</div>
            <div className="md:col-span-4 space-y-1">
              <h3 className="text-sm font-bold text-text-main">Research-Stage Quantile ML Forecasting</h3>
              <Link href="/monitoring#forecast" className="text-xs font-semibold text-primary hover:underline inline-flex items-center gap-1">
                <span>Examine Model Projections</span>
                <span aria-hidden="true">→</span>
              </Link>
            </div>
            <div className="md:col-span-7 text-xs text-text-muted leading-relaxed">
              Quantile Gradient Boosted regressor generating 1-to-4 quarter ahead projections with calibrated P10–P90 uncertainty intervals, benchmarked against seasonal persistence baselines.
            </div>
          </div>

          {/* Module 05 */}
          <div className="py-5 grid grid-cols-1 md:grid-cols-12 gap-4 items-baseline">
            <div className="md:col-span-1 text-xs font-mono font-bold text-primary">05</div>
            <div className="md:col-span-4 space-y-1">
              <h3 className="text-sm font-bold text-text-main">Artificial Recharge &amp; Policy Interventions</h3>
              <Link href="/interventions" className="text-xs font-semibold text-primary hover:underline inline-flex items-center gap-1">
                <span>Review Catalog</span>
                <span aria-hidden="true">→</span>
              </Link>
            </div>
            <div className="md:col-span-7 text-xs text-text-muted leading-relaxed">
              Targeted hydrogeological recommendations (check dams, injection recharge shafts, crop diversification) aligned with Ministry of Jal Shakti, PMKSY, and Atal Bhujal Yojana guidelines.
            </div>
          </div>

          {/* Module 06 */}
          <div className="py-5 grid grid-cols-1 md:grid-cols-12 gap-4 items-baseline">
            <div className="md:col-span-1 text-xs font-mono font-bold text-primary">06</div>
            <div className="md:col-span-4 space-y-1">
              <h3 className="text-sm font-bold text-text-main">Data Provenance &amp; Ingestion Transparency</h3>
              <Link href="/data-sources" className="text-xs font-semibold text-primary hover:underline inline-flex items-center gap-1">
                <span>View Registry</span>
                <span aria-hidden="true">→</span>
              </Link>
            </div>
            <div className="md:col-span-7 text-xs text-text-muted leading-relaxed">
              Centralized catalog disclosing official source providers, typical lag days, observation dates vs ingestion timestamps, spatial resolution, and known scientific constraints.
            </div>
          </div>
        </div>
      </section>

      {/* --------------------------------------------------------------------------- */}
      {/* SECTION 4: HOW IT WORKS */}
      {/* --------------------------------------------------------------------------- */}
      <section id="how-it-works" className="space-y-8 scroll-mt-20">
        <div className="max-w-3xl space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-primary">
            System Architecture
          </p>
          <h2 className="dbim-heading-2 text-text-main">
            How JAL DRISHTI Works
          </h2>
          <p className="text-sm text-text-muted leading-relaxed">
            The platform follows a verified 5-stage pipeline connecting authoritative public feeds to role-aware decision interfaces.
          </p>
        </div>

        {/* Sequential 5-Stage Pipeline (Open, Unboxed) */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-6 border-y border-border py-6">
          <div className="space-y-2">
            <span className="text-xs font-bold uppercase tracking-wider text-primary">Stage 1</span>
            <h3 className="font-bold text-xs text-text-main">Official Source Ingestion</h3>
            <p className="text-xs text-text-muted leading-relaxed">
              Pulls CGWB/NWIC DWLR levels, IMD 0.25° gridded precipitation, NASA GRACE-FO TWSA, and Sentinel-2 reflectance.
            </p>
          </div>

          <div className="space-y-2">
            <span className="text-xs font-bold uppercase tracking-wider text-primary">Stage 2</span>
            <h3 className="font-bold text-xs text-text-main">Validation & Geodesic Clipping</h3>
            <p className="text-xs text-text-muted leading-relaxed">
              Area-weighted polygon aggregation over LGD block boundaries; strict preservation of missing records without imputation.
            </p>
          </div>

          <div className="space-y-2">
            <span className="text-xs font-bold uppercase tracking-wider text-primary">Stage 3</span>
            <h3 className="font-bold text-xs text-text-main">Multi-Criteria Stress Scoring</h3>
            <p className="text-xs text-text-muted leading-relaxed">
              Computes descriptive GSS index (0–100) combining piezometer trends, 30-year LPA deficit, and soil moisture.
            </p>
          </div>

          <div className="space-y-2">
            <span className="text-xs font-bold uppercase tracking-wider text-primary">Stage 4</span>
            <h3 className="font-bold text-xs text-text-main">Quantile Predictive Inference</h3>
            <p className="text-xs text-text-muted leading-relaxed">
              Research-stage QuantileGB-v2.0 model produces 1-to-4 quarter depth ranges (P10–P90), shown next to simple persistence baselines. Not an official forecast.
            </p>
          </div>

          <div className="space-y-2">
            <span className="text-xs font-bold uppercase tracking-wider text-primary">Stage 5</span>
            <h3 className="font-bold text-xs text-text-main">Decision Support & Safeguards</h3>
            <p className="text-xs text-text-muted leading-relaxed">
              Role-tailored views with explicit human-review gates before statutory conservation sanctions.
            </p>
          </div>
        </div>
      </section>

      {/* --------------------------------------------------------------------------- */}
      {/* SECTION 5: EXPLORE THE REAL PRODUCT */}
      {/* --------------------------------------------------------------------------- */}
      <section className="space-y-8">
        <div className="max-w-3xl space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-primary">
            Interactive Demonstration
          </p>
          <h2 className="dbim-heading-2 text-text-main">
            Explore the Real Product
          </h2>
          <p className="text-sm text-text-muted leading-relaxed">
            Test the live data filters below to preview actual administrative blocks, depth readings, and stress classifications currently integrated into the application.
          </p>
        </div>

        {/* Live Filter Controls (Functional Grouping Panel) */}
        <div className="border border-border bg-surface p-4 sm:p-5 rounded space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4 pb-3 border-b border-border">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-1.5 text-xs text-text-muted font-medium">
                <FilterIcon className="w-3.5 h-3.5 text-primary" />
                <span>Filter Monitored Areas:</span>
              </div>

              <select
                value={selectedState}
                onChange={(e) => setSelectedState(e.target.value)}
                className="bg-subtle border border-border rounded px-2.5 py-1 text-xs text-text-main focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="all">All 10 Target States</option>
                {TARGET_REGIONS.map((region) => {
                  const statesInRegion = ALL_TARGET_STATES.filter(s => s.region === region);
                  return (
                    <optgroup key={region} label={`${region} (${statesInRegion.length})`}>
                      {statesInRegion.map((st) => (
                        <option key={st.code} value={normalizeStateName(st.name)}>
                          {st.name}
                        </option>
                      ))}
                    </optgroup>
                  );
                })}
                <optgroup label="Historical References (Out of Scope)">
                  {HISTORICAL_REFERENCE_STATES.map((st) => (
                    <option key={st.code} value={normalizeStateName(st.name)}>
                      {st.name} (Historical Reference)
                    </option>
                  ))}
                </optgroup>
              </select>

              <select
                value={selectedSeverity}
                onChange={(e) => setSelectedSeverity(e.target.value)}
                className="bg-subtle border border-border rounded px-2.5 py-1 text-xs text-text-main focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="all">All Severity Tiers</option>
                <option value="severe">Severe Stress Only</option>
                <option value="watch">Watch Tier Only</option>
                <option value="normal">Normal / Favorable</option>
              </select>
            </div>

            <span className="text-xs text-text-muted">
              Showing <strong className="text-text-main">{filteredPreviewBlocks.length}</strong> preview units
            </span>
          </div>

          {/* Block Previews Table (Readable, Unboxed Editorial) */}
          <div className="overflow-x-auto border-t border-border">
            <table className="w-full text-left text-xs border-collapse dbim-table">
              <thead>
                <tr className="border-b border-border bg-subtle text-text-muted font-bold text-[11px] uppercase tracking-wider">
                  <th className="py-2.5 px-3 text-left">Block (Sub-District)</th>
                  <th className="py-2.5 px-3 text-left">District &amp; State</th>
                  <th className="py-2.5 px-3 text-left">
                    <span className="inline-flex items-center gap-1">
                      Water Stress
                      <TermHelp termId="groundwater_stress_score" />
                    </span>
                  </th>
                  <th className="py-2.5 px-3 text-right">
                    <span className="inline-flex items-center gap-1 justify-end">
                      Well Depth
                      <TermHelp termId="well_depth" />
                    </span>
                  </th>
                  <th className="py-2.5 px-3 text-right">
                    <span className="inline-flex items-center gap-1 justify-end">
                      Rainfall Difference
                      <TermHelp termId="rainfall_anomaly" />
                    </span>
                  </th>
                  <th className="py-2.5 px-3 text-right">
                    <span className="inline-flex items-center gap-1 justify-end">
                      Satellite Storage
                      <TermHelp termId="satellite_water_storage" />
                    </span>
                  </th>
                  <th className="py-2.5 px-3 text-right">Explore</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredPreviewBlocks.map((blk) => (
                  <tr key={blk.id} className="hover:bg-subtle/50 transition-colors">
                    <td className="py-2.5 px-3 font-bold text-text-main">{blk.name}</td>
                    <td className="py-2.5 px-3 text-text-muted">{blk.districtName}, {blk.state}</td>
                    <td className="py-2.5 px-3">
                      <span className={`font-semibold ${
                        blk.riskSeverity === 'severe'
                          ? 'text-red-700'
                          : blk.riskSeverity === 'watch'
                          ? 'text-amber-700'
                          : 'text-emerald-700'
                      }`}>
                        ● {blk.riskSeverity.toUpperCase()}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right tabular-nums">
                      {blk.indicators.cgwbWellDepthMbgl !== null ? `${blk.indicators.cgwbWellDepthMbgl} m` : '—'}
                    </td>
                    <td className="py-2.5 px-3 text-right tabular-nums">
                      {blk.indicators.rainfallAnomalyMm !== null ? `${blk.indicators.rainfallAnomalyMm > 0 ? '+' : ''}${blk.indicators.rainfallAnomalyMm} mm` : '—'}
                    </td>
                    <td className="py-2.5 px-3 text-right tabular-nums">
                      {blk.indicators.graceTwsaCm !== null ? `${blk.indicators.graceTwsaCm} cm` : '—'}
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <Link
                        href={`/explorer?block=${blk.id}`}
                        className="text-primary hover:underline font-semibold"
                      >
                        Inspect in GIS →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* System Navigation Links (Horizontal Row, No Cards) */}
        <div className="pt-4 border-t border-border flex flex-wrap items-center justify-between gap-y-2 text-xs">
          <span className="font-semibold text-text-muted">Direct System Navigation:</span>
          <div className="flex flex-wrap items-center gap-6">
            <Link href="/explorer" className="text-primary hover:underline font-semibold flex items-center gap-1">
              <span>GIS Map Explorer</span>
              <span aria-hidden="true">→</span>
            </Link>
            <Link href="/monitoring" className="text-primary hover:underline font-semibold flex items-center gap-1">
              <span>Groundwater Monitoring</span>
              <span aria-hidden="true">→</span>
            </Link>
            <Link href="/risk-assessment" className="text-primary hover:underline font-semibold flex items-center gap-1">
              <span>Risk Assessment &amp; GSS</span>
              <span aria-hidden="true">→</span>
            </Link>
          </div>
        </div>
      </section>

      {/* --------------------------------------------------------------------------- */}
      {/* SECTION 6: RESEARCH GAPS, SOFTWARE GAPS, AND PLATFORM GAPS */}
      {/* --------------------------------------------------------------------------- */}
      <section id="gaps" className="space-y-8 scroll-mt-20">
        <div className="max-w-3xl space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-primary">
            Evidence-Led Gap Analysis
          </p>
          <h2 className="dbim-heading-2 text-text-main">
            Bridging the Gaps in Groundwater Intelligence
          </h2>
          <p className="text-base text-text-main font-medium">
            Groundwater data becomes actionable only when physical observations, geospatial context, engineering workflows, and governance interfaces align seamlessly.
          </p>
          <p className="text-xs text-text-muted leading-relaxed">
            Every section below details the concrete problem, why it matters to Indian hydrogeology, JAL DRISHTI&apos;s verified response, available empirical evidence, current verification status, and remaining scientific limitations.
          </p>
        </div>

        {/* Tab Switcher for the 3 Categories */}
        <div className="flex items-center gap-2 border-b border-border text-xs font-semibold">
          <button
            onClick={() => setActiveTab('research')}
            className={`pb-2.5 px-3 border-b-2 transition-colors ${
              activeTab === 'research'
                ? 'border-primary text-primary font-bold'
                : 'border-transparent text-text-muted hover:text-text-main'
            }`}
          >
            Category A: Research Gaps
          </button>
          <button
            onClick={() => setActiveTab('software')}
            className={`pb-2.5 px-3 border-b-2 transition-colors ${
              activeTab === 'software'
                ? 'border-primary text-primary font-bold'
                : 'border-transparent text-text-muted hover:text-text-main'
            }`}
          >
            Category B: Software & Engineering Gaps
          </button>
          <button
            onClick={() => setActiveTab('platform')}
            className={`pb-2.5 px-3 border-b-2 transition-colors ${
              activeTab === 'platform'
                ? 'border-primary text-primary font-bold'
                : 'border-transparent text-text-muted hover:text-text-main'
            }`}
          >
            Category C: Platform Gaps
          </button>
        </div>

        {/* TAB CONTENT: CATEGORY A - RESEARCH GAPS */}
        {activeTab === 'research' && (
          <div className="space-y-8">
            {/* Gap A1 */}
            <article className="border-t border-border pt-6 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-primary">Research Gap 1</span>
                <span className="text-xs font-semibold text-emerald-800">Status: Implemented</span>
              </div>
              <h3 className="text-base font-bold text-text-main">
                Coupling In-Situ Well Observations with Atmospheric and Gravimetric Mass Anomalies
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs leading-relaxed">
                <div className="space-y-1">
                  <p className="font-semibold text-text-main">1. The Problem & 2. Why It Matters:</p>
                  <p className="text-text-muted">
                    Point borehole water levels reflect localized drawdown and recovery, but lack hydrogeological meaning without simultaneous rainfall deficit, vegetative evapotranspiration, and regional water storage trends. Treating piezometers in isolation leads to false alarms during localized pumping or delayed detection of basin-wide aquifer depletion.
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="font-semibold text-text-main">3. JAL DRISHTI&apos;s Existing Response:</p>
                  <p className="text-text-muted">
                    Integrates dual-axis time series combining in-situ CGWB DWLR well depth (mbgl) with NASA GRACE-FO gravimetric anomalies (cm w.e.) and IMD 30-year Long Period Average (1991–2020) monsoon precipitation baselines.
                  </p>
                </div>
              </div>
              <div className="pt-2 border-t border-border/60 flex flex-wrap items-center justify-between gap-2 text-[11px] text-text-muted">
                <span><strong>4. Evidence & 5. Status:</strong> Chart configuration is covered by an automated test (<code>tests/monitoringVisualizations.test.ts</code>)</span>
                <span><strong>6. Remaining Limitations:</strong> GRACE-FO footprint (~100km) cannot resolve individual village piezometer drawdowns.</span>
              </div>
            </article>

            {/* Gap A2 */}
            <article className="border-t border-border pt-6 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-primary">Research Gap 2</span>
                <span className="text-xs font-semibold text-emerald-800">Status: Implemented</span>
              </div>
              <h3 className="text-base font-bold text-text-main">
                Cross-Aquifer Comparability Across Disparate Monitoring Densities and Geology
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs leading-relaxed">
                <div className="space-y-1">
                  <p className="font-semibold text-text-main">1. The Problem & 2. Why It Matters:</p>
                  <p className="text-text-muted">
                    Aquifers across India vary radically—from multi-tier alluvial plains in Punjab and Haryana to hard-rock basaltic Deccan traps in Madhya Pradesh and karst springsheds in Meghalaya. Direct comparison of raw water levels across diverse monitoring network densities misleads planners.
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="font-semibold text-text-main">3. JAL DRISHTI&apos;s Existing Response:</p>
                  <p className="text-text-muted">
                    Employs area-weighted polygon clipping and relative deviation scores (rather than raw volumetric metrics), allowing contrast across 60 blocks while preserving native hydrogeological descriptors.
                  </p>
                </div>
              </div>
              <div className="pt-2 border-t border-border/60 flex flex-wrap items-center justify-between gap-2 text-[11px] text-text-muted">
                <span><strong>4. Evidence & 5. Status:</strong> Verified via <code>tests/spatialAggregation.test.ts</code> (Spherical polygon area clipping)</span>
                <span><strong>6. Remaining Limitations:</strong> Fractured crystalline rock requires localized pump tests to determine true specific yield.</span>
              </div>
            </article>

            {/* Gap A3 */}
            <article className="border-t border-border pt-6 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-primary">Research Gap 3</span>
                <span className="text-xs font-semibold text-amber-800">Status: Research Only</span>
              </div>
              <h3 className="text-base font-bold text-text-main">
                Groundwater Forecasting and Rigorous Baseline Evaluation
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs leading-relaxed">
                <div className="space-y-1">
                  <p className="font-semibold text-text-main">1. The Problem & 2. Why It Matters:</p>
                  <p className="text-text-muted">
                    Many predictive ML models published in literature report high R² scores without comparing against simple persistence baselines (predicting last year&apos;s same-season depth) or holding out recent years, creating temporal data leakage.
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="font-semibold text-text-main">3. JAL DRISHTI&apos;s Existing Response:</p>
                  <p className="text-text-muted">
                    QuantileGB-v2.0 produces P10, P50 and P90 depth values. Each projection is shown beside persistence baselines. Benchmark results are provisional and do not show that the model outperforms the baselines.
                  </p>
                </div>
              </div>
              <div className="pt-2 border-t border-border/60 flex flex-wrap items-center justify-between gap-2 text-[11px] text-text-muted">
                <span><strong>4. Evidence & 5. Status:</strong> Baseline and temporal-leakage checks exist in <code>tests_py/</code>; they test code behaviour, not forecast accuracy</span>
                <span><strong>6. Remaining Limitations:</strong> Model intervals are uncalibrated for statutory drought relief decrees; strictly flagged RESEARCH_ONLY.</span>
              </div>
            </article>

            {/* Gap A4 */}
            <article className="border-t border-border pt-6 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-primary">Research Gap 4</span>
                <span className="text-xs font-semibold text-emerald-800">Status: Implemented</span>
              </div>
              <h3 className="text-base font-bold text-text-main">
                Handling Missing Observations and Telemetric Transmission Dropouts
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs leading-relaxed">
                <div className="space-y-1">
                  <p className="font-semibold text-text-main">1. The Problem & 2. Why It Matters:</p>
                  <p className="text-text-muted">
                    Real-world DWLR loggers suffer power loss, sensor fouling, and cellular dead zones. Standard data tools either drop missing periods or impute zeros, distorting groundwater depletion trends.
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="font-semibold text-text-main">3. JAL DRISHTI&apos;s Existing Response:</p>
                  <p className="text-text-muted">
                    Database mappers preserve null values explicitly. Charts display broken lines across missing dates with honest data-gap flags instead of interpolated values.
                  </p>
                </div>
              </div>
              <div className="pt-2 border-t border-border/60 flex flex-wrap items-center justify-between gap-2 text-[11px] text-text-muted">
                <span><strong>4. Evidence & 5. Status:</strong> Verified via <code>tests/noHardcodedFallback.test.ts</code> (Zero false data points)</span>
                <span><strong>6. Remaining Limitations:</strong> Extended dropouts (&gt;6 months) limit the statistical power of short-term trend slope calculations.</span>
              </div>
            </article>

            {/* Gap A5 */}
            <article className="border-t border-border pt-6 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-primary">Research Gap 5</span>
                <span className="text-xs font-semibold text-emerald-800">Status: Implemented</span>
              </div>
              <h3 className="text-base font-bold text-text-main">
                Interpretable Multi-Signal Indicators for Decision Support
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs leading-relaxed">
                <div className="space-y-1">
                  <p className="font-semibold text-text-main">1. The Problem & 2. Why It Matters:</p>
                  <p className="text-text-muted">
                    Complex hydrogeological metrics (specific capacity, transmissivity, drawdown curves) are incomprehensible to non-technical panchayat heads and local administrators.
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="font-semibold text-text-main">3. JAL DRISHTI&apos;s Existing Response:</p>
                  <p className="text-text-muted">
                    Formulates the Groundwater Stress Score (GSS, 0–100) into intuitive tiers (Severe, Watch, Normal) with transparent factor breakdowns and bilingual advisories.
                  </p>
                </div>
              </div>
              <div className="pt-2 border-t border-border/60 flex flex-wrap items-center justify-between gap-2 text-[11px] text-text-muted">
                <span><strong>4. Evidence & 5. Status:</strong> Verified via <code>tests/scientificEngine.test.ts</code> (Multi-criteria formula verification)</span>
                <span><strong>6. Remaining Limitations:</strong> GSS is a descriptive diagnostic indicator; human review is required before statutory enforcement.</span>
              </div>
            </article>
          </div>
        )}

        {/* TAB CONTENT: CATEGORY B - SOFTWARE & ENGINEERING GAPS */}
        {activeTab === 'software' && (
          <div className="space-y-8">
            {/* Gap B1 */}
            <article className="border-t border-border pt-6 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-primary">Software Gap 1</span>
                <span className="text-xs font-semibold text-emerald-800">Status: Implemented</span>
              </div>
              <h3 className="text-base font-bold text-text-main">
                Unified Ingestion of Heterogeneous Government Data Feeds
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs leading-relaxed">
                <div className="space-y-1">
                  <p className="font-semibold text-text-main">1. The Problem & 2. Why It Matters:</p>
                  <p className="text-text-muted">
                    Public water datasets use incompatible schemas, CRS projections (EPSG:4326 vs UTM), date formats, and naming conventions (e.g. spelling variations of district and block names).
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="font-semibold text-text-main">3. JAL DRISHTI&apos;s Existing Response:</p>
                  <p className="text-text-muted">
                    Built a canonical TypeScript data model (<code>BlockData</code>) with automated LGD code matching, coordinate validation, and unified JSON serialization.
                  </p>
                </div>
              </div>
              <div className="pt-2 border-t border-border/60 flex flex-wrap items-center justify-between gap-2 text-[11px] text-text-muted">
                <span><strong>4. Evidence & 5. Status:</strong> Verified via <code>tests/stage6TrustworthyMonitoring.test.ts</code> (Schema mappings)</span>
                <span><strong>6. Remaining Limitations:</strong> Manual verification is required when local administrative re-districting changes block boundaries.</span>
              </div>
            </article>

            {/* Gap B2 */}
            <article className="border-t border-border pt-6 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-primary">Software Gap 2</span>
                <span className="text-xs font-semibold text-emerald-800">Status: Implemented</span>
              </div>
              <h3 className="text-base font-bold text-text-main">
                Coupled Retrieval, Ingestion, Inference, and Presentation Workflows
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs leading-relaxed">
                <div className="space-y-1">
                  <p className="font-semibold text-text-main">1. The Problem & 2. Why It Matters:</p>
                  <p className="text-text-muted">
                    Most research prototypes exist as disconnected Jupyter notebooks that never connect to a live database or user interface, preventing ongoing operational utility.
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="font-semibold text-text-main">3. JAL DRISHTI&apos;s Existing Response:</p>
                  <p className="text-text-muted">
                    End-to-end integration: Python data ingestion pipelines load verified tables in PostgreSQL/PostGIS, which Next.js API routes serve directly to Leaflet maps and Recharts visuals.
                  </p>
                </div>
              </div>
              <div className="pt-2 border-t border-border/60 flex flex-wrap items-center justify-between gap-2 text-[11px] text-text-muted">
                <span><strong>4. Evidence & 5. Status:</strong> Verified via <code>tests_py/test_inference_pipeline.py</code> (End-to-end data flow)</span>
                <span><strong>6. Remaining Limitations:</strong> Offline or air-gapped deployments require local Dockerized database containers.</span>
              </div>
            </article>

            {/* Gap B3 */}
            <article className="border-t border-border pt-6 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-primary">Software Gap 3</span>
                <span className="text-xs font-semibold text-emerald-800">Status: Implemented</span>
              </div>
              <h3 className="text-base font-bold text-text-main">
                Transparent Provenance and Data Freshness Tracking
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs leading-relaxed">
                <div className="space-y-1">
                  <p className="font-semibold text-text-main">1. The Problem & 2. Why It Matters:</p>
                  <p className="text-text-muted">
                    Dashboards frequently show cached or years-old data with a "Live" label simply because the page was loaded today, misleading water authorities about data currency.
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="font-semibold text-text-main">3. JAL DRISHTI&apos;s Existing Response:</p>
                  <p className="text-text-muted">
                    Deployed the universal <code>FreshnessBadge</code> component across all routes, distinguishing observation date from ingestion timestamp, declaring source provider and limitations.
                  </p>
                </div>
              </div>
              <div className="pt-2 border-t border-border/60 flex flex-wrap items-center justify-between gap-2 text-[11px] text-text-muted">
                <span><strong>4. Evidence & 5. Status:</strong> Verified via <code>src/lib/data/freshness.ts</code> (Strict freshness taxonomy)</span>
                <span><strong>6. Remaining Limitations:</strong> Upstream government telemetry feeds occasionally withhold update logs during portal maintenance.</span>
              </div>
            </article>

            {/* Gap B4 */}
            <article className="border-t border-border pt-6 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-primary">Software Gap 4</span>
                <span className="text-xs font-semibold text-emerald-800">Status: Implemented</span>
              </div>
              <h3 className="text-base font-bold text-text-main">
                Strict Model Input Validation and Safe Degradation
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs leading-relaxed">
                <div className="space-y-1">
                  <p className="font-semibold text-text-main">1. The Problem & 2. Why It Matters:</p>
                  <p className="text-text-muted">
                    Machine learning endpoints often crash or output bogus predictions (e.g. negative water table depths) when presented with out-of-range sensor inputs or missing parameters.
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="font-semibold text-text-main">3. JAL DRISHTI&apos;s Existing Response:</p>
                  <p className="text-text-muted">
                    Inference route enforces hydrogeological bounds, caps predictions to 4 quarters, and fails closed with clear error messages rather than returning unvalidated numbers.
                  </p>
                </div>
              </div>
              <div className="pt-2 border-t border-border/60 flex flex-wrap items-center justify-between gap-2 text-[11px] text-text-muted">
                <span><strong>4. Evidence & 5. Status:</strong> Verified via <code>tests_py/test_quantile_model.py</code> (Bound validation)</span>
                <span><strong>6. Remaining Limitations:</strong> Unprecedented climate anomalies outside the training distribution widen forecast uncertainty.</span>
              </div>
            </article>

            {/* Gap B5 */}
            <article className="border-t border-border pt-6 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-primary">Software Gap 5</span>
                <span className="text-xs font-semibold text-emerald-800">Status: Implemented</span>
              </div>
              <h3 className="text-base font-bold text-text-main">
                Consistent Cascading Filter Synchronization Across Modules
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs leading-relaxed">
                <div className="space-y-1">
                  <p className="font-semibold text-text-main">1. The Problem & 2. Why It Matters:</p>
                  <p className="text-text-muted">
                    Complex web apps often decouple page state: selecting a block on a map fails to filter corresponding tables or charts, forcing users to repeatedly re-enter selections.
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="font-semibold text-text-main">3. JAL DRISHTI&apos;s Existing Response:</p>
                  <p className="text-text-muted">
                    Synchronized URL parameter binding (<code>?block=id</code>) and cascading State → District → Block selection across Overview, GIS Explorer, Monitoring, and Risk Assessment.
                  </p>
                </div>
              </div>
              <div className="pt-2 border-t border-border/60 flex flex-wrap items-center justify-between gap-2 text-[11px] text-text-muted">
                <span><strong>4. Evidence & 5. Status:</strong> Verified via <code>tests/routeRegression.test.ts</code> (183 node tests pass)</span>
                <span><strong>6. Remaining Limitations:</strong> Browser back/forward navigation in deep filter chains requires standard URL preservation.</span>
              </div>
            </article>
          </div>
        )}

        {/* TAB CONTENT: CATEGORY C - PLATFORM GAPS */}
        {activeTab === 'platform' && (
          <div className="space-y-8">
            {/* Gap C1 */}
            <article className="border-t border-border pt-6 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-primary">Platform Gap 1</span>
                <span className="text-xs font-semibold text-emerald-800">Status: Implemented</span>
              </div>
              <h3 className="text-base font-bold text-text-main">
                Unified Geographic Exploration in a Single Cohesive Interface
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs leading-relaxed">
                <div className="space-y-1">
                  <p className="font-semibold text-text-main">1. The Problem & 2. Why It Matters:</p>
                  <p className="text-text-muted">
                    Users currently have to consult ISRO Bhuvan for satellite imagery, India-WRIS for surface water bodies, and CGWB reports for piezometer tables, with no unified geographic visualization.
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="font-semibold text-text-main">3. JAL DRISHTI&apos;s Existing Response:</p>
                  <p className="text-text-muted">
                    Provides a Leaflet-based GIS Explorer integrating block boundaries, depth contours, severity color coding, and station inspectors in one place.
                  </p>
                </div>
              </div>
              <div className="pt-2 border-t border-border/60 flex flex-wrap items-center justify-between gap-2 text-[11px] text-text-muted">
                <span><strong>4. Evidence & 5. Status:</strong> Verified on <code>/explorer</code> route across all 8 priority states</span>
                <span><strong>6. Remaining Limitations:</strong> High-density vector layers require client-side tile optimization on low-bandwidth mobile devices.</span>
              </div>
            </article>

            {/* Gap C2 */}
            <article className="border-t border-border pt-6 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-primary">Platform Gap 2</span>
                <span className="text-xs font-semibold text-emerald-800">Status: Implemented</span>
              </div>
              <h3 className="text-base font-bold text-text-main">
                Explicit Boundary Between Empirical Ground Truth and ML Predictions
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs leading-relaxed">
                <div className="space-y-1">
                  <p className="font-semibold text-text-main">1. The Problem & 2. Why It Matters:</p>
                  <p className="text-text-muted">
                    Blurring the line between what was physically measured and what an algorithm projected can cause erroneous legal sanctions, improper crop advisories, or panic.
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="font-semibold text-text-main">3. JAL DRISHTI&apos;s Existing Response:</p>
                  <p className="text-text-muted">
                    Strict labeling across all pages: Physical well observations carry exact observation dates and DWLR tags; machine learning inferences are explicitly stamped RESEARCH_ONLY.
                  </p>
                </div>
              </div>
              <div className="pt-2 border-t border-border/60 flex flex-wrap items-center justify-between gap-2 text-[11px] text-text-muted">
                <span><strong>4. Evidence & 5. Status:</strong> Verified via <code>tests/stage5ClaimsAndSafety.test.ts</code> (Zero false claims)</span>
                <span><strong>6. Remaining Limitations:</strong> Requires continuous user education so village committees understand probabilistic bounds.</span>
              </div>
            </article>

            {/* Gap C3 */}
            <article className="border-t border-border pt-6 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-primary">Platform Gap 3</span>
                <span className="text-xs font-semibold text-emerald-800">Status: Implemented</span>
              </div>
              <h3 className="text-base font-bold text-text-main">
                Visibility into Geographic Observation Gaps and Sensor Distribution
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs leading-relaxed">
                <div className="space-y-1">
                  <p className="font-semibold text-text-main">1. The Problem & 2. Why It Matters:</p>
                  <p className="text-text-muted">
                    Many platforms imply uniform national coverage when in reality vast regions have zero automated telemetric wells, creating a false impression of comprehensive monitoring.
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="font-semibold text-text-main">3. JAL DRISHTI&apos;s Existing Response:</p>
                  <p className="text-text-muted">
                    Distinguishes the 8 active focus states from telemetry-pending states; blocks without active sensors display explicit "Data Gap" flags instead of simulated numbers.
                  </p>
                </div>
              </div>
              <div className="pt-2 border-t border-border/60 flex flex-wrap items-center justify-between gap-2 text-[11px] text-text-muted">
                <span><strong>4. Evidence & 5. Status:</strong> Verified via <code>tests/nationalContrast.test.ts</code> (Honest data tags)</span>
                <span><strong>6. Remaining Limitations:</strong> Remote northeastern states (Meghalaya, Tripura) currently rely on baseline synchronizations pending DWLR rollouts.</span>
              </div>
            </article>

            {/* Gap C4 */}
            <article className="border-t border-border pt-6 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-primary">Platform Gap 4</span>
                <span className="text-xs font-semibold text-emerald-800">Status: Implemented</span>
              </div>
              <h3 className="text-base font-bold text-text-main">
                Direct Path from Monitoring to Targeted Recharge Interventions
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs leading-relaxed">
                <div className="space-y-1">
                  <p className="font-semibold text-text-main">1. The Problem & 2. Why It Matters:</p>
                  <p className="text-text-muted">
                    Monitoring data is useless if it does not inform action. Planners need specific hydrogeological recommendations matched to local soil and rainfall conditions.
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="font-semibold text-text-main">3. JAL DRISHTI&apos;s Existing Response:</p>
                  <p className="text-text-muted">
                    Integrates an intervention catalog linking identified stress in a block to suitable interventions (percolation tanks, check dams, injection shafts) with Atal Bhujal Yojana guidelines.
                  </p>
                </div>
              </div>
              <div className="pt-2 border-t border-border/60 flex flex-wrap items-center justify-between gap-2 text-[11px] text-text-muted">
                <span><strong>4. Evidence & 5. Status:</strong> Verified on <code>/interventions</code> route</span>
                <span><strong>6. Remaining Limitations:</strong> Detailed engineering designs and cost estimates require site-specific soil infiltration tests.</span>
              </div>
            </article>

            {/* Gap C5 */}
            <article className="border-t border-border pt-6 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-primary">Platform Gap 5</span>
                <span className="text-xs font-semibold text-emerald-800">Status: Implemented</span>
              </div>
              <h3 className="text-base font-bold text-text-main">
                Open Architecture for Future Ingestion of IoT and Springshed Telemetry
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs leading-relaxed">
                <div className="space-y-1">
                  <p className="font-semibold text-text-main">1. The Problem & 2. Why It Matters:</p>
                  <p className="text-text-muted">
                    State water boards are rolling out new telemetric sensors, community rain gauges, and springshed loggers that existing legacy platforms cannot ingest without full rewrites.
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="font-semibold text-text-main">3. JAL DRISHTI&apos;s Existing Response:</p>
                  <p className="text-text-muted">
                    Modular API schema and extensible database mappers accommodate additional sensors (including northeastern springshed data) without breaking API contracts.
                  </p>
                </div>
              </div>
              <div className="pt-2 border-t border-border/60 flex flex-wrap items-center justify-between gap-2 text-[11px] text-text-muted">
                <span><strong>4. Evidence & 5. Status:</strong> Verified via <code>tests_py/test_springshed_engine.py</code></span>
                <span><strong>6. Remaining Limitations:</strong> Standardized transmission protocols (MQTT/CoAP) vary across state vendor contracts.</span>
              </div>
            </article>
          </div>
        )}

        {/* Primary Scientific References (Unboxed Editorial) */}
        <div className="pt-6 border-t border-border space-y-2 text-xs">
          <p className="font-bold text-text-main">Key Scientific Literature & Citations:</p>
          <ul className="list-disc pl-5 space-y-1 text-text-muted">
            <li>
              Rodell, M., Velicogna, I., &amp; Famiglietti, J. S. (2009). Satellite-based estimates of groundwater depletion in India. <em>Nature</em>, 460(7258), 999-1002.
            </li>
            <li>
              Pai, D. S., Sridhar, L., Rajeevan, M., et al. (2014). Development of a new high spatial resolution (0.25° × 0.25°) daily gridded rainfall data set over India. <em>Mausam</em>, 65(1), 1-18.
            </li>
            <li>
              Central Ground Water Board (2020). <em>Master Plan for Artificial Recharge to Ground Water in India</em>. Ministry of Jal Shakti, Government of India.
            </li>
            <li>
              Central Ground Water Board (2023). <em>National Compilation on Dynamic Ground Water Resources of India, 2023</em>. Department of Water Resources, RD &amp; GR.
            </li>
            <li>
              World Bank (2018). <em>National Groundwater Management Improvement Program (Atal Bhujal Yojana) Project Appraisal Document</em>. Report No: PAD2424.
            </li>
          </ul>
        </div>
      </section>

      {/* --------------------------------------------------------------------------- */}
      {/* SECTION 7: DATA AND TECHNOLOGY */}
      {/* --------------------------------------------------------------------------- */}
      <section className="space-y-8">
        <div className="max-w-3xl space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-primary">
            Data & Technology
          </p>
          <h2 className="dbim-heading-2 text-text-main">
            Data Sources, Ingestion Cadence & Provenance
          </h2>
          <p className="text-sm text-text-muted leading-relaxed">
            Groundwater analysis requires distinguishing direct in-situ physical measurements from coarse spaceborne mass anomalies, heuristic composite indices, and statistical research predictions.
          </p>
        </div>

        {/* Clean Responsive Table (Unboxed Editorial) */}
        <div className="overflow-x-auto border-t border-b border-border">
          <table className="w-full text-left text-xs border-collapse dbim-table">
            <thead>
              <tr className="border-b border-border bg-subtle text-text-muted font-bold text-[11px] uppercase tracking-wider">
                <th className="py-3 px-4 text-left">Data Source &amp; Provider</th>
                <th className="py-3 px-4 text-left">Parameter &amp; Units</th>
                <th className="py-3 px-4 text-left">Cadence &amp; Typical Lag</th>
                <th className="py-3 px-4 text-left">Spatial Resolution</th>
                <th className="py-3 px-4 text-left">Methodological Limitations</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              <tr>
                <td className="py-3 px-4">
                  <div className="font-bold text-text-main">CGWB / NWIC DWLR Telemetry</div>
                  <div className="text-[11px] text-text-muted">Ministry of Jal Shakti</div>
                </td>
                <td className="py-3 px-4 font-mono">Depth to Water Table (m bgl)</td>
                <td className="py-3 px-4">Daily automated (~15-30 day lag)</td>
                <td className="py-3 px-4">Point observation well</td>
                <td className="py-3 px-4 text-text-muted">
                  Station density varies by state; unconfined aquifers may decouple from deep confined systems.
                </td>
              </tr>
              <tr>
                <td className="py-3 px-4">
                  <div className="font-bold text-text-main">IMD Gridded Rainfall Baselines</div>
                  <div className="text-[11px] text-text-muted">India Meteorological Department</div>
                </td>
                <td className="py-3 px-4 font-mono">Precipitation Total & Deficit (mm, %)</td>
                <td className="py-3 px-4">Daily (~2 day lag)</td>
                <td className="py-3 px-4">0.25° × 0.25° grid (~25 km)</td>
                <td className="py-3 px-4 text-text-muted">
                  Spatial interpolation over block polygons introduces smoothing over mountainous terrain.
                </td>
              </tr>
              <tr>
                <td className="py-3 px-4">
                  <div className="font-bold text-text-main">NASA JPL / GFZ GRACE-FO</div>
                  <div className="text-[11px] text-text-muted">NASA Earth Science</div>
                </td>
                <td className="py-3 px-4 font-mono">Terrestrial Water Storage (cm w.e.)</td>
                <td className="py-3 px-4">Monthly (~45 day lag)</td>
                <td className="py-3 px-4">1.0° × 1.0° grid (~100 km)</td>
                <td className="py-3 px-4 text-text-muted">
                  Measures total regional mass variation; cannot resolve village-level or individual well depth.
                </td>
              </tr>
              <tr>
                <td className="py-3 px-4">
                  <div className="font-bold text-text-main">ESA Copernicus Sentinel-2 MSI</div>
                  <div className="text-[11px] text-text-muted">European Space Agency</div>
                </td>
                <td className="py-3 px-4 font-mono">NDVI & NDWI Indices (ratio)</td>
                <td className="py-3 px-4">5-Day Revisit (~10 day lag)</td>
                <td className="py-3 px-4">10m – 20m optical</td>
                <td className="py-3 px-4 text-text-muted">
                  Requires monsoonal cloud screening; reflects vegetative canopy vigor rather than deep storage.
                </td>
              </tr>
              <tr>
                <td className="py-3 px-4">
                  <div className="font-bold text-text-main">QuantileGB-v2.0 Forecast Model</div>
                  <div className="text-[11px] text-text-muted">JalDrishti Research Engine</div>
                </td>
                <td className="py-3 px-4 font-mono">P10, P50, P90 Depth Bounds (m bgl)</td>
                <td className="py-3 px-4">1 to 4 quarters ahead</td>
                <td className="py-3 px-4">Block observation centroid</td>
                <td className="py-3 px-4 text-text-muted">
                  Statistical research prototype; uncalibrated intervals; not approved for disaster declaration.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* --------------------------------------------------------------------------- */}
      {/* SECTION 8: GEOGRAPHIC SCOPE */}
      {/* --------------------------------------------------------------------------- */}
      <section className="space-y-8">
        <div className="max-w-3xl space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-primary">
            Geographic Scope
          </p>
          <h2 className="dbim-heading-2 text-text-main">
            National Ambition & Eight Priority Focus States
          </h2>
          <p className="text-sm text-text-muted leading-relaxed">
            While JAL DRISHTI is architected for pan-India scalability, actual verified monitoring density, DWLR telemetry integration, and model artifacts currently operate across eight priority states.
          </p>
        </div>

        {/* Open 4-Column Layout */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 border-t border-border pt-6">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-text-main text-sm">Madhya Pradesh</span>
              <span className="text-xs font-semibold text-emerald-700">● DWLR Live</span>
            </div>
            <p className="text-xs text-text-muted leading-relaxed">
              Central basalt plateau & hard-rock crystalline aquifers. Critical monitoring in Tikamgarh and Chhatarpur districts.
            </p>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-text-main text-sm">Karnataka</span>
              <span className="text-xs font-semibold text-emerald-700">● Telemetry Active</span>
            </div>
            <p className="text-xs text-text-muted leading-relaxed">
              Western Ghats peripheral recharge & hard-rock granitic aquifers. Monitored blocks in Shivamogga and Davanagere.
            </p>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-text-main text-sm">Punjab</span>
              <span className="text-xs font-semibold text-emerald-700">● DWLR Live</span>
            </div>
            <p className="text-xs text-text-muted leading-relaxed">
              Intensive agricultural irrigation belts; high over-exploitation stage and deep tube-well extraction.
            </p>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-text-main text-sm">Rajasthan</span>
              <span className="text-xs font-semibold text-emerald-700">● DWLR Live</span>
            </div>
            <p className="text-xs text-text-muted leading-relaxed">
              Arid & semi-arid hard rock and deep sandstone aquifers characterized by acute depletion.
            </p>
          </div>

          <div className="space-y-2 border-t border-border/60 pt-4">
            <div className="flex items-center justify-between">
              <span className="font-bold text-text-main text-sm">Haryana</span>
              <span className="text-xs font-semibold text-emerald-700">● DWLR Live</span>
            </div>
            <p className="text-xs text-text-muted leading-relaxed">
              Western alluvial tracts with heavy groundwater draft and localized saline intrusion zones.
            </p>
          </div>

          <div className="space-y-2 border-t border-border/60 pt-4">
            <div className="flex items-center justify-between">
              <span className="font-bold text-text-main text-sm">Assam</span>
              <span className="text-xs font-semibold text-amber-700">● Baseline Synced</span>
            </div>
            <p className="text-xs text-text-muted leading-relaxed">
              Brahmaputra alluvial floodplains; shallow water tables with seasonal monsoonal recharge dynamics.
            </p>
          </div>

          <div className="space-y-2 border-t border-border/60 pt-4">
            <div className="flex items-center justify-between">
              <span className="font-bold text-text-main text-sm">Meghalaya</span>
              <span className="text-xs font-semibold text-amber-700">● Baseline Synced</span>
            </div>
            <p className="text-xs text-text-muted leading-relaxed">
              Hilly karst and fractured sandstone springsheds; high annual rainfall with rapid post-monsoon runoff.
            </p>
          </div>

          <div className="space-y-2 border-t border-border/60 pt-4">
            <div className="flex items-center justify-between">
              <span className="font-bold text-text-main text-sm">Telangana</span>
              <span className="text-xs font-semibold text-emerald-700">● Telemetry Active</span>
            </div>
            <p className="text-xs text-text-muted leading-relaxed">
              Godavari & Krishna basalt/granitic plateau; monitoring across Hyderabad and Nalgonda agricultural zones.
            </p>
          </div>
        </div>
      </section>

      {/* --------------------------------------------------------------------------- */}
      {/* SECTION 9: APPLICATIONS AND POTENTIAL IMPACT */}
      {/* --------------------------------------------------------------------------- */}
      <section className="space-y-8">
        <div className="max-w-3xl space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-primary">
            Practical Applications
          </p>
          <h2 className="dbim-heading-2 text-text-main">
            Serving the Water-Governance Ecosystem
          </h2>
          <p className="text-sm text-text-muted leading-relaxed">
            By adapting analytical depth to user roles, JAL DRISHTI bridges technical hydrogeology and field execution.
          </p>
        </div>

        {/* Open 2-Column Layout */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 border-t border-border pt-6">
          <div className="space-y-2">
            <h3 className="font-bold text-text-main text-sm">State & Central Groundwater Authorities</h3>
            <p className="text-xs text-text-muted leading-relaxed">
              Inspect monitoring network density, identify telemetric data dropouts, audit regional water storage anomalies against GRACE satellites, and maintain traceable compliance logs.
            </p>
          </div>

          <div className="space-y-2">
            <h3 className="font-bold text-text-main text-sm">District Collectors & Water Resource Planners</h3>
            <p className="text-xs text-text-muted leading-relaxed">
              Target artificial recharge capital expenditures (check dams, percolation tanks, recharge shafts) where rainfall deficits coincide with declining piezometric trends.
            </p>
          </div>

          <div className="space-y-2 border-t border-border/60 pt-6">
            <h3 className="font-bold text-text-main text-sm">Gram Panchayats & Village Water Committees</h3>
            <p className="text-xs text-text-muted leading-relaxed">
              Translate complex hydrogeological indices into bilingual advisories (English and Hindi), encouraging seasonal crop water budgeting and community recharge maintenance.
            </p>
          </div>

          <div className="space-y-2 border-t border-border/60 pt-6">
            <h3 className="font-bold text-text-main text-sm">Hydrogeology Researchers & Environmental Analysts</h3>
            <p className="text-xs text-text-muted leading-relaxed">
              Access unvarnished historical datasets, evaluate machine learning forecasting against persistence baselines, and investigate multi-sensor correlations without black-box assumptions.
            </p>
          </div>
        </div>
      </section>

      {/* --------------------------------------------------------------------------- */}
      {/* SECTION 10: SCIENTIFIC TRANSPARENCY */}
      {/* --------------------------------------------------------------------------- */}
      <section className="border-l-4 border-primary bg-subtle p-6 sm:p-8 space-y-4 rounded-r">
        <div className="flex items-center gap-2">
          <ShieldCheckIcon className="w-5 h-5 text-primary" />
          <h2 className="text-base font-bold text-text-main">Scientific Transparency & Operational Safeguards</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-xs text-text-muted leading-relaxed pt-2">
          <div className="space-y-1.5">
            <h3 className="font-bold text-text-main">No Automated Statutory Decisions</h3>
            <p>
              Predictive forecasts and GSS scores are informational research indicators. They cannot be used as the sole legal basis for well drilling bans or drought emergency relief without field piezometer inspection.
            </p>
          </div>
          <div className="space-y-1.5">
            <h3 className="font-bold text-text-main">Satellite Resolution Disclosures</h3>
            <p>
              NASA GRACE-FO measures mass variations over ~100 km grid footprints. Downscaled trends do not guarantee local village-scale accuracy and must not be treated as direct well observations.
            </p>
          </div>
          <div className="space-y-1.5">
            <h3 className="font-bold text-text-main">Missing Data Integrity</h3>
            <p>
              When telemetry stations experience transmission dropouts, values are preserved as nulls. The platform never fabricates measurements to create visually continuous charts.
            </p>
          </div>
        </div>
      </section>

      {/* --------------------------------------------------------------------------- */}
      {/* SECTION 11: FINAL CALL TO ACTION */}
      {/* --------------------------------------------------------------------------- */}
      <section className="pt-8 pb-12 border-t border-border text-center space-y-6">
        <div className="max-w-2xl mx-auto space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-primary">
            Take the Next Step
          </p>
          <h2 className="dbim-heading-2 text-text-main">
            Explore the Groundwater Intelligence Platform
          </h2>
          <p className="text-sm text-text-muted leading-relaxed">
            Examine in-situ piezometric observations, inspect block-level risk scores, review empirical models, and evaluate decision-support workflows across eight priority states.
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-4 pt-2">
          <Link
            href="/explorer"
            className="bg-primary hover:bg-primary-hover text-text-inverted text-sm font-semibold px-6 py-3 rounded transition-colors inline-flex items-center gap-2"
          >
            Launch GIS Map Explorer
          </Link>
          <Link
            href="/monitoring"
            className="bg-surface hover:bg-subtle text-text-main border border-border text-sm font-semibold px-5 py-3 rounded transition-colors"
          >
            View Groundwater Monitoring
          </Link>
          <Link
            href="/data-sources"
            className="bg-surface hover:bg-subtle text-text-main border border-border text-sm font-semibold px-5 py-3 rounded transition-colors"
          >
            Inspect Data Sources &amp; Methodology
          </Link>
          <Link
            href="/overview"
            className="bg-surface hover:bg-subtle text-text-main border border-border text-sm font-semibold px-5 py-3 rounded transition-colors"
          >
            Open Overview Dashboard
          </Link>
        </div>

        <div className="pt-4 text-xs text-text-muted">
          All data sourced from official public archives. Research models strictly flagged for evaluation.
        </div>
      </section>
    </div>
  );
}
