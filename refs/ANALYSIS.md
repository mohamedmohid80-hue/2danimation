# Reference Shorts: frame-by-frame breakdown

The three reference videos are all 720×1280, 30 fps, H.264, with AAC audio:

| # | Title | Channel | Length | Views |
|---|---|---|---|---|
| A | How Does a Penguin Egg Survive -40° | Jufox 3D | 51.7 s | 6.9 M |
| B | How a Hole in Your Yard Becomes a Lazy River | hole story 3d | 66.6 s | 3.7 M |
| C | How to Rebuild the Monkey King's Legendary Staff | AlexDiary | 63.4 s | 8.4 M |

How this was measured:
- Every frame of the first 3 s was inspected, at 10 fps contact sheets plus 30 fps strips.
- The whole of each video was inspected at 2 fps.
- Word-level timestamps come from faster-whisper (`analysis/*_words.json`).
- Colour and brightness come from FFmpeg `signalstats`, and loudness from `ebur128`.
- Contact sheets are in `analysis/` (`*_first3s.png`, `*_sheet_NN.png`, `cap_anim_*.png`).

---

## 0. The shared formula

All three videos are built on the same template:

1. **There is no intro.** The voice-over starts on frame 0 with the word **"If…"**. There is no logo, title card or silence. The subject is already moving on frame 0:
   - A: the camera is already pushing in.
   - B: dirt is already flying out of the hole.
   - C: the staff is already spinning in mid-air.
2. **The hook is a second-person hypothetical with a built-in disaster:**
   - "If you lay your egg on the ice at -40°, it freezes solid in minutes."
   - "If you dig a hole in a ring around your yard and fill it with water, you have a lazy river."
   - "If you accidentally crack the Monkey King's staff in half…"
3. **The hook pays off visually within 3 s:**
   - A: the thermometer and the "-40°" label appear at 1.6–2.3 s.
   - B: the water floods in at 2.3 s.
   - C: the staff cracks with sparks at 1.0 s.
4. **The body is a "But… / So you…" ladder.** Each rung is one problem followed by one fix, about 4–6 s per rung, with 6–9 rungs per video. Every fix creates the next problem. It's the "you're the engineer" game format.
5. **There is one twist or joke beat about two-thirds of the way in:**
   - A: "like a chicken… like a penguin"
   - B: "here is what nobody tells you… every person is a brake"
   - C: running sarcasm ("absolute genius", "huge brain", "giant brain")
6. **The closing line is a fixed catchphrase:**
   - A and B: "Congratulations, you built a ___."
   - C: "The Monkey King may spare you after all."
7. **The final shot is a playful payoff that loops cleanly:**
   - A: the chick winks at the camera.
   - B: a man cannonballs off the bridge.
   - C: the staff spins and lands standing upright, mirroring the opening spin.
8. **The visuals change on almost every clause.** A new object, animation or camera move lands every 0.5–1.5 s, and it is timed to the exact word that names it.
9. **Each video stays in one environment.** The camera roams around a single 3D set (snowfield, backyard, waterfall courtyard) and never moves to a new location.
10. **The voice is fast:** 212 wpm (A), 241 wpm (B) and 229 wpm (C), against a normal pace of about 150 wpm. A music bed runs continuously underneath, and nothing is ever silent for more than 0.25 s.

### Script beat maps (word timestamps)

**A, Penguin:**

| Time | Beat |
|---|---|
| 0.00 | Hook: "If you lay your egg on the ice at -40°…" |
| 3.22 | Stakes: "it freezes solid in minutes" |
| 5.46 | So: sit on it ("like a chicken… like a penguin", joke) |
| 8.56 | But: the ice freezes it from below |
| 12.56 | So: lift it onto your feet, belly flap like a sleeping bag |
| 17.72 | But: mom starved and must go back to the sea |
| 22.22 | So: roll the egg to dad, feet to feet |
| 26.64 | But: dad stands in a storm for two months without eating |
| 33.14 | So: thousands of dads huddle and take turns on the edge |
| 39.90 | But: the chick hatches and there's no food |
| 43.86 | So: make milk in your throat and burp it up |
| 48.26 | "Congratulations! You built a healthy penguin." |

**B, Lazy river:**

