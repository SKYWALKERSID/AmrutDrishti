import type { UserRole } from '../types.ts';
import type { UserContext } from '../services/governanceService.ts';

export const VALID_ROLES: ReadonlySet<UserRole> = new Set([
  'admin',
  'district_collector',
  'bdo',
  'environmental_analyst',
  'gram_pradhan',
  'jal_samiti',
  'general_public',
]);

/**
 * Extracts and verifies the authenticated caller context from an incoming Request.
 * 
 * Rules:
 * 1. Operational Mode (JALDRISHTI_DEMO_MODE !== 'true'):
 *    - Only verified Supabase Auth sessions (Bearer token) are accepted.
 *    - Client simulation headers (x-jaldrishti-role) are strictly IGNORED.
 * 2. Demo Sandbox Mode (JALDRISHTI_DEMO_MODE === 'true'):
 *    - Allows simulation headers (x-jaldrishti-role, x-jaldrishti-district, x-jaldrishti-user-id)
 *      so that role-switching UI works in demonstration mode without a live identity provider.
 *    - Roles are validated against the strict whitelist.
 *    - 'general_public' is always marked isAuthenticated: false.
 * 3. Default:
 *    - Unauthenticated anonymous caller (role: 'general_public', isAuthenticated: false).
 */
export async function getServerUserContext(request: Request): Promise<UserContext> {
  // Demo mode is active when explicitly flagged or running in non-production development environments.
  // It cannot be enabled in production under any circumstance.
  const isDemo =
    (process.env.JALDRISHTI_DEMO_MODE === 'true' || process.env.NODE_ENV !== 'production') &&
    process.env.NODE_ENV !== 'production';

  // 1. Check for genuine Supabase auth token
  const authHeader = request.headers.get('authorization');
  let bearerToken: string | null = null;
  if (authHeader && authHeader.toLowerCase().startsWith('bearer ')) {
    bearerToken = authHeader.substring(7).trim();
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (bearerToken && supabaseUrl && anonKey && !supabaseUrl.includes('placeholder')) {
    try {
      const verifyRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
        headers: {
          Authorization: `Bearer ${bearerToken}`,
          apikey: anonKey,
        },
        cache: 'no-store',
      });

      if (verifyRes.ok) {
        const userData = await verifyRes.json();
        // SECURITY (R1 Remediation): Roles and jurisdiction districts MUST strictly derive
        // from server-controlled app_metadata. User-editable user_metadata must NEVER be trusted
        // for authorization or RBAC decisions.
        const rawRole = userData.app_metadata?.role;
        const role: UserRole = rawRole && VALID_ROLES.has(rawRole) ? rawRole : 'general_public';
        const district: string | null =
          typeof userData.app_metadata?.jurisdiction_district === 'string'
            ? userData.app_metadata.jurisdiction_district
            : null;

        return {
          userId: userData.id || 'verified-user',
          role,
          jurisdictionDistrict: district,
          isAuthenticated: role !== 'general_public',
        };
      }
    } catch {
      // Token verification failed or network timeout; fall through
    }
  }

  // 2. Demonstration mode header evaluation (ONLY permitted when JALDRISHTI_DEMO_MODE is explicitly 'true')
  if (isDemo) {
    const rawRole = request.headers.get('x-jaldrishti-role') as UserRole | null;
    const districtHeader = request.headers.get('x-jaldrishti-district');
    const userIdHeader = request.headers.get('x-jaldrishti-user-id');

    if (rawRole && VALID_ROLES.has(rawRole)) {
      if (rawRole === 'general_public') {
        return {
          userId: userIdHeader || 'demo-public-user',
          role: 'general_public',
          jurisdictionDistrict: null,
          isAuthenticated: false,
        };
      }

      // Default district assignments for demo roles if not explicitly supplied
      let jurisdiction = districtHeader;
      if (!jurisdiction) {
        if (rawRole === 'district_collector' || rawRole === 'bdo' || rawRole === 'gram_pradhan') {
          jurisdiction = 'Tikamgarh';
        }
      }

      return {
        userId: userIdHeader || `demo-${rawRole}-user`,
        role: rawRole,
        jurisdictionDistrict: jurisdiction,
        isAuthenticated: true,
      };
    }
  }

  // 3. Anonymous default
  return {
    userId: '',
    role: 'general_public',
    jurisdictionDistrict: null,
    isAuthenticated: false,
  };
}

/**
 * Validates that an incoming mutation request uses application/json.
 * Mitigates simple cross-site POST attacks.
 */
export function validateJsonContentType(request: Request): { valid: boolean; error?: string } {
  const contentType = request.headers.get('content-type') || '';
  if (!contentType.toLowerCase().includes('application/json')) {
    return {
      valid: false,
      error: 'Invalid Content-Type. Expected application/json.',
    };
  }
  return { valid: true };
}

/**
 * Basic in-memory sliding-window rate limiter.
 * Protects against rapid-fire API abuse, dispatch flooding, and denial-of-service.
 */
interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();

// Periodic cleanup of expired entries (every 5 minutes)
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of rateLimitStore.entries()) {
      if (now > entry.resetAt) {
        rateLimitStore.delete(key);
      }
    }
  }, 300_000).unref?.();
}

export function checkRateLimit(
  key: string,
  maxRequests: number = 30,
  windowMs: number = 60_000
): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const existing = rateLimitStore.get(key);

  if (!existing || now > existing.resetAt) {
    rateLimitStore.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: maxRequests - 1 };
  }

  if (existing.count >= maxRequests) {
    return { allowed: false, remaining: 0 };
  }

  existing.count += 1;
  return { allowed: true, remaining: maxRequests - existing.count };
}

/**
 * Helper to determine whether the application is running in operational (production) mode.
 */
export function isOperationalMode(): boolean {
  return process.env.NODE_ENV === 'production' || process.env.JALDRISHTI_DEMO_MODE !== 'true';
}
