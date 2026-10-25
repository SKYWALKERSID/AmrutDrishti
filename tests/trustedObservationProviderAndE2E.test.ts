import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getTrustedBlockObservations,
  buildTrustedGlobalModelRequest,
  buildExperimentalDemoGlobalModelRequest,
  validateObservationRecord,
} from '../src/lib/services/trustedObservationProvider.ts';
import {
  isValidGlobalForecastResponse,
  hasFreshTrustedObservationOrigin,
  type GlobalModelRequest,
} from '../src/lib/services/globalForecastBridge.ts';

test('TRUSTED-PROVIDER: getTrustedBlockObservations fails closed for unknown block', async () => {
  const result = await getTrustedBlockObservations('blk_unknown_nonexistent');
  assert.equal(result.availabilityStatus, 'unverified_station_mapping');
  assert.equal(result.observations.length, 0);
  assert.equal(result.latestObservationDate, null);
  assert.ok(result.exclusionReason?.includes('not found'));
});

test('TRUSTED-PROVIDER: manual series under NWDP paths remains excluded from unresolved NWDP telemetry', async () => {
  const tikam = await getTrustedBlockObservations('blk_tikamgarh_main');
  assert.equal(tikam.blockId, 'blk_tikamgarh_main');
  assert.equal(tikam.geography.state, 'Madhya Pradesh');
  assert.equal(tikam.availabilityStatus, 'unverified_station_mapping');
  assert.equal(tikam.provenance.units, 'm bgl');
  assert.equal(tikam.provenance.isVerifiedMapping, false);
  assert.equal(tikam.provenance.sourceOrganization, 'unavailable');
  assert.deepEqual(tikam.provenance.sourcePaths, []);
  assert.equal(tikam.observations.length, 0);
  assert.equal(tikam.latestObservationDate, null);

  // Archived / excluded block: blk_dhalai_salema (excluded from active nationwide geography)
  const salema = await getTrustedBlockObservations('blk_dhalai_salema');
  assert.equal(salema.blockId, 'blk_dhalai_salema');
  assert.equal(salema.availabilityStatus, 'unverified_station_mapping');
  assert.ok(salema.exclusionReason?.includes('not found in the nationwide monitored geography registry'));

  // Unverified station mapping block: blk_dausa_lalsot
  const lalsot = await getTrustedBlockObservations('blk_dausa_lalsot');
  assert.equal(lalsot.blockId, 'blk_dausa_lalsot');
  assert.equal(lalsot.availabilityStatus, 'unverified_station_mapping');
  assert.equal(lalsot.provenance.isVerifiedMapping, false);
});

test('TRUSTED-PROVIDER: validateObservationRecord enforces strict schema and physical bounds', () => {
  assert.equal(validateObservationRecord({
    stationId: 'st_123',
    observationDate: '2026-10-01',
    depthMbgl: 12.5,
    units: 'm bgl',
  }), true);

  // Missing or empty stationId
  assert.equal(validateObservationRecord({
    stationId: '',
    observationDate: '2026-10-01',
    depthMbgl: 12.5,
    units: 'm bgl',
  }), false);

  // Malformed date
  assert.equal(validateObservationRecord({
    stationId: 'st_123',
    observationDate: '01-10-2026',
    depthMbgl: 12.5,
    units: 'm bgl',
  }), false);

  // Invalid units
  assert.equal(validateObservationRecord({
    stationId: 'st_123',
    observationDate: '2026-10-01',
    depthMbgl: 12.5,
    units: 'feet',
  }), false);

  // Negative depth or off-scale depth
  assert.equal(validateObservationRecord({
    stationId: 'st_123',
    observationDate: '2026-10-01',
    depthMbgl: -5.0,
    units: 'm bgl',
  }), false);

  assert.equal(validateObservationRecord({
    stationId: 'st_123',
    observationDate: '2026-10-01',
    depthMbgl: 999.0,
    units: 'm bgl',
  }), false);

  assert.equal(validateObservationRecord({
    stationId: 'st_123',
    observationDate: '2026-10-01',
    depthMbgl: Number.NaN,
    units: 'm bgl',
  }), false);
});

test('TRUSTED-PROVIDER: buildTrustedGlobalModelRequest returns null for stale or unverified blocks', async () => {
  const reqTikam = await buildTrustedGlobalModelRequest('blk_tikamgarh_main');
  assert.equal(reqTikam, null);

  const reqLalsot = await buildTrustedGlobalModelRequest('blk_dausa_lalsot');
  assert.equal(reqLalsot, null);
});

