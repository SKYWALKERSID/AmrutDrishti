import { NextRequest, NextResponse } from 'next/server';
import fs from 'node:fs';
import path from 'node:path';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

interface RainfallQueryResponse {
  status: 'available' | 'unavailable';
  districtName?: string;
  stateName?: string;
  historicalIntelligence?: any;
  forecast?: any;
  provenance?: any;
  reason?: string;
}

export async function GET(request: NextRequest) {
  const districtParam = request.nextUrl.searchParams.get('district');
  const stateParam = request.nextUrl.searchParams.get('state');
  const isListRequest = request.nextUrl.searchParams.get('list') === 'true';

  const intelPath = path.join(process.cwd(), 'data/derived/rainfall/historical_rainfall_intelligence.json');
  const forecastPath = path.join(process.cwd(), 'ml/artifacts/rainfall_forecast_registry.json');
  const reportPath = path.join(process.cwd(), 'data/derived/rainfall/unified_rainfall_validation_report.json');

  if (!fs.existsSync(intelPath) || !fs.existsSync(forecastPath)) {
    return NextResponse.json({
      status: 'unavailable',
      reason: 'Rainfall intelligence models or datasets not yet compiled.',
      operationalEligibility: false
    }, { status: 503 });
  }

  const intelligenceRegistry = JSON.parse(fs.readFileSync(intelPath, 'utf-8'));
  const forecastRegistry = JSON.parse(fs.readFileSync(forecastPath, 'utf-8'));
  const validationReport = fs.existsSync(reportPath) ? JSON.parse(fs.readFileSync(reportPath, 'utf-8')) : null;

  if (isListRequest) {
    const districts = Object.keys(intelligenceRegistry).map(k => {
      const [state, dist] = k.split('::');
      return { state, district: dist, key: k };
    });
    return NextResponse.json({
      status: 'available',
      districtsCount: districts.length,
      districts,
      validationReport
    });
  }

  if (!districtParam) {
    return NextResponse.json({
      status: 'unavailable',
      reason: 'district parameter required (e.g. ?district=Karnal or ?state=Haryana&district=Karnal)'
    }, { status: 400 });
  }

  const cleanDistrict = districtParam.trim().toLowerCase();
  const cleanState = stateParam ? stateParam.trim().toLowerCase() : null;

  let matchedKey: string | null = null;
  for (const k of Object.keys(intelligenceRegistry)) {
    const [st, dt] = k.split('::');
    const dtMatch = dt.toLowerCase() === cleanDistrict || dt.toLowerCase().replace(/[^a-z0-9]/g, '') === cleanDistrict.replace(/[^a-z0-9]/g, '');
    const stMatch = !cleanState || st.toLowerCase() === cleanState || st.toLowerCase().replace(/[^a-z0-9]/g, '') === cleanState.replace(/[^a-z0-9]/g, '');
    if (dtMatch && stMatch) {
      matchedKey = k;
      break;
    }
  }

  if (!matchedKey) {
    return NextResponse.json({
      status: 'unavailable',
      reason: `No verified rainfall observation series or forecast calibrated for district '${districtParam}'. AMRUT DRISHTI enforces fail-closed transparency and does not extrapolate uncalibrated rainfall predictions.`,
      operationalEligibility: false
    }, { status: 404 });
  }

  const intel = intelligenceRegistry[matchedKey];
  const fc = forecastRegistry[matchedKey] || null;

  const response: RainfallQueryResponse = {
    status: 'available',
    stateName: intel.state,
    districtName: intel.district,
    historicalIntelligence: intel,
    forecast: fc,
    provenance: {
      dataSources: [
        'IMD Official 30-Year Climatological Normals (1991-2020)',
        'NWDP IMD DistrictWise Daily Observation Series (2026)',
        'NWDP State Water Resources Department Records'
      ],
      methodology: 'Integrated Daily IMD-NWDP Harmonization & Time-Aware Quantile Forecasting',
      validationStatus: 'verified_post_2024_actual_observations',
      latestObservationDate: intel.latest_observation_date
    }
  };

  return NextResponse.json(response, {
    headers: {
      'Cache-Control': 'no-store'
    }
  });
}
