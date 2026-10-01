import { createClient } from "https://esm.sh/@supabase/supabase-js@2.117.2";
import { isPartneredStatus, normalizeDropdownValue, normalizePartnerLocations, normalizeRelationshipTimeline, normalizeSubmittedFamily, PARTNER_CITIES_TEXT_MAX_LENGTH } from "../_shared/familyPlans.ts";
import { getServiceKey } from "../_shared/supabaseKey.ts";
import { sendThankYouEmail } from "../_shared/thankYouEmail_grokbot.ts";

// Supabase Edge Runtime global: keeps a promise running after the response is sent.
declare const EdgeRuntime: { waitUntil(p: Promise<unknown>): void } | undefined;

// Exact origin allow-list (the site is served from the apex; www redirects there).
const ALLOWED_ORIGINS = new Set(["https://iherebycommit.com", "https://www.iherebycommit.com"]);
const ALLOWED_ORIGIN = "https://iherebycommit.com";
const RATE_LIMIT_MAX = 25;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour

const BASE_CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Vary": "Origin",
};

function sha256Hex(str: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(str);
  return crypto.subtle.digest("SHA-256", data).then((hashBuffer) => {
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  });
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function normalizePhone(phone: string): string | null {
  if (!phone || !phone.trim()) return null;
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) return "+1" + digits;
  if (digits.length === 11 && digits.startsWith("1")) return "+" + digits;
  if (digits.length >= 7) return "+" + digits;
  return null;
}

