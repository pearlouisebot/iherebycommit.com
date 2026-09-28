# Research dataset codebooks (_grokbot)

Codebooks for every research dataset loaded into the iherebycommit Supabase database
(HCMST, Pew, GSS, pairfam, Columbia speed dating, OkCupid, etc.) are kept in a **private** repo,
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
- **Pew Research Center ATP Wave 111 (July 5-17, 2022; online dating, N=6,034)** — Supabase tables: `research_pew_w111`, `research_pew_w111_variables`, `research_pew_w111_value_labels` — codebook: https://github.com/mandyeebot/iherebycommit-research-data_grokbot/tree/main/codebooks/pew_w111
- **Pew Research Center ATP Wave 56 (Oct 16-28, 2019; dating & relationships, N=4,860)** — Supabase tables: `research_pew_w56`, `research_pew_w56_variables`, `research_pew_w56_value_labels` — codebook: https://github.com/mandyeebot/iherebycommit-research-data_grokbot/tree/main/codebooks/pew_w56
- **Pew Research Center Internet Project Spring 2013 Tracking Survey (Apr 17-May 19, 2013; online dating & relationships, N=2,252)** — Supabase tables: `research_pew_2013_spring`, `research_pew_2013_spring_variables`, `research_pew_2013_spring_value_labels` — codebook: https://github.com/mandyeebot/iherebycommit-research-data_grokbot/tree/main/codebooks/pew_2013_spring
- **Pew Research Center Internet Project July 2015 Tracking Survey (June 10-July 12, 2015; gaming, jobs, broadband & online dating, N=2,001)** — Supabase tables: `research_pew_2015_jun_jul`, `research_pew_2015_jun_jul_variables`, `research_pew_2015_jun_jul_value_labels` — codebook: https://github.com/mandyeebot/iherebycommit-research-data_grokbot/tree/main/codebooks/pew_2015_jun_jul
- **pairfam Release 14.2 (German Family Panel, waves 1-14, 2008/09-2021/22; GESIS ZA5678, doi:10.4232/pairfam.5678.14.2.0)** — Supabase tables: `research_pairfam_anchor_core`, `research_pairfam_anchor_partnership`, `research_pairfam_anchor_children_p1..p4`, `research_pairfam_anchor_residence_work_p1/p2`, `research_pairfam_anchor_ehc_p1/p2`, `research_pairfam_anchor_retro_p1/p2`, `research_pairfam_anchor_psych`, `research_pairfam_anchor_intergen`, `research_pairfam_anchor_siblings_network_p1/p2`, `research_pairfam_partner`, `research_pairfam_biopart`, `research_pairfam_biochild`, `research_pairfam_overview_multi_actor`, `research_pairfam_anchor12_vig`, `research_pairfam_variables`, `research_pairfam_value_labels` (anchor waves stacked long, one row per id x wave) — also in the harmonized views `research_harmonized_couples_base` / `research_harmonized_couples` — codebook: https://github.com/mandyeebot/iherebycommit-research-data_grokbot/tree/main/codebooks/pairfam_r14_2
- **Northwestern speed-dating studies 2005/2007 (Joel, Eastwick & Finkel 2017; UKDS ReShare 852716)** — data pending login (UK Data Service End User Licence); no Supabase table yet — codebook: https://github.com/mandyeebot/iherebycommit-research-data_grokbot/tree/main/codebooks/nw_speed_dating
