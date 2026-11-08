/* Buh Essays production kit: reusable parts for every episode, on top of stage.js (window.PT).
 *
 * An episode scene is a short script that:
 *   1. K.init({format: "short" | "long"})        -> 1080x1920 or 1920x1080 stage
 *   2. builds a world (K.world + K.loc.*), HUD and text (K.hud, K.banner, K.say), riso pages (K.riso.*)
 *   3. keys every beat to the narration with K.vo.line(i) / K.vo.word("dec2")
 *   4. calls K.finish(seekFn, endTime)
 * Worlds are authored once at 1920x1080. The camera frames them for either format: a Short shows a 607-unit-wide
 * slice at 1.78x, so the same room works in both and camera pans between subjects come for free.
 */
(function () {
  const { svg, html, seg, ease, lerp, clamp, spring } = PT;
  const K = {};
  let uid = 0;
  K.uid = (p = "k") => `${p}${++uid}`;

  /* ---------------------------------------------------------------- stage + formats */
  K.FORMATS = { short: { W: 1080, H: 1920 }, long: { W: 1920, H: 1080 } };
  K.init = ({ format = "short", fps = 24, grain = 0.24 } = {}) => {
    const F = K.FORMATS[format];
    K.format = format; K.W = F.W; K.H = F.H; K.fps = fps; K.s0 = F.H / 1080;
    const stage = document.getElementById("stage");
    Object.assign(stage.style, { width: F.W + "px", height: F.H + "px", perspective: (F.W * 1.4) + "px" });
    PT.defs(stage);
    K.stage = stage;
    K.cues = [];
    K._grain = () => {};
    K._grainOpacity = grain;
    return K;
  };
  K.cue = (t, type, extra = {}) => { if (isFinite(t)) K.cues.push({ t, type, ...extra }); };
  K.finish = (seekFn, end) => {
    const grainUpdate = PT.grain(K.stage, K._grainOpacity);
    window.SCENE = { duration: end, fps: K.fps, width: K.W, height: K.H };
    if (window.VO && VO.src) K.cue(VO.offset, "vo", { src: VO.src });
    window.CUES = K.cues.sort((a, b) => a.t - b.t);
    window.seek = (t) => { grainUpdate(t, K.fps); seekFn(t); };
    window.seek(0);
  };

  /* ---------------------------------------------------------------- narration timing */
  // window.VO = {src, offset, words: [{w, s, e}], lines: [{text, s, e}]}, written by make.py narrate.
  K.vo = {
    get on() { return !!window.VO; },
    line(i) { return VO.lines[i].s + VO.offset; },
    lineEnd(i) { return VO.lines[i].e + VO.offset; },
    /* w can be a list of spellings, e.g. ["six", "6"]: Whisper writes some numbers as digits */
    word(w, n = 1, key = "s") {
      const norm = (x) => x.toLowerCase().replace(/[^a-z0-9]/g, "");
      const alts = (Array.isArray(w) ? w : [w]).map(norm);
      const hits = VO.words.filter((x) => alts.some((a) => norm(x.w) === a || (a.length > 3 && norm(x.w).startsWith(a))));
      if (hits.length < n) throw new Error(`narration has no ${n}x "${alts.join("/")}"`);
      return hits[n - 1][key] + VO.offset;
    },
    wordEnd(w, n = 1) { return K.vo.word(w, n, "e"); },
    /* the word w inside narration line i (spellings list allowed). Use this instead of word(): no ambiguity. */
    at(i, w, key = "s") {
      const norm = (x) => x.toLowerCase().replace(/[^a-z0-9]/g, "");
      const Ln = VO.lines[i], alts = (Array.isArray(w) ? w : [w]).map(norm);
      const hit = VO.words.find((x) => x.s >= Ln.s - 0.05 && x.s <= Ln.e + 0.05 && alts.some((a) => norm(x.w) === a || (a.length > 3 && norm(x.w).startsWith(a))));
      if (!hit) { console.warn(`line ${i} has no "${alts.join("/")}", using line ${key === "s" ? "start" : "end"}`); return (key === "s" ? Ln.s : Ln.e) + VO.offset; }
      return hit[key] + VO.offset;
    },
    atEnd(i, w) { return K.vo.at(i, w, "e"); },
    /* start of the k-th word inside line i (0-based), for word-by-word type */
    wordsOf(i) { const L = VO.lines[i]; return VO.words.filter((x) => x.s >= L.s - 0.01 && x.e <= L.e + 0.01).map((x) => x.s + VO.offset); },
    get end() { return VO.lines[VO.lines.length - 1].e + VO.offset; },
  };

  /* ---------------------------------------------------------------- camera keys */
  // K.keys([[t, {x, y, z}], ...]) -> f(t) with eased moves between keys and a slow drift so nothing ever holds still.
  K.keys = (keys, { drift = 10 } = {}) => (t) => {
    let i = 0;
    while (i < keys.length - 1 && t > keys[i + 1][0]) i++;
    const [t0, a] = keys[i], [t1, b] = keys[Math.min(i + 1, keys.length - 1)];
    const u = t1 > t0 ? ease.inOutSine(clamp((t - t0) / (t1 - t0))) : 1;
    const c = { x: lerp(a.x, b.x, u), y: lerp(a.y, b.y, u), z: lerp(a.z ?? 1, b.z ?? 1, u) };
    c.x += drift * Math.sin(t * 0.21); c.y += drift * 0.4 * Math.sin(t * 0.17 + 1);
    return c;
  };

  /* ---------------------------------------------------------------- worlds */
  K.world = (parent, { bg = "#263457" } = {}) => {
    const root = html("div", { class: "scene", style: { background: bg } }, parent);
    const layers = [];
    const w = {
      root,
      defs: svg("defs", {}, svg("svg", { width: 0, height: 0, style: "position:absolute" }, root)),
      layer(depth, style = {}) {
        const d = html("div", { class: "layer", style: Object.assign({ transformOrigin: "0 0" }, style) }, root);
        const s = svg("svg", { width: 1920, height: 1080, viewBox: "0 0 1920 1080" }, d);
        layers.push([d, depth]);
        return s;
      },
      overlay(cls = "vignette") { return html("div", { class: cls }, root); },
      // camera: (x, y) is the world point at the centre of the frame; z zooms; each plane moves by its depth.
      camera({ x = 960, y = 540, z = 1 }) {
        layers.forEach(([el, d]) => {
          const s = K.s0 * (1 + (z - 1) * d);
          const cx = 960 + (x - 960) * d, cy = 540 + (y - 540) * d;
          el.style.transform = `translate(${K.W / 2 - cx * s}px, ${K.H / 2 - cy * s}px) scale(${s})`;
        });
      },
    };
    return w;
  };

  /* ---------------------------------------------------------------- locations */
  K.loc = {};
  /* Night bedroom: window with moon and hanging stars, clock, lamp, nightstand with a growing book stack, bed with
   * a sleeping partner, and you. update(t, {clock: minutes, tag: 0..1, books: n, you: puppet pose}). */
  K.loc.bedroom = (w, { you = {}, partner = "#2a9d8f" } = {}) => {
    const C = { wall: "#263457", wall2: "#2e3e66", trim: "#3d4f80", cream: "#f6ecd9", kraft: "#d4a777", ink: "#1c1f2e",
      moon: "#f3e7c4", wood: "#7b4a36", woodDk: "#5e3829", floor: "#3a2e40", rug: "#5b3f63", curtain: "#cf8f2e" };
    const id = K.uid("bed");
    w.defs.innerHTML += `
      <linearGradient id="${id}sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0e152d"/><stop offset="1" stop-color="#26365f"/></linearGradient>
      <radialGradient id="${id}lamp"><stop offset="0" stop-color="#ffcf8a" stop-opacity="0.95"/><stop offset="0.35" stop-color="#ff9e48" stop-opacity="0.35"/><stop offset="1" stop-color="#ff9e48" stop-opacity="0"/></radialGradient>
      <radialGradient id="${id}moon"><stop offset="0" stop-color="#e9efff" stop-opacity="0.55"/><stop offset="1" stop-color="#e9efff" stop-opacity="0"/></radialGradient>
      <linearGradient id="${id}beam" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#dfe8ff" stop-opacity="0.22"/><stop offset="1" stop-color="#dfe8ff" stop-opacity="0"/></linearGradient>
      <linearGradient id="${id}shade" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff2d8"/><stop offset="1" stop-color="#ffd59a"/></linearGradient>
      <clipPath id="${id}win"><rect x="560" y="140" width="560" height="520"/></clipPath>
      <pattern id="${id}tri" width="46" height="40" patternUnits="userSpaceOnUse"><path d="M 8 30 L 23 8 L 38 30 Z" fill="#3fb5a5"/></pattern>`;
    const L0 = w.layer(0.5);
    svg("rect", { x: -900, y: -600, width: 3720, height: 2280, fill: C.wall, filter: "url(#card0)" }, L0);
    svg("rect", { x: -900, y: -600, width: 3720, height: 1400, fill: "url(#moons)", opacity: 0.7 }, L0);
    svg("rect", { x: -900, y: 730, width: 3720, height: 26, fill: C.wall2, filter: "url(#card1)" }, L0);
    const L1 = w.layer(0.6);
    const winG = svg("g", { "clip-path": `url(#${id}win)` }, L1);
    svg("rect", { x: 560, y: 140, width: 560, height: 520, fill: `url(#${id}sky)` }, winG);
    svg("circle", { cx: 745, cy: 285, r: 190, fill: `url(#${id}moon)` }, winG);
    const moon = svg("g", { filter: "url(#card1)" }, winG);
    svg("circle", { cx: 745, cy: 285, r: 60, fill: C.moon }, moon);
    [[722, 266, 11], [768, 300, 8], [740, 318, 6], [770, 262, 5]].forEach(([x, y, r]) => svg("circle", { cx: x, cy: y, r, fill: "#e0cfa2" }, moon));
    const hills = svg("g", { filter: "url(#card1)" }, winG);
    svg("path", { d: "M 540 600 Q 660 520 800 570 T 1140 540 L 1140 680 L 540 680 Z", fill: "#1d2a4c" }, hills);
    svg("path", { d: "M 540 640 Q 700 590 880 625 T 1140 610 L 1140 680 L 540 680 Z", fill: "#16203c" }, hills);
    const house = svg("g", { filter: "url(#card1)" }, winG);
    svg("path", { d: "M 950 575 L 985 548 L 1020 575 L 1020 612 L 950 612 Z", fill: "#121a31" }, house);
    const houseLight = svg("rect", { x: 975, y: 582, width: 14, height: 14, fill: "#ffcf7a" }, house);
    const stars = [[606, 70, 15, 1], [664, 150, 12, 2], [858, 52, 13, 3], [944, 120, 16, 4], [1048, 84, 12, 5], [1090, 190, 10, 6]]
      .map(([x, len, r, seed]) => PT.hangingStar(winG, { x, top: 140, len, r, seed }));
    svg("path", { d: "M 528 108 H 1152 V 692 H 528 Z M 560 140 V 660 H 1120 V 140 Z M 833 140 h 14 v 520 h -14 Z M 560 396 h 560 v 14 h -560 Z",
      fill: C.trim, "fill-rule": "evenodd", filter: "url(#card2)" }, L1);
    svg("rect", { x: 500, y: 688, width: 680, height: 28, rx: 4, fill: "#c9b49a", filter: "url(#card2)" }, L1);
    const Lc = w.layer(0.66);
    svg("rect", { x: 440, y: 88, width: 800, height: 12, rx: 6, fill: C.woodDk, filter: "url(#card2)" }, Lc);
    const curtL = svg("path", { d: "M 452 96 H 584 V 640 Q 562 662 540 640 Q 518 662 496 640 Q 474 662 452 640 Z", fill: C.curtain, filter: "url(#card3)" }, Lc);
    const curtR = svg("path", { d: "M 1096 96 H 1228 V 640 Q 1206 662 1184 640 Q 1162 662 1140 640 Q 1118 662 1096 640 Z", fill: C.curtain, filter: "url(#card3)" }, Lc);
    const Lk = w.layer(0.62);
    const CK = { x: 1330, y: 260, r: 76 };
    const clock = svg("g", { filter: "url(#card2)" }, Lk);
    svg("circle", { cx: CK.x, cy: CK.y, r: CK.r + 10, fill: C.woodDk }, clock);
    svg("circle", { cx: CK.x, cy: CK.y, r: CK.r, fill: C.cream }, clock);
    for (let i = 0; i < 12; i++) {
      const a = (i * Math.PI) / 6, r1 = i % 3 ? CK.r - 12 : CK.r - 20;
      svg("line", { x1: CK.x + r1 * Math.sin(a), y1: CK.y - r1 * Math.cos(a), x2: CK.x + (CK.r - 6) * Math.sin(a), y2: CK.y - (CK.r - 6) * Math.cos(a), stroke: C.ink, "stroke-width": i % 3 ? 3 : 5, "stroke-linecap": "round" }, clock);
    }
    const hHand = svg("rect", { x: CK.x - 4, y: CK.y - 44, width: 8, height: 50, rx: 4, fill: C.ink }, Lk);
    const mHand = svg("rect", { x: CK.x - 3, y: CK.y - 64, width: 6, height: 70, rx: 3, fill: "#e4572e" }, Lk);
    svg("circle", { cx: CK.x, cy: CK.y, r: 6, fill: "url(#brass)" }, Lk);
    const tag = svg("text", { x: CK.x, y: CK.y + 128, "text-anchor": "middle", "font-family": "Bricolage", "font-weight": 700, "font-size": 26, "letter-spacing": 3, fill: C.cream }, Lk);
    tag.textContent = "";
    const Lf = w.layer(0.85);
    svg("rect", { x: -900, y: 756, width: 3720, height: 900, fill: C.floor, filter: "url(#card1)" }, Lf);
    for (let i = 0; i < 9; i++) svg("line", { x1: -900, y1: 800 + i * i * 7 + i * 22, x2: 2820, y2: 800 + i * i * 7 + i * 22, stroke: "#2f2535", "stroke-width": 3 }, Lf);
    const rug = svg("g", { filter: "url(#card2)" }, Lf);
    svg("ellipse", { cx: 930, cy: 930, rx: 560, ry: 82, fill: C.rug }, rug);
    svg("ellipse", { cx: 930, cy: 930, rx: 520, ry: 66, fill: "none", stroke: "#e2a86b", "stroke-width": 5, "stroke-dasharray": "2 16", "stroke-linecap": "round" }, rug);
    const Ll = w.layer(0.8);
    const stand = svg("g", { filter: "url(#card2)" }, Ll);
    svg("rect", { x: 170, y: 640, width: 250, height: 160, rx: 8, fill: C.wood }, stand);
    svg("rect", { x: 190, y: 690, width: 210, height: 12, rx: 4, fill: C.woodDk }, stand);
    svg("circle", { cx: 295, cy: 740, r: 8, fill: "url(#brass)" }, stand);
    svg("rect", { x: 186, y: 800, width: 18, height: 60, fill: C.woodDk }, stand);
    svg("rect", { x: 386, y: 800, width: 18, height: 60, fill: C.woodDk }, stand);
    // the book stack grows one pop-up book at a time
    const bookColors = ["#2a9d8f", "#cf8f2e", "#e4572e", "#7b4b94", "#5aa9e6", "#f2b134", "#3f6b4e", "#c96f4f"];
    const books = [];
    const bookG = svg("g", {}, Ll);
    for (let i = 0; i < 14; i++) {
      const g = svg("g", { filter: "url(#lift)" }, bookG);
      const bw = 70 + ((i * 37) % 22), bx = 332 + ((i * 13) % 12) - 6;
      svg("rect", { x: bx, y: 624 - i * 17, width: bw, height: 16, rx: 3, fill: bookColors[i % bookColors.length] }, g);
      svg("rect", { x: bx + 6, y: 628 - i * 17, width: 4, height: 8, fill: C.cream, opacity: 0.7 }, g);
      books.push(g);
    }
    const lamp = svg("g", { filter: "url(#card2)" }, Ll);
    svg("rect", { x: 254, y: 520, width: 12, height: 120, fill: C.woodDk }, lamp);
    svg("ellipse", { cx: 260, cy: 640, rx: 46, ry: 10, fill: C.woodDk }, lamp);
    svg("path", { d: "M 196 524 L 222 430 L 298 430 L 324 524 Z", fill: `url(#${id}shade)` }, lamp);
    const Lb = w.layer(0.9);
    const bed = svg("g", { filter: "url(#card2)" }, Lb);
    svg("path", { d: "M 1250 760 V 520 Q 1250 470 1300 470 H 1720 Q 1770 470 1770 520 V 760 Z", fill: C.wood }, bed);
    svg("path", { d: "M 1290 520 H 1730 V 560 H 1290 Z", fill: C.woodDk, opacity: 0.6 }, bed);
    svg("rect", { x: 1170, y: 690, width: 680, height: 110, rx: 14, fill: "#e9dcc4" }, bed);
    svg("rect", { x: 1180, y: 790, width: 20, height: 70, fill: C.woodDk }, bed);
    svg("rect", { x: 1820, y: 790, width: 20, height: 70, fill: C.woodDk }, bed);
    svg("ellipse", { cx: 1390, cy: 660, rx: 120, ry: 44, fill: C.cream, filter: "url(#card1)" }, Lb);
    const ph = svg("g", { filter: "url(#card1)" }, Lb);
    svg("circle", { cx: 1392, cy: 628, r: 42, fill: C.kraft }, ph);
    svg("path", { d: "M 1350 628 Q 1346 578 1392 576 Q 1438 578 1434 628 Q 1426 600 1392 598 Q 1360 600 1350 628 Z", fill: "#2a1f1d" }, ph);
    svg("circle", { cx: 1428, cy: 584, r: 18, fill: "#2a1f1d" }, ph);
    svg("path", { d: "M 1370 634 Q 1376 640 1382 634 M 1402 634 Q 1408 640 1414 634", stroke: C.ink, "stroke-width": 3.2, fill: "none", "stroke-linecap": "round" }, ph);
    svg("ellipse", { cx: 1366, cy: 648, rx: 7, ry: 4.5, fill: "#e98b6d", opacity: 0.45 }, ph);
    const blanket = svg("g", { filter: "url(#card3)" }, Lb);
    const bp = "M 1170 700 Q 1280 650 1450 668 Q 1600 640 1850 690 L 1850 800 Q 1500 830 1170 800 Z";
    svg("path", { d: bp, fill: partner }, blanket);
    svg("path", { d: bp, fill: `url(#${id}tri)`, opacity: 0.55 }, blanket);
    svg("path", { d: "M 1170 706 Q 1280 656 1450 674 Q 1600 646 1850 696", stroke: C.cream, "stroke-width": 10, fill: "none", opacity: 0.9 }, blanket);
    const zs = [0, 1, 2].map((i) => {
      const z = svg("text", { "font-family": "Fraunces", "font-style": "italic", "font-weight": 600, "font-size": 40 + i * 8, fill: C.cream, filter: "url(#lift)" }, Lb);
      z.textContent = "z";
      return z;
    });
    const Lbeam = w.layer(0.8, { mixBlendMode: "screen" });
    svg("polygon", { points: "560,690 1120,690 1460,1080 300,1080", fill: `url(#${id}beam)` }, Lbeam);
    const Lp = w.layer(1.0);
    const youP = PT.puppet(Lp, Object.assign({ shirt: "#e4572e", pants: "#2b2f45", hair: "#3a2a22", hairStyle: "curly" }, you));
    const Lg = w.layer(0.8, { mixBlendMode: "screen" });
    const lampGlow = svg("circle", { cx: 260, cy: 500, r: 560, fill: `url(#${id}lamp)`, opacity: 0.55 }, Lg);
    svg("circle", { cx: 260, cy: 470, r: 70, fill: "#ffe2b0", opacity: 0.55, filter: "url(#glow)" }, Lg);
    const Lfg = w.layer(1.55);
    const leaves = svg("g", { filter: "url(#dof)" }, Lfg);
    [[-70, 1110, -28, 1.25], [30, 1140, -8, 1.06], [120, 1150, 18, 0.88]].forEach(([x, y, r, s]) =>
      svg("path", { d: "M 0 0 C -60 -120 -40 -260 60 -330 C 140 -250 140 -110 0 0 Z", fill: "#2b6150", transform: `translate(${x} ${y}) rotate(${r}) scale(${s})` }, leaves));
    w.overlay("vignette");
    const anchors = { you: { x: 930, y: 640 }, bed: { x: 1450, y: 620 }, window: { x: 840, y: 400 }, clock: { x: 1330, y: 300 }, stand: { x: 300, y: 600 } };

    function update(t, s = {}) {
      stars.forEach((f) => f(t));
      curtL.setAttribute("transform", `skewX(${0.8 * Math.sin(t * 1.3)})`);
      curtR.setAttribute("transform", `skewX(${0.8 * Math.sin(t * 1.3 + 1.7)})`);
      houseLight.setAttribute("opacity", s.houseLight ?? 1);
      lampGlow.setAttribute("opacity", 0.5 + 0.04 * Math.sin(t * 9.1) * Math.sin(t * 3.3));
      const m = s.clock ?? 23 * 60;
      mHand.setAttribute("transform", `rotate(${(m % 60) * 6} ${CK.x} ${CK.y})`);
      hHand.setAttribute("transform", `rotate(${((m / 60) % 12) * 30} ${CK.x} ${CK.y})`);
      tag.textContent = s.tagText || "";
      tag.setAttribute("opacity", s.tag ?? 0);
      const nb = s.books ?? 2;
      books.forEach((b, i) => {
        const u = clamp(nb - i);
        b.style.opacity = u > 0 ? 1 : 0;
        b.setAttribute("transform", `translate(0 ${-28 * (1 - ease.outBack(u))})`);
      });
      blanket.setAttribute("transform", `translate(0 ${-2.2 * Math.sin(t * 1.9)})`);
      zs.forEach((z, i) => {
        const p = (t * 0.45 + i / 3) % 1;
        z.setAttribute("x", 1440 + 40 * p + 10 * Math.sin(p * 6 + i));
        z.setAttribute("y", 600 - 160 * p);
        z.setAttribute("opacity", Math.sin(Math.PI * p) * 0.95);
      });
      youP.pose(Object.assign({ x: 930, y: 912, s: 1.42, bob: 2.2 * Math.sin(t * 1.9 + 1), armF: -9 - 2 * Math.sin(t * 1.9), armB: 9 + 2 * Math.sin(t * 1.9 + 0.5) }, s.you || {}));
    }
    return { update, anchors, you: youP };
  };

  /* Park at dusk (or day/night): sky, sun or moon, paper clouds, hills, trees, a path, a bench and a lamp post.
   * cast: [{x, y?, s?, shirt, hair, hairStyle, glasses}] puppets standing on the path (y defaults to 930).
   * update(t, {sky: 0..1 (0 day, 0.5 dusk, 1 night), lamp: 0..1, cast: [pose overrides]}) */
  K.loc.park = (w, { cast = [] } = {}) => {
    const id = K.uid("park");
    w.defs.innerHTML += `
      <linearGradient id="${id}day" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8fc4e8"/><stop offset="1" stop-color="#f6e4c4"/></linearGradient>
      <linearGradient id="${id}dusk" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#6d5a9c"/><stop offset="0.55" stop-color="#e98f7a"/><stop offset="1" stop-color="#ffd59a"/></linearGradient>
      <linearGradient id="${id}night" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0e152d"/><stop offset="1" stop-color="#2b3a66"/></linearGradient>
      <radialGradient id="${id}sun"><stop offset="0" stop-color="#fff3c9" stop-opacity="0.9"/><stop offset="1" stop-color="#ffb46b" stop-opacity="0"/></radialGradient>
      <radialGradient id="${id}lamp"><stop offset="0" stop-color="#ffd890" stop-opacity="0.9"/><stop offset="1" stop-color="#ffb45e" stop-opacity="0"/></radialGradient>`;
    const S = w.layer(0.25);
    const skies = ["day", "dusk", "night"].map((k) => svg("rect", { x: -900, y: -600, width: 3720, height: 2280, fill: `url(#${id}${k})`, filter: k === "day" ? "url(#card0)" : "none" }, S));
    const sunG = svg("circle", { cx: 1400, cy: 640, r: 420, fill: `url(#${id}sun)` }, S);
    const sun = svg("circle", { cx: 1400, cy: 640, r: 96, fill: "#ffd27a", filter: "url(#card1)" }, S);
    const moon = svg("circle", { cx: 520, cy: 260, r: 70, fill: "#f3e7c4", filter: "url(#card1)" }, S);
    const starsG = svg("g", {}, S);
    const r = PT.rng(7);
    for (let i = 0; i < 40; i++) svg("circle", { cx: -600 + r() * 3100, cy: -300 + r() * 900, r: 1.5 + r() * 2.5, fill: "#f6ecd9" }, starsG);
    const clouds = w.layer(0.35);
    const cl = [[300, 200, 1.2], [1100, 150, 1], [1700, 260, 1.3], [-200, 300, 0.9], [2300, 180, 1.1]].map(([x, y, s]) => {
      const g = svg("g", { filter: "url(#card1)" }, clouds);
      svg("path", { d: "M -110 30 Q -100 -10 -60 -6 Q -40 -44 6 -34 Q 40 -60 76 -24 Q 116 -24 116 30 Z", fill: "#f6d7c6" }, g);
      return { g, x, y, s };
    });
    const H1 = w.layer(0.5);
    svg("path", { d: "M -900 760 Q -300 620 200 700 T 1000 660 T 1800 690 T 2800 670 V 1700 H -900 Z", fill: "#8b6aa0", filter: "url(#card2)" }, H1);
    const H2 = w.layer(0.7);
    svg("path", { d: "M -900 840 Q -200 740 500 800 T 1500 770 T 2800 800 V 1700 H -900 Z", fill: "#5f7f63", filter: "url(#card2)" }, H2);
    const tree = (layer, x, y, s) => {
      const g = svg("g", { filter: "url(#card2)", transform: `translate(${x} ${y}) scale(${s})` }, layer);
      svg("rect", { x: -9, y: -110, width: 18, height: 112, rx: 5, fill: "#5e3829" }, g);
      svg("circle", { cx: 0, cy: -150, r: 70, fill: "#3f6b4e" }, g);
      svg("circle", { cx: -38, cy: -118, r: 46, fill: "#46775a" }, g);
      svg("circle", { cx: 40, cy: -124, r: 50, fill: "#3a6248" }, g);
      return g;
    };
    [[-300, 800, 1.1], [180, 790, 0.9], [1650, 780, 1.2], [2150, 795, 1.0]].forEach(([x, y, s]) => tree(H2, x, y, s));
    const G = w.layer(0.88);
    svg("path", { d: "M -900 900 Q 300 860 1000 880 T 2800 870 V 1700 H -900 Z", fill: "#7fa06b", filter: "url(#card2)" }, G);
    svg("path", { d: "M -900 950 Q 400 915 1000 935 T 2800 930 V 1010 Q 1600 990 1000 1000 T -900 1010 Z", fill: "#d9c3a0", filter: "url(#card1)" }, G);
    for (let i = 0; i < 60; i++) svg("path", { d: `M ${i * 64 - 900} ${1040 + (i % 3) * 22} q 6 -18 12 0 q 6 -14 12 0`, stroke: "#6a8c58", "stroke-width": 4, fill: "none", "stroke-linecap": "round" }, G);
    const bench = svg("g", { filter: "url(#card2)" }, G);
    svg("rect", { x: 1180, y: 830, width: 300, height: 18, rx: 6, fill: "#7b4a36" }, bench);
    svg("rect", { x: 1180, y: 790, width: 300, height: 14, rx: 6, fill: "#7b4a36" }, bench);
    svg("rect", { x: 1196, y: 848, width: 14, height: 70, fill: "#3b2a22" }, bench);
    svg("rect", { x: 1450, y: 848, width: 14, height: 70, fill: "#3b2a22" }, bench);
    const post = svg("g", { filter: "url(#card2)" }, G);
    svg("rect", { x: 1588, y: 560, width: 14, height: 360, fill: "#2b2f45" }, post);
    svg("path", { d: "M 1560 560 L 1630 560 L 1615 510 L 1575 510 Z", fill: "#2b2f45" }, post);
    const bulb = svg("circle", { cx: 1595, cy: 548, r: 12, fill: "#ffe3a8" }, post);
    const P = w.layer(1.0);
    const people = cast.map((c) => ({ c, p: PT.puppet(P, { shirt: c.shirt, hair: c.hair, hairStyle: c.hairStyle || "short", glasses: c.glasses }) }));
    const Lg = w.layer(0.88, { mixBlendMode: "screen" });
    const lampGlow = svg("circle", { cx: 1595, cy: 560, r: 380, fill: `url(#${id}lamp)`, opacity: 0 }, Lg);
    w.overlay("vignette");
    return {
      people,
      anchors: { bench: { x: 1330, y: 700 }, lamp: { x: 1595, y: 640 }, sky: { x: 960, y: 300 } },
      update(t, s = {}) {
        const k = s.sky ?? 0.5;
        skies[0].setAttribute("opacity", 1);
        skies[1].setAttribute("opacity", clamp(k * 2));
        skies[2].setAttribute("opacity", clamp(k * 2 - 1));
        const sunY = 640 + 420 * clamp(k * 1.4 - 0.2);
        sun.setAttribute("cy", sunY); sunG.setAttribute("cy", sunY);
        moon.setAttribute("opacity", clamp(k * 2 - 1)); starsG.setAttribute("opacity", clamp(k * 2.2 - 1.2));
        cl.forEach((c, i) => c.g.setAttribute("transform", `translate(${c.x + ((t * (8 + i * 3)) % 400) - 200} ${c.y}) scale(${c.s})`));
        const lamp = s.lamp ?? clamp(k * 2 - 0.9);
        lampGlow.setAttribute("opacity", 0.75 * lamp); bulb.setAttribute("fill", lamp > 0.2 ? "#fff1c2" : "#d9cfb6");
        people.forEach(({ c, p }, i) => p.pose(Object.assign({ x: c.x, y: c.y ?? 930, s: c.s ?? 1.3, hs: c.hs ?? 1, bob: 1.8 * Math.sin(t * 1.9 + i), armF: -9, armB: 9, blink: K.blink(t, 1e9, 1.2 + i * 0.7) }, (s.cast || [])[i] || {})));
      },
    };
  };

  /* blinks every 2.3-3.4 s until `until` */
  K.blink = (t, until = 1e9, start = 1.9) => {
    let best = 0;
    for (let b = start, k = 0; b < until; b += 2.3 + 1.1 * ((k * 0.618) % 1), k++) best = Math.max(best, 1 - Math.abs(t - b) / 0.07);
    return Math.max(0, best);
  };

  /* ---------------------------------------------------------------- screen-space type and HUD */
  K.banner = (parent, lines, { x, y, w, size = 104 } = {}) => {
    const h = Math.round(size * 1.08 * lines.length + 150);
    const el = html("div", { style: { position: "absolute", left: x + "px", top: y + "px", width: w + "px", height: h + "px", transformOrigin: `${w / 2}px -400px` } }, parent);
    const s = svg("svg", { width: w, height: h, viewBox: `0 0 ${w} ${h}`, style: "position:absolute;inset:0;overflow:visible" }, el);
    const sx = [Math.round(w * 0.14), Math.round(w * 0.86)];
    sx.forEach((xx) => svg("line", { x1: xx, y1: -1400, x2: xx, y2: 70, stroke: "#cdbf9f", "stroke-width": 2.2 }, s));
    svg("path", { d: `M 30 52 H ${w - 30} L ${w - 16} 70 V ${h - 32} L ${w - 34} ${h - 14} L ${w / 2} ${h - 28} L 34 ${h - 14} L 16 ${h - 32} V 70 Z`, fill: "#f3e6cc", filter: "url(#card3)" }, s);
    svg("path", { d: `M 60 82 H ${w - 60} V ${h - 54} L ${w / 2} ${h - 66} L 60 ${h - 54} Z`, fill: "none", stroke: "#c96f4f", "stroke-width": 2, "stroke-dasharray": "2 9", "stroke-linecap": "round" }, s);
    sx.forEach((xx) => svg("circle", { cx: xx, cy: 70, r: 8, fill: "url(#brass)" }, s));
    const p = PT.popText(el, lines, { cls: "headline ink", size, y: 92 });
    p.box.style.width = w + "px";
    return {
      el, pop: p,
      at(t, tIn, tOut) {
        const bd = spring(t - tIn + 0.6, 0.7, 1.1), up = ease.inCubic(seg(t, tOut + 0.15, tOut + 0.6));
        const sw = 1.6 * Math.exp(-Math.max(0, t - tIn + 0.6) * 1.8) * Math.sin((t - tIn) * 5.2 + 0.4);
        el.style.transform = `translateY(${lerp(-h - 200, 0, bd) - (h + 300) * up}px) rotate(${sw}deg)`;
        PT.popAt(p, t, tIn, { tOut });
      },
      cues(tIn, tOut) { PT.popCues(p, tIn).forEach((c) => K.cue(c, "pop")); K.cue(tOut, "fold"); },
    };
  };

  K.say = (parent, text, { y, size = 66 } = {}) => {
    const p = PT.popText(parent, [text], { cls: "say", size, y });
    p.box.style.width = K.W + "px";
    return { at: (t, tIn, tOut) => PT.popAt(p, t, tIn, { tOut }), cues: (tIn) => PT.popCues(p, tIn).forEach((c) => K.cue(c, "pop", { soft: 1 })) };
  };

  /* Hanging kraft ticket with an odometer. at(t, tIn, value, speed, sub) */
  K.ticket = (parent, { x, y, label, sub = "", digits = 6, size = 64, w = 470 } = {}) => {
    const el = html("div", { style: { position: "absolute", left: x + "px", top: y + "px", width: w + "px", height: "230px", transformOrigin: `${w / 2}px 34px` } }, parent);
    const s = svg("svg", { width: w, height: 230, viewBox: `0 0 ${w} 230`, style: "position:absolute;inset:0;overflow:visible" }, el);
    svg("path", { d: `M ${w / 2} -900 L ${w / 2} 22`, stroke: "#cdbf9f", "stroke-width": 2 }, s);
    svg("path", { d: `M 40 40 H ${w - 40} L ${w - 18} 62 V 206 L ${w - 40} 226 H 40 L 18 206 V 62 Z`, fill: "#e8cf9f", filter: "url(#card2)" }, s);
    svg("circle", { cx: w / 2, cy: 34, r: 9, fill: "url(#brass)" }, s);
    svg("path", { d: `M 40 172 H ${w - 40}`, stroke: "#b48a5a", "stroke-width": 2, "stroke-dasharray": "3 7" }, s);
    const lab = html("div", { text: label, style: { position: "absolute", left: "44px", top: "78px", fontFamily: "Bricolage", fontWeight: 700, fontSize: "22px", letterSpacing: "0.18em", color: "#5b3b22" } }, el);
    const odo = PT.odometer(el, { digits, size, color: "#3b2414", style: { position: "absolute", left: "40px", top: "108px" } });
    const subEl = html("div", { text: sub, style: { position: "absolute", left: "44px", top: "186px", fontFamily: "Fraunces", fontStyle: "italic", fontWeight: 600, fontSize: "22px", color: "#6d4a2c" } }, el);
    return {
      el,
      at(t, tIn, value, speed = 0, subText) {
        const tk = t - tIn;
        el.style.opacity = tk > 0 ? 1 : 0;
        const drop = spring(tk, 0.55, 1.2), sw = tk > 0 ? 7 * Math.exp(-tk * 2.2) * Math.sin(tk * 7.5) : 0;
        el.style.transform = `translateY(${lerp(-300, 0, drop)}px) rotate(${sw}deg)`;
        odo.set(value, speed);
        if (subText !== undefined) subEl.textContent = subText;
      },
      setLabel(l) { lab.textContent = l; },
    };
  };
  /* value + per-frame speed for an eased roll, and one tick cue per `step` crossed */
  K.roll = (t, a, b, v0, v1) => {
    const u = seg(t, a, b), v = lerp(v0, v1, ease.inOutCubic(u));
    const dv = u > 0 && u < 1 ? (v1 - v0) * (ease.inOutCubic(Math.min(1, u + 0.01)) - ease.inOutCubic(u)) / ((b - a) * 0.01) / K.fps : 0;
    return [v, dv];
  };
  K.rollCues = (a, b, v0, v1, step) => {
    for (let k = Math.ceil(v0 / step); k * step <= v1; k++) {
      const target = (k * step - v0) / (v1 - v0);
      let lo = 0, hi = 1;
      for (let i = 0; i < 30; i++) { const m = (lo + hi) / 2; ease.inOutCubic(m) < target ? (lo = m) : (hi = m); }
      K.cue(lerp(a, b, lo), "tick");
    }
  };

  /* ---------------------------------------------------------------- page turn (story -> riso) */
  K.turn = () => {
    const B = html("div", { class: "scene" }, K.stage);
    const cast = html("div", { style: { position: "absolute", inset: 0, pointerEvents: "none" } }, K.stage);
    const leaf = html("div", { class: "leaf", style: { transformOrigin: `0 ${K.H / 2}px` } }, K.stage);
    const A = html("div", { class: "face front" }, leaf);
    const back = html("div", { class: "face back" }, leaf);
    const shade = html("div", { style: { position: "absolute", inset: 0, background: "linear-gradient(90deg, rgba(0,0,0,0), rgba(0,0,0,0.65))", opacity: 0, zIndex: 50 } }, A);
    return {
      A, B,
      at(t, tA, tB) {
        const u = ease.inOutSine(seg(t, tA, tB)), ang = 96 * u;
        leaf.style.transform = `rotateY(${ang}deg)`;
        leaf.style.display = u >= 1 ? "none" : "block";
        shade.style.opacity = Math.sin((Math.PI / 2) * u) * 0.85;
        const edge = K.W * Math.cos((ang * Math.PI) / 180);
        cast.style.display = u > 0 && u < 1 ? "block" : "none";
        cast.style.background = `linear-gradient(90deg, rgba(40,30,20,${0.55 * (1 - u)}) 0px, rgba(40,30,20,${0.3 * (1 - u)}) ${Math.max(0, edge)}px, rgba(40,30,20,0) ${Math.max(0, edge) + 260 + 500 * u}px)`;
      },
      cues(tA, tB) { K.cue(tA, "whoosh"); K.cue(tB - 0.05, "flap"); K.cue(tB, "world", { name: "riso" }); },
    };
  };

  /* ---------------------------------------------------------------- riso pages */
  const BLUE = "#0078bf", PINK = "#ff48b0", YELLOW = "#ffd400", PAPER = "#f3ebdb";
  K.riso = {};
  K.riso.page = (parent, { header = "", page = "" } = {}) => {
    const root = html("div", { class: "scene", style: { background: PAPER } }, parent);
    const inner = html("div", { class: "layer", style: { width: K.W + "px", height: K.H + "px", transformOrigin: `${K.W / 2}px ${K.H / 2}px` } }, root);
    const s = svg("svg", { width: K.W, height: K.H, viewBox: `0 0 ${K.W} ${K.H}`, style: "position:absolute;inset:0" }, inner);
    svg("rect", { x: -40, y: -40, width: K.W + 80, height: K.H + 80, fill: PAPER, filter: "url(#card0)" }, s);
    [[70, 70], [K.W - 70, K.H - 70]].forEach(([x, y]) => [[BLUE, 0, 0], [PINK, 2.5, -1.5]].forEach(([c, dx, dy]) => {
      const g = svg("g", { stroke: c, "stroke-width": 2, fill: "none", class: "mul" }, s);
      svg("circle", { cx: x + dx, cy: y + dy, r: 13 }, g);
      svg("path", { d: `M ${x + dx - 22} ${y + dy} h 44 M ${x + dx} ${y + dy - 22} v 44` }, g);
    }));
    if (header) html("div", { class: "riso-label", text: header, style: { position: "absolute", left: "120px", top: "58px", fontSize: "20px", opacity: 0.85, width: K.W - 240 + "px" } }, inner);
    if (page) html("div", { class: "riso-num", text: page, style: { position: "absolute", left: "0", width: K.W + "px", textAlign: "center", top: K.H - 62 + "px", fontSize: "26px", opacity: 0.8 } }, inner);
    return {
      root, inner,
      drift(t, a, b) { const u = ease.inOutSine(seg(t, a, b)); inner.style.transform = `scale(${lerp(1, 1.035, u)}) translate(${lerp(8, -10, u)}px, 0)`; },
    };
  };
  /* Two-pass headline: pink a hair out of register under blue, words stamp in at their own times. */
  K.riso.title = (parent, lines, { x, y, size = 96 } = {}) => {
    const P = PT.popText(parent, lines, { cls: "risoT pink", size, x, y, align: "left" });
    const Bt = PT.popText(parent, lines, { cls: "risoT blue", size, x, y, align: "left" });
    P.box.style.transform = "translate(5px, 4px)";
    const stamp = (p, t, times, dx, dy) => p.words.forEach((w, j) => {
      const a = times[j], u = ease.outCubic(seg(t, a, a + 0.2));
      w.el.style.display = "inline-block";
      w.el.style.opacity = t >= a ? 1 : 0;
      const reg = lerp(16, 1, u);
      w.el.style.transform = `translate(${dx * reg}px, ${dy * reg}px) scale(${lerp(1.16, 1, u)})`;
    });
    return {
      nWords: Bt.words.length,
      at(t, times) { stamp(P, t, times, 0.55, 0.35); stamp(Bt, t, times, -0.1, 0); },
      cues(times) { times.forEach((tt) => K.cue(tt, "stamp", { soft: 1 })); },
    };
  };
  K.riso.helix = (parent, { x0, x1, cy, A = 112, hi = 13, label = "DEC2", sub = "one letter changed" }) => {
    const s = svg("svg", { width: K.W, height: K.H, viewBox: `0 0 ${K.W} ${K.H}`, style: "position:absolute;inset:0" }, parent);
    const cid = K.uid("hx");
    svg("clipPath", { id: cid }, svg("defs", {}, s)).appendChild(svg("rect", { id: cid + "r", x: x0 - 30, y: cy - 300, width: 0, height: 600 }));
    const g = svg("g", { "clip-path": `url(#${cid})`, filter: "url(#ink)" }, s);
    const k = (2 * Math.PI) / 330;
    const rungs = [];
    for (let x = x0 + 12; x < x1; x += 34) rungs.push({ x, el: svg("line", { stroke: "url(#dotsBlue)", "stroke-width": 11, "stroke-linecap": "round" }, g) });
    rungs[hi].el.setAttribute("stroke", YELLOW); rungs[hi].el.setAttribute("stroke-width", 15); rungs[hi].el.setAttribute("class", "mul");
    const sa = svg("path", { fill: "none", stroke: BLUE, "stroke-width": 15, "stroke-linecap": "round", class: "mul" }, g);
    const sb = svg("path", { fill: "none", stroke: PINK, "stroke-width": 15, "stroke-linecap": "round", class: "mul" }, g);
    const ring = svg("circle", { r: 74, fill: "none", stroke: PINK, "stroke-width": 6, class: "mul", "stroke-dasharray": "465", "stroke-dashoffset": "465" }, s);
    const leader = svg("path", { fill: "none", stroke: BLUE, "stroke-width": 3, "stroke-dasharray": "6 7", class: "mul" }, s);
    const lab = html("div", { class: "riso-num", text: label, style: { position: "absolute", fontSize: "64px" } }, parent);
    const subl = html("div", { class: "riso-label", text: sub, style: { position: "absolute", fontSize: "20px" } }, parent);
    return {
      at(t, tDraw, tRing) {
        const hu = ease.inOutCubic(seg(t, tDraw, tDraw + 1.0));
        s.getElementById(cid + "r").setAttribute("width", (x1 - x0 + 60) * hu);
        const ph = t * 1.4;
        let dA = "", dB = "";
        for (let x = x0; x <= x1; x += 6) {
          const v = Math.sin(k * x + ph);
          dA += (x === x0 ? "M" : "L") + x + " " + (cy + A * v).toFixed(1);
          dB += (x === x0 ? "M" : "L") + x + " " + (cy - A * v).toFixed(1);
        }
        sa.setAttribute("d", dA); sb.setAttribute("d", dB);
        rungs.forEach((r) => {
          const v = Math.sin(k * r.x + ph);
          r.el.setAttribute("x1", r.x); r.el.setAttribute("x2", r.x);
          r.el.setAttribute("y1", cy + A * v * 0.86); r.el.setAttribute("y2", cy - A * v * 0.86);
        });
        const hx = rungs[hi].x, ru = ease.outCubic(seg(t, tRing, tRing + 0.45));
        ring.setAttribute("cx", hx); ring.setAttribute("cy", cy);
        ring.setAttribute("stroke-dashoffset", 465 * (1 - ru));
        ring.setAttribute("transform", `rotate(-90 ${hx} ${cy})`);
        const lu = ease.outCubic(seg(t, tRing + 0.2, tRing + 0.55));
        leader.setAttribute("d", `M ${hx + 52} ${cy + 52} L ${hx + 52 + 90 * lu} ${cy + 52 + 120 * lu}`);
        const du = spring(t - tRing - 0.45, 0.45, 1.2);
        lab.style.left = hx + 120 + "px"; lab.style.top = cy + 150 + "px";
        lab.style.opacity = clamp((t - tRing - 0.45) / 0.06);
        lab.style.transform = `scale(${lerp(1.3, 1, du)})`;
        subl.style.left = hx + 124 + "px"; subl.style.top = cy + 222 + "px";
        subl.style.opacity = clamp((t - tRing - 0.7) / 0.15);
      },
      cues(tDraw, tRing) { K.cue(tDraw, "draw", { dur: 1.0 }); K.cue(tRing, "pop"); },
    };
  };
  K.riso.bars = (parent, { x, y, unit, max, gap = 130, h = 74, title = "", rows, source = "" }) => {
    const s = svg("svg", { width: K.W, height: K.H, viewBox: `0 0 ${K.W} ${K.H}`, style: "position:absolute;inset:0" }, parent);
    if (title) html("div", { class: "riso-label", text: title, style: { position: "absolute", left: x + "px", top: y - 78 + "px", fontSize: "22px" } }, parent);
    const axis = svg("g", { stroke: BLUE, "stroke-width": 2, class: "mul", filter: "url(#ink)" }, s);
    const ay = y + rows.length * gap - 30;
    for (let v = 0; v <= max; v++) {
      svg("line", { x1: x + v * unit, y1: ay, x2: x + v * unit, y2: ay + 12 }, axis);
      const tx = svg("text", { x: x + v * unit, y: ay + 44, "text-anchor": "middle", "font-family": "Bricolage", "font-weight": 700, "font-size": 22, fill: BLUE, stroke: "none" }, axis);
      tx.textContent = v;
    }
    const R = rows.map((r, i) => {
      const yy = y + i * gap, pink = r.color === "pink";
      const g = svg("g", { filter: "url(#ink)" }, s);
      const tint = svg("rect", { x, y: yy, height: h, width: 0, fill: pink ? PINK : BLUE, opacity: 0.16, class: "mul" }, g);
      const dots = svg("rect", { x: x + (pink ? -2 : 2), y: yy + (pink ? 2 : -1), height: h, width: 0, fill: pink ? "url(#dotsPink)" : "url(#dotsBlue)", class: "mul" }, g);
      const lab = html("div", { class: "riso-label", text: r.label, style: { position: "absolute", left: x + "px", top: yy - 32 + "px", fontSize: "19px", opacity: 0 } }, parent);
      const val = html("div", { class: "riso-num", text: r.text, style: { position: "absolute", top: yy + 6 + "px", fontSize: "58px", color: pink ? PINK : BLUE, opacity: 0 } }, parent);
      return { ...r, tint, dots, lab, val };
    });
    const src = source ? html("div", { class: "riso-body", text: source, style: { position: "absolute", left: x + "px", top: ay + 80 + "px", width: max * unit + 40 + "px", fontSize: "24px", lineHeight: "1.3", opacity: 0 } }, parent) : null;
    return {
      at(t, tGrow, tVal) {
        R.forEach((r, i) => {
          const a = tGrow + i * 0.18, gu = ease.outCubic(seg(t, a, a + 0.8)), w = r.value * unit * gu;
          r.tint.setAttribute("width", w); r.dots.setAttribute("width", w);
          r.lab.style.opacity = clamp((t - a + 0.1) / 0.15);
          const vu = spring(t - tVal - i * 0.12, 0.4, 1.1);
          r.val.style.opacity = t > tVal + i * 0.12 ? 1 : 0;
          r.val.style.left = x + r.value * unit + 22 + "px";
          r.val.style.transform = `scale(${lerp(1.35, 1, vu)})`;
        });
        if (src) src.style.opacity = clamp((t - tVal - 0.3) / 0.3);
      },
      cues(tGrow, tVal) { K.cue(tGrow, "grow", { dur: 0.9 }); K.cue(tVal, "stamp"); },
    };
  };
  /* A new card slides up over the page. Returns the card element to fill. */
  K.riso.card = (parent, { x = 60, y = 110, w, h }) => {
    const el = html("div", { style: { position: "absolute", left: x + "px", top: y + "px", width: w + "px", height: h + "px", background: "#f6efe1", borderRadius: "6px",
      boxShadow: "0 30px 60px rgba(58,47,34,0.28), 0 6px 14px rgba(58,47,34,0.18)", overflow: "hidden" } }, parent);
    const s = svg("svg", { width: w, height: h, viewBox: `0 0 ${w} ${h}`, style: "position:absolute;inset:0" }, el);
    svg("rect", { x: -20, y: -20, width: w + 40, height: h + 40, fill: "#f6efe1", filter: "url(#card0)" }, s);
    return {
      el,
      at(t, tIn) {
        const u = spring(t - tIn, 0.65, 0.7);
        el.style.transform = `translateY(${lerp(K.H, 0, u)}px) rotate(${lerp(2.5, -0.5, u)}deg)`;
        el.style.display = t >= tIn ? "block" : "none";
      },
      cues(tIn) { K.cue(tIn, "slide"); },
    };
  };
  /* Life grid: n squares, the first `fill` of them (fractional last square) fill pink one by one. */
  K.riso.grid = (parent, { x, y, n = 80, cols = 10, size = 52, gap = 13, fill, label = "" }) => {
    const s = svg("svg", { width: 4000, height: 4000, style: "position:absolute;left:0;top:0;overflow:visible" }, parent);
    const g = svg("g", { filter: "url(#ink)" }, s);
    const sq = [];
    for (let i = 0; i < n; i++) {
      const cx = x + (i % cols) * (size + gap), cy = y + Math.floor(i / cols) * (size + gap);
      sq.push({
        out: svg("rect", { x: cx, y: cy, width: size, height: size, rx: 5, fill: "none", stroke: BLUE, "stroke-width": 3, class: "mul" }, g),
        fill: svg("rect", { x: cx + 4, y: cy + 4, width: 0, height: size - 8, rx: 3, fill: PINK, class: "mul", opacity: 0 }, g),
      });
    }
    const rows = Math.ceil(n / cols);
    const lab = label ? html("div", { class: "riso-label", text: label, style: { position: "absolute", left: x + "px", top: y + rows * (size + gap) + 22 + "px", fontSize: "21px" } }, parent) : null;
    const k = Math.ceil(fill);
    const times = (a, b) => Array.from({ length: k }, (_, i) => a + (b - a) * ease.inOutSine(i / Math.max(1, k - 1)));
    return {
      times,
      at(t, tShow, a, b) {
        const ft = times(a, b);
        sq.forEach((q, i) => q.out.setAttribute("opacity", clamp((t - tShow - i * 0.004) / 0.15)));
        let count = 0;
        ft.forEach((f, i) => {
          const u = ease.outCubic(seg(t, f, f + 0.12)), frac = i === k - 1 ? fill - Math.floor(fill) || 1 : 1;
          sq[i].fill.setAttribute("width", Math.max(0, (size - 8) * frac * u));
          sq[i].fill.setAttribute("opacity", u > 0 ? 1 : 0);
          if (frac === 1) count += ease.inOutSine(seg(t, f - 0.015, f + 0.055));
        });
        if (lab) lab.style.opacity = clamp((t - tShow - 0.3) / 0.3);
        return count;
      },
      cues(a, b) { times(a, b).forEach((f, i) => K.cue(f, "fill", { i })); },
    };
  };
  /* Big two-ink number with a unit word. set(v) */
  K.riso.bignum = (parent, { x, y, size = 330, digits = 2, unit = "", unitSize = 132 }) => {
    const wrap = html("div", { style: { position: "absolute", left: x + "px", top: y + "px", height: size + "px", transformOrigin: "0 60%" } }, parent);
    const p = PT.odometer(wrap, { digits, size, color: PINK, commas: false, style: { position: "absolute", left: "9px", top: "7px", mixBlendMode: "multiply" } });
    const b = PT.odometer(wrap, { digits, size, color: BLUE, commas: false, style: { position: "absolute", left: "0px", top: "0px", mixBlendMode: "multiply" } });
    [p, b].forEach((o) => (o.box.style.fontFamily = "Fraunces"));
    const u = unit ? html("div", { class: "risoT blue", text: unit, style: { position: "absolute", left: x + digits * size * 0.62 + 20 + "px", top: y + size * 0.45 + "px", fontSize: unitSize + "px" } }, parent) : null;
    return {
      at(t, tShow, v, tPunch = Infinity) {
        p.set(v); b.set(v);
        const o = clamp((t - tShow) / 0.2);
        wrap.style.opacity = o; if (u) u.style.opacity = o;
        wrap.style.transform = `scale(${t > tPunch ? lerp(1.06, 1, spring(t - tPunch, 0.5, 1.4)) : 1})`;
      },
    };
  };
  /* Two (or more) quantities over time, drawn left to right as the narration goes, labels riding the line heads.
   * series: [{label, color: "blue"|"pink", f: (x) => y}]; at(t, tA, tB) draws x from 0 to xMax between tA and tB. */
  K.riso.lines = (parent, { x, y, w, h, xMax, yMax, xLabel = "", yTicks = [], xTicks = [], series }) => {
    const s = svg("svg", { width: K.W, height: K.H, viewBox: `0 0 ${K.W} ${K.H}`, style: "position:absolute;inset:0" }, parent);
    const X = (v) => x + (v / xMax) * w, Y = (v) => y + h - (v / yMax) * h;
    const ax = svg("g", { stroke: BLUE, "stroke-width": 2.5, fill: "none", class: "mul", filter: "url(#ink)" }, s);
    svg("path", { d: `M ${x} ${y} V ${y + h} H ${x + w}` }, ax);
    const txt = (tx, ty, str, anchor = "middle") => { const e = svg("text", { x: tx, y: ty, "text-anchor": anchor, "font-family": "Bricolage", "font-weight": 700, "font-size": 22, fill: BLUE, stroke: "none" }, ax); e.textContent = str; };
    xTicks.forEach((v) => { svg("path", { d: `M ${X(v)} ${y + h} v 12` }, ax); txt(X(v), y + h + 40, v); });
    yTicks.forEach((v) => { svg("path", { d: `M ${x} ${Y(v)} h -12` }, ax); txt(x - 20, Y(v) + 8, v, "end"); });
    if (xLabel) html("div", { class: "riso-label", text: xLabel, style: { position: "absolute", left: x + "px", width: w + "px", textAlign: "center", top: y + h + 56 + "px", fontSize: "20px" } }, parent);
    const S = series.map((q) => {
      const pink = q.color === "pink";
      const path = svg("path", { fill: "none", stroke: pink ? PINK : BLUE, "stroke-width": 9, "stroke-linecap": "round", "stroke-linejoin": "round", class: "mul" }, s);
      const dot = svg("circle", { r: 13, fill: pink ? PINK : BLUE, class: "mul" }, s);
      const lab = html("div", { class: "riso-num", style: { position: "absolute", fontSize: "36px", color: pink ? PINK : BLUE, whiteSpace: "nowrap" } }, parent);
      return { ...q, path, dot, lab };
    });
    return {
      at(t, tA, tB, fmt = (q, xv, yv) => `${q.label} ${Math.round(yv)}`) {
        const xe = xMax * ease.inOutSine(seg(t, tA, tB));
        S.forEach((q) => {
          let d = "";
          for (let k = 0; k <= 80; k++) { const xv = (xe * k) / 80; d += (k ? "L" : "M") + X(xv).toFixed(1) + " " + Y(q.f(xv)).toFixed(1); }
          q.path.setAttribute("d", d);
          const yv = q.f(xe);
          q.dot.setAttribute("cx", X(xe)); q.dot.setAttribute("cy", Y(yv));
          q.lab.textContent = fmt(q, xe, yv);
          q.lab.style.left = X(xe) + 22 + "px"; q.lab.style.top = Y(yv) - 24 + "px";
          const vis = t >= tA ? 1 : 0;
          [q.path, q.dot].forEach((e) => e.setAttribute("opacity", vis)); q.lab.style.opacity = vis;
        });
      },
      cues(tA, tB) { K.cue(tA, "draw", { dur: tB - tA }); },
    };
  };

  /* Plain riso text block that fades and lifts in. */
  K.riso.text = (parent, text, { x, y, w, size = 48, cls = "riso-body", align = "left" }) => {
    const el = html("div", { class: cls, html: text, style: { position: "absolute", left: x + "px", top: y + "px", width: w + "px", fontSize: size + "px", lineHeight: 1.18, textAlign: align, opacity: 0 } }, parent);
    return { el, at(t, tIn) { const u = ease.outCubic(seg(t, tIn, tIn + 0.3)); el.style.opacity = u; el.style.transform = `translateY(${lerp(14, 0, u)}px)`; } };
  };

  window.K = K;
})();
