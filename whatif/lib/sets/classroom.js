/* K.loc.classroom: a daylight classroom. Load after stage.js and kit.js.
 *
 *   const w = K.world(parent);
 *   const room = K.loc.classroom(w, { cast });
 *   room.update(t, state);                              // every frame, after w.camera(...)
 *
 * Green chalkboard with a chalk ledge and an alphabet strip, a window onto the schoolyard, a wall clock, a teacher's
 * desk with an apple, three front-facing student desks, a bookshelf, posters and paper bunting that sways.
 *
 * opts
 *   cast: [{ x, y?, s?, hs?, sit?, desk?, front?, shirt, pants?, hair, hairStyle, glasses }]
 *     desk: 0 | 1 | 2   seats the puppet behind that desk: x, y default to anchors.desks[desk], s 0.9, hs 1.3, sit 1.
 *     otherwise         the puppet stands at (x, y ?? 905) with s 1.25 (the teacher's spot is anchors.teacher.feet).
 *     front: true       puts the puppet on a layer in front of the student desks (default: behind them).
 * state
 *   board   string, written in chalk; "\n" breaks lines. Re-rendered only when the string changes. Default "".
 *   boardU  0..1, how much of the board is written, left to right and line by line, with a chalk stick at the
 *           writing point. Default 1.
 *   sky     0..1 through the window: 0 day, 0.5 dusk, 1 night (crossfade, like K.loc.park). Default 0.
 *   clock   wall clock in minutes after midnight. Default 8:50.
 *   dim     0..1 room darkness. Default follows sky (dark only after dusk).
 *   cast    [pose overrides per person], e.g. { armF: -165 } raises a hand, { look: 1 }, { mouth: "o" }.
 * anchors   (the long 16:9 view is camera {x: 960, y: 540, z: 1})
 *   board, window, clock, teacher   camera targets {x, y, z} that frame each one in a 9:16 Short
 *                                   (parallax-corrected: pass straight to w.camera).
 *   teacher.feet                    {x, y}: where the teacher stands, beside the board.
 *   desks                           [{x, y}] x3: feet of a puppet sitting (sit: 1) behind each desk; also a good
 *                                   camera x for that child.
 * returns { update, anchors, people: [{c, p}] }   (p is the PT.puppet; people keeps cast order)
 */
