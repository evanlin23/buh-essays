/* K.loc.street: a city block at dusk or deep night. Load after stage.js and kit.js.
 *
 *   const w = K.world(parent);
 *   const street = K.loc.street(w, { cast });
 *   street.update(t, state);                            // every frame, after w.camera(...)
 *
 * Four paper facades with grids of windows that switch off one by one, a 24-hour diner with a warm interior and a
 * flickering "OPEN 24 H" sign, a street lamp with a glow pool, a bus stop with a bench, a sidewalk, a road with a
 * steaming manhole, and a paper taxi that drives across.
 *
 * opts
 *   cast: [{ x, y?, s?, hs?, sit?, shirt, pants?, hair, hairStyle, glasses }]   puppets on the sidewalk: feet at
 *         (x, y ?? 905), s 1.05. To sit someone on the bus-stop bench use x, y, s from anchors.bench and sit: 1.
 * state
 *   sky     0..1: 0 dusk, 1 deep night (stars come out, the moon brightens, facades darken). Default 0.6.
 *   lights  0..1: fraction of windows lit. Each window has a fixed threshold, so lowering it turns lights off one by
 *           one in the same order every time (the last one on is a flickering TV). Default 0.9 - 0.65 * sky.
 *   neon    0..1: the diner's OPEN 24 H sign (it always flickers softly while on). Default 1.
 *   lamp    0..1: the street lamp. Default 1.
 *   car     0..1: the taxi drives left to right across the whole street; hidden at 0 and 1. Ease it yourself.
 *   cast    [pose overrides per person]
 * anchors   (the long 16:9 view is camera {x: 960, y: 540, z: 1})
 *   diner, lamp, windows   camera targets {x, y, z} that frame each one in a 9:16 Short (parallax-corrected).
 *   sidewalk               {x, y}: y is the feet line for standing puppets; x is a free spot by the diner.
 *   bench                  {x, y, s}: feet and scale for a puppet sitting (sit: 1) on the bus-stop bench.
 * returns { update, anchors, people: [{c, p}] }
 */
