/**
 * JAL DRISHTI — Server-Side Supabase Service-Role Client & Diagnostic Engine
 * 
 * Safety & Security Rules:
 * 1. NEVER print, return, or log SUPABASE_SERVICE_ROLE_KEY values.
 * 2. Strictly server-only. Never import in client components.
 * 3. Fails fast if credentials are missing, malformed, or placeholder.
 * 4. Distinguishes gateway credential failures (HTTP 401) from database permission errors (code 42501).
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

export interface ServiceRoleConfigStatus {
  configured: boolean;
  isPlaceholder: boolean;
  validFormat: boolean;
  diagnosticReason?: string;
}

/**
 * Inspects the service role configuration without revealing secret values.
 */
export function getServiceRoleConfigStatus(): ServiceRoleConfigStatus {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (key && (key.includes('placeholder') || key.includes('your-supabase-service-role-key'))) {
    return {
      configured: false,
      isPlaceholder: true,
      validFormat: false,
      diagnosticReason: 'SUPABASE_SERVICE_ROLE_KEY contains template placeholder value.',
    };
  }

  if (!url || url.includes('placeholder')) {
    return {
      configured: false,
      isPlaceholder: Boolean(url?.includes('placeholder')),
      validFormat: false,
      diagnosticReason: 'NEXT_PUBLIC_SUPABASE_URL is unset or placeholder.',
    };
  }

  if (!key) {
    return {
      configured: false,
      isPlaceholder: false,
      validFormat: false,
      diagnosticReason: 'SUPABASE_SERVICE_ROLE_KEY is unset in server environment.',
    };
  }

  // Structural check: Supabase service role keys are either:
  // 1. Standard 3-part JWTs (header.payload.signature)
  // 2. Newer Supabase secret format (starting with sb_secret_)
  if (key.startsWith('.')) {
    return {
      configured: true,
      isPlaceholder: false,
      validFormat: false,
      diagnosticReason:
        'SUPABASE_SERVICE_ROLE_KEY begins with a leading dot; JWT header is missing. Gateway returns HTTP 401.',
    };
  }

  if (key.startsWith('sb_secret_')) {
    return {
      configured: true,
      isPlaceholder: false,
      validFormat: true,
    };
  }

  const parts = key.split('.');
  if (parts.length !== 3 || parts.some((p) => p.length === 0)) {
    return {
      configured: true,
      isPlaceholder: false,
      validFormat: false,
      diagnosticReason:
        'SUPABASE_SERVICE_ROLE_KEY is not a valid 3-segment JWT. Gateway returns HTTP 401.',
    };
  }

  return {
    configured: true,
    isPlaceholder: false,
    validFormat: true,
  };
}

let cachedServiceClient: SupabaseClient | null = null;

/**
 * Returns an authenticated Supabase client using the service-role key.
 * Returns null if the service role is unconfigured or malformed, avoiding silent failure.
 */
export function getServiceRoleClient(): SupabaseClient | null {
  const status = getServiceRoleConfigStatus();
  if (!status.configured || !status.validFormat) {
    return null;
  }

  if (!cachedServiceClient) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;

    cachedServiceClient = createClient(url, key, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }

  return cachedServiceClient;
}
