import type { BlockData, UserRole } from '../types.ts';

/**
 * Demo-only policy helpers.
 *
 * These helpers drive the UI of a PROTOTYPE. The role is client-side demonstration
 * state (localStorage). Nothing here is authentication or server-side authorization.
 */

// ---------------------------------------------------------------------------
// Demo role boundaries (UI + handler guards only; NOT security)
// ---------------------------------------------------------------------------

/**
 * Roles that are view-only in the demonstration UI.
 * - general_public: read-only public view.
 * - gram_pradhan / jal_samiti: advisory recipients (PRD §5); they are not dashboard operators.
 */
const VIEW_ONLY_DEMO_ROLES: ReadonlyArray<UserRole> = ['general_public', 'gram_pradhan', 'jal_samiti'];

/** Whether the demo role may use mutation controls (create/comment/status/override/dispatch). */
export function canMutateDemoWorkflows(role: UserRole): boolean {
  return !VIEW_ONLY_DEMO_ROLES.includes(role);
}

export function demoRestrictionNotice(role: UserRole): string | null {
  if (canMutateDemoWorkflows(role)) return null;
  if (role === 'general_public') {
    return 'Read-only demonstration view. Mutation controls are hidden for the General Public demo role. This is a client-side prototype restriction, not server-side security.';
  }
  return 'Advisory-recipient demonstration view. Gram Pradhan and Jal Samiti are shown as advisory recipients, not dashboard operators, so mutation controls are hidden. This is a client-side prototype restriction, not server-side security.';
}

// ---------------------------------------------------------------------------
// Overview summary derived from the fixture collection
// ---------------------------------------------------------------------------

export interface FixtureSummary {
  total: number;
  severe: number;
  watch: number;
  normal: number;
  gap: number;
  severeBlocks: BlockData[];
  districtCount: number;
  meanGraceTwsaCm: number | null;
  meanRainfallAnomalyMm: number | null;
  meanWellDepthMbgl: number | null;
}

function mean(values: number[]): number | null {
  if (values.length === 0) return null;
  const m = values.reduce((a, b) => a + b, 0) / values.length;
  return Math.round(m * 10) / 10;
}

export function summarizeBlocks(blocks: BlockData[]): FixtureSummary {
  const severeBlocks = blocks.filter((b) => b.riskSeverity === 'severe');
  return {
    total: blocks.length,
    severe: severeBlocks.length,
    watch: blocks.filter((b) => b.riskSeverity === 'watch').length,
    normal: blocks.filter((b) => b.riskSeverity === 'normal').length,
    gap: blocks.filter((b) => b.riskSeverity === 'gap').length,
    severeBlocks,
    districtCount: new Set(blocks.map((b) => b.districtId)).size,
    meanGraceTwsaCm: mean(blocks.map((b) => b.indicators.graceTwsaCm)),
    meanRainfallAnomalyMm: mean(blocks.map((b) => b.indicators.rainfallAnomalyMm)),
    meanWellDepthMbgl: mean(blocks.map((b) => b.indicators.cgwbWellDepthMbgl)),
  };
}

// ---------------------------------------------------------------------------
// Shared labels
// ---------------------------------------------------------------------------

export const SIMULATED_DATA_LABEL =
  'SIMULATED DEMONSTRATION DATA — fixture values, not live observations or verified measurements.';

export const MONITORING_SERIES_LABEL =
  'SIMULATED demonstration series: one shared 6-point sample shown for every block. It is NOT a measurement or history of the selected block.';

export const MONITORING_RAINFALL_REFERENCE_LABEL =
  'Illustrative reference line (850 mm) — provenance not established.';

export const SCORE_FIXTURE_NOTICE =
  'Scores and severity classes shown here are hand-entered demonstration fixtures. They are not computed from the indicators, not calibrated, and not validated.';

export const SCHEME_UNVERIFIED_NOTICE =
  'Unverified demonstration information: funding caps, funding structure and eligibility conditions are not sourced or verified. Applicability must be confirmed by the competent official.';

// ---------------------------------------------------------------------------
// Simulated advisory policy
// ---------------------------------------------------------------------------

export const ADVISORY_DISCLAIMER_EN =
  'Decisional Advisory: Requires Local Field Verification. Not an Automated Financial Sanction.';

export const ADVISORY_DISCLAIMER_HI =
  'निर्णय-सहायता सूचना: स्थानीय क्षेत्र सत्यापन आवश्यक है। यह स्वचालित वित्तीय स्वीकृति नहीं है।';

export const NO_REAL_MESSAGE_NOTICE =
  'No real SMS or WhatsApp message is sent. Records below are simulated log entries only.';

export const SIMULATED_STATUS_LABEL = 'SIMULATED';

/** No provider is integrated, so every record is displayed as simulated. */
export function displayDeliveryStatus(): string {
  return SIMULATED_STATUS_LABEL;
}

export interface DispatchDecision {
  allowed: boolean;
  reason: string | null;
}

export function canDispatchAdvisory(block: Pick<BlockData, 'riskSeverity' | 'name'>): DispatchDecision {
  if (block.riskSeverity === 'severe' || block.riskSeverity === 'watch') {
    return { allowed: true, reason: null };
  }
  return {
    allowed: false,
    reason: `Demo dispatch is blocked for ${block.name}: severity is "${block.riskSeverity}". Only Watch or Severe demonstration records can generate a simulated advisory.`,
  };
}

const SEVERITY_EN: Record<string, string> = { severe: 'Severe stress', watch: 'Watch' };
const SEVERITY_HI: Record<string, string> = { severe: 'गंभीर तनाव', watch: 'निगरानी' };

export function buildAdvisoryMessages(
  block: Pick<BlockData, 'name' | 'districtName' | 'riskSeverity' | 'indicators'>
): { hindi: string; english: string } {
  const well = block.indicators.cgwbWellDepthMbgl;
  const rain = block.indicators.rainfallAnomalyMm;
  const sevEn = SEVERITY_EN[block.riskSeverity] ?? block.riskSeverity;
  const sevHi = SEVERITY_HI[block.riskSeverity] ?? block.riskSeverity;

  const english =
    `[SIMULATED - NOT SENT] JalDrishti demonstration advisory: "${sevEn}" signal category for ${block.name} block (${block.districtName}). ` +
    `Demonstration fixture values, not verified measurements: well depth ${well} m bgl, rainfall anomaly ${rain} mm. ` +
    ADVISORY_DISCLAIMER_EN;

  const hindi =
    `[सिम्युलेटेड - भेजा नहीं गया] जलदृष्टि प्रदर्शन सूचना: ${block.name} ब्लॉक (${block.districtName}) - "${sevHi}" संकेत श्रेणी। ` +
    `प्रदर्शन (फ़िक्स्चर) मान, सत्यापित माप नहीं: कुआँ गहराई ${well} m bgl, वर्षा विचलन ${rain} mm। ` +
    ADVISORY_DISCLAIMER_HI;

  return { hindi, english };
}
