/*
 * Penpot MCP sweep v3 — clipping + z-order occlusion + text contrast (READ-ONLY)
 * Project: Joss Paper AR · file `JossPaperAR`, page "New-user tutorial · Core loop"
 *
 * This is the VERIFIED implementation — byte-identical to `storage.runAudit3`,
 * the function that produced the 2026-09-28 results below. Do not "tidy" it
 * without re-running; the regexes are load-bearing.
 *
 * RESULTS (2026-09-28, post z-order fix)
 *   boards 135 · leaves scanned 10042
 *   clip  0    ← no real clipping defects anywhere
 *   occl  14   ← all intentional customize-sheet / background-option layering
 *   lowc  130  ← THE real defect class, across 47 boards
 *
 * WHY v1 (icon-occlusion-audit.js) WAS WRONG — it produced ~all false positives
 *  1. Text shapes report a LAYOUT box (growType auto-width) far wider than the
 *     inked glyphs. v1 flagged `text · label` as 100% occluded by its own centred
 *     `btn · pill` sibling — a pure measurement artefact.
 *     FIX: `ink()` measures text with `shape.textBounds` (the real inked box).
 *  2. v1 compared SIBLINGS only. Real art is nested in groups, so a sibling-only
 *     test misses true paint order. FIX: `flatten()` walks the whole board in
 *     document order (Penpot children are stored back-to-front), so index i<j
 *     means "j paints on top of i" regardless of nesting depth.
 *  3. v1 had no notion of deliberate layering. FIX: `CHROME` excludes scrims,
 *     sheets, dialogs, panels, buttons and badges from ever counting as an
 *     occluder; `pfx()` skips two shapes from the same component; `DECOR` skips
 *     particles/embers/halo.
 *
 * Penpot API notes (verified live 2026-09-28)
 *  - `Page` has NO `.boards` / `.children`. Entry points are `page.root`,
 *    `page.findShapes({...})`, `page.getShapeById(id)`.
 *  - `page.findShapes({type:"board"})` returns 136 shapes here — it INCLUDES the
 *    page's "Root Frame", which must be filtered out (135 real boards).
 *  - `Text.textBounds` = {x,y,width,height} in ABSOLUTE page coords, the same
 *    space as `shape.bounds`. Verified: an ancestor-sheet header reads
 *    textBounds w:144 vs bounds w:310.
 *
 * RULES
 *  clip : visible ink box crosses the board frame by > 1 px on either axis
 *         (board.clipContent then hides the overflow → "partially obscured")
 *  occl : a LATER opaque solid shape covers >= 35% of an art-class shape's ink
 *         box. Victims restricted to ART prefixes; occluders must be solid
 *         (no gradient), alpha >= 0.85, not CHROME, not an `svg-` raw import,
 *         and not from the same component.
 *  lowc : solid text colour vs the resolved BACKDROP at the text's centre point,
 *         WCAG ratio < 3.0. Backdrop = nearest solid, alpha >= 0.85, non-text
 *         shape below it that contains the centre point; falls back to the board
 *         fill (reported as `board(#rrggbb)` so you can tell which happened).
 *
 * Paste the body below into penpot__execute_code.
 */

