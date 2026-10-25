import test from 'node:test';
import assert from 'node:assert/strict';
import { hasFreshTrustedObservationOrigin, isValidGlobalForecastResponse } from '../src/lib/services/globalForecastBridge.ts';

const valid = {
  status: 'research_prototype', modelIdentifier: 'GlobalBlockAwareQuantileGB-v1', modelVersion: '1.0.0',
  units: 'm bgl', intervalStatus: 'ordered_uncalibrated', operationalEligibility: false,
  geography: { state: 'Punjab', district: 'HOSHIARPUR', block: 'MUKERIAN', blockId: 'fixture' },
  originObservationDate: '2026-10-01',
  forecast: { forecasts: [{
    horizonQuarter: 1, forecastHorizonMonths: 3, targetDate: '2027-01-01', expectedDepthMbgl: 10.2, units: 'm bgl',
    uncertaintyInterval: { lowerBoundP10Mbgl: 9.9, upperBoundP90Mbgl: 10.5, isIntervalCalibrated: false, intervalStatus: 'ordered_uncalibrated' },
  }] },
};

const geography = { state: 'Punjab', district: 'HOSHIARPUR', block: 'MUKERIAN', blockId: 'fixture' };

test('global model bridge accepts only the explicit research contract', () => {
  assert.equal(isValidGlobalForecastResponse(valid, geography), true);
  assert.equal(isValidGlobalForecastResponse({ ...valid, units: 'feet' }, geography), false);
  assert.equal(isValidGlobalForecastResponse({ ...valid, operationalEligibility: true }, geography), false);
  assert.equal(isValidGlobalForecastResponse({ ...valid, intervalStatus: 'calibrated' }, geography), false);
  assert.equal(isValidGlobalForecastResponse({ ...valid, geography: { ...geography, blockId: 'other' } }, geography), false);
  assert.equal(isValidGlobalForecastResponse({ ...valid, forecast: { forecasts: [{ ...valid.forecast.forecasts[0], expectedDepthMbgl: Number.NaN }] } }, geography), false);
  assert.equal(isValidGlobalForecastResponse({ ...valid, forecast: { forecasts: [{ ...valid.forecast.forecasts[0], uncertaintyInterval: { lowerBoundP10Mbgl: 11, upperBoundP90Mbgl: 12, isIntervalCalibrated: false, intervalStatus: 'ordered_uncalibrated' } }] } }, geography), false);
});

test('trusted origin gate preserves the 400-day limit before inference', () => {
  const reference = new Date('2026-10-25T00:00:00Z');
  assert.equal(hasFreshTrustedObservationOrigin([
    { stationId: 'fixture', observationDate: '2026-01-01', depthMbgl: 10, units: 'm bgl' },
    { stationId: 'fixture', observationDate: '2026-10-01', depthMbgl: 10.2, units: 'm bgl' },
  ], reference), true);
  assert.equal(hasFreshTrustedObservationOrigin([
    { stationId: 'fixture', observationDate: '2024-01-01', depthMbgl: 10, units: 'm bgl' },
    { stationId: 'fixture', observationDate: '2024-01-02', depthMbgl: 10.2, units: 'm bgl' },
  ], reference), false);
  assert.equal(hasFreshTrustedObservationOrigin([
    { stationId: 'fixture', observationDate: '2025-09-20', depthMbgl: 10, units: 'm bgl' },
    { stationId: 'fixture', observationDate: '2025-09-20', depthMbgl: 10, units: 'm bgl' },
  ], reference), true);
  assert.equal(hasFreshTrustedObservationOrigin([
    { stationId: 'fixture', observationDate: '2025-09-19', depthMbgl: 10, units: 'm bgl' },
    { stationId: 'fixture', observationDate: '2025-09-19', depthMbgl: 10, units: 'm bgl' },
  ], reference), false);
  assert.equal(hasFreshTrustedObservationOrigin([]), false);
});

test('global model bridge validates historical research origins when allowHistoricalDemo is true', () => {
  const historicalValid = {
    ...valid,
    originObservationDate: '2023-08-20',
    forecast: {
      forecasts: [{
        horizonQuarter: 1, forecastHorizonMonths: 3, targetDate: '2023-11-20', expectedDepthMbgl: 10.2, units: 'm bgl',
        uncertaintyInterval: { lowerBoundP10Mbgl: 9.9, upperBoundP90Mbgl: 10.5, isIntervalCalibrated: false, intervalStatus: 'ordered_uncalibrated' },
      }],
    },
  };
  // Without allowHistoricalDemo, historical origin older than 400 days is rejected by standard freshness check
  assert.equal(isValidGlobalForecastResponse(historicalValid, geography), false);
  // With allowHistoricalDemo: true, structurally valid historical forecast is accepted
  assert.equal(isValidGlobalForecastResponse(historicalValid, geography, { allowHistoricalDemo: true }), true);
});
