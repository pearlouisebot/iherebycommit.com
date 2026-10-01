/**
 * Service key for Edge Functions.
 *
 * Hosted functions receive SUPABASE_SECRET_KEYS as a JSON object of key name
 * to key value. The key created in the dashboard is named "default". Until
 * that variable is present, fall back to the legacy SUPABASE_SERVICE_ROLE_KEY
 * so current deploys behave exactly as they do today.
 */
export function resolveServiceKey(
  secretKeysJson: string | undefined,
  legacyKey: string | undefined,
): string {
  const named = defaultSecretKey(secretKeysJson);
  if (named) return named;
  return legacyKey as string;
}

export function getServiceKey(): string {
  return resolveServiceKey(
    Deno.env.get("SUPABASE_SECRET_KEYS"),
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"),
  );
}

function defaultSecretKey(secretKeysJson: string | undefined): string | undefined {
  if (!secretKeysJson) return undefined;
  let parsed: unknown;
  try {
    parsed = JSON.parse(secretKeysJson);
  } catch {
    return undefined;
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return undefined;
  const value = (parsed as Record<string, unknown>)["default"];
  if (typeof value !== "string" || value.trim().length === 0) return undefined;
  return value;
}
