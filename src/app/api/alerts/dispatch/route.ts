import { dispatchDltSms, type DltSmsPayload } from '../../../../lib/services/smsService.ts';
import {
  getServerUserContext,
  validateJsonContentType,
  checkRateLimit,
} from '../../../../lib/auth/serverAuth.ts';
import {
  authorizeAction,
  isGlobalAlertKillSwitchActive,
} from '../../../../lib/services/governanceService.ts';

export const dynamic = 'force-dynamic';

/**
 * Read-only health contract used by the administration dashboard. It does not
 * inspect credentials or make an outbound request, so opening the dashboard
 * can never trigger an advisory delivery.
 */
export async function GET() {
  return Response.json({
    service: 'advisory_dispatch',
    status: 'available',
    simulationDefault: true,
    operationalEligibility: false,
  });
}

export async function POST(request: Request) {
  try {
    // 1. Content-Type validation
    const ctCheck = validateJsonContentType(request);
    if (!ctCheck.valid) {
      return Response.json({ success: false, error: ctCheck.error }, { status: 415 });
    }

    // 2. Parse & validate request body
    let body: DltSmsPayload;
    try {
      body = await request.json();
    } catch {
      return Response.json(
        { success: false, error: 'Malformed JSON payload' },
        { status: 400 }
      );
    }

    if (
      !body ||
      typeof body !== 'object' ||
      !body.recipientPhone ||
      !body.messageText ||
      !body.districtName ||
      !body.blockName
    ) {
      return Response.json(
        {
          success: false,
          error: 'Missing required dispatch fields (recipientPhone, messageText, districtName, blockName)',
        },
        { status: 400 }
      );
    }

    // Validate phone number format (must contain at least 10 digits)
    const phoneDigits = String(body.recipientPhone).replace(/\D/g, '');
    if (phoneDigits.length < 10) {
      return Response.json(
        {
          success: false,
          error: 'Invalid recipient phone number format. Minimum 10 digits required.',
        },
        { status: 400 }
      );
    }

    // 3. Authenticate caller
    const user = await getServerUserContext(request);
    if (!user.isAuthenticated) {
      if (user.role === 'general_public' && user.userId === 'demo-public-user') {
        return Response.json(
          { success: false, error: 'General public role cannot dispatch advisory alerts' },
          { status: 403 }
        );
      }
      return Response.json(
        { success: false, error: 'Authentication required to dispatch advisory alerts' },
        { status: 401 }
      );
    }

    // 4. Rate limiting per caller (max 10 dispatches per minute)
    const rateLimitKey = `dispatch_${user.userId || 'req'}`;
    const rateStatus = checkRateLimit(rateLimitKey, 10, 60_000);
    if (!rateStatus.allowed) {
      return Response.json(
        {
          success: false,
          error: 'Rate limit exceeded for alert dispatches. Maximum 10 dispatches per minute.',
        },
        { status: 429 }
      );
    }

    // 5. Authorize action and district jurisdiction
    const authResult = authorizeAction(user, 'dispatch_advisory_alert', body.districtName);
    if (!authResult.isAuthorized) {
      return Response.json(
        {
          success: false,
          error: authResult.reason || 'Forbidden: insufficient privileges to dispatch advisory alert',
        },
        { status: 403 }
      );
    }

    // 6. Check Emergency Kill Switch
    if (isGlobalAlertKillSwitchActive()) {
      return Response.json(
        {
          success: false,
          error: 'Emergency Alert Kill Switch is ACTIVE. All advisory dispatches are frozen.',
        },
        { status: 423 }
      );
    }

    // 7. Dispatch via DLT Gateway integration
    const result = await dispatchDltSms(body);
    return Response.json(result);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Dispatch failed';
    return Response.json({ success: false, error: msg }, { status: 500 });
  }
}
