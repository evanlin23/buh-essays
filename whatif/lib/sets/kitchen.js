/* Kitchen set for Buh Essays (Paper Theatre). Load after kit.js:  <script src="../lib/sets/kitchen.js"></script>
 *
 * const kitchen = K.loc.kitchen(w, opts)      w = K.world(parent)
 *   opts.cast   [{x, y = 930, s = 1.3, hs = 1, sit = 0, seat, shirt, pants, hair, hairStyle, glasses}]
 *               Puppets on the puppet plane. `seat: 0 | 1` puts that person on a table chair (x, y from anchors.seats, sit 1).
 * kitchen.update(t, state)
 *   sky      0 day, 0.5 dusk, 1 night: crossfades the sky in the window over the sink (default 0)
 *   dim      0..1 room darkening for evening and night (default follows sky)
 *   lamp     0..1 pendant lamp over the table and its warm pool (default: comes on after dusk)
 *   flame    0..1 front burner flame under the kettle, flickering (default 0)
 *   steam    0..1 steam puffs from the kettle spout (default 0)
 *   clock    minutes since midnight on the wall clock (default 7:30)
 *   tag, tagText   label under the clock, like the bedroom's (opacity 0..1, string)
 *   cast     [pose overrides per person], e.g. [{look: 1, mouth: "o"}, {sit: 1, armF: -40}]
 * anchors (world units, for w.camera and for placing puppets):
 *   stove, sink, table, window, fridge, clock: {x, y}
 *   seats: [{x, y}, {x, y}]  where to stand a sitting puppet (seat tops at y 866)
 * Returns {update, anchors, people: [{c, p}]}.
 *
 * Planes: sky 0.3, town 0.42, back wall with window, tiles, upper cabinet, clock and shelf 0.7, floor 0.85,
 * fridge, stove and counter run 0.8, pendant 0.95, table and chairs 1.0 (behind the puppets), foreground 1.55.
 * Speed: big card shapes are on static layers; the flame, steam, lamp, valance, clock hands, clouds and puppets
 * each have their own small layer; the sky, dim and glows change by CSS opacity on whole layers.
 */