(function () {
  const { svg, html, clamp } = PT;

  K.loc.classroom = (w, { cast = [] } = {}) => {
    const id = K.uid("cls");
    const C = { wall: "#e8cf9f", stripe: "#e0c28d", ceil: "#cfae78", teal: "#2a9d8f", tealDk: "#21806f", tealLt: "#43b0a1",
      wood: "#7b4a36", woodDk: "#5e3829", woodLt: "#96603f", cream: "#f6ecd9", kraft: "#d4a777", kraftDk: "#b98a5c",
      ink: "#1c1f2e", navy: "#2b2f45", board: "#2e5946", boardDk: "#22453a", tomato: "#e4572e", mustard: "#f2b134",
      mustardDk: "#cf8f2e", plum: "#7b4b94", sky: "#5aa9e6", leaf: "#3f6b4e" };
    w.defs.innerHTML += `
      <linearGradient id="${id}day" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7fbbe6"/><stop offset="1" stop-color="#e6eef0"/></linearGradient>
      <linearGradient id="${id}dusk" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#6d5a9c"/><stop offset="0.55" stop-color="#e98f7a"/><stop offset="1" stop-color="#ffd59a"/></linearGradient>
      <linearGradient id="${id}night" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0e152d"/><stop offset="1" stop-color="#2b3a66"/></linearGradient>
      <pattern id="${id}stripe" width="46" height="40" patternUnits="userSpaceOnUse"><rect x="0" y="0" width="17" height="40" fill="${C.stripe}"/></pattern>
      <linearGradient id="${id}sheen" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffffff" stop-opacity="0.09"/><stop offset="0.55" stop-color="#ffffff" stop-opacity="0"/></linearGradient>
      <linearGradient id="${id}beam" x1="0" y1="0" x2="0.35" y2="1"><stop offset="0" stop-color="#fff2cf" stop-opacity="0.34"/><stop offset="1" stop-color="#fff2cf" stop-opacity="0"/></linearGradient>
      <radialGradient id="${id}bloom"><stop offset="0" stop-color="#fff4d4" stop-opacity="0.6"/><stop offset="0.45" stop-color="#ffe6b0" stop-opacity="0.18"/><stop offset="1" stop-color="#ffe6b0" stop-opacity="0"/></radialGradient>
      <linearGradient id="${id}moonbeam" x1="0" y1="0" x2="0.35" y2="1"><stop offset="0" stop-color="#b9cbff" stop-opacity="0.26"/><stop offset="1" stop-color="#b9cbff" stop-opacity="0"/></linearGradient>
      <radialGradient id="${id}moonbloom"><stop offset="0" stop-color="#c8d6ff" stop-opacity="0.3"/><stop offset="1" stop-color="#c8d6ff" stop-opacity="0"/></radialGradient>
      <radialGradient id="${id}globe" cx="38%" cy="32%" r="70%"><stop offset="0" stop-color="#8cc6ee"/><stop offset="1" stop-color="#3f86c2"/></radialGradient>
      <filter id="${id}chalk" x="-8%" y="-25%" width="116%" height="150%" color-interpolation-filters="sRGB">
        <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="9" result="n"/>
        <feColorMatrix in="n" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -2.4 1.95" result="speck"/>
        <feComposite in="SourceGraphic" in2="speck" operator="in" result="dusty"/>
        <feDisplacementMap in="dusty" in2="n" scale="3.2" xChannelSelector="R" yChannelSelector="G"/>
      </filter>`;
    const R = (g, x, y, wd, ht, fill, extra = {}) => svg("rect", Object.assign({ x, y, width: wd, height: ht, fill }, extra), g);
    const T = (g, x, y, str, attrs) => { const e = svg("text", Object.assign({ x, y, "text-anchor": "middle" }, attrs), g); e.textContent = str; return e; };
    const op = (el, v) => { const s2 = String(Math.round(v * 1000) / 1000); if (el.style.opacity !== s2) el.style.opacity = s2; };

    /* ---- outside the window: skies, clouds, schoolyard. Seen through a hole in the wall, so they get real parallax. */
    const WIN = { x0: 200, x1: 500, y0: 190, y1: 560 };
    const skies = ["day", "dusk", "night"].map((k) => {
      const S = w.layer(0.42);
      // only ever seen through the window, so it covers just the window plus the parallax slack
      R(S, 40, 110, 620, 560, `url(#${id}${k})`, { filter: k === "day" ? "url(#card0)" : "none" });
      return S.parentNode;
    });
    const nightL = w.layer(0.42);
    const r = PT.rng(21);
    for (let i = 0; i < 18; i++) svg("circle", { cx: 60 + r() * 580, cy: 130 + r() * 300, r: 1.4 + r() * 2.2, fill: C.cream }, nightL);
    const moon = svg("g", { filter: "url(#card1)" }, nightL);
    svg("circle", { cx: 318, cy: 262, r: 34, fill: "#f3e7c4" }, moon);
    [[308, 252, 6], [330, 272, 4.5], [316, 280, 3.5]].forEach(([x, y, rr]) => svg("circle", { cx: x, cy: y, r: rr, fill: "#e0cfa2" }, moon));
    // clouds repeat every 640 units, so the drift can wrap without a jump
    const cloudL = w.layer(0.43);
    const cloudS = cloudL;
    cloudS.style.willChange = "transform";
    for (let k = -2; k <= 2; k++) [[120, 250, 0.72], [430, 330, 0.55]].forEach(([x, y, sc]) => {
      const g = svg("g", { filter: "url(#card1)", transform: `translate(${x + k * 640} ${y}) scale(${sc})` }, cloudL);
      svg("path", { d: "M -110 30 Q -100 -10 -60 -6 Q -40 -44 6 -34 Q 40 -60 76 -24 Q 116 -24 116 30 Z", fill: "#fbf3e6" }, g);
    });
    const yard = w.layer(0.45);
    svg("path", { d: "M -250 470 Q 60 400 360 450 T 950 430 V 900 H -250 Z", fill: "#8db47c", filter: "url(#card1)" }, yard);
    const roofs = svg("g", { filter: "url(#card1)" }, yard);
    [[40, 448, 70, "#c96f4f"], [150, 440, 56, "#b5644a"], [560, 446, 64, "#c96f4f"], [660, 438, 50, "#a85b45"]].forEach(([x, y, s, c]) => {
      svg("path", { d: `M ${x} ${y} l ${s / 2} -${s * 0.45} l ${s / 2} ${s * 0.45} Z`, fill: c }, roofs);
      R(roofs, x + s * 0.12, y, s * 0.76, s * 0.5, "#efe0c4");
      R(roofs, x + s * 0.4, y + s * 0.16, s * 0.2, s * 0.2, "#7a93b0");
    });
    svg("path", { d: "M -250 520 Q 100 480 420 515 T 950 505 V 900 H -250 Z", fill: "#6f9e62", filter: "url(#card2)" }, yard);
    const fence = svg("g", { filter: "url(#lift)" }, yard);
    R(fence, -250, 532, 1200, 6, "#efe0c4");
    for (let x = -240; x < 950; x += 26) R(fence, x, 518, 8, 40, "#efe0c4", { rx: 3 });
    const tree = svg("g", { filter: "url(#card2)", transform: "translate(450 560) scale(1.35)" }, yard);
    R(tree, -9, -120, 18, 122, C.woodDk, { rx: 5 });
    svg("circle", { cx: 0, cy: -160, r: 70, fill: "#3f6b4e" }, tree);
    svg("circle", { cx: -40, cy: -126, r: 46, fill: "#46775a" }, tree);
    svg("circle", { cx: 42, cy: -132, r: 50, fill: "#3a6248" }, tree);
    const yardNight = w.layer(0.45);
    R(yardNight, -250, 380, 1200, 520, "#0e152d", { opacity: 0.62 });

    /* ---- back wall (static): ceiling, striped wallpaper with the window cut out, chair rail, teal wainscot, window */
    const L0 = w.layer(0.5);
    R(L0, -300, -400, 2520, 440, C.ceil, { filter: "url(#card0)" });
    const wallD = `M -300 30 H 2220 V 664 H -300 Z M ${WIN.x0} ${WIN.y0} V ${WIN.y1} H ${WIN.x1} V ${WIN.y0} Z`;
    svg("path", { d: wallD, fill: C.wall, "fill-rule": "evenodd", filter: "url(#card0)" }, L0);
    svg("path", { d: wallD, fill: `url(#${id}stripe)`, "fill-rule": "evenodd", opacity: 0.55 }, L0);
    R(L0, -300, 18, 2520, 18, C.wood, { filter: "url(#card1)" });
    R(L0, -300, 656, 2520, 150, C.teal, { filter: "url(#card0)" });
    const panels = svg("g", { filter: "url(#card1)" }, L0);
    for (let x = -280; x < 2200; x += 190) R(panels, x, 678, 160, 84, C.tealDk, { rx: 4 });
    R(L0, -300, 640, 2520, 20, C.wood, { filter: "url(#card2)" });
    R(L0, -300, 772, 2520, 26, C.woodDk, { filter: "url(#card1)" });
    // window: cream frame with mullions, sill, rolled blind
    svg("path", { d: `M 176 164 H 524 V 586 H 176 Z M ${WIN.x0} ${WIN.y0} V ${WIN.y1} H ${WIN.x1} V ${WIN.y0} Z M 343 190 h 14 v 370 h -14 Z M 200 368 h 300 v 13 h -300 Z`,
      fill: C.cream, "fill-rule": "evenodd", filter: "url(#card2)" }, L0);
    R(L0, 160, 580, 380, 22, "#efe0c4", { rx: 4, filter: "url(#card2)" });
    R(L0, 184, 600, 332, 12, "#e3d2b2", { filter: "url(#card1)" });
    R(L0, 168, 140, 364, 30, "#efe3cc", { rx: 14, filter: "url(#card2)" });
    R(L0, 176, 166, 348, 16, "#e2d3b6", { filter: "url(#card1)" });
    const pot = svg("g", { filter: "url(#card1)" }, L0);
    [[-26, -8], [-6, -22], [16, -12], [30, 2], [-36, 6]].forEach(([dx, rot]) =>
      svg("path", { d: "M 0 0 C -10 -24 -6 -50 6 -62 C 16 -46 14 -22 0 0 Z", fill: rot > 0 ? "#46775a" : C.leaf, transform: `translate(${352 + dx * 0.4} 556) rotate(${rot + dx})` }, pot));
    svg("path", { d: "M 328 552 H 376 L 370 582 H 334 Z", fill: C.tomato }, pot);
    R(pot, 324, 548, 56, 9, "#c94a26", { rx: 3 });

    /* ---- board wall (static): chalkboard, ledge, alphabet strip, clock face, posters */
    const LB = w.layer(0.52);
    const BD = { x0: 622, x1: 1268, y0: 172, y1: 538 };
    const bcx = (BD.x0 + BD.x1) / 2, bcy = (BD.y0 + BD.y1) / 2;
    R(LB, 600, 150, 690, 410, C.wood, { rx: 6, filter: "url(#card2)" });
    R(LB, 612, 162, 666, 386, C.woodDk, { rx: 3 });
    R(LB, BD.x0, BD.y0, BD.x1 - BD.x0, BD.y1 - BD.y0, C.board, { filter: "url(#card0)" });
    R(LB, BD.x0, BD.y0, BD.x1 - BD.x0, BD.y1 - BD.y0, `url(#${id}sheen)`);
    // ghosts of yesterday's lesson, half rubbed out
    const ghost = svg("g", { fill: C.cream }, LB);
    [[700, 250, 150, 30, -4, 0.06], [980, 300, 260, 46, 3, 0.05], [800, 440, 300, 40, -2, 0.045], [1160, 220, 140, 26, 6, 0.05], [1120, 470, 180, 34, -5, 0.04]]
      .forEach(([x, y, rw, rh, a, o]) => svg("ellipse", { cx: x, cy: y, rx: rw / 2, ry: rh / 2, opacity: o, transform: `rotate(${a} ${x} ${y})` }, ghost));
    [[668, 206, 90], [1120, 506, 110]].forEach(([x, y, len]) => svg("path", { d: `M ${x} ${y} q ${len / 2} -8 ${len} 2`, stroke: C.cream, "stroke-width": 3, fill: "none", opacity: 0.12, "stroke-linecap": "round" }, LB));
    R(LB, 586, 546, 718, 18, C.woodLt, { rx: 4, filter: "url(#card2)" });
    R(LB, 590, 560, 710, 6, C.woodDk, { rx: 3 });
    const chalks = svg("g", { filter: "url(#lift)" }, LB);
    [[690, C.cream, 34], [736, C.mustard, 26], [770, "#f08aa0", 22], [1090, C.sky, 30]].forEach(([x, c, len]) => R(chalks, x, 538, len, 9, c, { rx: 4 }));
    R(chalks, 1170, 530, 74, 16, C.kraft, { rx: 3 });
    R(chalks, 1170, 540, 74, 7, C.navy, { rx: 2 });
    // alphabet strip
    const cols = [C.tomato, C.teal, C.plum, C.mustardDk, C.sky];
    "ABCDEFGHIJ".split("").forEach((ch, i) => {
      const x = 604 + i * 69, a = ((i * 37) % 5 - 2) * 0.7;
      const g = svg("g", { filter: "url(#card1)", transform: `rotate(${a} ${x + 31} 98)` }, LB);
      R(g, x, 96, 62, 50, C.cream, { rx: 3 });
      R(g, x, 96, 62, 7, cols[i % 5], { rx: 2 });
      T(g, x + 31, 136, ch + ch.toLowerCase(), { "font-family": "Bricolage", "font-weight": 800, "font-size": 27, fill: cols[i % 5] });
    });
    // clock face (hands live on their own small layer)
    const CK = { x: 1440, y: 262, r: 56 };
    const clock = svg("g", { filter: "url(#card2)" }, LB);
    svg("circle", { cx: CK.x, cy: CK.y, r: CK.r + 9, fill: C.navy }, clock);
    svg("circle", { cx: CK.x, cy: CK.y, r: CK.r, fill: C.cream }, clock);
    for (let i = 0; i < 12; i++) {
      const a = (i * Math.PI) / 6, r1 = i % 3 ? CK.r - 9 : CK.r - 15;
      svg("line", { x1: CK.x + r1 * Math.sin(a), y1: CK.y - r1 * Math.cos(a), x2: CK.x + (CK.r - 4) * Math.sin(a), y2: CK.y - (CK.r - 4) * Math.cos(a), stroke: C.ink, "stroke-width": i % 3 ? 2.5 : 4.5, "stroke-linecap": "round" }, clock);
    }
    // posters on the right wall
    const p1 = svg("g", { filter: "url(#card2)", transform: "rotate(-1.5 1650 290)" }, LB);
    R(p1, 1566, 170, 172, 236, C.cream, { rx: 4 });
    R(p1, 1566, 170, 172, 236, "none", { rx: 4, stroke: C.tomato, "stroke-width": 6 });
    T(p1, 1652, 262, "Aa", { "font-family": "Fraunces", "font-weight": 900, "font-size": 78, fill: C.tomato });
    svg("path", { d: "M 1652 300 C 1624 286 1606 312 1612 336 C 1618 362 1640 374 1652 366 C 1664 374 1686 362 1692 336 C 1698 312 1680 286 1652 300 Z", fill: C.tomato }, p1);
    svg("path", { d: "M 1652 300 Q 1650 288 1656 280", stroke: C.woodDk, "stroke-width": 4, fill: "none", "stroke-linecap": "round" }, p1);
    svg("path", { d: "M 1656 286 Q 1672 274 1684 284 Q 1670 294 1656 286 Z", fill: C.leaf }, p1);
    T(p1, 1652, 394, "apple", { "font-family": "Fraunces", "font-style": "italic", "font-weight": 600, "font-size": 24, fill: C.ink });
    const p2 = svg("g", { filter: "url(#card2)", transform: "rotate(2 1830 300)" }, LB);
    R(p2, 1762, 206, 140, 190, C.mustard, { rx: 4 });
    T(p2, 1832, 262, "1 2 3", { "font-family": "Bricolage", "font-weight": 800, "font-size": 38, fill: C.ink });
    [[1, 300], [2, 334], [3, 368]].forEach(([n, y]) => { for (let k = 0; k < n; k++) svg("circle", { cx: 1832 + (k - (n - 1) / 2) * 26, cy: y, r: 9, fill: [C.tomato, C.teal, C.plum][n - 1] }, p2); });
    [[1574, 178], [1730, 178], [1832, 214]].forEach(([x, y]) => svg("circle", { cx: x, cy: y, r: 5, fill: "url(#brass)" }, LB));

    /* ---- chalk text (redrawn only when the string changes) and the chalk stick that writes it */
    const LT = w.layer(0.52);
    const clipId = id + "clip";
    const clip = svg("clipPath", { id: clipId }, svg("defs", {}, LT));
    const chalkG = svg("g", { "clip-path": `url(#${clipId})`, filter: `url(#${id}chalk)`, opacity: 0.9 }, LT);
    const stick = svg("g", { filter: "url(#lift)", opacity: 0 }, LT);
    R(stick, -4, -30, 9, 34, C.cream, { rx: 4, transform: "rotate(28)" });
    let board = null, lines = [], fontsOk = false, lastU = -1;
    const layoutBoard = (str) => {
      chalkG.innerHTML = ""; clip.innerHTML = "";
      const rows = str ? str.split("\n") : [];
      const els = rows.map((s) => { const e = svg("text", { x: 0, y: 0, "font-family": "Fraunces", "font-style": "italic", "font-weight": 600, "font-size": 100, fill: C.cream }, chalkG); e.textContent = s; return e; });
      const ws = els.map((e) => e.getComputedTextLength() || 0.5 * 100 * e.textContent.length);
      // fit inside 530 x 320 so the whole board still reads in a 9:16 Short
      const size = Math.min(104, (530 / Math.max(1, ...ws)) * 100, 320 / (Math.max(1, rows.length) * 1.16));
      const lh = size * 1.16, top = bcy - (rows.length * lh) / 2 + size * 0.8;
      lines = els.map((e, i) => {
        const wd = (ws[i] * size) / 100, x0 = bcx - wd / 2, y = top + i * lh;
        e.setAttribute("font-size", size.toFixed(1)); e.setAttribute("x", x0.toFixed(1)); e.setAttribute("y", y.toFixed(1));
        const rc = R(clip, x0 - size * 0.25, y - size * 0.95, 0, size * 1.3, "#fff");
        return { x0, y, wd, rc, size };
      });
      fontsOk = document.fonts.status === "loaded";
      lastU = -1;
    };
    const writeBoard = (u, t) => {
      const total = lines.reduce((a, l) => a + l.wd, 0);
      let left = u * total, head = null;
      lines.forEach((l) => {
        const got = clamp(left / l.wd);
        left -= l.wd;
        l.rc.setAttribute("width", got <= 0 ? 0 : got >= 1 ? l.wd + l.size * 0.7 : l.size * 0.25 + got * l.wd);
        if (got > 0 && got < 1) head = { x: l.x0 + got * l.wd, y: l.y - l.size * 0.28, s: l.size };
      });
      if (head && u > 0 && u < 1) {
        stick.setAttribute("transform", `translate(${(head.x + 6).toFixed(1)} ${(head.y + 4 * Math.sin(t * 31)).toFixed(1)}) scale(${(head.s / 90).toFixed(2)})`);
        stick.setAttribute("opacity", 1);
      } else stick.setAttribute("opacity", 0);
    };

    /* ---- clock hands */
    const LK = w.layer(0.52);
    const hHand = R(LK, CK.x - 4, CK.y - 34, 8, 40, C.ink, { rx: 4, filter: "url(#lift)" });
    const mHand = R(LK, CK.x - 2.5, CK.y - 50, 5, 56, C.tomato, { rx: 2.5, filter: "url(#lift)" });
    svg("circle", { cx: CK.x, cy: CK.y, r: 5, fill: "url(#brass)" }, LK);

    /* ---- floor (static) */
    const LF = w.layer(0.85);
    R(LF, -300, 790, 2520, 510, C.wood, { filter: "url(#card1)" });
    const fl = svg("g", { stroke: "#653b2b", "stroke-width": 3, "stroke-linecap": "round" }, LF);
    let y0 = 790;
    for (let i = 0; i < 9; i++) {
      const y1 = 812 + i * i * 7 + i * 24;
      svg("line", { x1: -300, y1, x2: 2220, y2: y1 }, fl);
      const gap = 260 + i * 60, off = (i * 173) % gap;
      for (let x = -300 + off; x < 2220; x += gap) svg("line", { x1: x, y1: y0 + 3, x2: x, y2: y1 - 3 }, fl);
      y0 = y1;
    }

    /* ---- bookshelf under the window (static) */
    const LS = w.layer(0.7);
    const shelf = svg("g", { filter: "url(#card2)" }, LS);
    R(shelf, 176, 626, 352, 186, C.wood, { rx: 5 });
    R(shelf, 192, 642, 320, 66, C.woodDk);
    R(shelf, 192, 724, 320, 66, C.woodDk);
    R(shelf, 170, 620, 364, 14, C.woodLt, { rx: 4 });
    const bookC = [C.tomato, C.teal, C.mustard, C.plum, C.sky, C.cream, C.mustardDk, "#3f6b4e"];
    const books = svg("g", { filter: "url(#lift)" }, LS);
    const rb = PT.rng(5);
    [[708, 198, 500], [790, 198, 470]].forEach(([base, xa, xb], row) => {
      let x = xa;
      while (x < xb) {
        const bw = 14 + Math.floor(rb() * 12), bh = 42 + Math.floor(rb() * 20), c = bookC[Math.floor(rb() * bookC.length)];
        const lean = rb() < 0.12 ? 8 : 0;
        const g = svg("g", { transform: lean ? `rotate(${lean} ${x + bw} ${base})` : "" }, books);
        R(g, x, base - bh, bw, bh, c, { rx: 2 });
        R(g, x + 2, base - bh + 8, bw - 4, 4, C.cream, { opacity: 0.55 });
        x += bw + 2 + (lean ? 10 : 0);
      }
      if (row === 0) { R(books, 440, 694, 64, 14, C.sky, { rx: 2 }); R(books, 446, 682, 54, 12, C.tomato, { rx: 2 }); }
    });
    const globe = svg("g", { filter: "url(#card2)" }, LS);
    svg("path", { d: "M 452 620 L 468 604 L 484 620 Z", fill: "url(#brass)" }, globe);
    svg("circle", { cx: 468, cy: 576, r: 30, fill: `url(#${id}globe)` }, globe);
    svg("path", { d: "M 452 560 q 10 -6 18 2 q 6 10 -4 16 q -8 2 -10 12 q -10 -10 -4 -30 Z M 478 584 q 10 -4 12 6 q -2 10 -12 8 Z", fill: "#6fae6a" }, globe);
    svg("path", { d: "M 440 562 A 34 34 0 0 1 496 590", stroke: "url(#brass)", "stroke-width": 4, fill: "none" }, globe);
    const fp = svg("g", { filter: "url(#card2)" }, LS);
    [[-34, -20, 1.0], [-14, -6, 1.15], [8, 8, 1.1], [28, 22, 0.95], [-2, -2, 0.8]].forEach(([dx, a, sc]) =>
      svg("path", { d: "M 0 0 C -22 -50 -14 -110 10 -140 C 30 -104 26 -46 0 0 Z", fill: a % 4 ? C.leaf : "#46775a", transform: `translate(${96 + dx * 0.5} 742) rotate(${a}) scale(${sc})` }, fp));
    svg("path", { d: "M 58 738 H 134 L 124 812 H 68 Z", fill: C.mustardDk }, fp);
    R(fp, 52, 730, 88, 14, C.mustard, { rx: 4 });
    const stackL = svg("g", { filter: "url(#lift)" }, LS);
    [[210, 604, 88, C.teal], [216, 590, 76, C.mustard], [206, 576, 92, C.plum]].forEach(([x, y, bw, c]) => R(stackL, x, y, bw, 15, c, { rx: 2 }));

    /* ---- paper bunting across the ceiling: flags sway on their own small layer */
    const LBu = w.layer(0.62);
    const swags = [[-300, 12, 330, 112, 960, 12], [960, 12, 1590, 112, 2220, 12]];
    svg("path", { d: swags.map(([a, b, c, d, e, f], i) => `${i ? "" : `M ${a} ${b} `}Q ${c} ${d} ${e} ${f}`).join(" "), stroke: "#8a6a4a", "stroke-width": 2.4, fill: "none" }, LBu);
    const flagC = [C.tomato, C.mustard, C.teal, C.plum, C.sky, C.cream];
    const flags = [];
    swags.forEach(([ax, ay, cx, cy, bx, by], s) => {
      for (let k = 1; k < 18; k++) {
        const u = k / 18, x = (1 - u) * (1 - u) * ax + 2 * u * (1 - u) * cx + u * u * bx, y = (1 - u) * (1 - u) * ay + 2 * u * (1 - u) * cy + u * u * by;
        const dx = 2 * (1 - u) * (cx - ax) + 2 * u * (bx - cx), dy = 2 * (1 - u) * (cy - ay) + 2 * u * (by - cy);
        const tilt = (Math.atan2(dy, dx) * 180) / Math.PI, n = s * 17 + k;
        const g = svg("g", { filter: "url(#card1)" }, LBu);
        svg("path", { d: "M -23 0 L 23 0 L 0 50 Z", fill: flagC[n % flagC.length] }, g);
        flags.push({ g, x, y, tilt, ph: n * 0.55 });
      }
    });

    /* ---- teacher's desk with an apple (static) */
    const LD = w.layer(0.92);
    const td = svg("g", { filter: "url(#card2)" }, LD);
    R(td, 1534, 696, 150, 166, C.wood);
    R(td, 1684, 696, 196, 128, C.woodDk);
    R(td, 1858, 696, 26, 166, C.wood);
    [728, 778, 826].forEach((y) => { R(td, 1548, y - 18, 122, 40, C.woodLt, { rx: 3 }); svg("circle", { cx: 1609, cy: y + 2, r: 5.5, fill: "url(#brass)" }, td); });
    R(td, 1508, 676, 396, 24, C.woodLt, { rx: 5 });
    R(td, 1508, 694, 396, 6, C.woodDk, { rx: 3 });
    const items = svg("g", { filter: "url(#lift)" }, LD);
    [[1700, 660, 104, C.teal], [1708, 644, 90, C.cream], [1702, 628, 100, C.tomato]].forEach(([x, y, bw, c]) => R(items, x, y, bw, 16, c, { rx: 2 }));
    R(items, 1820, 630, 44, 48, C.sky, { rx: 5 });
    [[1830, C.mustard, -8], [1842, C.tomato, 4], [1852, C.mustard, 12]].forEach(([x, c, a]) => R(items, x - 3, 598, 7, 40, c, { rx: 2, transform: `rotate(${a} ${x} 630)` }));
    R(items, 1620, 664, 62, 14, C.cream, { rx: 2, transform: "rotate(-4 1650 670)" });
    const apple = svg("g", { filter: "url(#card1)" }, LD);
    svg("path", { d: "M 1574 646 C 1552 632 1534 652 1540 672 C 1546 690 1564 694 1574 688 C 1584 694 1602 690 1608 672 C 1614 652 1596 632 1574 646 Z", fill: C.tomato }, apple);
    svg("path", { d: "M 1574 646 Q 1572 634 1578 626", stroke: C.woodDk, "stroke-width": 4, fill: "none", "stroke-linecap": "round" }, apple);
    svg("path", { d: "M 1577 632 Q 1592 620 1604 630 Q 1590 640 1577 632 Z", fill: C.leaf }, apple);
    svg("ellipse", { cx: 1558, cy: 658, rx: 6, ry: 9, fill: "#fff1d6", opacity: 0.45, transform: "rotate(30 1558 658)" }, apple);

    /* ---- daylight through the window: the set's practical light (screen) */
    const Lg = w.layer(0.6, { mixBlendMode: "screen" });
    svg("circle", { cx: 350, cy: 380, r: 420, fill: `url(#${id}bloom)` }, Lg);
    svg("polygon", { points: "214,560 500,560 1010,1100 470,1100", fill: `url(#${id}beam)`, filter: "url(#glow)" }, Lg);
    svg("path", { d: "M 520 840 L 690 840 L 790 940 L 600 940 Z M 706 840 L 876 840 L 990 940 L 806 940 Z", fill: "#fff2cf", opacity: 0.2, filter: "url(#glow)" }, Lg);

    /* ---- student desks: chairs behind the puppets, desks in front of them */
    const desks = [{ x: 690, y: 1012 }, { x: 960, y: 1012 }, { x: 1230, y: 1012 }];
    const LCh = w.layer(1.0);
    desks.forEach(({ x, y }) => {
      const c = svg("g", { filter: "url(#card1)" }, LCh);
      R(c, x - 62, y - 64, 7, 70, C.navy, { rx: 3 }); R(c, x + 55, y - 64, 7, 70, C.navy, { rx: 3 });
      R(c, x - 52, y - 120, 9, 70, C.woodDk); R(c, x + 43, y - 120, 9, 70, C.woodDk);
      R(c, x - 68, y - 168, 136, 48, C.woodLt, { rx: 14 });
      R(c, x - 56, y - 159, 112, 6, "#ffffff", { rx: 3, opacity: 0.2 });
    });
    const P = w.layer(1.0);
    const LDk = w.layer(1.0);
    desks.forEach(({ x, y }, i) => {
      const d = svg("g", { filter: "url(#card2)" }, LDk);
      R(d, x - 98, y - 44, 11, 50, C.navy, { rx: 3 }); R(d, x + 87, y - 44, 11, 50, C.navy, { rx: 3 });
      R(d, x - 104, y - 6, 23, 9, C.ink, { rx: 3 }); R(d, x + 81, y - 6, 23, 9, C.ink, { rx: 3 });
      R(d, x - 104, y - 88, 208, 50, C.mustardDk, { rx: 4 });
      R(d, x - 104, y - 88, 208, 8, C.mustard, { rx: 3 });
      R(d, x - 116, y - 104, 232, 20, C.kraft, { rx: 5 });
      R(d, x - 116, y - 90, 232, 6, C.kraftDk, { rx: 3 });
      const it = svg("g", { filter: "url(#lift)" }, LDk);
      if (i === 0) { R(it, x - 92, y - 112, 62, 9, C.cream, { rx: 2 }); R(it, x - 32, y - 112, 62, 9, "#efe0c4", { rx: 2 }); R(it, x - 50, y - 120, 6, 44, C.mustard, { rx: 2, transform: `rotate(78 ${x - 47} ${y - 116})` }); }
      if (i === 1) { R(it, x + 34, y - 116, 64, 13, C.plum, { rx: 2 }); R(it, x + 38, y - 126, 56, 11, C.sky, { rx: 2 }); }
      if (i === 2) { R(it, x - 100, y - 114, 56, 11, C.teal, { rx: 5 }); R(it, x + 28, y - 110, 70, 7, "#efe0c4", { rx: 1 }); }
    });

    /* ---- cast */
    let Pf = null;
    const people = cast.map((c) => {
      const layer = c.front ? (Pf = Pf || w.layer(1.0)) : P;
      return { c, p: PT.puppet(layer, { shirt: c.shirt, pants: c.pants, hair: c.hair, hairStyle: c.hairStyle || "short", glasses: c.glasses }) };
    });
    const spot = (c) => {
      const d = c.desk != null ? desks[c.desk] : null;
      return { x: c.x ?? (d ? d.x : 1420), y: c.y ?? (d ? d.y : 905), s: c.s ?? (d ? 0.9 : 1.25), hs: c.hs ?? (d ? 1.3 : 1), sit: c.sit ?? (d ? 1 : 0) };
    };
    // further back draws first
    people.slice().sort((a, b) => spot(a.c).y - spot(b.c).y).forEach(({ p }) => p.root.parentNode.appendChild(p.root));

    /* ---- out-of-focus foreground: a classroom plant (left) and a stack of books (right) */
    const Lfg = w.layer(1.55);
    const fgL = svg("g", { filter: "url(#dof)" }, Lfg);
    [[-80, 1130, -30, 1.3], [20, 1150, -10, 1.1], [110, 1160, 16, 0.9], [-150, 1100, -48, 1.0]].forEach(([x, y, a, s]) =>
      svg("path", { d: "M 0 0 C -60 -120 -40 -260 60 -330 C 140 -250 140 -110 0 0 Z", fill: "#2b6150", transform: `translate(${x} ${y}) rotate(${a}) scale(${s})` }, fgL));
    const fgR = svg("g", { filter: "url(#dof)" }, Lfg);
    [[1720, 1050, 360, C.tomato], [1744, 996, 330, C.mustardDk], [1706, 944, 350, C.teal]].forEach(([x, y, bw, c]) => R(fgR, x, y, bw, 54, c, { rx: 6 }));
    R(fgR, 1730, 956, 330, 9, C.cream, { opacity: 0.6 });

    const dimEl = html("div", { style: { position: "absolute", inset: 0, background: "#0d1430", opacity: 0, pointerEvents: "none" } }, w.root);
    // moonlight through the window once the room is dark (above the dimming, so it reads)
    const Lm = w.layer(0.6, { mixBlendMode: "screen" });
    svg("polygon", { points: "214,560 500,560 1010,1100 470,1100", fill: `url(#${id}moonbeam)`, filter: "url(#glow)" }, Lm);
    svg("circle", { cx: 350, cy: 380, r: 300, fill: `url(#${id}moonbloom)` }, Lm);
    Lm.parentNode.style.opacity = 0;
    w.overlay("vignette");

    const anchors = {
      board: { x: 945, y: 520, z: 1.0 },
      window: { x: -160, y: 470, z: 1.22 },
      clock: { x: 1810, y: 5, z: 2.0 },
      teacher: { x: 1400, y: 560, z: 1.05, feet: { x: 1420, y: 905 } },
      desks,
    };

    function update(t, st = {}) {
      const k = st.sky ?? 0;
      op(skies[0], k >= 0.5 ? 0 : 1); op(skies[1], k >= 1 ? 0 : clamp(k * 2)); op(skies[2], clamp(k * 2 - 1));
      op(nightL.parentNode, clamp(k * 2.2 - 1.2)); op(yardNight.parentNode, clamp(k * 2 - 0.9) * 0.9);
      op(Lg.parentNode, 1 - clamp(k * 1.6 - 0.1));
      cloudS.style.transform = `translate(${((t * 9) % 640).toFixed(1)}px, 0px)`;
      const dim = st.dim ?? clamp(k * 2.4 - 1.4);
    op(dimEl, 0.42 * dim); op(Lm.parentNode, dim * clamp(k * 2 - 1));
      flags.forEach((f) => f.g.setAttribute("transform", `translate(${f.x.toFixed(1)} ${f.y.toFixed(1)}) rotate(${(f.tilt + 5 * Math.sin(t * 1.25 + f.ph)).toFixed(2)})`));
      const m = st.clock ?? 8 * 60 + 50;
      mHand.setAttribute("transform", `rotate(${((m % 60) * 6).toFixed(2)} ${CK.x} ${CK.y})`);
      hHand.setAttribute("transform", `rotate(${(((m / 60) % 12) * 30).toFixed(2)} ${CK.x} ${CK.y})`);
      const str = st.board ?? "";
      if (str !== board || (!fontsOk && document.fonts.status === "loaded")) { board = str; layoutBoard(str); }
      const u = clamp(st.boardU ?? 1);
      if (u !== lastU || (u > 0 && u < 1)) { writeBoard(u, t); lastU = u; }
      people.forEach(({ c, p }, i) => {
        const q = spot(c), seated = q.sit > 0.5;
        p.pose(Object.assign({ x: q.x, y: q.y, s: q.s, hs: q.hs, sit: q.sit, bob: (seated ? 1.1 : 1.8) * Math.sin(t * 1.9 + i),
          armF: seated ? 14 : -9, armB: seated ? -14 : 9, blink: K.blink(t, 1e9, 1.2 + i * 0.7) }, (st.cast || [])[i] || {}));
      });
    }
    return { update, anchors, people };
  };
})();