test('INTEGRATION: Mocked end-to-end pipeline flow with valid research fixture', async () => {
  // Test fixture representing verified fresh observations
  const fixtureRequest: GlobalModelRequest = {
    contractVersion: 'global-forecast/v1',
    trustedObservationSource: 'internal_verified_block_observations',
    geography: {
      state: 'Punjab',
      district: 'HOSHIARPUR',
      block: 'MUKERIAN',
      blockId: 'blk_test_mukerian',
    },
    observations: [
      { stationId: 'CGWB_PB_101', observationDate: '2026-06-01', depthMbgl: 12.2, units: 'm bgl' },
      { stationId: 'CGWB_PB_101', observationDate: '2026-09-30', depthMbgl: 12.8, units: 'm bgl' },
    ],
  };

  // 1. Freshness gate evaluation on trusted observations
  assert.equal(hasFreshTrustedObservationOrigin(fixtureRequest.observations), true);

  // 2. Simulated private model serving response
  const mockedServiceResponse = {
    status: 'research_prototype',
    modelIdentifier: 'GlobalBlockAwareQuantileGB-v1',
    modelVersion: '1.0.0',
    geography: fixtureRequest.geography,
    originObservationDate: '2026-09-30',
    units: 'm bgl',
    intervalStatus: 'ordered_uncalibrated',
    operationalEligibility: false,
    forecast: {
      forecasts: [
        {
          horizonQuarter: 1,
          forecastHorizonMonths: 3,
          targetDate: '2026-12-31',
          expectedDepthMbgl: 13.1,
          units: 'm bgl',
          uncertaintyInterval: {
            lowerBoundP10Mbgl: 11.5,
            upperBoundP90Mbgl: 14.8,
            isIntervalCalibrated: false,
            intervalStatus: 'ordered_uncalibrated',
          },
        },
        {
          horizonQuarter: 2,
          forecastHorizonMonths: 6,
          targetDate: '2027-03-31',
          expectedDepthMbgl: 13.5,
          units: 'm bgl',
          uncertaintyInterval: {
            lowerBoundP10Mbgl: 11.8,
            upperBoundP90Mbgl: 15.2,
            isIntervalCalibrated: false,
            intervalStatus: 'ordered_uncalibrated',
          },
        },
      ],
    },
  };

  // 3. Service bridge response validation
  const isValid = isValidGlobalForecastResponse(mockedServiceResponse, fixtureRequest.geography);
  assert.equal(isValid, true);

  // 4. Integrity checks: non-crossing quantiles and operational eligibility false
  const p1 = mockedServiceResponse.forecast.forecasts[0];
  assert.ok(p1.uncertaintyInterval.lowerBoundP10Mbgl <= p1.expectedDepthMbgl);
  assert.ok(p1.expectedDepthMbgl <= p1.uncertaintyInterval.upperBoundP90Mbgl);
  assert.equal(mockedServiceResponse.operationalEligibility, false);
});

test('ADAPTIVE-DATA: getTrustedBlockObservations resolves historical series and mode for verified blocks', async () => {
  const tikam = await getTrustedBlockObservations('blk_tikamgarh_main');
  assert.equal(tikam.blockId, 'blk_tikamgarh_main');
  assert.equal(tikam.dataAvailabilityMode, 'unavailable');
  assert.equal(tikam.observations.length, 0);
  assert.equal(tikam.observationDatesRange.endDate, null);
});

test('ADAPTIVE-DATA: does not merge caller-supplied observations into an unmapped block', async () => {
  const tikam = await getTrustedBlockObservations('blk_tikamgarh_main');
  const stn = tikam.stationId || 'fixture-stn';

  const recentObs = [
    { stationId: stn, observationDate: '2026-06-01', depthMbgl: 6.5, units: 'm bgl' as const },
    { stationId: stn, observationDate: '2026-10-01', depthMbgl: 7.2, units: 'm bgl' as const },
  ];

  const adaptiveResult = await getTrustedBlockObservations('blk_tikamgarh_main', {
    additionalVerifiedObservations: recentObs,
  });

  assert.equal(adaptiveResult.dataAvailabilityMode, 'unavailable');
  assert.equal(adaptiveResult.latestObservationDate, null);
  assert.equal(adaptiveResult.observationDatesRange.endDate, null);
  assert.equal(adaptiveResult.observations.length, 0);

  // Incompatible station is rejected from adaptive merge
  const mismatchedObs = [
    { stationId: 'completely_different_well', observationDate: '2026-10-01', depthMbgl: 7.2, units: 'm bgl' as const },
  ];
  const rejectedResult = await getTrustedBlockObservations('blk_tikamgarh_main', {
    additionalVerifiedObservations: mismatchedObs,
  });
  assert.equal(rejectedResult.dataAvailabilityMode, 'unavailable');
});

test('ADAPTIVE-DATA: demo requests resolve verified historical CGWB series while operational requests enforce operational freshness and unmapped blocks fail closed', async () => {
  // Historical CGWB series is verified for Tikamgarh and resolves for research demo
  const demoPayload = await buildExperimentalDemoGlobalModelRequest('blk_tikamgarh_main');
  assert.ok(demoPayload !== null);
  assert.equal(demoPayload.dataAvailabilityMode, 'historical_only_demo');
  assert.equal(demoPayload.observationDatesRange.startDate, '2021-01-10');
  assert.equal(demoPayload.observationDatesRange.endDate, '2023-08-20');
  assert.equal(demoPayload.request.geography.blockId, 'blk_tikamgarh_main');
  assert.equal(demoPayload.request.observations.length, 10);

  // Operational request must still return null for stale blocks (operational freshness requirement)
  const opRequest = await buildTrustedGlobalModelRequest('blk_tikamgarh_main');
  assert.equal(opRequest, null);

  // Unverified mapping blocks without verified historical or telemetry data must fail closed even in demo mode
  const unverifiedDemo = await buildExperimentalDemoGlobalModelRequest('blk_dausa_lalsot');
  assert.equal(unverifiedDemo, null);
});
