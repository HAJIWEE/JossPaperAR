# 📸 Test-image manifest — style-D spike POC

**Purpose**: the fixed input set for the style-D spike ([[08-style-d-spike-plan|spike plan]] §4). Once the spike runs, **these exact files (by MD5) are the inputs of record** — any swap invalidates comparability and must be re-hashed here.
**Created**: 2026-09-26 (Session 17) · **Normalisation**: auto-orient → EXIF stripped → long edge ≤1536 px (JPEG)
**Sourcing policy**: licence-clean only (Wikimedia Commons, same route as the prototype's car). All are **replaceable** — the strongest version of this POC uses your own photos (swap and update this table).

---

## Selection criteria (standing — PM 2026-09-26)

Every input must satisfy **both**:
1. **In-the-wild background** — no studio / white-background / clean product shots; the photo must look like something a real user would actually take.
2. **One object clearly in focus** — the subject unmistakably dominates the frame, even when its surroundings are busy (that's what makes the bg-removal stress *fair* — the model isn't guessing what the photo is of).

Violations found in PM review → replaced: **S04, S05, S06, S07, S15** (five swaps total). Applies to any future swap, including the user's own photos.

---

## The set (15 of 16 — S13 pending sign-off)

| ID | Group | Subject | Dims | Bytes | MD5 | Licence | Author | Source |
|----|-------|---------|------|-------|-----|---------|--------|--------|
| S01 ✅ | G1-T1 vehicle | Mercedes A220, front ¾ (the canonical offering) | 900×503 | 116643 | `5c59650abb1c2bd8d2eefb4046e47010` | CC BY-SA 4.0 | Elise240SX | [Commons](https://commons.wikimedia.org/wiki/File:2022_Mercedes-Benz_A_220_4Matic_Sedan_in_Denim_Blue_Metallic,_Front_Right,_06-29-2023.jpg) · in repo as `prototype/assets/car-real.jpg` |
| S02 | G1-T1 phone | Smartphone on a table (Lumia) | 720×1280 | 105636 | `faa0e00455469c340d429493039183a0` | CC BY-SA 4.0 | Donny Trung | [Commons](https://commons.wikimedia.org/wiki/File:Microsoft_Lumia_532_on_a_table.jpg) |
| S03 | G1-T1 appliance | Rice cooker (the afterlife-appliance case) | 864×1536 | 157781 | `7622077a729ecff15a322001363fc399` | CC BY-SA 4.0 | Mr.ちゅらさん | [Commons](https://commons.wikimedia.org/wiki/File:Zojirushi_Rice_Cooker_NP-RG05.jpg) |
| S04 | G1-T2 daily-carry | Wallet in context *(replaced 26-09: first pick too clean)* | 1536×1152 | 570830 | `f05d930124ab44cf9597ce39c74ed509` | CC BY-SA 3.0 | TheArmadillo (Wikipedia) | [Commons](https://commons.wikimedia.org/wiki/File:WalletMpegMan.jpg) |
| S05 | G1-T2 daily-carry | Glasses + notebook on a wooden table — real desk scene *(replaced 26-09: first pick too clean)* | 1536×1024 | 103117 | `e15a07601ba30926458f7339846b426b` | CC BY 2.0 | Shixart1985 | [Commons](https://commons.wikimedia.org/wiki/File:Glasses_and_notebook_on_a_wooden_table_in_a_bright_room.jpg) |
| S06 | G1-T3 wealth | Watch **worn on wrist**, hand on notebook — natural context (metal + micro-detail) *(replaced 26-09: first pick was a white-bg studio shot)* | 1025×1536 | 190502 | `374009c1432395a31020d400d61bac37` | CC BY 2.0 | Nenad Stojkovic | [Commons](https://commons.wikimedia.org/wiki/File:Woman_with_a_wrist_watch_checking_her_notebook._(51633485256).jpg) |
| S07 | G1-T4 wearables | Sneakers **worn on feet** (Vans + socks) — real-world bg, one subject *(replaced 26-09: bg too clean)* | 1503×1269 | 593986 | `bb85213839e89970fa321c9881089847` | CC BY-SA 4.0 | Downtowngal | [Commons](https://commons.wikimedia.org/wiki/File:Vans_sneakers_and_socks.jpg) |
| S08 | G1-T5 home | Yixing teapot + tea (compound curves, scene) | 1536×1024 | 139825 | `edbad53269b9343c27481db8d430be43` | CC0 | Markus Kniebes | [Commons](https://commons.wikimedia.org/wiki/File:Yixing_ware_tea_ware_teapot_and_Lapsang_tea.jpg) |
| S09 | G2 food | Fruit bowl — oranges, lime, apples | 1152×1536 | 587913 | `aac9ad9f02517b69b7a9505373a9593a` | CC0 | Gerardolagunes | [Commons](https://commons.wikimedia.org/wiki/File:Fruits_in_bowl_oranges_lime_apples_(1).jpg) |
| S10 | **Track B · identify-only** — store offering, *no stylize* (PM 26-09) | Stack of joss-paper packages (Taiwan) — printed texture + 祝 text | 1536×1152 | 498570 | `bdd5259d87ab9b2dac530f8710f2b8a9` | CC BY-SA 4.0 | Tbatb | [Commons](https://commons.wikimedia.org/wiki/File:Packages_of_joss_paper_in_Taiwan.jpg) |
| S11 | **Track B · identify-only** — store offering, *no stylize* (PM 26-09) | Burning incense sticks, Taipei Bao-an Temple (complex bg, warm light) | 1536×1020 | 286567 | `a566ddea3bfb15618fcc41fbf8d81002` | CC BY 2.0 | Banzai Hiroaki | [Commons](https://commons.wikimedia.org/wiki/File:2009-03-20_burning_incense_sticks_at_Taipei_Bao-an_Temple.jpg) |
| S12 | G4 place | HDB block, Holland Singapore — *as-offering framing* (whole subject) | 1536×1024 | 640534 | `5dd048e756adb765c246aa8939e87438` | CC0 | chuttersnap | [Commons](https://commons.wikimedia.org/wiki/File:Block_21_HDB_Holland,_Singapore_(Unsplash).jpg) |
| **S13** ⚠️ | **G5 sensitive** | **Framed portrait — PENDING your sign-off (SCRUM-24 sensitivity)** | — | — | — | — | — | *not sourced by design* |
| S14 | G6 flat/foil | Ang pow packet (福 character, foil) | 1536×1152 | 435276 | `85d84be81f4f45a1eb4ba0ffa23efd18` | Public domain | Craig | [Commons](https://commons.wikimedia.org/wiki/File:Ang_pow.jpg) |
| S15 | C1 clutter | Assorted keys on a keyring — real surface, one subject in focus *(replaced 26-09: bg too clean; **final eyeball invited** — if it still doesn't read as the busy-bg case, swap in your own photo)* | 1536×1256 | 917737 | `6c855c497b9308e379016ae79775e53a` | CC BY-SA 4.0 | Pittigrilli | [Commons](https://commons.wikimedia.org/wiki/File:Various_keys_on_keyring.jpg) |
| S16 | C2 altar/low-light | Ancestor worship scene — **verify it reads as the dim/altar case; swap if not** | 1536×1150 | 342717 | `748294ab8022bddc785e5b75b253d273` | Public domain | Sampuna | [Commons](https://commons.wikimedia.org/wiki/File:Ancestor_worship004.jpg) |

---

## Run assignment (tiered — spike plan §3/§4)

- **Track A · cartoonization to style D**
  - **Tier 1 · calibration, all 6 endpoints**: S01 (car) · S02 (phone) · S09 (fruit) · S14 (ang pow) → pick the 1–2 endpoints that hold D
  - **Tier 2 · coverage, winners only**: S03–S08, S12, S15–S16 (±S13 if approved)
- **Track B · catalogue identification, NO stylize** (PM decision 2026-09-26): **S10** (joss-paper stack) · **S11** (incense) — these are store offerings, so the pipeline must *identify* them and return the **standard painted asset**. Tests only the recognition path (cost = one ID call, no cartoonization).
- **Shelf test** (T1 items vs store icons): S01, S02, S03 — compare against the Penpot-painted Cash Bundle / Gold Bar / House / Phone

## Honest caveats (for the write-up)

1. **Stock-like bias**: Commons photos are tidier than real user captures — your own photos (esp. the 2 condition cases) would make the POC stronger. Swaps allowed pre-run; re-hash after.
2. **Resolution spread**: S02 (720 px) and S03 (864 px) are the smallest — real captures from mid-range phones will be 1080–4000 px, so re-test if results look resolution-sensitive.
3. **Scene-vs-product mix**: S04/S05/S06 were **replaced (2026-09-26, PM review) — the originals were too clean to prove anything**; the set now skews in-context (desk scenes, worn items). S03 remains a product shot. Record each result's context; don't average scene and product results together.
4. **S13 excluded** until the portrait/sensitivity question is answered (SCRUM-24/19).
5. **S16 needs a human eye** at run time: if it isn't actually a dim/low-light altar shot, the C2 case is unfilled and we ask you for one.

---

*Revised 2026-09-26 (round 2, PM review) — **S07 + S15 replaced** (backgrounds too clean) and the two **standing selection criteria** added (in-the-wild bg · single object in focus); 5 swaps total across the review.*
*Revised 2026-09-26 (same session, PM review) — **S04/S05/S06 replaced** (too clean → in-context shots, re-hashed) · **S10/S11 → Track B** (catalogue identification, no stylize); set remains 15 files, all hashed; S13 still pending.*
*Created 2026-09-26 (Session 17) — 15 files sourced from Wikimedia Commons, QC'd visually (thumbnail pass), normalised and hashed; S13 pending.*