| Time | Beat |
|---|---|
| 0.00 | Hook: dig a ring and fill it, you have a lazy river |
| 4.20 | But: by morning half is gone and the banks slump |
| 8.84 | So: steel cage plus sprayed-concrete shell |
| 14.44 | But: it just sits there ("a very long puddle") |
| 19.70 | So: pump, drain and jets |
| 27.26 | Explainer: "This is a propulsion jet" |
| 29.22 | But: water piles up on the bends and spills |
| 35.82 | So: build the outside of each curve taller, like a racetrack |
| 39.06 | But: green water and the neighbour's leaves |
| 42.54 | So: sand filter plus skimmer |
| 49.54 | Twist: "here is what nobody tells you… you are slowing it down" |
| 59.16 | Dressing: bridge, palm trees, inner tubes |
| 62.76 | "Congratulations, you have built a lazy river." |

**C, Monkey King staff:**

| Time | Beat |
|---|---|
| 0.00 | Hook: accidentally crack the staff; fixing it without modern help |
| 5.44 | But (sarcasm): "absolute genius", overlap and tie |
| 10.48 | "Problem solved. Except…" it looks bad and breaks at a tug |
| 14.14 | Stakes: "the Monkey King will have your head" |
| 16.76 | So: glue plus a metal plate |
| 24.32 | But: the fix is obvious |
| 26.68 | Plan: flatten the ends, half-lap tongue and matching hole |
| 38.96 | "almost invisible… Unfortunately one good tug…" |
| 43.44 | Again: carve a hole and smash in a wooden wedge |
| 50.22 | Payoff: self-locking joint, then explains each locked axis |
| 61.42 | "The Monkey King may spare you after all." |

---

## 1. Video A: Penguin egg (Jufox 3D)

### 1.1 The first 3 seconds, frame by frame

| Time | Word on screen | What happens |
|---|---|---|
| 0.00 | `if` | **Opening frame:** a medium-wide shot of an emperor penguin, full body, camera slightly low. The egg is already between its feet. Blue sky fills the top 40% of the frame and snow the rest. |
| 0.00–0.50 | `if` `you` `lay` | **Fast push-in plus crane down.** The camera dollies toward the feet and drops, so the head leaves the top of frame by about 0.5 s. The move is smooth with an ease-out, and there's no shake. |
| 0.60–0.90 | `your` `egg` `on` | The push ends in a **low macro of the feet and the egg**. The egg sits at the lower-centre third of the frame, and the belly fills the top-left as a soft wall of white feathers. |
| 1.00–1.50 | `the` `ice` `at` | The camera holds and drifts very slowly. There's a shallow depth of field: the horizon ice shelves are blurred and the camera-facing snow is sharp. |
| 1.60 | `at` | **A thermometer pops in** to the right of the egg. It's a small 3D glossy tube, filled red. |
| 1.70–2.00 | `minus` | The red column **drains down, shifting red → pink → magenta**. |
| 2.10–2.40 | `40` | The column turns **blue** and keeps draining. |
| 2.30 | `40` | **The "-40°" title pops in**, fading in from 0 opacity over about 2 frames. It's heavy rounded white text with a thick navy outline and a slight 3D bevel, upper right at about 37% of frame height. |
| 2.50–2.90 | `degrees` | The "-40°" text **drifts up-right and scales up** slowly while the column sits empty. It drifts off the right edge by 3.0 s. |

**What the opening does:**
- It answers "who, what and how bad" in under 2.5 s, using a single continuous camera move.
- The scale shift from full body to macro egg is the hook motion.
- The only on-screen data, -40°, gets its own graphic, sitting above the caption layer.

### 1.2 Camera language

Most of the cuts are soft. The colour palette barely changes between shots, so FFmpeg scene scores never pass 0.15, and the cuts feel almost invisible.

