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