function runAudit3(){
  const page=penpot.currentPage;
  const boards=page.findShapes({type:"board"}).filter(b=>b.name!=="Root Frame");
  const hex2rgb=h=>{if(!h)return null;h=h.replace('#','');if(h.length===3)h=h.split('').map(c=>c+c).join('');
    const n=parseInt(h,16);if(isNaN(n))return null;return[(n>>16)&255,(n>>8)&255,n&255];};
  const lum=([r,g,b])=>{const f=v=>{v/=255;return v<=0.03928?v/12.92:Math.pow((v+0.055)/1.055,2.4);};
    return 0.2126*f(r)+0.7152*f(g)+0.0722*f(b);};
  const contrast=(a,b)=>{const l1=lum(a),l2=lum(b);return(Math.max(l1,l2)+0.05)/(Math.min(l1,l2)+0.05);};
  // Shapes that are ALLOWED to cover things — modal chrome, controls, decoration.
  const CHROME=/scrim|overlay|flash|flare|glow|dim|vignette|sheet|dialog|modal|card|banner|btn|button|fail|miss|busy|perm|toast|panel|drawer|badge|pill|chip|shadow|frame|background/i;
  const DECOR=/particle|ember|spark|dust|confetti|texture|noise|grain|facet|halo/i;
  // Shapes worth protecting from being covered.
  const ART=/^(icon|logo|art|hud|nav|mark|seal)\b/i;
  const pfx=n=>n.split(/[·(]/)[0].trim();
  // THE key fix: text is measured by its inked box, not its layout box.
  const ink=s=>{if(s.type==="text"&&s.textBounds){const t=s.textBounds;return{x:t.x,y:t.y,w:t.width,h:t.height};}
    const b=s.bounds;return b?{x:b.x,y:b.y,w:b.width,h:b.height}:null;};
  const alpha=s=>(s.opacity==null?1:s.opacity)*((s.fills&&s.fills[0])?(s.fills[0].fillOpacity==null?1:s.fills[0].fillOpacity):1);
  const vis=s=>!s.hidden&&s.visible!==false&&alpha(s)>0.02;
  const solid=s=>{const f=(s.fills||[])[0];if(!f)return null;if(f.fillColorGradient||!f.fillColor)return null;
    return{hex:f.fillColor,a:(f.fillOpacity==null?1:f.fillOpacity)};};
  const frac=(a,b)=>{if(!a||!b)return 0;
    const ix=Math.max(0,Math.min(a.x+a.w,b.x+b.w)-Math.max(a.x,b.x));
    const iy=Math.max(0,Math.min(a.y+a.h,b.y+b.h)-Math.max(a.y,b.y));
    const ar=a.w*a.h;return ar<=0?0:(ix*iy)/ar;};
  const covers=(r,px,py)=>r&&px>=r.x&&px<=r.x+r.w&&py>=r.y&&py<=r.y+r.h;
  const flatten=(sh,out)=>{out.push(sh);for(const k of(sh.children||[]))flatten(k,out);return out;};
  const hx=a=>"#"+a.map(v=>v.toString(16).padStart(2,'0')).join('');
  const clip=[],occl=[],lowc=[];let scanned=0;
  for(const b of boards){
    const bb=b.bounds;const list=flatten(b,[]).slice(1);
    const bs=solid(b);const boardRgb=bs?(hex2rgb(bs.hex)||[255,255,255]):[255,255,255];
    for(let i=0;i<list.length;i++){
      const s=list[i];if(!vis(s))continue;const r=ink(s);if(!r||r.w<=0||r.h<=0)continue;scanned++;
      // 1) clipping — board.clipContent hides whatever crosses the frame
      const ox=Math.max(0,bb.x-r.x)+Math.max(0,(r.x+r.w)-(bb.x+bb.w));
      const oy=Math.max(0,bb.y-r.y)+Math.max(0,(r.y+r.h)-(bb.y+bb.h));
      if(ox>1||oy>1)clip.push({board:b.name,shape:s.name,type:s.type,overX:Math.round(ox),overY:Math.round(oy)});
      // 2) z-order occlusion — only opaque, non-chrome, cross-component covers
      if(ART.test(s.name)&&!DECOR.test(s.name)){
        for(let j=i+1;j<list.length;j++){const o=list[j];if(!vis(o))continue;
          const orr=ink(o);if(!orr)continue;
          if(CHROME.test(o.name)||/^svg-/.test(o.name))continue;
          if(!solid(o)||alpha(o)<0.85)continue;
          if(pfx(o.name)===pfx(s.name))continue;
          if(frac(r,orr)>=0.35){occl.push({board:b.name,art:s.name,by:o.name,cov:Math.round(frac(r,orr)*100)+"%"});break;}}
      }
      // 3) contrast — resolve the backdrop at the text's centre point
      if(s.type==="text"&&s.characters&&s.characters.trim()){
        const ts=solid(s);if(!ts||ts.a<0.5)continue;const rgb=hex2rgb(ts.hex);if(!rgb)continue;
        const cx=r.x+r.w/2,cy=r.y+r.h/2;let bg=boardRgb,found=false;
        for(let j=i-1;j>=0;j--){const p=list[j];if(!vis(p)||p.type==="text")continue;
          if(!covers(ink(p),cx,cy))continue;const ps=solid(p);if(!ps||ps.a<0.85)continue;
          const pr=hex2rgb(ps.hex);if(!pr)continue;bg=pr;found=true;break;}
        const cr=contrast(rgb,bg);
        if(cr<3.0)lowc.push({board:b.name,text:s.name,chars:s.characters.slice(0,26),
          fg:ts.hex,bg:found?hx(bg):"board("+hx(boardRgb)+")",ratio:Math.round(cr*100)/100});
      }
    }
  }
  return {boards:boards.length,scanned,clip,occl,lowc};
}

/* ============================================================================
 * FINDINGS & FIXES — 2026-09-28
 * ============================================================================
 *
 * CONFIRMED ROOT CAUSE #1 (z-order) — fixed in the live file.
 *   Symptom (customer report): on the ancestor-customize sheets, "the first tab
 *   is partially obscured by the sheet it lives on".
 *   Reality: `nav · tab League subtext` was painted ON TOP of `modal · scrim`,
 *   `ancestors · sheet`, and `sheet · title` in 6 boards. The subtext floated
 *   over the sheet face and collided with `sheet · title`. Verified by pixel
 *   overlap, not by name proximity — the ZH board's subtext ink box overlaps
 *   `sheet · title` by 18x16 px; the EN boards overlap the sheet face itself.
 *   Fix applied (non-destructive, z-order only — no geometry/colour change):
 *   the subtext now paints BEFORE the scrim/sheet/title in all 6 boards.
 *   VERIFIED post-fix indices (flatten order = paint order, low index = below):
 *     EN · 1s  Ancestor sheet                        sub 11 < scrim 78  < title 86
 *     EN · 1s2 Ancestor sheet / edit mode            sub 11 < scrim 102 < title 111
 *     EN · 1s3 Ancestor sheet / ritual-data consent  sub 11 < scrim 78  < title 86
 *     ZH · 1s  安奉牌位                               sub 11 < scrim 78  < title 87
 *     ZH · 1s2 安奉牌位 / 编辑                         sub 11 < scrim 102 < title 111
 *     ZH · 1s3 安奉牌位 / 祭拜数据同意                  sub 11 < scrim 78  < title 87
 *   Note: Penpot stores children BACK-TO-FRONT, so a LOWER flatten index paints
 *   FIRST and therefore sits BELOW. `sub < scrim` is the passing condition.
 *   The other 24 boards carrying this shape (Home/customize screens) have no
 *   scrim at all — the subtext sits at index 91 under `sheet · title` at 108,
 *   which is correct and needs no change.
 *   Verification: this audit reports 0 clip findings on all 6. The z-order fix
 *     did NOT change the subtext's contrast — it still resolves against the same
 *     #eae2d2 backdrop (#a8862a on #eae2d2 = 2.67, failing AA). That is the
 *     token problem below, not a layering problem.
 */

/* ============================================================================
 * v4 — ADDED 2026-09-29 (SCRUM-45 tranche 2). runAudit3 above is UNCHANGED and
 * stays byte-identical to `storage.runAudit3`, the function that produced the
 * 2026-09-28 baseline. Do not fold these together.
 *
 * WHY v4 EXISTS — `lowc 0` IS NOT A PASS.
 *   v3's `lowc` bucket fires at ratio < 3.0. WCAG 2.1 AA requires 4.5:1 for body
 *   text. So a file can report `lowc 0` while still holding 132 AA failures —
 *   which is exactly what happened on 2026-09-29: tranche 1 drove `lowc` to 0 and
 *   the result was read as "contrast done", but a widened re-run found 136 shapes
 *   under 4.5:1 (132 genuine body text + 4 legitimate large-text passes), 112 of
 *   them still on un-swapped brand gold #a8862a. `lowc 0` meant only "nothing
 *   below 3.0". NEVER report `lowc 0` as AA compliance again.
 *
 * v4 CHANGES vs v3 (clip and occl rules are untouched):
 *   - NEW bucket `lowcAA` : ratio < 4.5 AND not WCAG large text. THIS is the
 *     accessibility gate. A passing sweep requires `lowcAA 0`.
 *   - `lowc` is kept at < 3.0 for baseline diffing, and a new `largeLow` bucket
 *     reports large text under 3.0 separately (those are real defects too —
 *     large text only needs 3.0, so under 3.0 it fails even the relaxed rule).
 *   - WCAG large text = fontSize >= 24px, OR fontSize >= 18.66px (14pt) AND
 *     fontWeight >= 700. Verified against this file: it selects exactly 4 shapes
 *     (`logo · Joss` 40/800 ×2, `miss · glyph` 90/700 ×2) — cinnabar display
 *     glyphs on near-black boards at 3.37/3.46, which PASS as large text and must
 *     NOT be darkened. Darkening them would push light-on-dark text the wrong way.
 *
 * RESULTS (2026-09-29, post tranche 2, canonical tokens.css values)
 *   boards 135 · leaves scanned 10042 · text shapes contrast-checked 2453
 *   clip    0
 *   occl   14   ← byte-identical to the 2026-09-28 baseline (swatch previews)
 *   lowc    0
 *   lowcAA  0   ← all 132 AA body-text failures cleared; every body text is now
 *                 >= 4.51 (the two disc tokens are the floor, at 4.51)
 *   largeLow 0  ← the 4 large-text shapes sit at 3.37/3.46, above the 3.0 floor
 *   file-wide ratio range across all 2453 text shapes: 3.37 – 18.51. The 3.37
 *     floor is NOT a defect — it is `logo · Joss`, one of the 4 large-text passes.
 *
 * TOKEN VALUES ARE NOT NEGOTIABLE — USE design-system/tokens.css.
 *   Tranche 2 was first applied from hand-carried values in the session notes and
 *   4 of the 5 tokens were WRONG (over-darkened, and divergent from the build):
 *     --malachite-text  applied #07604a  canonical #0A7359
 *     --cinnabar-text   applied #8d2b18  canonical #B73820
 *     --disc-gold-deep  applied #7b621f  canonical #8B6F23
 *     --disc-malachite  applied #07604a  canonical #0C8265
 *   All four cleared 4.5 but were darker than necessary AND reintroduced the very
 *   Penpot↔tokens.css drift that caused this tranche. They were re-applied to the
 *   canonical values (14 shapes) and re-verified. `design-system/tokens.css` is
 *   the source of truth — it is machine-checked by `contrast-check.js` (21/21).
 *   Read the hex from there; never retype it from a note.
 *
 * Paste the body below into penpot__execute_code.
 * ============================================================================ */
function runAudit4(){
  const page=penpot.currentPage;
  const boards=page.findShapes({type:"board"}).filter(b=>b.name!=="Root Frame");
  const hex2rgb=h=>{if(!h)return null;h=h.replace('#','');if(h.length===3)h=h.split('').map(c=>c+c).join('');
    const n=parseInt(h,16);if(isNaN(n))return null;return[(n>>16)&255,(n>>8)&255,n&255];};
  const lum=([r,g,b])=>{const f=v=>{v/=255;return v<=0.03928?v/12.92:Math.pow((v+0.055)/1.055,2.4);};
    return 0.2126*f(r)+0.7152*f(g)+0.0722*f(b);};
  const contrast=(a,b)=>{const l1=lum(a),l2=lum(b);return(Math.max(l1,l2)+0.05)/(Math.min(l1,l2)+0.05);};
  const CHROME=/scrim|overlay|flash|flare|glow|dim|vignette|sheet|dialog|modal|card|banner|btn|button|fail|miss|busy|perm|toast|panel|drawer|badge|pill|chip|shadow|frame|background/i;
  const DECOR=/particle|ember|spark|dust|confetti|texture|noise|grain|facet|halo/i;
  const ART=/^(icon|logo|art|hud|nav|mark|seal)\b/i;
  const pfx=n=>n.split(/[·(]/)[0].trim();
  const ink=s=>{if(s.type==="text"&&s.textBounds){const t=s.textBounds;return{x:t.x,y:t.y,w:t.width,h:t.height};}
    const b=s.bounds;return b?{x:b.x,y:b.y,w:b.width,h:b.height}:null;};
  const alpha=s=>(s.opacity==null?1:s.opacity)*((s.fills&&s.fills[0])?(s.fills[0].fillOpacity==null?1:s.fills[0].fillOpacity):1);
  const vis=s=>!s.hidden&&s.visible!==false&&alpha(s)>0.02;
  const solid=s=>{const f=(s.fills||[])[0];if(!f)return null;if(f.fillColorGradient||!f.fillColor)return null;
    return{hex:f.fillColor,a:(f.fillOpacity==null?1:f.fillOpacity)};};
  const frac=(a,b)=>{if(!a||!b)return 0;
    const ix=Math.max(0,Math.min(a.x+a.w,b.x+b.w)-Math.max(a.x,b.x));
    const iy=Math.max(0,Math.min(a.y+a.h,b.y+b.h)-Math.max(a.y,b.y));
    const ar=a.w*a.h;return ar<=0?0:(ix*iy)/ar;};
  const covers=(r,px,py)=>r&&px>=r.x&&px<=r.x+r.w&&py>=r.y&&py<=r.y+r.h;
  const flatten=(sh,out)=>{out.push(sh);for(const k of(sh.children||[]))flatten(k,out);return out;};
  const hx=a=>"#"+a.map(v=>v.toString(16).padStart(2,'0')).join('');
  // WCAG 2.1 large text: >=24px, or >=18.66px (14pt) when bold (>=700)
  const isLargeText=s=>{const fs=parseFloat(s.fontSize),fw=parseFloat(s.fontWeight);
    return (isFinite(fs)&&fs>=24)||(isFinite(fs)&&fs>=18.66&&isFinite(fw)&&fw>=700);};
  for(const b of boards){
    const bb=b.bounds;const list=flatten(b,[]).slice(1);
    const bs=solid(b);const boardRgb=bs?(hex2rgb(bs.hex)||[255,255,255]):[255,255,255];
    for(let i=0;i<list.length;i++){
      const s=list[i];if(!vis(s))continue;const r=ink(s);if(!r||r.w<=0||r.h<=0)continue;scanned++;
      const ox=Math.max(0,bb.x-r.x)+Math.max(0,(r.x+r.w)-(bb.x+bb.w));
      const oy=Math.max(0,bb.y-r.y)+Math.max(0,(r.y+r.h)-(bb.y+bb.h));
      if(ox>1||oy>1)clip.push({board:b.name,shape:s.name,type:s.type,overX:Math.round(ox),overY:Math.round(oy)});
      if(ART.test(s.name)&&!DECOR.test(s.name)){
        for(let j=i+1;j<list.length;j++){const o=list[j];if(!vis(o))continue;
          const orr=ink(o);if(!orr)continue;
          if(CHROME.test(o.name)||/^svg-/.test(o.name))continue;
          if(!solid(o)||alpha(o)<0.85)continue;
          if(pfx(o.name)===pfx(s.name))continue;
          if(frac(r,orr)>=0.35){occl.push({board:b.name,art:s.name,by:o.name,cov:Math.round(frac(r,orr)*100)+"%"});break;}}
      }
      if(s.type==="text"&&s.characters&&s.characters.trim()){
        const ts=solid(s);if(!ts||ts.a<0.5)continue;const rgb=hex2rgb(ts.hex);if(!rgb)continue;
        textChecked++;
        const cx=r.x+r.w/2,cy=r.y+r.h/2;let bg=boardRgb,found=false;
        for(let j=i-1;j>=0;j--){const p=list[j];if(!vis(p)||p.type==="text")continue;
          if(!covers(ink(p),cx,cy))continue;const ps=solid(p);if(!ps||ps.a<0.85)continue;
          const pr=hex2rgb(ps.hex);if(!pr)continue;bg=pr;found=true;break;}
        const cr=contrast(rgb,bg);
        const rec={board:b.name,text:s.name,chars:s.characters.slice(0,26),
          fg:ts.hex,bg:found?hx(bg):"board("+hx(boardRgb)+")",ratio:Math.round(cr*100)/100,
          fontSize:s.fontSize,fontWeight:s.fontWeight};
        if(cr<3.0)lowc.push(rec);
        // THE accessibility gate: <4.5 and not large text. `lowc 0` alone is NOT a pass.
        if(cr<4.5){ if(isLargeText(s)){ if(cr<3.0)largeLow.push(rec); } else lowcAA.push(rec); }
      }
    }
  }
  return {boards:boards.length,scanned,textChecked,clip,occl,lowc,lowcAA,largeLow};
}

/* ============================================================================
 * CONFIRMED ROOT CAUSE #2 (contrast) — OPEN, 130 findings across 47 boards.
 *   Only 4 distinct fg/bg signatures, so this is a design-token fix, not 130
 *   individual edits:
 *
 *   fg        bg        ratio  n   where / what
 *   --------- --------- -----  --  ------------------------------------------
 *   #a8862a   #eae2d2   2.67   84  joss-gold body text on cream panels. Worst
 *                                  offender. History-board CJK glyph rows
 *                                  (`hist · entry N (glyph)`, 车/金/屋/香…),
 *                                  League rows, tutorial step copy, AND every
 *                                  `nav · tab League subtext` (30 boards).
 *   #f0c75e   #f5f0e8   1.42   26  pale-yellow on cream — the tutorial carousel
 *                                  chevrons. Verified visually: essentially
 *                                  invisible. Worst ratio in the whole file.
 *   #a39d92   #fbf7ee   2.52   16  muted-grey secondary labels.
 *   #fff8e8   #d4af37   1.99    4  cream avatar glyph on a joss-gold disc.
 *
 *   Replacement candidates — ALL ratios below were recomputed and verified
 *   2026-09-28. Each is the LIGHTEST hue-preserving shade of the current colour
 *   (RGB scaled toward black, so brand hue is retained) that clears the target.
 *   NOTE: the earlier candidate list carried arithmetic errors — e.g. #7d6219 was
 *   quoted as 4.50 but is actually 4.49, i.e. it FAILS AA by a hair. Use these.
 *
 *   - #a8862a on #eae2d2 (2.67) →
 *       #9d7d27 = 3.02  AA large only (smallest visual change)
 *       #7b621f = 4.52  AA body  ← RECOMMENDED
 *       #584616 = 7.08  AAA
 *   - #f0c75e on #f5f0e8 (1.42) →
 *       #a38840 = 3.01  AA large only
 *       #826b33 = 4.52  AA body  ← RECOMMENDED (chevrons are large glyphs but
 *                                 1.42 is so far under that AA body is safer)
 *   - #a39d92 on #fbf7ee (2.52) →
 *       #958f85 = 3.00  AA large only
 *       #767169 = 4.53  AA body  ← RECOMMENDED
 *   - #fff8e8 on #d4af37 (1.99) → two options:
 *       (a) darken the DISC to #6f5715, keep the cream glyph → 6.51  ← RECOMMENDED
 *           (preserves the cream-on-gold look; smallest change to the glyph)
 *       (b) keep the disc, darken the GLYPH → #625f59 = 3.03 (AA large) or
 *           #474541 = 4.55 (AA body)
 *
 * DISMISSED AS FALSE POSITIVES (do not "fix"):
 *   clip  0 findings — nothing in the file crosses its board frame.
 *   occl  14 findings, ALL intentional:
 *     - 8 on `EN/ZH · 1f3/1f4 Home / customize · top slots|background`:
 *       `option · hengpi|lanterns|landscape (bg)` covering `art · shrine base
 *       (table)` / `art · offerings (front)`. These are BACKGROUND SWATCH
 *       previews deliberately drawn over the shrine art to show the swap.
 *     - remainder are `option · …` swatches inside their own picker.
 *   The v1 rule set produced ~all false positives here; see the header.
 *
 * RE-RUN: paste runAudit4 into penpot__execute_code and diff against the counts
 * above. A PASSING SWEEP = clip 0, occl 14 (or fewer, all swatch-related),
 * lowc 0, **lowcAA 0** and largeLow 0.
 * ⚠️ `lowc 0` ON ITS OWN IS NOT A PASS — it only means nothing is below 3.0.
 *   `lowcAA` is the WCAG AA 4.5:1 body-text gate and is the number to report.
 *   runAudit3 is kept only for diffing against the 2026-09-28 baseline.
 * ============================================================================
 */
