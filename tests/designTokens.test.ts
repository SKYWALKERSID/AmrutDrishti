import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { CHART_COLORS } from '../src/lib/design/chartPalette.ts';
import { MAP_COLORS, MAP_COLOR_TOKENS } from '../src/lib/design/mapPalette.ts';
import { FRESHNESS_STYLES, type FreshnessStatus } from '../src/lib/data/freshness.ts';

function parseCssRootTokens(cssContent: string): Map<string, string> {
  const rootMatch = cssContent.match(/:root\s*\{([\s\S]*?)\}/);
  assert.ok(rootMatch, 'globals.css must contain a :root definition block');
  const body = rootMatch[1];

  const tokens = new Map<string, string>();
  const lineRegex = /(--[a-zA-Z0-9_-]+)\s*:\s*([^;]+);/g;
  let match: RegExpExecArray | null;
  while ((match = lineRegex.exec(body)) !== null) {
    const name = match[1].trim();
    const value = match[2].trim().toLowerCase();
    tokens.set(name, value);
  }
  return tokens;
}

test('Design Tokens: globals.css has valid canonical tokens without circular references', () => {
  const globalsCss = fs.readFileSync('src/app/globals.css', 'utf8');
  const tokens = parseCssRootTokens(globalsCss);

  assert.ok(tokens.size > 20, 'globals.css :root should declare authoritative design tokens');

  // Verify no token definition references another var(--token) circularly or indirectly in :root
  for (const [name, val] of tokens.entries()) {
    assert.doesNotMatch(
      val,
      /var\s*\(/i,
      `Token ${name} must define canonical literal/computed value, not an indirect var() reference`
    );
  }
});

test('Design Tokens: No duplicate CSS custom property definitions in globals.css :root', () => {
  const globalsCss = fs.readFileSync('src/app/globals.css', 'utf8');
  const rootMatch = globalsCss.match(/:root\s*\{([\s\S]*?)\}/);
  assert.ok(rootMatch);
  const body = rootMatch[1];

  const seen = new Set<string>();
  const duplicates: string[] = [];
  const lineRegex = /(--[a-zA-Z0-9_-]+)\s*:/g;
  let match: RegExpExecArray | null;
  while ((match = lineRegex.exec(body)) !== null) {
    const varName = match[1];
    if (seen.has(varName)) {
      duplicates.push(varName);
    }
    seen.add(varName);
  }

  assert.deepEqual(duplicates, [], `Found duplicate CSS token declarations in :root: ${duplicates.join(', ')}`);
});

test('Design Tokens: Chart palette tokens exist in globals.css', () => {
  const globalsCss = fs.readFileSync('src/app/globals.css', 'utf8');
  const tokens = parseCssRootTokens(globalsCss);

  for (const [key, varExpr] of Object.entries(CHART_COLORS)) {
    const match = varExpr.match(/^var\((--[a-zA-Z0-9_-]+)\)$/);
    assert.ok(match, `CHART_COLORS.${key} must be in 'var(--token)' format, found '${varExpr}'`);
    const varName = match[1];
    assert.ok(
      tokens.has(varName),
      `CHART_COLORS.${key} references '${varName}' which must exist in globals.css :root`
    );
  }
});

test('Design Tokens: Map palette drift-guard ensures resolved hex values match globals.css tokens', () => {
  const globalsCss = fs.readFileSync('src/app/globals.css', 'utf8');
  const tokens = parseCssRootTokens(globalsCss);

  for (const [key, tokenName] of Object.entries(MAP_COLOR_TOKENS)) {
    assert.ok(
      tokens.has(tokenName),
      `MAP_COLOR_TOKENS.${key} references '${tokenName}' which must exist in globals.css`
    );

    const expectedHex = tokens.get(tokenName)!.split('/*')[0].trim().toLowerCase();
    const actualHex = (MAP_COLORS as Record<string, string>)[key].toLowerCase();

    assert.equal(
      actualHex,
      expectedHex,
      `MAP_COLORS.${key} resolved value '${actualHex}' has drifted from globals.css token ${tokenName} ('${expectedHex}')`
    );
  }
});

test('Design Tokens: LeafletMap component contains no hardcoded colour literals in render options', () => {
  const mapCode = fs.readFileSync('src/components/LeafletMap.tsx', 'utf8');

  // Verify no literal hex color codes exist in LeafletMap.tsx
  const hexMatches = mapCode.match(/#[0-9a-fA-F]{3,6}\b/g) || [];
  assert.deepEqual(
    hexMatches,
    [],
    `LeafletMap.tsx should have no hardcoded hex literals. Found: ${hexMatches.join(', ')}`
  );
});

test('Design Tokens: Monitoring page contains no hardcoded colour literals in chart elements', () => {
  const monitoringCode = fs.readFileSync('src/app/monitoring/page.tsx', 'utf8');

  // Verify lines around chart rendering (lines 460-640) have no raw hex literals
  const hexMatches = monitoringCode.match(/#[0-9a-fA-F]{3,6}\b/g) || [];
  assert.deepEqual(
    hexMatches,
    [],
    `monitoring/page.tsx should have no hardcoded hex literals. Found: ${hexMatches.join(', ')}`
  );
});

test('Design Tokens: FRESHNESS_STYLES contains no arbitrary hex utilities and covers all 8 statuses', () => {
  const freshnessCode = fs.readFileSync('src/lib/data/freshness.ts', 'utf8');

  // No arbitrary hex class names like [#123456]
  assert.doesNotMatch(
    freshnessCode,
    /\[#[0-9a-fA-F]{3,8}\]/,
    'FRESHNESS_STYLES must not use Tailwind arbitrary hex classes'
  );

  const statuses: FreshnessStatus[] = [
    'LIVE',
    'RECENT',
    'HISTORICAL',
    'RESEARCH_ONLY',
    'DEMO',
    'STALE',
    'UNAVAILABLE',
    'ERROR',
  ];

  for (const s of statuses) {
    const style = FRESHNESS_STYLES[s];
    assert.ok(style, `Status ${s} must have an entry in FRESHNESS_STYLES`);
    assert.ok(style.bg, `Status ${s} must have bg classes`);
    assert.ok(style.text, `Status ${s} must have text classes`);
    assert.ok(style.border, `Status ${s} must have border classes`);
    assert.ok(style.dot, `Status ${s} must have dot classes`);
    assert.ok(style.label, `Status ${s} must have a label`);
  }
});