| Time | Shot | Movement |
|---|---|---|
| 0–3.0 | Medium-wide to macro on the egg | Push-in plus crane down |
| 3.0–5.4 | Extreme macro of the egg | Slow push. Frost visibly crawls up the shell, blue crystalline ice from the bottom up, timed to "freezes solid". |
| 5.5–6.0 | Wide low-angle, legs plus a white snowball egg | Static |
| 6.0–8.0 | Full-body side profile | Slow pull-out. A **cartoon chicken pops in** on "chicken" (6.6). The penguin **turns to face the camera** on "like a…" (7.0), deadpan joke beat. The chicken stays until "penguin" (8.0). |
| 8.5–12.0 | Macro under the belly | **Navy and white curly arrows** rise from the ice (cold creeping up), and frost re-grows on the underside of the egg. |
| 12.5–14.0 | Low macro, egg rolling onto the feet | Tracking |
| 14.5–15.5 | Belly flap closes over the egg | The **frost melts** and the egg turns clean cream, a colour cue for "warm". |
| 16.0–16.5 | Close pan across the belly skin | Lateral truck |
| 17.0–17.5 | Wide, slightly high angle, penguin looking down ("sad") | Static |
| 18.0–19.8 | Medium on the belly | An **X-ray inset**: a circular cutaway with a red rim shows a pink stomach **shrinking**. It scales in from the centre. |
| 20.0–21.7 | Mom walks out of frame, then wide toward the sea | A 2D-style **orange fish icon plus a white down-arrow** above the water ("go back to the sea to eat"). |
| 22.0 | **Whip-pan / motion-blur transition** | The fastest move in the video |
| 22.5–24.7 | Macro low, egg rolled feet to feet | Tracking with the egg |
| 25.0–29.5 | Dad, medium side profile | Slow push. Warm sun haze in the sky. |
| 29.5–32.5 | Same shot | An **alarm-clock icon** fades in and its hands spin (time-lapse). The **grade flickers cold blue-violet and back**, like storm days passing. |
| 33.0 | Cut to a high top-down | A lone penguin |
| 33.5–36.0 | **Crane up to bird's-eye** | Hundreds of penguins converge into a hexagonal huddle |
| 36.0–39.3 | Top-down, slowly rotating | **White circular arrows** orbit the huddle. A **heat-map overlay** appears: orange-red core, blue rim ("hot tub in the middle"). One penguin is outlined in white and travels around the rim ("take turns"). |
| 39.5 | **Push-through transition** into the crowd | Motion blur through the bodies |
| 40.0–43.0 | Macro egg under dad, **warm cream grade** | A crack zig-zag draws across the shell, then the chick pops out |
| 43.5–44.0 | Wide front, full body, chick at the feet | Static |
| 44.5–46.0 | Medium front | **X-ray throat overlay**: an oesophagus and stomach cutaway, with white "milk" rising |
| 46.5–47.5 | Low angle, burp | A dotted white stream drops into the chick's beak |
| 48.0–50.5 | Chick centred, walks in | On "penguin" (50.0) it **winks at the camera** |
| 51.0–51.7 | **Brand sting** | The orange Jufox fox mascot dashes across the frame |

### 1.3 Colour, light and contrast
- **The palette is mostly white and cold:**
  - Average luma is 156/255, the brightest of the three.
  - Average saturation is 9, which is very low.
  - Hue sits around 230°, which is blue.
- **The accent colours are reserved for meaning:**
  - Thermometer: red → blue.
  - Penguin neck: orange-yellow.
  - Fish: orange.
  - X-ray insets: red.
  - Heat map: orange core, blue rim.
  - Mascot: orange.
- **The grade tells the story:**
  - Neutral daylight for the setup.
  - Warm sun haze at 25–29 s.
  - A cold violet storm flicker at 30–32 s.
  - Then a **warm cream/yellow grade** from 40 s for the hatch and feeding act, which is the emotional turn.
- **The lighting:** soft single-sun, long soft shadows, gentle bloom on the snow. Contrast is low, highlights are close to clipping, and the shadows are pale blue, never black.
- **The rendering:** a stylised 3D look with subsurface-ish feather fur. Ice shelves are low-poly faceted blue shapes in the background.

### 1.4 Captions
- **Font:** lowercase, bold geometric rounded sans (single-storey "a"; Poppins/Quicksand-style).
- **Fill and outline:** white fill with a thin black outline of about 2 px. There's no shadow and no box.
- **Size:** small, with an x-height of about 3% of frame height.
- **Position:** horizontally centred at about **72% of frame height**, so it sits under the subject in the lower third.
- **Timing:** **one word at a time**, swapped on a **hard cut** with no pop, scale or fade. Each swap lands within a frame of the word's spoken onset (30 fps strip, `cap_anim_penguin.png`). Short words like "the" and "a" get their own screen too.
- **Other text:** the only non-caption text is the "-40°" graphic.

---

## 2. Video B: Lazy river (hole story 3d)

### 2.1 The first 3 seconds, frame by frame

