# 🎮 04 - AR App Patterns & Inspiration

> **Status**: ✅ Decided — the *non-AR AR* MVP call is recorded in **[[ADRs/ADR-003-non-ar-ar-mvp-ar-framework|ADR-003]]** (SCRUM-8, 2026-10-02) · PoC plan = **[[17-ar-fire-spike-plan|doc 17]]** | **Started**: 2026-09-23
> **Purpose**: Collect design patterns from successful apps we can respectfully adapt.

---

## 🎯 Apps We're Learning From

| App | What We Take | What We Avoid |
|-----|--------------|---------------|
| **Pokémon GO** | AR throw mechanic, fixed-position targets, catch feedback tiers | Grind-heavy loops, FOMO pressure |
| **Duolingo** | League leaderboard (similar-skill grouping), streaks, friendly reminders | Guilt-tripping notifications, aggressive monetization |
| **Ingress** | Location-based value, faction play | Complex lore barriers |

---

## 🥎 Pokémon GO - The Catch Mechanic (Our AR Burn Reference)

### How It Works
1. AR camera shows the real world
2. Creature appears in front of the player (fixed relative to phone, not locked to world)
3. Player **swipes up** to throw a Poké Ball
4. Throw is judged: **Nice / Great / Excellent** based on accuracy & technique
5. Capture animation plays, success/fail feedback

### How We Adapt It
| Pokémon GO | Joss Paper AR |
|------------|---------------|
| Wild Pokémon appears | AR fire appears (fixed screen position) |
| Poké Ball at bottom of screen | Cartoonized offering at bottom of screen |
| Swipe up to throw + spin for curveball | Swipe up to throw (maybe gentle aim gesture) |
| Nice / Great / Excellent | Sincere / Devout / Gracious (respectful tiers) |
| XP + candy rewards | Tribute Points + value multiplier |
| Failed catch - Pokémon flees | Missed throw - offering returns (never "destroyed", that'd be disrespectful!) |

### 🎨 Key Technical Pattern
Pokémon GO uses **AR+ (ARKit/ARCore)** for full 3D AR, but also has **non-AR AR mode** (fixed position, camera background) - much more reliable and battery-friendly. 

💡 **Recommendation**: Start with the *non-AR AR* mode (camera background + fixed overlay) like Pokémon GO's default catch mode. Add true AR later. This drastically simplifies MVP!

---

## 🦉 Duolingo - Leaderboard & Streak Patterns

### League Leaderboard System
- Groups of **~30 users** at similar activity levels
- Weekly reset → promotion/relegation
- **Key insight**: Users compete with *similar-skill* peers, not global leaderboard (which demotivates)
- Top 3 get promoted → status + gems reward

### Our Adaptation: "Tribute League"
- Group users by **similar total tribute points** (not skill - there's no "skill", just devotion)
- Weekly leagues: e.g. *Candle League → Incense League → Lantern League → Golden Ingot League*
- Privacy: competitor identities anonymised (respect cultural modesty)
- Nearby-value weighting: users in same region see each other (4-block radius privacy rule)

### Streak System
- Daily streak with **freeze** mechanic (don't punish holidays/festivals!)
- **Important cultural note**: The "Hungry Ghost Festival" and Qingming are *peak* engagement moments - design special events around them, not around fake holidays!

---

## 📐 AR UI/UX Best Practices (Collected)

### Fixed-Position AR (our MVP approach)
- ✅ Works on all phones (no ARKit/ARCore needed)
- ✅ Low battery drain
- ✅ Reliable - no tracking loss
- ✅ Faster to build
- ❌ Less "wow" than full 3D AR

### Full AR Mode (later)
- Use ARCore/ARKit for world-locked fire
- Requires good lighting, textured surfaces
- High battery usage
- Better as "photo mode" for sharing

### Overlay Readability
- AR UI elements need **dark scrim/shadow** behind text (sunlight = washed out screens)
- Big, bold, high-contrast buttons
- Keep the centre clear for aiming
- Haptics > sound in public spaces (temple, quiet streets!)

---

## 🧭 Design Inspiration To Explore

- [ ] Temple aesthetics: incense smoke, lantern light, warm amber glow
- [ ] Chinese festival colour schemes (CNY red/gold, lantern festivals)
- [ ] Modern Chinese apps (WeChat minigames, Alipay's festive UIs) for familiar patterns
- [ ] Calm/gratitude apps (Headspace, Calm) for the meditative ritual feel
- [ ] Collection screens (Pokédex-style but for offerings - "Book of Tributes")

---

## 🔍 Tasks (Future Sessions)

- [ ] Deep-dive Pokémon GO catch math (throw curves, timing windows)
- [ ] Study Duolingo league algorithm & notification cadence
- [ ] Research Chinese festival calendar for event planning
- [ ] Collect visual references for temple/festival aesthetics
- [ ] Explore AR ritual apps in Japan/Korea/Taiwan (cultural peers)

---

*Last updated: 2026-09-23*
