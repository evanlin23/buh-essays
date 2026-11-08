/* Hospital room set for Buh Essays (Paper Theatre). Load after kit.js:  <script src="../lib/sets/hospital.js"></script>
 *
 * const room = K.loc.hospital(w, opts)        w = K.world(parent)
 *   opts.patient  {hair, hairStyle: short|bun|bob|curly|thin, color} the person in the bed: head on the pillow,
 *                 arm on a blanket in their colour. Default an elder: white thin hair, sky blue.
 *   opts.cast     [{x, y = 930, s = 1.3, hs = 1, sit = 0, chair, shirt, pants, hair, hairStyle, glasses}]
 *                 Puppets on the puppet plane. `chair: true` sits that person in the visitor chair.
 * room.update(t, state)
 *   sky      0 day, 0.5 dusk, 1 night: crossfades the city skyline in the window (default 0)
 *   dim      0..1 room darkening for evening and night (default follows sky)
 *   light    0..1 the over-bed light and its warm pool (default 1)
 *   patient  0..1 shows the patient (head, arm, blanket, IV line); 0 leaves a made, empty bed and the monitor on
 *            standby (default 1)
 *   eyes     "open" | "closed" (or 1 | 0) for the patient (default "closed"); open eyes blink
 *   breath   0..1 how much the blanket rises and falls (default 1)
 *   bpm      heart rate on the monitor: a number, or a function of t for a changing rate (default 72). Pass the same
 *            function object every frame: its running integral is tabulated once and reused.
 *   flat     0..1 flattens the trace; above 0.5 the heart-rate readout reads 0 and the alarm light blinks
 *   drip     0..1 drops falling in the IV drip chamber (default 1)
 *   cast     [pose overrides per person]
 * room.beats(t0, t1, bpm)   R-wave times in [t0, t1) for that bpm (number or function), the same grid the trace
 *                           draws: use it for beep cues. With a function, beats follow its integral from t = 0.
 * anchors: bed, patientHead, monitor, chair (where to stand a sitting puppet, seat top at y 866), window: {x, y}
 * Returns {update, anchors, people: [{c, p}], beats}.
 *
 * Planes: sky 0.3, city 0.42, wall with window, headwall, light and whiteboard 0.7, curtain 0.78, monitor 0.8,
 * floor 0.85, IV stand 0.85, bed, patient and bedside table 0.9-0.92, visitor chair 1.0 (behind the puppets),
 * foreground 1.55. The monitor trace is drawn last, over the evening dim, so the screen glows at night.
 */