function normalizeLinkedIn(url: string): string | null {
  const trimmed = url.trim();
  if (!trimmed) return null;
  if (/^https?:\/\/(www\.)?linkedin\.com\/in\//i.test(trimmed)) return trimmed;
  if (/^linkedin\.com\/in\//i.test(trimmed)) return "https://www." + trimmed;
  if (/^[a-zA-Z0-9\-]+$/.test(trimmed)) return "https://www.linkedin.com/in/" + trimmed;
  return null;
}

function normalizeHandle(handle: string | undefined): string | undefined {
  if (!handle) return undefined;
  const trimmed = handle.trim().replace(/^@/, "");
  return trimmed ? "@" + trimmed : undefined;
}

async function verifyTurnstile(token: string, ip: string): Promise<boolean> {
  const secret = Deno.env.get("TURNSTILE_SECRET_KEY");
  if (!secret) { console.error("TURNSTILE_SECRET_KEY not set"); return false; }
  const formData = new FormData();
  formData.append("secret", secret);
  formData.append("response", token);
  formData.append("remoteip", ip);
  const resp = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST", body: formData,
  });
  try {
    const data = await resp.json();
    return data.success === true;
  } catch (e) {
    console.error("Turnstile response parse error:", e);
    return false;
  }
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin") || "";
  const corsHeaders = { ...BASE_CORS, "Access-Control-Allow-Origin": ALLOWED_ORIGINS.has(origin) ? origin : ALLOWED_ORIGIN };
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });

  if (!ALLOWED_ORIGINS.has(origin)) {
    return new Response(JSON.stringify({ error: "Forbidden" }), {
      status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = getServiceKey();
  const supabase = createClient(supabaseUrl, serviceKey);

  const clientIP =
    req.headers.get("CF-Connecting-IP") ||
    req.headers.get("X-Forwarded-For")?.split(",")[0] ||
    "unknown";
  const ipHash = await sha256Hex(clientIP);
  const userAgent = req.headers.get("user-agent") || null;

  // Rate limiting
  const oneHourAgo = new Date(Date.now() - RATE_LIMIT_WINDOW_MS).toISOString();
  const { count: recentCount, error: rateError } = await supabase
    .from("submission_log")
    .select("*", { count: "exact", head: true })
    .eq("ip_hash", ipHash)
    .gte("created_at", oneHourAgo);
  if (rateError) console.error("rate limit lookup error (allowing request):", rateError.message);

  if (recentCount !== null && recentCount >= RATE_LIMIT_MAX) {
    return new Response(JSON.stringify({ error: "Rate limit exceeded. Try again later." }), {
      status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Parse body
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Turnstile (soft-fail)
  const turnstileToken = body.turnstileToken as string;
  if (turnstileToken) {
    const turnstileValid = await verifyTurnstile(turnstileToken, clientIP).catch((e) => { console.error("Turnstile error:", e); return false; });
    if (!turnstileValid) console.warn("Turnstile failed for IP:", clientIP);
  }

  // ---- Parse fields ----
  const firstName = (body.first_name as string || "").trim();
  const lastName = (body.last_name as string || "").trim();
  const birthdate = body.birthdate as string;
  const country = normalizeDropdownValue(body.country);
  const postalCode = (body.postal_code as string || "").trim() || null;
  const status = normalizeDropdownValue(body.status);
  const email = (body.email as string || "").trim().toLowerCase();
  const phone = (body.phone as string || "").trim();
  const smsConsent = Boolean(body.sms_consent);
  const linkedinUrl = (body.linkedin_url as string || "").trim();
  const family = normalizeSubmittedFamily({
    has_children: body.has_children,
    wants_children: body.wants_children,
    fertility_preservation: body.fertility_preservation,
    looking_for: body.looking_for,
  });
  const relationshipTimeline = normalizeRelationshipTimeline(body.relationship_timeline);
  const openToCity = typeof body.open_to_city === "string" ? body.open_to_city.trim() || null : null;
  const gender = normalizeDropdownValue(body.gender);
  const heightCmRaw = body.height_cm != null && body.height_cm !== "" ? Number(body.height_cm) : null;
  const heightCm = heightCmRaw !== null && !isNaN(heightCmRaw) ? heightCmRaw : null; // a non-numeric value used to fail the insert
  const zipGeneratedCity = normalizeDropdownValue(body.zip_generated_city);
  const zipGeneratedLatLong = (body.zip_generated_lat_long as string | null) || null;
  const livesWithPartner = normalizeDropdownValue(body.lives_with_partner);
  const partnerCity = normalizeDropdownValue(body.partner_city);
  const landingHeadline = (body.landing_headline as string | null) || null;
  const partialLeadId = (body.partial_lead_id as string | null) || null;
  const ageMinRaw = body.age_min != null && body.age_min !== "" ? Number(body.age_min) : null;
  const ageMaxRaw = body.age_max != null && body.age_max !== "" ? Number(body.age_max) : null;
  const ageMin = ageMinRaw !== null && !isNaN(ageMinRaw) ? ageMinRaw : null;
  const ageMax = ageMaxRaw !== null && !isNaN(ageMaxRaw) ? ageMaxRaw : null;
  const genderSeeking = normalizeDropdownValue(body.gender_seeking);
  const heightMinCm = body.height_min_cm != null && body.height_min_cm !== "" ? Number(body.height_min_cm) : null;
  const heightMaxCm = body.height_max_cm != null && body.height_max_cm !== "" ? Number(body.height_max_cm) : null;
  // children_with (couples: none / current_partner / previous / both). Passed through as-is, no validation.
  const childrenWith = body.children_with !== undefined && body.children_with !== null && body.children_with !== "" ? body.children_with : null;
  // race (multi-select, JSON array of label strings). Passed through as-is, no validation.
  const race = body.race !== undefined && body.race !== null && body.race !== "" ? body.race : null;
  // Couples flow (Hotfix 9), partner_height + kids_timeline (Hotfix 11), num_children (couples kids count). Passed through as-is, no validation.
  const passThrough = (v: unknown) => (v !== undefined && v !== null && v !== "" ? v : null);
  const coupleBody: Record<string, unknown> = {};
  for (const f of ["partner_first_name", "partner_last_name", "partner_birthday", "live_together", "first_date", "engagement_date", "wedding_date", "married_before", "partner_height", "kids_timeline", "num_children"]) coupleBody[f] = passThrough(body[f]);
  // 2026-09-27e: partner_gender (text), moved_in_date (date), open_to_anywhere (boolean; false is kept). Passed through as-is.
  for (const f of ["partner_gender", "moved_in_date", "open_to_anywhere"]) coupleBody[f] = passThrough(body[f]);
  // 2026-09-27f: partner_race (jsonb array of labels, same shape as race). Passed through as-is.
  coupleBody.partner_race = passThrough(body.partner_race);
  // partner_locations: labels kept as typed; matched (has coordinates) is set server-side.
  coupleBody.partner_locations = normalizePartnerLocations(body.partner_locations);
  // 2026-09-27p: singles Partner city (primary label) + extra cities (same entry shape) + readable "; " text. All nullable.
  coupleBody.partner_city_primary = normalizeDropdownValue(body.partner_city_primary);
  coupleBody.partner_cities_extra = normalizePartnerLocations(body.partner_cities_extra);
  coupleBody.partner_cities_extra_text = normalizeDropdownValue(body.partner_cities_extra_text, PARTNER_CITIES_TEXT_MAX_LENGTH);

  // ---- Validation ----
  if (!firstName || !lastName) {
    return new Response(JSON.stringify({ error: "First and last name required" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  if (!birthdate) {
    return new Response(JSON.stringify({ error: "Birthdate required" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const birthdateObj = new Date(birthdate);
  const today = new Date();
  const age = today.getFullYear() - birthdateObj.getFullYear() -
    (today < new Date(today.getFullYear(), birthdateObj.getMonth(), birthdateObj.getDate()) ? 1 : 0);
  if (age < 18) {
    return new Response(JSON.stringify({ error: "Must be 18 or older" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Country and postal: required for zip mode; city name (zipGeneratedCity) is the identifier for intl mode
  if (!country && !zipGeneratedCity) {
    return new Response(JSON.stringify({ error: "Country or city required" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  if (!postalCode && !zipGeneratedCity) {
    return new Response(JSON.stringify({ error: "ZIP code or city required" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (!status) {
    return new Response(JSON.stringify({ error: "status required" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  if (!email || !isValidEmail(email)) {
    return new Response(JSON.stringify({ error: "Valid email required" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Phone is required since 2026-09-27k (the page asks for it on Text Me before submitting).
  // Format stays as permissive as before (the page's own check is stricter), so no valid entry is rejected here.
  if (!phone) {
    return new Response(JSON.stringify({ error: "Please enter your phone number so we can text you when it's live" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  let normalizedPhone: string | null = null;
  if (phone) {
    normalizedPhone = normalizePhone(phone);
    if (!normalizedPhone) {
      return new Response(JSON.stringify({ error: "Invalid phone number format" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }
  const effectiveSmsConsent = normalizedPhone ? smsConsent : false;

  const normalizedLinkedIn = normalizeLinkedIn(linkedinUrl);
  if (!normalizedLinkedIn) {
    return new Response(JSON.stringify({ error: "Valid LinkedIn URL required" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (!family.wants_children) {
    return new Response(JSON.stringify({ error: "wants_children required" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let relationshipStage: string | null = null;
  let partnerName: string | null = null;
  let partnerEmail: string | null = null;

  // Unknown statuses are saved as-is and skip couple linking / partner fields.
  if (isPartneredStatus(status)) {
    relationshipStage = normalizeDropdownValue(body.relationship_stage);
    partnerName = (body.partner_name as string || "").trim();
    partnerEmail = (body.partner_email as string || "").trim().toLowerCase();

    if (!relationshipStage) {
      return new Response(JSON.stringify({ error: "relationship_stage required for partners" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!partnerName) {
      return new Response(JSON.stringify({ error: "partner_name required for partners" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!partnerEmail || !isValidEmail(partnerEmail)) {
      return new Response(JSON.stringify({ error: "Valid partner_email required for partners" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }

  // ---- Look up partial lead by id (preferred) or fall back to email ----
  let plRows: Record<string, unknown>[] | null = null;
  if (partialLeadId) {
    const { data, error } = await supabase.from("partial_leads").select("*").eq("id", partialLeadId).is("converted_at", null).limit(1);
    if (error) console.error("partial lead lookup (id) error:", error.message);
    plRows = data;
  } else {
    // Emails are stored trimmed + lowercased (save-lead), so an exact match uses partial_leads_email_idx.
    // (ilike could not use the index and treated "_" / "%" in an address as wildcards.)
    const { data, error } = await supabase.from("partial_leads").select("*").eq("email", email).is("converted_at", null).order("created_at", { ascending: false }).limit(1);
    if (error) console.error("partial lead lookup (email) error:", error.message);
    plRows = data;
  }

  const pl = plRows?.[0] ?? null;

  // Effective values: submission body wins; fall back to partial lead for anything missing
  const effectiveGender = gender || normalizeDropdownValue(pl?.gender) || null;
  const effectiveZipGeneratedCity = zipGeneratedCity || normalizeDropdownValue(pl?.zip_generated_city) || null;
  const effectiveZipLatLong = zipGeneratedLatLong || pl?.zip_generated_lat_long || null;
  const effectiveLivesWithPartner = livesWithPartner || normalizeDropdownValue(pl?.lives_with_partner) || null;
  const effectivePartnerCity = partnerCity || normalizeDropdownValue(pl?.partner_city) || null;
  const effectiveLandingHeadline = landingHeadline || pl?.landing_headline || null;
  const effectiveChildrenWith = childrenWith ?? pl?.children_with ?? null;
  const effectiveRace = race ?? pl?.race ?? null;
  const effectiveCouple: Record<string, unknown> = {};
  for (const f of Object.keys(coupleBody)) effectiveCouple[f] = coupleBody[f] ?? pl?.[f] ?? null;
  // city field = the resolved city name (from zip lookup or typed intl city)
  const effectiveCity = effectiveZipGeneratedCity || null;

  const instagram = normalizeHandle(body.instagram as string);
  const xHandle = normalizeHandle(body.x_handle as string);
  const tiktok = normalizeHandle(body.tiktok as string);

  // ---- Rank queries ----
  // Resolve the location key: US uses postal_code+country; intl uses city name
  const rankQueries: Promise<{ count: number | null }>[] = [];
  if (postalCode && country) {
    rankQueries.push(
      supabase.from("waitlist").select("*", { count: "exact", head: true })
        .eq("country", country).eq("postal_code", postalCode) as any
    );
  } else if (effectiveCity) {
    rankQueries.push(
      supabase.from("waitlist").select("*", { count: "exact", head: true })
        .eq("zip_generated_city", effectiveCity) as any
    );
  } else {
    rankQueries.push(Promise.resolve({ count: 0 }));
  }
  if (effectiveGender) {
    rankQueries.push(supabase.from("waitlist").select("*", { count: "exact", head: true }).eq("gender", effectiveGender) as any);
    if (postalCode && country) {
      rankQueries.push(supabase.from("waitlist").select("*", { count: "exact", head: true }).eq("gender", effectiveGender).eq("country", country).eq("postal_code", postalCode) as any);
    } else if (effectiveCity) {
      rankQueries.push(supabase.from("waitlist").select("*", { count: "exact", head: true }).eq("gender", effectiveGender).eq("zip_generated_city", effectiveCity) as any);
    } else {
      rankQueries.push(Promise.resolve({ count: 0 }));
    }
  }

  const rankResults = await Promise.all(rankQueries);
  // deno-lint-ignore no-explicit-any
  for (const r of rankResults as any[]) if (r?.error) console.error("rank count error:", r.error.message);
  const cityRank = (rankResults[0].count || 0) + 1;
  const genderSeekingRankGlobal = effectiveGender ? (rankResults[1].count || 0) + 1 : null;
  const genderSeekingRankCity = effectiveGender ? (rankResults[2].count || 0) + 1 : null;

  // ---- Insert into waitlist ----
  const { data: inserted, error: insertError } = await supabase
    .from("waitlist")
    .insert({
      first_name: firstName,
      last_name: lastName,
      birthdate,
      city: effectiveCity,
      country: country || null,
      postal_code: postalCode || null,
      status,
      relationship_stage: relationshipStage,
      partner_name: partnerName,
      partner_email: partnerEmail,
      has_children: family.has_children,
      children_with: effectiveChildrenWith,
      race: effectiveRace,
      ...effectiveCouple,
      wants_children: family.wants_children,
      fertility_preservation: family.fertility_preservation,
      looking_for: family.looking_for,
      relationship_timeline: relationshipTimeline,
      open_to_city: openToCity || null,
      city_rank: cityRank,
      gender: effectiveGender,
      height_cm: heightCm ?? pl?.height_cm ?? null,
      gender_seeking_rank_global: genderSeekingRankGlobal,
      gender_seeking_rank_city: genderSeekingRankCity,
      email,
      phone: normalizedPhone,
      sms_consent: effectiveSmsConsent,
      marketing_unsubscribed: false,
      partner_unsubscribed: false,
      linkedin_url: normalizedLinkedIn,
      instagram: instagram || null,
      x_handle: xHandle || null,
      tiktok: tiktok || null,
      zip_generated_city: effectiveZipGeneratedCity,
      zip_generated_lat_long: effectiveZipLatLong,
      lives_with_partner: effectiveLivesWithPartner,
      partner_city: effectivePartnerCity,
      landing_headline: effectiveLandingHeadline,
      age_min: ageMin,
      age_max: ageMax,
      gender_seeking: genderSeeking,
      height_min_cm: (heightMinCm !== null && !isNaN(heightMinCm)) ? heightMinCm : null,
      height_max_cm: (heightMaxCm !== null && !isNaN(heightMaxCm)) ? heightMaxCm : null,
      user_agent: userAgent,
      referrer: req.headers.get("referer") || null,
    })
    .select("subject_number, study_code, id")
    .single();

  if (insertError) {
    console.error("Insert error:", insertError);
    return new Response(JSON.stringify({ error: "Failed to submit application" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { subject_number: subjectNumber, study_code: studyCode, id: newRowId } = inserted;

  // ---- Mark partial lead as converted ----
  if (pl) {
    // Onboarding timing: completed_at is stamped server-side the first time the lead converts
    // (pl was selected with converted_at IS NULL), never from the client and never overwritten.
    const nowIso = new Date().toISOString();
    const convertUpdate: Record<string, unknown> = { converted_at: nowIso, waitlist_id: newRowId };
    if (pl.completed_at === null || pl.completed_at === undefined) convertUpdate.completed_at = nowIso;
    const { error: convertError } = await supabase
      .from("partial_leads")
      .update(convertUpdate)
      .eq("id", pl.id);
    if (convertError) console.error("partial lead convert error:", convertError.message);
  }

  // ---- Couple Linking (fix: use order+limit instead of maybeSingle) ----
  if (isPartneredStatus(status) && partnerEmail) {
    const [{ data: matchDataA, error: matchErrA }, { data: matchDataB, error: matchErrB }] = await Promise.all([
      supabase
        .from("waitlist")
        .select("id, subject_number, couple_id")
        .eq("email", partnerEmail.toLowerCase())
        .neq("id", newRowId)
        .order("created_at", { ascending: false })
        .limit(1),
      supabase
        .from("waitlist")
        .select("id, subject_number, couple_id")
        .eq("partner_email", email.toLowerCase())
        .neq("id", newRowId)
        .order("created_at", { ascending: false })
        .limit(1),
    ]);

    if (matchErrA) console.error("couple match (email) error:", matchErrA.message);
    if (matchErrB) console.error("couple match (partner_email) error:", matchErrB.message);
    const match = matchDataA?.[0] || matchDataB?.[0];
    if (match) {
      const coupleId = match.couple_id || crypto.randomUUID();
      const lowerPriority = Math.min(subjectNumber, match.subject_number);
      const linkResults = await Promise.all([
        supabase.from("waitlist").update({ couple_id: coupleId, priority_number: lowerPriority }).eq("id", match.id),
        supabase.from("waitlist").update({ couple_id: coupleId, priority_number: lowerPriority }).eq("id", newRowId),
      ]);
      for (const r of linkResults) if (r.error) console.error("couple link update error:", r.error.message);
    }
  }

  // ---- Consent documents ----
  const { data: consentDocs, error: consentDocsError } = await supabase
    .from("consent_documents")
    .select("id, doc_key, version")
    .is("effective_to", null);
  if (consentDocsError) console.error("consent_documents lookup error:", consentDocsError.message);

  const docMap: Record<string, { id: string; version: string }> = {};
  for (const doc of consentDocs || []) docMap[doc.doc_key] = { id: doc.id, version: doc.version };

  // Where each consent was given: the page sends consent_surfaces (current step number + screen name,
  // e.g. "apply_step_4_public_self"). Fallbacks match the current flows if an older page omits them.
  const partnered = isPartneredStatus(status);
  const sentSurfaces = (body.consent_surfaces && typeof body.consent_surfaces === "object") ? body.consent_surfaces as Record<string, unknown> : {};
  const surfaceFor = (key: string, fallback: string): string => {
    const v = sentSurfaces[key];
    return typeof v === "string" && /^[a-z0-9_]{1,64}$/.test(v) ? v : fallback;
  };
  // Terms/privacy are accepted on the last screen (text_me) since 2026-09-27e.
  const textMeSurface = partnered ? "apply_step_6_text_me" : "apply_step_5_text_me";

  const consentRows: Record<string, unknown>[] = [];
  if (docMap["terms"]) consentRows.push({ study_code: studyCode, doc_id: docMap["terms"].id, doc_key: "terms", doc_version: docMap["terms"].version, granted: true, method: "accepted_by_submitting", surface: surfaceFor("terms", textMeSurface), ip_hash: ipHash, user_agent: userAgent });
  if (docMap["privacy"]) consentRows.push({ study_code: studyCode, doc_id: docMap["privacy"].id, doc_key: "privacy", doc_version: docMap["privacy"].version, granted: true, method: "accepted_by_submitting", surface: surfaceFor("privacy", textMeSurface), ip_hash: ipHash, user_agent: userAgent });
  if (docMap["sms_optin"]) consentRows.push({ study_code: studyCode, doc_id: docMap["sms_optin"].id, doc_key: "sms_optin", doc_version: docMap["sms_optin"].version, granted: effectiveSmsConsent, method: "checkbox", surface: surfaceFor("sms_optin", textMeSurface), ip_hash: ipHash, user_agent: userAgent });
  if (partnered && docMap["partner_notice"]) consentRows.push({ study_code: studyCode, doc_id: docMap["partner_notice"].id, doc_key: "partner_notice", doc_version: docMap["partner_notice"].version, granted: true, method: "accepted_by_submitting", surface: surfaceFor("partner_notice", "apply_step_2_your_partner"), ip_hash: ipHash, user_agent: userAgent });

  await Promise.all([
    consentRows.length > 0
      ? supabase.from("consents").insert(consentRows).then(({ error }) => { if (error) console.error("Consent insert error:", error); })
      : Promise.resolve(),
    supabase.from("submission_log").insert({ ip_hash: ipHash }).then(({ error }) => { if (error) console.error("submission_log insert error:", error.message); }),
  ]);

  // ---- Thank-you email (non-blocking; never affects the response) ----
  // Off unless THANK_YOU_EMAIL_MODE is test_only or live. Once per row via confirmation_email_sent_at.
  try {
    const emailTask = sendThankYouEmail(supabase, { id: newRowId, email, first_name: firstName })
      .then((r) => { if (r.status !== "skipped") console.log("thank-you email:", JSON.stringify(r)); });
    if (typeof EdgeRuntime !== "undefined" && EdgeRuntime?.waitUntil) EdgeRuntime.waitUntil(emailTask);
  } catch (e) {
    console.error("thank-you email schedule error:", e instanceof Error ? e.message : String(e));
  }

  return new Response(
    JSON.stringify({ subject_number: subjectNumber, study_code: studyCode, success: true }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
});
