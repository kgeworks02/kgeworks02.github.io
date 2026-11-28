/* =========================================================
   07 제품 디자인 — 화면 가득 3D 태그 + 스크롤하면 부위별 클로즈업 (오프라인 · 외부 라이브러리 없음)
   · 화면이 멈춘 채로 스크롤하면 카메라가 전체 → 크기 → 디스플레이 → 토글 → 두께 → 스트랩 순서로 다가감
   · 단계마다 색상(CMF) · 치수가 자연스럽게 그려지며 나타남
   · 모델 : assets/models/tag-model.js (window.TAG_MODEL)
   ========================================================= */
(function () {
  'use strict';
  var root = document.getElementById('dz'); if (!root) return;
  var stage = root.querySelector('.dz-stage'), cv = root.querySelector('.dz-cv'), svg = root.querySelector('.dz-dims');
  var steps = [].slice.call(root.querySelectorAll('.dz-step')), bar = [].slice.call(root.querySelectorAll('.dz-prog i'));
  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- 단계별 카메라 (단위 mm · 모델 바닥 y=0, 앞면 +z) ---------- */
  var KEY = [
    { t: [0, 70, 0], d: 285, yaw: 0.55, pitch: 0.12 },   // 0 전체
    { t: [0, 52, 0], d: 330, yaw: 0.0, pitch: 0.0 },     // 1 크기
    { t: [0, 63, 1], d: 185, yaw: 0.2, pitch: 0.06 },   // 2 디스플레이
    { t: [0, 30, 2], d: 200, yaw: -0.35, pitch: 0.22 },  // 3 토글
    { t: [0, 54, 0], d: 300, yaw: 1.5, pitch: 0.08 },    // 4 두께 (옆면)
    { t: [0, 100, 0], d: 215, yaw: 0.55, pitch: 0.16 }     // 5 스트랩
  ];

  /* ---------- 치수선 (3D 점을 화면에 투영해서 그림) ---------- */
  var NS = 'http://www.w3.org/2000/svg';
  function el(n, a, p) { var e = document.createElementNS(NS, n); for (var k in a) e.setAttribute(k, a[k]); if (p) p.appendChild(e); return e; }
  // [단계, 시작점, 끝점, 글자, 치수선을 얼마나 띄울지(화면 px, 법선 방향)]
  var DIMS = [
    { s: 1, a: [-25.5, 0, 4.3], b: [25.5, 0, 4.3], txt: '51 mm', off: 46 },
    { s: 1, a: [-25.5, 0, 4.3], b: [-25.5, 107.1, 4.3], txt: '107 mm', off: -46 },
    { s: 2, a: [-18.5, 65.04, 3], b: [18.5, 65.04, 3], txt: 'Ø 37 mm', off: -120 },
    { s: 3, a: [25.5, 31.4, 4.3], b: [25.5, 28.4, 4.3], txt: '3 mm', off: -54, arrow: true },
    { s: 4, a: [0, 0, -4.25], b: [0, 0, 4.25], txt: '8.5 mm', off: 44 },
    { s: 4, a: [0, 0, 4.25], b: [0, 107.1, 4.25], txt: '107 mm', off: -54 },
    { s: 5, a: [-3.45, 93.3, 3], b: [3.45, 93.3, 3], txt: 'Ø 6.9 mm', off: -70 }
  ];
  DIMS.forEach(function (D) {
    D.g = el('g', { 'class': 'dz-dim' }, svg);
    D.e1 = el('line', { 'class': 'ex' }, D.g); D.e2 = el('line', { 'class': 'ex' }, D.g);
    D.l = el('line', { 'class': 'dl' }, D.g); D.t1 = el('path', { 'class': 'tk' }, D.g); D.t2 = el('path', { 'class': 'tk' }, D.g);
    D.bg = el('rect', { 'class': 'tb', rx: 13, height: 26 }, D.g); D.tx = el('text', { 'class': 'tt', 'text-anchor': 'middle' }, D.g); D.tx.textContent = D.txt;
  });

  /* ---------- WebGL ---------- */
  var gl = null, P = null, U = {}, parts = [], M = null, ready = false;
  var VS = 'attribute vec3 p;attribute vec3 n;uniform mat4 VP,Mo;uniform float S;uniform vec3 off;varying vec3 vn,vw;' +
    'void main(){vec4 w=Mo*vec4(p*S+off,1.);vw=w.xyz;vn=normalize(mat3(Mo)*(n/127.));gl_Position=VP*w;}';
  var FS = 'precision highp float;varying vec3 vn,vw;uniform vec3 col,emi,eye;uniform float rough,coat,fade;' +
    'vec3 tone(vec3 c){c=c*.95;c=(c*(2.51*c+.03))/(c*(2.43*c+.59)+.14);return pow(clamp(c,0.,1.),vec3(1./2.2));}' +
    'void main(){vec3 N=normalize(vn);vec3 V=normalize(eye-vw);if(dot(N,V)<0.)N=-N;' +
    ' vec3 L1=normalize(vec3(-.55,.75,.65)),L2=normalize(vec3(.8,.25,.35)),L3=normalize(vec3(.1,.5,-1.));' +
    ' float hemi=.5+.5*N.y;vec3 amb=mix(vec3(.27,.27,.28),vec3(.6,.6,.61),hemi);' +
    ' vec3 c=col*(amb+vec3(1.,.97,.93)*1.15*max(dot(N,L1),0.)+vec3(.55,.58,.62)*.55*max(dot(N,L2),0.)+.45*max(dot(N,L3),0.));' +
    ' float sh=2./(rough*rough*rough+.002);' +
    ' float sp=pow(max(dot(N,normalize(L1+V)),0.),sh)*(1.-rough)*.6+pow(max(dot(N,normalize(L2+V)),0.),sh)*(1.-rough)*.25;' +
    ' float fr=pow(1.-max(dot(N,V),0.),5.);c+=vec3(sp)+fr*.10;' +
    ' if(coat>.5){c+=vec3(pow(max(dot(N,normalize(L1+V)),0.),900.)*2.5+pow(max(dot(N,normalize(L2+V)),0.),600.)*.8)+fr*.3;}' +
    ' c+=emi;gl_FragColor=vec4(tone(c)*fade,fade);}';
  function sh(t, s) { var h = gl.createShader(t); gl.shaderSource(h, s); gl.compileShader(h); if (!gl.getShaderParameter(h, gl.COMPILE_STATUS)) throw gl.getShaderInfoLog(h); return h; }
  function persp(f, a, n, fa) { var t = 1 / Math.tan(f / 2); return [t / a, 0, 0, 0, 0, t, 0, 0, 0, 0, (fa + n) / (n - fa), -1, 0, 0, 2 * fa * n / (n - fa), 0]; }
  function mul(a, b) { var o = new Array(16); for (var i = 0; i < 4; i++) for (var j = 0; j < 4; j++) { var s = 0; for (var k = 0; k < 4; k++) s += a[k * 4 + j] * b[i * 4 + k]; o[i * 4 + j] = s; } return o; }
  function look(e, c) {
    var z = [e[0] - c[0], e[1] - c[1], e[2] - c[2]], l = Math.hypot(z[0], z[1], z[2]); z = z.map(function (v) { return v / l; });
    var x = [z[2], 0, -z[0]]; l = Math.hypot(x[0], x[2]) || 1; x = [x[0] / l, 0, x[2] / l];
    var y = [z[1] * x[2] - z[2] * x[1], z[2] * x[0] - z[0] * x[2], z[0] * x[1] - z[1] * x[0]];
    return [x[0], y[0], z[0], 0, x[1], y[1], z[1], 0, x[2], y[2], z[2], 0, -(x[0] * e[0] + x[1] * e[1] + x[2] * e[2]), -(y[0] * e[0] + y[1] * e[1] + y[2] * e[2]), -(z[0] * e[0] + z[1] * e[1] + z[2] * e[2]), 1];
  }
  function load() {
    var D = window.TAG_MODEL; if (!D || !('DecompressionStream' in window)) return Promise.reject('unsupported');
    var raw = Uint8Array.from(atob(D.gz), function (c) { return c.charCodeAt(0); });
    return new Response(new Blob([raw]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer().then(function (buf) {
      gl = cv.getContext('webgl', { antialias: true, alpha: true, premultipliedAlpha: true }); if (!gl) throw 'nogl';
      var uint = gl.getExtension('OES_element_index_uint');
      P = gl.createProgram(); gl.attachShader(P, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(P, sh(gl.FRAGMENT_SHADER, FS)); gl.linkProgram(P);
      ['VP', 'Mo', 'S', 'off', 'col', 'emi', 'eye', 'rough', 'coat', 'fade'].forEach(function (k) { U[k] = gl.getUniformLocation(P, k); });
      D.parts.forEach(function (q) {
        if (q.big && !uint) return;
        var mk = function (t, a) { var b = gl.createBuffer(); gl.bindBuffer(t, b); gl.bufferData(t, a, gl.STATIC_DRAW); return b; };
        parts.push({ name: q.name, st: q.st || '', cover: !!q.cover, p: mk(gl.ARRAY_BUFFER, new Int16Array(buf, q.pos[0], q.pos[1] / 2)), n: mk(gl.ARRAY_BUFFER, new Int8Array(buf, q.nrm[0], q.nrm[1])),
          i: mk(gl.ELEMENT_ARRAY_BUFFER, q.big ? new Uint32Array(buf, q.idx[0], q.idx[1] / 4) : new Uint16Array(buf, q.idx[0], q.idx[1] / 2)),
          cnt: q.big ? q.idx[1] / 4 : q.idx[1] / 2, big: q.big, col: q.color, emi: q.emissive.map(function (v) { return v * 0.2; }), rough: q.rough, coat: q.coat ? 1 : 0 });
      });
      M = D; ready = true; root.classList.add('ready');
    });
  }

  /* ---------- 스크롤 → 단계 ---------- */
  var SIDE = { scan: [[0.4793, 0.0027, 0.0012], [0.5, 0.0116, 0.0035]], detail: [[1, 0.9216, 0.8228], [0.09, 0.083, 0.074]] };
  var S = 0, Ssm = 0, cur = -1, W = 1, H = 1, DPR = 1, last = 0, vis = false, stateT = 0;
  var sm = function (a, b, x) { x = Math.min(1, Math.max(0, (x - a) / (b - a))); return x * x * (3 - 2 * x); };
  function progress() {
    var r = root.getBoundingClientRect(), span = root.offsetHeight - stage.offsetHeight;
    return Math.min(1, Math.max(0, -r.top / Math.max(1, span)));
  }
  function setStep(i) {
    if (i === cur) return; cur = i;
    steps.forEach(function (s, k) { s.classList.toggle('on', k === i); s.classList.toggle('past', k < i); });
    bar.forEach(function (b, k) { b.classList.toggle('on', k <= i); });
    DIMS.forEach(function (D) { D.g.classList.toggle('on', D.s === i); });
    stateT = performance.now();
  }
  function onScroll() { S = progress() * (KEY.length - 1); setStep(Math.min(KEY.length - 1, Math.round(S))); }
  addEventListener('scroll', onScroll, { passive: true });

  function lerp(a, b, k) { return a + (b - a) * k; }
  function camAt(s) {   // 단계 사이 : 앞뒤로 잠깐 머물렀다가 부드럽게 이동
    var i = Math.min(KEY.length - 2, Math.floor(s)), f = sm(0.18, 0.82, s - i), A = KEY[i], B = KEY[i + 1];
    return { t: [lerp(A.t[0], B.t[0], f), lerp(A.t[1], B.t[1], f), lerp(A.t[2], B.t[2], f)], d: lerp(A.d, B.d, f), yaw: lerp(A.yaw, B.yaw, f), pitch: lerp(A.pitch, B.pitch, f) };
  }
  function size() {
    DPR = Math.min(2, window.devicePixelRatio || 1); W = stage.clientWidth; H = stage.clientHeight;
    cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR); svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
  }
  addEventListener('resize', size);

  function project(VP, p) {
    var x = p[0], y = p[1], z = p[2], c = [0, 0, 0, 0];
    for (var r = 0; r < 4; r++) c[r] = VP[r] * x + VP[4 + r] * y + VP[8 + r] * z + VP[12 + r];
    return [(c[0] / c[3] * 0.5 + 0.5) * W, (1 - (c[1] / c[3] * 0.5 + 0.5)) * H];
  }
  function drawDims(VP) {
    DIMS.forEach(function (D) {
      if (!D.g.classList.contains('on') && !D.g.classList.contains('was')) { }
      var a = project(VP, D.a), b = project(VP, D.b), dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L;
      if (ny < 0 || (Math.abs(ny) < 1e-3 && nx < 0)) { nx = -nx; ny = -ny; }     // 법선은 아래(또는 오른쪽) 방향 기준
      var o = D.off * Math.max(0.45, Math.min(1, Math.min(W, H) / 800)), A = [a[0] + nx * o, a[1] + ny * o], B = [b[0] + nx * o, b[1] + ny * o];
      var set = function (e, x1, y1, x2, y2) { e.setAttribute('x1', x1.toFixed(1)); e.setAttribute('y1', y1.toFixed(1)); e.setAttribute('x2', x2.toFixed(1)); e.setAttribute('y2', y2.toFixed(1)); };
      var g = o > 0 ? 6 : -6;
      set(D.e1, a[0] + nx * g, a[1] + ny * g, A[0] + nx * g * 1.6, A[1] + ny * g * 1.6); set(D.e2, b[0] + nx * g, b[1] + ny * g, B[0] + nx * g * 1.6, B[1] + ny * g * 1.6);
      set(D.l, A[0], A[1], B[0], B[1]); D.l.style.setProperty('--len', L.toFixed(0));
      var ux = dx / L, uy = dy / L, tk = function (pt, s) { return 'M' + (pt[0] + ux * 9 * s + nx * 4).toFixed(1) + ' ' + (pt[1] + uy * 9 * s + ny * 4).toFixed(1) + 'L' + pt[0].toFixed(1) + ' ' + pt[1].toFixed(1) + 'L' + (pt[0] + ux * 9 * s - nx * 4).toFixed(1) + ' ' + (pt[1] + uy * 9 * s - ny * 4).toFixed(1); };
      D.t1.setAttribute('d', tk(A, 1)); D.t2.setAttribute('d', tk(B, -1));
      var mx = (A[0] + B[0]) / 2 + nx * 18 * (o > 0 ? 1 : -1), my = (A[1] + B[1]) / 2 + ny * 18 * (o > 0 ? 1 : -1);
      var tw = D.txt.length * 8.4 + 22; D.bg.setAttribute('x', (mx - tw / 2).toFixed(1)); D.bg.setAttribute('y', (my - 13).toFixed(1)); D.bg.setAttribute('width', tw.toFixed(1));
      D.tx.setAttribute('x', mx.toFixed(1)); D.tx.setAttribute('y', (my + 5).toFixed(1));
    });
  }

  function frame(now) {
    requestAnimationFrame(frame);
    var dt = Math.min(0.05, (now - (last || now)) / 1000); last = now;
    if (!vis || !ready) return;
    if (cv.width !== Math.round(stage.clientWidth * DPR) || cv.height !== Math.round(stage.clientHeight * DPR)) size();
    Ssm += (S - Ssm) * (reduce ? 1 : 1 - Math.pow(0.004, dt));
    var cam = camAt(Ssm), asp = W / H, fov = 0.5, fit = Math.max(1, 1.25 / asp);
    // 단계 0에서는 천천히 돌아감
    var spin = (1 - sm(0, 0.6, Ssm)) * Math.sin(now / 2600) * 0.35;
    var yaw = cam.yaw + spin, d = cam.d * fit;
    var eye = [cam.t[0] + Math.sin(yaw) * Math.cos(cam.pitch) * d, cam.t[1] + Math.sin(cam.pitch) * d, cam.t[2] + Math.cos(yaw) * Math.cos(cam.pitch) * d];
    // 화면 왼쪽 글 영역을 피해 모델을 살짝 오른쪽으로 (가로 화면일 때)
    var PM = persp(fov, asp, d * 0.05, d * 8); if (asp > 1.1) PM[8] = -0.28;
    var VP = mul(PM, look(eye, cam.t));
    // 화면 상태 · 커버
    var open = sm(2.55, 2.95, Ssm) * (1 - sm(3.45, 3.85, Ssm));
    var st = 'price';
    if (open > 0.5) st = 'scan';
    else if (Math.abs(Ssm - 2) < 0.5) st = ((now - stateT) / 1700 | 0) % 2 ? 'detail' : 'price';
    else if (Ssm > 4.5) st = 'detail';
    gl.viewport(0, 0, cv.width, cv.height); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.DEPTH_TEST); gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.useProgram(P); gl.uniformMatrix4fv(U.VP, false, VP); gl.uniformMatrix4fv(U.Mo, false, [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
    gl.uniform1f(U.S, M.scale); gl.uniform3fv(U.eye, eye); gl.uniform1f(U.fade, 1);
    var pa = gl.getAttribLocation(P, 'p'), na = gl.getAttribLocation(P, 'n'); gl.enableVertexAttribArray(pa); gl.enableVertexAttribArray(na);
    parts.forEach(function (q) {
      if (q.st && q.st !== st) return;
      gl.uniform3f(U.off, 0, q.cover ? -3 * open : 0, 0);
      gl.bindBuffer(gl.ARRAY_BUFFER, q.p); gl.vertexAttribPointer(pa, 3, gl.SHORT, false, 0, 0);
      gl.bindBuffer(gl.ARRAY_BUFFER, q.n); gl.vertexAttribPointer(na, 3, gl.BYTE, false, 0, 0);
      var qc = q.col, qe = q.emi;
      if (q.name === 'TAG_ScreenGlass' && SIDE[st]) { qc = SIDE[st][0]; qe = SIDE[st][1]; }   // 화면 옆면도 지금 화면 색을 따라감
      gl.uniform3fv(U.col, qc); gl.uniform3fv(U.emi, qe); gl.uniform1f(U.rough, q.rough); gl.uniform1f(U.coat, q.coat);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, q.i); gl.drawElements(gl.TRIANGLES, q.cnt, q.big ? gl.UNSIGNED_INT : gl.UNSIGNED_SHORT, 0);
    });
    drawDims(VP);
  }
  new IntersectionObserver(function (es) { vis = es[0].isIntersecting; }, { rootMargin: '300px' }).observe(root);
  size(); onScroll(); setStep(0); requestAnimationFrame(frame);
  function go() { load().catch(function (e) { console.warn('design tag:', e); }); }
  // 모델 파일은 한 번만 불러옴 (히어로에서 이미 불러오는 중이면 기다림)
  (function wait(n) {
    if (window.TAG_MODEL) return go();
    if (n === 0 && !document.querySelector('script[src*="tag-model.js"]')) { var s = document.createElement('script'); s.src = 'assets/models/tag-model.js'; document.body.appendChild(s); }
    setTimeout(function () { wait(n + 1); }, 150);
  })(0);
})();