| Time | Word on screen | What happens |
|---|---|---|
| 0.00 | `If` | **Locked-off high three-quarter "diorama cutaway" camera.** A two-storey white colonial house with blue shutters fills the top 30% of the frame. A rectangular grass island sits in the middle, ringed by a freshly dug trench. The bottom 15% is a **cut-away cross-section of soil** (orange-brown with rocky texture), so the scene reads as a slice of earth. **Dirt clods are already mid-air**, flying out of the trench to the top right. |
| 0.10–0.90 | `You` `Dig` `A` `Hole` `In` `A` | The clods **arc out and pile up** into a growing mound beside the house, a physics-like simulation with a bounce. The trench visibly deepens. |
| 1.00–1.90 | `Ring` `Around` `Your` `Yard` `And` | The mound settles. The camera is fully static, with no movement for 3 s. |
| 2.00 | `And` | **A pool ladder pops in** on the right edge of the trench. |
| 2.30 | `With` | **Water starts filling** from the bottom of the trench, a translucent aqua plane. |
| 2.40–2.90 | `Water` | The water **rises over about 1.2 s**, timed exactly to the word "water". It reaches the brim at about 3.5 s ("river"). |
| 3.0–4.0 | `A` `Lazy` `River` | A **slow push-in starts** toward the island, the first camera move. |

**What the opening does:**
- The camera stays locked so the eye tracks the action: digging, then the ladder, then the water.
- The cutaway soil band at the bottom establishes "we will see underground" from frame 0.

### 2.2 Camera language
This is effectively **one continuous set**, with no scene-score spike above 0.23. Camera states (cut or move):

| Time | View | Notes |
|---|---|---|
| 0–4.2 | Diorama cutaway, high three-quarter | Static, then push-in |
| 4.5–6.6 | Same view, **night/dawn grade** ("by morning") | Water level drops. The cross-section shows **white 3D down-arrows** pushing into the soil (seepage), and the soil darkens wet. |
| 7.0–8.5 | Same view | **Banks slump**: clods tumble into the water |
| 9.0–9.5 | Same view, water drains away | A visual reset |
| 10.0–11.5 | Same view | A **rebar cage draws in**: wireframe steel grid lines build along the walls |
| 12.0–13.0 | Same view | **Sprayed concrete**: gray particle spray coats the cage, then becomes a smooth shell |
| 13.5–14.0 | Same view | It refills with water |
| 14.5–19.5 | **Cut to a 90° top-down** | The ring of water around the island with an inner tube. **Completely still for 5 s**, the stillness *is* the joke ("it just sits there… a very long puddle"). |
| 20.0–20.5 | Low angle over the lawn | The **pump drops into place** on a concrete pad |
| 21.0–22.5 | **Side cross-section** (half above ground, half soil) | A white PVC **pipe draws itself** underground, drain to pump to wall |
| 23.0–24.5 | Underwater close on the pool wall | The **jet fires**: white bubble streams |
| 25.0–27.0 | Top-down | **White chevron arrows animate around the ring**, showing flow. The tube now drifts. |
| 27.5–29.0 | Side underwater on the jet | "propulsion jet" |
| 29.5–35.5 | Low close at the bend | Water **piles up and sloshes over the wall** with droplet particles. A **dark wet stain spreads** on the lawn. |
| 36.0–38.5 | Eye level, low over the water toward the fence | The **outer wall extrudes taller** ("like a racetrack") |
| 39.0–39.5 | Pull-back over the bend, then the diorama wide | Transition back |
| 40.0–42.5 | Diorama wide | The water **tints murky green**, and leaves fall in |
| 43.0–44.5 | Close on the **sand filter, a half-section cutaway** (blue tank, sand layer) | White arrows flow down through the sand |
| 45.0–47.5 | Close on the skimmer mouth at the waterline | Leaves get sucked in. The water **shifts from green back to blue** on "current does the cleaning". |
| 48.0–49.0 | Top-down with chevrons | Clean |
| 49.5–54.0 | Track along the river, then low medium on **people on tubes** (realistic 3D humans) | The chevrons slow and point against the people ("you are slowing it down") |
| 54.5–58.5 | Wide three-quarter with the pump half-section cutaway in the foreground | "pump has to push even harder" |
| 59.0–62.5 | Wide | The **bridge drops in**, then **palm trees pop up**, then the tube stack, then sun loungers and a beach ball |
| 63.0–65.5 | Medium on the bridge | A man **cannonballs off the bridge**: white particle splash |
| 66.0 | **Cut to black** | Ends |

