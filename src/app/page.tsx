'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
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
import { ALL_INDIAN_STATES, ALL_TARGET_STATES, HISTORICAL_REFERENCE_STATES, TARGET_REGIONS, isTargetState, getTargetStatesAlphabetically } from '@/lib/data/indiaStates';
import { useEffect } from 'react';
import { ACTIVE_TARGET_BLOCKS, mergeWithLiveBlocks, normalizeStateName } from '@/lib/data/allNationwideBlocks';
import { sortBlocksHierarchy } from '@/lib/data/geographicSorting';
import type { BlockData } from '@/lib/types';
import { TermHelp, WhatAmILookingAt } from '@/components/ui/PlainLanguageHelp';

export default function LandingPage() {
  const { t } = useLanguage();

  // State for interactive live preview
  const [selectedState, setSelectedState] = useState<string>('all');
  const [selectedSeverity, setSelectedSeverity] = useState<string>('all');
  const [activeTab, setActiveTab] = useState<'research' | 'software' | 'platform'>('research');
  const [blocksData, setBlocksData] = useState<BlockData[]>(ACTIVE_TARGET_BLOCKS);

  useEffect(() => {
    async function loadLiveBlocks() {
      try {
        const res = await fetch('/api/geospatial/blocks');
        if (res.ok) {
          const json = await res.json();
          if (Array.isArray(json.blocks) && json.blocks.length > 0) {
            setBlocksData(mergeWithLiveBlocks(json.blocks));
          }
        }
      } catch {
        // keep baseline fixture blocks
      }
    }
    loadLiveBlocks();
  }, []);

  const activePool = blocksData.length > 0 ? blocksData : ACTIVE_TARGET_BLOCKS;

  const filteredPreviewBlocks = sortBlocksHierarchy(
    activePool.filter((block) => {
      const matchesState = selectedState === 'all'
        ? isTargetState(block.state)
        : normalizeStateName(block.state) === selectedState;
      const matchesSeverity = selectedSeverity === 'all' || block.riskSeverity === selectedSeverity;
      return matchesState && matchesSeverity;
    })
  ).slice(0, 8);

  return (
    <div className="space-y-16 sm:space-y-24 py-4 sm:py-8 text-text-main">
      {/* --------------------------------------------------------------------------- */}
      {/* SECTION 1: HERO & MISSION */}
      {/* --------------------------------------------------------------------------- */}
      <section className="relative pt-4 pb-12 border-b border-border space-y-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          <div className="lg:col-span-7 space-y-5">

            <h1 className="dbim-heading-1 text-text-main">
              Clear, honest groundwater information for India.
            </h1>

            <p className="dbim-paragraph-lead text-text-muted leading-relaxed">
              AMRUT DRISHTI is a satellite-assisted groundwater intelligence and early-warning platform for India that integrates verified groundwater well observations, 30-year gridded rainfall baselines, multi-sensor satellite indices, quantile machine learning forecasting, objective risk assessment, and situation-aware intervention planning.
            </p>

            <p className="dbim-paragraph text-text-muted leading-relaxed">
              The platform transforms fragmented environmental observations into transparent groundwater trends, forward-looking forecasts with explicit uncertainty bounds, and evidence-based decisions for citizens, farmers, and administrative authorities. Our priority focus spans 43 verified active blocks across 28 districts in nine target states: South India (Karnataka, Telangana, Tamil Nadu), Central India (Madhya Pradesh), North India (Rajasthan, Haryana, Punjab), and Northeast India (Meghalaya, Tripura). Every reading discloses its exact observation date, official source attribution, and known hydrogeological limitations without concealing missing data or simulating unmeasured wells.
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
                End-to-End Intelligence Workflow
              </a>
              <Link
                href="/overview"
                className="text-xs font-semibold text-primary hover:underline px-2 py-3"
              >
                Open State &amp; District Overview →
              </Link>
            </div>

            {/* Quick Plain-Language Guide: Fitted neatly inside hero alongside image */}
            <div className="pt-2 border-t border-border/70">
              <WhatAmILookingAt
                title="Quick Guide: How to Use AMRUT DRISHTI (5 Plain-Language Answers)"
                what="A national groundwater monitoring and early-warning platform that pairs verified in-situ measurements from government observation wells with IMD gridded rainfall and satellite observations."
                meaning="It tracks how deep water is below the ground in your block, whether aquifer storage is recovering or depleting compared to historical baselines, and where seasonal rainfall deficits threaten local supplies."
                whyCare="When water tables decline alongside monsoon deficits, shallow community drinking wells and rabi crop irrigation risk exhaustion months before the arrival of the subsequent monsoon."
                recentAndReliable="Observations are ingested directly from official Central Ground Water Board (CGWB) digital water level recorders, State Groundwater Departments, and IMD meteorological grids. Every page records observation timestamps, latency periods, and data quality states."
                nextSteps="1. Use the Map Explorer to inspect your administrative block. 2. Examine 1-to-4 quarter ML depth forecasts and persistence baselines. 3. Review site-appropriate check dams, percolation ponds, and recharge shafts in the Interventions catalog."
                initiallyOpen={true}
                className="my-2"
              />
            </div>
          </div>

          {/* Right Column: Authentic DWLR Telemetry Station Image */}
          <div className="lg:col-span-5 space-y-2 border border-border bg-subtle/30 p-2 rounded">
            <div className="relative w-full aspect-[4/3] overflow-hidden rounded">
              <Image
                src="/images/india_groundwater_monitoring_hero.jpg"
                alt="Automated Digital Water Level Recorder (DWLR) piezometer telemetry station in rural agricultural India"
                fill
                className="object-cover"
                sizes="(max-width: 1024px) 100vw, 40vw"
                priority
              />
            </div>
            <p className="text-[11px] text-text-muted leading-normal px-1">
              <strong>Government Telemetry in the Field:</strong> Automated Digital Water Level Recorder (DWLR) piezometer station transmitting real-time water table readings in an agricultural aquifer zone.
            </p>
          </div>
        </div>

        {/* Where Our Information Comes From: Sky to Underground (Clean DBIM Subheadings & Editorial 2-Column Schematic) */}
        <div className="pt-6 border-t border-border space-y-6">
          <div className="space-y-1">
            <h2 className="dbim-heading-2 text-text-main">
              Where Our Water Information Comes From: From Sky to Deep Underground
            </h2>
            <p className="dbim-caption text-text-muted">
              Integrated Environmental Layers &amp; Observation Depths
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Left Column: Natural Editorial Descriptions */}
            <div className="lg:col-span-7 space-y-5">
              {/* Stratum 1: Spaceborne & Atmospheric Signals */}
              <div className="space-y-1">
                <h3 className="dbim-heading-3 text-text-main">
                  Sky &amp; Weather: Rainfall &amp; Regional Water Changes
                </h3>
                <p className="dbim-paragraph text-text-muted leading-relaxed">
                  NASA GRACE-FO Satellites (~100 km regional view) • IMD 0.25° Weather Grids • Sentinel-2 Earth Imagery
                </p>
              </div>

              {/* Stratum 2: Topsoil & Root Zone */}
              <div className="space-y-1">
                <h3 className="dbim-heading-3 text-text-main">
                  Ground Surface &amp; Crops: Topsoil Moisture &amp; Crop Greenness (0 – 2 m depth)
                </h3>
                <p className="dbim-paragraph text-text-muted leading-relaxed">
                  SMAP Satellite Soil Moisture • Sentinel-2 Crop Greenness &amp; Surface Water Vigor
                </p>
              </div>

              {/* Stratum 3: Unconfined Weathered Aquifer */}
              <div className="space-y-1">
                <h3 className="dbim-heading-3 text-text-main">
                  Main Underground Water Table: Village &amp; Farming Wells (2 – 25 m depth)
                </h3>
                <p className="dbim-paragraph text-text-muted leading-relaxed">
                  Direct physical water table depth from Central Ground Water Board (CGWB) &amp; NWIC Digital Telemetry Wells. Depth to water in m bgl (meters below ground level).
                </p>
              </div>

              {/* Stratum 4: Semi-Confined Fractured Crystalline Bedrock */}
              <div className="space-y-1">
                <h3 className="dbim-heading-3 text-text-main">
                  Deep Bedrock Aquifers: Deep Rock Water Reserves (&gt; 25 m depth)
                </h3>
                <p className="dbim-paragraph text-text-muted leading-relaxed">
                  Deep water locked in rock fractures that takes years to refill • Deep Piezometer Network
                </p>
              </div>
            </div>

            {/* Right Column: Informative Hydrogeological Stratum Diagram */}
            <div className="lg:col-span-5 space-y-2 border border-border bg-subtle/30 p-2 rounded">
              <div className="relative w-full aspect-[4/3] overflow-hidden rounded">
                <Image
                  src="/images/hydrogeological_stratum_cross_section.jpg"
                  alt="Hydrogeological cross-section schematic illustrating unconfined and fractured aquifers in India"
                  fill
                  className="object-contain"
                  sizes="(max-width: 1024px) 100vw, 40vw"
                  priority
                />
              </div>
              <p className="text-[11px] text-text-muted leading-normal px-1">
                <strong>Figure 1.1:</strong> Conceptual physical cross-section illustrating observation layers—from surface soil moisture (0–2m) down to unconfined alluvium and fractured crystalline bedrock piezometers.
              </p>
            </div>
          </div>

          {/* Compact Unboxed Coverage & Supporting Facts Row */}
          <div className="pt-2 flex flex-wrap items-center justify-between gap-y-2 text-xs text-text-muted">
            <span><strong>Authoritative Target Scope:</strong> 9 Active States across 4 Project Regions (KA, TG, TN, MP, RJ, HR, PB, ML, TR)</span>
            <span aria-hidden="true">•</span>
            <span><strong>Monitored Administrative Units:</strong> 43 Verified Active Blocks (75 Total Monitored Baseline)</span>
            <span aria-hidden="true">•</span>
            <span><strong>Data currency:</strong> varies by source; see Data Sources</span>
            <span aria-hidden="true">•</span>
            <span><strong>Inference Status:</strong> Research-stage bounds (P10–P90)</span>
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

        {/* Informative Spatial Scale Comparison Diagram */}
        <div className="border border-border bg-subtle/30 p-3 rounded space-y-2">
          <div className="relative w-full aspect-[16/9] overflow-hidden rounded">
            <Image
              src="/images/satellite_multiscale_observation_diagram.jpg"
              alt="Scientific schematic comparing spatial observation scales from in-situ point boreholes to 25km IMD grids and 100km GRACE satellite footprints"
              fill
              className="object-contain"
              sizes="(max-width: 1536px) 100vw, 1536px"
            />
          </div>
          <p className="text-[11px] text-text-muted leading-normal px-1">
            <strong>Figure 1.2:</strong> Spatial scale contrast in groundwater intelligence—comparing point piezometer boreholes (field level), 25 km IMD precipitation grids (regional level), and ~100 km NASA GRACE-FO gravimetric anomalies (catchment level).
          </p>
        </div>
      </section>

      {/* --------------------------------------------------------------------------- */}
      {/* SECTION 3: THE AMRUT DRISHTI SOLUTION */}
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
            Every module in AMRUT DRISHTI corresponds to active, functional code in the repository. We do not present future aspirations as completed features.
          </p>
        </div>

        {/* Numbered Editorial Sequence (No Cards) */}
        <div className="divide-y divide-border border-y border-border">
          {/* Module 01 */}
          <div className="py-5 grid grid-cols-1 md:grid-cols-12 gap-4 items-baseline">
            <div className="md:col-span-1 text-xs font-mono font-bold text-primary">01</div>
            <div className="md:col-span-4 space-y-1">
              <h3 className="text-sm font-bold text-text-main">Groundwater Monitoring &amp; Dual-Axis Telemetry</h3>
              <Link href="/monitoring" className="text-xs font-semibold text-primary hover:underline inline-flex items-center gap-1">
                <span>View Monitoring Charts</span>
                <span aria-hidden="true">→</span>
              </Link>
            </div>
            <div className="md:col-span-7 text-xs text-text-muted leading-relaxed">
              Integrates official Central Ground Water Board (CGWB) Digital Water Level Recorder (DWLR) automated piezometer records alongside state-level ground telemetry (e.g. MP GWD). Dual-axis charts decouple point well depth (m bgl) from regional NASA GRACE-FO gravimetric anomalies (cm). Historical dropouts and transmission interruptions are honestly preserved as gaps without zero-filling or false smoothing.
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
              Full Leaflet-based geospatial explorer rendering 43 canonical active administrative blocks across 28 districts in nine active target states. Interactive layers allow toggling Groundwater Stress Score (GSS) tiers, well water depths, 30-year IMD rainfall anomalies, and downscaled GRACE-FO mass anomalies with geodesic polygon containment.
            </div>
          </div>

          {/* Module 03 */}
          <div className="py-5 grid grid-cols-1 md:grid-cols-12 gap-4 items-baseline">
            <div className="md:col-span-1 text-xs font-mono font-bold text-primary">03</div>
            <div className="md:col-span-4 space-y-1">
              <h3 className="text-sm font-bold text-text-main">Unified Rainfall Intelligence &amp; Drought Tracking</h3>
              <Link href="/monitoring" className="text-xs font-semibold text-primary hover:underline inline-flex items-center gap-1">
                <span>Inspect Rainfall Trends</span>
                <span aria-hidden="true">→</span>
              </Link>
            </div>
            <div className="md:col-span-7 text-xs text-text-muted leading-relaxed">
              Harmonizes IMD high-resolution 0.25° gridded daily rainfall series (1901–present) with verified State Water Data Portal resources. Tracks 30-year Long Period Average (LPA) deviations, meteorological dry spell durations, and Standardized Precipitation Index (SPI) across monsoon seasons, distinguishing meteorological drought from hydrological storage response.
            </div>
          </div>

          {/* Module 04 */}
          <div className="py-5 grid grid-cols-1 md:grid-cols-12 gap-4 items-baseline">
            <div className="md:col-span-1 text-xs font-mono font-bold text-primary">04</div>
            <div className="md:col-span-4 space-y-1">
              <h3 className="text-sm font-bold text-text-main">Multi-Criteria Stress Scoring (GSS)</h3>
              <Link href="/risk-assessment" className="text-xs font-semibold text-primary hover:underline inline-flex items-center gap-1">
                <span>Inspect GSS Scoring</span>
                <span aria-hidden="true">→</span>
              </Link>
            </div>
            <div className="md:col-span-7 text-xs text-text-muted leading-relaxed">
              Computes an objective, descriptive composite index (0–100) combining well depth depletion trends, 30-year rainfall deficits, Sentinel-2 NDVI vegetative vigor, and SMAP root-zone soil moisture. GSS acts strictly as a relative prioritization tool and is clearly differentiated from calibrated event probabilities or statutory drought declarations, with mandatory human-review override capabilities.
            </div>
          </div>

          {/* Module 05 */}
          <div className="py-5 grid grid-cols-1 md:grid-cols-12 gap-4 items-baseline">
            <div className="md:col-span-1 text-xs font-mono font-bold text-primary">05</div>
            <div className="md:col-span-4 space-y-1">
              <h3 className="text-sm font-bold text-text-main">Quantile ML Forecasting &amp; Uncertainty Bounds</h3>
              <Link href="/monitoring#forecast" className="text-xs font-semibold text-primary hover:underline inline-flex items-center gap-1">
                <span>Examine Forecast Projections</span>
                <span aria-hidden="true">→</span>
              </Link>
            </div>
            <div className="md:col-span-7 text-xs text-text-muted leading-relaxed">
              Research-stage Quantile Gradient Boosted regressor (QuantileGB-v2.0) producing forward-looking 1-to-4 quarter water depth projections (m bgl) with explicit P10, P50, and P90 uncertainty intervals. Projections are strictly evaluated beside simple seasonal persistence baselines, with uncalibrated intervals explicitly marked ineligible for automatic statutory declarations.
            </div>
          </div>

          {/* Module 06 */}
          <div className="py-5 grid grid-cols-1 md:grid-cols-12 gap-4 items-baseline">
            <div className="md:col-span-1 text-xs font-mono font-bold text-primary">06</div>
            <div className="md:col-span-4 space-y-1">
              <h3 className="text-sm font-bold text-text-main">Situation-Aware Interventions &amp; Governance</h3>
              <Link href="/interventions" className="text-xs font-semibold text-primary hover:underline inline-flex items-center gap-1">
                <span>Review Interventions Catalog</span>
                <span aria-hidden="true">→</span>
              </Link>
            </div>
            <div className="md:col-span-7 text-xs text-text-muted leading-relaxed">
              Generates targeted, hydrogeologically appropriate conservation proposals (check dams, percolation tanks, injection recharge shafts, and crop rotation) linked to Ministry of Jal Shakti, PMKSY, and Atal Bhujal Yojana guidelines. All recommendations require on-site field hydrogeological validation and human officer approval before statutory execution.
            </div>
          </div>
        </div>
      </section>

      {/* --------------------------------------------------------------------------- */}
      {/* SECTION 4: END-TO-END INTELLIGENCE WORKFLOW */}
      {/* --------------------------------------------------------------------------- */}
      <section id="how-it-works" className="space-y-8 scroll-mt-20">
        <div className="max-w-3xl space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-primary">
            Intelligence Architecture
          </p>
          <h2 className="dbim-heading-2 text-text-main">
            End-to-End Groundwater Intelligence Workflow
          </h2>
          <p className="text-sm text-text-muted leading-relaxed">
            The platform follows a verified eight-stage workflow connecting raw in-situ sensor telemetry and atmospheric grids to responsible, human-governed conservation decisions.
          </p>
        </div>

        {/* Sequential 8-Stage Pipeline (Clean Editorial Grid, Open & Unboxed) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 border-y border-border py-6">
          {/* Stage 1 */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold uppercase tracking-wider text-primary">Stage 1</span>
              <span className="text-[10px] uppercase font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">Operational</span>
            </div>
            <h3 className="font-bold text-xs text-text-main">Data Collection &amp; Ingestion</h3>
            <p className="text-xs text-text-muted leading-relaxed">
              Automated ingestion from CGWB DWLR telemetry wells, State GWD records, IMD 0.25° precipitation grids, and NASA GRACE-FO gravimetry.
            </p>
          </div>

          {/* Stage 2 */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold uppercase tracking-wider text-primary">Stage 2</span>
              <span className="text-[10px] uppercase font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">Operational</span>
            </div>
            <h3 className="font-bold text-xs text-text-main">Validation &amp; Geographic Alignment</h3>
            <p className="text-xs text-text-muted leading-relaxed">
              Geodesic polygon clipping to LGD block boundaries; strict preservation of missing records and sensor dropouts without synthetic imputation.
            </p>
          </div>

          {/* Stage 3 */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold uppercase tracking-wider text-primary">Stage 3</span>
              <span className="text-[10px] uppercase font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">Operational</span>
            </div>
            <h3 className="font-bold text-xs text-text-main">Historical Trend Analysis</h3>
            <p className="text-xs text-text-muted leading-relaxed">
              Multi-year decadal drawdown rates, 30-year IMD monsoon baseline comparisons (1991–2020 LPA), and Standardized Precipitation Index (SPI) tracking.
            </p>
          </div>

          {/* Stage 4 */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold uppercase tracking-wider text-primary">Stage 4</span>
              <span className="text-[10px] uppercase font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">Operational</span>
            </div>
            <h3 className="font-bold text-xs text-text-main">Current Condition Assessment</h3>
            <p className="text-xs text-text-muted leading-relaxed">
              Real-time well depth evaluation (m bgl) contrasted against surface soil moisture (SMAP) and vegetative vigor (Sentinel-2 NDVI) canopy health.
            </p>
          </div>

          {/* Stage 5 */}
          <div className="space-y-2 border-t sm:border-t-0 pt-4 sm:pt-0 border-border">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold uppercase tracking-wider text-primary">Stage 5</span>
              <span className="text-[10px] uppercase font-semibold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">Research Prototype</span>
            </div>
            <h3 className="font-bold text-xs text-text-main">Forecasting &amp; Uncertainty</h3>
            <p className="text-xs text-text-muted leading-relaxed">
              QuantileGB-v2.0 generates 1-to-4 quarter water depth ranges (P10–P90) benchmarked against seasonal persistence baselines; strictly uncalibrated for statutory orders.
            </p>
          </div>

          {/* Stage 6 */}
          <div className="space-y-2 border-t sm:border-t-0 pt-4 sm:pt-0 border-border">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold uppercase tracking-wider text-primary">Stage 6</span>
              <span className="text-[10px] uppercase font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">Operational</span>
            </div>
            <h3 className="font-bold text-xs text-text-main">Risk Assessment &amp; GSS Scoring</h3>
            <p className="text-xs text-text-muted leading-relaxed">
              Computes descriptive Groundwater Stress Score (0–100) combining physical signals to prioritize administrative units needing urgent conservation attention.
            </p>
          </div>

          {/* Stage 7 */}
          <div className="space-y-2 border-t sm:border-t-0 pt-4 sm:pt-0 border-border">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold uppercase tracking-wider text-primary">Stage 7</span>
              <span className="text-[10px] uppercase font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">Operational</span>
            </div>
            <h3 className="font-bold text-xs text-text-main">Intervention Recommendations</h3>
            <p className="text-xs text-text-muted leading-relaxed">
              Situation-aware matching of hydrogeological constraints to MoJS/PMKSY recharge interventions (check dams, injection shafts, farm ponds, crop diversification).
            </p>
          </div>

          {/* Stage 8 */}
          <div className="space-y-2 border-t sm:border-t-0 pt-4 sm:pt-0 border-border">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold uppercase tracking-wider text-primary">Stage 8</span>
              <span className="text-[10px] uppercase font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">Operational</span>
            </div>
            <h3 className="font-bold text-xs text-text-main">Monitoring &amp; Human Governance</h3>
            <p className="text-xs text-text-muted leading-relaxed">
              Role-based review workflows with mandatory human-in-the-loop validation, risk overrides, and simulated DLT advisory alerts with audit logging.
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

        {/* Live Filter Controls & Telemetry Table (Clean DBIM Standard) */}
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4 pb-2 border-b border-border text-xs">
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-text-muted font-medium">Filter Monitored Areas:</span>

              <select
                value={selectedState}
                onChange={(e) => setSelectedState(e.target.value)}
                className="bg-subtle border border-border px-2.5 py-1 text-xs text-text-main focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="all">All 9 Active Target States</option>
                {getTargetStatesAlphabetically().map((st) => (
                  <option key={st.code} value={normalizeStateName(st.name)}>
                    {st.name}
                  </option>
                ))}
              </select>

              <select
                value={selectedSeverity}
                onChange={(e) => setSelectedSeverity(e.target.value)}
                className="bg-subtle border border-border px-2.5 py-1 text-xs text-text-main focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="all">All Severity Tiers</option>
                <option value="severe">Severe Stress Only</option>
                <option value="watch">Watch Tier Only</option>
                <option value="normal">Normal / Favorable</option>
              </select>
            </div>

            <span className="text-xs text-text-muted">
              Showing <strong className="text-text-main font-semibold">{filteredPreviewBlocks.length}</strong> preview units
            </span>
          </div>

          {/* Block Previews Table (Readable, Clean DBIM Table) */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse dbim-table">
              <thead>
                <tr className="border-b border-border bg-subtle text-text-muted font-bold text-[11px] uppercase tracking-wider">
                  <th className="py-2.5 px-3 text-left">Block (Sub-District)</th>
                  <th className="py-2.5 px-3 text-left">District &amp; State</th>
                  <th className="py-2.5 px-3 text-left">Water Stress</th>
                  <th className="py-2.5 px-3 text-right">Well Depth</th>
                  <th className="py-2.5 px-3 text-right">Rainfall Difference</th>
                  <th className="py-2.5 px-3 text-right">Satellite Storage</th>
                  <th className="py-2.5 px-3 text-right">Explore</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredPreviewBlocks.map((blk) => (
                  <tr key={blk.id} className="hover:bg-subtle/40 transition-colors">
                    <td className="py-2.5 px-3 font-semibold text-text-main">{blk.name}</td>
                    <td className="py-2.5 px-3 text-text-muted">{blk.districtName}, {blk.state}</td>
                    <td className="py-2.5 px-3">
                      <span className={`font-semibold ${
                        blk.riskSeverity === 'severe'
                          ? 'text-red-700'
                          : blk.riskSeverity === 'watch'
                          ? 'text-amber-700'
                          : 'text-emerald-700'
                      }`}>
                        {blk.riskSeverity.toUpperCase()}
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
            Every section below details the concrete problem, why it matters to Indian hydrogeology, AMRUT DRISHTI&apos;s verified response, available empirical evidence, current verification status, and remaining scientific limitations.
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
            Category B: Software &amp; Engineering Gaps
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

        {/* 2-Column Responsive Layout: Gaps Content (Left) & Dynamic Flowchart Diagram (Right) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Column: Category Gap Articles */}
          <div className="lg:col-span-7">
            {/* TAB CONTENT: CATEGORY A - RESEARCH GAPS */}
            {activeTab === 'research' && (
              <div className="space-y-8">
            {/* Gap A1 */}
            <article className="border-t border-border pt-6 space-y-3">
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold uppercase tracking-wider text-primary">Research Gap 1</span>
                  <span className="font-medium text-text-muted">Status: Implemented</span>
                </div>
                <h3 className="dbim-heading-3 text-text-main">
                  Coupling In-Situ Well Observations with Atmospheric and Gravimetric Mass Anomalies
                </h3>
              </div>
              <div className="space-y-2.5 text-text-muted">
                <p className="dbim-paragraph leading-relaxed">
                  Point borehole water levels reflect localized drawdown and recovery, but lack hydrogeological meaning without simultaneous rainfall deficit, vegetative evapotranspiration, and regional water storage trends. Treating piezometers in isolation leads to false alarms during localized pumping or delayed detection of basin-wide aquifer depletion.
                </p>
                <p className="dbim-paragraph leading-relaxed">
                  AMRUT DRISHTI&apos;s verified response integrates dual-axis time series combining in-situ CGWB DWLR well depth (mbgl) with NASA GRACE-FO gravimetric anomalies (cm w.e.) and IMD 30-year Long Period Average (1991–2020) monsoon precipitation baselines.
                </p>
                <p className="dbim-paragraph leading-relaxed text-xs">
                  Evidence and status: Chart configuration is covered by an automated test (<code>tests/monitoringVisualizations.test.ts</code>). Remaining limitations: GRACE-FO footprint (~100km) cannot resolve individual village piezometer drawdowns.
                </p>
              </div>
            </article>

            {/* Gap A2 */}
            <article className="border-t border-border pt-6 space-y-3">
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold uppercase tracking-wider text-primary">Research Gap 2</span>
                  <span className="font-medium text-text-muted">Status: Implemented</span>
                </div>
                <h3 className="dbim-heading-3 text-text-main">
                  Cross-Aquifer Comparability Across Disparate Monitoring Densities and Geology
                </h3>
              </div>
              <div className="space-y-2.5 text-text-muted">
                <p className="dbim-paragraph leading-relaxed">
                  Aquifers across India vary radically—from multi-tier alluvial plains in Punjab and Haryana to hard-rock basaltic Deccan traps in Madhya Pradesh and karst springsheds in Meghalaya. Direct comparison of raw water levels across diverse monitoring network densities misleads planners.
                </p>
                <p className="dbim-paragraph leading-relaxed">
                  AMRUT DRISHTI&apos;s verified response employs area-weighted polygon clipping and relative deviation scores (rather than raw volumetric metrics), allowing contrast across 43 blocks while preserving native hydrogeological descriptors.
                </p>
                <p className="dbim-paragraph leading-relaxed text-xs">
                  Evidence and status: Verified via <code>tests/spatialAggregation.test.ts</code> (Spherical polygon area clipping). Remaining limitations: Fractured crystalline rock requires localized pump tests to determine true specific yield.
                </p>
              </div>
            </article>

            {/* Gap A3 */}
            <article className="border-t border-border pt-6 space-y-3">
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold uppercase tracking-wider text-primary">Research Gap 3</span>
                  <span className="font-medium text-text-muted">Status: Research Only</span>
                </div>
                <h3 className="dbim-heading-3 text-text-main">
                  Groundwater Forecasting and Rigorous Baseline Evaluation
                </h3>
              </div>
              <div className="space-y-2.5 text-text-muted">
                <p className="dbim-paragraph leading-relaxed">
                  Many predictive ML models published in literature report high R² scores without comparing against simple persistence baselines (predicting last year&apos;s same-season depth) or holding out recent years, creating temporal data leakage.
                </p>
                <p className="dbim-paragraph leading-relaxed">
                  AMRUT DRISHTI&apos;s verified response: QuantileGB-v2.0 produces P10, P50 and P90 depth values. Each projection is shown beside persistence baselines. Benchmark results are provisional and do not show that the model outperforms the baselines.
                </p>
                <p className="dbim-paragraph leading-relaxed text-xs">
                  Evidence and status: Baseline and temporal-leakage checks exist in <code>tests_py/</code>; they test code behaviour, not forecast accuracy. Remaining limitations: Model intervals are uncalibrated for statutory drought relief decrees; strictly flagged RESEARCH_ONLY.
                </p>
              </div>
            </article>

            {/* Gap A4 */}
            <article className="border-t border-border pt-6 space-y-3">
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold uppercase tracking-wider text-primary">Research Gap 4</span>
                  <span className="font-medium text-text-muted">Status: Implemented</span>
                </div>
                <h3 className="dbim-heading-3 text-text-main">
                  Handling Missing Observations and Telemetric Transmission Dropouts
                </h3>
              </div>
              <div className="space-y-2.5 text-text-muted">
                <p className="dbim-paragraph leading-relaxed">
                  Real-world DWLR loggers suffer power loss, sensor fouling, and cellular dead zones. Standard data tools either drop missing periods or impute zeros, distorting groundwater depletion trends.
                </p>
                <p className="dbim-paragraph leading-relaxed">
                  AMRUT DRISHTI&apos;s verified response: Database mappers preserve null values explicitly. Charts display broken lines across missing dates with honest data-gap flags instead of interpolated values.
                </p>
                <p className="dbim-paragraph leading-relaxed text-xs">
                  Evidence and status: Verified via <code>tests/noHardcodedFallback.test.ts</code> (Zero false data points). Remaining limitations: Extended dropouts (&gt;6 months) limit the statistical power of short-term trend slope calculations.
                </p>
              </div>
            </article>

            {/* Gap A5 */}
            <article className="border-t border-border pt-6 space-y-3">
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold uppercase tracking-wider text-primary">Research Gap 5</span>
                  <span className="font-medium text-text-muted">Status: Implemented</span>
                </div>
                <h3 className="dbim-heading-3 text-text-main">
                  Interpretable Multi-Signal Indicators for Decision Support
                </h3>
              </div>
              <div className="space-y-2.5 text-text-muted">
                <p className="dbim-paragraph leading-relaxed">
                  Complex hydrogeological metrics (specific capacity, transmissivity, drawdown curves) are incomprehensible to non-technical panchayat heads and local administrators.
                </p>
                <p className="dbim-paragraph leading-relaxed">
                  AMRUT DRISHTI&apos;s verified response: Formulates the Groundwater Stress Score (GSS, 0–100) into intuitive tiers (Severe, Watch, Normal) with transparent factor breakdowns and bilingual advisories.
                </p>
                <p className="dbim-paragraph leading-relaxed text-xs">
                  Evidence and status: Verified via <code>tests/scientificEngine.test.ts</code> (Multi-criteria formula verification). Remaining limitations: GSS is a descriptive diagnostic indicator; human review is required before statutory enforcement.
                </p>
              </div>
            </article>
          </div>
        )}

        {/* TAB CONTENT: CATEGORY B - SOFTWARE & ENGINEERING GAPS */}
        {activeTab === 'software' && (
          <div className="space-y-8 max-w-4xl">
            {/* Gap B1 */}
            <article className="border-t border-border pt-6 space-y-3">
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold uppercase tracking-wider text-primary">Software Gap 1</span>
                  <span className="font-medium text-text-muted">Status: Implemented</span>
                </div>
                <h3 className="dbim-heading-3 text-text-main">
                  Unified Ingestion of Heterogeneous Government Data Feeds
                </h3>
              </div>
              <div className="space-y-2.5 text-text-muted">
                <p className="dbim-paragraph leading-relaxed">
                  Public water datasets use incompatible schemas, CRS projections (EPSG:4326 vs UTM), date formats, and naming conventions (e.g. spelling variations of district and block names).
                </p>
                <p className="dbim-paragraph leading-relaxed">
                  AMRUT DRISHTI&apos;s verified response: Built a canonical TypeScript data model (<code>BlockData</code>) with automated LGD code matching, coordinate validation, and unified JSON serialization.
                </p>
                <p className="dbim-paragraph leading-relaxed text-xs">
                  Evidence and status: Verified via <code>tests/stage6TrustworthyMonitoring.test.ts</code> (Schema mappings). Remaining limitations: Manual verification is required when local administrative re-districting changes block boundaries.
                </p>
              </div>
            </article>

            {/* Gap B2 */}
            <article className="border-t border-border pt-6 space-y-3">
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold uppercase tracking-wider text-primary">Software Gap 2</span>
                  <span className="font-medium text-text-muted">Status: Implemented</span>
                </div>
                <h3 className="dbim-heading-3 text-text-main">
                  Coupled Retrieval, Ingestion, Inference, and Presentation Workflows
                </h3>
              </div>
              <div className="space-y-2.5 text-text-muted">
                <p className="dbim-paragraph leading-relaxed">
                  Most research prototypes exist as disconnected Jupyter notebooks that never connect to a live database or user interface, preventing ongoing operational utility.
                </p>
                <p className="dbim-paragraph leading-relaxed">
                  AMRUT DRISHTI&apos;s verified response: End-to-end integration: Python data ingestion pipelines load verified tables in PostgreSQL/PostGIS, which Next.js API routes serve directly to Leaflet maps and Recharts visuals.
                </p>
                <p className="dbim-paragraph leading-relaxed text-xs">
                  Evidence and status: Verified via <code>tests_py/test_inference_pipeline.py</code> (End-to-end data flow). Remaining limitations: Offline or air-gapped deployments require local Dockerized database containers.
                </p>
              </div>
            </article>

            {/* Gap B3 */}
            <article className="border-t border-border pt-6 space-y-3">
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold uppercase tracking-wider text-primary">Software Gap 3</span>
                  <span className="font-medium text-text-muted">Status: Implemented</span>
                </div>
                <h3 className="dbim-heading-3 text-text-main">
                  Transparent Provenance and Data Freshness Tracking
                </h3>
              </div>
              <div className="space-y-2.5 text-text-muted">
                <p className="dbim-paragraph leading-relaxed">
                  Dashboards frequently show cached or years-old data with a &quot;Live&quot; label simply because the page was loaded today, misleading water authorities about data currency.
                </p>
                <p className="dbim-paragraph leading-relaxed">
                  AMRUT DRISHTI&apos;s verified response: Deployed the universal <code>FreshnessBadge</code> component across all routes, distinguishing observation date from ingestion timestamp, declaring source provider and limitations.
                </p>
                <p className="dbim-paragraph leading-relaxed text-xs">
                  Evidence and status: Verified via <code>src/lib/data/freshness.ts</code> (Strict freshness taxonomy). Remaining limitations: Upstream government telemetry feeds occasionally withhold update logs during portal maintenance.
                </p>
              </div>
            </article>

            {/* Gap B4 */}
            <article className="border-t border-border pt-6 space-y-3">
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold uppercase tracking-wider text-primary">Software Gap 4</span>
                  <span className="font-medium text-text-muted">Status: Implemented</span>
                </div>
                <h3 className="dbim-heading-3 text-text-main">
                  Strict Model Input Validation and Safe Degradation
                </h3>
              </div>
              <div className="space-y-2.5 text-text-muted">
                <p className="dbim-paragraph leading-relaxed">
                  Machine learning endpoints often crash or output bogus predictions (e.g. negative water table depths) when presented with out-of-range sensor inputs or missing parameters.
                </p>
                <p className="dbim-paragraph leading-relaxed">
                  AMRUT DRISHTI&apos;s verified response: Inference route enforces hydrogeological bounds, caps predictions to 4 quarters, and fails closed with clear error messages rather than returning unvalidated numbers.
                </p>
                <p className="dbim-paragraph leading-relaxed text-xs">
                  Evidence and status: Verified via <code>tests_py/test_quantile_model.py</code> (Bound validation). Remaining limitations: Unprecedented climate anomalies outside the training distribution widen forecast uncertainty.
                </p>
              </div>
            </article>

            {/* Gap B5 */}
            <article className="border-t border-border pt-6 space-y-3">
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold uppercase tracking-wider text-primary">Software Gap 5</span>
                  <span className="font-medium text-text-muted">Status: Implemented</span>
                </div>
                <h3 className="dbim-heading-3 text-text-main">
                  Consistent Cascading Filter Synchronization Across Modules
                </h3>
              </div>
              <div className="space-y-2.5 text-text-muted">
                <p className="dbim-paragraph leading-relaxed">
                  Complex web apps often decouple page state: selecting a block on a map fails to filter corresponding tables or charts, forcing users to repeatedly re-enter selections.
                </p>
                <p className="dbim-paragraph leading-relaxed">
                  AMRUT DRISHTI&apos;s verified response: Synchronized URL parameter binding (<code>?block=id</code>) and cascading State → District → Block selection across Overview, GIS Explorer, Monitoring, and Risk Assessment.
                </p>
                <p className="dbim-paragraph leading-relaxed text-xs">
                  Evidence and status: Verified via <code>tests/routeRegression.test.ts</code> (183 node tests pass). Remaining limitations: Browser back/forward navigation in deep filter chains requires standard URL preservation.
                </p>
              </div>
            </article>
          </div>
        )}

        {/* TAB CONTENT: CATEGORY C - PLATFORM GAPS */}
        {activeTab === 'platform' && (
          <div className="space-y-8 max-w-4xl">
            {/* Gap C1 */}
            <article className="border-t border-border pt-6 space-y-3">
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold uppercase tracking-wider text-primary">Platform Gap 1</span>
                  <span className="font-medium text-text-muted">Status: Implemented</span>
                </div>
                <h3 className="dbim-heading-3 text-text-main">
                  Unified Geographic Exploration in a Single Cohesive Interface
                </h3>
              </div>
              <div className="space-y-2.5 text-text-muted">
                <p className="dbim-paragraph leading-relaxed">
                  Users currently have to consult ISRO Bhuvan for satellite imagery, India-WRIS for surface water bodies, and CGWB reports for piezometer tables, with no unified geographic visualization.
                </p>
                <p className="dbim-paragraph leading-relaxed">
                  AMRUT DRISHTI&apos;s verified response: Provides a Leaflet-based GIS Explorer integrating block boundaries, depth contours, severity color coding, and station inspectors in one place.
                </p>
                <p className="dbim-paragraph leading-relaxed text-xs">
                  Evidence and status: Verified on <code>/explorer</code> route across all 9 approved active states. Remaining limitations: High-density vector layers require client-side tile optimization on low-bandwidth mobile devices.
                </p>
              </div>
            </article>

            {/* Gap C2 */}
            <article className="border-t border-border pt-6 space-y-3">
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold uppercase tracking-wider text-primary">Platform Gap 2</span>
                  <span className="font-medium text-text-muted">Status: Implemented</span>
                </div>
                <h3 className="dbim-heading-3 text-text-main">
                  Explicit Boundary Between Empirical Ground Truth and ML Predictions
                </h3>
              </div>
              <div className="space-y-2.5 text-text-muted">
                <p className="dbim-paragraph leading-relaxed">
                  Blurring the line between what was physically measured and what an algorithm projected can cause erroneous legal sanctions, improper crop advisories, or panic.
                </p>
                <p className="dbim-paragraph leading-relaxed">
                  AMRUT DRISHTI&apos;s verified response: Strict labeling across all pages: Physical well observations carry exact observation dates and DWLR tags; machine learning inferences are explicitly stamped RESEARCH_ONLY.
                </p>
                <p className="dbim-paragraph leading-relaxed text-xs">
                  Evidence and status: Verified via <code>tests/stage5ClaimsAndSafety.test.ts</code> (Zero false claims). Remaining limitations: Requires continuous user education so village committees understand probabilistic bounds.
                </p>
              </div>
            </article>

            {/* Gap C3 */}
            <article className="border-t border-border pt-6 space-y-3">
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold uppercase tracking-wider text-primary">Platform Gap 3</span>
                  <span className="font-medium text-text-muted">Status: Implemented</span>
                </div>
                <h3 className="dbim-heading-3 text-text-main">
                  Visibility into Geographic Observation Gaps and Sensor Distribution
                </h3>
              </div>
              <div className="space-y-2.5 text-text-muted">
                <p className="dbim-paragraph leading-relaxed">
                  Many platforms imply uniform national coverage when in reality vast regions have zero automated telemetric wells, creating a false impression of comprehensive monitoring.
                </p>
                <p className="dbim-paragraph leading-relaxed">
                  AMRUT DRISHTI&apos;s verified response: Maintains the approved nine-state scope and displays explicit &quot;Data Gap&quot; states where trusted block observations are unavailable, rather than simulated numbers.
                </p>
                <p className="dbim-paragraph leading-relaxed text-xs">
                  Evidence and status: Verified via <code>tests/nationalContrast.test.ts</code> (Honest data tags). Remaining limitations: Remote northeastern states (Meghalaya, Tripura) currently rely on baseline synchronizations pending DWLR rollouts.
                </p>
              </div>
            </article>

            {/* Gap C4 */}
            <article className="border-t border-border pt-6 space-y-3">
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold uppercase tracking-wider text-primary">Platform Gap 4</span>
                  <span className="font-medium text-text-muted">Status: Implemented</span>
                </div>
                <h3 className="dbim-heading-3 text-text-main">
                  Direct Path from Monitoring to Targeted Recharge Interventions
                </h3>
              </div>
              <div className="space-y-2.5 text-text-muted">
                <p className="dbim-paragraph leading-relaxed">
                  Monitoring data is useless if it does not inform action. Planners need specific hydrogeological recommendations matched to local soil and rainfall conditions.
                </p>
                <p className="dbim-paragraph leading-relaxed">
                  AMRUT DRISHTI&apos;s verified response: Integrates an intervention catalog linking identified stress in a block to suitable interventions (percolation tanks, check dams, injection shafts) with Atal Bhujal Yojana guidelines.
                </p>
                <p className="dbim-paragraph leading-relaxed text-xs">
                  Evidence and status: Verified on <code>/interventions</code> route. Remaining limitations: Detailed engineering designs and cost estimates require site-specific soil infiltration tests.
                </p>
              </div>
            </article>

            {/* Gap C5 */}
            <article className="border-t border-border pt-6 space-y-3">
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold uppercase tracking-wider text-primary">Platform Gap 5</span>
                  <span className="font-medium text-text-muted">Status: Implemented</span>
                </div>
                <h3 className="dbim-heading-3 text-text-main">
                  Open Architecture for Future Ingestion of IoT and Springshed Telemetry
                </h3>
              </div>
              <div className="space-y-2.5 text-text-muted">
                <p className="dbim-paragraph leading-relaxed">
                  State water boards are rolling out new telemetric sensors, community rain gauges, and springshed loggers that existing legacy platforms cannot ingest without full rewrites.
                </p>
                <p className="dbim-paragraph leading-relaxed">
                  AMRUT DRISHTI&apos;s verified response: Modular API schema and extensible database mappers accommodate additional sensors (including northeastern springshed data) without breaking API contracts.
                </p>
                <p className="dbim-paragraph leading-relaxed text-xs">
                  Evidence and status: Verified via <code>tests_py/test_springshed_engine.py</code>. Remaining limitations: Standardized transmission protocols (MQTT/CoAP) vary across state vendor contracts.
                </p>
              </div>
            </article>
          </div>
        )}
          </div>

          {/* Right Column: Dynamic Architectural Flowchart & Schema Diagram */}
          <div className="lg:col-span-5 sticky top-20">
            <figure className="space-y-3 p-3 bg-surface-alt/40 border border-border rounded">
              {activeTab === 'research' && (
                <>
                  <div className="relative aspect-[4/3] w-full overflow-hidden rounded border border-border/80 bg-surface">
                    <Image
                      src="/images/evidence_gap_analysis_infographic.jpg"
                      alt="Hydrogeological Multi-Sensor Coupling Architecture Diagram"
                      fill
                      className="object-cover"
                      sizes="(max-width: 1024px) 100vw, 40vw"
                    />
                  </div>
                  <figcaption className="text-xs text-text-muted leading-relaxed">
                    <span className="font-semibold text-text-main">Figure 6.1: Multi-Sensor Coupling Framework.</span> Synchronizing point-scale DWLR piezometers (mbgl), NASA GRACE-FO gravimetric anomalies (cm w.e.), and IMD 30-year gridded rainfall baselines.
                  </figcaption>
                </>
              )}

              {activeTab === 'software' && (
                <>
                  <div className="relative aspect-[3/4] w-full overflow-hidden rounded border border-border/80 bg-surface">
                    <Image
                      src="/images/category_b_software_pipeline_flowchart.jpg"
                      alt="Deterministic PostGIS and Row-Level Security Processing Flowchart"
                      fill
                      className="object-cover"
                      sizes="(max-width: 1024px) 100vw, 40vw"
                    />
                  </div>
                  <figcaption className="text-xs text-text-muted leading-relaxed">
                    <span className="font-semibold text-text-main">Figure 6.2: Data Ingestion &amp; Row-Level Security Pipeline.</span> Raw ingestion validation, polygon containment matching, atomic cache invalidation, and strict tenant access isolation.
                  </figcaption>
                </>
              )}

              {activeTab === 'platform' && (
                <>
                  <div className="relative aspect-[3/4] w-full overflow-hidden rounded border border-border/80 bg-surface">
                    <Image
                      src="/images/category_c_platform_governance_flowchart.jpg"
                      alt="Multi-Tier Platform Governance and Intervention Flowchart"
                      fill
                      className="object-cover"
                      sizes="(max-width: 1024px) 100vw, 40vw"
                    />
                  </div>
                  <figcaption className="text-xs text-text-muted leading-relaxed">
                    <span className="font-semibold text-text-main">Figure 6.3: Administrative Governance &amp; Action Verification.</span> Seamless escalation pathway from DWLR telemetry alert to Gram Panchayat participatory ground-validation and structural intervention deployment.
                  </figcaption>
                </>
              )}
            </figure>
          </div>
        </div>

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
                  <div className="text-[11px] text-text-muted">AMRUT DRISHTI Research Engine</div>
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
            National Ambition &amp; Nine Target Scope States
          </h2>
          <p className="text-sm text-text-muted leading-relaxed">
            While AMRUT DRISHTI is architected for pan-India scalability, verified empirical monitoring, DWLR telemetry integration, and model artifacts currently operate across nine active target states (43 verified blocks across 28 districts) grouped into four hydrologic regions.
          </p>
        </div>

        {/* Clean DBIM Subheadings & Readable Flowing Paragraphs (Balanced 2-Column Responsive Grid) */}
        <div className="border-t border-border pt-6 grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-6">
          <div className="space-y-1">
            <h3 className="dbim-heading-3 text-text-main flex items-center justify-between">
              <span>Madhya Pradesh (Central India)</span>
              <span className="text-xs font-normal text-text-muted">DWLR Live</span>
            </h3>
            <p className="dbim-paragraph text-text-muted leading-relaxed">
              Central basalt plateau &amp; hard-rock crystalline aquifers. Critical monitoring in Tikamgarh, Chhatarpur, and Gwalior districts.
            </p>
          </div>

          <div className="space-y-1">
            <h3 className="dbim-heading-3 text-text-main flex items-center justify-between">
              <span>Karnataka (South India)</span>
              <span className="text-xs font-normal text-text-muted">Telemetry Active</span>
            </h3>
            <p className="dbim-paragraph text-text-muted leading-relaxed">
              Western Ghats peripheral recharge &amp; hard-rock granitic aquifers. Monitored blocks in Shivamogga and Davanagere.
            </p>
          </div>

          <div className="space-y-1">
            <h3 className="dbim-heading-3 text-text-main flex items-center justify-between">
              <span>Telangana (South India)</span>
              <span className="text-xs font-normal text-text-muted">Telemetry Active</span>
            </h3>
            <p className="dbim-paragraph text-text-muted leading-relaxed">
              Godavari &amp; Krishna basalt/granitic plateau; empirical observation in Adilabad, Nizamabad, and peri-urban Hyderabad (Ranga Reddy).
            </p>
          </div>

          <div className="space-y-1">
            <h3 className="dbim-heading-3 text-text-main flex items-center justify-between">
              <span>Tamil Nadu (South India)</span>
              <span className="text-xs font-normal text-text-muted">Telemetry Active</span>
            </h3>
            <p className="dbim-paragraph text-text-muted leading-relaxed">
              Coastal alluvium and Noyyal hard-rock basins; automated DWLR stations in Thoothukudi, Tirunelveli, and Coimbatore.
            </p>
          </div>

          <div className="space-y-1">
            <h3 className="dbim-heading-3 text-text-main flex items-center justify-between">
              <span>Rajasthan (North India)</span>
              <span className="text-xs font-normal text-text-muted">DWLR Live</span>
            </h3>
            <p className="dbim-paragraph text-text-muted leading-relaxed">
              Arid &amp; semi-arid hard rock and deep sandstone aquifers characterized by acute depletion across Jodhpur, Nagaur, and Jaipur tracts.
            </p>
          </div>

          <div className="space-y-1">
            <h3 className="dbim-heading-3 text-text-main flex items-center justify-between">
              <span>Haryana (North India)</span>
              <span className="text-xs font-normal text-text-muted">DWLR Live</span>
            </h3>
            <p className="dbim-paragraph text-text-muted leading-relaxed">
              Western alluvial tracts with heavy agricultural draft and localized saline intrusion zones in Kurukshetra and Kaithal.
            </p>
          </div>

          <div className="space-y-1">
            <h3 className="dbim-heading-3 text-text-main flex items-center justify-between">
              <span>Punjab (North India)</span>
              <span className="text-xs font-normal text-text-muted">DWLR Live</span>
            </h3>
            <p className="dbim-paragraph text-text-muted leading-relaxed">
              Intensive agricultural irrigation belts; high over-exploitation stage and deep tube-well extraction in Sangrur and Ludhiana.
            </p>
          </div>


          <div className="space-y-1">
            <h3 className="dbim-heading-3 text-text-main flex items-center justify-between">
              <span>Meghalaya (Northeast India)</span>
              <span className="text-xs font-normal text-text-muted">Baseline Synced</span>
            </h3>
            <p className="dbim-paragraph text-text-muted leading-relaxed">
              Hilly karst and fractured sandstone springsheds; high annual precipitation with rapid post-monsoon runoff in East Khasi Hills and Ri Bhoi.
            </p>
          </div>

          <div className="space-y-1">
            <h3 className="dbim-heading-3 text-text-main flex items-center justify-between">
              <span>Tripura (Northeast India)</span>
              <span className="text-xs font-normal text-text-muted">Telemetry Active</span>
            </h3>
            <p className="dbim-paragraph text-text-muted leading-relaxed">
              Synclinal valley alluvium with high baseflow retention; telemetric station tracking in Gomati, West Tripura, and Dhalai districts.
            </p>
          </div>
        </div>
      </section>

      {/* --------------------------------------------------------------------------- */}
      {/* SECTION 9: TRANSPARENT PLATFORM IMPLEMENTATION STATUS */}
      {/* --------------------------------------------------------------------------- */}
      <section id="platform-status" className="space-y-8 scroll-mt-20">
        <div className="max-w-3xl space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-primary">
            Platform Audit &amp; Readiness Matrix
          </p>
          <h2 className="dbim-heading-2 text-text-main">
            Transparent Platform Implementation Status
          </h2>
          <p className="text-sm text-text-muted leading-relaxed">
            In accordance with scientific integrity and open governance standards, every platform capability is classified strictly by its verified runtime status in the repository. We do not conflate research prototypes with operational government systems.
          </p>
        </div>

        {/* 4-Tier Classification Matrix (Clean Editorial DBIM Grid) */}
        <div className="border-t border-border pt-6 grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Tier 1: Implemented & Verified */}
          <div className="space-y-3 border-l-2 border-emerald-600 pl-4">
            <div className="space-y-1">
              <span className="text-[10px] uppercase font-bold tracking-wider text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                Tier 1 • Implemented &amp; Verified
              </span>
              <h3 className="font-bold text-text-main text-sm">
                Operational Production Modules
              </h3>
            </div>
            <ul className="text-xs text-text-muted space-y-2 list-disc pl-4 leading-relaxed">
              <li>
                <strong>Groundwater Monitoring Telemetry:</strong> In-situ CGWB DWLR automated records and MP GWD monthly series across 43 verified active blocks with null-preserving data-gap visualization.
              </li>
              <li>
                <strong>Unified Rainfall Intelligence:</strong> 30-year IMD 0.25° gridded daily baseline (1901–present), monsoon anomaly (% deviation from LPA), dry-spell durations, and SPI drought metrics.
              </li>
              <li>
                <strong>Geospatial Map Explorer:</strong> Interactive Leaflet GIS rendering 43 active blocks, 28 districts, and 9 target states with geodesic clipping and multi-layer indicator overlays.
              </li>
              <li>
                <strong>Provenance Catalog:</strong> Transparent registry of 27 approved data source manifests disclosing observation dates, ingestion timestamps, resolution, and data quality states.
              </li>
              <li>
                <strong>Role-Based Access &amp; Audit Logs:</strong> Cryptographic tenant authentication with simulated DLT SMS advisory dispatch protocols and immutable action audit logging.
              </li>
            </ul>
          </div>

          {/* Tier 2: Implemented with Research / Validation Limitations */}
          <div className="space-y-3 border-l-2 border-amber-600 pl-4">
            <div className="space-y-1">
              <span className="text-[10px] uppercase font-bold tracking-wider text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                Tier 2 • Research &amp; Validation Limitations
              </span>
              <h3 className="font-bold text-text-main text-sm">
                Empirical Research Prototypes
              </h3>
            </div>
            <ul className="text-xs text-text-muted space-y-2 list-disc pl-4 leading-relaxed">
              <li>
                <strong>Quantile ML Forecasting (QuantileGB-v2.0):</strong> 1-to-4 quarter water table depth projections (m bgl) with P10–P90 uncertainty intervals. Evaluated against seasonal persistence baselines; strictly uncalibrated for statutory relief decree.
              </li>
              <li>
                <strong>Groundwater Stress Score (GSS):</strong> Multi-criteria heuristic composite index (0–100) weighting well trend, rainfall anomaly, soil moisture, and NDVI. Serves as prioritization support, not legal ground truth.
              </li>
              <li>
                <strong>Satellite Storage Downscaling:</strong> NASA GRACE-FO gravimetry provides catchment-scale mass variation (~100 km) and cannot resolve individual village borehole drawdowns.
              </li>
              <li>
                <strong>Intervention Recommendations:</strong> Algorithmic matching to MoJS/PMKSY catalog. Estimates unverified cost caps; requires field hydrogeological validation before sanction.
              </li>
            </ul>
          </div>

          {/* Tier 3: In Progress */}
          <div className="space-y-3 border-l-2 border-sky-600 pl-4">
            <div className="space-y-1">
              <span className="text-[10px] uppercase font-bold tracking-wider text-sky-800 bg-sky-50 px-2 py-0.5 rounded border border-sky-200">
                Tier 3 • In Progress
              </span>
              <h3 className="font-bold text-text-main text-sm">
                Active Engineering &amp; Pipeline Refinement
              </h3>
            </div>
            <ul className="text-xs text-text-muted space-y-2 list-disc pl-4 leading-relaxed">
              <li>
                <strong>Station-to-Block Telemetry Crosswalks:</strong> Continuous automated calibration mapping high-frequency state-level DWLR sensors directly to unconfined LGD block polygons.
              </li>
              <li>
                <strong>NWDP Rainfall Telemetry Ingestion:</strong> Ingestion and schema harmonization of raw state-level rain gauge telemetry from the National Water Data Portal across retained states.
              </li>
              <li>
                <strong>Block-Specific Specific Yield Calibration:</strong> Incorporating localized pumping test coefficients across Bundelkhand hard-rock basalt and crystalline granitic formations.
              </li>
            </ul>
          </div>

          {/* Tier 4: Planned */}
          <div className="space-y-3 border-l-2 border-slate-500 pl-4">
            <div className="space-y-1">
              <span className="text-[10px] uppercase font-bold tracking-wider text-slate-700 bg-slate-100 px-2 py-0.5 rounded border border-slate-300">
                Tier 4 • Planned
              </span>
              <h3 className="font-bold text-text-main text-sm">
                Future Governance &amp; Scale Architecture
              </h3>
            </div>
            <ul className="text-xs text-text-muted space-y-2 list-disc pl-4 leading-relaxed">
              <li>
                <strong>Statutory Multi-Department Interoperability:</strong> API connectors directly bridging AMRUT DRISHTI advisory outputs into State Disaster Management Authority (SDMA) drought platforms.
              </li>
              <li>
                <strong>Field-Calibrated Event Probabilities:</strong> Independent empirical validation trials converting heuristic quantiles into statistically calibrated extreme drawdown probabilities.
              </li>
              <li>
                <strong>Crowdsourced Well Verification:</strong> Mobile participatory groundwater telemetry logging for Gram Panchayat Jal Samitis under Atal Bhujal Yojana.
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* --------------------------------------------------------------------------- */}
      {/* SECTION 10: APPLICATIONS AND POTENTIAL IMPACT */}
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
            By adapting analytical depth to user roles, AMRUT DRISHTI bridges technical hydrogeology and field execution.
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
      {/* SECTION 11: SCIENTIFIC TRANSPARENCY */}
      {/* --------------------------------------------------------------------------- */}
      <section className="space-y-6 max-w-4xl border-t border-border pt-8">
        <div className="space-y-1">
          <h2 className="dbim-heading-2 text-text-main">
            Scientific Transparency &amp; Operational Safeguards
          </h2>
          <p className="dbim-caption text-text-muted">
            Methodological boundaries, physical constraints, and governance protocols
          </p>
        </div>

        <div className="space-y-5">
          <div className="space-y-1">
            <h3 className="dbim-heading-3 text-text-main">
              Forecasts are Statistical Estimates with Explicit Uncertainty
            </h3>
            <p className="dbim-paragraph text-text-muted leading-relaxed">
              Groundwater projections generated by QuantileGB-v2.0 are statistical estimates rather than deterministic predictions. Every forecast discloses P10 (optimistic), P50 (expected), and P90 (conservative) depth intervals (m bgl). Intervals are currently research prototypes and must not be treated as calibrated probabilities for emergency relief decrees.
            </p>
          </div>

          <div className="space-y-1">
            <h3 className="dbim-heading-3 text-text-main">
              Rainfall is Not Equivalent to Groundwater Recharge
            </h3>
            <p className="dbim-paragraph text-text-muted leading-relaxed">
              Monsoonal precipitation does not translate directly or uniformly into aquifer recharge. Infiltration depends heavily on soil permeability, rainfall intensity, topography, and antecedent saturation. In hard-rock or steep terrain, high-intensity showers produce rapid surface runoff rather than deep storage replenishment.
            </p>
          </div>

          <div className="space-y-1">
            <h3 className="dbim-heading-3 text-text-main">
              Groundwater Dynamics Depend on Local Hydrogeology and Anthropogenic Extraction
            </h3>
            <p className="dbim-paragraph text-text-muted leading-relaxed">
              Piezometric responses vary fundamentally across geological formations—from crystalline granites with low storage coefficient in Bundelkhand to multi-layered alluvial systems in Punjab and Haryana. Local seasonal draft for paddy-wheat irrigation can cause acute localized drawdown independent of regional atmospheric indicators.
            </p>
          </div>

          <div className="space-y-1">
            <h3 className="dbim-heading-3 text-text-main">
              Geographic Scope Depends on Verified Observation Wells and Validated Mappings
            </h3>
            <p className="dbim-paragraph text-text-muted leading-relaxed">
              Platform coverage is constrained strictly by authentic in-situ monitoring stations and validated Local Government Directory (LGD) block boundary crosswalks. Unmonitored administrative units are reported with an explicit data-gap status rather than extrapolated or simulated values.
            </p>
          </div>

          <div className="space-y-1">
            <h3 className="dbim-heading-3 text-text-main">
              Risk Scores Support Prioritization and Do Not Authorize Statutory Actions
            </h3>
            <p className="dbim-paragraph text-text-muted leading-relaxed">
              The Groundwater Stress Score (GSS 0–100) is an objective heuristic index intended to help planners prioritize field inspections and conservation investments. GSS does not independently authorize well drilling bans, emergency financial sanctions, or statutory drought relief without on-site hydrogeological verification and authorized officer review.
            </p>
          </div>

          <div className="space-y-1">
            <h3 className="dbim-heading-3 text-text-main">
              Satellite Gravimetric Footprint Disclosures
            </h3>
            <p className="dbim-paragraph text-text-muted leading-relaxed">
              NASA GRACE-FO gravimetry measures total terrestrial water storage mass variations over ~100 km grid footprints. Downscaled trends provide valuable regional catchment context but cannot resolve individual village-scale water table drawdowns or replace physical observation wells.
            </p>
          </div>

          <div className="space-y-1">
            <h3 className="dbim-heading-3 text-text-main">
              Missing Data Integrity
            </h3>
            <p className="dbim-paragraph text-text-muted leading-relaxed">
              When telemetry stations experience transmission dropouts or sensor maintenance periods, missing values are preserved as explicit nulls. The platform never fabricates measurements to create visually continuous charts.
            </p>
          </div>
        </div>
      </section>

      {/* --------------------------------------------------------------------------- */}
      {/* SECTION 12: FINAL CALL TO ACTION */}
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
            Examine in-situ piezometric observations, inspect block-level risk scores, review empirical models, and evaluate decision-support workflows across nine target states.
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