(function () {
  const { svg, html, clamp, lerp } = PT;

  K.loc.street = (w, { cast = [] } = {}) => {
    const id = K.uid("st");
    const C = { cream: "#f6ecd9", kraft: "#d4a777", ink: "#1c1f2e", navy: "#2b2f45", trim: "#3d4f80", wood: "#7b4a36", woodDk: "#5e3829",
      plum: "#7b4b94", plumDk: "#5b3f63", teal: "#2a9d8f", tomato: "#e4572e", mustard: "#f2b134", mustardDk: "#cf8f2e", sky: "#5aa9e6",
      glass: "#151c36", walk: "#5d5566", road: "#262a3d", leaf: "#2b6150" };
    w.defs.innerHTML += `
      <linearGradient id="${id}dusk" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#6d5a9c"/><stop offset="0.5" stop-color="#e98f7a"/><stop offset="0.8" stop-color="#ffd59a"/></linearGradient>
      <linearGradient id="${id}blue" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1f2b52"/><stop offset="0.55" stop-color="#4b4a86"/><stop offset="0.85" stop-color="#b07a8e"/></linearGradient>
      <linearGradient id="${id}night" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0b1128"/><stop offset="0.75" stop-color="#26365f"/></linearGradient>
      <radialGradient id="${id}moon"><stop offset="0" stop-color="#e9efff" stop-opacity="0.5"/><stop offset="1" stop-color="#e9efff" stop-opacity="0"/></radialGradient>
      <linearGradient id="${id}warm" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffe2a2"/><stop offset="1" stop-color="#ffb45e"/></linearGradient>
      <linearGradient id="${id}diner" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff0c4"/><stop offset="1" stop-color="#ffc472"/></linearGradient>
      <radialGradient id="${id}lamp"><stop offset="0" stop-color="#ffe0a0" stop-opacity="0.95"/><stop offset="0.3" stop-color="#ffb45e" stop-opacity="0.4"/><stop offset="1" stop-color="#ffb45e" stop-opacity="0"/></radialGradient>
      <radialGradient id="${id}pool"><stop offset="0" stop-color="#ffd890" stop-opacity="0.55"/><stop offset="1" stop-color="#ffb45e" stop-opacity="0"/></radialGradient>
      <radialGradient id="${id}bloom"><stop offset="0" stop-color="#ffd59a" stop-opacity="0.5"/><stop offset="1" stop-color="#ffb45e" stop-opacity="0"/></radialGradient>
      <linearGradient id="${id}spill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffcf8a" stop-opacity="0.42"/><stop offset="1" stop-color="#ffb45e" stop-opacity="0"/></linearGradient>
      <radialGradient id="${id}steam"><stop offset="0" stop-color="#e6dfee" stop-opacity="0.9"/><stop offset="0.6" stop-color="#e6dfee" stop-opacity="0.45"/><stop offset="1" stop-color="#e6dfee" stop-opacity="0"/></radialGradient>
      <radialGradient id="${id}neon"><stop offset="0" stop-color="#ff7d6e" stop-opacity="0.6"/><stop offset="1" stop-color="#ff5a4a" stop-opacity="0"/></radialGradient>
      <linearGradient id="${id}beam" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff1c2" stop-opacity="0.5"/><stop offset="1" stop-color="#fff1c2" stop-opacity="0"/></linearGradient>
      <linearGradient id="${id}ad" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2e3e66"/><stop offset="1" stop-color="#5a4a86"/></linearGradient>
      <pattern id="${id}check" width="20" height="20" patternUnits="userSpaceOnUse"><rect width="20" height="20" fill="${C.cream}"/><rect width="10" height="10" fill="${C.ink}"/><rect x="10" y="10" width="10" height="10" fill="${C.ink}"/></pattern>
      <pattern id="${id}brick" width="48" height="24" patternUnits="userSpaceOnUse"><path d="M 0 23 H 48 M 24 0 V 11 M 0 11 H 48 M 0 12 V 23 M 48 12 V 23" stroke="#000" stroke-width="2" opacity="0.13" fill="none"/></pattern>
      <pattern id="${id}rib" width="20" height="16" patternUnits="userSpaceOnUse"><rect width="20" height="3" fill="#000" opacity="0.18"/></pattern>`;
    const R = (g, x, y, wd, ht, fill, extra = {}) => svg("rect", Object.assign({ x, y, width: wd, height: ht, fill }, extra), g);
    const T = (g, x, y, str, attrs) => { const e = svg("text", Object.assign({ x, y, "text-anchor": "middle" }, attrs), g); e.textContent = str; return e; };
    const op = (el, v) => { const s2 = String(Math.round(v * 1000) / 1000); if (el.style.opacity !== s2) el.style.opacity = s2; };
    const mover = (layer) => { layer.style.willChange = "transform"; return layer; };

    /* ---- sky (static, crossfaded with CSS opacity), stars, moon, drifting clouds */
    const skies = ["dusk", "blue", "night"].map((k) => {
      const S = w.layer(0.2);
      R(S, -300, -400, 2520, 1500, `url(#${id}${k})`, { filter: k === "dusk" ? "url(#card0)" : "none" });
      return S.parentNode;
    });
    const starL = w.layer(0.2);
    const rs = PT.rng(31);
    for (let i = 0; i < 70; i++) svg("circle", { cx: -280 + rs() * 2480, cy: -380 + rs() * 760, r: 1.3 + rs() * 2.3, fill: C.cream }, starL);
    const twL = w.layer(0.2);
    const twinkles = [];
    for (let i = 0; i < 12; i++) {
      const x = -200 + rs() * 2300, y = -300 + rs() * 620;
      twinkles.push({ el: svg("path", { d: `M ${x} ${y - 8} L ${x + 2} ${y - 2} L ${x + 8} ${y} L ${x + 2} ${y + 2} L ${x} ${y + 8} L ${x - 2} ${y + 2} L ${x - 8} ${y} L ${x - 2} ${y - 2} Z`, fill: "#fff6dc" }, twL), ph: rs() * 6.28, f: 0.6 + rs() * 0.9 });
    }
    const moonL = w.layer(0.22);
    svg("circle", { cx: 610, cy: 132, r: 190, fill: `url(#${id}moon)` }, moonL);
    const mg = svg("g", { filter: "url(#card1)" }, moonL);
    svg("circle", { cx: 610, cy: 132, r: 52, fill: "#f3e7c4" }, mg);
    [[592, 118, 9], [628, 144, 7], [604, 154, 5], [632, 114, 4.5]].forEach(([x, y, r]) => svg("circle", { cx: x, cy: y, r, fill: "#e0cfa2" }, mg));
    const cloudL = mover(w.layer(0.3));
    for (let k = -2; k <= 3; k++) [[0, 70, 1.4], [520, 210, 1.0]].forEach(([x, y, sc]) => {
      const g = svg("g", { filter: "url(#card1)", transform: `translate(${x + k * 900} ${y}) scale(${sc} ${sc * 0.55})` }, cloudL);
      svg("path", { d: "M -160 30 Q -150 4 -110 8 Q -90 -26 -40 -18 Q -6 -48 40 -22 Q 84 -36 110 0 Q 160 0 164 30 Z", fill: "#6a5d95", opacity: 0.85 }, g);
    });

    /* ---- far skyline (static) with its own small window layer */
    const farL = w.layer(0.4);
    const farD = "M -300 1000 V 330 H -170 V 250 H -60 V 300 H 60 V 210 H 150 V 290 H 330 V 240 H 420 V 180 H 470 V 240 H 560 V 320 H 760 V 260 H 900 V 200 H 980 V 290 H 1160 V 230 H 1300 V 310 H 1480 V 160 H 1560 V 250 H 1720 V 280 H 1860 V 200 H 1960 V 300 H 2100 V 240 H 2220 V 1000 Z";
    svg("path", { d: farD, fill: "#3b3568", filter: "url(#card1)" }, farL);
    const farShade = w.layer(0.4);
    svg("path", { d: farD, fill: "#0b1026", opacity: 0.55 }, farShade);
    const farWinL = w.layer(0.4);
    const rf = PT.rng(77);
    const farWins = [];
    for (let i = 0; i < 70; i++) {
      const x = -280 + rf() * 2480, y = 230 + rf() * 260;
      farWins.push({ el: R(farWinL, Math.round(x / 22) * 22, Math.round(y / 30) * 30, 9, 13, rf() < 0.2 ? "#ffe6a8" : "#ffcf7a"), thr: 0.03 + rf() * 0.96, on: -1 });
    }

    /* ---- main facades (static), each a card with brick or clapboard, cornice, window recesses */
    const LF = w.layer(0.7);
    const B = [
      { x0: -300, x1: 400, top: 150, c: C.wood, tr: "#c9a27a", tex: "brick", sign: "BOOKS" },
      { x0: 400, x1: 820, top: 300, c: C.plumDk, tr: "#c7a4c8" },
      { x0: 820, x1: 1500, top: 120, c: "#2c6b6a", tr: "#a9d2c8" },
      { x0: 1500, x1: 2220, top: -40, c: C.trim, tr: "#b4c2e6", tex: "brick", sign: "BAKERY" },
    ];
    B.forEach((b) => {
      const g = svg("g", { filter: "url(#card2)" }, LF);
      R(g, b.x0, b.top, b.x1 - b.x0, 860 - b.top, b.c);
      if (b.tex) R(g, b.x0, b.top, b.x1 - b.x0, 860 - b.top, `url(#${id}${b.tex})`);
      R(g, b.x0 - 10, b.top - 6, b.x1 - b.x0 + 20, 26, b.tr, { rx: 3 });
      for (let x = b.x0 + 14; x < b.x1 - 10; x += 34) R(g, x, b.top + 20, 16, 10, b.tr, { opacity: 0.85 });
      R(g, b.x0, 462, b.x1 - b.x0, 14, b.tr, { opacity: 0.9 });
    });
    R(LF, 836, 476, 648, 360, "#24585a", { filter: "url(#card1)" });
    // rooftop furniture: water tower on A, chimney and aerial on B, parapet on C
    const roof = svg("g", { filter: "url(#card2)" }, LF);
    [[70, 150], [110, 150], [180, 150], [214, 150]].forEach(([x, y]) => R(roof, x, 100, 7, y - 100, C.ink));
    R(roof, 64, 118, 160, 6, C.ink);
    R(roof, 78, 30, 132, 76, C.wood, { rx: 6 });
    [46, 72, 96].forEach((y) => R(roof, 76, y, 136, 4, C.woodDk));
    svg("path", { d: "M 72 32 L 144 -4 L 216 32 Z", fill: C.woodDk }, roof);
    R(roof, 690, 232, 46, 70, "#4b3352"); R(roof, 684, 226, 58, 12, "#3b2842");
    svg("path", { d: "M 540 300 V 214 M 520 236 H 560 M 526 252 H 554", stroke: C.ink, "stroke-width": 4, fill: "none", "stroke-linecap": "round" }, roof);
    R(roof, 1090, 82, 140, 44, "#2c6b6a"); R(roof, 1082, 74, 156, 14, "#a9d2c8", { rx: 3 });
    // ground floors: A closed bookshop (shutter), B residential door and stoop, D closed bakery
    const gf = svg("g", { filter: "url(#card2)" }, LF);
    R(gf, -80, 494, 470, 54, C.mustardDk, { rx: 3 });
    T(gf, 155, 535, "BOOKS", { "font-family": "Bricolage", "font-weight": 800, "font-size": 40, "letter-spacing": 10, fill: C.cream });
    R(gf, -200, 568, 540, 262, "#6c7896");
    R(gf, -200, 568, 540, 262, `url(#${id}rib)`);
    R(gf, -210, 560, 560, 16, "#4f5a78", { rx: 3 });
    R(gf, 50, 812, 40, 8, C.ink, { rx: 3 });
    R(gf, 560, 600, 100, 226, "#1f5f5a"); R(gf, 552, 592, 116, 14, "#c7a4c8", { rx: 3 });
    svg("path", { d: "M 572 650 A 38 38 0 0 1 648 650 Z", fill: "#ffcf7a" }, gf);
    svg("path", { d: "M 610 650 V 614 M 610 650 L 584 626 M 610 650 L 636 626", stroke: "#1f5f5a", "stroke-width": 3 }, gf);
    R(gf, 572, 660, 34, 140, "#24706a", { rx: 3 }); R(gf, 614, 660, 34, 140, "#24706a", { rx: 3 });
    svg("circle", { cx: 640, cy: 730, r: 5, fill: "url(#brass)" }, gf);
    R(gf, 540, 806, 140, 14, "#8e7f8e"); R(gf, 528, 818, 164, 14, "#a094a0");
    R(gf, 1546, 494, 640, 54, "#efe0c4", { rx: 3 });
    T(gf, 1725, 535, "BAKERY", { "font-family": "Fraunces", "font-weight": 900, "font-size": 42, "letter-spacing": 6, fill: C.trim });
    R(gf, 1560, 580, 330, 220, C.glass);
    [640, 712].forEach((y) => R(gf, 1570, y, 310, 6, "#2a3150"));
    [[1600, 632, 34], [1660, 628, 40], [1740, 704, 36], [1800, 632, 30]].forEach(([x, y, r]) => svg("path", { d: `M ${x - r / 2} ${y} Q ${x} ${y - r * 0.8} ${x + r / 2} ${y} Z`, fill: "#232a48" }, gf));
    R(gf, 1554, 574, 342, 12, "#b4c2e6"); R(gf, 1554, 798, 342, 14, "#b4c2e6");
    R(gf, 1940, 580, 110, 246, "#2a3150"); R(gf, 1932, 572, 126, 12, "#b4c2e6");
    svg("circle", { cx: 2030, cy: 710, r: 5, fill: "url(#brass)" }, gf);
    const bakAw = svg("g", { filter: "url(#card2)" }, LF);
    for (let i = 0; i < 10; i++) svg("path", { d: `M ${1550 + i * 35} 552 h 35 v 34 q -17.5 14 -35 0 Z`, fill: i % 2 ? C.cream : C.mustard }, bakAw);

    /* ---- windows: dark glass on the facade, warm interiors on their own layer */
    const wins = [];
    const grid = (x0, dx, n, ys, ww = 62, wh = 92, b) => ys.forEach((y) => { for (let i = 0; i < n; i++) wins.push({ x: x0 + i * dx - ww / 2, y, w: ww, h: wh, b }); });
    grid(-245, 110, 6, [196, 326], 62, 92, B[0]);
    grid(495, 115, 3, [340], 62, 92, B[1]);
    wins.push({ x: 440, y: 640, w: 80, h: 80, b: B[1] }, { x: 700, y: 640, w: 80, h: 80, b: B[1] });
    grid(900, 130, 5, [166, 306], 64, 96, B[2]);
    grid(1580, 130, 5, [20, 160, 300], 64, 96, B[3]);
    // one filtered group per building: a single group spanning every facade is re-filtered by Chrome on every frame
    const fws = new Map(B.map((b) => [b, svg("g", { filter: "url(#card1)" }, LF)]));
    wins.forEach((q) => {
      const fw = fws.get(q.b);
      R(fw, q.x - 7, q.y - 12, q.w + 14, 12, q.b.tr);
      R(fw, q.x, q.y, q.w, q.h, C.glass);
      svg("path", { d: `M ${q.x + q.w * 0.15} ${q.y + q.h} L ${q.x + q.w * 0.7} ${q.y} L ${q.x + q.w} ${q.y} L ${q.x + q.w * 0.45} ${q.y + q.h} Z`, fill: "#ffffff", opacity: 0.05 }, fw);
      R(fw, q.x + q.w / 2 - 2, q.y, 4, q.h, q.b.c);
      R(fw, q.x - 9, q.y + q.h, q.w + 18, 11, q.b.tr, { rx: 2 });
    });
    const shadeL = w.layer(0.7);
    svg("path", { d: B.map((b) => `M ${b.x0 - 10} ${b.top - 6} H ${b.x1 + 10} V 860 H ${b.x0 - 10} Z`).join(" ") + " M 1082 74 H 1238 V 126 H 1082 Z", fill: "#0b1026", opacity: 0.5 }, shadeL);
    const LW = w.layer(0.7);
    const rw = PT.rng(13);
    const warmC = ["#ffd27a", "#ffc46b", "#ffe2a0", "#f7b05a", "#ffd890"];
    const curtC = [C.tomato, C.teal, C.plum, C.mustardDk, C.sky];
    const TV = 12 + 5 + 3;   // building C (after A and B), top row, 4th window: the last light on
    wins.forEach((q, i) => {
      const g = svg("g", {}, LW);
      const tv = i === TV, kind = tv ? -1 : Math.floor(rw() * 6);
      R(g, q.x, q.y, q.w, q.h, tv ? "#9fbff2" : warmC[Math.floor(rw() * warmC.length)]);
      R(g, q.x, q.y + q.h * 0.62, q.w, q.h * 0.38, "#000", { opacity: 0.08 });
      const cx = q.x + q.w / 2, by = q.y + q.h;
      if (kind === 0) { R(g, q.x, q.y, q.w, q.h * (0.3 + rw() * 0.25), "#f3e2c0"); R(g, q.x + q.w * 0.7, q.y, 1.5, q.h * 0.55, "#8a7560"); }
      if (kind === 1) { const c = curtC[Math.floor(rw() * curtC.length)]; svg("path", { d: `M ${q.x} ${q.y} h ${q.w * 0.3} q -6 ${q.h * 0.5} ${-q.w * 0.12} ${q.h} h ${-q.w * 0.18} Z M ${q.x + q.w} ${q.y} h ${-q.w * 0.3} q 6 ${q.h * 0.5} ${q.w * 0.12} ${q.h} h ${q.w * 0.18} Z`, fill: c }, g); }
      if (kind === 2) [[-10, -14], [0, -24], [10, -16]].forEach(([dx, h]) => svg("ellipse", { cx: cx + dx, cy: by + h / 2 - 4, rx: 7, ry: -h / 2 + 4, fill: "#2f5a3e" }, g));
      if (kind === 3) { R(g, cx - 1, q.y, 2, q.h * 0.28, "#5b4636"); svg("path", { d: `M ${cx - 12} ${q.y + q.h * 0.4} Q ${cx} ${q.y + q.h * 0.2} ${cx + 12} ${q.y + q.h * 0.4} Z`, fill: "#5b4636" }, g); }
      if (kind === 4) { svg("circle", { cx: cx + 10, cy: by - 40, r: 10, fill: "#6b4b3e", opacity: 0.75 }, g); svg("path", { d: `M ${cx - 8} ${by} Q ${cx + 10} ${by - 40} ${cx + 28} ${by} Z`, fill: "#6b4b3e", opacity: 0.75 }, g); }
      if (kind === 5) R(g, q.x + q.w * 0.2, q.y + q.h * 0.2, q.w * 0.3, q.h * 0.24, "#c98a55", { stroke: "#7b4a36", "stroke-width": 2 });
      if (tv) { R(g, q.x + 8, by - 30, q.w - 16, 24, "#3a4a78"); svg("circle", { cx: cx - 6, cy: by - 40, r: 9, fill: "#2c3658" }, g); }
      R(g, q.x + q.w / 2 - 2, q.y, 4, q.h, q.b.c);
      q.g = g; q.thr = tv ? 0.025 : 0.06 + rw() * 0.93; q.on = -1;
    });
    const tvL = w.layer(0.7);
    const tvq = wins[TV];
    const tvFlash = R(tvL, tvq.x, tvq.y, tvq.w, tvq.h, "#eaf2ff");
    // fire escape on D, in front of its windows
    const fe = svg("g", { filter: "url(#lift)", stroke: C.ink, fill: "none", "stroke-width": 4, "stroke-linecap": "round" }, w.layer(0.7));
    [124, 264, 404].forEach((y) => {
      svg("path", { d: `M 1680 ${y} H 1870 M 1680 ${y - 36} H 1870 M 1680 ${y} V ${y - 36} M 1870 ${y} V ${y - 36}`, "stroke-width": 5 }, fe);
      for (let x = 1696; x < 1870; x += 16) svg("path", { d: `M ${x} ${y} V ${y - 36}`, "stroke-width": 2 }, fe);
    });
    [[124, 264], [264, 404]].forEach(([a, b]) => svg("path", { d: `M 1700 ${a} L 1850 ${b - 2}`, "stroke-width": 5 }, fe));
    svg("path", { d: "M 1850 404 V 470", "stroke-width": 4 }, fe);

    /* ---- the diner: warm interior, counter and stools, fascia, checker kick plate, door */
    const LD = w.layer(0.7);
    const dn = svg("g", { filter: "url(#card2)" }, LD);
    R(dn, 846, 486, 628, 62, C.tomato, { rx: 4 });
    T(dn, 1076, 536, "DINER", { "font-family": "Fraunces", "font-weight": 900, "font-size": 52, "letter-spacing": 12, fill: C.cream });
    [[912, 516], [1240, 516]].forEach(([x, y]) => svg("path", { d: `M ${x} ${y - 14} L ${x + 4} ${y - 4} L ${x + 14} ${y} L ${x + 4} ${y + 4} L ${x} ${y + 14} L ${x - 4} ${y + 4} L ${x - 14} ${y} L ${x - 4} ${y - 4} Z`, fill: C.mustard }, dn));
    const W0 = { x: 862, y: 584, w: 440, h: 214 };
    R(dn, W0.x, W0.y, W0.w, W0.h, `url(#${id}diner)`);
    R(dn, W0.x, W0.y + 96, W0.w, 12, C.teal, { opacity: 0.55 });
    R(dn, 1200, 664, 92, 6, "#c98a55");
    [1214, 1240, 1266].forEach((x) => svg("path", { d: `M ${x - 11} 664 Q ${x} 644 ${x + 11} 664 Z`, fill: "#e9c08a" }, dn));
    const cook = svg("g", { transform: "translate(96 0)" }, dn);
    svg("path", { d: "M 1006 720 Q 1010 662 1044 660 Q 1078 662 1082 720 Z", fill: C.cream }, cook);
    svg("circle", { cx: 1044, cy: 640, r: 22, fill: C.kraft }, cook);
    R(cook, 1024, 604, 40, 22, "#ffffff", { rx: 8 }); R(cook, 1020, 618, 48, 8, "#f0ece4", { rx: 3 });
    svg("path", { d: "M 1034 640 q 4 4 8 0 M 1048 640 q 4 4 8 0", stroke: C.ink, "stroke-width": 2.4, fill: "none", "stroke-linecap": "round" }, cook);
    R(dn, W0.x, 714, W0.w, 12, C.cream);
    R(dn, W0.x, 724, W0.w, 74, C.tomato);
    R(dn, W0.x, 740, W0.w, 5, "#ffffff", { opacity: 0.35 });
    svg("path", { d: "M 1220 714 Q 1220 676 1250 676 Q 1280 676 1280 714 Z", fill: "#ffffff", opacity: 0.4, stroke: "#ffffff", "stroke-width": 2 }, dn);
    svg("path", { d: "M 1230 714 L 1250 700 L 1270 714 Z", fill: "#d98a4a" }, dn);
    svg("path", { d: "M 930 714 v -26 q 0 -8 10 -8 h 16 q 10 0 10 8 v 26 Z", fill: C.ink }, dn);
    R(dn, 936, 690, 24, 10, "#7b4a36");
    [900, 980, 1060, 1140, 1220, 1280].forEach((x) => { R(dn, x - 3, 760, 6, 38, "#c9ccd6"); svg("ellipse", { cx: x, cy: 758, rx: 22, ry: 7, fill: C.teal }, dn); });
    [[1214], [1272]].forEach(([x]) => { R(dn, x - 1, W0.y, 2, 22, C.ink); svg("path", { d: `M ${x - 18} ${W0.y + 34} Q ${x} ${W0.y + 12} ${x + 18} ${W0.y + 34} Z`, fill: C.teal }, dn); svg("circle", { cx: x, cy: W0.y + 36, r: 5, fill: "#fff6d8" }, dn); });
    svg("path", { d: `M ${W0.x + 40} ${W0.y + W0.h} L ${W0.x + 150} ${W0.y} L ${W0.x + 200} ${W0.y} L ${W0.x + 90} ${W0.y + W0.h} Z M ${W0.x + 300} ${W0.y + W0.h} L ${W0.x + 380} ${W0.y} L ${W0.x + 400} ${W0.y} L ${W0.x + 320} ${W0.y + W0.h} Z`, fill: "#ffffff", opacity: 0.1 }, dn);
    svg("path", { d: `M ${W0.x - 8} ${W0.y - 8} h ${W0.w + 16} v ${W0.h + 16} h ${-W0.w - 16} Z M ${W0.x} ${W0.y} v ${W0.h} h ${W0.w} v ${-W0.h} Z M ${W0.x + W0.w / 2 - 4} ${W0.y} h 8 v ${W0.h} h -8 Z`, fill: C.cream, "fill-rule": "evenodd" }, dn);
    R(dn, 852, 806, 460, 26, `url(#${id}check)`);
    R(dn, 1322, 570, 136, 262, C.cream);
    R(dn, 1334, 582, 112, 238, C.mustardDk);
    R(dn, 1346, 596, 88, 140, `url(#${id}diner)`);
    R(dn, 1346, 664, 88, 6, C.mustardDk);
    R(dn, 1424, 742, 10, 34, "url(#brass)", { rx: 4 });
    // OPEN 24 H: paper sign on two chains in the window; it sways, and its tubes flicker on their own layer
    const SG = { x: 880, y: 600, w: 168, h: 82, px: 964, py: W0.y };
    const signL = w.layer(0.7), signOnL = w.layer(0.7);
    const sign = svg("g", { filter: "url(#card1)" }, signL);
    svg("path", { d: `M ${SG.x + 22} ${W0.y} L ${SG.x + 30} ${SG.y + 4} M ${SG.x + SG.w - 22} ${W0.y} L ${SG.x + SG.w - 30} ${SG.y + 4}`, stroke: "#8a8478", "stroke-width": 2, "stroke-dasharray": "3 2" }, sign);
    R(sign, SG.x, SG.y, SG.w, SG.h, C.ink, { rx: 10 });
    const tube = (g, fill, stroke, sw) => {
      T(g, SG.x + SG.w / 2, SG.y + 44, "OPEN", { "font-family": "Bricolage", "font-weight": 800, "font-size": 40, "letter-spacing": 4, fill, stroke, "stroke-width": sw });
      T(g, SG.x + SG.w / 2, SG.y + 72, "24 H", { "font-family": "Bricolage", "font-weight": 800, "font-size": 24, "letter-spacing": 6, fill: fill === "none" ? "none" : "#c98e3a", stroke: stroke === "none" ? "none" : C.mustard, "stroke-width": sw });
    };
    tube(sign, "#6e3138", "none", 0);
    const signOn = svg("g", { filter: "url(#lift)" }, signOnL);
    tube(signOn, "#fff0ea", "#ff4f45", 3.2);
    const neonGlowL = w.layer(0.7, { mixBlendMode: "screen" });
    const neonGlow = svg("g", {}, neonGlowL);
    svg("ellipse", { cx: SG.x + SG.w / 2, cy: SG.y + 40, rx: 170, ry: 110, fill: `url(#${id}neon)` }, neonGlow);
    const ng2 = svg("g", { filter: "url(#glow)" }, neonGlow);
    tube(ng2, "#ff5a4a", "#ff5a4a", 6);
    // striped awning over the window
    const LA = w.layer(0.74);
    const aw = svg("g", { filter: "url(#card3)" }, LA);
    R(aw, 850, 548, 464, 10, C.ink, { rx: 3 });
    for (let i = 0; i < 12; i++) svg("path", { d: `M ${852 + i * 38.3} 556 h 38.3 v 30 q -19 14 -38.3 0 Z`, fill: i % 2 ? C.cream : C.tomato }, aw);

    /* ---- sidewalk, hydrant (static) */
    const LS = w.layer(0.9);
    R(LS, -300, 826, 2520, 480, C.walk, { filter: "url(#card1)" });
    const joints = svg("g", { stroke: "#4c4556", "stroke-width": 3 }, LS);
    for (let x = -300; x < 2220; x += 150) svg("line", { x1: x, y1: 830, x2: x - 40, y2: 930 }, joints);
    svg("line", { x1: -300, y1: 876, x2: 2220, y2: 876, "stroke-width": 2, opacity: 0.6 }, joints);
    R(LS, -300, 926, 2520, 16, "#8a8090", { filter: "url(#card1)" });
    R(LS, -300, 940, 2520, 18, "#3f3a48");
    const hyd = svg("g", { filter: "url(#card2)" }, LS);
    R(hyd, 1590, 846, 40, 64, C.tomato, { rx: 8 }); R(hyd, 1582, 840, 56, 12, "#c94a26", { rx: 5 });
    svg("path", { d: "M 1592 842 Q 1610 812 1628 842 Z", fill: C.tomato }, hyd);
    R(hyd, 1576, 866, 68, 14, "#c94a26", { rx: 6 }); R(hyd, 1584, 904, 52, 10, "#c94a26", { rx: 3 });
    const bin = svg("g", { filter: "url(#card2)" }, LS);
    svg("path", { d: "M 1990 820 H 2070 L 2062 910 H 1998 Z", fill: "#3a4a5e" }, bin);
    R(bin, 1984, 812, 92, 14, "#4c5d74", { rx: 5 });
    [2010, 2030, 2050].forEach((x) => R(bin, x - 2, 830, 4, 70, "#2c3a4c"));

    /* ---- the diner's light on the street, and the neon's glow (screen) */
    const Lg = w.layer(0.8, { mixBlendMode: "screen" });
    svg("ellipse", { cx: 1080, cy: 690, rx: 420, ry: 230, fill: `url(#${id}bloom)` }, Lg);
    svg("polygon", { points: "862,800 1302,800 1440,960 760,960", fill: `url(#${id}spill)`, filter: "url(#glow)" }, Lg);
    svg("polygon", { points: "1346,820 1434,820 1500,940 1320,940", fill: `url(#${id}spill)`, opacity: 0.8, filter: "url(#glow)" }, Lg);

    /* ---- street lamp */
    const LP = { x: 700, y: 932 };
    const LL = w.layer(0.95);
    const post = svg("g", { filter: "url(#card2)" }, LL);
    R(post, LP.x - 18, LP.y - 64, 36, 66, C.navy, { rx: 6 });
    R(post, LP.x - 24, LP.y - 10, 48, 12, C.ink, { rx: 4 });
    R(post, LP.x - 7, 380, 14, LP.y - 440, C.navy);
    R(post, LP.x - 14, 520, 28, 12, C.ink, { rx: 4 });
    R(post, LP.x - 12, 370, 24, 16, C.ink, { rx: 3 });
    svg("path", { d: `M ${LP.x - 32} 372 L ${LP.x + 32} 372 L ${LP.x + 24} 306 L ${LP.x - 24} 306 Z`, fill: "#4a4f66" }, post);
    svg("path", { d: `M ${LP.x - 40} 310 L ${LP.x + 40} 310 L ${LP.x} 278 Z`, fill: C.ink }, post);
    svg("circle", { cx: LP.x, cy: 274, r: 7, fill: "url(#brass)" }, post);
    const bulbL = w.layer(0.95);
    svg("path", { d: `M ${LP.x - 26} 368 L ${LP.x + 26} 368 L ${LP.x + 20} 312 L ${LP.x - 20} 312 Z`, fill: "#fff1c2" }, bulbL);
    svg("path", { d: `M ${LP.x - 1.5} 312 V 368 M ${LP.x - 24} 340 H ${LP.x + 24}`, stroke: C.ink, "stroke-width": 3 }, bulbL);

    /* ---- road and the steaming manhole */
    const LR = w.layer(1.05);
    R(LR, -300, 954, 2520, 360, C.road, { filter: "url(#card1)" });
    const lane = svg("g", { fill: "#e9dcc4", opacity: 0.75 }, LR);
    for (let x = -300; x < 2220; x += 220) R(lane, x, 1058, 120, 10, "#e9dcc4", { rx: 4 });
    svg("ellipse", { cx: 1250, cy: 1004, rx: 64, ry: 14, fill: "#1a1d2c", stroke: "#3a3f56", "stroke-width": 4 }, LR);
    const steamL = w.layer(1.05);
    const puffs = [0, 1, 2, 3, 4].map(() => svg("ellipse", { fill: `url(#${id}steam)`, opacity: 0 }, steamL));

    /* ---- lamp glow (screen) */
    const Llg = w.layer(0.95, { mixBlendMode: "screen" });
    svg("circle", { cx: LP.x, cy: 340, r: 300, fill: `url(#${id}lamp)` }, Llg);
    svg("ellipse", { cx: LP.x, cy: 912, rx: 330, ry: 70, fill: `url(#${id}pool)` }, Llg);
    svg("circle", { cx: LP.x, cy: 340, r: 46, fill: "#ffe2b0", opacity: 0.6, filter: "url(#glow)" }, Llg);

    /* ---- bus stop with a bench (puppet plane, behind the cast) */
    const BS = { x0: 168, x1: 512, seat: 905 - 64 * 1.05 };
    const LB = w.layer(1.0);
    const sh = svg("g", { filter: "url(#card2)" }, LB);
    R(sh, BS.x0 + 18, 630, BS.x1 - BS.x0 - 36, 220, "#9cc3e6", { opacity: 0.28 });
    R(sh, 232, 650, 136, 180, `url(#${id}ad)`, { rx: 3 });
    svg("path", { d: "M 318 690 A 26 26 0 1 1 296 730 A 20 20 0 1 0 318 690 Z", fill: "#f3e7c4" }, sh);
    [[262, 690], [348, 742], [270, 760]].forEach(([x, y]) => svg("circle", { cx: x, cy: y, r: 2.5, fill: C.cream }, sh));
    T(sh, 300, 796, "sleep well", { "font-family": "Fraunces", "font-style": "italic", "font-weight": 600, "font-size": 22, fill: C.cream });
    R(sh, 238, 806, 124, 3, C.mustard, { opacity: 0.8 });
    R(sh, BS.x0, 612, 14, 293, C.ink); R(sh, BS.x1 - 14, 612, 14, 293, C.ink);
    R(sh, BS.x0 - 14, 600, BS.x1 - BS.x0 + 28, 24, C.navy, { rx: 4 });
    R(sh, BS.x0 - 14, 620, BS.x1 - BS.x0 + 28, 6, C.mustard);
    R(sh, 210, BS.seat, 260, 14, C.wood, { rx: 5 });
    R(sh, 222, BS.seat + 14, 10, 905 - BS.seat - 12, C.ink); R(sh, 448, BS.seat + 14, 10, 905 - BS.seat - 12, C.ink);
    const stopSign = svg("g", { filter: "url(#card2)" }, LB);
    R(stopSign, 560, 600, 8, 306, "#8a8090");
    svg("circle", { cx: 564, cy: 594, r: 34, fill: C.sky }, stopSign);
    svg("circle", { cx: 564, cy: 594, r: 27, fill: "none", stroke: C.cream, "stroke-width": 3 }, stopSign);
    T(stopSign, 564, 603, "BUS", { "font-family": "Bricolage", "font-weight": 800, "font-size": 21, fill: C.cream });
    R(stopSign, 546, 640, 36, 52, C.cream, { rx: 3 });
    [652, 664, 676].forEach((y) => R(stopSign, 552, y, 24, 4, C.ink, { opacity: 0.5 }));
    const adGlowL = w.layer(1.0, { mixBlendMode: "screen" });
    svg("rect", { x: 222, y: 640, width: 156, height: 200, fill: "#7c8fd0", opacity: 0.35, filter: "url(#glow)" }, adGlowL);

    /* ---- cast */
    const P = w.layer(1.0);
    const people = cast.map((c) => ({ c, p: PT.puppet(P, { shirt: c.shirt, pants: c.pants, hair: c.hair, hairStyle: c.hairStyle || "short", glasses: c.glasses }) }));

    /* ---- the taxi (moves as a composited layer; only its wheels repaint) and its headlight */
    const carL = mover(w.layer(1.12));
    const beamL = mover(w.layer(1.12, { mixBlendMode: "screen" }));
    const CY = 1036;
    svg("ellipse", { cx: 0, cy: CY + 2, rx: 220, ry: 12, fill: C.ink, opacity: 0.45 }, carL);
    const body = svg("g", { filter: "url(#card2)" }, carL);
    svg("path", { d: `M -214 ${CY - 26} Q -220 ${CY - 70} -190 ${CY - 82} L -120 ${CY - 92} L -84 ${CY - 146} Q -76 ${CY - 154} -60 ${CY - 154} L 72 ${CY - 154} Q 90 ${CY - 154} 100 ${CY - 144} L 142 ${CY - 94} L 196 ${CY - 84} Q 222 ${CY - 76} 218 ${CY - 26} Z`, fill: C.mustard }, body);
    svg("path", { d: `M -72 ${CY - 94} L -50 ${CY - 140} L -8 ${CY - 140} L -8 ${CY - 94} Z M 6 ${CY - 94} L 6 ${CY - 140} L 70 ${CY - 140} Q 80 ${CY - 140} 86 ${CY - 132} L 120 ${CY - 94} Z`, fill: "#1b2340" }, body);
    svg("path", { d: `M -40 ${CY - 96} L -22 ${CY - 138} L -12 ${CY - 138} L -30 ${CY - 96} Z M 30 ${CY - 96} L 46 ${CY - 138} L 58 ${CY - 138} L 42 ${CY - 96} Z`, fill: "#ffffff", opacity: 0.16 }, body);
    for (let i = 0; i < 18; i++) R(body, -180 + i * 20, CY - 72 + (i % 2) * 8, 10, 8, C.ink, { opacity: 0.85 });
    R(body, -216, CY - 36, 52, 14, C.ink, { rx: 5 }); R(body, 168, CY - 36, 52, 14, C.ink, { rx: 5 });
    R(body, -32, CY - 176, 64, 24, C.cream, { rx: 4 });
    T(body, 0, CY - 158, "TAXI", { "font-family": "Bricolage", "font-weight": 800, "font-size": 16, "letter-spacing": 2, fill: C.ink });
    R(body, 196, CY - 70, 20, 16, "#fff6d8", { rx: 6 });
    R(body, -218, CY - 70, 12, 16, C.tomato, { rx: 4 });
    R(body, -6, CY - 92, 4, 50, "#000", { opacity: 0.12 });
    const wheels = [-130, 130].map((x) => {
      const g = svg("g", { filter: "url(#lift)" }, carL);
      svg("circle", { cx: x, cy: CY - 28, r: 30, fill: C.ink }, g);
      svg("circle", { cx: x, cy: CY - 28, r: 15, fill: "#c9ccd6" }, g);
      const sp = svg("path", { d: `M ${x} ${CY - 41} V ${CY - 15} M ${x - 13} ${CY - 28} H ${x + 13}`, stroke: "#6c7086", "stroke-width": 3 }, g);
      return { sp, x };
    });
    svg("polygon", { points: `214,${CY - 72} 760,${CY - 150} 760,${CY + 40} 214,${CY - 52}`, fill: `url(#${id}beam)`, filter: "url(#glow)" }, beamL);
    svg("circle", { cx: 210, cy: CY - 62, r: 26, fill: "#fff1c2", opacity: 0.7, filter: "url(#glow)" }, beamL);

    /* ---- out-of-focus foreground: a street-tree branch (top right) and a traffic cone (bottom left) */
    const Lfg = w.layer(1.5);
    const br = svg("g", { filter: "url(#dof)" }, Lfg);
    svg("path", { d: "M 2240 -60 Q 2000 40 1760 60", stroke: "#2a2230", "stroke-width": 22, fill: "none", "stroke-linecap": "round" }, br);
    [[1780, 60, 20, 1.0], [1860, 30, -30, 1.1], [1950, 70, 40, 1.2], [2040, 10, -10, 1.3], [1700, 90, 60, 0.9], [1900, 120, 80, 1.0], [2120, 60, 30, 1.2]].forEach(([x, y, a, s]) =>
      svg("path", { d: "M 0 0 C -30 40 -20 110 10 150 C 40 110 40 40 0 0 Z", fill: C.leaf, transform: `translate(${x} ${y}) rotate(${a}) scale(${s})` }, br));
    const cone = svg("g", { filter: "url(#dof)" }, Lfg);
    svg("path", { d: "M 40 900 L 100 900 L 150 1110 L -10 1110 Z", fill: C.tomato }, cone);
    svg("path", { d: "M 27 955 L 113 955 L 123 995 L 17 995 Z M 6 1040 L 134 1040 L 142 1072 L -2 1072 Z", fill: C.cream }, cone);
    R(cone, -50, 1100, 240, 40, "#c94a26", { rx: 6 });
    w.overlay("vignette");

    const anchors = {
      diner: { x: 1230, y: 600, z: 1.0 },
      lamp: { x: 640, y: 560, z: 1.0 },
      windows: { x: 1200, y: 300, z: 1.15 },
      sidewalk: { x: 1180, y: 905 },
      bench: { x: 340, y: 905, s: 1.05 },
    };

    function update(t, st = {}) {
      const k = clamp(st.sky ?? 0.6);
      // a sky hidden under an opaque one is switched off, so the compositor skips it
      op(skies[0], k >= 0.5 ? 0 : 1); op(skies[1], k >= 1 ? 0 : clamp(k * 2)); op(skies[2], clamp(k * 2 - 1));
      op(starL.parentNode, clamp(k * 1.8 - 0.5)); op(twL.parentNode, clamp(k * 1.8 - 0.6));
      twinkles.forEach((s) => s.el.setAttribute("opacity", (0.35 + 0.65 * Math.max(0, Math.sin(t * s.f * 3 + s.ph))).toFixed(2)));
      op(moonL.parentNode, 0.45 + 0.55 * k);
      cloudL.style.transform = `translate(${((t * 7) % 900).toFixed(1)}px, 0px)`;
      op(shadeL.parentNode, 0.25 + 0.75 * k); op(farShade.parentNode, 0.4 + 0.6 * k);
      // windows: each one has a fixed threshold; only the ones that change are touched
      const lights = clamp(st.lights ?? 0.9 - 0.65 * k);
      wins.forEach((q) => { const on = Math.round(clamp((lights - q.thr) / 0.012) * 20) / 20; if (on !== q.on) { q.g.style.opacity = on; q.on = on; } });
      farWins.forEach((q) => { const on = lights > q.thr ? 1 : 0; if (on !== q.on) { q.el.style.opacity = on; q.on = on; } });
      const tvOn = wins[TV].on;
      op(tvL.parentNode, tvOn * (0.18 + 0.22 * Math.abs(Math.sin(t * 7.3) * Math.sin(t * 2.9 + 1)) + 0.12 * (Math.sin(t * 1.7) > 0.6 ? 1 : 0)));
      // neon: soft flicker with a brief double-dip every few seconds, and a slow sway on its chains
      const ph = (t * 0.29) % 1, dip = ph < 0.02 ? 0.35 : ph < 0.035 ? 0.85 : ph < 0.05 ? 0.5 : 1;
      const nv = clamp(st.neon ?? 1) * dip * (0.9 + 0.06 * Math.sin(t * 23.1) * Math.sin(t * 7.7) + 0.04 * Math.sin(t * 57));
      op(signOnL.parentNode, nv); op(neonGlowL.parentNode, nv);
      const sway = `rotate(${(1.6 * Math.sin(t * 1.15)).toFixed(2)} ${SG.px} ${SG.py})`;
      [sign, signOn, neonGlow].forEach((g) => g.setAttribute("transform", sway));
      const lamp = clamp(st.lamp ?? 1);
      op(Llg.parentNode, lamp * (0.86 + 0.03 * Math.sin(t * 9.1) * Math.sin(t * 3.3))); op(bulbL.parentNode, lamp > 0.2 ? 1 : 0.0);
      puffs.forEach((e, i) => {
        const p = (t * 0.3 + i / 5) % 1;
        e.setAttribute("cx", (1250 + 26 * Math.sin(p * 5 + i * 1.3) + 40 * p).toFixed(1)); e.setAttribute("cy", (998 - 210 * p).toFixed(1));
        e.setAttribute("rx", (34 + 70 * p).toFixed(1)); e.setAttribute("ry", (20 + 40 * p).toFixed(1));
        e.setAttribute("opacity", (0.42 * Math.sin(Math.PI * p)).toFixed(3));
      });
      const car = st.car ?? 0, show = car > 0 && car < 1;
      op(carL.parentNode, show ? 1 : 0); op(beamL.parentNode, show ? 0.55 + 0.45 * k : 0);
      if (show) {
        const x = lerp(-900, 2900, car);
        carL.style.transform = beamL.style.transform = `translate(${x.toFixed(1)}px, ${(1.2 * Math.sin(t * 17)).toFixed(2)}px)`;
        wheels.forEach((wh) => wh.sp.setAttribute("transform", `rotate(${((x / 30) * 57.3 % 360).toFixed(1)} ${wh.x} ${CY - 28})`));
      }
      people.forEach(({ c, p }, i) => p.pose(Object.assign({ x: c.x, y: c.y ?? 905, s: c.s ?? 1.05, hs: c.hs ?? 1, sit: c.sit ?? 0,
        bob: 1.8 * Math.sin(t * 1.9 + i), armF: -9, armB: 9, blink: K.blink(t, 1e9, 1.2 + i * 0.7) }, (st.cast || [])[i] || {})));
    }
    return { update, anchors, people };
  };
})();
