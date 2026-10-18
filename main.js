(function () {
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- hero: a grid you can draw on ---------- */
  var cv = document.getElementById('field');
  if (cv && cv.getContext) {
    var ctx = cv.getContext('2d');
    var hero = document.getElementById('top');
    var COLORS = ['#FF3E9D', '#B44CFF', '#FFB3D9', '#FF8CC6'];

    var W = 0, H = 0, S = 22, cols = 0, rows = 0, dpr = 1;
    var grid = document.createElement('canvas'), gctx = grid.getContext('2d');
    var cells = new Map(), brush = 0, hover = null, down = false, mode = 1, lastCell = null, touchStart = null;
    var raf = 0, onScreen = true, tints = null;
    var KEY = function () { return 'sb-doodle-v4-' + S; };
    try { Object.keys(localStorage).forEach(function (k) { if (/^sb-(board|doodle-v[23])-|^sb-invaders-best$/.test(k)) localStorage.removeItem(k); }); } catch (e) {}

    function store() {
      try { var out = []; cells.forEach(function (v, k) { out.push(k + ',' + v.c); }); localStorage.setItem(KEY(), out.join(';')); } catch (e) {}
    }
    function loadDoodles() {
      cells.clear();
      var raw = null; try { raw = localStorage.getItem(KEY()); } catch (e) {}
      if (raw) raw.split(';').forEach(function (s) { var p = s.split(','); if (p.length === 3) cells.set(p[0] + ',' + p[1], { c: +p[2], t: 0 }); });
    }

    function size() {
      var rc = cv.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = rc.width; H = rc.height;
      var newS = W < 720 ? 18 : 22, first = !cols;
      cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      cols = Math.ceil(W / newS); rows = Math.ceil(H / newS);
      grid.width = cv.width; grid.height = cv.height;
      gctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      gctx.clearRect(0, 0, W, H);
      gctx.fillStyle = 'rgba(255,255,255,.03)';
      for (var i = 0; i < cols; i++) for (var j = 0; j < rows; j++) gctx.fillRect(i * newS + 2, j * newS + 2, newS - 4, newS - 4);
      // a few squares tinted pink, random each visit: mostly singles, some small clumps
      if (!tints || first || newS !== S) {
        tints = [];
        var seeds = Math.max(4, Math.round(cols * rows * .004));
        for (var sd = 0; sd < seeds; sd++) {
          var ci = Math.floor(Math.random() * cols), cj = Math.floor(Math.random() * rows);
          var grow = Math.random() < .35 ? 2 + Math.floor(Math.random() * 4) : 1;
          for (var g = 0; g < grow; g++) {
            var purple = Math.random() < .25;
            tints.push({ i: ci, j: cj, c: purple ? 'rgba(180,76,255,' : 'rgba(255,62,157,', a: (.18 + Math.random() * .45).toFixed(2) });
            var dir2 = Math.floor(Math.random() * 4);
            ci += dir2 === 0 ? 1 : dir2 === 1 ? -1 : 0; cj += dir2 === 2 ? 1 : dir2 === 3 ? -1 : 0;
          }
        }
      }
      tints.forEach(function (t) {
        if (t.i < 0 || t.j < 0 || t.i >= cols || t.j >= rows) return;
        gctx.fillStyle = t.c + t.a + ')';
        gctx.fillRect(t.i * newS + 2, t.j * newS + 2, newS - 4, newS - 4);
      });
      if (first || newS !== S) { S = newS; loadDoodles(); }
      wake();
    }

    function frame(now) {
      raf = 0;
      ctx.clearRect(0, 0, W, H);
      ctx.drawImage(grid, 0, 0, W, H);
      var busy = false;
      cells.forEach(function (v, k) {
        var p = k.split(','), i = +p[0], j = +p[1], age = now - v.t, pop = 1;
        if (age < 260 && !reduce) { pop = .35 + .65 * (1 - Math.pow(1 - age / 260, 3)); busy = true; }
        var s = (S - 4) * pop, o = (S - s) / 2;
        ctx.fillStyle = COLORS[v.c];
        ctx.fillRect(i * S + o, j * S + o, s, s);
      });
      if (hover) {
        ctx.strokeStyle = COLORS[brush]; ctx.lineWidth = 1;
        ctx.strokeRect(hover.i * S + 1.5, hover.j * S + 1.5, S - 3, S - 3);
      }
      if (busy && onScreen && !document.hidden) raf = requestAnimationFrame(frame);
    }
    function wake() { if (!raf) raf = requestAnimationFrame(frame); }

    /* drawing */
    function cellAt(x, y) { var r = cv.getBoundingClientRect(); return { i: Math.floor((x - r.left) / S), j: Math.floor((y - r.top) / S) }; }
    function set(i, j) {
      if (i < 0 || j < 0 || i >= cols || j >= rows) return;
      var k = i + ',' + j;
      if (mode) cells.set(k, { c: brush, t: performance.now() }); else cells.delete(k);
    }
    function line(a, b) {
      var x0 = a.i, y0 = a.j, x1 = b.i, y1 = b.j;
      var dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1, err = dx + dy;
      for (;;) {
        set(x0, y0);
        if (x0 === x1 && y0 === y1) break;
        var e2 = 2 * err;
        if (e2 >= dy) { err += dy; x0 += sx; }
        if (e2 <= dx) { err += dx; y0 += sy; }
      }
    }
    function onUI(e) { return e.target.closest && e.target.closest('a, button, .board-ui, .idx'); }

    hero.addEventListener('pointerdown', function (e) {
      if (onUI(e) || e.button > 0) return;
      var c = cellAt(e.clientX, e.clientY), cur = cells.get(c.i + ',' + c.j);
      mode = cur && cur.c === brush ? 0 : 1;
      if (e.pointerType === 'touch') { touchStart = { x: e.clientX, y: e.clientY, c: c }; return; }
      down = true; lastCell = c; set(c.i, c.j); store(); wake();
      hero.setPointerCapture && hero.setPointerCapture(e.pointerId);
    });
    hero.addEventListener('pointermove', function (e) {
      if (e.pointerType === 'touch') return;
      if (onUI(e)) { if (hover) { hover = null; wake(); } return; }
      var c = cellAt(e.clientX, e.clientY);
      if (!hover || hover.i !== c.i || hover.j !== c.j) { hover = c; wake(); }
      if (down && lastCell && (lastCell.i !== c.i || lastCell.j !== c.j)) { line(lastCell, c); lastCell = c; wake(); }
    });
    function lift(e) {
      if (touchStart && e.type === 'pointerup') {
        var moved = Math.abs(e.clientX - touchStart.x) + Math.abs(e.clientY - touchStart.y);
        if (moved < 10) { set(touchStart.c.i, touchStart.c.j); store(); wake(); }
      }
      touchStart = null;
      if (down) { down = false; lastCell = null; store(); }
    }
    hero.addEventListener('pointerup', lift);
    hero.addEventListener('pointercancel', lift);
    hero.addEventListener('pointerleave', function () { hover = null; wake(); });

    [].forEach.call(document.querySelectorAll('.swatch'), function (b) {
      b.addEventListener('click', function () {
        brush = +b.dataset.c;
        [].forEach.call(document.querySelectorAll('.swatch'), function (o) { o.setAttribute('aria-pressed', o === b ? 'true' : 'false'); });
      });
    });
    document.getElementById('b-clear').addEventListener('click', function () { cells.clear(); store(); wake(); });

    size();
    window.addEventListener('resize', size);
    document.addEventListener('visibilitychange', function () { if (!document.hidden) wake(); });
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (es) { onScreen = es[0].isIntersecting; if (onScreen) wake(); }).observe(cv);
    }
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { size(); });
  }

  /* ---------- hero index: a wheel you can spin through ---------- */
  (function () {
  var wh = document.querySelector('.idx');
  if (wh) {
    var items = [].slice.call(wh.querySelectorAll('a')), N = items.length;
    items.forEach(function (a) { a.draggable = false; });
    var pos = 0, target = 0, wraf = 0, STEP = 34, R = 118;
    wh.classList.add('wheel');
    wh.tabIndex = 0;
    var ctl = document.createElement('div');
    ctl.className = 'wh-ctl';
    ctl.innerHTML = '<button type="button" class="wh-up" aria-label="Previous section">↑</button><span class="wh-n"></span><button type="button" class="wh-dn" aria-label="Next section">↓</button>';
    wh.appendChild(ctl);
    var count = ctl.querySelector('.wh-n');

    function cur() { return ((Math.round(target) % N) + N) % N; }
    function place() {
      items.forEach(function (a, i) {
        var d = ((i - pos) % N + N + N / 2) % N - N / 2;
        var ang = d * STEP, rad = ang * Math.PI / 180;
        var vis = Math.max(0, Math.cos(Math.min(Math.PI / 2, Math.abs(rad) * 1.35)));
        a.style.transform = 'translateY(' + (Math.sin(rad) * R).toFixed(1) + 'px) rotateX(' + (-ang).toFixed(1) + 'deg)';
        a.style.opacity = vis.toFixed(3);
        a.style.setProperty('--on', Math.max(0, 1 - Math.abs(d) * 1.6).toFixed(3));
        a.style.pointerEvents = vis < .2 ? 'none' : '';
        a.classList.toggle('cur', i === cur());
        a.tabIndex = i === cur() ? 0 : -1;
      });
      count.textContent = '0' + (cur() + 1) + ' / 0' + N;
    }
    function tick() {
      wraf = 0;
      var diff = target - pos;
      pos += reduce ? diff : diff * .2;
      if (Math.abs(diff) < .002) pos = target; else wraf = requestAnimationFrame(tick);
      place();
    }
    function go(n) { target = n; if (!wraf) wraf = requestAnimationFrame(tick); }
    function nearest(i) {                     // spin the short way round to item i
      var d = ((i - target) % N + N + N / 2) % N - N / 2;
      return Math.round(target + d);
    }

    ctl.querySelector('.wh-up').addEventListener('click', function () { go(Math.round(target) - 1); });
    ctl.querySelector('.wh-dn').addEventListener('click', function () { go(Math.round(target) + 1); });
    items.forEach(function (a, i) {
      a.addEventListener('click', function (e) {
        if (moved) { e.preventDefault(); return; }
        if (i !== cur()) { e.preventDefault(); go(nearest(i)); }
      });
    });

    var acc = 0, accT = 0;
    wh.addEventListener('wheel', function (e) {
      e.preventDefault();
      var now = performance.now();
      if (now - accT > 220) acc = 0;
      accT = now; acc += e.deltaY;
      if (Math.abs(acc) > 40) { go(Math.round(target) + (acc > 0 ? 1 : -1)); acc = 0; accT = now + 120; }
    }, { passive: false });

    var drag = null, moved = false;
    wh.addEventListener('pointerdown', function (e) {
      if (e.target.closest('.wh-ctl') || e.button > 0) return;
      drag = { y: e.clientY, t: target }; moved = false;
    });
    window.addEventListener('pointermove', function (e) {
      if (!drag) return;
      var dy = e.clientY - drag.y;
      if (Math.abs(dy) > 6) moved = true;
      if (moved) { target = drag.t - dy / 60; pos = target; place(); }
    });
    window.addEventListener('pointerup', function () {
      if (!drag) return;
      drag = null;
      if (moved) { go(Math.round(target)); setTimeout(function () { moved = false; }, 0); }
    });

    wh.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowDown') { e.preventDefault(); go(Math.round(target) + 1); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); go(Math.round(target) - 1); }
      else if (e.key === 'Enter' && e.target === wh) items[cur()].click();
    });
    place();
  }
  })();

  /* ---------- project charts (data copied from each repo's outputs/ folder) ---------- */
  var CHART = {"whale":{"train":[[20,6.816],[40,6.45],[60,6.05],[80,5.827],[100,5.563],[120,5.348],[140,5.216],[160,5.106],[180,4.99],[200,4.941],[220,4.843],[240,4.808],[260,4.743],[280,4.699],[300,4.663],[320,4.628],[340,4.593],[360,4.558],[380,4.561],[400,4.545],[420,4.509],[440,4.499],[460,4.473],[480,4.457],[500,4.463],[520,4.437],[540,4.423],[560,4.425],[580,4.393],[600,4.384],[620,4.386],[640,4.372],[660,4.364],[680,4.357],[700,4.318],[720,4.35],[740,4.341],[760,4.333],[780,4.306],[800,4.302],[820,4.292],[840,4.302],[860,4.289],[880,4.296],[900,4.275],[920,4.252],[940,4.25],[960,4.246],[980,4.212],[1000,4.232],[1020,4.227],[1040,4.196],[1060,4.218],[1080,4.232],[1100,4.209],[1120,4.169],[1140,4.21],[1160,4.181],[1180,4.161],[1200,4.147],[1220,4.154],[1240,4.149],[1260,4.148],[1280,4.11],[1300,4.132],[1320,4.141],[1340,4.123],[1360,4.112],[1380,4.117],[1400,4.103],[1420,4.085],[1440,4.092],[1460,4.06],[1480,4.074],[1500,4.057],[1520,4.047],[1540,4.045],[1560,4.042],[1580,4.037],[1600,4.048],[1620,3.987],[1640,4.046],[1660,4.023],[1680,4.001],[1700,4.022],[1720,4.019],[1740,4.011],[1760,4.004],[1780,3.973],[1800,4.001],[1820,3.993],[1840,3.987],[1860,3.973],[1880,3.98],[1900,3.956],[1920,3.951],[1940,3.983],[1960,3.959],[1980,3.974],[2000,3.977],[2020,3.945],[2040,3.963],[2060,3.935],[2080,3.931],[2100,3.961],[2120,3.927],[2140,3.928],[2160,3.928],[2180,3.948],[2200,3.925],[2220,3.917],[2240,3.925],[2260,3.926],[2280,3.929],[2300,3.925],[2320,3.905],[2340,3.935],[2360,3.913],[2380,3.911],[2400,3.906],[2420,3.889],[2440,3.931],[2460,3.917],[2480,3.902],[2500,3.893],[2520,3.891],[2540,3.873],[2560,3.912],[2580,3.885],[2600,3.89],[2620,3.877],[2640,3.898],[2660,3.887],[2680,3.902]],"val":[[200,4.857],[400,4.511],[600,4.394],[800,4.321],[1000,4.266],[1200,4.191],[1400,4.13],[1600,4.078],[1800,4.028],[2000,4.0],[2200,3.972],[2400,3.947],[2600,3.938]],"heads":[[0.03415,0.01047,0.02756,0.0235],[0.00594,0.00479,0.00593,0.00746],[0.00438,0.00661,0.00942,0.00606],[0.01407,0.01074,0.00646,0.0056]]},"loss":{"iters":[[1,10.6343,9.8336],[2,5.7903,5.1589],[3,5.0838,4.3025],[4,4.156,3.5028],[5,2.6365,2.3822],[6,2.8274,2.4878],[7,2.1377,1.9495],[8,1.7164,1.604],[9,1.4454,1.3776],[10,2.147,1.9243],[11,1.563,1.4753],[12,1.9703,1.7247],[13,1.4484,1.3578],[14,1.2164,1.1425],[15,1.0782,1.0077],[16,0.8979,0.8385],[17,0.7775,0.7211],[18,0.6182,0.5663],[19,0.5484,0.5094],[20,0.5191,0.4889],[21,0.4506,0.4297],[22,0.5398,0.4999],[23,0.3604,0.3421],[24,0.3952,0.3793],[25,0.354,0.34],[26,0.3092,0.297],[27,0.2961,0.2835],[28,0.3341,0.3143],[29,0.2884,0.2758],[30,0.3279,0.3117],[31,0.3228,0.2978],[32,0.282,0.27],[33,0.2857,0.2737],[34,0.274,0.2606],[35,0.2691,0.2542],[36,0.2352,0.2259],[37,0.2251,0.2105]],"match":{"w":10,"d":6,"l":4}},"house":{"pareto":[[1.59,409],[1.64,706],[1.68,821],[1.95,941],[2.41,962],[3.23,1194],[4.46,1338],[4.89,1338],[4.93,1343],[5.0,1361],[6.83,1462]]}};
  var NS = 'http://www.w3.org/2000/svg';
  function el(tag, attrs, parent) {
    var e = document.createElementNS(NS, tag);
    for (var k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }
  function fmt(n) { return n >= 1000 ? '$' + Math.round(n).toLocaleString('en-US') : (Math.round(n * 100) / 100).toString(); }

  function lineChart(box, series, o) {
    var Wd = box.clientWidth || 320, Ht = box.clientHeight || 150, L = 30, R = o.right || 10, T = 12, B = 20;
    var svg = el('svg', { viewBox: '0 0 ' + Wd + ' ' + Ht, role: 'img' }, box);
    var xs = [], ys = [];
    series.forEach(function (s) { s.pts.forEach(function (p) { xs.push(p[0]); ys.push(p[1]); }); });
    var x0 = Math.min.apply(null, xs), x1 = Math.max.apply(null, xs);
    var y0 = o.y0 !== undefined ? o.y0 : Math.min.apply(null, ys), y1 = Math.max.apply(null, ys);
    var X = function (v) { return L + (v - x0) / (x1 - x0) * (Wd - L - R); };
    var Y = function (v) { return T + (1 - (v - y0) / (y1 - y0)) * (Ht - T - B); };
    el('line', { x1: L, x2: Wd - R, y1: Ht - B, y2: Ht - B, class: 'ax' }, svg);
    [y0, (y0 + y1) / 2, y1].forEach(function (v) {
      var t = el('text', { x: L - 5, y: Y(v) + 3, 'text-anchor': 'end', class: 'tk' }, svg); t.textContent = o.yf ? o.yf(v) : Math.round(v);
    });
    var tx = el('text', { x: L, y: Ht - 6, class: 'tk' }, svg); tx.textContent = o.xf ? o.xf(x0) : x0;
    var tx2 = el('text', { x: Wd - R, y: Ht - 6, 'text-anchor': 'end', class: 'tk' }, svg); tx2.textContent = o.xf ? o.xf(x1) : x1;
    series.forEach(function (s, si) {
      var d = s.pts.map(function (p, i) { return (i ? 'L' : 'M') + X(p[0]).toFixed(1) + ' ' + Y(p[1]).toFixed(1); }).join('');
      if (s.fill) el('path', { d: d + 'L' + X(s.pts[s.pts.length - 1][0]) + ' ' + (Ht - B) + 'L' + X(s.pts[0][0]) + ' ' + (Ht - B) + 'Z', fill: 'url(#g' + o.id + ')', class: 'ar' }, svg);
      if (s.dots) s.pts.forEach(function (p, i) {
        var c = el('circle', { cx: X(p[0]), cy: Y(p[1]), r: 3.2, fill: s.color, class: 'dt' }, svg);
        c.style.transitionDelay = (300 + i * 90) + 'ms';
      });
      var ln = el('path', { d: d, stroke: s.color, pathLength: 1, class: 'ln' }, svg);
      ln.style.transitionDelay = si * 250 + 'ms';
    });
    var defs = el('defs', {}, svg), g = el('linearGradient', { id: 'g' + o.id, x1: 0, x2: 0, y1: 0, y2: 1 }, defs);
    el('stop', { offset: '0', 'stop-color': '#FF3E9D', 'stop-opacity': '.28' }, g);
    el('stop', { offset: '1', 'stop-color': '#FF3E9D', 'stop-opacity': '0' }, g);
    // hover readout on the first series
    var hv = el('g', { class: 'hv' }, svg), hl = el('line', { y1: T, y2: Ht - B, class: 'hl' }, hv);
    var hd = el('circle', { r: 3.5, fill: '#F6F0F3' }, hv), ht = el('text', { y: T + 8, class: 'tip' }, hv);
    var main = series[0].pts;
    svg.addEventListener('pointermove', function (e) {
      var r = svg.getBoundingClientRect(), mx = (e.clientX - r.left) / r.width * Wd;
      var best = main[0], bd = 1e9;
      main.forEach(function (p) { var dd = Math.abs(X(p[0]) - mx); if (dd < bd) { bd = dd; best = p; } });
      var cx = X(best[0]), cy = Y(best[1]);
      hl.setAttribute('x1', cx); hl.setAttribute('x2', cx);
      hd.setAttribute('cx', cx); hd.setAttribute('cy', cy);
      ht.textContent = o.tip(best);
      var right = cx > Wd * .6;
      ht.setAttribute('x', right ? cx - 7 : cx + 7); ht.setAttribute('text-anchor', right ? 'end' : 'start');
    });
    return { svg: svg, X: X, Y: Y, Wd: Wd, Ht: Ht };
  }

  function mix(a, b, t) {                     // blend two hex colours
    var pa = [1, 3, 5].map(function (i) { return parseInt(a.substr(i, 2), 16); });
    var pb = [1, 3, 5].map(function (i) { return parseInt(b.substr(i, 2), 16); });
    return 'rgb(' + pa.map(function (v, i) { return Math.round(v + (pb[i] - v) * t); }).join(',') + ')';
  }
  function tipBox(svg) {
    var g = el('g', { class: 'hv' }, svg), t = el('text', { class: 'tip' }, g);
    return function (txt, x, y, anchor) { t.textContent = txt; t.setAttribute('x', x); t.setAttribute('y', y); t.setAttribute('text-anchor', anchor || 'start'); };
  }

  var builders = {
    // heatmap: how much validation loss rises when each attention head is zeroed
    whale: function (box) {
      var Wd = box.clientWidth || 320, Ht = box.clientHeight || 150;
      var svg = el('svg', { viewBox: '0 0 ' + Wd + ' ' + Ht, role: 'img' }, box);
      var H2 = CHART.whale.heads, mx = 0;
      H2.forEach(function (r) { r.forEach(function (v) { mx = Math.max(mx, v); }); });
      var gap = 3, sz = Math.floor((Ht - 34 - 3 * gap) / 4), gx = 30, gy = 12;
      for (var c = 0; c < 4; c++) { var hx = el('text', { x: gx + c * (sz + gap) + sz / 2, y: gy + 4 * (sz + gap) + 11, 'text-anchor': 'middle', class: 'tk' }, svg); hx.textContent = 'h' + (c + 1); }
      var say = tipBox(svg);
      H2.forEach(function (r, i) {
        var ly = el('text', { x: gx - 7, y: gy + i * (sz + gap) + sz / 2 + 3, 'text-anchor': 'end', class: 'tk' }, svg); ly.textContent = 'L' + (i + 1);
        r.forEach(function (v, k) {
          var q = el('rect', { x: gx + k * (sz + gap), y: gy + i * (sz + gap), width: sz, height: sz, rx: 3,
            fill: mix('#2A1020', '#FF3E9D', Math.pow(v / mx, .7)), class: 'cell' }, svg);
          q.style.transitionDelay = (i * 4 + k) * 45 + 'ms';
          q.addEventListener('pointerenter', function () { say('layer ' + (i + 1) + ' head ' + (k + 1) + ': +' + v.toFixed(3), Wd - 10, Ht - 10, 'end'); });
        });
      });
      var sx = gx + 4 * (sz + gap) + 22;
      [['940,800', 'parameters'], ['3.93', 'val loss'], ['5.5M', 'tokens seen']].forEach(function (s, n) {
        var y = 30 + n * 38;
        var b1 = el('text', { x: sx, y: y, class: 'big' }, svg); b1.textContent = s[0];
        var b2 = el('text', { x: sx, y: y + 13, class: 'tk' }, svg); b2.textContent = s[1];
      });
    },
    // bars: loss after each self-play round
    loss: function (box) {
      var Wd = box.clientWidth || 320, Ht = box.clientHeight || 150, L = 26, R = 8, T = 14, B = 18;
      var svg = el('svg', { viewBox: '0 0 ' + Wd + ' ' + Ht, role: 'img' }, box);
      var it = CHART.loss.iters, mx = Math.max.apply(null, it.map(function (r) { return r[2]; }));
      var n = it.length, bw = (Wd - L - R) / n, say = tipBox(svg);
      el('line', { x1: L, x2: Wd - R, y1: Ht - B, y2: Ht - B, class: 'ax' }, svg);
      [0, mx / 2, mx].forEach(function (v) {
        var t = el('text', { x: L - 5, y: T + (1 - v / mx) * (Ht - T - B) + 3, 'text-anchor': 'end', class: 'tk' }, svg); t.textContent = Math.round(v);
      });
      it.forEach(function (r, i) {
        var hgt = Math.max(1.5, r[2] / mx * (Ht - T - B));
        var bar = el('rect', { x: L + i * bw + 1, y: Ht - B - hgt, width: Math.max(2, bw - 2), height: hgt, rx: 1.5,
          fill: mix('#FF3E9D', '#B44CFF', i / (n - 1)), class: 'bar' }, svg);
        bar.style.transitionDelay = i * 28 + 'ms';
        bar.addEventListener('pointerenter', function () { say('round ' + r[0] + ': loss ' + r[2].toFixed(2), Wd - R, T + 4, 'end'); });
      });
      var a1 = el('text', { x: L, y: Ht - 5, class: 'tk' }, svg); a1.textContent = 'round 1';
      var a2 = el('text', { x: Wd - R, y: Ht - 5, 'text-anchor': 'end', class: 'tk' }, svg); a2.textContent = 'round ' + n;
    },
    // scatter: each dot is one set of house rules on the Pareto front
    house: function (box) {
      var c = lineChart(box, [{ pts: CHART.house.pareto, color: '#B44CFF', dots: true }],
        { id: 'h', yf: function (v) { return '$' + Math.round(v); }, xf: function (v) { return v.toFixed(1) + '% ruin'; },
          tip: function (p) { return p[0].toFixed(1) + '% ruin, $' + p[1].toLocaleString('en-US') + '/yr'; } });
      [].forEach.call(box.querySelectorAll('.dt'), function (d) { d.setAttribute('fill', '#FF3E9D'); d.setAttribute('r', 4.6); });
      var P = CHART.house.pareto, lo = P[0], hi = P[P.length - 1];
      var t1 = el('text', { x: c.X(lo[0]) + 8, y: c.Y(lo[1]) + 4, class: 'lbl' }, c.svg); t1.textContent = 'safest';
      var t2 = el('text', { x: c.X(hi[0]) - 8, y: c.Y(hi[1]) + 16, 'text-anchor': 'end', class: 'lbl' }, c.svg); t2.textContent = 'max profit';
    }
  };
  var charts = [].slice.call(document.querySelectorAll('.chart[data-chart]'));
  function buildCharts() {
    charts.forEach(function (box) { box.innerHTML = ''; builders[box.dataset.chart](box); });
  }
  buildCharts();
  if ('IntersectionObserver' in window && !reduce) {
    var chIO = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); chIO.unobserve(e.target); } });
    }, { threshold: .4 });
    charts.forEach(function (c) { chIO.observe(c); });
  } else charts.forEach(function (c) { c.classList.add('in'); });
  var chW = innerWidth;
  window.addEventListener('resize', function () {
    if (Math.abs(innerWidth - chW) < 40) return;
    chW = innerWidth; buildCharts();
  });

  /* ---------- top bar ---------- */
  var bar = document.getElementById('bar');
  var links = [].slice.call(document.querySelectorAll('.bar nav a'));
  var prog = document.getElementById('prog');
  function onScroll() {
    bar.classList.toggle('solid', window.scrollY > 40);
    var max = document.documentElement.scrollHeight - innerHeight;
    var pr = max > 0 ? Math.min(1, scrollY / max) : 0;
    prog.style.setProperty('--p', pr.toFixed(4));
    prog.classList.toggle('done', pr > .995);
  }

  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  if ('IntersectionObserver' in window) {
    var secIO = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (!e.isIntersecting) return;
        links.forEach(function (a) { a.classList.toggle('on', a.getAttribute('href') === '#' + e.target.id); });
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    ['research', 'code', 'awards', 'photos'].forEach(function (id) {
      var el = document.getElementById(id); if (el) secIO.observe(el);
    });

    /* reveal on scroll */
    var rv = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add('in'); rv.unobserve(e.target); }
      });
    }, { rootMargin: '0px 0px -8% 0px' });
    [].forEach.call(document.querySelectorAll('.rv'), function (el, n) {
      rv.observe(el);
    });
  } else {
    [].forEach.call(document.querySelectorAll('.rv'), function (el) { el.classList.add('in'); });
  }

  /* ---------- photos: justified rows that fill the content width exactly ---------- */
  var strip = document.getElementById('strip');
  var tiles = [].slice.call(strip.querySelectorAll('.sh')).map(function (el) {
    var ar = el.style.getPropertyValue('--ar').split('/');
    return { el: el, r: +ar[0] / +ar[1] };
  });
  function justify() {
    var Wc = strip.clientWidth, gap = parseFloat(getComputedStyle(strip).columnGap) || 12;
    var target = Wc < 600 ? 150 : 250, n = tiles.length;
    // split the photos, in order, into rows whose heights land closest to the target
    var best = [0], cut = [0];
    for (var i = 1; i <= n; i++) {
      best[i] = Infinity;
      for (var k = 0; k < i; k++) {
        var sum = 0; for (var m = k; m < i; m++) sum += tiles[m].r;
        var hgt = (Wc - gap * (i - k - 1)) / sum, cost = best[k] + Math.pow(hgt - target, 2);
        if (cost < best[i]) { best[i] = cost; cut[i] = k; }
      }
    }
    var rows = [], e = n;
    while (e > 0) { rows.unshift([cut[e], e]); e = cut[e]; }
    rows.forEach(function (rw) {
      var sum = 0; for (var m = rw[0]; m < rw[1]; m++) sum += tiles[m].r;
      var hgt = (Wc - gap * (rw[1] - rw[0] - 1)) / sum, used = 0;
      for (var q = rw[0]; q < rw[1]; q++) {
        var wd = q === rw[1] - 1 ? Wc - gap * (rw[1] - rw[0] - 1) - used : Math.floor(tiles[q].r * hgt);
        used += wd;
        tiles[q].el.style.width = wd + 'px';
        tiles[q].el.style.height = Math.round(hgt) + 'px';
      }
    });
  }
  justify();
  window.addEventListener('resize', justify);


  /* ---------- pink rain (toggle). The cursor is an umbrella. ---------- */
  var rc = document.getElementById('rain'), rbtn = document.getElementById('rbtn');
  var rx = rc.getContext('2d'), rW = 0, rH = 0, rDpr = 1, drops = [], splash = [], rOn = false, rRaf = 0, rLast = 0;
  var umb = { x: -9999, y: -9999 }, UMB = 64, SLANT = .17;

  function rSize() {
    rDpr = Math.min(window.devicePixelRatio || 1, 2);
    rW = innerWidth; rH = innerHeight;
    rc.width = Math.round(rW * rDpr); rc.height = Math.round(rH * rDpr);
    rx.setTransform(rDpr, 0, 0, rDpr, 0, 0);
  }
  function drop(d, anywhere) {
    d.x = Math.random() * (rW + rH * SLANT) - rH * SLANT * .5;
    d.y = anywhere ? Math.random() * rH : -20 - Math.random() * 120;
    d.len = 12 + Math.random() * 20;
    d.v = 600 + Math.random() * 650;
    d.a = .22 + Math.random() * .45;
    d.p = Math.random() < .28;
    d.w = Math.random() < .12 ? 1.6 : 1;
    return d;
  }
  function burst(x, y, purple) {
    splash.push({ x: x, y: y, r: 1, a: .75, p: purple });
    if (splash.length > 160) splash.shift();
  }
  function rFrame(now) {
    rRaf = 0;
    var dt = Math.min(.05, (now - rLast) / 1000 || .016); rLast = now;
    rx.clearRect(0, 0, rW, rH);
    rx.lineCap = 'round';
    rx.save();
    for (var n = 0; n < drops.length; n++) {
      var d = drops[n];
      d.y += d.v * dt; d.x += d.v * SLANT * dt;
      var dx = d.x - umb.x, dy = d.y - umb.y;
      if (dy < 0 && dx * dx + dy * dy < UMB * UMB) { burst(d.x, d.y, d.p); drop(d); continue; }
      if (d.y > rH - 2) { if (Math.random() < .6) burst(d.x, rH - 3, d.p); drop(d); continue; }
      rx.strokeStyle = d.p ? 'rgba(180,76,255,' + d.a + ')' : 'rgba(255,62,157,' + d.a + ')';
      rx.lineWidth = d.w;
      rx.beginPath(); rx.moveTo(d.x, d.y); rx.lineTo(d.x - d.len * SLANT, d.y - d.len); rx.stroke();
    }
    for (var k = splash.length - 1; k >= 0; k--) {
      var s = splash[k];
      s.r += 34 * dt; s.a -= 1.9 * dt;
      if (s.a <= 0) { splash.splice(k, 1); continue; }
      rx.strokeStyle = s.p ? 'rgba(180,76,255,' + s.a + ')' : 'rgba(255,120,190,' + s.a + ')';
      rx.lineWidth = 1;
      rx.beginPath(); rx.ellipse(s.x, s.y, s.r, s.r * .38, 0, Math.PI, Math.PI * 2); rx.stroke();
    }
    rx.restore();
    if (rOn && !document.hidden) rRaf = requestAnimationFrame(rFrame);
  }
  function setRain(on) {
    rOn = on;
    rbtn.setAttribute('aria-pressed', on ? 'true' : 'false');
    rc.classList.toggle('on', on);
    if (on) {
      rSize();
      var count = Math.round(Math.min(reduce ? 70 : 230, rW / (reduce ? 14 : 6)));
      drops = []; splash = [];
      for (var i = 0; i < count; i++) drops.push(drop({}, true));
      rLast = performance.now();
      if (!rRaf) rRaf = requestAnimationFrame(rFrame);
    } else {
      setTimeout(function () { if (!rOn) { if (rRaf) cancelAnimationFrame(rRaf); rRaf = 0; rx.clearRect(0, 0, rW, rH); } }, 650);
    }
  }
  function toggleRain() { setRain(!rOn); }
  rbtn.addEventListener('click', toggleRain);
  window.addEventListener('pointermove', function (e) { umb.x = e.clientX; umb.y = e.clientY; }, { passive: true });
  document.addEventListener('pointerleave', function () { umb.x = umb.y = -9999; });
  window.addEventListener('resize', function () { if (rOn) rSize(); });
  document.addEventListener('visibilitychange', function () {
    if (!document.hidden && rOn && !rRaf) { rLast = performance.now(); rRaf = requestAnimationFrame(rFrame); }
  });

  /* ---------- jump palette (cmd/ctrl+K or /) ---------- */
  var pal = document.getElementById('pal'), q = document.getElementById('pal-q'), list = document.getElementById('pal-list');
  var toast = document.getElementById('toast'), kbtn = document.getElementById('kbtn');
  var isMac = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
  if (!isMac) document.getElementById('kkey').textContent = 'Ctrl K';

  var COLOR = { 'c-neurips': 'var(--pink)', 'c-icml': 'var(--violet)', 'c-cvpr': 'var(--cyan)', 'c-iclr': 'var(--lime)' };
  var items = [];

  // Built from the page itself so the palette never drifts from the content.
  [].forEach.call(document.querySelectorAll('.nlist li'), function (li) {
    items.push({ g: 'Research', tag: li.querySelector('.ws').firstChild.textContent.trim(), c: COLOR['c-neurips'],
      text: li.querySelector('.nt').textContent, el: li });
  });
  [].forEach.call(document.querySelectorAll('.grid2 .card'), function (card) {
    var chip = card.querySelector('.chip'), a = card.querySelector('.go a');
    var venue = chip.textContent.split('@');
    items.push({ g: 'Research', tag: (venue[1] || venue[0]).trim().replace(' 2026', ''),
      c: COLOR[chip.classList[1]], text: card.querySelector('h3').textContent, href: a && a.href, el: card });
  });
  [].forEach.call(document.querySelectorAll('.repo'), function (r) {
    items.push({ g: 'Projects', tag: (r.querySelector('.lang') || r.querySelector('.stat')).textContent, text: r.querySelector('.rn').textContent, href: r.querySelector('.rn').href });
  });
  [['awards', 'Awards'], ['research', 'Research'], ['code', 'Projects'], ['photos', 'Photos']].forEach(function (s) {
    items.push({ g: 'Sections', tag: 'section', text: s[1], el: document.getElementById(s[0]), top: true });
  });
  items.push({ g: 'Links', tag: 'copy', c: 'var(--pink)', text: 'Copy email address', copy: 'sbatra@imsa.edu' });
  items.push({ g: 'Links', tag: 'scholar', text: 'Google Scholar', href: 'https://scholar.google.com/citations?user=-Prwkv8AAAAJ' });
  items.push({ g: 'Links', tag: 'github', text: 'GitHub', href: 'https://github.com/sbatra24' });
  items.push({ g: 'Links', tag: 'news', text: 'Chicago Sun-Times profile', href: 'https://chicago.suntimes.com/columnists/2026/09/24/artificial-intelligence-usefulness-illinois-math-and-science-academy-senior' });
  items.push({ g: 'Links', tag: 'linkedin', text: 'LinkedIn', href: 'https://www.linkedin.com/in/soham-batra-851a342b9/' });

  items.push({ g: 'Other', tag: 'toggle', text: 'rain', fn: toggleRain });

  var shown = [], sel = 0, lastFocus = null;

  function match(it, words) {
    var hay = (it.text + ' ' + it.tag + ' ' + it.g).toLowerCase();
    return words.every(function (w) { return hay.indexOf(w) !== -1; });
  }

  function render() {
    var words = q.value.toLowerCase().split(/\s+/).filter(Boolean);
    shown = items.filter(function (it) { return match(it, words); });
    sel = Math.min(sel, Math.max(0, shown.length - 1));
    if (!shown.length) { list.innerHTML = '<p class="pal-empty">Nothing matches.</p>'; return; }
    var html = '', g = '';
    shown.forEach(function (it, n) {
      if (it.g !== g) { g = it.g; html += '<p class="pal-g">' + g + '</p>'; }
      html += '<div class="pal-it' + (n === sel ? ' sel' : '') + '" role="option" data-n="' + n + '" id="pi' + n + '"' +
        (n === sel ? ' aria-selected="true"' : '') + '><span class="tg"' + (it.c ? ' style="--c:' + it.c + '"' : '') + '></span>' +
        '<span class="tx"></span><span class="go2">' + (it.fn ? 'toggle' : it.copy ? 'copy' : it.href ? '↗' : '↓') + '</span></div>';
    });
    list.innerHTML = html;
    [].forEach.call(list.querySelectorAll('.pal-it'), function (row) {
      var it = shown[+row.dataset.n];
      row.querySelector('.tg').textContent = it.tag;
      row.querySelector('.tx').textContent = it.text;
    });
    q.setAttribute('aria-activedescendant', 'pi' + sel);
  }

  function move(d) {
    if (!shown.length) return;
    sel = (sel + d + shown.length) % shown.length;
    [].forEach.call(list.querySelectorAll('.pal-it'), function (row) {
      var on = +row.dataset.n === sel;
      row.classList.toggle('sel', on);
      on ? row.setAttribute('aria-selected', 'true') : row.removeAttribute('aria-selected');
      if (on) row.scrollIntoView({ block: 'nearest' });
    });
    q.setAttribute('aria-activedescendant', 'pi' + sel);
  }

  function say(msg) {
    toast.textContent = msg; toast.classList.add('on');
    clearTimeout(say.t); say.t = setTimeout(function () { toast.classList.remove('on'); }, 1800);
  }

  function run(it) {
    if (!it) return;
    closePal();
    if (it.fn) {
      it.fn();
    } else if (it.copy) {
      var done = function () { say('Copied ' + it.copy); };
      if (navigator.clipboard) navigator.clipboard.writeText(it.copy).then(done, function () { location.href = 'mailto:' + it.copy; });
      else location.href = 'mailto:' + it.copy;
    } else if (it.href) {
      window.open(it.href, '_blank', 'noopener');
    } else if (it.el) {
      it.el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: it.top ? 'start' : 'center' });
      if (!it.top) {
        it.el.classList.remove('flash'); void it.el.offsetWidth; it.el.classList.add('flash');
      }
    }
  }

  function openPal() {
    if (!pal.hidden) return;
    lastFocus = document.activeElement;
    pal.hidden = false; q.value = ''; sel = 0; render();
    document.body.style.overflow = 'hidden';
    setTimeout(function () { q.focus(); }, 0);
  }
  function closePal() {
    if (pal.hidden) return;
    pal.hidden = true;
    document.body.style.overflow = '';
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }

  kbtn.addEventListener('click', openPal);
  q.addEventListener('input', function () { sel = 0; render(); });
  q.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowDown') { move(1); e.preventDefault(); }
    else if (e.key === 'ArrowUp') { move(-1); e.preventDefault(); }
    else if (e.key === 'Enter') { run(shown[sel]); e.preventDefault(); }
  });
  list.addEventListener('mousemove', function (e) {
    var row = e.target.closest('.pal-it'); if (!row || +row.dataset.n === sel) return;
    move(+row.dataset.n - sel);
  });
  list.addEventListener('click', function (e) {
    var row = e.target.closest('.pal-it'); if (row) run(shown[+row.dataset.n]);
  });
  pal.addEventListener('click', function (e) { if (e.target === pal) closePal(); });
  document.addEventListener('keydown', function (e) {
    var typing = /INPUT|TEXTAREA|SELECT/.test((e.target.tagName || '')) || e.target.isContentEditable;
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); pal.hidden ? openPal() : closePal(); }
    else if (e.key === '/' && !typing && pal.hidden) { e.preventDefault(); openPal(); }
    else if (e.key === 'Escape' && !pal.hidden) closePal();
  });
})();
