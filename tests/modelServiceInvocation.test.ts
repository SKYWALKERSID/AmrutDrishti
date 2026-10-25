import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveModelServiceUrl, invokeGlobalForecast } from '../src/lib/services/globalForecastBridge.ts';

const input = {
  contractVersion: 'global-forecast/v1' as const,
  trustedObservationSource: 'internal_verified_block_observations' as const,
  geography: { state: 'S', district: 'D', block: 'B', blockId: 'b' },
  observations: [],
};
const res = (status: number, body: unknown = {}) => async () => new Response(JSON.stringify(body), { status });

test('resolveModelServiceUrl: explicit path verbatim, bare origin legacy, Vercel self URL', () => {
  assert.equal(resolveModelServiceUrl({ JALDRISHTI_MODEL_SERVICE_URL: 'https://x.app/api/py_forecast' }), 'https://x.app/api/py_forecast');
  assert.equal(resolveModelServiceUrl({ JALDRISHTI_MODEL_SERVICE_URL: 'https://svc.example/' }), 'https://svc.example/v1/forecast');
  assert.equal(resolveModelServiceUrl({ VERCEL: '1', VERCEL_URL: 'jal.vercel.app' }), 'https://jal.vercel.app/api/py_forecast');
  assert.equal(resolveModelServiceUrl({ VERCEL_URL: 'jal.vercel.app' }), null);
  assert.equal(resolveModelServiceUrl({ JALDRISHTI_MODEL_SERVICE_URL: 'ftp://x' }), null);
});

test('invokeGlobalForecast maps failures and never calls without token', async () => {
  const env = { JALDRISHTI_MODEL_SERVICE_URL: 'https://x.app/api/py_forecast' };
  assert.equal((await invokeGlobalForecast(input, {}, res(200) as never)).failure, 'service_not_configured');
  assert.equal((await invokeGlobalForecast(input, env, res(200) as never)).failure, 'token_missing');
  const e = { ...env, JALDRISHTI_MODEL_SERVICE_TOKEN: 't' };
  assert.equal((await invokeGlobalForecast(input, e, res(401) as never)).failure, 'unauthorized');
  assert.equal((await invokeGlobalForecast(input, e, res(400) as never)).failure, 'invalid_request');
  assert.equal((await invokeGlobalForecast(input, e, res(503) as never)).failure, 'service_error');
  assert.equal((await invokeGlobalForecast(input, e, (async () => { throw Object.assign(new Error('t'), { name: 'TimeoutError' }); }) as never)).failure, 'timeout');
  assert.equal((await invokeGlobalForecast(input, e, (async () => { throw new Error('boom'); }) as never)).failure, 'network_error');
  const ok = await invokeGlobalForecast(input, e, res(200, { status: 'research_prototype' }) as never);
  assert.equal(ok.failure, null);
  assert.equal(ok.body?.status, 'research_prototype');
});

test('bearer token is sent and bypass header only when configured', async () => {
  let seen: Record<string, string> = {};
  const spy = (async (_u: string, init: RequestInit) => { seen = init.headers as Record<string, string>; return new Response('{}'); }) as never;
  await invokeGlobalForecast(input, { JALDRISHTI_MODEL_SERVICE_URL: 'https://x.app/api/py_forecast', JALDRISHTI_MODEL_SERVICE_TOKEN: 't' }, spy);
  assert.equal(seen.Authorization, 'Bearer t');
  assert.equal(seen['x-vercel-protection-bypass'], undefined);
});
