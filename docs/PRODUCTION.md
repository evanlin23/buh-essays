# Production: idea → upload

One episode is one folder in `episodes/`. One command takes it from script to upload kit:

```bash
.venv/bin/python -I whatif/make.py episodes/<slug> all
```

## The loop

| Step | Who | Time | Command / file |
|---|---|---|---|
| 1. Pick a vetted idea | human + agent | 5 min | `research/idea-factcheck.md`: facts sourced, crowding checked |
| 2. Write the narration | writer | 20 min | `episodes/<slug>/narration.txt`: one beat per line, second person, median 5 words a sentence (see `research/whatif-teardown.md`) |
| 3. Fill the spec | writer | 5 min | `episodes/<slug>/episode.json`: title, description, sources, tags, pinned comment |
| 4. Lay out the scene with fake timing | builder | 30–60 min | `make.py <ep> fakevo`, then `make.py <ep> stills 1,8,20`. No voice quota used |
| 5. Narrate | — | 1 min | `make.py <ep> narrate`: one Gemini request per paragraph, cached by text |
| 6. Render, QA, package | machine | about 15 min per Short | `make.py <ep> all` → `renders/<slug>/video.mp4`, `qa.json`, `upload.md`, `cover.png` |
| 7. Watch once with sound, upload | human | 5 min | paste from `upload.md` |

**What actually limits output:**

- **Step 4, for topics that need new sets.** Reused sets are fast.
- **Step 6, render time:** about 0.75 s of wall time per frame on this 4-core machine with 3 workers. A 50 s Short takes about 15 min; a 6-minute episode about 1.8 h.
- **Not the voice.** A Short is one request and about 35 s. The free tier gives 10 requests a day. Pay-as-you-go costs about 10¢ per 6-minute episode and removes the cap.

## The kit (`whatif/lib/kit.js`)

**Format.** `K.init({format: "short" | "long"})` gives 1080×1920 or 1920×1080. Worlds are authored once at 1920×1080, and the camera frames them for either format. A Short sees a 607-unit-wide slice at 1.78×, so pans between subjects come for free.

| Part | What it gives you |
|---|---|
| `K.vo.line(i)`, `K.vo.at(i, word)` | The time a narration line, or a word inside it, is spoken. Key every beat to these |
| `K.keys([[t, {x, y, z}], ...])` | Eased camera moves, with a built-in drift so no frame holds still |
| `K.loc.bedroom(world)` | Night bedroom: window, moon, hanging stars, clock with an `HH:MM` tag, lamp, growing book stack, bed with a sleeping partner, and you |
| `K.banner`, `K.say`, `K.ticket` | Title card on strings with pop-up letters, captions, and the hanging counter ticket (odometer, `K.roll`, `K.rollCues`) |
| `K.turn()` | The page turn from the story world to the riso world |
| `K.riso.page/title/helix/bars/card/grid/bignum/text` | Science pages: two-ink stamped titles, a DNA helix with a callout, bar comparisons, slide-up cards, the life grid, big two-ink numbers |
| `PT.puppet(...)` (stage.js) | Split-pin puppets: shirt colour, hair, glasses, head scale for age, poses |

Sound comes from cues: every component pushes its own (pop, flap, tick, stamp, whoosh, fill, chime). `whatif/lib/audio.py` turns them into paper foley, puts a two-world music bed under the dry narration, and masters to −14 LUFS.

## Long-form

A long-form episode is the same folder, with `"format": "long"` in `episode.json`. Example: `episodes/never_sleep_long` ("You Were Born Awake", about 5 min).

**`narration.txt`**
- `## Chapter title` lines aren't spoken. They become YouTube chapters in the description.
- A `{#tag}` at the end of a line names it. The scene uses `K.vo.tag("crossing")` instead of a line number, so you can edit the script without breaking it.
- Blank lines split the script into voice requests. Keep each paragraph under about 180 words (80 s).

