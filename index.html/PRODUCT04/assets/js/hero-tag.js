/* =========================================================
   01 히어로 — 매달린 3D 태그 + 부딪히면 튕기는 글자 (오프라인 · 외부 라이브러리 없음)
   · 페이지가 열리고 0.8초 뒤, 화면 위에서 매달린 태그가 "대롱~" 하고 떨어져 흔들림
   · 태그를 눌러 잡아서 옮기거나 던질 수 있음
   · 태그가 큰 글자(VALUE DISCOVERY TAG)에 부딪히면 글자가 툭툭 밀렸다가 제자리로 돌아옴
   ========================================================= */
(function () {
  'use strict';
  var hero = document.getElementById('heroTag'); if (!hero) return;
  var cvR = hero.querySelector('.ht-rope'), cvG = hero.querySelector('.ht-gl'), title = hero.querySelector('.ht-title');
  var rg = cvR.getContext('2d');
  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var DELAY = 800;                          // 태그가 나타나기까지 (ms)
  var T0 = performance.now();

  /* ---------- 글자를 한 자씩 나눔 ---------- */
  var LET = [], li = 0;
  title.querySelectorAll('.w').forEach(function (w) {
    var t = w.textContent; w.textContent = '';
    for (var i = 0; i < t.length; i++) {
      var s = document.createElement('span'); s.className = 'ch'; s.setAttribute('aria-hidden', 'true');
      var inner = document.createElement('i'); inner.textContent = t[i]; inner.style.setProperty('--i', li++);
      s.appendChild(inner); w.appendChild(s);
      LET.push({ el: s, hx: 0, hy: 0, w: 0, h: 0, ox: 0, oy: 0, vx: 0, vy: 0, a: 0, va: 0 });
    }
  });

  /* ---------- 크기 · 기준 위치 ---------- */
  var W = 1, H = 1, DPR = 1, A = { x: 0, y: 0 }, ROPE = 300, TH = 300, TW = 140, K = 1;
  function measure() {
    var r = hero.getBoundingClientRect(); W = r.width; H = r.height; DPR = Math.min(2, window.devicePixelRatio || 1);
    [cvR, cvG].forEach(function (c) { c.width = Math.round(W * DPR); c.height = Math.round(H * DPR); });
    var narrow = W < 769;
    K = Math.min(H * (narrow ? 0.34 : 0.46), W * 0.36) / BODY_H;     // 태그 몸통 크기 (v24와 같음)
    TH = PIV * K; TW = MODEL_W * K;                                     // TH : 끈 꼭대기 ~ 태그 바닥 (끈 포함)
    A.y = -(TH * 1.1 + 40);                                             // 보이지 않는 매달린 점 (화면 위 바깥)
    ROPE = (H * (narrow ? 0.6 : 0.53) - (PIV - BODY_H / 2) * K) - A.y; // 태그 몸통이 화면 세로 가운데쯤 오도록
    LET.forEach(function (L) {
      var t = L.el.style.transform; L.el.style.transform = 'none';
      var b = L.el.getBoundingClientRect(); L.hx = b.left - r.left + b.width / 2; L.hy = b.top - r.top + b.height * 0.55; L.w = b.width; L.h = b.height * 0.72;
      L.el.style.transform = t;
    });
    // 매달린 자리 : 제목 글자(특히 DISCOVERY의 Y)와 흔들려도 닿지 않을 만큼 오른쪽으로 띄움
    var tr = 0; LET.forEach(function (L) { tr = Math.max(tr, L.hx + L.w / 2); });
    A.x = Math.min(W - TW * 0.75, Math.max(W * (narrow ? 0.76 : 0.72), tr + TW * 0.5 + Math.max(90, TW * 0.9)));
  }

  /* ---------- 태그 물리 (줄에 매달린 점 + 고무줄처럼 늘어나는 줄) ---------- */
  var G = 2600, KS = 380, CS = 9, AIR = 0.62;   // 중력 · 줄 탄성 · 줄 감쇠 · 공기 저항
  var T = { x: 0, y: 0, vx: 0, vy: 0, roll: 0, rollV: 0, yaw: 0.35, yawV: 0, on: false };
  function dropIn() {
    T.on = true; T.x = A.x + Math.min(W * 0.08, 120); T.y = -TH * 1.15; T.vx = -40; T.vy = 0; T.yawV = 1.6;   // 화면 위에서 떨어져 줄에 걸리며 대롱~
  }
  var mouse = { x: -1e4, y: -1e4, vx: 0, vy: 0, t: 0, in: false }, grab = null, hitUntil = 0;
  function seg() {   // 태그 몸통 충돌 범위 (매달린 점에서 아래로 이어진 캡슐)
    var s = Math.sin(T.roll), c = Math.cos(T.roll);
    var f0 = (PIV - BODY_H * 0.92) / PIV, f1 = (PIV - BODY_H * 0.04) / PIV;
    return { ax: T.x + s * TH * f0, ay: T.y + c * TH * f0, bx: T.x + s * TH * f1, by: T.y + c * TH * f1, r: TW * 0.5 };
  }
  function closest(px, py, S) { var dx = S.bx - S.ax, dy = S.by - S.ay, t = Math.max(0, Math.min(1, ((px - S.ax) * dx + (py - S.ay) * dy) / (dx * dx + dy * dy || 1))); return [S.ax + dx * t, S.ay + dy * t]; }
  function step(dt) {
    // 줄 · 중력
    var dx = T.x - A.x, dy = T.y - A.y, d = Math.hypot(dx, dy) || 1, nx = dx / d, ny = dy / d;
    var ax = 0, ay = G;
    if (d > ROPE) { var st = d - ROPE, vr = T.vx * nx + T.vy * ny; ax -= nx * (KS * st + CS * vr); ay -= ny * (KS * st + CS * vr); }
    ax -= T.vx * AIR; ay -= T.vy * AIR;
    if (grab) {   // 잡고 끌기 : 커서 쪽으로 끌려감
      var gx = mouse.x - grab.ox, gy = mouse.y - grab.oy; ax += (gx - T.x) * 260 - T.vx * 18; ay += (gy - T.y) * 260 - T.vy * 18 - G;
    }
    T.vx += ax * dt; T.vy += ay * dt; T.x += T.vx * dt; T.y += T.vy * dt;
    // 태그 기울기 : 줄 방향을 살짝 늦게 따라감 + 흔들림
    var target = Math.atan2(T.x - A.x, T.y - A.y);
    T.rollV += ((target - T.roll) * 90 - T.rollV * 9) * dt; T.roll += T.rollV * dt;
    T.yawV += (-(T.yaw - 0.35) * 6 - T.yawV * 0.9) * dt; T.yaw += T.yawV * dt;
    // 커서로 스치기
    var S = seg();
    // 글자와 부딪힘 : 사용자가 잡아서 움직이거나 던졌을 때만 (혼자 흔들릴 때는 글자를 건드리지 않음)
    if (!grab && performance.now() > hitUntil) return;
    LET.forEach(function (L) {
      var cx = L.hx + L.ox, cy = L.hy + L.oy, q = closest(cx, cy, S), ex = cx - q[0], ey = cy - q[1], e = Math.hypot(ex, ey) || 1, R = S.r + Math.min(L.w, L.h) * 0.42;
      if (e < R) {
        var nx2 = ex / e, ny2 = ey / e, rel = (T.vx - L.vx) * nx2 + (T.vy - L.vy) * ny2, push = Math.max(0, rel) * 0.9 + 90;
        L.vx += nx2 * push; L.vy += ny2 * push * 0.8; L.va += (nx2 * 0.6 - ny2 * 0.3) * push * 0.004 * (Math.random() > 0.5 ? 1 : -1) + nx2 * 0.15;
        L.ox += nx2 * (R - e) * 0.6; L.oy += ny2 * (R - e) * 0.6;
        if (rel > 0) { T.vx -= nx2 * rel * 0.32; T.vy -= ny2 * rel * 0.32; T.yawV += (Math.random() - 0.5) * 2.2; }
      }
    });
  }
  function stepLetters(dt) {
    LET.forEach(function (L) {
      L.vx += (-L.ox * 70 - L.vx * 8.5) * dt; L.vy += (-L.oy * 70 - L.vy * 8.5) * dt; L.va += (-L.a * 60 - L.va * 7) * dt;
      L.ox += L.vx * dt; L.oy += L.vy * dt; L.a += L.va * dt;
      var moving = Math.abs(L.ox) + Math.abs(L.oy) + Math.abs(L.a) * 40 > 0.15;
      if (moving || L.was) L.el.style.transform = moving ? 'translate(' + L.ox.toFixed(2) + 'px,' + L.oy.toFixed(2) + 'px) rotate(' + L.a.toFixed(4) + 'rad)' : '';
      L.was = moving;
    });
  }

  /* ---------- 입력 ---------- */
  function local(e) { var r = hero.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; }
  function onTag(x, y) { if (!T.on) return false; var S = seg(), q = closest(x, y, S); return Math.hypot(x - q[0], y - q[1]) < S.r + 6; }
  hero.addEventListener('pointermove', function (e) {
    var p = local(e), now = performance.now(), dt = Math.max(8, now - mouse.t) / 1000;
    if (mouse.in) { mouse.vx = mouse.vx * 0.4 + (p[0] - mouse.x) / dt * 0.6; mouse.vy = mouse.vy * 0.4 + (p[1] - mouse.y) / dt * 0.6; }
    mouse.x = p[0]; mouse.y = p[1]; mouse.t = now; mouse.in = true;
    hero.classList.toggle('over-tag', !grab && onTag(p[0], p[1]));
  });
  hero.addEventListener('pointerleave', function () { mouse.in = false; hero.classList.remove('over-tag'); });
  hero.addEventListener('pointerdown', function (e) {
    var p = local(e); if (!onTag(p[0], p[1]) || e.target.closest('a,button')) return;
    grab = { ox: p[0] - T.x, oy: p[1] - T.y, id: e.pointerId }; hero.setPointerCapture(e.pointerId); hero.classList.add('grab-tag'); e.preventDefault();
  });
  var release = function (e) { if (!grab) return; grab = null; hitUntil = performance.now() + 2200; hero.classList.remove('grab-tag'); T.vx = mouse.vx * 0.8; T.vy = mouse.vy * 0.8; T.yawV += mouse.vx * 0.003; };
  hero.addEventListener('pointerup', release); hero.addEventListener('pointercancel', release);

  /* ---------- 3D 태그 그리기 (WebGL) ---------- */
  var gl = null, PROG = null, parts = [], U = {}, MODEL = null, MODEL_W = 51, MODEL_H = 180, BODY_H = 107.1, PIV = 180, ready = false;
  var VS = 'attribute vec3 p;attribute vec3 n;uniform mat4 VP,Mo;uniform float S;varying vec3 vn,vw;' +
    'void main(){vec4 w=Mo*vec4(p*S,1.);vw=w.xyz;vn=normalize(mat3(Mo)*(n/127.));gl_Position=VP*w;}';
  var FS = 'precision highp float;varying vec3 vn,vw;uniform vec3 col,emi,eye;uniform float rough,coat;' +
    'vec3 tone(vec3 c){c=c*.95;c=(c*(2.51*c+.03))/(c*(2.43*c+.59)+.14);return pow(clamp(c,0.,1.),vec3(1./2.2));}' +
    'void main(){vec3 N=normalize(vn);vec3 V=normalize(eye-vw);if(dot(N,V)<0.)N=-N;' +
    ' vec3 L1=normalize(vec3(-.55,.75,.65)),L2=normalize(vec3(.8,.25,.35)),L3=normalize(vec3(.1,.5,-1.));' +
    ' float hemi=.5+.5*N.y;vec3 amb=mix(vec3(.28,.28,.29),vec3(.6,.6,.61),hemi);' +
    ' vec3 c=col*(amb+vec3(1.,.97,.93)*1.2*max(dot(N,L1),0.)+vec3(.55,.58,.62)*.55*max(dot(N,L2),0.)+.45*max(dot(N,L3),0.));' +
    ' float sh=2./(rough*rough*rough+.002);' +
    ' float sp=pow(max(dot(N,normalize(L1+V)),0.),sh)*(1.-rough)*.6+pow(max(dot(N,normalize(L2+V)),0.),sh)*(1.-rough)*.25;' +
    ' float fr=pow(1.-max(dot(N,V),0.),5.);c+=vec3(sp)+fr*.10;' +
    ' if(coat>.5){c+=vec3(pow(max(dot(N,normalize(L1+V)),0.),900.)*2.5+pow(max(dot(N,normalize(L2+V)),0.),600.)*.8)+fr*.35;}' +
    ' c+=emi;gl_FragColor=vec4(tone(c),1.);}';
  function mul(a, b) { var o = new Array(16); for (var i = 0; i < 4; i++) for (var j = 0; j < 4; j++) { var s = 0; for (var k = 0; k < 4; k++) s += a[k * 4 + j] * b[i * 4 + k]; o[i * 4 + j] = s; } return o; }
  function rotX(a) { var c = Math.cos(a), s = Math.sin(a); return [1, 0, 0, 0, 0, c, s, 0, 0, -s, c, 0, 0, 0, 0, 1]; }
  function rotY(a) { var c = Math.cos(a), s = Math.sin(a); return [c, 0, -s, 0, 0, 1, 0, 0, s, 0, c, 0, 0, 0, 0, 1]; }
  function rotZ(a) { var c = Math.cos(a), s = Math.sin(a); return [c, s, 0, 0, -s, c, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]; }
  function tr(x, y, z) { return [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, x, y, z, 1]; }
  function sc(k) { return [k, 0, 0, 0, 0, k, 0, 0, 0, 0, k, 0, 0, 0, 0, 1]; }
  function ortho(l, r, b, t, n, f) { return [2 / (r - l), 0, 0, 0, 0, 2 / (t - b), 0, 0, 0, 0, -2 / (f - n), 0, -(r + l) / (r - l), -(t + b) / (t - b), -(f + n) / (f - n), 1]; }
  function sh(type, src) { var s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw gl.getShaderInfoLog(s); return s; }
  /* 태그 끈 : 태그 위쪽 구멍(y≈94mm)을 꿰어 지나가 위로 곧게 늘어진 납작한 실리콘 고리 (단위 mm)
     앞가닥은 태그 앞면 위로, 뒷가닥은 뒷면 뒤로 지나가 구멍 속에서 이어짐 */
  var HOLE_Y = 93.3, STRAP_TOP = 172, Z_F = 3.45, Z_B = -5.0, BODY_EDGE = 113, BAND_W = 3.4, BAND_T = 0.9;   // 새 모델(tag_recent): 앞면 z=2.75 · 뒷면 z=-4.25
  function straightStrap(q) {
    // 고리 중심선 (y,z) : 앞가닥은 태그 앞면에서 띄워 곧게 내려와 구멍으로 꺾여 들어가고,
    // 구멍 속을 가로질러 뒤로 나온 뒤 뒷면에서 띄워 곧게 올라감 → 태그 몸통을 뚫지 않음
    var path = [], i, r = 0.9, rt = 1.4, zt = (Z_F + Z_B) / 2, yb = HOLE_Y;
    function arc(cy, cz, rad, a0, a1, n) { for (var k = 1; k <= n; k++) { var a = a0 + (a1 - a0) * k / n; path.push([cy + Math.sin(a) * rad, cz + Math.cos(a) * rad]); } }
    function line(y0, z0, y1, z1, n) { for (var k = 1; k <= n; k++) { var f = k / n; path.push([y0 + (y1 - y0) * f, z0 + (z1 - z0) * f]); } }
    line(yb, Z_B + r, yb, Z_F - r, 8);                                   // 구멍 속 (뒤 → 앞)
    arc(yb + r, Z_F - r, r, Math.PI * 1.5, Math.PI * 2, 4);                 // 앞쪽 모서리
    line(yb + r, Z_F, BODY_EDGE, Z_F, 10);                              // 앞가닥 (몸통 앞면에서 띄워 곧게)
    line(BODY_EDGE, Z_F, STRAP_TOP - rt, zt + rt, 14);                  // 위로 모이며 올라감
    for (i = 1; i <= 10; i++) { path.push([STRAP_TOP - rt + Math.sin(i / 10 * Math.PI) * rt, zt + Math.cos(i / 10 * Math.PI) * rt]); }   // 꼭대기 접힘
    line(STRAP_TOP - rt, zt - rt, BODY_EDGE, Z_B, 14);                  // 뒷가닥 내려옴
    line(BODY_EDGE, Z_B, yb + r, Z_B, 10);                              // 몸통 뒷면에서 띄워 곧게
    arc(yb + r, Z_B + r, r, Math.PI, Math.PI * 1.5, 4);              // 뒤쪽 모서리
    var P = [], Nn = [], I = [], n = path.length;
    for (i = 0; i < n; i++) {
      var pa = path[(i - 1 + n) % n], pb = path[(i + 1) % n], ty = pb[0] - pa[0], tz = pb[1] - pa[1], tl = Math.hypot(ty, tz) || 1, ny = -tz / tl, nz = ty / tl;
      var cy = path[i][0], cz = path[i][1], h = BAND_W / 2, t = BAND_T / 2;
      [[-h, 1], [h, 1], [h, -1], [-h, -1]].forEach(function (c) { P.push(c[0], cy + ny * t * c[1], cz + nz * t * c[1]); Nn.push(0, Math.round(ny * 127 * c[1]), Math.round(nz * 127 * c[1])); });
    }
    for (i = 0; i < n; i++) { var A0 = i * 4, B0 = ((i + 1) % n) * 4;
      [[0, 1], [1, 2], [2, 3], [3, 0]].forEach(function (e) { I.push(A0 + e[0], B0 + e[0], B0 + e[1], A0 + e[0], B0 + e[1], A0 + e[1]); }); }
    PIV = STRAP_TOP;
    var mk = function (tg, arr) { var bf = gl.createBuffer(); gl.bindBuffer(tg, bf); gl.bufferData(tg, arr, gl.STATIC_DRAW); return bf; };
    return { flt: true, p: mk(gl.ARRAY_BUFFER, new Float32Array(P)), n: mk(gl.ARRAY_BUFFER, new Int8Array(Nn)), i: mk(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(I)), cnt: I.length, big: false, col: q.color, emi: [0, 0, 0], rough: q.rough, coat: 0 };
  }
  function load() {
    var D = window.TAG_MODEL; if (!D || !('DecompressionStream' in window)) return Promise.reject('unsupported');
    var raw = Uint8Array.from(atob(D.gz), function (c) { return c.charCodeAt(0); });
    return new Response(new Blob([raw]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer().then(function (buf) {
      gl = cvG.getContext('webgl', { antialias: true, alpha: true, premultipliedAlpha: true }); if (!gl) throw 'nogl';
      var uint = gl.getExtension('OES_element_index_uint');
      PROG = gl.createProgram(); gl.attachShader(PROG, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(PROG, sh(gl.FRAGMENT_SHADER, FS)); gl.linkProgram(PROG);
      ['VP', 'Mo', 'S', 'col', 'emi', 'eye', 'rough', 'coat'].forEach(function (k) { U[k] = gl.getUniformLocation(PROG, k); });
      D.parts.forEach(function (q) {
        if (q.big && !uint) return;
        if (q.st && q.st !== 'price') return;   // 화면은 가격 상태만
        if (/strap/i.test(q.name)) { parts.push(straightStrap(q)); return; }
        var mk = function (t, a) { var b = gl.createBuffer(); gl.bindBuffer(t, b); gl.bufferData(t, a, gl.STATIC_DRAW); return b; };
        parts.push({ p: mk(gl.ARRAY_BUFFER, new Int16Array(buf, q.pos[0], q.pos[1] / 2)), n: mk(gl.ARRAY_BUFFER, new Int8Array(buf, q.nrm[0], q.nrm[1])),
          i: mk(gl.ELEMENT_ARRAY_BUFFER, q.big ? new Uint32Array(buf, q.idx[0], q.idx[1] / 4) : new Uint16Array(buf, q.idx[0], q.idx[1] / 2)),
          cnt: q.big ? q.idx[1] / 4 : q.idx[1] / 2, big: q.big, col: q.color, emi: q.emissive.map(function (v) { return v * 0.2; }), rough: q.rough, coat: q.coat ? 1 : 0 });
      });
      MODEL = D; MODEL_W = D.bmax[0] - D.bmin[0]; BODY_H = 107.1; MODEL_H = PIV;
      ready = true; measure();
    });
  }
  function drawTag() {
    gl.viewport(0, 0, cvG.width, cvG.height); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    if (!T.on) return;
    // 화면 픽셀 좌표 그대로 (y는 위가 +) — 매달린 점(모델 꼭대기)을 기준으로 회전
    var VP = ortho(0, W, 0, H, -4000, 4000);
    var Mo = mul(tr(T.x, H - T.y, 0), mul(rotZ(T.roll), mul(rotY(T.yaw), mul(rotX(-0.08), mul(sc(K), tr(0, -PIV, 0))))));
    gl.enable(gl.DEPTH_TEST); gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.useProgram(PROG); gl.uniformMatrix4fv(U.VP, false, VP); gl.uniformMatrix4fv(U.Mo, false, Mo); gl.uniform1f(U.S, MODEL.scale);
    gl.uniform3f(U.eye, W / 2, H / 2, 3000);
    var pa = gl.getAttribLocation(PROG, 'p'), na = gl.getAttribLocation(PROG, 'n'); gl.enableVertexAttribArray(pa); gl.enableVertexAttribArray(na);
    parts.forEach(function (q) {
      gl.uniform1f(U.S, q.flt ? 1 : MODEL.scale);
      gl.bindBuffer(gl.ARRAY_BUFFER, q.p); gl.vertexAttribPointer(pa, 3, q.flt ? gl.FLOAT : gl.SHORT, false, 0, 0);
      gl.bindBuffer(gl.ARRAY_BUFFER, q.n); gl.vertexAttribPointer(na, 3, gl.BYTE, false, 0, 0);
      gl.uniform3fv(U.col, q.col); gl.uniform3fv(U.emi, q.emi); gl.uniform1f(U.rough, q.rough); gl.uniform1f(U.coat, q.coat);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, q.i); gl.drawElements(gl.TRIANGLES, q.cnt, q.big ? gl.UNSIGNED_INT : gl.UNSIGNED_SHORT, 0);
    });
  }
  function drawRope() {
    rg.setTransform(DPR, 0, 0, DPR, 0, 0); rg.clearRect(0, 0, W, H); if (!T.on) return;
    // (따로 그린 줄 없음 — 태그에 달린 끈만 보임)
    // 그림자 (오른쪽 아래로 은은하게)
    var S = seg(), gx = (S.ax + S.bx) / 2 + TW * 0.28, gy = (S.ay + S.by) / 2 + TH * 0.05, gr = rg.createRadialGradient(gx, gy, 0, gx, gy, TH * 0.42);
    gr.addColorStop(0, 'rgba(61,46,33,.07)'); gr.addColorStop(1, 'rgba(61,46,33,0)'); rg.fillStyle = gr; rg.fillRect(gx - TH * 0.5, gy - TH * 0.5, TH, TH);
  }

  /* ---------- 반복 ---------- */
  var last = performance.now(), visible = true;
  function loop(now) {
    var dt = Math.min(0.033, (now - last) / 1000); last = now;
    if (ready && !T.on && now - T0 >= DELAY) { if (reduce) { T.on = true; T.x = A.x; T.y = A.y + ROPE + 4; } else dropIn(); }
    if (T.on && !reduce) { var n = 4; for (var i = 0; i < n; i++) step(dt / n); }
    stepLetters(dt);
    if (ready && visible) { drawRope(); drawTag(); }
    requestAnimationFrame(loop);
  }
  new IntersectionObserver(function (es) { visible = es[0].isIntersecting; }).observe(hero);
  addEventListener('resize', function () { measure(); });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(measure);
  measure();
  requestAnimationFrame(loop);
  // 모델 불러오기 (사이트 안의 파일 · 인터넷 없이도 동작)
  function go() { load().catch(function (err) { console.warn('hero tag:', err); }); }
  if (window.TAG_MODEL) go();
  else if (document.querySelector('script[src*="tag-model.js"]')) { (function w() { if (window.TAG_MODEL) go(); else setTimeout(w, 150); })(); }
  else { var s = document.createElement('script'); s.src = 'assets/models/tag-model.js'; s.onload = go; document.body.appendChild(s); }
  window.HeroTag = { T: T, LET: LET };
})();
