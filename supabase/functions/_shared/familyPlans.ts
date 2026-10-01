/**
 * FAMILY & PLANS (and other dropdown) field parsing for save-lead and
 * submit-application.
 *
 * Dropdown answers are not constrained to a fixed list. New options added
 * before launch are stored as-is: trimmed, capped at DROPDOWN_MAX_LENGTH.
 * has_children is the exception: it is a boolean column, so only real
 * booleans and the strings true/false/yes/no are kept. Anything else is null.
 * fertility_preservation is only stored when wants_children is exactly "yes";
 * otherwise it is null ("not asked").
 */

const TRUE_STRINGS = new Set(["true", "yes"]);
const FALSE_STRINGS = new Set(["false", "no"]);

export const DROPDOWN_MAX_LENGTH = 200;
export const LOOKING_FOR_MAX_LENGTH = 500;
export const PARTNER_CITIES_TEXT_MAX_LENGTH = 4000;

/**
 * Columns save-lead copies onto partial_leads. Sending a field as null or ""
 * clears it on update; omitting it leaves the stored value alone.
 */
export const SAVE_LEAD_FIELDS = [
  "email",
  "first_name", "last_name", "birthdate", "gender", "height_cm", "status",
  "country", "postal_code", "zip_generated_city", "zip_generated_lat_long",
  "open_to_city", "lives_with_partner", "partner_city",
  "relationship_stage", "partner_name", "partner_email",
  "has_children", "children_with", "wants_children", "fertility_preservation", "looking_for",
  "race",
  "partner_first_name", "partner_last_name", "partner_birthday", "live_together",
  "first_date", "engagement_date", "wedding_date", "married_before",
  "partner_height", "kids_timeline",
  "num_children",
  "relationship_timeline",
  "age_min", "age_max",
  "gender_seeking",
  "height_min_cm", "height_max_cm",
  "phone", "sms_consent",
  "linkedin_username", "instagram", "x_handle", "tiktok",
  "landing_headline",
  // 2026-09-27e: partner gender, move-in date, partner location autocomplete
  "partner_gender", "moved_in_date", "partner_locations", "open_to_anywhere",
  // 2026-09-27f: partner race (couples; JSON array of labels, same shape as race)
  "partner_race",
  // 2026-09-27p: singles Partner city = one primary city + extra cities (readable text companion)
  "partner_city_primary", "partner_cities_extra", "partner_cities_extra_text",
] as const;

/** Single-value dropdown / select columns. No membership checks. looking_for is multi-select and handled separately. */
export const DROPDOWN_FIELDS = new Set([
  "gender",
  "gender_seeking",
  "status",
  "country",
  "city",
  "zip_generated_city",
  "partner_city",
  "lives_with_partner",
  "relationship_stage",
  "relationship_timeline",
  "kids_timeline",
  "wants_children",
  "fertility_preservation",
  "partner_gender",
]);

/**
 * Strict boolean: true/false, or "true"/"false"/"yes"/"no"
 * (case-insensitive, surrounding whitespace ignored). Anything else is null.
 * Callers must not 400 on a null result.
 */
export function coerceHasChildren(value: unknown): boolean | null {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (TRUE_STRINGS.has(normalized)) return true;
    if (FALSE_STRINGS.has(normalized)) return false;
  }
  return null;
}

/** Trim and cap a dropdown answer. Blank and non-strings become null. */
export function normalizeDropdownValue(value: unknown, maxLength = DROPDOWN_MAX_LENGTH): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.length > maxLength ? trimmed.slice(0, maxLength) : trimmed;
}

/**
 * relationship_timeline is a free dropdown string (asap, 3_months, 6_months,
 * 12_months, no_timeline, or whatever is added later). Stored exactly as sent
 * after trim and a 200-character cap. No allow-list and no hiding.
 */
export function normalizeRelationshipTimeline(value: unknown): string | null {
  return normalizeDropdownValue(value, DROPDOWN_MAX_LENGTH);
}

/**
 * looking_for is multi-select. The site sends one string joined with "; "
 * ("relationship; marriage"). An array is joined the same way from its
 * trimmed, non-empty string items. Capped at 500. Unknown tokens are kept.
 */
export function normalizeLookingFor(value: unknown): string | null {
  if (typeof value === "string") return normalizeDropdownValue(value, LOOKING_FOR_MAX_LENGTH);
  if (!Array.isArray(value)) return null;
  const joined = value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter((item) => item.length > 0)
    .join("; ");
  return normalizeDropdownValue(joined, LOOKING_FOR_MAX_LENGTH);
}

/**
 * Null unless wants_children normalizes to exactly "yes".
 * When it does, the fertility answer is stored as-is (trimmed, capped).
 */
export function fertilityForWants(wantsChildren: unknown, fertilityPreservation: unknown): string | null {
  if (normalizeDropdownValue(wantsChildren) !== "yes") return null;
  return normalizeDropdownValue(fertilityPreservation);
}

/** Couple-only logic keys off this exact value. Any other status falls through. */
export function isPartneredStatus(status: unknown): boolean {
  return normalizeDropdownValue(status) === "partnered";
}