(function () {
  const { svg, clamp, shade } = PT;

  /* ECG: one beat as piecewise-linear knots (seconds from the R wave, height). */
  const PQRST = [[-0.22, 0], [-0.17, 0.11], [-0.12, 0], [-0.045, 0], [-0.028, -0.13], [0, 1], [0.026, -0.32], [0.05, 0], [0.15, 0], [0.24, 0.27], [0.33, 0]];
  const tpl = (x) => {
    if (x <= PQRST[0][0] || x >= PQRST[PQRST.length - 1][0]) return 0;
    let i = 1;
    while (PQRST[i][0] < x) i++;
    const [a, va] = PQRST[i - 1], [b, vb] = PQRST[i];
    return va + ((vb - va) * (x - a)) / (b - a);
  };
  /* beat phase (in beats since t = 0) for a bpm number or function; the integral is tabulated once per function */
  const phaseOf = (bpm) => {
    if (typeof bpm !== "function") { const b = Math.max(1e-6, +bpm || 0); const f = (t) => (t * b) / 60; f.inv = (n) => (n * 60) / b; return f; }
    if (bpm._phase) return bpm._phase;
    const h = 0.02, tab = [0];
    const f = (t) => {
      if (t <= 0) return (t * bpm(0)) / 60;
      const k = Math.floor(t / h);
      while (tab.length <= k + 1) { const i = tab.length - 1; tab.push(tab[i] + (h * (Math.max(0, bpm(i * h)) + Math.max(0, bpm((i + 1) * h)))) / 120); }
      return tab[k] + (tab[k + 1] - tab[k]) * ((t - k * h) / h);
    };
    f.inv = (n, lo, hi) => { // time in [lo, hi] when the phase reaches n (phase never decreases)
      for (let i = 0; i < 36; i++) { const m = (lo + hi) / 2; f(m) < n ? (lo = m) : (hi = m); }
      return hi;
    };
    bpm._phase = f;
    return f;
  };
  const beats = (t0, t1, bpm = 72) => {
    if (typeof bpm !== "function" && !(+bpm > 0)) return [];
    const f = phaseOf(bpm), out = [];
    const f1 = f(t1);
    for (let n = Math.ceil(f(t0) - 1e-9); n <= f1 && out.length < 5000; n++) { const tb = f.inv(n, t0, t1); if (tb >= t0 && tb < t1) out.push(tb); }
    return out;
  };

  K.loc.hospital = (w, { cast = [], patient = {} } = {}) => {
    const PAT = Object.assign({ hair: "#e9e4da", hairStyle: "thin", color: "#5aa9e6" }, patient);
    const C = {
      wall: "#b8d8ce", wallDk: "#a7cdc2", wallLow: "#9dc4b9", cream: "#f6ecd9", ink: "#1c1f2e", ink2: "#2b2f45", kraft: "#d4a777",
      wood: "#7b4a36", woodDk: "#5e3829", woodLt: "#c99a6a", teal: "#2a9d8f", tomato: "#e4572e", mustard: "#f2b134", mustardDk: "#cf8f2e",
      plum: "#7b4b94", sky: "#5aa9e6", navy: "#3d4f80", frame: "#e3e6df", metal: "#b8c2cb", metalDk: "#8a96a3", sheet: "#f7f5ee",
      panel: "#ece8dc", curtain: "#9a7ab0", curtainDk: "#86679c", floor: "#d3d6c8", seam: "#bcc1b2", screen: "#141a2a", mint: "#9df5c0", leaf: "#5f8f5a",
    };
    const id = K.uid("hos");
    const R = (x, y, wd, ht, a, p) => svg("rect", Object.assign({ x, y, width: wd, height: ht }, a), p);
    const P = (d, a, p) => svg("path", Object.assign({ d }, a), p);
    const G = (a, p) => svg("g", a, p);
    const O = (cx, cy, r, a, p) => svg("circle", Object.assign({ cx, cy, r }, a), p);
    const E = (cx, cy, rx, ry, a, p) => svg("ellipse", Object.assign({ cx, cy, rx, ry }, a), p);
    const T = (x, y, str, a, p) => { const e = svg("text", Object.assign({ x, y }, a), p); e.textContent = str; return e; };
    const op = (el, v) => { const s = String(Math.round(v * 1000) / 1000); if (el.style.opacity !== s) el.style.opacity = s; };
    const pin = (s) => { s.style.willChange = "transform"; return s; };
    const setA = (el, k, v) => { if (el.getAttribute(k) !== v) el.setAttribute(k, v); };

    w.defs.innerHTML += `
      <linearGradient id="${id}day" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2="700"><stop offset="0" stop-color="#5ea8e0"/><stop offset="0.6" stop-color="#b3dbf0"/><stop offset="1" stop-color="#eef0e2"/></linearGradient>
      <linearGradient id="${id}dusk" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2="700"><stop offset="0" stop-color="#6d5a9c"/><stop offset="0.55" stop-color="#e98f7a"/><stop offset="1" stop-color="#ffd59a"/></linearGradient>
      <linearGradient id="${id}night" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2="700"><stop offset="0" stop-color="#0e152d"/><stop offset="1" stop-color="#2b3a66"/></linearGradient>
      <radialGradient id="${id}sun"><stop offset="0" stop-color="#fff3c9" stop-opacity="0.9"/><stop offset="1" stop-color="#ffb46b" stop-opacity="0"/></radialGradient>
      <radialGradient id="${id}moonG"><stop offset="0" stop-color="#e9efff" stop-opacity="0.5"/><stop offset="1" stop-color="#e9efff" stop-opacity="0"/></radialGradient>
      <radialGradient id="${id}lamp"><stop offset="0" stop-color="#ffe2b0" stop-opacity="0.5"/><stop offset="0.45" stop-color="#ffb45e" stop-opacity="0.1"/><stop offset="1" stop-color="#ffb45e" stop-opacity="0"/></radialGradient>
      <linearGradient id="${id}cone" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff0cf" stop-opacity="0.26"/><stop offset="1" stop-color="#ffd59a" stop-opacity="0"/></linearGradient>
      <linearGradient id="${id}beam" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff6dc" stop-opacity="0.16"/><stop offset="1" stop-color="#fff6dc" stop-opacity="0"/></linearGradient>
      <pattern id="${id}cur" width="34" height="34" patternUnits="userSpaceOnUse"><circle cx="8" cy="8" r="3.2" fill="#b79acb"/><circle cx="25" cy="25" r="3.2" fill="#b79acb"/></pattern>
      <pattern id="${id}mesh" width="12" height="12" patternUnits="userSpaceOnUse"><rect width="12" height="12" fill="#f3efe6"/><circle cx="6" cy="6" r="3" fill="#cfc6b8"/></pattern>
      <pattern id="${id}waffle" width="18" height="18" patternUnits="userSpaceOnUse"><path d="M 0 9 H 18 M 9 0 V 18" stroke="#ffffff" stroke-opacity="0.22" stroke-width="3"/></pattern>
      <pattern id="${id}speck" width="60" height="44" patternUnits="userSpaceOnUse"><circle cx="9" cy="7" r="2" fill="#bfc4b5"/><circle cx="38" cy="18" r="1.6" fill="#c6c0ad"/><circle cx="22" cy="34" r="1.8" fill="#bfc4b5"/><circle cx="52" cy="38" r="1.4" fill="#c9cdbf"/></pattern>
      <clipPath id="${id}scr"><rect x="204" y="318" width="132" height="132"/></clipPath>`;

    /* ------------------------------------------------ outside: sky 0.3, clouds 0.33, city 0.42 (sized to what the window can reveal) */
    const WIN = { x0: 1000, x1: 1420, y0: 150, y1: 450, mx: 1210, my: 300, blinds: 206 };
    const skies = ["day", "dusk", "night"].map((k) => {
      const S = w.layer(0.3);
      R(720, 40, 980, 520, { fill: `url(#${id}${k})`, filter: k === "day" ? "url(#card0)" : "none" }, S);
      return S.parentNode;
    });
    const starsL = w.layer(0.3);
    const rr = PT.rng(77);
    for (let i = 0; i < 28; i++) O(740 + rr() * 940, 120 + rr() * 220, 1.3 + rr() * 2, { fill: C.cream }, starsL);
    const sunL = pin(w.layer(0.3));
    O(1336, 252, 130, { fill: `url(#${id}sun)` }, sunL);
    O(1336, 252, 22, { fill: "#ffd27a", filter: "url(#card1)" }, sunL);
    const moonL = w.layer(0.3);
    O(1110, 258, 110, { fill: `url(#${id}moonG)` }, moonL);
    const moon = G({ filter: "url(#card1)" }, moonL);
    O(1110, 258, 20, { fill: "#f3e7c4" }, moon);
    [[1103, 251, 4], [1118, 263, 3.2], [1106, 268, 2.4]].forEach(([x, y, r]) => O(x, y, r, { fill: "#e0cfa2" }, moon));
    const clouds = [[1060, 236, 0.46, 0, 8], [1330, 290, 0.36, 560, 11]].map(([x, y, sc, ph, speed]) => {
      const L = w.layer(0.33);
      const g = G({ filter: "url(#card1)", transform: `translate(${x} ${y}) scale(${sc})` }, L);
      P("M -110 30 Q -100 -10 -60 -6 Q -40 -44 6 -34 Q 40 -60 76 -24 Q 116 -24 116 30 Z", { fill: "#fbefe2" }, g);
      return { el: L.parentNode, ph, speed };
    });
    const city = (night) => {
      const L = w.layer(0.42);
      const r = PT.rng(5);
      const rows = [{ y: 384, h: [36, 104], c: night ? "#1d2a4c" : "#aebcd8", win: night ? "#ffcf7a" : "#d6e3f0", lit: 0.35 },
        { y: 430, h: [18, 74], c: night ? "#141d38" : "#8b9cc0", win: night ? "#ffcf7a" : "#c4d4e6", lit: 0.28 }];
      rows.forEach((row, ri) => {
        const g = G({ filter: "url(#card1)" }, L), wins = G({}, L);
        for (let x = 730 + ri * 30; x < 1700;) {
          const bw = 52 + r() * 60, bh = row.h[0] + r() * (row.h[1] - row.h[0]), top = row.y - bh;
          R(x, top, bw - 6, 560 - top, { fill: row.c }, g);
          if (r() < 0.25) R(x + bw * 0.4, top - 26, 4, 26, { fill: row.c }, g);
          if (ri === 0 && r() < 0.18) { R(x + 12, top - 30, 24, 22, { rx: 4, fill: row.c }, g); R(x + 16, top - 8, 3, 8, { fill: row.c }, g); R(x + 29, top - 8, 3, 8, { fill: row.c }, g); }
          for (let wy = top + 12; wy < 470; wy += 22) for (let wx = x + 9; wx < x + bw - 16; wx += 17) {
            const on = r();
            if (!night || on < row.lit) R(wx, wy, 7, 9, { fill: row.win, opacity: night ? 0.95 : 0.7 }, wins);
          }
          x += bw;
        }
      });
      return L.parentNode;
    };
    const cityDay = city(false), cityNight = city(true);

    /* ------------------------------------------------ wall 0.7: window hole, two-tone wall, rail, headwall, light, whiteboard */
    const hole = `M ${WIN.x0} ${WIN.y0} V ${WIN.y1} H ${WIN.x1} V ${WIN.y0} Z`;
    const Lw = w.layer(0.7);
    P(`M -300 -400 H 2220 V 1300 H -300 Z ${hole}`, { fill: C.wall, "fill-rule": "evenodd", filter: "url(#card0)" }, Lw);
    R(-300, 612, 2520, 690, { fill: C.wallLow }, Lw);
    for (let x = -280; x < 2220; x += 120) R(x, 640, 3, 150, { fill: C.wallDk, opacity: 0.5 }, Lw);
    R(-300, 596, 2520, 20, { rx: 4, fill: C.woodLt, filter: "url(#card1)" }, Lw);
    R(-300, 18, 2520, 12, { fill: C.frame, filter: "url(#card1)" }, Lw);
    const frame = G({ filter: "url(#card2)" }, Lw);
    P(`M 980 128 H 1440 V 472 H 980 Z ${hole}`, { fill: C.frame, "fill-rule": "evenodd" }, frame);
    R(WIN.mx - 5, WIN.y0, 10, WIN.y1 - WIN.y0, { fill: C.frame }, frame);
    R(962, 462, 496, 20, { rx: 4, fill: "#d3d8cf", filter: "url(#card2)" }, Lw);
    const blinds = G({ filter: "url(#lift)" }, Lw);
    R(WIN.x0, WIN.y0, WIN.x1 - WIN.x0, 46, { fill: "#f1ede2" }, blinds);
    for (let y = WIN.y0 + 6; y < WIN.y0 + 46; y += 7) R(WIN.x0, y, WIN.x1 - WIN.x0, 2, { fill: "#d9d2c2" }, blinds);
    R(WIN.x0 - 4, WIN.y0 + 44, WIN.x1 - WIN.x0 + 8, 10, { rx: 3, fill: "#d9d2c2" }, blinds);
    // headwall: gas outlets and a nurse call under the over-bed light
    const hw = G({ filter: "url(#card2)" }, Lw);
    R(372, 372, 456, 74, { rx: 9, fill: C.panel }, hw);
    [[420, "#6fbf8a"], [462, C.cream], [504, C.ink2]].forEach(([x, c]) => { O(x, 409, 15, { fill: "#d9d3c4" }, hw); O(x, 409, 9, { fill: c }, hw); O(x, 409, 3, { fill: C.ink }, hw); });
    R(744, 396, 46, 26, { rx: 6, fill: "#d9d3c4" }, hw); O(767, 409, 8, { fill: C.tomato }, hw);
    R(560, 398, 140, 22, { rx: 4, fill: "#e2ddcf" }, hw);
    T(630, 414, "OXYGEN · AIR · CALL", { "text-anchor": "middle", "font-family": "Bricolage", "font-weight": 700, "font-size": 10, "letter-spacing": 1.4, fill: "#8d887b" }, hw);
    const lightFix = G({ filter: "url(#card2)" }, Lw);
    R(410, 312, 380, 28, { rx: 10, fill: "#f6f2e6" }, lightFix);
    const lens = R(424, 334, 352, 8, { rx: 4, fill: "#e8e1cf" }, Lw);
    // whiteboard
    const wb = G({ filter: "url(#card2)" }, Lw);
    R(1696, 244, 200, 196, { rx: 6, fill: "#c9cfd4" }, wb);
    R(1704, 252, 184, 180, { rx: 3, fill: "#fbfbf7" }, wb);
    R(1720, 430, 150, 10, { rx: 3, fill: "#aeb6bd" }, wb);
    const ink = G({}, Lw);
    T(1720, 282, "ROOM 12", { "font-family": "Bricolage", "font-weight": 800, "font-size": 17, "letter-spacing": 2.5, fill: C.sky }, ink);
    T(1720, 322, "Nurse: Ada", { "font-family": "Fraunces", "font-style": "italic", "font-weight": 600, "font-size": 22, fill: C.ink2 }, ink);
    T(1720, 356, "Doctor: Ruiz", { "font-family": "Fraunces", "font-style": "italic", "font-weight": 600, "font-size": 22, fill: C.ink2 }, ink);
    T(1720, 404, "Get well soon!", { "font-family": "Fraunces", "font-style": "italic", "font-weight": 600, "font-size": 21, fill: C.tomato }, ink);
    P("M 1858 300 C 1846 290 1850 278 1860 284 C 1870 278 1874 290 1862 300 Z", { fill: "none", stroke: C.tomato, "stroke-width": 3 }, ink);
    [[1732, C.sky], [1760, C.tomato], [1788, C.ink2]].forEach(([x, c]) => R(x, 424, 22, 7, { rx: 3, fill: c }, ink));

    /* ------------------------------------------------ blind cord 0.7 (small, swings) */
    const Lcord = pin(w.layer(0.7));
    Lcord.style.transformOrigin = "1432px 200px";
    P("M 1432 200 V 340", { stroke: "#cfc6b6", "stroke-width": 2.2 }, Lcord);
    R(1427, 336, 10, 18, { rx: 4, fill: "#d9d2c2", filter: "url(#lift)" }, Lcord);

    /* ------------------------------------------------ floor 0.85 */
    const Lf = w.layer(0.85);
    const fl = G({ filter: "url(#card1)" }, Lf);
    R(-300, 790, 2520, 510, { fill: C.floor }, fl);
    R(-300, 790, 2520, 510, { fill: `url(#${id}speck)` }, fl);
    const VP = -1500, Y0 = 790;
    let seams = "";
    [836, 896, 974, 1076, 1210].forEach((y) => { seams += `M -300 ${y} H 2220 `; });
    for (let j = 0; j < 22; j++) { const a = -700 + j * 170, X = (y) => 960 + (a - 960) * (y - VP) / (Y0 - VP); seams += `M ${X(790).toFixed(1)} 790 L ${X(1300).toFixed(1)} 1300 `; }
    P(seams, { stroke: C.seam, "stroke-width": 2.5, fill: "none" }, fl);
    R(-300, 772, 2520, 22, { fill: "#e3e6df", filter: "url(#card1)" }, Lf);

    /* ------------------------------------------------ privacy curtain 0.78 on a ceiling track (sways by CSS transform) */
    const Lcur = pin(w.layer(0.78));
    Lcur.style.transformOrigin = "0px 40px";
    const cur = G({ filter: "url(#card2)" }, Lcur);
    let cd = "M -90 44 H 246";
    cd += " V 120 L 252 860";
    for (let i = 0; i < 9; i++) { const x = 252 - i * 38; cd += ` Q ${x - 19} 878 ${x - 38} 862`; }
    cd += " L -90 862 Z";
    P(cd, { fill: C.curtain }, cur);
    P(cd, { fill: `url(#${id}cur)` }, cur);
    for (let i = 0; i < 9; i++) P(`M ${-62 + i * 38} 124 L ${-60 + i * 38.6} 858`, { stroke: C.curtainDk, "stroke-width": 10, opacity: 0.55 }, cur);
    R(-90, 44, 336, 78, { fill: `url(#${id}mesh)` }, cur);
    R(-90, 118, 336, 8, { fill: C.curtainDk }, cur);
    R(-300, 30, 600, 12, { rx: 5, fill: C.metal, filter: "url(#lift)" }, Lcur);
    for (let i = 0; i < 9; i++) O(-74 + i * 40, 44, 5, { fill: C.metalDk }, Lcur);

    /* ------------------------------------------------ monitor on a stand 0.8 (static body; the trace is drawn last) */
    const MON = { x: 300 };
    const Lm = w.layer(0.8);
    const stand = G({ filter: "url(#card2)" }, Lm);
    R(MON.x - 5, 470, 10, 436, { fill: C.metal }, stand);
    R(MON.x - 70, 900, 140, 12, { rx: 5, fill: C.metalDk }, stand);
    [-62, 0, 62].forEach((dx) => O(MON.x + dx, 922, 9, { fill: C.ink2 }, stand));
    R(MON.x - 14, 462, 28, 18, { rx: 4, fill: C.metalDk }, stand);
    P("M 410 432 C 446 470 468 520 522 560", { stroke: C.ink2, "stroke-width": 3, fill: "none" }, Lm);
    const mon = G({ filter: "url(#card2)" }, Lm);
    P("M 254 300 Q 254 280 300 280 Q 346 280 346 300", { stroke: "#cfd4cf", "stroke-width": 9, fill: "none" }, mon);
    R(184, 298, 232, 172, { rx: 16, fill: "#e6e9e3" }, mon);
    R(198, 312, 204, 142, { rx: 7, fill: C.screen }, mon);
    [[226, C.ink2], [256, "#9aa3ad"], [286, "#9aa3ad"]].forEach(([x, c]) => R(x, 458, 18, 6, { rx: 3, fill: c }, mon));
    R(388, 286, 16, 12, { rx: 4, fill: "#cfd4cf" }, mon);

    /* ------------------------------------------------ IV stand 0.85 (behind the bed) and its drip */
    const IV = { x: 780 };
    const Liv = w.layer(0.85);
    const pole = G({ filter: "url(#lift)" }, Liv);
    R(IV.x - 4, 156, 8, 752, { fill: C.metal }, pole);
    R(IV.x - 40, 154, 80, 7, { rx: 3, fill: C.metalDk }, pole);
    P(`M ${IV.x - 36} 160 q 0 12 8 12 M ${IV.x + 36} 160 q 0 12 -8 12`, { stroke: C.metalDk, "stroke-width": 3, fill: "none" }, pole);
    R(IV.x - 66, 902, 132, 10, { rx: 4, fill: C.metalDk }, pole);
    [-58, 0, 58].forEach((dx) => O(IV.x + dx, 920, 8, { fill: C.ink2 }, pole));
    const bag = G({ filter: "url(#lift)" }, Liv);
    const BX = IV.x - 28;
    P(`M ${BX + 28} 172 V 184`, { stroke: "#cfd8dc", "stroke-width": 3 }, bag);
    P(`M ${BX - 2} 194 Q ${BX - 2} 184 ${BX + 8} 184 H ${BX + 48} Q ${BX + 58} 184 ${BX + 58} 194 V 290 Q ${BX + 58} 304 ${BX + 44} 308 L ${BX + 34} 316 H ${BX + 22} L ${BX + 12} 308 Q ${BX - 2} 304 ${BX - 2} 290 Z`, { fill: "#eef6f8", opacity: 0.92 }, bag);
    P(`M ${BX + 2} 222 H ${BX + 54} V 290 Q ${BX + 54} 300 ${BX + 42} 304 L ${BX + 32} 312 H ${BX + 24} L ${BX + 14} 304 Q ${BX + 2} 300 ${BX + 2} 290 Z`, { fill: "#cfe6ef" }, bag);
    R(BX + 10, 232, 36, 34, { rx: 3, fill: C.cream }, bag);
    [240, 248, 256].forEach((y, i) => R(BX + 15, y, 26 - i * 6, 3, { fill: C.sky }, bag));
    R(BX + 20, 316, 16, 40, { rx: 5, fill: "#e9f3f5", opacity: 0.9 }, bag);
    R(BX + 21, 342, 14, 12, { rx: 3, fill: "#cfe6ef" }, bag);
    const Ldrip = w.layer(0.85);
    const drop = E(IV.x, 322, 2.6, 3.4, { fill: "#a9d6e6" }, Ldrip);
    const ripple = E(IV.x, 343, 4, 1.4, { fill: "none", stroke: "#a9d6e6", "stroke-width": 1.2 }, Ldrip);

    /* ------------------------------------------------ the bed 0.9: frame, mattress with the head section raised, pillow */
    // mattress top runs flat at y 708 from the hinge (x 700) to the foot, and rises at 32 degrees to the head end (472, 565)
    const Lb = w.layer(0.9);
    const frameG = G({ filter: "url(#card2)" }, Lb);
    R(476, 846, 750, 16, { rx: 6, fill: C.metalDk }, frameG);
    [[560, 22], [1124, 22]].forEach(([x, wd]) => R(x, 760, wd, 90, { rx: 4, fill: C.metal }, frameG));
    [[498, 1], [1204, 1]].forEach(([x]) => { R(x - 6, 860, 12, 40, { fill: C.metalDk }, frameG); O(x, 918, 18, { fill: C.ink2 }, frameG); O(x, 918, 7, { fill: C.metal }, frameG); });
    P("M 451 599 L 689 748 L 689 764 L 444 612 Z", { fill: C.metal }, frameG);
    R(686, 748, 552, 16, { rx: 4, fill: C.metal }, frameG);
    O(694, 756, 9, { fill: C.metalDk }, frameG);
    const head = G({ filter: "url(#card2)" }, Lb);
    P("M 412 540 Q 412 516 436 516 Q 452 516 452 540 V 846 H 412 Z", { fill: C.woodLt }, head);
    R(418, 552, 10, 270, { rx: 5, fill: "#b98a5c", opacity: 0.6 }, head);
    const matt = G({ filter: "url(#card2)" }, Lb);
    P("M 472 565 L 700 708 L 1214 708 Q 1228 708 1228 722 V 734 Q 1228 748 1214 748 L 689 748 L 451 599 Q 444 580 472 565 Z", { fill: C.sheet }, matt);
    P("M 455 602 L 689 742 L 1220 742", { stroke: "#cfe0e6", "stroke-width": 4, fill: "none" }, matt);
    const pillow = E(552, 590, 96, 32, { fill: "#fbf9f3", filter: "url(#card1)", transform: "rotate(32 552 590)" }, Lb);

    /* ------------------------------------------------ the patient: head 0.9 (static), eyes (small), blanket + arm + IV line (breathes) */
    const HX = 566, HY = 548, HT = -7, HS = 1.3;
    const headT = `translate(${HX} ${HY}) rotate(${HT}) scale(${HS}) translate(0 296)`;
    const Lh = w.layer(0.9);
    const ph = G({ filter: "url(#card1)", transform: headT }, Lh);
    P("M -40 -258 Q -44 -232 -10 -224 H 30 Q 46 -236 40 -258 Z", { fill: "#cfe3e6" }, ph);
    O(0, -296, 44, { fill: C.kraft }, ph);
    const hp = (d) => P(d, { fill: PAT.hair }, ph);
    const hs = PAT.hairStyle;
    if (hs === "short") hp("M -46 -296 Q -48 -346 0 -344 Q 46 -346 46 -300 Q 30 -322 -4 -318 Q -30 -316 -46 -296 Z");
    if (hs === "bun") { hp("M -46 -292 Q -50 -346 0 -344 Q 50 -346 46 -292 Q 40 -324 0 -326 Q -40 -324 -46 -292 Z"); O(30, -342, 19, { fill: PAT.hair }, ph); }
    if (hs === "bob") hp("M -50 -268 Q -58 -350 0 -346 Q 58 -350 50 -268 L 38 -268 Q 40 -316 0 -318 Q -40 -316 -38 -268 Z");
    if (hs === "curly") [[-34, -322], [-12, -340], [14, -340], [36, -322], [-44, -300], [44, -300]].forEach(([x, y]) => O(x, y, 17, { fill: PAT.hair }, ph));
    if (hs === "thin") hp("M -44 -300 Q -40 -320 -30 -326 L -28 -312 Q -36 -306 -38 -292 Z M 44 -300 Q 40 -320 30 -326 L 28 -312 Q 36 -306 38 -292 Z");
    E(-27, -279, 7, 4.5, { fill: "#e98b6d", opacity: 0.45 }, ph);
    E(27, -279, 7, 4.5, { fill: "#e98b6d", opacity: 0.45 }, ph);
    P("M -8 -270 Q 0 -266 8 -270", { stroke: C.ink, "stroke-width": 3, fill: "none", "stroke-linecap": "round" }, ph);
    const Le = w.layer(0.9);
    const face = G({ transform: headT }, Le);
    const shut = P("M -21 -292 Q -15 -286 -9 -292 M 9 -292 Q 15 -286 21 -292", { stroke: C.ink, "stroke-width": 3.2, fill: "none", "stroke-linecap": "round" }, face);
    const open = G({}, face);
    [-15, 15].forEach((x) => { E(x, -294, 5.6, 7.6, { fill: C.ink }, open); O(x + 1.8, -297, 1.9, { fill: "#fff8ea" }, open); });
    const Lbl = pin(w.layer(0.9));
    const blanket = G({ filter: "url(#card3)" }, Lbl);
    const bp = "M 580 612 C 622 600 664 628 702 662 C 742 690 820 684 900 684 C 990 684 1070 684 1114 680 C 1140 678 1148 646 1170 646 C 1194 646 1204 676 1214 690 Q 1240 700 1240 732 L 1240 772 Q 980 782 690 770 L 562 690 Q 550 650 580 612 Z";
    P(bp, { fill: PAT.color }, blanket);
    P(bp, { fill: `url(#${id}waffle)` }, blanket);
    P("M 584 618 C 624 606 664 632 702 668", { stroke: C.sheet, "stroke-width": 16, fill: "none", "stroke-linecap": "round" }, blanket);
    const arm = G({ filter: "url(#lift)" }, Lbl);
    P("M 640 650 L 732 676", { stroke: shade(PAT.color, 0.22), "stroke-width": 25, "stroke-linecap": "round" }, arm);
    O(748, 678, 14, { fill: C.kraft }, arm);
    R(736, 670, 16, 10, { rx: 2, fill: C.cream, transform: "rotate(14 744 675)" }, arm);
    P(`M 744 672 C 762 640 790 560 774 470 C 764 410 ${IV.x} 384 ${IV.x} 356`, { stroke: "#f3f8f8", "stroke-width": 3, fill: "none", opacity: 0.9 }, Lbl);

    /* ------------------------------------------------ bed front 0.9: foot rail with the chart, footboard */
    const Lbf = w.layer(0.9);
    const rail = G({ filter: "url(#lift)" }, Lbf);
    R(880, 662, 290, 9, { rx: 4.5, fill: C.metal }, rail);
    R(880, 698, 290, 9, { rx: 4.5, fill: C.metal }, rail);
    [884, 1020, 1160].forEach((x) => R(x, 662, 8, 90, { rx: 3, fill: C.metalDk }, rail));
    const chart = G({ filter: "url(#card1)", transform: "rotate(3 1060 668)" }, Lbf);
    R(1032, 668, 60, 82, { rx: 4, fill: C.woodLt }, chart);
    R(1038, 680, 48, 64, { fill: "#fbfbf7" }, chart);
    R(1050, 662, 24, 10, { rx: 3, fill: C.metalDk }, chart);
    [690, 700, 710, 720, 730].forEach((y, i) => R(1044, y, 36 - (i % 2) * 12, 3, { fill: C.sky, opacity: 0.8 }, chart));
    const foot = G({ filter: "url(#card2)" }, Lbf);
    P("M 1236 640 Q 1236 622 1252 622 Q 1268 622 1268 640 V 846 H 1236 Z", { fill: C.woodLt }, foot);

    /* ------------------------------------------------ bedside table with flowers 0.92 */
    const Lt = w.layer(0.92);
    const tbl = G({ filter: "url(#card2)" }, Lt);
    R(1290, 700, 124, 208, { rx: 6, fill: C.panel }, tbl);
    R(1284, 692, 136, 14, { rx: 5, fill: "#f6f2e6" }, tbl);
    R(1300, 716, 104, 40, { rx: 4, fill: "#e2ddcf" }, tbl);
    R(1340, 732, 24, 6, { rx: 3, fill: C.metalDk }, tbl);
    R(1300, 766, 104, 128, { rx: 4, fill: "#e2ddcf" }, tbl);
    [1302, 1402].forEach((x) => O(x, 922, 8, { fill: C.ink2 }, tbl));
    const fls = G({ filter: "url(#lift)" }, Lt);
    [[1352, 640, 1318, 548], [1352, 640, 1350, 524], [1352, 640, 1388, 552], [1352, 640, 1334, 586], [1352, 640, 1374, 590]].forEach(([x0, y0, x1, y1]) =>
      P(`M ${x0} ${y0 + 50} Q ${(x0 + x1) / 2} ${(y0 + y1) / 2 + 20} ${x1} ${y1}`, { stroke: C.leaf, "stroke-width": 4, fill: "none" }, fls));
    [[1330, 610, -40], [1374, 604, 40]].forEach(([x, y, r]) => P("M 0 0 C -10 -10 -8 -26 0 -32 C 8 -26 10 -10 0 0 Z", { fill: C.leaf, transform: `translate(${x} ${y}) rotate(${r})` }, fls));
    [[1318, 548, C.tomato], [1350, 524, C.mustard], [1388, 552, C.plum], [1334, 586, C.cream], [1374, 590, C.tomato]].forEach(([x, y, c]) => {
      for (let k = 0; k < 5; k++) { const a = (k * 2 * Math.PI) / 5; O(x + 9 * Math.cos(a), y + 9 * Math.sin(a), 8, { fill: c }, fls); }
      O(x, y, 5.5, { fill: c === C.mustard ? C.mustardDk : C.mustard }, fls);
    });
    P("M 1332 640 H 1372 L 1368 694 Q 1352 702 1336 694 Z", { fill: "#9fd2c8", opacity: 0.88 }, fls);
    R(1336, 662, 32, 4, { fill: "#ffffff", opacity: 0.4 }, fls);
    const card = G({ filter: "url(#lift)" }, Lt);
    P("M 1384 694 L 1392 656 L 1414 662 L 1408 696 Z", { fill: C.mustard }, card);
    P("M 1398 674 c -4 -4 -2 -8 1 -6 c 3 -2 6 2 1 6 z", { fill: C.tomato }, card);

    /* ------------------------------------------------ visitor chair 1.0 (behind the puppets), seat top at y 866 */
    const CH = { x: 1600, y: 930 };
    const Lc = w.layer(1.0);
    const ch = G({ filter: "url(#card2)" }, Lc);
    E(CH.x, 942, 118, 10, { fill: C.ink, opacity: 0.18 }, ch);
    [-92, 92].forEach((dx) => R(CH.x + dx - 8, 622, 16, 318, { rx: 6, fill: C.woodDk }, ch));
    R(CH.x - 86, 626, 172, 230, { rx: 26, fill: C.navy }, ch);
    R(CH.x - 74, 636, 148, 16, { rx: 8, fill: "#4d6194" }, ch);
    [[-40, 700], [40, 700], [-40, 780], [40, 780], [0, 740]].forEach(([dx, y]) => O(CH.x + dx, y, 4, { fill: "#2f3e68" }, ch));
    P(`M ${CH.x - 90} 870 L ${CH.x + 90} 870 L ${CH.x + 80} 846 L ${CH.x - 80} 846 Z`, { fill: "#4d6194" }, ch);
    R(CH.x - 92, 864, 184, 26, { rx: 8, fill: C.navy }, ch);
    [-1, 1].forEach((sg) => {
      R(CH.x + sg * 104 - 12, 766, 24, 132, { rx: 6, fill: C.wood }, ch);
      R(CH.x + sg * 104 - 16, 752, 32, 18, { rx: 8, fill: C.navy }, ch);
      R(CH.x + sg * 98 - 7, 888, 14, 52, { rx: 4, fill: C.wood }, ch);
    });

    /* ------------------------------------------------ puppets 1.0 */
    const Lp = w.layer(1.0);
    const people = cast.map((c) => {
      const cc = Object.assign({}, c, c.chair ? { x: CH.x, y: CH.y, sit: c.sit ?? 1 } : {});
      return { c: cc, p: PT.puppet(Lp, { shirt: c.shirt, pants: c.pants, hair: c.hair, hairStyle: c.hairStyle || "short", glasses: c.glasses }) };
    });

    /* ------------------------------------------------ foreground 1.55, out of focus: a visitor's bag (lower left) and the over-bed tray (lower right).
     * Kept low in the frame: the monitor trace is drawn over everything, so nothing in front may cross the screen. */
    const Lfg = w.layer(1.55);
    const fg = G({ filter: "url(#dof)" }, Lfg);
    P("M -40 1030 Q -50 976 10 960 Q 70 950 120 964 Q 176 982 164 1032", { stroke: "#3e2c46", "stroke-width": 13, fill: "none" }, fg);
    P("M -100 1024 H 200 L 226 1240 H -126 Z", { fill: "#5b3f63" }, fg);
    R(-110, 1074, 330, 18, { fill: "#6d4c78" }, fg);
    R(1830, 1010, 420, 26, { rx: 10, fill: C.woodLt }, fg);
    R(1840, 1034, 400, 14, { fill: "#a87a50" }, fg);
    P("M 2122 1010 L 2128 940 H 2182 L 2188 1010 Z", { fill: C.sky }, fg);
    R(2120, 932, 70, 12, { rx: 4, fill: "#fbfbf7" }, fg);
    E(2010, 1004, 44, 10, { fill: "#fbfbf7" }, fg);

    /* ------------------------------------------------ daylight from the window (plain alpha) */
    const Lbeam = w.layer(0.7);
    svg("polygon", { points: `${WIN.x0},${WIN.y1} ${WIN.x1},${WIN.y1} 1760,980 1240,980`, fill: `url(#${id}beam)` }, Lbeam);

    /* ------------------------------------------------ evening dim (multiply) with the window panes left clear */
    const Ldim = w.layer(0.7, { mixBlendMode: "multiply" });
    const pane = (x0, x1, y0, y1) => `M ${x0} ${y0} V ${y1} H ${x1} V ${y0} Z`;
    P(`M -300 -400 H 2220 V 1300 H -300 Z ${pane(WIN.x0, WIN.mx - 5, WIN.blinds, WIN.y1)} ${pane(WIN.mx + 5, WIN.x1, WIN.blinds, WIN.y1)}`, { fill: "#4b5a8f", "fill-rule": "evenodd" }, Ldim);

    /* ------------------------------------------------ the over-bed light (screen): the set's practical light */
    const Lg = w.layer(0.9, { mixBlendMode: "screen" });
    O(600, 450, 340, { fill: `url(#${id}lamp)` }, Lg);
    svg("polygon", { points: "430,340 770,340 880,720 330,720", fill: `url(#${id}cone)` }, Lg);
    R(430, 334, 340, 10, { rx: 5, fill: "#fff4d2", opacity: 0.8, filter: "url(#glow)" }, Lg);

    /* ------------------------------------------------ monitor trace 0.8, drawn over the dim so it glows */
    const Lecg = w.layer(0.8);
    const scr = G({ "clip-path": `url(#${id}scr)` }, Lecg);
    R(204, 401, 132, 1.5, { fill: "#2c3a52" }, Lecg);
    const ecgGlow = P("", { stroke: C.mint, "stroke-width": 7, opacity: 0.22, fill: "none", "stroke-linejoin": "round", "stroke-linecap": "round" }, scr);
    const ecgLine = P("", { stroke: C.mint, "stroke-width": 2.6, fill: "none", "stroke-linejoin": "round", "stroke-linecap": "round" }, scr);
    const plethLine = P("", { stroke: "#7cc6f2", "stroke-width": 2.4, fill: "none", "stroke-linejoin": "round" }, scr);
    const pen = O(336, 360, 3.6, { fill: "#e9fff2" }, Lecg);
    const mono = { "font-family": "Bricolage", "font-weight": 800 };
    T(344, 332, "HR", Object.assign({ "font-size": 11, "letter-spacing": 1.5, fill: "#6fbf8a" }, mono), Lecg);
    const hrText = T(398, 368, "72", Object.assign({ "font-size": 34, "text-anchor": "end", fill: C.mint }, mono), Lecg);
    T(344, 416, "SpO2", Object.assign({ "font-size": 11, "letter-spacing": 1.2, fill: "#5f9fc8" }, mono), Lecg);
    const spoText = T(398, 444, "97", Object.assign({ "font-size": 24, "text-anchor": "end", fill: "#7cc6f2" }, mono), Lecg);
    const heart = P("M 0 4 C -7 -2 -5 -8 0 -5 C 5 -8 7 -2 0 4 Z", { fill: C.tomato }, Lecg);
    const alarm = O(396, 292, 6, { fill: "#7a3528" }, Lecg);

    w.overlay("vignette");

    const anchors = {
      bed: { x: 850, y: 640 }, patientHead: { x: HX, y: HY }, monitor: { x: MON.x, y: 384 }, chair: { x: CH.x, y: CH.y }, window: { x: WIN.mx, y: WIN.my },
    };
    const TR = { x0: 204, x1: 336, span: 2.4, y: 362, amp: 30, py: 446, pamp: 30 };
    const pg = (x) => (x > 0 ? (x / 0.11) * Math.exp(1 - x / 0.11) : 0);

    function update(t, s = {}) {
      const k = s.sky ?? 0;
      op(skies[1], clamp(k * 2)); op(skies[2], clamp(k * 2 - 1));
      op(starsL.parentNode, clamp(k * 2.2 - 1.2)); op(moonL.parentNode, clamp(k * 2 - 1));
      sunL.style.transform = `translate(0px, ${(150 * clamp(k * 1.6 - 0.2)).toFixed(1)}px)`;
      op(sunL.parentNode, 1 - clamp(k * 2 - 0.9));
      op(cityNight, clamp(k * 2 - 1));
      clouds.forEach((c) => { c.el.style.marginLeft = (((t * c.speed + c.ph) % 1040) - 520).toFixed(1) + "px"; op(c.el, 1 - 0.75 * clamp(k * 2 - 1)); });
      op(Lbeam.parentNode, 1 - clamp(k * 1.6));
      op(Ldim.parentNode, s.dim ?? 0.66 * clamp(k * 1.6 - 0.6));
      const light = s.light ?? 1;
      op(Lg.parentNode, light * 0.85);
      setA(lens, "fill", light > 0.2 ? "#fff4d2" : "#e8e1cf");
      // gentle constant motion: the curtain and the blind cord
      Lcur.style.transform = `skewX(${(0.55 * Math.sin(t * 0.8) + 0.2 * Math.sin(t * 1.9 + 1)).toFixed(3)}deg)`;
      Lcord.style.transform = `rotate(${(2.2 * Math.sin(t * 1.3 + 0.5)).toFixed(3)}deg)`;
      // patient
      const pv = s.patient ?? 1;
      [Lh, Le, Lbl].forEach((L) => op(L.parentNode, pv));
      const br = (s.breath ?? 1) * pv;
      Lbl.style.transform = `translate(0px, ${(-2.4 * br * Math.sin(t * 1.55)).toFixed(2)}px)`;
      const eyesOpen = s.eyes === "open" || s.eyes === 1 || s.eyes === true;
      op(shut, eyesOpen ? 0 : 1); op(open, eyesOpen ? 1 : 0);
      if (eyesOpen) setA(open, "transform", `translate(0 -294) scale(1 ${Math.max(0.06, 1 - K.blink(t, 1e9, 1.6)).toFixed(3)}) translate(0 294)`);
      // IV drip: a drop swells, falls, and rings the surface
      const dv = s.drip ?? 1;
      op(Ldrip.parentNode, dv * pv);
      if (dv * pv > 0.01) {
        const u = (t / 1.3) % 1;
        const swell = clamp(u / 0.72), fall = clamp((u - 0.72) / 0.14);
        setA(drop, "cy", (322 + 22 * fall * fall).toFixed(1));
        setA(drop, "rx", (1 + 1.8 * swell).toFixed(2)); setA(drop, "ry", (1.3 + 2.3 * swell).toFixed(2));
        drop.style.opacity = u < 0.86 ? 1 : 0;
        const rp = clamp((u - 0.86) / 0.14);
        setA(ripple, "rx", (3 + 5 * rp).toFixed(1)); ripple.style.opacity = u > 0.86 ? (1 - rp).toFixed(2) : 0;
      }
      // monitor: the trace scrolls left; the pen at the right edge is "now"
      const bpm = s.bpm ?? 72, flat = clamp(s.flat ?? 0), amp = (1 - flat) * pv;  // an empty bed leaves the monitor on standby
      const ta = t - TR.span, X = (tau) => (TR.x0 + ((tau - ta) / TR.span) * (TR.x1 - TR.x0)).toFixed(1);
      const bs = beats(ta - 0.4, t + 0.4, bpm);
      const knots = [ta, t];
      bs.forEach((b) => PQRST.forEach(([dx]) => { const tau = b + dx; if (tau > ta && tau < t) knots.push(tau); }));
      knots.sort((a, b) => a - b);
      const v = (tau) => bs.reduce((a, b) => a + tpl(tau - b), 0) * amp;
      let d = "";
      knots.forEach((tau, i) => { d += (i ? "L" : "M") + X(tau) + " " + (TR.y - TR.amp * v(tau)).toFixed(1); });
      ecgLine.setAttribute("d", d); ecgGlow.setAttribute("d", d);
      setA(pen, "cy", (TR.y - TR.amp * v(t)).toFixed(1));
      let pd = "";
      for (let i = 0; i <= 44; i++) { const tau = ta + (i / 44) * TR.span; const pv2 = bs.reduce((a, b) => a + pg(tau - b - 0.16), 0) * amp; pd += (i ? "L" : "M") + X(tau) + " " + (TR.py - TR.pamp * pv2).toFixed(1); }
      plethLine.setAttribute("d", pd);
      const rate = typeof bpm === "function" ? bpm(t) : bpm, alarmOn = flat > 0.5;
      const hr = alarmOn ? "0" : pv < 0.5 ? "--" : String(Math.round(rate));
      if (hrText.textContent !== hr) hrText.textContent = hr;
      const spo = alarmOn || pv < 0.5 ? "--" : "97";
      if (spoText.textContent !== spo) spoText.textContent = spo;
      const blinkOn = alarmOn && Math.floor(t * 2.5) % 2 === 0;
      setA(hrText, "fill", blinkOn ? C.tomato : C.mint);
      setA(alarm, "fill", blinkOn ? "#ff6a4a" : "#7a3528");
      const last = bs.filter((b) => b <= t).pop();
      const pulse = !alarmOn && pv >= 0.5 && last !== undefined ? Math.exp(-(t - last) / 0.12) : 0;
      setA(heart, "transform", `translate(352 352) scale(${(1 + 0.45 * pulse).toFixed(3)})`);
      // cast
      people.forEach(({ c, p }, i) => p.pose(Object.assign({ x: c.x, y: c.y ?? 930, s: c.s ?? 1.3, hs: c.hs ?? 1, sit: c.sit ?? 0,
        bob: 1.8 * Math.sin(t * 1.9 + i), armF: -9, armB: 9, blink: K.blink(t, 1e9, 1.2 + i * 0.7) }, (s.cast || [])[i] || {})));
    }
    return { update, anchors, people, beats };
  };
  K.loc.hospital.beats = beats;
})();