### 2.3 Colour, light and contrast
- **The palette is the most saturated of the three:**
  - Average saturation is 22.
  - Average luma is 117.
  - The colours are realistic and earthy: lawn green with mowing stripes, terracotta soil, aqua water, white house, blue shutters, orange roof.
- **Story is told by colour state changes:**
  - Night/blue darkening for "by morning", where the darkest frame has a luma of 25.
  - Green algae water at 40–45 s, back to aqua after the filter.
  - A dark wet patch on the lawn.
- **The lighting:** a sunny afternoon key from the top left with crisp but soft shadows. Higher contrast than A, with real dark shadows under the lips of the walls.
- **The rendering:** a semi-realistic game-engine look (Unreal/Blender Eevee feel), stylised grass and realistic humans.

### 2.4 Captions
- **Font:** **Title Case**, one word per screen, in a heavy rounded font (Fredoka One/Baloo-style).
- **Fill and shadow:** white fill with a **soft dark drop shadow**, offset down-right and blurred, and no outline. Medium size, larger than A's.
- **Position:** centred at about **52% of frame height**, dead centre. It usually sits on the grass island, which acts as a clean green backdrop.
- **Timing:** hard-cut swaps exactly on word onset, with no animation (`cap_anim_lazyriver.png`).

---

## 3. Video C: Monkey King staff (AlexDiary)

### 3.1 The first 3 seconds, frame by frame

| Time | Caption | What happens |
|---|---|---|
| 0.00 | `IF YOU` (YOU in green) | **Low camera near the ground**, looking slightly up. Background: a cliff with a waterfall in the centre, a cherry-blossom tree on top (pink particles), blue sky with soft clouds. The foreground is a pale cracked stone courtyard with grass tufts and pebbles. The **staff is already spinning end over end** in mid-air with heavy motion blur, and its shadow races across the stone. |
| 0.10–0.30 | `IF YOU` | Spinning. The staff's golden end caps flash. |
| 0.40–0.90 | `ACCIDENTALLY` (all red) | The spin gets faster and closer to the camera. The shadow sweeps the floor. |
| 0.93 | `ACCIDENTALLY` | The staff **snaps horizontal** across the full frame width at eye level |
| 1.00 | `CRACK THE` (THE in pink) | **Impact.** A bright orange-white **flash/bloom** at the midpoint, then **spark particles** spray up and fall, all timed to "crack". |
| 1.10–1.40 | `CRACK THE` | Sparks fall, and the staff **separates into two halves** with a gap |
| 1.50–1.90 | `MONKEY KINGS` (KINGS in yellow) | The two halves hover. The camera **slowly pushes in and lowers**. |
| 2.00 | `STAFF` (red) | Same shot |
| 2.40–2.90 | `IN HALF` (HALF in pink) | Same shot. The halves sit low in frame, waterfall behind. |

**What the opening does:**
- A violent action happens on frame 0.
- The disaster (the crack) lands at 1.0 s, earlier than in the other two.
- There's a big flash: the brightest moment of the video.

### 3.2 Camera language
This is a single "stage": the courtyard and waterfall. The staff is the only actor and floats at about eye level. The camera:
- **Orbits, cranes and tilts continuously.** There are no hard location cuts, only angle changes, often through fast tilts.
- **Drops to the floor** for falls (4.5–5.5: the halves tumble and the camera tilts down to the stone).
- **Returns to the "hero frontal"** (staff centred in front of the waterfall) for every *test* moment. The staff **spins upright** as a test at 10.5–14, 22.5–25 and 61.5–63.
- **Goes to extreme macro** for craft steps:
  - Glue bottle: 18–19.5
  - Metal plate plus hammer and sparks: 20.5–21.5
  - Tongue cut: 32–36
  - Hole and wedge: 44–49
- **Uses an exploded view** at 52.5–55.5: the joint pieces are pulled apart, with the tongue and slot highlighted in yellow and the wedge floating.
- **Ends with a diagonal over-the-shaft macro** (56–61) with **white 3D arrows** showing forward/backward, then cuts back wide for the final spin. The staff **lands standing upright**, centred, as a hero end pose.

**Motion style:**
- Objects fly in (glue, hammer, wedge, metal sleeve) and do the action, then fly out.
- The rope wraps around in an animated coil (8.5–10).
- The breaks snap apart, with red 2D-ish arrows pulling outward (41.5–43).
- **Removed or new material is colour-coded:** cut-away wood turns **orange/red**, and the raised tongue and wedge are **yellow**. This makes the woodworking readable at phone size.