export type NormalizedFamily = {
  has_children: boolean | null;
  wants_children: string | null;
  fertility_preservation: string | null;
  looking_for: string | null;
};

/** Values submit-application stores. Never rejects an unknown dropdown string. */
export function normalizeSubmittedFamily(input: {
  has_children: unknown;
  wants_children: unknown;
  fertility_preservation: unknown;
  looking_for: unknown;
}): NormalizedFamily {
  const wants_children = normalizeDropdownValue(input.wants_children);
  return {
    has_children: coerceHasChildren(input.has_children),
    wants_children,
    fertility_preservation: fertilityForWants(wants_children, input.fertility_preservation),
    looking_for: normalizeLookingFor(input.looking_for),
  };
}

/**
 * save-lead UPDATE assignments. A present key is written, including null when
 * the value is empty, so the client can clear relationship_timeline and the
 * other copied fields. Undefined keys are left out.
 */
export function assignLeadUpdate(body: Record<string, unknown>): Record<string, unknown> {
  const updatePayload: Record<string, unknown> = {};
  for (const field of SAVE_LEAD_FIELDS) {
    if (field === "fertility_preservation") continue;
    if (body[field] === undefined) continue;
    updatePayload[field] = valueForLeadField(field, body[field]);
  }
  if (body.wants_children !== undefined) {
    updatePayload.fertility_preservation = fertilityForWants(
      body.wants_children,
      body.fertility_preservation,
    );
  } else if (body.fertility_preservation !== undefined) {
    updatePayload.fertility_preservation = valueForLeadField(
      "fertility_preservation",
      body.fertility_preservation,
    );
  }
  return updatePayload;
}

/**
 * partner_locations: JSON array of chips. Labels are kept exactly as the person typed/picked them.
 * matched is set here (not trusted from the client): true when the entry has coordinates
 * (a city from the list, or the applicant's own geocoded city); false for free text that isn't in the list.
 * Anything that isn't an array becomes null. Caps: 50 entries, 200 chars per text field.
 */
const MAX_PARTNER_LOCATIONS = 50;
function plText(v: unknown): string | null {
  if (typeof v !== "string") return null;
  return v.trim() ? v.slice(0, 200) : null;
}
function plNum(v: unknown, lim: number): number | null {
  const n = typeof v === "number" ? v : (typeof v === "string" && v.trim() ? Number(v) : NaN);
  return Number.isFinite(n) && Math.abs(n) <= lim ? n : null;
}
export function normalizePartnerLocations(raw: unknown): Record<string, unknown>[] | null {
  if (!Array.isArray(raw)) return null;
  const out: Record<string, unknown>[] = [];
  for (const e of raw) {
    if (out.length >= MAX_PARTNER_LOCATIONS) break;
    if (typeof e === "string") {
      const label = plText(e);
      if (label) out.push({ label, city: label, region: null, country: null, lat: null, lng: null, geonames_id: null, typed: true, matched: false });
      continue;
    }
    if (!e || typeof e !== "object") continue;
    const o = e as Record<string, unknown>;
    const label = plText(o.label) ?? plText(o.city);
    if (!label) continue;
    const lat = plNum(o.lat, 90), lng = plNum(o.lng, 180);
    const gid = plNum(o.geonames_id, Number.MAX_SAFE_INTEGER);
    const matched = lat !== null && lng !== null;
    out.push({
      label, city: plText(o.city), region: plText(o.region), country: plText(o.country),
      lat: matched ? lat : null, lng: matched ? lng : null, geonames_id: gid !== null ? Math.round(gid) : null,
      typed: o.typed === true, matched,
      // 2026-09-27p: which control the city came from (singles Partner city); other values are dropped.
      ...(o.role === "primary" || o.role === "extra" ? { role: o.role } : {}),
    });
  }
  return out.length ? out : null;
}

/**
 * save-lead field value. Dropdown fields are trimmed and capped.
 * has_children is a strict boolean or null. fertility_preservation is only
 * normalized here; callers apply fertilityForWants when wants_children is sent.
 * partner_locations goes through normalizePartnerLocations. Empty strings become null. Other values pass through.
 */
export function valueForLeadField(field: string, raw: unknown): unknown {
  if (field === "has_children") return coerceHasChildren(raw);
  if (field === "partner_locations" || field === "partner_cities_extra") return raw === null || raw === "" ? null : normalizePartnerLocations(raw);
  if (field === "partner_city_primary") return normalizeDropdownValue(raw);
  if (field === "partner_cities_extra_text") return normalizeDropdownValue(raw, PARTNER_CITIES_TEXT_MAX_LENGTH);
  if (field === "looking_for") return normalizeLookingFor(raw);
  if (field === "relationship_timeline") return normalizeRelationshipTimeline(raw);
  if (field === "age_min" || field === "age_max") {
    const n = typeof raw === "number" ? raw : parseInt(String(raw), 10);
    return isNaN(n) ? null : n;
  }
  if (DROPDOWN_FIELDS.has(field)) return normalizeDropdownValue(raw);
  if (raw === "") return null;
  return raw;
}