**`scene.html`**
- Build each location once as a world: `K.world(K.stage)` plus a set.
- List the shots with `K.director([{t, el, kind, enter}])`. `enter` is `cut`, `fade` or `turn`; `kind` is `story` or `riso`, and picks the music bed.
- Worlds that aren't on screen are switched off, so 15 worlds cost no more per frame than one.
- `K.hud()` holds counters and captions that persist across shots.

**`thumb.html`** renders the 1280×720 thumbnail when you run `package`.

**Cost.** A 5-minute episode is 5 voice requests and about 90 minutes of rendering on this machine.

**Queue.** `whatif/queue.sh [episode…]` narrates anything still on estimated timing, then renders, checks and packages it. Run it after the voice quota resets at midnight Pacific.

## Sets

| Set | File | Use |
|---|---|---|
| Bedroom (night) | `lib/kit.js` `K.loc.bedroom` | Window, moon, clock, lamp, book stack, bed with a configurable sleeper |
| Park (day, dusk, night) | `lib/kit.js` `K.loc.park` | Bench, lamp post, trees, a cast |
| Kitchen | `lib/sets/kitchen.js` | Stove flame and steam, sink window, pendant lamp, table with two seats |
| Classroom | `lib/sets/classroom.js` | Chalkboard written in chalk, three desks with seated children, teacher |
| Street (night) | `lib/sets/street.js` | Windows going dark one by one, a 24 h diner, lamp, bench, taxi |
| Hospital | `lib/sets/hospital.js` | Bed with patient, ECG monitor, IV drip, visitor chair |

**Props:** `K.prop.rocket`, `crib`, `chair`, `notes`. **Riso parts:** `K.riso.page`, `title`, `helix`, `bars`, `lines`, `card`, `grid`, `bignum`, `text`.

**Seated puppets.** A set's seats assume a puppet of scale 1. For scale `s`, put the feet at `seatTop + 64·s`.

## Keeping renders fast

A healthy scene costs about 0.8 s per frame in one browser page. If `stills` feels slow, time a frame before you render:

- **`seek(t)` must be cheap.** A loop that ran to "forever" inside the blink helper once cost 12 s per frame, and no layer change could fix it.
- **Anything that changes per frame lives on its own small layer.** Big paper-textured shapes (skies, walls, hills) go on static layers that Chrome rasterises once. Fade or move them with CSS on the layer, never by editing the SVG inside them.
- **Only write a value when it changes.** Setting an attribute to the same value can still force a repaint.
- **Don't wrap a whole set in one filtered group.** Chrome re-filters a group that spans the set on every frame, even when nothing in it changes. One `card1` group around every window frame on the street cost 0.6 s per frame; one group per building fixed it.

## Shorts safe zone

On a phone, the Shorts interface covers the bottom fifth of the frame (title, channel name) and a strip down the right edge (buttons). Keep captions, counters and questions between y ≈ 250 and 1500, and x < 940.

## Sets each idea needs

| Idea | Reuses | New |
|---|---|---|
| Never sleep | bedroom, riso | none (done) |
| Twin at light speed | riso | launch pad / rocket interior, two-counter crossing graph |
| Born on Mars | riso | Mars habitat dome, Earth arrivals hall |
| Remember everything | bedroom, riso | street / café, memory "filing cabinet" riso |
| No memory each morning | bedroom, riso | diary prop, kitchen |
| Can't feel pain | riso | playground, hospital |
| Stop aging at 25 | riso | park bench through the decades (aging puppets) |
| Feel everyone's pain | riso | crowded street |

Each new set is built once and then reused, so the cost of a set falls with every episode that uses it.

## Channel rules that keep monetisation safe

- One distinct idea and one payoff per video, never the same video retitled. YouTube's "inauthentic content" rule targets templated, mass-produced uploads.
- Every number on screen is computed in the scene from the same constants the narration uses. Every claim in the description has a source.
- Settings: not made for kids; category Education. The altered or synthetic content label is for realistic depictions of real people or events. These are animated, with a synthetic narrator. Re-check YouTube's current guidance if that changes.
