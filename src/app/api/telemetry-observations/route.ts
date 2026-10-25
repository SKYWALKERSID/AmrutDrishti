import { NextRequest, NextResponse } from 'next/server';
import trainedStations from '../../../../data/derived/nwdp_trained_station_series.json' with { type: 'json' };

export const dynamic = 'force-dynamic';

interface StationRecord {
  station_key: string;
  station_name: string;
  state: string;
  district: string;
  source_files: string[];
  observation_count: number;
  date_range: string[];
  latest_date: string;
  observations: Array<{ date: string; depthMbgl: number }>;
}

const catalog = trainedStations as unknown as Record<string, StationRecord>;

/**
 * GET /api/telemetry-observations
 * Query parameters:
 * - stationId (optional): specific station key (e.g., "Haryana::KARNAL::ChocftraPz")
 * - state (optional): filter stations by state name
 * - district (optional): filter stations by district name
 * - limit (optional): observation points limit per station (default 1000)
 * - stations (optional): if "true", returns list of available telemetry stations
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const wantStationList = searchParams.get('stations') === 'true';
  const stationId = searchParams.get('stationId');
  const state = searchParams.get('state');
  const district = searchParams.get('district');
  const limit = Math.min(Math.max(Number(searchParams.get('limit') || '1500'), 1), 5000);

  // Return station inventory/catalog
  if (wantStationList) {
    const list = Object.values(catalog).map((stn) => ({
      stationId: stn.station_key,
      stationName: stn.station_name,
      state: stn.state,
      district: stn.district,
      observationCount: stn.observation_count,
      earliestDate: stn.date_range[0],
      latestDate: stn.date_range[1],
      sourceFiles: stn.source_files,
    }));

    let filtered = list;
    if (state && state !== 'all') {
      filtered = filtered.filter((s) => s.state.toLowerCase() === state.toLowerCase());
    }
    if (district && district !== 'all') {
      filtered = filtered.filter((s) => s.district.toLowerCase() === district.toLowerCase());
    }

    filtered.sort((a, b) => a.stationName.localeCompare(b.stationName));

    return NextResponse.json({
      status: 'available',
      source: 'nwdp_telemetry_dwlr_automated',
      sourceOrganization: 'NWDP / NWIC Telemetry',
      measurementType: 'automated_six_hourly_telemetry_aggregated_daily',
      units: 'm bgl',
      count: filtered.length,
      stations: filtered,
    });
  }

  // If specific station requested
  if (stationId) {
    const stn = catalog[stationId];
    if (!stn) {
      return NextResponse.json(
        {
          error: 'Station telemetry not found',
          stationId,
          availableStationsCount: Object.keys(catalog).length,
        },
        { status: 404 }
      );
    }

    const obsSlice = stn.observations.slice(-limit);

    return NextResponse.json({
      status: 'available',
      source: 'nwdp_telemetry_dwlr_automated',
      sourceOrganization: 'NWDP / NWIC Telemetry',
      measurementType: 'automated_six_hourly_telemetry_aggregated_daily',
      units: 'm bgl',
      stationId: stn.station_key,
      stationName: stn.station_name,
      state: stn.state,
      district: stn.district,
      sourceFiles: stn.source_files,
      totalObservations: stn.observation_count,
      earliestDate: stn.date_range[0],
      latestDate: stn.date_range[1],
      provenance: {
        datasetScope: '18 NWDP Telemetry Datasets (2021–2025 & 2026–2030)',
        aggregation: 'daily median of 6-hourly automated DWLR readings',
        verifiedDateRange: `${stn.date_range[0]} to ${stn.date_range[1]}`,
        isObservedHistory: true,
      },
      observations: obsSlice.map((o) => ({
        station_id: stn.station_key,
        station_name: stn.station_name,
        state: stn.state,
        district_name: stn.district,
        observation_date: o.date,
        water_level_mbgl: o.depthMbgl,
        unit: 'm bgl',
        quality_flag: 'verified_dwlr_telemetry',
        source_name: 'NWDP Automated Telemetry',
        source_provider: 'NWIC / CGWB',
        source_resource_url: 'https://nwdp.nwic.gov.in',
      })),
    });
  }

  // Default: if state or district provided, return matching stations or default first station
  let matchingStations = Object.values(catalog);
  if (state && state !== 'all') {
    matchingStations = matchingStations.filter((s) => s.state.toLowerCase() === state.toLowerCase());
  }
  if (district && district !== 'all') {
    matchingStations = matchingStations.filter((s) => s.district.toLowerCase() === district.toLowerCase());
  }

  if (matchingStations.length === 0) {
    return NextResponse.json({
      status: 'empty',
      source: 'nwdp_telemetry_dwlr_automated',
      message: 'No telemetry stations found for the specified state or district.',
      matchingCount: 0,
      observations: [],
    });
  }

  // Return the highest-count station in this geography
  matchingStations.sort((a, b) => b.observation_count - a.observation_count);
  const primaryStation = matchingStations[0];
  const obsSlice = primaryStation.observations.slice(-limit);

  return NextResponse.json({
    status: 'available',
    source: 'nwdp_telemetry_dwlr_automated',
    sourceOrganization: 'NWDP / NWIC Telemetry',
    measurementType: 'automated_six_hourly_telemetry_aggregated_daily',
    units: 'm bgl',
    stationId: primaryStation.station_key,
    stationName: primaryStation.station_name,
    state: primaryStation.state,
    district: primaryStation.district,
    sourceFiles: primaryStation.source_files,
    totalObservations: primaryStation.observation_count,
    earliestDate: primaryStation.date_range[0],
    latestDate: primaryStation.date_range[1],
    availableStationsInGeography: matchingStations.map((s) => ({
      stationId: s.station_key,
      stationName: s.station_name,
      district: s.district,
      observationCount: s.observation_count,
      latestDate: s.date_range[1],
    })),
    provenance: {
      datasetScope: '18 NWDP Telemetry Datasets (2021–2025 & 2026–2030)',
      aggregation: 'daily median of 6-hourly automated DWLR readings',
      verifiedDateRange: `${primaryStation.date_range[0]} to ${primaryStation.date_range[1]}`,
      isObservedHistory: true,
    },
    observations: obsSlice.map((o) => ({
      station_id: primaryStation.station_key,
      station_name: primaryStation.station_name,
      state: primaryStation.state,
      district_name: primaryStation.district,
      observation_date: o.date,
      water_level_mbgl: o.depthMbgl,
      unit: 'm bgl',
      quality_flag: 'verified_dwlr_telemetry',
      source_name: 'NWDP Automated Telemetry',
      source_provider: 'NWIC / CGWB',
      source_resource_url: 'https://nwdp.nwic.gov.in',
    })),
  });
}
