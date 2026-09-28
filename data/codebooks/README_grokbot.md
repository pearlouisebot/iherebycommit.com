# Research dataset codebooks (_grokbot)

Codebooks for every research dataset loaded into the iherebycommit Supabase database
(HCMST, Pew, Columbia speed dating, OkCupid, etc.) are kept in a **private** repo,
because this repo's `master` branch is published publicly via GitHub Pages and some
dataset licenses don't allow redistribution:

https://github.com/mandyeebot/iherebycommit-research-data_grokbot

Drive copy: GrokBot folder > "Research dataset codebooks_grokbot"
(https://drive.google.com/drive/folders/1GvseBwVJofPicHDe2_J5i37RhQYZf_oR)

## Datasets

- **General Social Survey (GSS) 1972-2024 cumulative, NORC Release 3a** — Supabase tables: `research_gss`, `research_gss_variables`, `research_gss_value_labels` — codebook: https://github.com/mandyeebot/iherebycommit-research-data_grokbot/tree/main/codebooks/gss
- **HCMST 2017-2022 combined panel v2.2 (Stanford; Rosenfeld, Thomas & Hausen)** — Supabase tables: `research_hcmst_2017_2022`, `research_hcmst_2017_2022_variables`, `research_hcmst_2017_2022_value_labels` — codebook: https://github.com/mandyeebot/iherebycommit-research-data_grokbot/tree/main/codebooks/hcmst_2017_2022
- **HCMST 2009 panel, waves 1-6 (Stanford; Rosenfeld, Thomas & Falcon)** — Supabase tables: `research_hcmst_2009_main`, `research_hcmst_2009_w4`, `research_hcmst_2009_w5`, `research_hcmst_2009_w6`, `research_hcmst_2009_variables`, `research_hcmst_2009_value_labels` — codebook: https://github.com/mandyeebot/iherebycommit-research-data_grokbot/tree/main/codebooks/hcmst_2009
- **Columbia speed dating experiment 2002-04 (Fisman & Iyengar)** — Supabase tables: `research_columbia_speed_dating`, `research_columbia_speed_dating_variables`, `research_columbia_speed_dating_value_labels` — codebook: https://github.com/mandyeebot/iherebycommit-research-data_grokbot/tree/main/codebooks/columbia_speed_dating
- **OkCupid SF profiles, revised 2021 (Kim & Escobedo-Land, JSE)** — Supabase tables: `research_okcupid_profiles`, `research_okcupid_essays`, `research_okcupid_profiles_variables`, `research_okcupid_profiles_value_labels`, `research_okcupid_essays_variables` — codebook: https://github.com/mandyeebot/iherebycommit-research-data_grokbot/tree/main/codebooks/okcupid
- **Published dating statistics (Table C, C1-C51)** — Supabase table: `research_published_stats` — codebook: https://github.com/mandyeebot/iherebycommit-research-data_grokbot/tree/main/codebooks/published_stats
