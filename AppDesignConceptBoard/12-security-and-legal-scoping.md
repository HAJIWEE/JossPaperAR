# 12 · Security & legal/IP scoping — SCRUM-10 input

**Date:** 2026-09-27 (Session 19) · **Type:** brief scoping (not full policies — those ride SCRUM-19 / SCRUM-24 / Play submission)
**Related:** [[07-system-architecture]] (the stack this scopes) · [[ADRs/ADR-001-option-a-expo-rn-supabase-hosted-ai|ADR-001]] (keys posture) · [[ADRs/ADR-005-honest-client-caps-append-only-ledger|ADR-005]] (integrity, done S19) · [[11-integrity-posture]] · [[10-economy-spec]] (⚠️ §B.7 Play-fee question) · [[05-concept-to-mvp-gap-analysis]] §7.5 · SCRUM-19 · SCRUM-24

> **Purpose:** before SCRUM-19 (privacy) and the first Play submission, pin (A) the security requirements the MVP build must satisfy, and (B) the legal/IP items that could bite — with sources verified today, not guessed.

---

## A · Security requirements (MVP scoping)

### A.1 What we are protecting (assets, in order of value)

| # | Asset | Why it's the target |
|---|--------|--------------------|
| 1 | **fal.ai API key** (spend) | the one credential that prints money — worst case = unbounded AI spend (economy §6 stop-rule exists *because* of this) |
| 2 | **User photos · ancestor names · coarse location** | gap-analysis risk #5: "the most personal data imaginable" — a breach here is unrecoverable |
| 3 | **The ledger / league** | tampering = the product's trust (ADR-005 closes the design half) |
| 4 | **Supabase service-role key + storage** | full backend if leaked; anon key + RLS is the public surface |
| 5 | **Build pipeline** (EAS, repo, npm) | supply-chain = backdoor into every future release |

### A.2 Controls already locked (no action — restated for the checklist)

| Control | Source |
|---|---|
| AI keys live **only in Edge Functions, never in the client** | ADR-001 §3 |
| Client asserts, server decides · append-only ledger · derived band · caps + rate limits + `integrity_flags` | ADR-005 · [[11-integrity-posture]] |
| RLS on every table · private storage buckets + signed URLs · `grid_cells` stores no user identity | [[07-system-architecture]] §5.3 |
| Daily caps + **global daily AI-budget stop-rule** (queue, never fail-open) | [[10-economy-spec]] §4 — ✅ **stop-rule enforced 2026-10-04** (SCRUM-59; photo path) |
| Ancestor names never in analytics/crash reports | 07 §5.3 `ancestors` · SCRUM-19 |
| No secrets in the repo — **verified by scan today** (no `fal_*`/`sk-*`/JWT/.env anywhere in the vault) | this session |

### A.3 Requirements the *build* must satisfy (the actual scope)

| # | Requirement | Tier | Owner |
|---|-------------|------|-------|
| S1 | **Secrets**: fal + Supabase service-role keys in Supabase Edge secret store / EAS secrets only; never in repo, logs, or client bundle; rotate on any doubt | **MVP** | repo + CI milestone |
| S2 | **RLS deny-by-default audit**: every new table ships with its RLS policy in the same migration; a CI check fails a migration that creates a table without a policy | **MVP** | repo + CI milestone |
| S3 | **Signed URLs**: short TTL, per-user scoping; no public storage paths in client state | **MVP** | app build |
| S4 | **Input validation on every RPC** (types, ranges, enum membership) — the trust matrix in [[11-integrity-posture]] §1 is the spec | **MVP** | award-service / orchestrator |
| S5 | **Moderation gate** on captures before stylize (`captures.status: pending → styled\|rejected`) — also the Play AI-policy hook (§B.2); simplest viable: provider moderation flag + reject path | **MVP** | cartoonize-orchestrator |
| S6 | **Dependency hygiene**: lockfile committed, `npm audit` in CI, no new dep without license check (feeds the license inventory §B.3) | **MVP** | repo + CI milestone |
| S7 | **Safe error surfaces**: client never sees stack traces/provider errors; logs carry `user_id` + event, never photo bytes/names (privacy × security overlap) | **MVP** | app + edge fns |
| S8 | **Crash/analytics off until consent**; no ancestor names/coordinates in any SDK payload (also Play Data Safety accuracy) | alpha | SCRUM-25 |
| S9 | **Ad SDK** (later): one vetted family-safe SDK, data-safety disclosure + EEA consent (UMP) declared at integration time | beta | ADR-008 |
| S10 | **Play Integrity / device attestation**: deferred per ADR-005 — revisit only on §6 abuse signals | beta | SCRUM-11 |
| S11 | **Backup/restore + delete-all rehearsal**: prove restore of Postgres *and* prove full account deletion (Play requires a working account-deletion path once accounts exist — §B.5) | alpha | SCRUM-19 |

