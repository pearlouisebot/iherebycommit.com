# IHereByCommit Data Dictionary_grokbot

Supabase project dqrmyqmpqnlemkwdndsf, schema public. Generated 2026-09-27 (PT), front end PAGE_VERSION 2026-09-27h. Updated 2026-09-27 evening (PT): partner location free text (mapped vs unmapped), access tightened. Updated again 2026-09-27 (PT): responses_deidentified dropped; responses_research is the only public research view. Updated 2026-09-27 9:50 PM (PT): CDC NHANES height metrics loaded into metrics/benchmarks, three nullable columns added to metrics, helper functions height_cdf_pct and height_share_in_range added (see [metrics / benchmarks: CDC NHANES height](#metrics--benchmarks-cdc-nhanes-height)). Flow: **singles** = status single, **couples** = status partnered, **both** = asked in or applies to both. All columns are nullable, with no value check constraints. Codes are stored as shown under Allowed / example values.

Helper functions (public, immutable): ihbc_text_list(text), ihbc_jsonb_list(jsonb), ihbc_location_cities(jsonb) (mapped entries only), ihbc_pl_is_mapped(jsonb), ihbc_partner_locations(jsonb) (mapped count, unmapped text, unmapped count), ihbc_translate(race, partner_race, looking_for, open_to_city, partner_locations).

**Access.** anon/authenticated can SELECT only responses_research (the only public research view). Every table, the \_readable views and onboarding_screen_times are service-role only (RLS on, no policies, no grants), and new tables in public no longer auto-grant to anon/authenticated. get_benchmark, set_priority_number, height_cdf_pct and height_share_in_range are not executable by public roles (service_role only).

## Contents

- [responses_research](#responses_research)
- [waitlist](#waitlist)
- [waitlist_readable](#waitlist_readable)
- [partial_leads](#partial_leads)
- [partial_leads_readable](#partial_leads_readable)
- [onboarding_events](#onboarding_events)
- [onboarding_screen_times](#onboarding_screen_times)
- [metrics / benchmarks: CDC NHANES height](#metrics--benchmarks-cdc-nhanes-height)

## responses_research

VIEW (public SELECT, de-identified) - NEW 2026-09-27. The only public research view (the old responses_deidentified view was dropped on 2026-09-27 PT). Recommended starting point for research: one row per respondent (completed W-\* or abandoned partial P-\*). No names, emails, phones, handles, zip or exact dates; ages, months and durations only. Multi-value answers are expanded into readable text, counts and one boolean per option (NULL = question not answered / not asked in that flow).

| Column | Type | Meaning | Allowed / example values | Flow |
|---|---|---|---|---|
| respondent_id | text | Stable research id: "W-&lt;waitlist id&gt;" for completed applications, "P-&lt;partial lead id&gt;" for unconverted partials. | W-01228198-... | both |
| partial_lead_id | uuid | partial_leads.id (random uuid; join key for onboarding timing data). | uuid | both |
| completed | boolean | true = submitted application (waitlist row); false = abandoned partial. | true \| false | both |
| flow | text | Readable flow name derived from status. | singles \| couples | both |
| status | text | Which flow the applicant chose. | single \| partnered | both |
| start_month | date | Month the application was started (1st of month). | 2026-09-01 | both |
| completion_month | date | Month submitted (NULL for partials). | 2026-09-01 | both |
| minutes_to_complete | numeric | Minutes from start to submission (NULL for partials). | 4.9 | both |
| page_version | text | Front-end build that produced the row/event. | 2026-09-27f | both |
| birth_year | integer | Applicant birth year. | 1990 | both |
| age_years | integer | Applicant age in whole years at submission (or last activity). | 36 | both |
| gender | text | Applicant gender ("I am a"). | woman \| man \| non-binary | both |
| gender_seeking | text | Gender(s) sought. | men \| women \| both | singles |
| age_min | integer | Youngest partner age sought. | 18-80 | singles |
| age_max | integer | Oldest partner age sought (80 = 80+). | 18-80 | singles |
| height_cm | integer | Applicant height in cm (optional; NULL when not given). | 165 | both |
| height_min_cm | integer | Shortest partner height sought, cm (optional). | 152 | singles |
| height_max_cm | integer | Tallest partner height sought, cm (optional). | 188 | singles |
| country | text | Country from the location question (US default when a US zip is used). | United States, Canada, ... | both |
| city | text | City (zip-derived city for partials; waitlist display city for completed). | Austin, TX | both |
| open_to_city | text (JSON array as text) | LEGACY-format list of city labels the applicant is open to, stored as JSON-array TEXT (older rows may hold the literal "Anywhere"). Kept for back-compat; partner_locations is the structured version. | ["Austin, TX","Denver, CO"] | singles |
| open_to_anywhere | boolean | Applicant is open to a partner anywhere. | true \| false | singles |
| partner_locations | jsonb (array of objects) | Structured list of places the applicant is open to a partner living; array of objects {label,city,region,country,lat,lng,geonames_id,typed,matched}. Mapped entries (picked from the city list, or the applicant's own geocoded city) have lat/lng and matched=true. Free text that is not in the list is saved exactly as typed: label = typed text, lat/lng/geonames_id = null, typed=true, matched=false. matched is set by the server (true only when lat and lng are present). Entries saved before 2026-09-27h have no matched key; treat lat/lng present as mapped. | [{"label":"Denver, CO","city":"Denver","lat":39.74,"lng":-104.98,"geonames_id":5419384,"typed":false,"matched":true},{"label":"Marfa","city":"Marfa","lat":null,"lng":null,"geonames_id":null,"typed":true,"matched":false}] | singles |
| relationship_stage | text | Current relationship stage. | dating \| relationship \| engaged \| married \| domestic_partnership | couples |
| relationship_timeline | text | Ideal timeline for a relationship (asked when looking for relationship/marriage/life partner). | asap \| 3_months \| 6_months \| 12_months \| no_timeline | singles |
| looking_for | text ("; "-joined list) | What the applicant is looking for; multi-select stored as "; "-joined codes. | casual; dating; relationship; marriage; life_partner | singles |
| has_children | boolean | Has children (true when any "yes..." option is chosen). | true \| false | both |
| children_with | text | Couples: who the existing children are with (derived from the "Do you have kids?" option). | none \| current_partner \| previous \| both | couples |
| num_children | text | How many kids (couples, when has kids). | 1 \| 2 \| 3 \| 4 \| 5+ | couples |
| wants_children | text | Wants (more) children. | yes \| no \| open_either_way \| not_sure | both |
| kids_timeline | text | Ideal timeline for kids (when wants kids). | asap \| 1_2_years \| 3_4_years \| 5_10_years \| 10_plus_years \| no_timeline | both |
| fertility_preservation | text | Invested in fertility preservation. | yes \| no \| considering | singles |
| race | jsonb (array of text) | Applicant race, multi-select jsonb array. | White, Black, Asian, Hispanic / Latino, South Asian, MENA, Pacific Islander, Native American, Other, Prefer not to say (multi-select; "Prefer not to say" clears the others) | both |
| partner_race | jsonb (array of text) | Partner race, multi-select jsonb array (added 2026-09-27f). | White, Black, Asian, Hispanic / Latino, South Asian, MENA, Pacific Islander, Native American, Other, Prefer not to say (multi-select; "Prefer not to say" clears the others) | couples |
| partner_gender | text | Partner gender ("Partner is a"). | woman \| man \| non-binary | couples |
| partner_height | integer | Partner height in cm. | 175 | couples |
| partner_age_years | integer | Partner age in whole years at submission. | 37 | couples |
| live_together | text | Do you live together? (falls back to legacy lives_with_partner). | yes \| no \| part_time | couples |
| married_before | text | Have either of you been married before? | neither \| me \| partner \| both | couples |
| years_since_first_date | numeric | Years from first date to submission (1 decimal). | 11.6 | couples |
| years_since_engagement | numeric | Years since engagement. | 9.6 | couples |
| years_married | numeric | Years since wedding. | 8.1 | couples |
| years_living_together | numeric | Years since moving in. | 6.3 | couples |
| landing_headline | text | MISNOMER: holds the landing page URL (incl. ?v= cache-bust / campaign tag), not a headline. | https://iherebycommit.com/?v=hf33 | both |
| gave_phone | boolean | Provided a phone number. | true \| false | both |
| sms_consent | boolean | Opted in to study SMS. | true \| false | both |
| gave_instagram | boolean | Provided an Instagram handle. | true \| false | both |
| gave_x | boolean | Provided an X handle. | true \| false | both |
| gave_tiktok | boolean | Provided a TikTok handle. | true \| false | both |
| couple_linked | boolean | Partner has also applied and the rows are linked (completed rows only). | true \| false | couples |
| race_text | text | Applicant race as readable text, in selection order. | Asian; White | both |
| race_count | integer | Number of applicant race options selected. | 0-10 | both |
| race_white | boolean | Applicant race includes "White" (NULL when the question was not answered). | true \| false \| NULL | both |
| race_black | boolean | Applicant race includes "Black" (NULL when the question was not answered). | true \| false \| NULL | both |
| race_asian | boolean | Applicant race includes "Asian" (NULL when the question was not answered). | true \| false \| NULL | both |
| race_hispanic_latino | boolean | Applicant race includes "Hispanic / Latino" (NULL when the question was not answered). | true \| false \| NULL | both |
| race_south_asian | boolean | Applicant race includes "South Asian" (NULL when the question was not answered). | true \| false \| NULL | both |
| race_mena | boolean | Applicant race includes "MENA" (NULL when the question was not answered). | true \| false \| NULL | both |
| race_pacific_islander | boolean | Applicant race includes "Pacific Islander" (NULL when the question was not answered). | true \| false \| NULL | both |
| race_native_american | boolean | Applicant race includes "Native American" (NULL when the question was not answered). | true \| false \| NULL | both |
| race_other | boolean | Applicant race includes "Other" (NULL when the question was not answered). | true \| false \| NULL | both |
| race_prefer_not_to_say | boolean | Applicant race includes "Prefer not to say" (NULL when the question was not answered). | true \| false \| NULL | both |
| race_multiracial | boolean | Applicant selected 2+ races (excluding "Prefer not to say"). | true \| false \| NULL | both |
| partner_race_text | text | Partner race as readable text, in selection order. | Asian; White | couples |
| partner_race_count | integer | Number of partner race options selected. | 0-10 | couples |
| partner_race_white | boolean | Partner race includes "White" (NULL when the question was not answered). | true \| false \| NULL | couples |
| partner_race_black | boolean | Partner race includes "Black" (NULL when the question was not answered). | true \| false \| NULL | couples |
| partner_race_asian | boolean | Partner race includes "Asian" (NULL when the question was not answered). | true \| false \| NULL | couples |
| partner_race_hispanic_latino | boolean | Partner race includes "Hispanic / Latino" (NULL when the question was not answered). | true \| false \| NULL | couples |
| partner_race_south_asian | boolean | Partner race includes "South Asian" (NULL when the question was not answered). | true \| false \| NULL | couples |
| partner_race_mena | boolean | Partner race includes "MENA" (NULL when the question was not answered). | true \| false \| NULL | couples |
| partner_race_pacific_islander | boolean | Partner race includes "Pacific Islander" (NULL when the question was not answered). | true \| false \| NULL | couples |
| partner_race_native_american | boolean | Partner race includes "Native American" (NULL when the question was not answered). | true \| false \| NULL | couples |
| partner_race_other | boolean | Partner race includes "Other" (NULL when the question was not answered). | true \| false \| NULL | couples |
| partner_race_prefer_not_to_say | boolean | Partner race includes "Prefer not to say" (NULL when the question was not answered). | true \| false \| NULL | couples |
| partner_race_multiracial | boolean | Partner selected 2+ races (excluding "Prefer not to say"). | true \| false \| NULL | couples |
| looking_for_text | text | Looking for, readable labels. | Relationship; Marriage | singles |
| looking_for_count | integer | Number of looking-for options selected. | 0-5 | singles |
| looking_for_casual | boolean | Looking for includes "Casual". | true \| false \| NULL | singles |
| looking_for_dating | boolean | Looking for includes "Dating". | true \| false \| NULL | singles |
| looking_for_relationship | boolean | Looking for includes "Relationship". | true \| false \| NULL | singles |
| looking_for_marriage | boolean | Looking for includes "Marriage". | true \| false \| NULL | singles |
| looking_for_life_partner | boolean | Looking for includes "Life partner". | true \| false \| NULL | singles |
| open_to_city_text | text | open_to_city as readable text. | Austin, TX; Denver, CO | singles |
| open_to_city_count | integer | Number of cities in open_to_city. | 1..n | singles |
| partner_locations_text | text | partner_locations labels as readable text. | Austin, TX; Denver, CO | singles |
| partner_location_cities | text | City names of MAPPED partner_locations entries only (entries with coordinates). Free-text entries are excluded; see partner_locations_unmapped. | Austin; Denver | singles |
| partner_locations_count | integer | Number of partner locations chosen (mapped + unmapped). | 1..n | singles |
| partner_locations_mapped_count | integer | Number of mapped partner_locations entries (have coordinates). | 0..n | singles |
| partner_locations_unmapped | text | Free-text partner_locations entries that are not in the city list, exactly as typed, "; "-separated. NULL when there are none. | Marfa; Terlingua | singles |
| partner_locations_unmapped_count | integer | Number of free-text (unmapped) partner_locations entries. | 0..n | singles |

## waitlist

TABLE (RLS on, no public access). One row per submitted application. Contains PII.

| Column | Type | Meaning | Allowed / example values | Flow |
|---|---|---|---|---|
| id | uuid | Primary key (random). | uuid | both |
| subject_number | bigint | Sequential public application number shown on confirmation (#00046). | 46 | both |
| first_name | text | Applicant first name (PII). | text | both |
| last_name | text | Applicant last name (PII). | text | both |
| birthdate | date | Applicant date of birth (PII, exact date). | 1990-03-15 | both |
| city | text | waitlist: display city (zip-derived city or typed international city). | Austin, TX | both |
| status | text | Which flow the applicant chose. | single \| partnered | both |
| relationship_stage | text | Current relationship stage. | dating \| relationship \| engaged \| married \| domestic_partnership | couples |
| partner_name | text | LEGACY: single free-text partner name from older versions; replaced by partner_first_name + partner_last_name. | text (PII) | couples |
| partner_email | text | Partner email, used to link the couple (PII). | they@example.com | couples |
| has_children | boolean | Has children (true when any "yes..." option is chosen). | true \| false | both |
| wants_children | text | Wants (more) children. | yes \| no \| open_either_way \| not_sure | both |
| email | text | Applicant email (PII). | you@email.com | both |
| phone | text | Phone number for texts (optional, PII). | 5125550101 / +44 20 7946 0958 | both |
| sms_consent | boolean | Opted in to study SMS. | true \| false | both |
| linkedin_url | text | Normalized LinkedIn URL (waitlist only; same answer as partial_leads.linkedin_username). | https://www.linkedin.com/in/qa-test-1 | both |
| instagram | text | Instagram handle (optional, PII). | handle | both |
| x_handle | text | X / Twitter handle (optional, PII). | handle | both |
| tiktok | text | TikTok handle (optional, PII). | handle | both |
| created_at | timestamptz | Submission time (UTC). | timestamp | both |
| user_agent | text | Browser user agent at submission. | Mozilla/5.0 ... | both |
| referrer | text | document.referrer at submission. | url | both |
| country | text | Country from the location question (US default when a US zip is used). | United States, Canada, ... | both |
| postal_code | text | US zip code typed by the applicant (quasi-identifier). | 78701 | both |
| fertility_preservation | text | Invested in fertility preservation. | yes \| no \| considering | singles |
| open_to_city | text (JSON array as text) | LEGACY-format list of city labels the applicant is open to, stored as JSON-array TEXT (older rows may hold the literal "Anywhere"). Kept for back-compat; partner_locations is the structured version. | ["Austin, TX","Denver, CO"] | singles |
| city_rank | integer | Position in line within the same zip (or city). | 1..n | both |
| gender | text | Applicant gender ("I am a"). | woman \| man \| non-binary | both |
| gender_seeking_rank_global | integer | Position in line among applicants of the same gender. | 1..n | both |
| gender_seeking_rank_city | integer | Position in line among the same gender in the same zip/city. | 1..n | both |
| zip_generated_city | text | City/state derived from the zip code lookup. | Austin, TX | both |
| study_code | uuid | Pseudonymous study identifier (links consents). | uuid | both |
| marketing_unsubscribed | boolean | Unsubscribed from marketing email. | true \| false | both |
| partner_unsubscribed | boolean | Partner opted out of partner emails. | true \| false | couples |
| couple_id | uuid | Shared id set when both partners have applied. | uuid | couples |
| priority_number | integer | Shared (lower) place in line for a linked couple. | integer | couples |
| landing_headline | text | MISNOMER: holds the landing page URL (incl. ?v= cache-bust / campaign tag), not a headline. | https://iherebycommit.com/?v=hf33 | both |
| partner_city | text | Where the partner lives when not living together. | Denver, CO | couples |
| lives_with_partner | text | LEGACY duplicate of live_together (the client still writes both with the same value). | yes \| no \| part_time | couples |
| zip_generated_lat_long | text | Lat,long of the zip centroid (quasi-identifier). | 30.27,-97.74 | both |
| height_cm | integer | Applicant height in cm (optional; NULL when not given). | 165 | both |
| looking_for | text ("; "-joined list) | What the applicant is looking for; multi-select stored as "; "-joined codes. | casual; dating; relationship; marriage; life_partner | singles |
| relationship_timeline | text | Ideal timeline for a relationship (asked when looking for relationship/marriage/life partner). | asap \| 3_months \| 6_months \| 12_months \| no_timeline | singles |
| age_min | integer | Youngest partner age sought. | 18-80 | singles |
| age_max | integer | Oldest partner age sought (80 = 80+). | 18-80 | singles |
| gender_seeking | text | Gender(s) sought. | men \| women \| both | singles |
| height_min_cm | integer | Shortest partner height sought, cm (optional). | 152 | singles |
| height_max_cm | integer | Tallest partner height sought, cm (optional). | 188 | singles |
| children_with | text | Couples: who the existing children are with (derived from the "Do you have kids?" option). | none \| current_partner \| previous \| both | couples |
| race | jsonb (array of text) | Applicant race, multi-select jsonb array. | White, Black, Asian, Hispanic / Latino, South Asian, MENA, Pacific Islander, Native American, Other, Prefer not to say (multi-select; "Prefer not to say" clears the others) | both |
| partner_first_name | text | Partner first name (PII). | text | couples |
| partner_last_name | text | Partner last name (PII). | text | couples |
| partner_birthday | date | Partner date of birth (PII, exact date). | 1989-03-03 | couples |
| live_together | text | Do you live together? | yes \| no \| part_time | couples |
| first_date | date | Date of first date (exact date). | 2015-03-01 | couples |
| engagement_date | date | Engagement date (engaged/married). | 2017-02-14 | couples |
| wedding_date | date | Wedding date (married). | 2018-09-01 | couples |
| married_before | text | Have either of you been married before? | neither \| me \| partner \| both | couples |
| partner_height | integer | Partner height in cm. | 175 | couples |
| kids_timeline | text | Ideal timeline for kids (when wants kids). | asap \| 1_2_years \| 3_4_years \| 5_10_years \| 10_plus_years \| no_timeline | both |
| num_children | text | How many kids (couples, when has kids). | 1 \| 2 \| 3 \| 4 \| 5+ | couples |
| partner_gender | text | Partner gender ("Partner is a"). | woman \| man \| non-binary | couples |
| moved_in_date | date | When the couple moved in together (exact date). | 2020-06-01 | couples |
| partner_locations | jsonb (array of objects) | Structured list of places the applicant is open to a partner living; array of objects {label,city,region,country,lat,lng,geonames_id,typed,matched}. Mapped entries (picked from the city list, or the applicant's own geocoded city) have lat/lng and matched=true. Free text that is not in the list is saved exactly as typed: label = typed text, lat/lng/geonames_id = null, typed=true, matched=false. matched is set by the server (true only when lat and lng are present). Entries saved before 2026-09-27h have no matched key; treat lat/lng present as mapped. | [{"label":"Denver, CO","city":"Denver","lat":39.74,"lng":-104.98,"geonames_id":5419384,"typed":false,"matched":true},{"label":"Marfa","city":"Marfa","lat":null,"lng":null,"geonames_id":null,"typed":true,"matched":false}] | singles |
| open_to_anywhere | boolean | Applicant is open to a partner anywhere. | true \| false | singles |
| partner_race | jsonb (array of text) | Partner race, multi-select jsonb array (added 2026-09-27f). | White, Black, Asian, Hispanic / Latino, South Asian, MENA, Pacific Islander, Native American, Other, Prefer not to say (multi-select; "Prefer not to say" clears the others) | couples |

## waitlist_readable

VIEW (internal only; security_invoker, no anon/authenticated access). Every waitlist column plus the translated research columns listed at the end.

Every column, in order (meaning, values and flow are the same as waitlist.&lt;column&gt; for raw columns and responses_research.&lt;column&gt; for the translated ones): **id** (uuid), **subject_number** (bigint), **first_name** (text), **last_name** (text), **birthdate** (date), **city** (text), **status** (text), **relationship_stage** (text), **partner_name** (text), **partner_email** (text), **has_children** (boolean), **wants_children** (text), **email** (text), **phone** (text), **sms_consent** (boolean), **linkedin_url** (text), **instagram** (text), **x_handle** (text), **tiktok** (text), **created_at** (timestamptz), **user_agent** (text), **referrer** (text), **country** (text), **postal_code** (text), **fertility_preservation** (text), **open_to_city** (text (JSON array as text)), **city_rank** (integer), **gender** (text), **gender_seeking_rank_global** (integer), **gender_seeking_rank_city** (integer), **zip_generated_city** (text), **study_code** (uuid), **marketing_unsubscribed** (boolean), **partner_unsubscribed** (boolean), **couple_id** (uuid), **priority_number** (integer), **landing_headline** (text), **partner_city** (text), **lives_with_partner** (text), **zip_generated_lat_long** (text), **height_cm** (integer), **looking_for** (text ("; "-joined list)), **relationship_timeline** (text), **age_min** (integer), **age_max** (integer), **gender_seeking** (text), **height_min_cm** (integer), **height_max_cm** (integer), **children_with** (text), **race** (jsonb (array of text)), **partner_first_name** (text), **partner_last_name** (text), **partner_birthday** (date), **live_together** (text), **first_date** (date), **engagement_date** (date), **wedding_date** (date), **married_before** (text), **partner_height** (integer), **kids_timeline** (text), **num_children** (text), **partner_gender** (text), **moved_in_date** (date), **partner_locations** (jsonb (array of objects)), **open_to_anywhere** (boolean), **partner_race** (jsonb (array of text)), **flow** (text), **race_text** (text), **race_count** (integer), **race_white** (boolean), **race_black** (boolean), **race_asian** (boolean), **race_hispanic_latino** (boolean), **race_south_asian** (boolean), **race_mena** (boolean), **race_pacific_islander** (boolean), **race_native_american** (boolean), **race_other** (boolean), **race_prefer_not_to_say** (boolean), **race_multiracial** (boolean), **partner_race_text** (text), **partner_race_count** (integer), **partner_race_white** (boolean), **partner_race_black** (boolean), **partner_race_asian** (boolean), **partner_race_hispanic_latino** (boolean), **partner_race_south_asian** (boolean), **partner_race_mena** (boolean), **partner_race_pacific_islander** (boolean), **partner_race_native_american** (boolean), **partner_race_other** (boolean), **partner_race_prefer_not_to_say** (boolean), **partner_race_multiracial** (boolean), **looking_for_text** (text), **looking_for_count** (integer), **looking_for_casual** (boolean), **looking_for_dating** (boolean), **looking_for_relationship** (boolean), **looking_for_marriage** (boolean), **looking_for_life_partner** (boolean), **open_to_city_text** (text), **open_to_city_count** (integer), **partner_locations_text** (text), **partner_location_cities** (text), **partner_locations_count** (integer), **partner_locations_mapped_count** (integer), **partner_locations_unmapped** (text), **partner_locations_unmapped_count** (integer)

## partial_leads

TABLE (RLS on, no public access). Autosaved in-progress application (one per browser session); converted_at/waitlist_id are set on submit. Contains PII.

| Column | Type | Meaning | Allowed / example values | Flow |
|---|---|---|---|---|
| id | uuid | Primary key (random). | uuid | both |
| email | text | Applicant email (PII). | you@email.com | both |
| first_name | text | Applicant first name (PII). | text | both |
| last_name | text | Applicant last name (PII). | text | both |
| birthdate | date | Applicant date of birth (PII, exact date). | 1990-03-15 | both |
| created_at | timestamptz | Row creation time (UTC). For partial_leads: first autosave; for waitlist: submission time. | 2026-09-27 22:40:00+00 | both |
| updated_at | timestamptz | Last autosave time (UTC). | timestamp | both |
| status | text | Which flow the applicant chose. | single \| partnered | both |
| country | text | Country from the location question (US default when a US zip is used). | United States, Canada, ... | both |
| postal_code | text | US zip code typed by the applicant (quasi-identifier). | 78701 | both |
| open_to_city | text (JSON array as text) | LEGACY-format list of city labels the applicant is open to, stored as JSON-array TEXT (older rows may hold the literal "Anywhere"). Kept for back-compat; partner_locations is the structured version. | ["Austin, TX","Denver, CO"] | singles |
| relationship_stage | text | Current relationship stage. | dating \| relationship \| engaged \| married \| domestic_partnership | couples |
| partner_name | text | LEGACY: single free-text partner name from older versions; replaced by partner_first_name + partner_last_name. | text (PII) | couples |
| partner_email | text | Partner email, used to link the couple (PII). | they@example.com | couples |
| has_children | boolean | Has children (true when any "yes..." option is chosen). | true \| false | both |
| wants_children | text | Wants (more) children. | yes \| no \| open_either_way \| not_sure | both |
| fertility_preservation | text | Invested in fertility preservation. | yes \| no \| considering | singles |
| phone | text | Phone number for texts (optional, PII). | 5125550101 / +44 20 7946 0958 | both |
| sms_consent | boolean | Opted in to study SMS. | true \| false | both |
| linkedin_username | text | LinkedIn handle as typed (partial_leads only). | qa-test-1 | both |
| instagram | text | Instagram handle (optional, PII). | handle | both |
| x_handle | text | X / Twitter handle (optional, PII). | handle | both |
| tiktok | text | TikTok handle (optional, PII). | handle | both |
| gender | text | Applicant gender ("I am a"). | woman \| man \| non-binary | both |
| zip_generated_city | text | City/state derived from the zip code lookup. | Austin, TX | both |
| zip_generated_lat_long | text | Lat,long of the zip centroid (quasi-identifier). | 30.27,-97.74 | both |
| lives_with_partner | text | LEGACY duplicate of live_together (the client still writes both with the same value). | yes \| no \| part_time | couples |
| partner_city | text | Where the partner lives when not living together. | Denver, CO | couples |
| landing_headline | text | MISNOMER: holds the landing page URL (incl. ?v= cache-bust / campaign tag), not a headline. | https://iherebycommit.com/?v=hf33 | both |
| converted_at | timestamptz | When this partial lead became a waitlist submission (NULL = not converted). | timestamp | both |
| waitlist_id | uuid | waitlist.id this partial lead converted into. | uuid | both |
| height_cm | integer | Applicant height in cm (optional; NULL when not given). | 165 | both |
| looking_for | text ("; "-joined list) | What the applicant is looking for; multi-select stored as "; "-joined codes. | casual; dating; relationship; marriage; life_partner | singles |
| relationship_timeline | text | Ideal timeline for a relationship (asked when looking for relationship/marriage/life partner). | asap \| 3_months \| 6_months \| 12_months \| no_timeline | singles |
| age_min | integer | Youngest partner age sought. | 18-80 | singles |
| age_max | integer | Oldest partner age sought (80 = 80+). | 18-80 | singles |
| gender_seeking | text | Gender(s) sought. | men \| women \| both | singles |
| height_min_cm | integer | Shortest partner height sought, cm (optional). | 152 | singles |
| height_max_cm | integer | Tallest partner height sought, cm (optional). | 188 | singles |
| children_with | text | Couples: who the existing children are with (derived from the "Do you have kids?" option). | none \| current_partner \| previous \| both | couples |
| race | jsonb (array of text) | Applicant race, multi-select jsonb array. | White, Black, Asian, Hispanic / Latino, South Asian, MENA, Pacific Islander, Native American, Other, Prefer not to say (multi-select; "Prefer not to say" clears the others) | both |
| partner_first_name | text | Partner first name (PII). | text | couples |
| partner_last_name | text | Partner last name (PII). | text | couples |
| partner_birthday | date | Partner date of birth (PII, exact date). | 1989-03-03 | couples |
| live_together | text | Do you live together? | yes \| no \| part_time | couples |
| first_date | date | Date of first date (exact date). | 2015-03-01 | couples |
| engagement_date | date | Engagement date (engaged/married). | 2017-02-14 | couples |
| wedding_date | date | Wedding date (married). | 2018-09-01 | couples |
| married_before | text | Have either of you been married before? | neither \| me \| partner \| both | couples |
| partner_height | integer | Partner height in cm. | 175 | couples |
| kids_timeline | text | Ideal timeline for kids (when wants kids). | asap \| 1_2_years \| 3_4_years \| 5_10_years \| 10_plus_years \| no_timeline | both |
| num_children | text | How many kids (couples, when has kids). | 1 \| 2 \| 3 \| 4 \| 5+ | couples |
| started_at | timestamptz | Client-side time the application was started. | timestamp | both |
| completed_at | timestamptz | partial_leads: time submitted from the client (NULL until submitted). | timestamp | both |
| last_screen_key | text | Last screen the applicant reached (autosave). | who_you_are \| your_partner \| your_relationship \| family_and_intentions \| what_you_want \| public_self \| text_me | both |
| page_version | text | Front-end build that produced the row/event. | 2026-09-27f | both |
| flow_sequence | text | Ordered screen keys of the flow shown. | who_you_are,family_and_intentions,what_you_want,public_self,text_me | both |
| client_tz | text | Browser IANA time zone. | America/Los_Angeles | both |
| client_tz_offset_min | integer | Browser UTC offset in minutes (JS getTimezoneOffset sign: 420 = UTC-7). | 420 | both |
| partner_gender | text | Partner gender ("Partner is a"). | woman \| man \| non-binary | couples |
| moved_in_date | date | When the couple moved in together (exact date). | 2020-06-01 | couples |
| partner_locations | jsonb (array of objects) | Structured list of places the applicant is open to a partner living; array of objects {label,city,region,country,lat,lng,geonames_id,typed,matched}. Mapped entries (picked from the city list, or the applicant's own geocoded city) have lat/lng and matched=true. Free text that is not in the list is saved exactly as typed: label = typed text, lat/lng/geonames_id = null, typed=true, matched=false. matched is set by the server (true only when lat and lng are present). Entries saved before 2026-09-27h have no matched key; treat lat/lng present as mapped. | [{"label":"Denver, CO","city":"Denver","lat":39.74,"lng":-104.98,"geonames_id":5419384,"typed":false,"matched":true},{"label":"Marfa","city":"Marfa","lat":null,"lng":null,"geonames_id":null,"typed":true,"matched":false}] | singles |
| open_to_anywhere | boolean | Applicant is open to a partner anywhere. | true \| false | singles |
| partner_race | jsonb (array of text) | Partner race, multi-select jsonb array (added 2026-09-27f). | White, Black, Asian, Hispanic / Latino, South Asian, MENA, Pacific Islander, Native American, Other, Prefer not to say (multi-select; "Prefer not to say" clears the others) | couples |

## partial_leads_readable

VIEW (internal only; security_invoker). Every partial_leads column plus the translated research columns.

Every column, in order (meaning, values and flow are the same as partial_leads.&lt;column&gt; for raw columns and responses_research.&lt;column&gt; for the translated ones): **id** (uuid), **email** (text), **first_name** (text), **last_name** (text), **birthdate** (date), **created_at** (timestamptz), **updated_at** (timestamptz), **status** (text), **country** (text), **postal_code** (text), **open_to_city** (text (JSON array as text)), **relationship_stage** (text), **partner_name** (text), **partner_email** (text), **has_children** (boolean), **wants_children** (text), **fertility_preservation** (text), **phone** (text), **sms_consent** (boolean), **linkedin_username** (text), **instagram** (text), **x_handle** (text), **tiktok** (text), **gender** (text), **zip_generated_city** (text), **zip_generated_lat_long** (text), **lives_with_partner** (text), **partner_city** (text), **landing_headline** (text), **converted_at** (timestamptz), **waitlist_id** (uuid), **height_cm** (integer), **looking_for** (text ("; "-joined list)), **relationship_timeline** (text), **age_min** (integer), **age_max** (integer), **gender_seeking** (text), **height_min_cm** (integer), **height_max_cm** (integer), **children_with** (text), **race** (jsonb (array of text)), **partner_first_name** (text), **partner_last_name** (text), **partner_birthday** (date), **live_together** (text), **first_date** (date), **engagement_date** (date), **wedding_date** (date), **married_before** (text), **partner_height** (integer), **kids_timeline** (text), **num_children** (text), **started_at** (timestamptz), **completed_at** (timestamptz), **last_screen_key** (text), **page_version** (text), **flow_sequence** (text), **client_tz** (text), **client_tz_offset_min** (integer), **partner_gender** (text), **moved_in_date** (date), **partner_locations** (jsonb (array of objects)), **open_to_anywhere** (boolean), **partner_race** (jsonb (array of text)), **flow** (text), **race_text** (text), **race_count** (integer), **race_white** (boolean), **race_black** (boolean), **race_asian** (boolean), **race_hispanic_latino** (boolean), **race_south_asian** (boolean), **race_mena** (boolean), **race_pacific_islander** (boolean), **race_native_american** (boolean), **race_other** (boolean), **race_prefer_not_to_say** (boolean), **race_multiracial** (boolean), **partner_race_text** (text), **partner_race_count** (integer), **partner_race_white** (boolean), **partner_race_black** (boolean), **partner_race_asian** (boolean), **partner_race_hispanic_latino** (boolean), **partner_race_south_asian** (boolean), **partner_race_mena** (boolean), **partner_race_pacific_islander** (boolean), **partner_race_native_american** (boolean), **partner_race_other** (boolean), **partner_race_prefer_not_to_say** (boolean), **partner_race_multiracial** (boolean), **looking_for_text** (text), **looking_for_count** (integer), **looking_for_casual** (boolean), **looking_for_dating** (boolean), **looking_for_relationship** (boolean), **looking_for_marriage** (boolean), **looking_for_life_partner** (boolean), **open_to_city_text** (text), **open_to_city_count** (integer), **partner_locations_text** (text), **partner_location_cities** (text), **partner_locations_count** (integer), **partner_locations_mapped_count** (integer), **partner_locations_unmapped** (text), **partner_locations_unmapped_count** (integer)

## onboarding_events

TABLE (RLS on). Client analytics events per partial lead (screen timing, validation failures, back, hide).

| Column | Type | Meaning | Allowed / example values | Flow |
|---|---|---|---|---|
| id | bigint | Event row id (identity). | bigint | both |
| partial_lead_id | uuid | partial_leads.id the row belongs to. | uuid | both |
| seq | integer | Per-lead event sequence number (unique with partial_lead_id). | 1..n | both |
| event | text | Onboarding analytics event type. | flow_start \| screen_shown \| screen_completed \| screen_left \| back \| validation_failed \| hidden \| submitted | both |
| screen_key | text | Screen the event happened on. | landing \| who_you_are \| your_partner \| your_relationship \| family_and_intentions \| what_you_want \| public_self \| text_me \| confirmation | both |
| position | integer | 1-based position of the screen in the flow. | 1..7 | both |
| field | text | Field that failed validation (validation_failed only). | birthdate \| email \| height \| race ... | both |
| dwell_ms | integer | Time on screen for screen_left / hidden events, ms. | 12000 | both |
| client_at | timestamptz | Client time of the event. | timestamp | both |
| server_at | timestamptz | Server receive time. | timestamp | both |
| page_version | text | Front-end build that produced the row/event. | 2026-09-27f | both |

## onboarding_screen_times

VIEW (security_invoker; internal). Per lead and screen: times shown and time spent, aggregated from onboarding_events.

| Column | Type | Meaning | Allowed / example values | Flow |
|---|---|---|---|---|
| partial_lead_id | uuid | partial_leads.id the row belongs to. | uuid | both |
| screen_key | text | Screen the event happened on. | landing \| who_you_are \| your_partner \| your_relationship \| family_and_intentions \| what_you_want \| public_self \| text_me \| confirmation | both |
| position | integer | Earliest position the screen appeared at. | 1..7 | both |
| times_shown | bigint | Number of screen_shown events for the screen. | 1..n | both |
| total_ms | bigint | Sum of dwell_ms on the screen. | ms | both |
| longest_visit_ms | integer | Longest single visit, ms. | ms | both |

## metrics / benchmarks: CDC NHANES height

Public benchmark catalog (service-role only; RLS on, no policies). Loaded 2026-09-27 (PT) by grokbot. 560 metrics and 560 benchmark rows, all at the nation geography (geographies geo_level = nation, geo_code = 1), vintage 2018, unit cm. Totals after the load: 631 metrics, 1,655,125 benchmark rows.

**Source.** CDC/NCHS, *Anthropometric Reference Data for Children and Adults: United States, 2015–2018*, Vital and Health Statistics Series 3, No. 46 (Jan 2021), Table 11 (adult males) and Table 9 (adult females): https://www.cdc.gov/nchs/data/series/sr_03/sr03-046-508.pdf. Values are the published NHANES 2015–2018 weighted estimates, loaded verbatim (retrieved through the Internet Archive copy because cdc.gov returns 403 to the load machine). Method check: recomputing from the raw NHANES 2015–2016 and 2017–2018 BMX + DEMO files with WTMEC2YR/2 reproduced the published n, means and percentiles. Heights are measured, not self-reported.

**Metric key pattern.** `height_cm_{sex}_{age}[_{group}]_{stat}`

- sex: `m` or `f`
- age: `20plus`, `20_29`, `30_39`, `40_49`, `50_59`, `60_69`, `70_79`, `80plus` (all groups); race/Hispanic-origin groups use `20plus`, `20_39`, `40_59`, `60plus` (as published)
- group (optional; omitted = all race and Hispanic-origin groups): `nh_white`, `nh_black`, `nh_asian`, `hispanic` (includes Mexican American), `mexican_american`. **Research/background only; never on share cards.**
- stat: `mean`, `p05`, `p10`, `p15`, `p25`, `p50`, `p75`, `p85`, `p90`, `p95`

Examples: `height_cm_m_20plus_mean` = 175.3, `height_cm_f_20plus_mean` = 161.3, `height_cm_m_30_39_p50` = 176.7. On mean rows, `benchmarks.moe` = 1.645 × the published standard error (90% CI half-width, ACS convention); percentile rows have moe null. `benchmarks.source` includes the table number and unweighted n examined.

**New nullable columns on metrics** (no constraints; null for all pre-existing metrics):

| Column | Type | Meaning | Allowed / example values |
|---|---|---|---|
| sex | text | Sex the metric describes, when sex-specific. | m \| f \| null |
| percentile | numeric | Percentile level when the value is a percentile; null for means. | 5, 10, 15, 25, 50, 75, 85, 90, 95 \| null |
| race_ethnicity | text | Race/Hispanic-origin group as published; null = all groups. Sensitive. | nh_white \| nh_black \| nh_asian \| hispanic \| mexican_american \| null |

**Helper functions** (plpgsql/sql, STABLE, SECURITY INVOKER, service_role only):

- `height_cdf_pct(p_sex text, p_cm numeric, p_age_band text default '20plus', p_group text default null)` returns the percent of adults at or below `p_cm`. Linear interpolation between the published 5th–95th percentiles; outside them, a normal tail anchored at the median with sigma from that side's spread ((p50 − p5)/1.645 or (p95 − p50)/1.645).
- `height_share_in_range(p_sex text, p_min_cm numeric, p_max_cm numeric, p_age_band text default '20plus', p_group text default null)` returns the percent (0–100, 2 decimals) between two heights; null min or max = open-ended.

**Sanity checks (2026-09-27).** Men 20+ mean 175.3 cm, women 161.3 cm (gap 14.0 cm). `height_share_in_range('m',182.88,null)` (6′0″ or taller) = 15.07% (raw microdata: 15.3%). `height_share_in_range('m',177.8,193.04)` (5′10″–6′4″) = 36.72% (microdata: 36.9%); men 30–39 = 42.89%. Women 5′0″–5′6″ = 72.02%.

**Other cycles considered, not loaded.** Computed from raw files for comparison: NHANES 2017–March 2020 pre-pandemic (P_BMX + P_DEMO, WTMECPRP): men 175.0 / women 161.2 cm, men ≥ 6′0″ 14.1%, men 5′10″–6′4″ 34.7%. NHANES August 2021–August 2023 (BMX_L + DEMO_L, WTMEC2YR): men 175.1 / women 161.2 cm, men ≥ 6′0″ 15.9%, men 5′10″–6′4″ 34.0%. Neither has an official NCHS percentile report yet, so the published 2015–2018 tables remain the loaded source.

## Legacy / redundant columns (kept, not dropped)

- lives_with_partner duplicates live_together (the client writes both with the same value). Use live_together; responses_research coalesces the two.
- partner_name (free text, older versions) is superseded by partner_first_name + partner_last_name.
- open_to_city (JSON array stored as TEXT; some old rows hold "Anywhere") is superseded by partner_locations (jsonb) + open_to_anywhere.
- linkedin_username (partial_leads) vs linkedin_url (waitlist) hold the same answer in two formats under different names.
- city (waitlist) vs zip_generated_city: city is the display value, usually identical to zip_generated_city for US rows.
- landing_headline actually stores the landing URL (with ?v= tag), not a headline.
- num_children is text (not integer) because of the "5+" option.