(function () {
  const { svg, clamp } = PT;

  K.loc.kitchen = (w, { cast = [] } = {}) => {
    const C = {
      wall: "#a6c9b5", wallDk: "#93b8a3", cream: "#f6ecd9", creamDk: "#e8d8b8", cab: "#f3e6cc", kraft: "#d4a777", ink: "#1c1f2e", ink2: "#2b2f45",
      wood: "#7b4a36", woodDk: "#5e3829", woodLt: "#9a6446", panel: "#6b3f2e", teal: "#2a9d8f", tomato: "#e4572e", mustard: "#f2b134",
      mustardDk: "#cf8f2e", plum: "#7b4b94", sky: "#5aa9e6", fridge: "#8cbfe0", fridgeDk: "#72a6ca", copper: "#c4703f", copperLt: "#d98b57",
      chrome: "#dcd5c8", grout: "#d6c29c", tile: "#f3e7d0", terra: "#b8664a", leaf: "#3f6b4e", leaf2: "#46775a",
    };
    const id = K.uid("kit");
    const R = (x, y, wd, ht, a, p) => svg("rect", Object.assign({ x, y, width: wd, height: ht }, a), p);
    const P = (d, a, p) => svg("path", Object.assign({ d }, a), p);
    const G = (a, p) => svg("g", a, p);
    const O = (cx, cy, r, a, p) => svg("circle", Object.assign({ cx, cy, r }, a), p);
    const E = (cx, cy, rx, ry, a, p) => svg("ellipse", Object.assign({ cx, cy, rx, ry }, a), p);
    const knob = (x, y, r, p) => O(x, y, r, { fill: "url(#brass)" }, p);
    const op = (el, v) => { const s = String(Math.round(v * 1000) / 1000); if (el.style.opacity !== s) el.style.opacity = s; };
    const pin = (s) => { s.style.willChange = "transform"; return s; };

    w.defs.innerHTML += `
      <linearGradient id="${id}day" gradientUnits="userSpaceOnUse" x1="0" y1="-160" x2="0" y2="780"><stop offset="0" stop-color="#5ea8e0"/><stop offset="0.55" stop-color="#a6d2ee"/><stop offset="1" stop-color="#eef0e2"/></linearGradient>
      <linearGradient id="${id}dusk" gradientUnits="userSpaceOnUse" x1="0" y1="-160" x2="0" y2="780"><stop offset="0" stop-color="#6d5a9c"/><stop offset="0.55" stop-color="#e98f7a"/><stop offset="1" stop-color="#ffd59a"/></linearGradient>
      <linearGradient id="${id}night" gradientUnits="userSpaceOnUse" x1="0" y1="-160" x2="0" y2="780"><stop offset="0" stop-color="#0e152d"/><stop offset="1" stop-color="#2b3a66"/></linearGradient>
      <radialGradient id="${id}sun"><stop offset="0" stop-color="#fff3c9" stop-opacity="0.9"/><stop offset="1" stop-color="#ffb46b" stop-opacity="0"/></radialGradient>
      <radialGradient id="${id}moonG"><stop offset="0" stop-color="#e9efff" stop-opacity="0.5"/><stop offset="1" stop-color="#e9efff" stop-opacity="0"/></radialGradient>
      <radialGradient id="${id}lamp"><stop offset="0" stop-color="#ffd890" stop-opacity="0.7"/><stop offset="0.4" stop-color="#ffb45e" stop-opacity="0.16"/><stop offset="1" stop-color="#ffb45e" stop-opacity="0"/></radialGradient>
      <linearGradient id="${id}cone" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffd890" stop-opacity="0.38"/><stop offset="1" stop-color="#ffb45e" stop-opacity="0"/></linearGradient>
      <linearGradient id="${id}beam" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff6dc" stop-opacity="0.3"/><stop offset="1" stop-color="#fff6dc" stop-opacity="0"/></linearGradient>
      <radialGradient id="${id}fglow"><stop offset="0" stop-color="#ffd59a" stop-opacity="0.42"/><stop offset="0.35" stop-color="#8cc8f0" stop-opacity="0.14"/><stop offset="1" stop-color="#5aa9e6" stop-opacity="0"/></radialGradient>
      <linearGradient id="${id}fl" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#3f86d8"/><stop offset="0.55" stop-color="#7ec3f2"/><stop offset="1" stop-color="#ffb45e"/></linearGradient>
      <linearGradient id="${id}shade" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#ffd27a"/><stop offset="0.5" stop-color="${C.mustard}"/><stop offset="1" stop-color="${C.mustardDk}"/></linearGradient>
      <pattern id="${id}wp" width="84" height="84" patternUnits="userSpaceOnUse">
        <g fill="${C.wallDk}"><circle cx="21" cy="16" r="4"/><circle cx="21" cy="26" r="4"/><circle cx="16" cy="21" r="4"/><circle cx="26" cy="21" r="4"/>
        <circle cx="63" cy="63" r="3"/></g><circle cx="21" cy="21" r="2.4" fill="#f0e2c4"/></pattern>
      <pattern id="${id}tile" width="168" height="126" patternUnits="userSpaceOnUse" x="380" y="476">
        <rect width="168" height="126" fill="${C.tile}"/>
        <path d="M 63 47 L 77 63 L 63 79 L 49 63 Z" fill="#5fae9f"/><path d="M 147 89 L 161 105 L 147 121 L 133 105 Z" fill="#e8835f"/>
        <path d="M 0 1.5 H 168 M 0 43.5 H 168 M 0 85.5 H 168 M 1.5 0 V 126 M 43.5 0 V 126 M 85.5 0 V 126 M 127.5 0 V 126" stroke="${C.grout}" stroke-width="3"/></pattern>
      <pattern id="${id}ging" width="22" height="22" patternUnits="userSpaceOnUse">
        <rect width="22" height="22" fill="#fbf3e4"/><rect width="11" height="22" fill="${C.tomato}" opacity="0.5"/><rect width="22" height="11" fill="${C.tomato}" opacity="0.5"/></pattern>`;

    /* ------------------------------------------------ outside the window: sky 0.3, clouds 0.33, town 0.42 */
    const skies = ["day", "dusk", "night"].map((k) => {
      const S = w.layer(0.3);
      // only as big as the window can reveal (window +- parallax for cameras that frame it): overdraw is the cost here
      R(620, 40, 780, 520, { fill: `url(#${id}${k})`, filter: k === "day" ? "url(#card0)" : "none" }, S);
      return S.parentNode;
    });
    const starsL = w.layer(0.3);
    const rr = PT.rng(41);
    for (let i = 0; i < 26; i++) O(640 + rr() * 740, 60 + rr() * 340, 1.4 + rr() * 2.2, { fill: C.cream }, starsL);
    const sunL = pin(w.layer(0.3));
    O(1112, 256, 130, { fill: `url(#${id}sun)` }, sunL);
    O(1112, 256, 22, { fill: "#ffd27a", filter: "url(#card1)" }, sunL);
    const moonL = w.layer(0.3);
    O(990, 254, 110, { fill: `url(#${id}moonG)` }, moonL);
    const moon = G({ filter: "url(#card1)" }, moonL);
    O(990, 254, 21, { fill: "#f3e7c4" }, moon);
    [[983, 247, 4.5], [999, 259, 3.5], [986, 265, 2.6]].forEach(([x, y, r]) => O(x, y, r, { fill: "#e0cfa2" }, moon));
    const clouds = [[880, 196, 0.5, 0, 9], [1220, 262, 0.4, 520, 12]].map(([x, y, sc, ph, speed]) => {
      const L = w.layer(0.33);
      const g = G({ filter: "url(#card1)", transform: `translate(${x} ${y}) scale(${sc})` }, L);
      P("M -110 30 Q -100 -10 -60 -6 Q -40 -44 6 -34 Q 40 -60 76 -24 Q 116 -24 116 30 Z", { fill: "#fbefe2" }, g);
      return { el: L.parentNode, ph, speed };
    });
    const town = (night) => {
      const L = w.layer(0.42);
      const far = night ? "#1d2a4c" : "#a9b9d9", near = night ? "#16203c" : "#7fa06b", tree = night ? "#132326" : "#4f7a56";
      const body = night ? "#1b2544" : "#efe2c8", roofs = night ? ["#121a31", "#141c35", "#121a31"] : [C.terra, C.plum, "#c9784f"];
      const glass = night ? "#ffcf7a" : "#9cc3dd";
      const g = G({ filter: "url(#card1)" }, L);
      P("M 620 560 V 380 Q 700 344 840 370 Q 980 398 1100 358 Q 1250 320 1400 368 V 560 Z", { fill: far }, g);
      const g2 = G({ filter: "url(#card1)" }, L);
      P("M 620 560 V 420 Q 760 394 960 416 Q 1120 432 1260 404 Q 1340 394 1400 400 V 560 Z", { fill: near }, g2);
      const houses = G({ filter: "url(#lift)" }, L);
      [[978, 378, 54, 46, 0], [1084, 392, 42, 36, 1], [900, 388, 50, 40, 2]].forEach(([x, y, wd, ht, i]) => {
        R(x, y, wd, ht, { fill: body }, houses);
        P(`M ${x - 7} ${y + 2} L ${x + wd / 2} ${y - ht * 0.62} L ${x + wd + 7} ${y + 2} Z`, { fill: roofs[i] }, houses);
        R(x + 7, y + 10, 11, 11, { fill: glass }, houses);
        R(x + wd - 18, y + 10, 11, 11, { fill: night && i === 1 ? body : glass }, houses);
      });
      R(1145, 392, 6, 30, { fill: night ? "#121a31" : C.woodDk }, houses);
      O(1148, 382, 18, { fill: tree }, houses); O(1138, 392, 12, { fill: tree }, houses);
      return L.parentNode;
    };
    const townDay = town(false), townNight = town(true);

    /* ------------------------------------------------ back wall 0.7: window hole, wallpaper, tiles, cabinet, clock face, shelf */
    const WIN = { x0: 940, x1: 1160, y0: 150, y1: 446, mx: 1050, my: 298 };
    const hole = `M ${WIN.x0} ${WIN.y0} V ${WIN.y1} H ${WIN.x1} V ${WIN.y0} Z`;
    const Lw = w.layer(0.7);
    P(`M -300 -400 H 2220 V 1300 H -300 Z ${hole}`, { fill: C.wall, "fill-rule": "evenodd", filter: "url(#card0)" }, Lw);
    P(`M -300 -400 H 2220 V 800 H -300 Z ${hole}`, { fill: `url(#${id}wp)`, "fill-rule": "evenodd", opacity: 0.75 }, Lw);
    R(-300, 18, 2520, 14, { fill: C.cream, filter: "url(#card1)" }, Lw);  // picture rail under the ceiling
    R(380, 476, 820, 230, { fill: `url(#${id}tile)`, filter: "url(#card1)" }, Lw);  // tiled splashback behind the counter run
    // window frame with muntins, then the sill
    const frame = G({ filter: "url(#card2)" }, Lw);
    P(`M 916 126 H 1184 V 470 H 916 Z ${hole}`, { fill: C.cream, "fill-rule": "evenodd" }, frame);
    P(`M ${WIN.mx - 5} ${WIN.y0} h 10 v ${WIN.y1 - WIN.y0} h -10 Z M ${WIN.x0} ${WIN.my - 5} h ${WIN.x1 - WIN.x0} v 10 h ${-(WIN.x1 - WIN.x0)} Z`, { fill: C.cream }, frame);
    R(898, 462, 304, 22, { rx: 4, fill: C.creamDk, filter: "url(#card2)" }, Lw);
    // upper cabinet left of the window
    const cabinet = (x, y, wd, ht, layer, doors = 2) => {
      const g = G({ filter: "url(#card2)" }, layer);
      R(x, y, wd, ht, { rx: 6, fill: C.cab }, g);
      R(x - 6, y - 4, wd + 12, 14, { rx: 4, fill: C.creamDk }, g);
      const dw = (wd - 12 - (doors - 1) * 6) / doors;
      for (let i = 0; i < doors; i++) {
        const dx = x + 6 + i * (dw + 6);
        R(dx, y + 16, dw, ht - 24, { rx: 4, fill: "#efdfc0" }, g);
        R(dx + 12, y + 30, dw - 24, ht - 52, { rx: 3, fill: "none", stroke: "#dcc8a3", "stroke-width": 4 }, g);
        knob(i === 0 && doors > 1 ? dx + dw - 12 : dx + 12, y + ht - 26, 6, g);
      }
      return g;
    };
    cabinet(730, 110, 170, 280, Lw);
    // clock face (hands live on their own small layer)
    const CK = { x: 1300, y: 238, r: 60 };
    const clockG = G({ filter: "url(#card2)" }, Lw);
    O(CK.x, CK.y, CK.r + 11, { fill: C.mustardDk }, clockG);
    O(CK.x, CK.y, CK.r, { fill: C.cream }, clockG);
    for (let i = 0; i < 12; i++) {
      const a = (i * Math.PI) / 6, r1 = i % 3 ? CK.r - 10 : CK.r - 17;
      svg("line", { x1: CK.x + r1 * Math.sin(a), y1: CK.y - r1 * Math.cos(a), x2: CK.x + (CK.r - 5) * Math.sin(a), y2: CK.y - (CK.r - 5) * Math.cos(a), stroke: C.ink, "stroke-width": i % 3 ? 3 : 5, "stroke-linecap": "round" }, clockG);
    }
    // shelf on the right with jars and a trailing plant
    const shelf = G({ filter: "url(#card2)" }, Lw);
    R(1752, 430, 176, 16, { rx: 4, fill: C.wood }, shelf);
    P("M 1776 446 h 14 l -14 26 Z M 1904 446 h -14 l 14 26 Z", { fill: C.woodDk }, shelf);
    const jars = G({ filter: "url(#lift)" }, Lw);
    [[1766, 46, 64, C.mustard, C.tomato], [1820, 40, 50, C.kraft, C.teal]].forEach(([x, wd, ht, fill, lid]) => {
      R(x, 430 - ht, wd, ht, { rx: 8, fill: "#eef3ee" }, jars);
      R(x + 4, 430 - ht * 0.66, wd - 8, ht * 0.66 - 4, { rx: 5, fill }, jars);
      R(x + 2, 422 - ht, wd - 4, 12, { rx: 3, fill: lid }, jars);
      R(x + 8, 438 - ht, 5, ht * 0.5, { rx: 2, fill: "#ffffff", opacity: 0.5 }, jars);
    });
    P("M 1872 430 L 1868 392 H 1914 L 1910 430 Z", { fill: C.terra }, jars);
    R(1864, 386, 54, 10, { rx: 3, fill: "#a5583f" }, jars);
    const vine = G({ filter: "url(#lift)" }, Lw);
    P("M 1880 392 Q 1858 440 1866 500 Q 1872 540 1860 574", { stroke: C.leaf, "stroke-width": 3, fill: "none" }, vine);
    P("M 1904 392 Q 1926 450 1912 520", { stroke: C.leaf, "stroke-width": 3, fill: "none" }, vine);
    [[1874, 380, -30], [1896, 374, 20], [1910, 384, 50], [1862, 444, -70], [1868, 494, -110], [1860, 540, -60], [1864, 572, -100], [1920, 446, 60], [1916, 494, 100], [1912, 522, 80]]
      .forEach(([x, y, r], i) => P("M 0 0 C -10 -10 -8 -24 0 -30 C 8 -24 10 -10 0 0 Z", { fill: i % 2 ? C.leaf2 : C.leaf, transform: `translate(${x} ${y}) rotate(${r})` }, vine));

    /* ------------------------------------------------ clock hands 0.7 (small) */
    const Lk = w.layer(0.7);
    const hHand = R(CK.x - 4, CK.y - 36, 8, 42, { rx: 4, fill: C.ink }, Lk);
    const mHand = R(CK.x - 3, CK.y - 52, 6, 58, { rx: 3, fill: C.tomato }, Lk);
    O(CK.x, CK.y, 5.5, { fill: "url(#brass)" }, Lk);
    const tag = svg("text", { x: CK.x, y: CK.y + 106, "text-anchor": "middle", "font-family": "Bricolage", "font-weight": 700, "font-size": 24, "letter-spacing": 3, fill: C.ink }, Lk);
    tag.textContent = "";

    /* ------------------------------------------------ floor 0.85: skirting and a perspective checker */
    const Lf = w.layer(0.85);
    const fl = G({ filter: "url(#card1)" }, Lf);
    R(-300, 790, 2520, 510, { fill: "#eadcc0" }, fl);
    const VP = -1300, Y0 = 790, rows = [790, 814, 842, 876, 916, 964, 1022, 1092, 1176, 1300];
    const X = (x0, y) => 960 + (x0 - 960) * (y - VP) / (Y0 - VP);
    let d = "";
    for (let r = 0; r < rows.length - 1; r++) {
      for (let j = 0; j < 34; j++) {
        if ((r + j) % 2) continue;
        const a = -620 + j * 96, b = a + 96, y0 = rows[r], y1 = rows[r + 1];
        d += `M ${X(a, y0).toFixed(1)} ${y0} L ${X(b, y0).toFixed(1)} ${y0} L ${X(b, y1).toFixed(1)} ${y1} L ${X(a, y1).toFixed(1)} ${y1} Z `;
      }
    }
    P(d, { fill: C.terra }, fl);
    R(-300, 772, 2520, 22, { fill: C.creamDk, filter: "url(#card1)" }, Lf);

    /* ------------------------------------------------ fridge, stove and counter run 0.8 (static) */
    const Lu = w.layer(0.8);
    // fridge, with a cabinet over it
    cabinet(80, 104, 280, 128, Lu);
    const fr = G({ filter: "url(#card2)" }, Lu);
    P("M 80 872 V 304 Q 80 252 132 252 H 308 Q 360 252 360 304 V 872 Z", { fill: C.fridge }, fr);
    R(94, 276, 14, 556, { rx: 7, fill: "#b2d6ee", opacity: 0.7 }, fr);
    R(80, 450, 280, 6, { fill: C.fridgeDk }, fr);
    R(92, 834, 256, 32, { rx: 6, fill: C.fridgeDk }, fr);
    for (let i = 0; i < 6; i++) R(110 + i * 38, 844, 26, 4, { rx: 2, fill: "#5f93b8" }, fr);
    R(188, 276, 64, 12, { rx: 6, fill: C.chrome }, fr);
    const handles = G({ filter: "url(#lift)" }, Lu);
    R(320, 328, 14, 100, { rx: 7, fill: C.chrome }, handles);
    R(320, 480, 14, 168, { rx: 7, fill: C.chrome }, handles);
    // magnets and papers on the fridge
    const mag = G({ filter: "url(#lift)" }, Lu);
    const photo = G({ transform: "rotate(-5 168 362)" }, mag);
    R(128, 318, 80, 90, { fill: "#fbf6ec" }, photo);
    R(135, 325, 66, 60, { fill: C.sky }, photo);
    P("M 135 385 Q 160 360 201 372 V 385 Z", { fill: "#7fa06b" }, photo);
    O(186, 340, 7, { fill: "#ffd27a" }, photo);
    O(168, 318, 7, { fill: C.tomato }, mag);
    const draw = G({ transform: "rotate(4 178 552)" }, mag);
    R(118, 496, 120, 108, { fill: C.cream }, draw);
    O(144, 522, 11, { fill: C.mustard }, draw);
    P("M 170 576 V 548 L 196 530 L 222 548 V 576 Z", { fill: "none", stroke: C.tomato, "stroke-width": 4, "stroke-linejoin": "round" }, draw);
    P("M 126 592 Q 150 582 178 590 T 230 588", { stroke: "#6a9c58", "stroke-width": 4, fill: "none", "stroke-linecap": "round" }, draw);
    P("M 190 576 V 562 H 202 V 576", { stroke: C.plum, "stroke-width": 3, fill: "none" }, draw);
    O(178, 496, 7, { fill: C.teal }, mag);
    const list = G({ transform: "rotate(-3 280 580)" }, mag);
    R(252, 524, 54, 108, { fill: "#fbf6ec" }, list);
    for (let i = 0; i < 6; i++) R(258, 542 + i * 14, 40 - (i % 3) * 8, 3, { fill: C.sky, opacity: 0.8 }, list);
    R(268, 518, 22, 12, { rx: 3, fill: C.mustard }, mag);
    O(140, 700, 9, { fill: C.plum }, mag);
    P("M 230 742 C 214 726 222 712 232 720 C 242 712 250 726 234 742 Z", { fill: C.tomato }, mag);
    O(286, 690, 8, { fill: C.mustard }, mag);
    // range hood (copper) over the stove
    // The chimney stays unfiltered: a card filter on this tall strip that leaves the frame cost ~0.3 s a frame to composite.
    const chim = G({}, Lu);
    R(612, -420, 12, 752, { fill: "#0a0d1c", opacity: 0.16 }, chim);
    R(518, -420, 84, 760, { fill: C.copper }, chim);
    R(526, -420, 12, 756, { fill: C.copperLt, opacity: 0.6 }, chim);
    R(594, -420, 8, 756, { fill: "#a85d33", opacity: 0.7 }, chim);
    const hood = G({ filter: "url(#card2)" }, Lu);
    P("M 416 428 L 704 428 L 664 332 L 456 332 Z", { fill: C.copper }, hood);
    P("M 456 332 L 476 332 L 438 428 L 416 428 Z", { fill: C.copperLt, opacity: 0.6 }, hood);
    R(408, 420, 304, 16, { rx: 4, fill: "#a85d33" }, hood);
    for (let i = 0; i < 8; i++) O(424 + i * 39, 428, 3, { fill: "url(#brass)" }, hood);
    // stove
    const st = G({ filter: "url(#card2)" }, Lu);
    R(410, 562, 300, 66, { rx: 6, fill: C.cab }, st);
    R(410, 556, 300, 9, { rx: 4, fill: C.chrome }, st);
    O(560, 594, 15, { fill: C.ink2 }, st); O(560, 594, 11, { fill: C.cream }, st);
    svg("line", { x1: 560, y1: 594, x2: 560, y2: 586, stroke: C.tomato, "stroke-width": 2.5, "stroke-linecap": "round" }, st);
    R(452, 588, 22, 12, { rx: 5, fill: "#f0b8a6" }, st); R(646, 588, 22, 12, { rx: 5, fill: "#cfe3d0" }, st);
    P("M 400 652 L 720 652 L 708 624 L 412 624 Z", { fill: C.ink2 }, st);
    E(500, 644, 52, 6.5, { fill: "#3d4260" }, st); E(500, 644, 22, 3, { fill: "#555b7c" }, st);
    E(630, 632, 42, 4.5, { fill: "#3d4260" }, st);
    [456, 474, 526, 544].forEach((x) => R(x - 2.5, 628, 5, 16, { fill: C.ink }, st));
    R(400, 650, 320, 210, { rx: 6, fill: C.cab }, st);
    R(400, 650, 320, 36, { fill: "#ecdcbc" }, st);
    [446, 494, 626, 674].forEach((x) => { O(x, 668, 11, { fill: C.ink2 }, st); R(x - 1.5, 657, 3, 9, { fill: C.cream }, st); });
    O(560, 668, 12, { fill: C.chrome }, st); O(560, 668, 7, { fill: C.cream }, st);
    R(418, 694, 284, 148, { rx: 8, fill: "#f0e0c2", stroke: "#dcc8a3", "stroke-width": 3 }, st);
    R(452, 726, 216, 82, { rx: 10, fill: C.ink2 }, st);
    P("M 476 726 L 520 726 L 470 808 L 452 808 Z", { fill: C.cream, opacity: 0.14 }, st);
    R(410, 842, 300, 18, { fill: "#e0ccaa" }, st);
    R(414, 860, 292, 12, { fill: C.ink2 }, st);
    const bar = G({ filter: "url(#lift)" }, Lu);
    R(438, 702, 244, 10, { rx: 5, fill: C.chrome }, bar);
    R(444, 696, 8, 14, { rx: 3, fill: "#bdb4a4" }, bar); R(668, 696, 8, 14, { rx: 3, fill: "#bdb4a4" }, bar);
    const towel = G({ filter: "url(#lift)" }, Lu);
    P("M 592 700 H 648 V 790 Q 620 798 592 790 Z", { fill: C.cream }, towel);
    R(592, 744, 56, 8, { fill: C.teal }, towel); R(592, 758, 56, 4, { fill: C.teal }, towel);
    R(590, 698, 60, 14, { rx: 6, fill: "#ece1cc" }, towel);
    // kettle on the front burner (spout tip at SP), saucepan on the back one
    const SP = { x: 586, y: 556 };
    const kettle = G({ filter: "url(#lift)" }, Lu);
    P("M 466 556 Q 500 494 534 556", { stroke: C.ink2, "stroke-width": 9, fill: "none", "stroke-linecap": "round" }, kettle);
    P("M 538 606 Q 562 590 578 556 L 594 560 Q 578 602 548 622 Z", { fill: "#c9461f" }, kettle);
    P("M 450 626 Q 444 574 476 556 Q 500 546 524 556 Q 556 574 550 626 Z", { fill: C.tomato }, kettle);
    R(448, 614, 104, 12, { rx: 5, fill: "#c9461f" }, kettle);
    P("M 478 552 Q 500 536 522 552 Z", { fill: C.cream }, kettle);
    O(500, 538, 6, { fill: C.ink2 }, kettle);
    E(474, 578, 9, 16, { fill: "#ffffff", opacity: 0.35, transform: "rotate(24 474 578)" }, kettle);
    const pan = G({ filter: "url(#lift)" }, Lu);
    P("M 612 600 L 596 548", { stroke: C.woodLt, "stroke-width": 6, "stroke-linecap": "round" }, pan);
    E(594, 544, 7, 11, { fill: C.woodLt, transform: "rotate(-18 594 544)" }, pan);
    R(594, 596, 70, 34, { rx: 6, fill: C.teal }, pan);
    R(590, 594, 78, 7, { rx: 3, fill: C.cream }, pan);
    R(664, 602, 56, 8, { rx: 4, fill: C.ink2 }, pan);
    // counter run with an apron sink under the window
    const run = G({ filter: "url(#card2)" }, Lu);
    R(724, 652, 526, 206, { fill: C.wood }, run);
    const door = (x, y, wd, ht, kx, ky) => { R(x, y, wd, ht, { rx: 4, fill: "#86513b" }, run); R(x + 10, y + 10, wd - 20, ht - 20, { rx: 3, fill: C.panel }, run); knob(kx, ky, 6, run); };
    door(732, 662, 102, 40, 783, 682); door(842, 662, 100, 40, 892, 682);
    door(732, 710, 102, 138, 820, 730); door(842, 710, 100, 138, 856, 730);
    door(952, 724, 96, 124, 1036, 744); door(1054, 724, 96, 124, 1066, 744);
    door(1158, 662, 84, 40, 1200, 682); door(1158, 710, 84, 138, 1172, 730);
    R(724, 856, 526, 16, { fill: C.woodDk }, run);
    R(712, 630, 550, 24, { rx: 5, fill: "#efe3cb" }, run);
    R(712, 648, 550, 6, { fill: "#d8c7a6" }, run);
    const sink = G({ filter: "url(#card2)" }, Lu);
    P("M 948 632 H 1152 V 700 Q 1152 718 1134 718 H 966 Q 948 718 948 700 Z", { fill: "#fbf6ec" }, sink);
    R(948, 632, 204, 8, { fill: "#e6dccb" }, sink);
    const tap = G({ filter: "url(#lift)" }, Lu);
    P("M 1050 632 V 560 Q 1050 528 1080 528 Q 1108 528 1108 556 V 572", { stroke: C.chrome, "stroke-width": 12, fill: "none", "stroke-linecap": "round" }, tap);
    R(1036, 618, 28, 16, { rx: 5, fill: C.chrome }, tap);
    [1010, 1090].forEach((x) => { R(x - 6, 610, 12, 22, { rx: 4, fill: C.chrome }, tap); R(x - 14, 604, 28, 8, { rx: 4, fill: "#c9c0b0" }, tap); });
    // things on the counter: a cutting board, a herb pot, a utensil crock
    const things = G({ filter: "url(#lift)" }, Lu);
    const board = G({ transform: "rotate(-7 806 630)" }, things);
    P("M 770 630 V 540 Q 770 512 806 512 Q 842 512 842 540 V 630 Z", { fill: C.woodLt }, board);
    O(806, 532, 7, { fill: C.tile }, board);
    R(780, 560, 10, 60, { rx: 5, fill: "#b07a58", opacity: 0.6 }, board);
    P("M 880 630 L 874 594 H 918 L 912 630 Z", { fill: C.terra }, things);
    R(870, 588, 52, 10, { rx: 3, fill: "#a5583f" }, things);
    [[884, 584, -30], [896, 578, -5], [908, 582, 25], [890, 560, -15], [904, 556, 12], [897, 540, 0]].forEach(([x, y, r], i) =>
      P("M 0 0 C -9 -8 -8 -22 0 -28 C 8 -22 9 -8 0 0 Z", { fill: i % 2 ? C.leaf2 : C.leaf, transform: `translate(${x} ${y}) rotate(${r})` }, things));
    P("M 1186 532 Q 1176 500 1190 486", { stroke: C.woodLt, "stroke-width": 6, fill: "none", "stroke-linecap": "round" }, things);
    E(1192, 482, 9, 13, { fill: C.woodLt }, things);
    R(1205, 470, 8, 90, { rx: 3, fill: C.ink2 }, things); R(1198, 456, 22, 30, { rx: 5, fill: C.ink2 }, things);
    P("M 1226 540 L 1238 478 M 1238 478 Q 1222 470 1230 452 Q 1246 446 1250 462 Q 1252 476 1238 478", { stroke: C.chrome, "stroke-width": 4, fill: "none", "stroke-linecap": "round" }, things);
    P("M 1178 630 L 1182 540 H 1240 L 1244 630 Z", { fill: C.cream }, things);
    R(1180, 566, 62, 12, { fill: C.sky }, things);

    /* ------------------------------------------------ the small moving parts on the 0.8 plane */
    const Lfl = w.layer(0.8);
    const tongues = [];
    for (let i = 0; i < 8; i++) {
      const x = 456 + i * 12.5, h = i % 2 ? 22 : 28;
      const g = G({}, Lfl);
      P(`M ${x - 6} 646 Q ${x - 6} ${646 - h * 0.5} ${x} ${646 - h} Q ${x + 6} ${646 - h * 0.5} ${x + 6} 646 Z`, { fill: `url(#${id}fl)` }, g);
      P(`M ${x - 2.6} 646 Q ${x - 2.6} ${646 - h * 0.3} ${x} ${646 - h * 0.55} Q ${x + 2.6} ${646 - h * 0.3} ${x + 2.6} 646 Z`, { fill: "#dff2ff" }, g);
      tongues.push({ g, x });
    }
    const Ls = w.layer(0.8);
    const puffs = [];
    for (let i = 0; i < 8; i++) {
      const g = G({ filter: "url(#lift)" }, Ls);
      O(0, 0, 10, { fill: "#fbf6ec" }, g); O(-9, 4, 7, { fill: "#fbf6ec" }, g); O(8, 3, 8, { fill: "#fbf6ec" }, g);
      puffs.push(g);
    }

    /* ------------------------------------------------ daylight through the window (screen) */
    const Lbeam = w.layer(0.7);  // plain alpha, not screen: a blend mode would cost a full extra render pass
    svg("polygon", { points: `${WIN.x0},${WIN.y1} ${WIN.x1},${WIN.y1} 1400,960 1020,960`, fill: `url(#${id}beam)` }, Lbeam);

    /* ------------------------------------------------ table and chairs 1.0 (behind the puppets) */
    const seats = [{ x: 1400, y: 930 }, { x: 1740, y: 930 }];
    const TB = { x: 1570 };
    const Lt = w.layer(1.0);
    const chair = (cx) => {
      // front-on ladder-back chair, wider than a puppet so the seat and posts show around someone sitting on it
      const g = G({ filter: "url(#card2)" }, Lt);
      E(cx, 942, 104, 9, { fill: C.ink, opacity: 0.18 }, g);
      [-80, 80].forEach((dx) => { R(cx + dx - 7, 600, 14, 326, { rx: 6, fill: C.woodDk }, g); O(cx + dx, 597, 10, { fill: C.woodDk }, g); });
      R(cx - 78, 612, 156, 24, { rx: 8, fill: C.wood }, g);
      [676, 736, 796].forEach((y) => R(cx - 74, y, 148, 12, { rx: 5, fill: C.wood }, g));
      R(cx - 78, 906, 156, 8, { rx: 3, fill: C.woodDk }, g);
      P(`M ${cx - 96} 870 L ${cx + 96} 870 L ${cx + 84} 846 L ${cx - 84} 846 Z`, { fill: C.woodLt }, g);
      P(`M ${cx - 88} 866 Q ${cx - 94} 842 ${cx - 70} 840 H ${cx + 70} Q ${cx + 94} 842 ${cx + 88} 866 Z`, { fill: C.cream }, g);
      P(`M ${cx - 88} 866 Q ${cx} 858 ${cx + 88} 866`, { stroke: "#dcc8a3", "stroke-width": 3, fill: "none" }, g);
      O(cx - 66, 852, 3.5, { fill: C.tomato }, g); O(cx + 66, 852, 3.5, { fill: C.tomato }, g);
      R(cx - 96, 866, 192, 18, { rx: 4, fill: C.wood }, g);
      [-86, 86].forEach((dx) => R(cx + dx - 7, 882, 14, 58, { rx: 4, fill: C.wood }, g));
    };
    seats.forEach((s) => chair(s.x));
    const table = G({ filter: "url(#card2)" }, Lt);
    E(TB.x, 942, 90, 9, { fill: C.ink, opacity: 0.2 }, table);
    [TB.x - 56, TB.x + 56].forEach((x) => R(x - 7, 800, 14, 140, { rx: 4, fill: C.wood }, table));
    R(TB.x - 52, 900, 104, 8, { rx: 3, fill: C.woodDk }, table);
    P(`M ${TB.x - 72} 778 L ${TB.x + 72} 778 L ${TB.x + 62} 762 L ${TB.x - 62} 762 Z`, { fill: "#fbf3e4" }, table);
    let hem = `M ${TB.x - 76} 776 H ${TB.x + 76} V 832`;
    for (let i = 0; i < 6; i++) { const x = TB.x + 76 - i * (152 / 6); hem += ` Q ${x - 76 / 6} 848 ${x - 152 / 6} 832`; }
    P(hem + " Z", { fill: `url(#${id}ging)` }, table);
    P(`M ${TB.x - 76} 776 H ${TB.x + 76} V 784 H ${TB.x - 76} Z`, { fill: C.tomato, opacity: 0.75 }, table);
    const bowl = G({ filter: "url(#lift)" }, Lt);
    O(TB.x - 30, 726, 18, { fill: C.tomato }, bowl); P(`M ${TB.x - 30} 710 l 3 -9`, { stroke: C.woodDk, "stroke-width": 3 }, bowl);
    O(TB.x + 30, 724, 19, { fill: "#a9c46a" }, bowl);
    O(TB.x + 2, 716, 21, { fill: C.mustard }, bowl); O(TB.x + 8, 708, 3, { fill: C.mustardDk }, bowl);
    P(`M ${TB.x - 34} 704 Q ${TB.x - 4} 676 ${TB.x + 34} 694 Q ${TB.x - 4} 690 ${TB.x - 30} 712 Z`, { fill: "#f7cd52" }, bowl);
    P(`M ${TB.x - 56} 734 H ${TB.x + 56} Q ${TB.x + 50} 768 ${TB.x} 770 Q ${TB.x - 50} 768 ${TB.x - 56} 734 Z`, { fill: C.teal }, bowl);
    R(TB.x - 58, 730, 116, 9, { rx: 4, fill: C.cream }, bowl);
    R(TB.x - 16, 764, 32, 8, { rx: 3, fill: "#23867a" }, bowl);

    /* ------------------------------------------------ pendant lamp 0.95 (sways on its own small layer) */
    const LMP = { x: TB.x, top: -420, y: 368 };
    const Ll = pin(w.layer(0.95));  // swayed by a CSS transform on its own svg: compositor only, no re-raster
    Ll.style.transformOrigin = `${LMP.x}px ${LMP.top}px`;
    const lampG = G({}, Ll);
    svg("line", { x1: LMP.x, y1: LMP.top, x2: LMP.x, y2: 306, stroke: C.ink2, "stroke-width": 3.5 }, lampG);
    const shadeG = G({ filter: "url(#card2)" }, lampG);
    R(LMP.x - 9, 290, 18, 20, { rx: 4, fill: C.ink2 }, shadeG);
    P(`M ${LMP.x - 74} ${LMP.y} Q ${LMP.x - 70} 316 ${LMP.x} 304 Q ${LMP.x + 70} 316 ${LMP.x + 74} ${LMP.y} Z`, { fill: `url(#${id}shade)` }, shadeG);
    R(LMP.x - 78, LMP.y - 8, 156, 12, { rx: 5, fill: C.mustardDk }, shadeG);
    const bulb = E(LMP.x, LMP.y + 6, 22, 11, { fill: "#e9d6a8" }, lampG);

    /* ------------------------------------------------ puppets 1.0 */
    const Lp = w.layer(1.0);
    const people = cast.map((c) => {
      const s = c.seat !== undefined ? seats[c.seat] : null;
      const cc = Object.assign({}, c, s ? { x: s.x, y: s.y, sit: c.sit ?? 1 } : {});
      return { c: cc, p: PT.puppet(Lp, { shirt: c.shirt, pants: c.pants, hair: c.hair, hairStyle: c.hairStyle || "short", glasses: c.glasses }) };
    });

    /* ------------------------------------------------ foreground 1.55: out-of-focus leaves at both lower corners */
    const Lfg = w.layer(1.55);
    const fg = G({ filter: "url(#dof)" }, Lfg);
    P("M -40 1180 L -14 1050 H 140 L 166 1180 Z", { fill: C.terra }, fg);
    [[-14, 1066, -34, 1.05, C.leaf], [62, 1074, -8, 1.12, C.leaf2], [136, 1084, 22, 0.86, C.leaf]].forEach(([x, y, r, s, f]) =>
      P("M 0 0 C -60 -120 -40 -260 60 -330 C 140 -250 140 -110 0 0 Z", { fill: f, transform: `translate(${x} ${y}) rotate(${r}) scale(${s})` }, fg));
    [[2150, 1160, -8, 1.15, C.leaf2], [2214, 1180, 22, 0.95, C.leaf]].forEach(([x, y, r, s, f]) =>
      P("M 0 0 C -60 -120 -40 -260 60 -330 C 140 -250 140 -110 0 0 Z", { fill: f, transform: `translate(${x} ${y}) rotate(${r}) scale(${s})` }, fg));

    /* ------------------------------------------------ evening dim (multiply), with the window panes left clear */
    const Ldim = w.layer(0.7, { mixBlendMode: "multiply" });
    const pane = (x0, x1, y0, y1) => `M ${x0} ${y0} V ${y1} H ${x1} V ${y0} Z`;
    P(`M -300 -400 H 2220 V 1300 H -300 Z ${pane(WIN.x0, WIN.mx - 5, 220, WIN.my - 5)} ${pane(WIN.mx + 5, WIN.x1, 220, WIN.my - 5)} ${pane(WIN.x0, WIN.mx - 5, WIN.my + 5, WIN.y1)} ${pane(WIN.mx + 5, WIN.x1, WIN.my + 5, WIN.y1)}`,
      { fill: "#4b5a8f", "fill-rule": "evenodd" }, Ldim);

    /* ------------------------------------------------ the window valance (sways), drawn over the dim with its own shade */
    const Lv = pin(w.layer(0.7));
    Lv.style.transformOrigin = "0px 134px";
    const valG = G({}, Lv);
    let vd = "M 926 134 H 1174 V 200";
    for (let i = 0; i < 8; i++) { const x = 1174 - i * 31; vd += ` Q ${x - 15.5} 218 ${x - 31} 200`; }
    vd += " Z";
    const val = G({ filter: "url(#card2)" }, valG);
    P(vd, { fill: `url(#${id}ging)` }, val);
    R(926, 134, 248, 10, { fill: C.tomato, opacity: 0.8 }, val);
    const rod = G({ filter: "url(#lift)" }, valG);
    R(912, 126, 276, 9, { rx: 4.5, fill: C.woodDk }, rod);
    O(912, 130.5, 8, { fill: C.woodDk }, rod); O(1188, 130.5, 8, { fill: C.woodDk }, rod);
    const valDim = G({ style: "mix-blend-mode:multiply" }, valG);
    P(vd, { fill: "#4b5a8f" }, valDim);
    R(904, 120, 292, 20, { rx: 8, fill: "#4b5a8f" }, valDim);

    /* ------------------------------------------------ practical lights (screen) */
    const Lg = pin(w.layer(0.95, { mixBlendMode: "screen" }));
    Lg.style.transformOrigin = `${LMP.x}px ${LMP.top}px`;
    O(LMP.x, LMP.y + 40, 440, { fill: `url(#${id}lamp)` }, Lg);
    svg("polygon", { points: `${LMP.x - 60},${LMP.y + 6} ${LMP.x + 60},${LMP.y + 6} ${LMP.x + 250},900 ${LMP.x - 250},900`, fill: `url(#${id}cone)` }, Lg);
    O(LMP.x, LMP.y + 8, 46, { fill: "#ffe2b0", opacity: 0.7, filter: "url(#glow)" }, Lg);
    const Lfgl = w.layer(0.8);  // plain alpha: a second screen layer would cost a render pass
    O(500, 630, 120, { fill: `url(#${id}fglow)` }, Lfgl);

    w.overlay("vignette");

    const anchors = {
      fridge: { x: 220, y: 560 }, stove: { x: 560, y: 600 }, sink: { x: 1050, y: 600 }, window: { x: WIN.mx, y: WIN.my },
      clock: { x: CK.x, y: CK.y }, table: { x: TB.x, y: 760 }, seats,
    };
    let bulbOn = null;

    function update(t, s = {}) {
      const k = s.sky ?? 0;
      op(skies[1], clamp(k * 2)); op(skies[2], clamp(k * 2 - 1));
      op(starsL.parentNode, clamp(k * 2.2 - 1.2)); op(moonL.parentNode, clamp(k * 2 - 1));
      sunL.style.transform = `translate(0px, ${(150 * clamp(k * 1.6 - 0.2)).toFixed(1)}px)`;
      op(sunL.parentNode, 1 - clamp(k * 2 - 0.9));
      op(townNight, clamp(k * 2 - 1));
      clouds.forEach((c) => {
        c.el.style.marginLeft = ((((t * c.speed + c.ph) % 1040) - 520)).toFixed(1) + "px";
        op(c.el, 1 - 0.75 * clamp(k * 2 - 1));
      });
      op(Lbeam.parentNode, 1 - clamp(k * 1.6));
      const dim = s.dim ?? 0.72 * clamp(k * 1.6 - 0.6);
      op(Ldim.parentNode, dim); op(valDim, dim);
      // pendant lamp: a slow sway, the glow follows it
      const lamp = s.lamp ?? clamp(k * 2.2 - 0.9);
      const sw = 1.1 * Math.sin(t * 1.25) + 0.25 * Math.sin(t * 2.9 + 1);
      Ll.style.transform = Lg.style.transform = `rotate(${sw.toFixed(3)}deg)`;
      op(Lg.parentNode, lamp * (0.82 + 0.03 * Math.sin(t * 8.3) * Math.sin(t * 3.1)));
      const on = lamp > 0.2;
      if (on !== bulbOn) { bulb.setAttribute("fill", on ? "#fff4d2" : "#e9d6a8"); bulbOn = on; }
      // window valance
      Lv.style.transform = `skewX(${(1.6 * Math.sin(t * 1.1 + 0.4)).toFixed(3)}deg)`;
      // clock
      const m = s.clock ?? 7.5 * 60;
      mHand.setAttribute("transform", `rotate(${(m % 60) * 6} ${CK.x} ${CK.y})`);
      hHand.setAttribute("transform", `rotate(${((m / 60) % 12) * 30} ${CK.x} ${CK.y})`);
      if (tag.textContent !== (s.tagText || "")) tag.textContent = s.tagText || "";
      tag.setAttribute("opacity", s.tag ?? 0);
      // front burner flame
      const f = s.flame ?? 0;
      op(Lfl.parentNode, f > 0.02 ? 1 : 0);
      op(Lfgl.parentNode, f > 0.02 ? f * (0.75 + 0.15 * Math.sin(t * 17) * Math.sin(t * 5.3)) : 0);
      if (f > 0.02) tongues.forEach(({ g, x }, i) => {
        const fk = f * (0.78 + 0.16 * Math.sin(t * 23 + i * 1.9) * Math.sin(t * 9.7 + i * 0.7) + 0.06 * Math.sin(t * 41 + i * 2.3));
        g.setAttribute("transform", `translate(${x} 646) scale(${(0.75 + 0.25 * f).toFixed(3)} ${fk.toFixed(3)}) translate(${-x} -646)`);
      });
      // kettle steam
      const sv = s.steam ?? 0;
      op(Ls.parentNode, sv > 0.01 ? 1 : 0);
      if (sv > 0.01) puffs.forEach((g, i) => {
        const p = (t * 0.5 + i / puffs.length) % 1;
        const x = SP.x + 8 + 58 * p + 16 * p * Math.sin(t * 1.6 + i * 2.1);
        const y = SP.y - 6 - 200 * p;
        const sc = (0.45 + 2.0 * p) * (0.55 + 0.45 * sv);
        g.setAttribute("transform", `translate(${x.toFixed(1)} ${y.toFixed(1)}) scale(${sc.toFixed(3)})`);
        g.setAttribute("opacity", (sv * 0.9 * Math.sin(Math.PI * Math.min(1, p * 1.12))).toFixed(3));
      });
      // cast
      people.forEach(({ c, p }, i) => p.pose(Object.assign({ x: c.x, y: c.y ?? 930, s: c.s ?? 1.3, hs: c.hs ?? 1, sit: c.sit ?? 0,
        bob: 1.8 * Math.sin(t * 1.9 + i), armF: -9, armB: 9, blink: K.blink(t, 1e9, 1.2 + i * 0.7) }, (s.cast || [])[i] || {})));
    }
    return { update, anchors, people };
  };
})();