**Explicitly out of scope for MVP** (recorded so nobody re-raises them): pen-testing, WAF, DDoS mitigation (Supabase/fal absorb), SOC2/ISO anything, certificate pinning, on-device encryption beyond platform defaults.

### A.4 Standing security rule (one line for the repo)

> **Server decides, secrets never leave the server, deny by default, and every migration carries its own RLS policy.**

---

## B · Legal & IP register

*Sources checked 2026-09-27: fal.ai Terms of Service (updated 2026-09-08) + API Services Terms; Google Play "AI-Generated Content policy" help page. Item status: ✅ settled · ⚠️ open · ⏳ later.*

### B.1 AI outputs are **not ours to own** — fal.ai grants no IP rights ✅ settled (posture decided)

Verified verbatim from fal's **API Services Terms**:

> *"Company does not represent or warrant that any Output Content will be original, will not infringe rights of any third party (including Intellectual Property Rights), or otherwise entitle Client to any Intellectual Property Rights in any Output Content. Client's and its End Users' use of the AI Features is at their own risk."*

Also: **Client (we) indemnify fal** for our/end-users' use; outputs **may not be unique across users**; nano-banana-2 / moondream2 are **third-party API partners** → *"Client Content will be transferred to such a third party"* (Google). On the plus side: **fal will not use Client Content to train** (except models marked "Pending Enterprise Ready") — good for user-photo privacy, worth re-checking per model at integration.

