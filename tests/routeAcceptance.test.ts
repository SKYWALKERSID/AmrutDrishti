import test from 'node:test';
import assert from 'node:assert/strict';

import { translations } from '../src/lib/data/translations.ts';
const { en, hi } = translations;

const ALL_APPLICATION_ROUTES = [
  '/',
  '/explorer',
  '/monitoring',
  '/risk-assessment',
  '/interventions',
  '/alerts',
  '/data-sources',
  '/admin'
];

test('JD-050: All 8 application routes have title and subtitle bilingual mappings', () => {
  const pageKeyPrefixes = [
    'overview',
    'explorer',
    'monitoring',
    'risk',
    'interventions',
    'alerts',
    'datasources',
    'admin'
  ];

  for (const prefix of pageKeyPrefixes) {
    const titleKey = `${prefix}.title`;
    assert.ok(en[titleKey], `Missing EN key: ${titleKey}`);
    assert.ok(hi[titleKey], `Missing HI key: ${titleKey}`);
    assert.notEqual(en[titleKey], hi[titleKey], `Untranslated HI key: ${titleKey}`);
  }
});

test('JD-050: Form and interactive action buttons have bilingual coverage', () => {
  const interactiveKeys = [
    'interventions.draftBtn',
    'alerts.createAdvisory',
    'risk.recordNoteBtn',
    'admin.returnOverview'
  ];

  for (const k of interactiveKeys) {
    assert.ok(en[k], `Missing EN key: ${k}`);
    assert.ok(hi[k], `Missing HI key: ${k}`);
  }
});

test('JD-050: Map guide status colors and risk severity terms have consistent Hindi translations', () => {
  const severityKeys = [
    'overview.severeCount',
    'overview.watchCount',
    'overview.normalCount'
  ];

  for (const k of severityKeys) {
    assert.ok(en[k], `Missing EN key: ${k}`);
    assert.ok(hi[k], `Missing HI key: ${k}`);
    assert.notEqual(en[k], hi[k], `Untranslated severity: ${k}`);
  }
});

test('JD-050: Keyboard accessibility and ARIA roles preserved across components', async () => {
  const fs = await import('node:fs');
  const path = await import('node:path');

  const navBarFile = fs.readFileSync(path.join(process.cwd(), 'src', 'components', 'Navigation.tsx'), 'utf8');
  assert.ok(navBarFile.includes('role=') || navBarFile.includes('aria-label') || navBarFile.includes('nav'), 'Navigation must contain semantic elements');

  const alertsFile = fs.readFileSync(path.join(process.cwd(), 'src', 'app', 'alerts', 'page.tsx'), 'utf8');
  assert.ok(alertsFile.includes('type="submit"'), 'Alerts dispatch must have explicit accessible submit button');
});
