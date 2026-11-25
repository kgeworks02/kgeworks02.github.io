/* =========================================================
   03 핵심 기능 — 오른쪽 3D 태그 (오프라인 · 외부 라이브러리 없음)
   · 화면에 들어오면 태그가 왼쪽에서 한 바퀴 돌며 들어옴
   · 다른 곳을 보다가 다시 돌아오면 처음(들어오기 → 01)부터 다시 재생
   · 그다음 왼쪽 기능 카드가 01 → 02 → 03 순서로 저절로 켜지고,
     켜진 카드 내용대로 태그가 움직임
       01 토글 내리기 : 하단 초록 커버(토글)가 8mm 내려가고, 빨간 빛 + 인식 원 + RECOGNIZING…
       02 빛 · 가격   : 인식하는 동안만 빨갛게 빛남 → 끝나면 예상 가격 표시
       03 토글 닫기   : 토글이 올라가 닫히며 상세 정보(제품명 · 연도 · 가치 점 5개) 표시
   · 카드를 누르면 그 기능으로 바로 이동
   · 모델 : assets/models/tag-feature-model.js (태그 수수정.obj 변환)
   ========================================================= */
(function () {
  'use strict';
  var root = document.getElementById('kf'); if (!root) return;
  var stage = root.querySelector('.kf-stage'), cv = stage.querySelector('canvas');
  var cards = [].slice.call(root.querySelectorAll('.kf-card'));
  var capEl = stage.querySelector('.kf-cap');
  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- 표시할 값 (디스플레이 글자) ---------- */
  var PRICE = '₩150,000', NAME = 'Brass Pocket Watch', YEAR = 'c. 1960s', DOTS = 4;
  var DUR = [4500, 5000, 5000];     // 카드마다 켜져 있는 시간 (ms)
  var OPEN = 8;                     // 토글(커버) 이동 거리 (mm)

  /* ---------- 행렬 ---------- */
  function persp(f, a, n, fa) { var t = 1 / Math.tan(f / 2); return [t / a, 0, 0, 0, 0, t, 0, 0, 0, 0, (fa + n) / (n - fa), -1, 0, 0, 2 * fa * n / (n - fa), 0]; }
  function mul(a, b) { var o = new Array(16); for (var i = 0; i < 4; i++) for (var j = 0; j < 4; j++) { var s = 0; for (var k = 0; k < 4; k++) s += a[k * 4 + j] * b[i * 4 + k]; o[i * 4 + j] = s; } return o; }
  function look(e, c, u) {
    var z = [e[0] - c[0], e[1] - c[1], e[2] - c[2]], l = Math.hypot(z[0], z[1], z[2]); z = z.map(function (v) { return v / l; });
    var x = [u[1] * z[2] - u[2] * z[1], u[2] * z[0] - u[0] * z[2], u[0] * z[1] - u[1] * z[0]]; l = Math.hypot(x[0], x[1], x[2]); x = x.map(function (v) { return v / l; });
    var y = [z[1] * x[2] - z[2] * x[1], z[2] * x[0] - z[0] * x[2], z[0] * x[1] - z[1] * x[0]];
    return [x[0], y[0], z[0], 0, x[1], y[1], z[1], 0, x[2], y[2], z[2], 0, -(x[0] * e[0] + x[1] * e[1] + x[2] * e[2]), -(y[0] * e[0] + y[1] * e[1] + y[2] * e[2]), -(z[0] * e[0] + z[1] * e[1] + z[2] * e[2]), 1];
  }
  function rotX(a) { var c = Math.cos(a), s = Math.sin(a); return [1, 0, 0, 0, 0, c, s, 0, 0, -s, c, 0, 0, 0, 0, 1]; }
  function rotY(a) { var c = Math.cos(a), s = Math.sin(a); return [c, 0, -s, 0, 0, 1, 0, 0, s, 0, c, 0, 0, 0, 0, 1]; }
  function rotZ(a) { var c = Math.cos(a), s = Math.sin(a); return [c, s, 0, 0, -s, c, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]; }
  function tr(x, y, z) { return [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, x, y, z, 1]; }
  var ease = function (t) { t = Math.max(0, Math.min(1, t)); return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };
  var outCubic = function (t) { t = Math.max(0, Math.min(1, t)); return 1 - Math.pow(1 - t, 3); };
  var lerp = function (a, b, t) { return a + (b - a) * t; };

  /* ---------- 셰이더 ---------- */
  var VS = 'attribute vec3 p;attribute vec3 n;uniform mat4 VP,Mo;uniform float S;varying vec3 vn,vw;' +
    'void main(){vec4 w=Mo*vec4(p*S,1.);vw=w.xyz;vn=normalize(mat3(Mo)*(n/127.));gl_Position=VP*w;}';
  var FS = 'precision highp float;varying vec3 vn,vw;uniform vec3 col,eye,glowC;uniform float rough,coat,glow;' +
    'vec3 tone(vec3 c){c=c*.95;c=(c*(2.51*c+.03))/(c*(2.43*c+.59)+.14);return pow(clamp(c,0.,1.),vec3(1./2.2));}' +
    'void main(){vec3 N=normalize(vn);vec3 V=normalize(eye-vw);if(dot(N,V)<0.)N=-N;' +
    ' vec3 L1=normalize(vec3(-.55,.75,.65)),L2=normalize(vec3(.8,.25,.35)),L3=normalize(vec3(.1,.5,-1.));' +
    ' float hemi=.5+.5*N.y;vec3 amb=mix(vec3(.26,.26,.27),vec3(.58,.58,.59),hemi);' +
    ' vec3 c=col*(amb+vec3(1.,.97,.93)*1.2*max(dot(N,L1),0.)+vec3(.55,.58,.62)*.55*max(dot(N,L2),0.)+.45*max(dot(N,L3),0.));' +
    ' float sh=2./(rough*rough*rough+.002);' +
    ' float sp=pow(max(dot(N,normalize(L1+V)),0.),sh)*(1.-rough)*.6+pow(max(dot(N,normalize(L2+V)),0.),sh)*(1.-rough)*.25;' +
    ' float fr=pow(1.-max(dot(N,V),0.),5.);c+=vec3(sp)+fr*.10;' +
    ' if(coat>.5){c+=vec3(pow(max(dot(N,normalize(L1+V)),0.),900.)*2.5+pow(max(dot(N,normalize(L2+V)),0.),600.)*.8)+fr*.35;}' +
    ' float rim=pow(1.-max(dot(N,V),0.),2.);c+=glowC*glow*(.18+1.6*rim);' +   // 빛 반응 : 가장자리가 더 밝게
    ' gl_FragColor=vec4(tone(c),1.);}';
  // 평면 효과 (그림자 · 빛 번짐 · 인식 원 · 디스플레이)
  var QVS = 'attribute vec2 p;uniform mat4 VP,Mo;uniform vec3 C;uniform vec2 R;uniform float flatq;varying vec2 q;' +
    'void main(){q=p;vec3 o=flatq>.5?vec3(C.x+p.x*R.x,C.y,C.z+p.y*R.y):vec3(C.x+p.x*R.x,C.y+p.y*R.y,C.z);gl_Position=VP*Mo*vec4(o,1.);}';
  var QFS = 'precision highp float;varying vec2 q;uniform int mode;uniform vec3 qc;uniform float qa,rr;uniform sampler2D tex;' +
    'void main(){float d=length(q);float a=0.;vec3 c=qc;' +
    ' float edge=1.-smoothstep(.6,1.,d);' +
    ' if(mode==0){a=exp(-d*d*3.2)*edge*qa;gl_FragColor=vec4(0.,0.,0.,a);return;}' +                       // 바닥 그림자
    ' if(mode==1){a=exp(-d*d*2.6)*edge*qa;gl_FragColor=vec4(c*a,a);return;}' +                            // 빛 번짐
    ' if(mode==2){float w=.05;a=smoothstep(rr-w,rr,d)*(1.-smoothstep(rr,rr+w*.6,d))*qa;gl_FragColor=vec4(c*a,a);return;}' + // 인식 원
    ' if(d>1.)discard;vec4 t=texture2D(tex,vec2(q.x*.5+.5,.5-q.y*.5));float e=1.-smoothstep(.985,1.,d);' +
    ' gl_FragColor=vec4(t.rgb*t.a*qa*e,t.a*qa*e);}';                                                // 디스플레이

  /* ---------- 디스플레이 그림 ---------- */
  var dcv = document.createElement('canvas'); dcv.width = dcv.height = 512;
  var dg = dcv.getContext('2d');
  var FONT = '"PretendardLocal","Pretendard",sans-serif';
  function layer(s, a, t) {
    if (!s || s === 'off' || a <= 0) return;
    var g = dg; g.save(); g.globalAlpha = a; g.textAlign = 'center'; g.textBaseline = 'middle';
    if (s === 'scan') {
      var gr = g.createRadialGradient(256, 256, 20, 256, 256, 256); gr.addColorStop(0, '#ff3b2a'); gr.addColorStop(1, '#b80904');
      g.fillStyle = gr; g.fillRect(0, 0, 512, 512);
      g.fillStyle = '#fff3ee'; g.font = '600 44px ' + FONT;
      var word = 'RECOGNIZING', w = g.measureText(word).width, dw = g.measureText('...').width, x0 = 256 - (w + dw) / 2;
      g.textAlign = 'left'; g.fillText(word, x0, 256); g.fillText('.'.repeat(1 + Math.floor(t / 0.35) % 3), x0 + w, 256);
    } else if (s === 'price') {
      g.fillStyle = '#050505'; g.fillRect(0, 0, 512, 512);
      g.fillStyle = '#ffbf86'; g.font = '600 82px ' + FONT; g.fillText(PRICE, 256, 256, 440);
    } else if (s === 'detail') {
      g.fillStyle = '#fff6ea'; g.fillRect(0, 0, 512, 512);
      g.fillStyle = '#2a1a10'; g.font = '600 44px ' + FONT; g.fillText(NAME, 256, 186, 420);
      g.font = '500 34px ' + FONT; g.fillStyle = '#4a3526'; g.fillText(YEAR, 256, 252, 380);
      for (var i = 0; i < 5; i++) { g.beginPath(); g.arc(256 + (i - 2) * 46, 330, 14, 0, 7); g.fillStyle = i < DOTS ? '#2a1a10' : '#c9bcaf'; g.fill(); }
    }
    g.restore();
  }
  var view = { from: 'off', to: 'off', t: 1, dur: 0.5 };
  function fadeTo(s, dur) { if (view.to === s) return; view.from = view.t >= 1 ? view.to : (view.t < 0.5 ? view.from : view.to); view.to = s; view.t = 0; view.dur = dur || 0.5; }

  /* ---------- 상태 ---------- */
  var gl = null, M = null, P, Q, u = {}, qu = {}, parts = [], quad, texD, ext, started = false, running = false;
  var SC = { x: 0, y: 11.5, z: 2.96, r: 18.5 };   // 디스플레이 중심 (모델 기준 mm)
  var act = -1, actT = 0, timer = null, introT = -1, inView = false, lastT = 0, clock = 0;
  var FROM = -600;                  // 들어오는 쪽 (− : 왼쪽, 실제 값은 화면 왼쪽 끝으로 계산)
  var cur = { x: FROM, yaw: 0, lift: 0, cover: 0, glow: 0, glowR: 1, glowG: .16, glowB: .1, ring: 0, tilt: 0 };
  var yawBase = 0.38, yawTarget = 0.38;

  function prog(v, f) {
    var p = gl.createProgram();
    [[gl.VERTEX_SHADER, v], [gl.FRAGMENT_SHADER, f]].forEach(function (x) {
      var h = gl.createShader(x[0]); gl.shaderSource(h, x[1]); gl.compileShader(h);
      if (!gl.getShaderParameter(h, gl.COMPILE_STATUS)) throw gl.getShaderInfoLog(h); gl.attachShader(p, h);
    });
    gl.linkProgram(p); if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw gl.getProgramInfoLog(p); return p;
  }
  var MAT = {
    body: { col: [0.75, 0.73, 0.69], rough: 0.45, coat: 1 },
    cap: { col: [0.049, 0.069, 0.064], rough: 0.6, coat: 1 },
    screen: { col: [0.004, 0.004, 0.005], rough: 0.08, coat: 1 },
    strap: { col: [0.20, 0.21, 0.21], rough: 0.55, coat: 0 }
  };

  async function load() {
    var D = window.TAG_FEATURE_MODEL; if (!D || !('DecompressionStream' in window)) throw 'unsupported';
    var raw = Uint8Array.from(atob(D.gz), function (c) { return c.charCodeAt(0); });
    var buf = await new Response(new Blob([raw]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
    gl = cv.getContext('webgl', { antialias: true, alpha: true, premultipliedAlpha: true }); if (!gl) throw 'nogl';
    ext = gl.getExtension('OES_element_index_uint');
    P = prog(VS, FS); Q = prog(QVS, QFS);
    ['VP', 'Mo', 'S', 'col', 'eye', 'rough', 'coat', 'glow', 'glowC'].forEach(function (k) { u[k] = gl.getUniformLocation(P, k); });
    ['VP', 'Mo', 'C', 'R', 'flatq', 'mode', 'qc', 'qa', 'rr', 'tex'].forEach(function (k) { qu[k] = gl.getUniformLocation(Q, k); });
    var mk = function (t, a) { var b = gl.createBuffer(); gl.bindBuffer(t, b); gl.bufferData(t, a, gl.STATIC_DRAW); return b; };
    D.parts.forEach(function (q) {
      if (q.big && !ext) return;
      parts.push({
        name: q.name, m: MAT[q.mat] || MAT.body,
        p: mk(gl.ARRAY_BUFFER, new Int16Array(buf, q.pos[0], q.pos[1] / 2)), n: mk(gl.ARRAY_BUFFER, new Int8Array(buf, q.nrm[0], q.nrm[1])),
        i: mk(gl.ELEMENT_ARRAY_BUFFER, q.big ? new Uint32Array(buf, q.idx[0], q.idx[1] / 4) : new Uint16Array(buf, q.idx[0], q.idx[1] / 2)),
        cnt: q.big ? q.idx[1] / 4 : q.idx[1] / 2, big: q.big
      });
      if (q.name === 'screen') { SC.x = (q.bmin[0] + q.bmax[0]) / 2; SC.y = (q.bmin[1] + q.bmax[1]) / 2; SC.z = q.bmax[2] + 0.03; SC.r = (q.bmax[0] - q.bmin[0]) / 2; }
    });
    quad = mk(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]));
    texD = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, texD);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    M = D;
  }

  /* ---------- 기능마다 태그가 하는 일 ---------- */
  // t : 카드가 켜지고 지난 시간(초) → 목표 모습
  function pose(i, t) {
    var o = { yaw: 0.38, lift: 0, cover: 0, glow: 0, gc: [1, .16, .1], ring: 0, tilt: 0, disp: 'off' };
    if (i === 0) {                       // 01 토글을 내림 → 빨간 빛 + 인식 요청
      o.yaw = 0.42;
      o.cover = OPEN * ease((t - 0.4) / 0.6);
      if (t > 1.0) { o.ring = 1; o.disp = 'scan'; o.glow = 0.75 + 0.2 * Math.sin(t * 5); }
    } else if (i === 1) {                // 02 인식하는 동안만 빨간 빛 → 끝나면 예상 가격 (토글은 내려간 채)
      o.yaw = 0.12; o.cover = OPEN;
      if (t < 1.6) { o.disp = 'scan'; o.ring = 1; o.glow = 0.85 + 0.2 * Math.sin(t * 5); }
      else { o.disp = 'price'; o.glow = 0; }
    } else if (i === 2) {                // 03 토글을 닫음 → 상세 정보
      o.yaw = -0.3; o.disp = 'price'; o.cover = OPEN * (1 - ease((t - 0.6) / 0.6));
      if (t > 1.2) { o.disp = 'detail'; }
    }
    return o;
  }

  function setActive(i, fromUser) {
    act = i; actT = 0;
    if (i === 0) view.from = view.to = 'off', view.t = 1;
    cards.forEach(function (c, k) {
      var on = k === i; c.classList.toggle('on', on); c.setAttribute('aria-pressed', on);
      if (on) { c.style.setProperty('--kf-dur', DUR[k] + 'ms'); var b = c.querySelector('.kf-bar i'); b.style.animation = 'none'; void b.offsetWidth; b.style.animation = ''; }
    });
    capEl.classList.add('swap');
    setTimeout(function () { capEl.querySelector('b').textContent = 'FEATURE 0' + (i + 1); capEl.querySelector('em').textContent = cards[i].dataset.cap; capEl.classList.remove('swap'); }, 220);
    if (stage.classList.contains('no3d')) stage.style.backgroundImage = "url('assets/images/product-feature-0" + (i + 1) + ".webp')";
    schedule();
  }
  function schedule() {
    clearTimeout(timer); if (!inView || act < 0) return;
    var left = DUR[act] - actT * 1000;
    timer = setTimeout(function () { setActive((act + 1) % cards.length); }, Math.max(200, left));
  }
  cards.forEach(function (c, k) {
    c.addEventListener('click', function (e) { if (introT >= 0 && introT < 1.4 && !reduce) return; setActive(k, true); });
    c.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setActive(k, true); } });
  });

  /* ---------- 캔버스 배치 : 화면 왼쪽 끝부터 무대 오른쪽까지, 위아래로도 넉넉히 ---------- */
  var LAY = { cx: 0, cy: 0, sh: 1, key: '' };
  function layout() {
    var r = stage.getBoundingClientRect(), padT = Math.round(r.height * 0.22), padB = Math.round(r.height * 0.12);
    var key = Math.round(r.left) + ',' + Math.round(r.width) + ',' + Math.round(r.height);
    if (key === LAY.key) return; LAY.key = key;
    var L = Math.max(0, Math.round(r.left));
    cv.style.left = (-L) + 'px'; cv.style.top = (-padT) + 'px';
    cv.style.width = (L + Math.round(r.width)) + 'px'; cv.style.height = (Math.round(r.height) + padT + padB) + 'px';
    LAY.cx = L + r.width / 2; LAY.cy = padT + r.height / 2; LAY.sh = r.height;
  }

  /* ---------- 그리기 ---------- */
  function frame(t) {
    if (!running) return;
    var dt = Math.min(0.05, (t - (lastT || t)) / 1000); lastT = t; clock += dt;
    // 들어오기 : 오른쪽에서 한 바퀴 돌며
    var IN = 1.9;
    if (introT >= 0 && introT < IN) {
      introT += dt; var e = outCubic(introT / IN);
      cur.x = FROM * (1 - e); cur.yaw = yawBase - (reduce ? 0 : Math.PI * 2) * (1 - e);
      if (introT >= IN) { cur.yaw = yawBase; if (act < 0) setActive(0); }
    } else if (act >= 0) {
      actT += dt;
      var o = pose(act, actT), k = 1 - Math.pow(0.02, dt), k2 = 1 - Math.pow(0.0005, dt);
      cur.x += (0 - cur.x) * k;
      cur.yaw += (o.yaw + 0.05 * Math.sin(clock * 0.5) - cur.yaw) * k * 0.6;
      cur.lift += (o.lift - cur.lift) * k; cur.tilt += (o.tilt - cur.tilt) * k;
      cur.cover += (o.cover - cur.cover) * k2;
      cur.glow += (o.glow - cur.glow) * k2;
      cur.glowR += (o.gc[0] - cur.glowR) * k; cur.glowG += (o.gc[1] - cur.glowG) * k; cur.glowB += (o.gc[2] - cur.glowB) * k;
      cur.ring += (o.ring - cur.ring) * k;
      fadeTo(o.disp, o.disp === 'detail' ? 0.6 : 0.5);
    }
    view.t = Math.min(1, view.t + dt / view.dur);

    // 디스플레이 그림
    var ve = ease(view.t);
    dg.clearRect(0, 0, 512, 512); layer(view.from, 1 - ve, actT); layer(view.to, ve, actT);
    var dispA = (view.from !== 'off' ? 1 - ve : 0) + (view.to !== 'off' ? ve : 0);

    layout();
    var dpr = Math.min(2, devicePixelRatio || 1), w = cv.clientWidth, h = cv.clientHeight;
    if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
    gl.viewport(0, 0, cv.width, cv.height);
    gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    // 카메라 : 캔버스는 화면 왼쪽 끝 ~ 무대 오른쪽까지 (배경 없음). 태그(끈 포함)는 무대 가운데에 다 보이게
    var D = 650, HW = 205, CY = 34;                       // 카메라 거리 · 무대 높이에 담을 세계 높이(mm) · 그 중심
    var wpp = HW / Math.max(1, LAY.sh);                    // 1px 당 mm
    var fov = 2 * Math.atan((h * wpp / 2) / D), asp = w / h;
    var dx = (LAY.cx - w / 2) / (w / 2), dy = (h / 2 - LAY.cy) / (h / 2);
    var eye = [0, CY + D * 0.06, D];
    var VP = mul(tr(dx, dy, 0), mul(persp(fov, asp, D * 0.2, D * 4), look(eye, [0, CY, 0], [0, 1, 0])));
    FROM = -(LAY.cx * wpp + 60);                           // 화면 왼쪽 끝 바깥
    var bob = reduce ? 0 : Math.sin(clock * 1.3) * 1.2;
    var Mo = mul(tr(cur.x, cur.lift + bob, 0), mul(rotY(cur.yaw), mul(rotZ(cur.tilt), rotX(-0.04))));
    var Mc = mul(Mo, tr(0, -cur.cover, 0));
    var FLOOR = -80;

    gl.enable(gl.BLEND);
    var pa = gl.getAttribLocation(Q, 'p');
    function quadDraw(mode, Mm, C, R, flat, col, a, rr) {
      gl.useProgram(Q);
      gl.uniformMatrix4fv(qu.VP, false, VP); gl.uniformMatrix4fv(qu.Mo, false, Mm);
      gl.uniform3fv(qu.C, C); gl.uniform2fv(qu.R, R); gl.uniform1f(qu.flatq, flat ? 1 : 0);
      gl.uniform1i(qu.mode, mode); gl.uniform3fv(qu.qc, col || [0, 0, 0]); gl.uniform1f(qu.qa, a); gl.uniform1f(qu.rr, rr || 0);
      gl.bindBuffer(gl.ARRAY_BUFFER, quad); gl.enableVertexAttribArray(pa); gl.vertexAttribPointer(pa, 2, gl.FLOAT, false, 0, 0);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4); gl.disableVertexAttribArray(pa);
    }
    // 1) 바닥 그림자 (들어 올리면 옅고 넓어짐)
    gl.disable(gl.DEPTH_TEST); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    var lf = Math.max(0, cur.lift) / 16;
    quadDraw(0, tr(cur.x, 0, 0), [0, FLOOR, 0], [46 + 14 * lf, 14 + 5 * lf], true, null, 0.30 - 0.12 * lf);

    // 2) 태그
    gl.enable(gl.DEPTH_TEST); gl.blendFunc(gl.ONE, gl.ZERO);
    gl.useProgram(P);
    gl.uniformMatrix4fv(u.VP, false, VP); gl.uniform1f(u.S, M.scale); gl.uniform3fv(u.eye, eye);
    gl.uniform3fv(u.glowC, [cur.glowR, cur.glowG, cur.glowB]);
    var ap = gl.getAttribLocation(P, 'p'), an = gl.getAttribLocation(P, 'n');
    gl.enableVertexAttribArray(ap); gl.enableVertexAttribArray(an);
    parts.forEach(function (q) {
      gl.uniformMatrix4fv(u.Mo, false, q.name === 'cover' ? Mc : Mo);
      gl.uniform3fv(u.col, q.m.col); gl.uniform1f(u.rough, q.m.rough); gl.uniform1f(u.coat, q.m.coat);
      gl.uniform1f(u.glow, (q.name === 'strap' || q.name === 'screen') ? 0 : cur.glow * (q.name === 'cover' ? 0.15 : 1));
      gl.bindBuffer(gl.ARRAY_BUFFER, q.p); gl.vertexAttribPointer(ap, 3, gl.SHORT, false, 0, 0);
      gl.bindBuffer(gl.ARRAY_BUFFER, q.n); gl.vertexAttribPointer(an, 3, gl.BYTE, false, 0, 0);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, q.i); gl.drawElements(gl.TRIANGLES, q.cnt, q.big ? gl.UNSIGNED_INT : gl.UNSIGNED_SHORT, 0);
    });
    gl.disableVertexAttribArray(ap); gl.disableVertexAttribArray(an);

    // 3) 디스플레이 화면
    if (dispA > 0.001) {
      gl.bindTexture(gl.TEXTURE_2D, texD); gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, dcv);
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA); gl.depthMask(false);
      gl.useProgram(Q); gl.uniform1i(qu.tex, 0);
      gl.enable(gl.CULL_FACE); gl.cullFace(gl.BACK);   // 뒤에서 볼 때는 화면 글자가 비치지 않게
      quadDraw(3, Mo, [SC.x, SC.y, SC.z], [SC.r, SC.r], false, null, 1);
      gl.disable(gl.CULL_FACE);
      gl.depthMask(true);
    }

    // 4) 빛 번짐 : 태그 뒤에서 퍼져 나와 가장자리로 새어 나옴 + 인식 원
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA); gl.depthMask(false);
    if (cur.glow > 0.01) {
      var gc = [cur.glowR, cur.glowG, cur.glowB];
      quadDraw(1, Mo, [SC.x, 0, -6], [62, 84], false, gc, 0.30 * Math.min(1.4, cur.glow));
      quadDraw(1, Mo, [SC.x, SC.y, SC.z + 0.5], [SC.r * 1.7, SC.r * 1.7], false, gc, 0.16 * Math.min(1.4, cur.glow));
    }
    if (cur.ring > 0.01) {
      for (var r = 0; r < 3; r++) {
        var ph = ((clock * 0.55 + r / 3) % 1);
        quadDraw(2, tr(cur.x, cur.lift + bob, 0), [0, 0, -2], [64, 64], false, [.88, .2, .14], cur.ring * 0.5 * (1 - ph), 0.78 + ph * 0.22);   // 좁게 퍼지는 인식 원
      }
    }
    gl.depthMask(true);
    requestAnimationFrame(frame);
  }

  /* ---------- 시작 · 멈춤 ---------- */
  function run() { if (running || !M) return; running = true; lastT = 0; requestAnimationFrame(frame); }
  function begin() {
    if (introT < 0) { introT = 0; if (reduce) introT = 1.85; }
    run(); schedule();
  }
  function fail(err) { if (err) console.warn('feature 3D:', err); stage.classList.remove('loading'); stage.classList.add('no3d'); if (act < 0 && inView) setActive(0); else if (act >= 0) setActive(act); }
  function start() {
    if (started) return; started = true; stage.classList.add('loading');
    var go = function () { load().then(function () { stage.classList.remove('loading'); stage.classList.add('ready'); if (inView) begin(); }).catch(fail); };
    if (window.TAG_FEATURE_MODEL) return go();
    var s = document.createElement('script'); s.src = stage.dataset.model; s.onload = go; s.onerror = function () { fail('model file'); }; document.body.appendChild(s);
  }
  function resetAll() {
    clearTimeout(timer); act = -1; actT = 0; introT = -1;
    cur.x = FROM; cur.yaw = yawBase; cur.lift = 0; cur.cover = 0; cur.glow = 0; cur.ring = 0; cur.tilt = 0;
    view.from = view.to = 'off'; view.t = 1;
    cards.forEach(function (c) { c.classList.remove('on'); c.setAttribute('aria-pressed', 'false'); });
    capEl.querySelector('b').textContent = 'FEATURE 01'; capEl.querySelector('em').textContent = cards[0].dataset.cap;
  }
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (es) {   // 완전히 화면 밖으로 나가면 → 돌아왔을 때 처음부터
      if (!es[0].isIntersecting && (act >= 0 || introT >= 0)) resetAll();
    }, { threshold: 0 }).observe(root);
    new IntersectionObserver(function (es) { if (es.some(function (e) { return e.isIntersecting; })) start(); }, { rootMargin: '900px' }).observe(stage);
    new IntersectionObserver(function (es) {
      inView = es[0].isIntersecting;
      root.classList.toggle('paused', !inView);
      if (inView) { if (M) begin(); else if (stage.classList.contains('no3d') && act < 0) setActive(0); else schedule(); }
      else { clearTimeout(timer); running = false; }
    }, { threshold: 0.35 }).observe(stage);
  } else { inView = true; start(); }
})();