**Posture for us:**
1. Treat style-D sprites as **usable but not exclusively ownable** — no enforcement story if a competitor copies an output; our defensible IP is the *product* (code, design, brand), not individual generated images.
2. Never generate from prompts that could infringe (trademarked characters, living artists' named styles as the *only* descriptor) — AUP + indemnity risk.
3. User-facing **ToS must say outputs are AI-generated, may not be unique, and are provided as-is** — this also satisfies the honesty half of the Play AI policy (§B.2).
4. **Model-side terms checked per provider at integration time** (Google's terms via fal govern nano-banana-2) — ADR-002 chose endpoints; their *terms* get a 10-minute read before first production call.

### B.2 Google Play AI-Generated Content policy — **we are in scope** ⚠️ open (build hook exists)

Play's policy (verified today) explicitly covers *"Text-to-image … apps that use AI to generate images"* — with a **central** image-generation feature. Requirements: outputs must not be offensive/prohibited/deceptive; developer is responsible; other policies (esp. **Families**, UGC) still apply. No mandatory watermark/label in the policy text itself.

**Concrete:** S5 (moderation gate) is the compliance mechanism; rejected-path already in the schema; the **family-safe** promise in the concept makes the Families-policy overlap worth a read before submission (our audience is adults, but *family-safe ads* + memorial content sit close to it).

### B.3 Third-party assets in our own artifacts ✅ settled (keep the habit)

| Asset | Licence | Obligation / action |
|---|---|---|
| Prototype `car-real.jpg` (+panel) | CC BY-SA 4.0 | attribution + share-alike — **CREDITS.md already says: swap for own photo before publication** |
| Spike test set (15 files) | CC0/CC BY/CC BY-SA — tracked per-file with MD5 in `spike/test-images/MANIFEST.md` | attribution where BY; fine for internal POC |
| Ink/brush **fonts** (app) | ⚠️ verify when chosen | pick OFL/Apache fonts from the start — retro-fitting a licence later is painful |
| App mark, Penpot boards, SVG icons, `gen-car-3d.js` art | self-authored ✅ | our copyright |
| Traditional motifs (福 · 中国结 · 剪纸 · joss-paper patterns) | public domain (traditional) | ✅ free to use — **but** any *specific modern artwork* traced/copied from a pack is not: style from tradition, not from someone's shop |
| Duolingo/Pokémon GO *mechanics* (leagues, throw) | ideas aren't copyrightable ✅ | never use their names/marks in UI, store listing, or ads |

### B.4 Cultural IP ≠ legal IP — the split ⏳ (SCRUM-24)

Traditional motifs are legally free and culturally load-bearing. **SCRUM-24 owns the cultural review** (tier names · offering returns · digital tablets · monetising a memorial); this doc only draws the line: *legal* clearance = §B.3/B.5, *cultural* clearance = SCRUM-24. Neither substitutes for the other.

### B.5 Privacy law & store declarations ⏳ → SCRUM-19 (with two new hooks)

**Scoping stance (PM direction 2026-09-27):** comply with **PDPA as the baseline** (we're established in SG — mandatory), and treat **GDPR as a design target wherever listed** — the marginal cost of designing to GDPR from day one is small, and the EN/ZH diaspora audience makes EU listing likely. Jurisdiction flags: **Singapore PDPA** (base) · **GDPR/EEA** (if listed) · **PIPL** deferred (no CN distribution plan; Google Play isn't in CN anyway). Rules below are *design inputs*, not legal advice; SCRUM-19 turns them into the posture doc.

#### B.5.1 · What the two laws require (primary sources verified 2026-09-27)

| | **PDPA (Singapore)** — base | **GDPR (EU/EEA)** — if listed |
|---|---|---|
| Applies to | living individuals' personal data (SG entities) | any users we *offer services to* in the EU, regardless of where we sit (Art. 3 territorial scope) |
| Breach notification | **30 calendar days** to assess a suspected breach → **3 calendar days** to notify PDPC after determining it is notifiable → notify affected people as soon as practicable (significant harm likely) | **72 hours** to the supervisory authority (Art. 33); to affected individuals if high risk |
| Notifiable threshold | likely **significant harm** OR **≥ 500 individuals** | any breach likely to result in a risk to individuals |
| Sensitive data | protected via consent + Protection obligations generally | **Art. 9 special category: data *revealing religious or philosophical beliefs*** ⚠️ → D1 |
| Deceased persons | not personal data under PDPA | **out of scope** — Recital 27: *"This Regulation does not apply to the personal data of deceased persons"* (a Member State may still legislate) |
| Penalties | up to **10% of annual turnover in Singapore** (orgs >S$10M) or **S$1M**, whichever applies | up to **4% of global annual turnover** |
| Roles | **DPO must be designated** and contact published | DPO likely required · **Art. 25 privacy by design & by default** · DPIA likely (special-category data at scale → Art. 35) |
| Consent | consent + purpose notification at collection | lawful basis per purpose; **ads need prior consent** (→ Play UMP, D10) |

#### B.5.2 · Design considerations (D1–D10) — what this means for the app

| # | Consideration | Law hook | Lands in |
|---|----------------|----------|----------|
| D1 | **The app reveals religious/philosophical belief** (digital ancestral rites · altar · festivals) → an account carrying ritual content may hold **Art. 9 special-category data**; realistic posture = **explicit consent at onboarding** ("this app records my ancestral tributes"), one honest screen EN/ZH — the boot flow already exists to host it | GDPR Art. 9 | **onboarding consent step** |
| D2 | **Purpose notice at every collection point** — photo → stylization; location → coarse cell only (value hidden); ancestor names → the tablets. Short, plain-language, EN/ZH | PDPA notification · GDPR Art. 13 | onboarding + capture footnotes |
| D3 | **Privacy hub in Settings**: view/export my data · correct · **delete everything server-side** · withdraw consent — one screen serving three laws (incl. the Play account-deletion requirement below) | PDPA access/correction · GDPR Arts. 15–17 · Play deletion policy | SCRUM-33 settings (vocabulary: signed-off auth boards) |
| D4 | **Retention with teeth**: raw photo purged after N days, styled sprite kept while the shrine lives — windows written in SCRUM-19, but *schema* must make deletion easy (storage path on every row, no orphaned copies, backups plan) | PDPA retention limitation · GDPR storage limitation | SCRUM-19 → schema |
| D5 | **Region + transfers**: choose Supabase region deliberately (SG if offered); fal (US) receives images → privacy policy says so; fal publishes a DPA (seen on their legal page today) | PDPA transfer limitation · GDPR Ch. V | SCRUM-19 · repo/CI milestone |
| D6 | **Incident runbook**: one page — who decides, the **30d/3d** (PDPA) and **72h** (GDPR) clocks, where PDPC lives; logs carry events, never photo bytes/names (ties §A.3 S7) | both breach regimes | SCRUM-19 deliverable |
| D7 | **DPO designation** — PM is the natural holder at hobby scale; publish a contact in the privacy policy. Free, but it is a *legal* requirement | PDPA · GDPR | B.8 privacy policy |
| D8 | **Data inventory built once, used three times** — one inventory (photos · coarse location · names · device ids · ad-id later) feeds the **Play Data Safety form**, the PDPA purpose notices, and the GDPR Art. 13 disclosures | all three + Play | SCRUM-19 (= §B.5 hook 2) |
| D9 | **Ancestor names**: excluded as deceased-person data from both laws (PDPA covers the living; GDPR Recital 27) — but cultural harm doesn't care about jurisdiction → keep names out of analytics, logs, and share surfaces (already the 07 §5.3 rule; SCRUM-24 for the sensitivity side) | both scope-outs | standing rule ✅ |
| D10 | **Ads consent**: EEA → Google UMP consent banner before any ad renders; elsewhere → Play defaults | GDPR consent for ads | S9 · ADR-008 |

**Scope guard:** these ten are *considerations for design*. The full obligation sets (PDPA's nine obligations, GDPR's rights catalog) get the SCRUM-19 treatment; PIPL stays deferred.

Two more things SCRUM-19 must fold in that weren't on its ticket:

1. **Play account-deletion policy**: once *any* account creation exists (our optional-account upgrade = yes), Play requires an in-app **deletion path that actually deletes server-side** — SCRUM-19's delete-all deliverable is therefore also a **store requirement**, not just privacy posture.
2. **Play Data Safety form** = a security-adjacent artifact: declared collection (photos · coarse location · app activity · ads later) must match reality exactly — mismatch = rejection. Draft it alongside SCRUM-19.

### B.6 Naming, branding ⚠️ open (cheap now, expensive later)

- **Trademark search for the app name** before any public listing (SG IPO + the markets we list in). "Joss Paper AR" is descriptive → possibly weak as a mark; decide name vs. mark early-ish (not MVP-blocking, but pre-beta).
- Store listing text must not imply affiliation with any temple/association or spiritual *efficacy* ("guarantees ancestors receive…") — honesty clause + cultural sensitivity (SCRUM-24).

### B.7 ⚠️ **New finding: Play's cut vs. the economy floor** (feed back to SCRUM-18)

Credits are a **digital good sold in-app → Google Play Billing is mandatory** (policy) → Play takes a service fee (commonly **15%** on the first ~US$1M/yr of annual per-developer revenue, 30% above / for some categories — *verify exact rate applicable to us at implementation*). The economy spec's **$1.55/1,000 credits with a $1.19 floor** was derived from AI cost + 30% margin — **it does not visibly account for the Play fee**. After the fee, net on a $4.99 bundle ≈ $4.24 → margin floor may bite.

- **Not re-opening the locked numbers here** — flagged as a cross-doc question: *does the floor hold after Play's cut?* Owner: SCRUM-18 follow-up / ADR-006-adjacent review before cash-shop build (SCRUM-42 designs the purchase UI anyway — check then).

### B.8 Terms of service & privacy policy ⚠️ open (required pre-submission)

Needed at Play submission: **privacy policy URL** (we process photos/location/names) + **ToS** covering: AI-output nature (§B.1.3) · no religious efficacy claim · user owns their photos, licence to process for stylization · account-deletion instructions · ads disclosure (later). Draft = SCRUM-19 output; keep plain-language + EN/ZH (audience).

### B.9 Register summary

| # | Item | Status | Owner / when |
|---|---|---|---|
| B.1 | fal grants no output IP · indemnity runs *our* way out · no-train on client content | ✅ posture set | this doc — apply in ToS (B.8) |
| B.2 | Play AI-Generated Content policy — in scope; moderation gate = compliance | ⚠️ | S5 (MVP) + read Families policy pre-beta |
| B.3 | Asset licences tracked; swap CC BY-SA car before publication; OFL fonts rule | ✅ habit | re-check at first public build |
| B.4 | Cultural review (distinct from legal) | ⏳ | **SCRUM-24** |
| B.5 | **PDPA (baseline) + GDPR (design target)** — B.5.1 obligations table · **D1–D10 design considerations** (Art. 9 onboarding consent · privacy hub · retention · incident clocks 30d/3d + 72h · DPO · data inventory) · Play account-deletion · Data Safety form | ⚠️ noted for design | **SCRUM-19** owns the posture; D1–D3 touch design tickets (onboarding · SCRUM-33) |
| B.6 | Trademark search + naming | ⚠️ | pre-beta · cheap now |
| B.7 | **Play billing fee vs. $1.19 floor** — margin may not hold | ⚠️ | SCRUM-18 follow-up · check with SCRUM-42 |
| B.8 | Privacy policy + ToS (EN/ZH) | ⚠️ | SCRUM-19 deliverable |
| B.9 | Model-provider terms (Google/nano-2, moondream) — 10-min read | ⏳ | at first production call |

---

*Updated 2026-09-27 (**v2**, same session, PM) — **§B.5 expanded into §B.5.1 (PDPA vs GDPR obligations, primary sources verified: PDPA breach timelines 30d/3d · ≥500 threshold · 10%/S$1M penalties · GDPR Recital 27 deceased-scope-out · Art. 9 religious belief) and §B.5.2 (D1–D10 design considerations)**; scoping stance pinned: **PDPA = baseline, GDPR = design target**; register B.5 row updated*
*Created 2026-09-27 (Session 19) — brief security + legal/IP scoping requested by PM alongside SCRUM-21. Primary sources verified: fal.ai ToS (2026-09-08) + API Services Terms · Google Play AI-Generated Content policy. New cross-doc findings: Play account-deletion + Data Safety hooks for SCRUM-19 (§B.5), Play-fee question for the economy floor (§B.7).*
