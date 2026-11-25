/* =============================================================
   dm-statement.js — 핵심 문장 등장 + 글자 구멍 속으로 들어가는 전환
   - 문장: 선 → 첫 줄 → 둘째 줄 순서로 스크롤에 맞춰 등장 (위로 올리면 되돌아감)
   - 다 나온 뒤 계속 스크롤하면 표시된 글자(.dm-portal)의 닫힌 구멍 속으로 확대되고,
     구멍 속 색이 다음 섹션 색으로 바뀌면서 다음 섹션(장소 특징 / 지도)이 드러남
   - 구멍 위치는 글꼴 모양을 직접 읽어 자동으로 찾음 (화면 크기가 달라져도 정확)
   ============================================================= */
(function () {
  'use strict';
  var doc = document.documentElement;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return [].slice.call((r || document).querySelectorAll(s)); };
  var clamp = function (v, a, b) { return v < a ? a : v > b ? b : v; };
  var seg = function (p, a, b) { return clamp((p - a) / (b - a), 0, 1); };
  var smooth = function (t) { return t * t * (3 - 2 * t); };
  var outCubic = function (t) { return 1 - Math.pow(1 - t, 3); };
  var mqReduce = matchMedia('(prefers-reduced-motion: reduce)'), reduce = mqReduce.matches;

  var stmts = $$('.dm-statement').map(function (el) {
    return { pin: el, bar: $('.dm-st-bar', el), l1: $('.dm-st-l1 span', el), l2: $('.dm-st-l2 span', el), sq: 0,
      portal: $('.dm-portal', el), quote: $('.dm-st-quote', el), scene: $('.dm-st-scene', el),
      next: el.dataset.portalNext ? document.getElementById(el.dataset.portalNext) : null, color: el.dataset.portalColor || '#ffffff', m: null };
  });
  // 지도로 넘어가는 문장: 'ㅁ' 구멍 속에 실제 지도를 비춰, 구멍이 커질수록 지도 안으로 빨려 들어가는 느낌
  stmts.forEach(function (S) {
    var src = S.next && S.next.querySelector('canvas');
    if (!src || S.next.id !== 'map') return;
    S.peekSrc = src;
    S.peek = document.createElement('canvas'); S.peek.className = 'dm-st-peek'; S.peek.setAttribute('aria-hidden', 'true');
    S.scene.insertBefore(S.peek, S.scene.firstChild);
  });
  if (!stmts.length) return;
  doc.classList.add('dm-js');

  function applyModes() {
    stmts.forEach(function (S) {
      S.pin.classList.toggle('dm-flat', reduce);
      var on = !!(S.portal && S.next) && portalOn();
      S.pin.classList.toggle('dm-portal', on); if (S.next) S.next.classList.toggle('dm-portal-next', on);
      // 장면이 사라지는 동안 다음 섹션 윗부분 틈에도 같은 색이 이어지게 (겹쳐 둔 마지막 100vh는 투명)
      S.pin.style.background = on ? 'linear-gradient(to bottom,' + S.color + ' calc(100% - 100vh),transparent calc(100% - 100vh))' : '';
      if (!on) { S.quote.style.transform = ''; S.scene.style.opacity = ''; S.scene.style.visibility = ''; S.scene.style.background = ''; S.scene.style.pointerEvents = ''; }
      S.m = null;
    });
  }

  /* ---------- PORTAL : 글자 속 닫힌 구멍(A의 삼각형, 람의 ㅁ)을 찾아 그 안으로 확대 ---------- */
  function portalOn() { return !reduce && innerWidth > 768; }
  function measurePortal(S) {
    var el = S.portal, cs = getComputedStyle(el), F = parseFloat(cs.fontSize);
    var FC = 360, pad = Math.ceil(FC * 0.3), cv = document.createElement('canvas'), g = cv.getContext('2d');
    var font = cs.fontWeight + ' ' + FC + 'px ' + cs.fontFamily, ch = el.textContent;
    g.font = font;
    var mt = g.measureText(ch), asc = mt.fontBoundingBoxAscent || FC * 0.93, desc = mt.fontBoundingBoxDescent || FC * 0.24;
    var W = Math.ceil(mt.width) + pad * 2, H = Math.ceil(asc + desc) + pad * 2;
    cv.width = W; cv.height = H; g.font = font; g.fillStyle = '#000'; g.textBaseline = 'alphabetic';
    g.fillText(ch, pad, pad + asc);
    var px = g.getImageData(0, 0, W, H).data, N = W * H, ink = new Uint8Array(N), lab = new Int32Array(N), i, k;
    for (i = 0; i < N; i++) ink[i] = px[i * 4 + 3] > 110 ? 1 : 0;
    // 바깥과 이어진 빈 곳 = -1, 닫힌 구멍 = 1,2,3…
    var st = [];
    for (i = 0; i < W; i++) { st.push(i, N - W + i); }
    for (i = 0; i < H; i++) { st.push(i * W, i * W + W - 1); }
    while (st.length) { k = st.pop(); if (lab[k] || ink[k]) continue; lab[k] = -1; var x = k % W, y = (k / W) | 0;
      if (x > 0) st.push(k - 1); if (x < W - 1) st.push(k + 1); if (y > 0) st.push(k - W); if (y < H - 1) st.push(k + W); }
    var comp = 0, best = 0, bestN = 0;
    for (i = 0; i < N; i++) {
      if (lab[i] || ink[i]) continue;
      comp++; var cnt = 0; st.push(i);
      while (st.length) { k = st.pop(); if (lab[k] || ink[k]) continue; lab[k] = comp; cnt++; var x2 = k % W, y2 = (k / W) | 0;
        if (x2 > 0) st.push(k - 1); if (x2 < W - 1) st.push(k + 1); if (y2 > 0) st.push(k - W); if (y2 < H - 1) st.push(k + W); }
      if (cnt > bestN) { bestN = cnt; best = comp; }
    }
    if (!best) return null;
    // 구멍 안에서 가장자리와 가장 먼 점 = 확대 중심, 그 거리 = 구멍 반지름
    var D = new Float32Array(N), BIG = 1e9;
    for (i = 0; i < N; i++) D[i] = lab[i] === best ? BIG : 0;
    var x3, y3, j;
    for (y3 = 1; y3 < H - 1; y3++) for (x3 = 1; x3 < W - 1; x3++) { j = y3 * W + x3; if (!D[j]) continue;
      D[j] = Math.min(D[j], D[j - 1] + 1, D[j - W] + 1, D[j - W - 1] + 1.414, D[j - W + 1] + 1.414); }
    for (y3 = H - 2; y3 > 0; y3--) for (x3 = W - 2; x3 > 0; x3--) { j = y3 * W + x3; if (!D[j]) continue;
      D[j] = Math.min(D[j], D[j + 1] + 1, D[j + W] + 1, D[j + W + 1] + 1.414, D[j + W - 1] + 1.414); }
    var bi = 0, bd = 0; for (i = 0; i < N; i++) if (D[i] > bd) { bd = D[i]; bi = i; }
    // 화면 좌표로 (변형 없이 잰 위치)
    var oldQ = S.quote.style.transform, oldL2 = S.l2.style.transform;
    S.quote.style.transform = 'none'; S.l2.style.transform = 'none';
    var er = el.getBoundingClientRect(), qr = S.quote.getBoundingClientRect(), sr = S.scene.getBoundingClientRect(), sc = F / FC;
    S.quote.style.transform = oldQ; S.l2.style.transform = oldL2;
    var ox = er.left - qr.left + ((bi % W) - pad) * sc, oy = er.top - qr.top + (((bi / W) | 0) - pad) * sc;
    var r = Math.max(0.5, bd * sc);
    // 구멍만 불투명한 마스크 (가장자리 1px 넓혀 흰 테두리가 남지 않게)
    var mk = document.createElement('canvas'); mk.width = W; mk.height = H;
    var mg = mk.getContext('2d'), md = mg.createImageData(W, H);
    for (i = 0; i < N; i++) {
      var hole = lab[i] === best || (i % W > 0 && lab[i - 1] === best) || (i % W < W - 1 && lab[i + 1] === best) || lab[i - W] === best || lab[i + W] === best;
      if (hole) { md.data[i * 4] = md.data[i * 4 + 1] = md.data[i * 4 + 2] = 255; md.data[i * 4 + 3] = 255; }
    }
    mg.putImageData(md, 0, 0);
    return { ox: ox, oy: oy, sx: qr.left + ox, sy: qr.top - sr.top + oy, qx: qr.left - sr.left, qy: qr.top - sr.top,
      gx: er.left - qr.left - pad * sc, gy: er.top - qr.top - pad * sc, gw: W * sc, gh: H * sc, mask: mk,
      fill: Math.hypot(innerWidth, innerHeight) / 2 / r * 1.12 };
  }
  function mix(a, b, t) {
    var A = parseInt(a.slice(1), 16), B = parseInt(b.slice(1), 16), o = '#', s;
    for (s = 16; s >= 0; s -= 8) { var v = Math.round(((A >> s) & 255) * (1 - t) + ((B >> s) & 255) * t); o += (v < 16 ? '0' : '') + v.toString(16); }
    return o;
  }

  var dtS = 0.016;
  function stTarget(S) { var vh = innerHeight, r = S.pin.getBoundingClientRect(), span = S.pin.offsetHeight - vh; return clamp((0.5 * vh - r.top) / (0.5 * vh + span), 0, 1); }
  function portalFrame(S, q) {
    if (!S.m) { S.m = measurePortal(S); if (!S.m) return; }
    // 지도로 들어가는 문장은 끝까지 확대가 이어지고(지도와 화면이 정확히 겹치는 순간 교체), 특징으로 가는 문장은 확대 후 서서히 사라짐
    var zEnd = S.peek ? 0.95 : 0.86;
    var M = S.m, z = smooth(seg(q, 0.44, zEnd)), mv = smooth(seg(q, 0.44, 0.72));
    var sc = Math.exp(Math.log(M.fill) * Math.pow(z, 1.6));   // 일정한 속도로 빨려 들어가는 느낌의 지수 확대
    var tx = (innerWidth / 2 - M.sx) * mv, ty = (innerHeight / 2 - M.sy) * mv;
    S.quote.style.transformOrigin = M.ox.toFixed(2) + 'px ' + M.oy.toFixed(2) + 'px';
    S.quote.style.transform = z > 0 ? 'translate3d(' + tx.toFixed(2) + 'px,' + ty.toFixed(2) + 'px,0) scale(' + sc.toFixed(4) + ')' : '';
    S.bar.style.opacity = (1 - seg(q, 0.44, 0.5)).toFixed(3);
    S.scene.style.background = mix('#ffffff', S.color, smooth(seg(q, 0.66, 0.88)));   // 구멍 속 색이 다음 섹션 색으로
    if (S.peek) drawPeek(S, M, z, tx, ty, sc);
    // 지도 문장: 확대가 끝난(0.95) 뒤, 장면이 화면에서 밀려 올라가기 전에(0.975) 실제 지도로 교체 → 위아래가 어긋나 보이는 순간이 없음
    var f = S.peek ? (q >= 0.975 || S.pin.getBoundingClientRect().bottom <= innerHeight + 1 ? 1 : 0) : smooth(seg(q, 0.86, 0.985));
    S.scene.style.opacity = (1 - f).toFixed(3);
    S.scene.style.visibility = f > 0.999 ? 'hidden' : '';
    S.scene.style.pointerEvents = f > 0.5 ? 'none' : '';
  }
  function drawPeek(S, M, z, tx, ty, sc) {
    var cv = S.peek, src = S.peekSrc, W = S.scene.clientWidth, H = S.scene.clientHeight, dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    if (cv.width !== Math.round(W * dpr) || cv.height !== Math.round(H * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); }
    var g = cv.getContext('2d');
    g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, cv.width, cv.height);
    if (z <= 0 || !src.width || !src.height) return;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    // ① 구멍 모양을 글자와 똑같이 확대·이동해 그림
    var X = function (px) { return M.qx + M.ox + (px - M.ox) * sc + tx; };
    var Y = function (py) { return M.qy + M.oy + (py - M.oy) * sc + ty; };
    g.drawImage(M.mask, X(M.gx), Y(M.gy), M.gw * sc, M.gh * sc);
    // ② 그 안에만 지도: 처음엔 멀리(작게·살짝 기울어) 있다가, 확대될수록 다가와 실제 지도 화면과 꼭 맞게
    g.globalCompositeOperation = 'source-in';
    var e = z * z * (3 - 2 * z), k = 0.42 + 0.58 * e, rot = (1 - e) * -0.12;
    var cx = M.sx + tx, cy = M.sy + ty, fx = cx + (W / 2 - cx) * e, fy = cy + (H / 2 - cy) * e;
    // 지도는 구멍 안에서 서서히 떠오르듯 나타남 (갑자기 보이지 않도록)
    var fa = seg(z, 0.02, 0.42); fa = fa * fa * (3 - 2 * fa);
    g.save(); g.globalAlpha = fa; g.translate(fx, fy); g.rotate(rot); g.scale(k, k); g.translate(-W / 2, -H / 2);
    g.drawImage(src, 0, 0, W, H);
    g.restore();
    // ③ 가장자리를 살짝 어둡게 : 터널 속으로 들어가는 깊이감 (끝에 가까울수록 사라짐)
    var v = Math.sin(Math.PI * Math.min(1, z * 1.15)) * 0.38 * fa;
    if (v > 0.01) {
      var rg = g.createRadialGradient(fx, fy, Math.min(W, H) * 0.12 * k, fx, fy, Math.hypot(W, H) * 0.55 * k);
      rg.addColorStop(0, 'rgba(40,30,21,0)'); rg.addColorStop(1, 'rgba(40,30,21,' + v.toFixed(3) + ')');
      g.globalCompositeOperation = 'source-atop'; g.fillStyle = rg; g.fillRect(0, 0, W, H);
    }
    g.globalCompositeOperation = 'source-over';
  }
  function update() {
    if (reduce) return;
    stmts.forEach(function (S) {
      var qt = stTarget(S);
      S.sq += (qt - S.sq) * (1 - Math.exp(-dtS * 4.2));
      if (S.peek && qt > 0.8 && S.sq > 0.6) S.sq = Math.max(S.sq, qt - 0.004);   // 지도로 들어가는 끝부분은 스크롤을 바로 따라가게 (늦게 따라오면 장면이 어긋남)
      if (Math.abs(qt - S.sq) < 0.0004) S.sq = qt;
      var full = S.sq, P = S.pin.classList.contains('dm-portal');
      var q = P ? Math.min(1, full / 0.55) : full;   // 글자는 앞부분에서 다 나오고, 뒷부분은 구멍 속으로 확대
      S.bar.style.transform = 'scaleX(' + outCubic(seg(q, 0.0, 0.27)).toFixed(4) + ')';
      var b = outCubic(seg(q, 0.42, 0.62));
      S.l1.style.opacity = smooth(seg(q, 0.25, 0.44)).toFixed(3);
      S.l2.style.opacity = smooth(seg(q, 0.42, 0.56)).toFixed(3);
      S.l2.style.transform = 'translate3d(0,' + ((1 - b) * 105).toFixed(2) + '%,0)';
      if (P) portalFrame(S, full);
    });
  }
  function settling() { return stmts.some(function (S) { return Math.abs(stTarget(S) - S.sq) > 0.0005; }); }

  var raf = 0, lastT = 0;
  function request() { if (!raf) raf = requestAnimationFrame(tick); }
  function tick(ts) {
    raf = 0;
    dtS = lastT ? Math.min(0.1, (ts - lastT) / 1000) : 0.016; lastT = ts;
    update();
    if (settling()) request(); else lastT = 0;
  }
  addEventListener('scroll', request, { passive: true });
  addEventListener('resize', function () { applyModes(); request(); });
  if (mqReduce.addEventListener) mqReduce.addEventListener('change', function () { reduce = mqReduce.matches; applyModes(); request(); });

  applyModes();
  // 지도 캔버스가 새 크기(화면 가득)에 맞춰 다시 그려지도록
  setTimeout(function () { dispatchEvent(new Event('resize')); }, 60);
  var fontsReady = document.fonts && document.fonts.load ? Promise.race([
    Promise.all([document.fonts.load('400 40px PretendardLocal'), document.fonts.load('600 40px PretendardLocal')]),
    new Promise(function (r) { setTimeout(r, 1800); })]).catch(function () {}) : Promise.resolve();
  fontsReady.then(function () { stmts.forEach(function (S) { S.m = null; }); request(); });
  request();
})();