### 3.3 Colour, light and contrast
- **The palette is low-saturation and neutral:**
  - Average saturation is 6, the lowest.
  - Average luma is 132, with tight contrast (luma range 62–173, flat).
  - Pale grey stone dominates. The staff is copper-brown with gold caps, and the waterfall is white-blue.
- **Colour pops come from three places only:**
  - The captions.
  - The orange/yellow highlight colour-coding.
  - The pink blossoms and blue sky in wide shots.
- **The lighting:** flat overcast-like daylight with soft shadows. Strong depth-of-field blur on the background in macros.

### 3.4 Captions (the most designed)
- **Font:** **ALL CAPS**, a bold geometric sans (Montserrat ExtraBold-style) with slight letter-spacing.
- **Chunking:** 2-word chunks. **Word 1 is white and word 2 is coloured**, cycling through **green → red → pink → yellow → cyan**. Single emphasis words are fully coloured, for example `ACCIDENTALLY` and `STAFF` in red, `GENIUS` in red, `INVISIBLE` in pink.
- **Shadow:** a dark soft drop shadow with no outline.
- **Size:** small, with a cap height of about 2.5% of frame height.
- **Position:** centred at about **50% of frame height**, overlapping the staff line on purpose.
- **Timing:** hard-cut swaps, with no animation (`cap_anim_staff.png`).

---

## 4. Audio
| | A Penguin | B Lazy river | C Staff |
|---|---|---|---|
| Integrated loudness | -14.0 LUFS | -13.8 LUFS | **-7.7 LUFS** (very loud) |
| Loudness range | 1.3 LU | 1.5 LU | 1.4 LU (heavily compressed) |
| Level in the gaps between sentences | ≈ -25 dB | ≈ -19 to -22 dB | ≈ **-11 dB** |
| Speech rate | 212 wpm | 241 wpm | 229 wpm |

- **Music bed:** all three have one. It's quiet in A, moderate in B with SFX on the actions (dirt, splash, water), and loud in C, almost level with the voice.
- **The voice-over:** an AI-style narrator, energetic and conversational, delivered with almost no pauses. Gaps between sentences are 0.3–0.9 s.
- **Sound effects** sit on the visual hits: the crack, the hammer, the splash.

---

## 5. Recreation checklist for our own videos

- **Format:** 1080×1920 (the sources are 720×1280), 30 fps, 50–65 s.
- **The first frame:**
  - The subject is already in motion.
  - The voice-over says "If you…" on frame 0.
  - The disaster or premise is visualised by 1–2.5 s, using an overlay or data graphic if needed (thermometer, "-40°").
- **The script:**
  - "If you X, then Y (disaster)."
  - Then 6–9 rungs of "But [problem]. So you [fix]."
  - One twist or joke at about 65–75%.
  - Close with "Congratulations, you built a ___."
  - Final visual gag, then a hard end.
- **Visual cadence:** a new visual event every 0.5–1.5 s, landing on the noun that names it. Use the faster-whisper word timestamps as the cue sheet.
- **The camera:**
  - One environment.
  - Smooth eased push-ins, crane-ups to top-down for "system" explanations, macros for mechanisms.
  - A whip-pan or push-through only for big time jumps.
  - Return to a "hero" frame for test or payoff beats.
- **Explainer overlays:**
  - Cross-section cutaways (soil, X-ray belly, filter tank).
  - Arrows: curly heat arrows, flow chevrons, push/pull arrows.
  - Heat maps, clock icons for time-lapse.
  - Colour-coding: orange = removed or cut, yellow = new or important, blue = cold, green = dirty.
- **Story through colour state:** frost and ice crawl, a night grade, water turning green and back, a warm grade for the emotional turn.
- **Captions:**
  - Centred at 50–72% of frame height.
  - One word (or two words with colour emphasis).
  - Hard-cut on word onset, without bounce animation.
  - Bold rounded or geometric sans, white with an outline or shadow.
  - Implement as ASS subtitles (FFmpeg + libass) generated from `*_words.json`, or as a Remotion component.
- **Audio:**
  - Fast voice-over at about 220 wpm.
  - A continuous music bed at -20 to -25 dB under the voice.
  - SFX on hits.
  - Master to about -14 LUFS, or louder (-8) for the "C" energy.
