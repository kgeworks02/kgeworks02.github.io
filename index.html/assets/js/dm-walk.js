/* =========================================================
   동묘 벼룩시장 3D 워크 — 외부 라이브러리 없이 WebGL로 직접 그림 (오프라인 동작)
   · 처음엔 하늘에서 내려다보는 지도 → "시장 안으로 걸어 들어가기"를 누르면 거리로 내려앉음
   · WASD 이동 / Shift 달리기 / 마우스 드래그로 둘러보기 / E(한글 자판 ㄷ) 상호작용
   · N 길 안내(초록 파라솔까지 바닥 화살표) / 바로 이동 / Esc 그만 보기
   좌표: x = 거리 가로(+는 진행 방향 왼쪽), z = 거리 진행 방향, y = 위   (1 = 1m)
   ========================================================= */
(function () {
  'use strict';
  var wrap = document.querySelector('#map .map-wrap'); if (!wrap) return;
  var stage = wrap.querySelector('.wk-stage'), cv = document.getElementById('mapCanvas');
  var gl = cv.getContext('webgl', { antialias: true, preserveDrawingBuffer: true, alpha: false });
  if (!gl) { wrap.classList.add('wk-nogl'); return; }
  var PR = (typeof PRODUCTS !== 'undefined') ? PRODUCTS : [];
  var DURL = (typeof detailURL === 'function') ? detailURL : function () { return null; };
  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var coarse = matchMedia('(hover: none), (pointer: coarse)').matches;
  var $ = function (s) { return stage.querySelector(s); };

  /* ---------- 기본 도구 ---------- */
  var seed = 11; function rnd() { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }
  function pick(a) { return a[Math.floor(rnd() * a.length)]; }
  function hex(h) { var n = parseInt(h.slice(1), 16); return [(n >> 16) / 255, (n >> 8 & 255) / 255, (n & 255) / 255]; }
  function jit(c, k) { if (typeof c === 'string') c = hex(c); var f = 1 + (rnd() - 0.5) * k; return [c[0] * f, c[1] * f, c[2] * f]; }
  function lit(c, k) { if (typeof c === 'string') c = hex(c); return [c[0] + (1 - c[0]) * k, c[1] + (1 - c[1]) * k, c[2] + (1 - c[2]) * k]; }
  function dim(c, k) { if (typeof c === 'string') c = hex(c); return [c[0] * k, c[1] * k, c[2] * k]; }
  var clamp = function (v, a, b) { return v < a ? a : v > b ? b : v; };
  var smooth = function (t) { t = clamp(t, 0, 1); return t * t * t * (t * (t * 6 - 15) + 10); };

  /* ---------- 색 (사이트 톤) ---------- */
  var C = {
    ground: '#E6DDCF', street: '#DCD2C3', seam: '#CFC3B2', walk: '#EAE3D8', road: '#C6C0B7', lane: '#F4F0E8',
    park: '#D3DBBE', wall: '#E6DDCF', stone: '#CBC0B0', tile: '#6F6A66', wood: '#9A6E5C', plaster: '#F2EBE0',
    glass: '#8F9AA2', dark: '#4C4239', trunk: '#8F7B67', leaf: ['#AEBB8F', '#9DAE80', '#B8C49B', '#A3B386'], pole: '#B8B0A5',
    build: ['#EFE7DC', '#E8DED0', '#E2D6C6', '#ECE3D7', '#DDD1C1', '#E6DCCF', '#D9CCBB', '#F2ECE3'],
    sign: [['#E8CB8E', '#3D2E21'], ['#D9A6A1', '#3D2E21'], ['#A9BAD2', '#3D2E21'], ['#C5D2A6', '#3D2E21'], ['#E3B690', '#3D2E21'],
           ['#CFAFC9', '#3D2E21'], ['#3D2E21', '#F7F1E8'], ['#F4EFE6', '#3D2E21'], ['#667DAD', '#FFFFFF']],
    umb: [['#D9A6A1', '#E8CF92'], ['#A9C08F', '#9FB4D1'], ['#E8CF92', '#C9B9A6'], ['#9FB4D1', '#D9A6A1'], ['#CFAFC9', '#E8CF92'],
          ['#E3B690', '#F2ECE2'], ['#B8C7D9', '#F2ECE2']],
    goods: ['#B9A28C', '#9FB0BF', '#C7B79B', '#A4A9A0', '#D2B7A0', '#8F9C8A', '#C9A7A0', '#E1D6C2', '#6F7F8F', '#A0705F', '#5E6B57', '#3D3A36'],
    blank: ['#CBBFAE', '#B8A995', '#9FA7AE', '#C6B39A', '#A9B39A'],
    cloth: ['#8C8178', '#6F7F8F', '#A0705F', '#5E6B57', '#B8A48C', '#4F4A45', '#C9B79C', '#7B6A8C', '#D9A6A1', '#A9BAD2', '#E8CB8E'],
    pants: ['#4B4540', '#3F4A57', '#6B5E52', '#2F2E2C', '#8A7F72'],
    skin: ['#E3C4A8', '#D9B595', '#EBCDB3'], hair: ['#2B2420', '#3A2E26', '#5A4A3E', '#9A9089'],
    accent: '#A2BA75', accentD: '#8FA862'
  };

  /* ---------- 간판 글씨 (캔버스 한 장에 모아서 텍스처로) ---------- */
  var AT = document.createElement('canvas'); AT.width = AT.height = 1024;
  var ag = AT.getContext('2d'), cells = [], CW = 332, CH = 72;
  function signUV(text, bg, fg, sub) {
    var i = cells.length, x = 4 + (i % 3) * 340, y = 16 + Math.floor(i / 3) * 76;
    cells.push({ text: text, bg: bg, fg: fg, sub: sub, x: x, y: y });
    return [(x + 2) / 1024, (y + 2) / 1024, (x + CW - 2) / 1024, (y + CH - 2) / 1024];
  }
  function drawAtlas() {
    var fam = "'PretendardLocal','Pretendard','Apple SD Gothic Neo','Malgun Gothic',sans-serif";
    ag.clearRect(0, 0, 1024, 1024); ag.fillStyle = '#fff'; ag.fillRect(0, 0, 12, 12);
    cells.forEach(function (c) {
      ag.fillStyle = c.bg; ag.fillRect(c.x, c.y, CW, CH);
      ag.fillStyle = c.fg; ag.textAlign = 'center'; ag.textBaseline = 'middle';
      var fs = c.sub ? 34 : 40; ag.font = '700 ' + fs + 'px ' + fam;
      var w = ag.measureText(c.text).width, max = CW - 36;
      if (w > max) { fs = Math.floor(fs * max / w); ag.font = '700 ' + fs + 'px ' + fam; }
      ag.fillText(c.text, c.x + CW / 2, c.y + (c.sub ? CH * 0.4 : CH / 2 + 2));
      if (c.sub) { ag.font = '500 15px ' + fam; ag.globalAlpha = 0.8; ag.fillText(c.sub, c.x + CW / 2, c.y + CH * 0.78); ag.globalAlpha = 1; }
    });
  }

  /* ---------- 메시 만들기 ---------- */
  var W0 = 4 / 1024;
  function Mesh() { this.d = []; }
  Mesh.prototype.v = function (p, n, c, m, u) { this.d.push(p[0], p[1], p[2], n[0], n[1], n[2], c[0], c[1], c[2], m || 0, u ? u[0] : W0, u ? u[1] : W0); };
  Mesh.prototype.tri = function (a, b, c, col, m, ua, ub, uc) {
    if (typeof col === 'string') col = hex(col);
    var ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    var nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx, l = Math.hypot(nx, ny, nz) || 1, n = [nx / l, ny / l, nz / l];
    this.v(a, n, col, m, ua); this.v(b, n, col, m, ub); this.v(c, n, col, m, uc);
  };
  // uv = [u0,v0,u1,v1] → a=(u0,v1) b=(u1,v1) c=(u1,v0) d=(u0,v0)
  Mesh.prototype.quad = function (a, b, c, d, col, m, uv) {
    if (uv) { var A = [uv[0], uv[3]], B = [uv[2], uv[3]], Cc = [uv[2], uv[1]], D = [uv[0], uv[1]]; this.tri(a, b, c, col, m, A, B, Cc); this.tri(a, c, d, col, m, A, Cc, D); }
    else { this.tri(a, b, c, col, m); this.tri(a, c, d, col, m); }
  };
  Mesh.prototype.flat = function (x0, z0, x1, z1, y, col) { this.quad([x0, y, z0], [x1, y, z0], [x1, y, z1], [x0, y, z1], col); };
  Mesh.prototype.box = function (x0, y0, z0, x1, y1, z1, col, top, m) {
    if (typeof col === 'string') col = hex(col);
    var t = top ? (typeof top === 'string' ? hex(top) : top) : col;
    this.quad([x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1], t, m);
    this.quad([x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0], col, m);
    this.quad([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], col, m);
    this.quad([x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], col, m);
    this.quad([x1, y0, z0], [x1, y0, z1], [x1, y1, z1], [x1, y1, z0], col, m);
  };
  Mesh.prototype.cyl = function (cx, cz, y0, y1, r, seg, col, m, r1) {
    if (r1 === undefined) r1 = r;
    for (var i = 0; i < seg; i++) {
      var a0 = i / seg * Math.PI * 2, a1 = (i + 1) / seg * Math.PI * 2;
      var p0 = [cx + Math.cos(a0) * r, y0, cz + Math.sin(a0) * r], p1 = [cx + Math.cos(a1) * r, y0, cz + Math.sin(a1) * r],
          q0 = [cx + Math.cos(a0) * r1, y1, cz + Math.sin(a0) * r1], q1 = [cx + Math.cos(a1) * r1, y1, cz + Math.sin(a1) * r1];
      this.quad(p0, p1, q1, q0, col, m); if (r1 > 0) this.tri(q0, q1, [cx, y1, cz], col, m);
    }
  };
  Mesh.prototype.sph = function (cx, cy, cz, rx, ry, rz, col, m, sl, st) {
    if (typeof col === 'string') col = hex(col);
    sl = sl || 8; st = st || 6; var self = this;
    var P = function (i, j) {
      var th = i / sl * Math.PI * 2, ph = j / st * Math.PI;
      var n = [Math.cos(th) * Math.sin(ph), Math.cos(ph), Math.sin(th) * Math.sin(ph)];
      return [[cx + n[0] * rx, cy + n[1] * ry, cz + n[2] * rz], n];
    };
    for (var i = 0; i < sl; i++) for (var j = 0; j < st; j++) {
      var a = P(i, j), b = P(i + 1, j), c = P(i + 1, j + 1), d = P(i, j + 1);
      self.v(a[0], a[1], col, m); self.v(b[0], b[1], col, m); self.v(c[0], c[1], col, m);
      self.v(a[0], a[1], col, m); self.v(c[0], c[1], col, m); self.v(d[0], d[1], col, m);
    }
  };
  // 간판 판 (중심 c, 오른쪽 방향 r, 폭 w, 높이 h)
  function signQuad(M, c, r, w, h, uv, col) {
    var a = [c[0] - r[0] * w / 2, c[1] - h / 2, c[2] - r[2] * w / 2], b = [c[0] + r[0] * w / 2, c[1] - h / 2, c[2] + r[2] * w / 2];
    M.quad(a, b, [b[0], b[1] + h, b[2]], [a[0], a[1] + h, a[2]], col || [1, 1, 1], 0, uv);
  }

  /* =========================================================
     장면
     ========================================================= */
  var L = 160, HW = 3.6;
  var M = new Mesh(), OBS = [], ACT = [];
  // side: +1 = 진행 방향 왼쪽(담장 쪽), -1 = 오른쪽(가게 쪽), 0 = 거리 한가운데 / z = 입구에서 거리(m)
  //  1 스마트 AI 스크린 거울 → 담장 앞 '옷 무더기' 좌판 옆 / 2 TALKTIDE → 가게 앞 / 3 DONGMYO MARKET 2031 → 시장 정중앙 / 4 디스커버리 태그 → 가게 앞
  var PDEF = [{ side: 1, z: 31 }, { side: -1, z: 50 }, { side: 0, z: L / 2 }, { side: 1, z: 132 }];
  var HEAP = [22.6, 28.4];   // 옷 무더기 좌판 자리 (담장 쪽)
  var nearProd = function (side, z0, z1) { return PDEF.some(function (p) { return p.side === side && z1 > p.z - 2.8 && z0 < p.z + 2.8; }); };
  var ob = function (x0, z0, x1, z1) { OBS.push([Math.min(x0, x1), Math.min(z0, z1), Math.max(x0, x1), Math.max(z0, z1)]); };

  var SHOPS = [
    ['빈티지 의류', '70~80년대 데님 재킷과 니트가 빽빽하게 걸려 있어요. “골라 봐요, 한 장에 만 원!”'],
    ['LP · 카세트', '먼지 쌓인 LP 상자 사이로 옛 가요 앨범이 보여요. 사장님이 턴테이블로 한 곡 틀어 줘요.'],
    ['중고 카메라', '필름 카메라와 렌즈가 유리장 안에 줄지어 있어요. 셔터 소리를 들어 보라며 건네줘요.'],
    ['시계 수리', '돋보기를 낀 사장님이 태엽 시계를 고치고 있어요. 째깍째깍 소리가 가게를 채워요.'],
    ['골동품', '놋그릇, 자개 상자, 오래된 열쇠 꾸러미가 천장까지 쌓여 있어요.'],
    ['전자 · 가전', '브라운관 TV와 라디오가 켜진 채 진열돼 있어요. 아직 다 잘 나온대요.'],
    ['구제 신발', '한 켤레씩 닦아 놓은 가죽 구두와 운동화가 벽을 가득 채웠어요.'],
    ['모자 · 가방', '중절모부터 캠프캡까지, 가죽 가방이 줄줄이 걸려 있어요.'],
    ['군복 · 작업복', '두꺼운 야상과 작업복이 산처럼 쌓여 있어요. 사이즈는 직접 찾아야 해요.'],
    ['공구 백화점', '녹슨 공구 사이에서 쓸 만한 걸 고르는 재미가 있어요.'],
    ['안경 · 선글라스', '동그란 뿔테와 금테 안경이 진열대 위에서 반짝여요.'],
    ['오디오 전문', '진공관 앰프에서 따뜻한 소리가 흘러나와요.'],
    ['은수저 · 놋그릇', '반짝이게 닦은 은수저 세트가 상자째 놓여 있어요.'],
    ['만물상', '없는 게 없다는 가게예요. 오늘은 어떤 걸 발견하게 될까요?'],
    ['동묘 다방', '쌍화차 냄새가 나요. 시장 사람들이 잠깐 쉬어 가는 곳이에요.'],
    ['도자기', '이 빠진 찻잔부터 큼직한 항아리까지 한자리에 모여 있어요.'],
    ['라디오 수리', '작업대 위에 뜯어 놓은 라디오가 가득해요. “고치면 다 살아나요.”'],
    ['구제 청바지', '허리 사이즈별로 접어 둔 청바지가 탑처럼 쌓였어요.'],
    ['장난감 · 피규어', '어릴 적 보던 로봇과 인형이 유리장 안에서 손님을 기다려요.'],
    ['헌책방', '빛바랜 잡지와 소설이 천장까지 꽂혀 있어요. 책 냄새가 좋아요.'],
    ['한복 · 원단', '화려한 비단과 원단이 둘둘 말려 세워져 있어요.'],
    ['시장 분식', '떡볶이와 어묵 국물 냄새에 발걸음이 멈춰요.']
  ];
  var STALLS = [
    ['골동품 좌판', '놋그릇과 손때 묻은 라디오가 돗자리 위에 펼쳐져 있어요.'],
    ['구제 옷 좌판', '바닥에 쌓인 옷더미를 사람들이 뒤적이고 있어요. “천 원, 이천 원!”'],
    ['책 · 잡지 좌판', '80년대 잡지와 만화책이 끈으로 묶여 있어요.'],
    ['공구 좌판', '쓸 만한 공구를 고르는 아저씨들 사이로 흥정 소리가 들려요.'],
    ['잡화 좌판', '열쇠고리, 배지, 오래된 우표가 상자마다 가득해요.'],
    ['전자 부품 좌판', '리모컨, 충전기, 정체를 알 수 없는 부품이 수북해요.'],
    ['레코드 좌판', '종이 상자 안에 LP가 빼곡해요. 한 장씩 넘겨 보는 손이 바빠요.']
  ];
  SHOPS.forEach(function (s, i) { var c = C.sign[i % C.sign.length]; s.push(signUV(s[0], c[0], c[1])); s.push(c[0]); });
  var PSIGN = PDEF.map(function (p, i) { return signUV('PRODUCT 0' + (i + 1), C.accent, '#FFFFFF'); });
  var PBAN = PDEF.map(function (p, i) { var d = PR[i] || {}; return signUV('PRODUCT 0' + (i + 1) + ' · ' + (d.name || ''), C.accent, '#FFFFFF'); });
  var HEAP_SIGN = signUV('골라 골라 · 한 장 천 원', '#C9A47C', '#3D2E21');
  var SCREEN_T = signUV('DONGMYO MARKET 2031', '#22302B', '#BFD39A', '실시간 거래 활동 · LIVE');
  var GATE_IN = signUV('동묘 벼룩시장', '#3D2E21', '#F7F1E8', 'DONGMYO FLEA MARKET · 2030');
  var GATE_BACK = signUV('동묘앞역 · 종로 방면', '#3D2E21', '#F7F1E8', 'JONGNO · DONGMYO STN.');
  var GATE_END = signUV('숭인동 · 동대문 방면', '#3D2E21', '#F7F1E8', 'SUNGIN-DONG');
  var GATE_END_BACK = signUV('동묘 벼룩시장', '#3D2E21', '#F7F1E8', 'DONGMYO FLEA MARKET · 2030');
  drawAtlas();

  /* ---------- 바닥 ---------- */
  M.flat(-160, -90, 160, L + 90, 0, C.ground);
  M.flat(-HW, -8, HW, L + 8, 0.02, C.street);
  for (var zs = -6; zs < L + 6; zs += 2.4) M.flat(-HW, zs, HW, zs + 0.05, 0.03, C.seam);
  M.flat(-4.4, -8, -HW, L + 8, 0.025, C.walk); M.flat(HW, -8, 4.4, L + 8, 0.025, C.walk);
  // 양 끝 큰길 (종로 / 숭인동)
  [[-22, -8], [L + 8, L + 22]].forEach(function (r) {
    M.flat(-160, r[0], 160, r[1], 0.02, C.road);
    for (var x = -150; x < 150; x += 6) M.flat(x, (r[0] + r[1]) / 2 - 0.08, x + 3, (r[0] + r[1]) / 2 + 0.08, 0.035, C.lane);
    var zc = r[0] < 0 ? r[1] - 3.2 : r[0] + 0.6;   // 횡단보도
    for (var k = 0; k < 9; k++) M.flat(-HW + k * 0.82, zc, -HW + k * 0.82 + 0.45, zc + 2.6, 0.035, C.lane);
  });

  /* ---------- 가게 건물 ---------- */
  var si = 0;
  function shop(side, z0, z1, front) {
    var xf = side * 4.4, depth = 6 + rnd() * 3, xb = side * (4.4 + depth), col = jit(pick(C.build), 0.05);
    var r = rnd(), floors = r < 0.25 ? 1 : r < 0.6 ? 2 : r < 0.88 ? 3 : 4, fh = 3.1, H = floors * fh + 0.35;
    var xa = Math.min(xf, xb), xc = Math.max(xf, xb), fx = xf - side * 0.03, R = [0, 0, side];
    M.box(xa, 0, z0, xc, H, z1, col, lit(col, 0.35));
    M.box(xa - 0.1, H, z0 - 0.05, xc + 0.1, H + 0.18, z1 + 0.05, dim(col, 0.9));          // 옥상 테두리
    if (!front) {   // 거리에서 먼 건물: 창문만
      for (var f0 = 0; f0 < floors; f0++) win(fx, side, z0, z1, f0 * fh + 0.9, f0 * fh + 2.2);
      return;
    }
    var S = SHOPS[si++ % SHOPS.length];
    // 1층: 안쪽이 들여다보이는 어두운 매장 + 셔터 박스
    M.quad([fx, 0.02, z0 + 0.35], [fx, 0.02, z1 - 0.35], [fx, 2.45, z1 - 0.35], [fx, 2.45, z0 + 0.35], jit(C.dark, 0.08));
    for (var k = 0; k < 4; k++) {   // 매장 안 선반 실루엣
      var yy = 0.5 + k * 0.48, fs = fx - side * 0.015; M.quad([fs, yy, z0 + 0.5], [fs, yy, z1 - 0.5], [fs, yy + 0.05, z1 - 0.5], [fs, yy + 0.05, z0 + 0.5], '#6A5D50');
    }
    // 간판 띠
    var bw = z1 - z0 - 0.4, sx = xf - side * 0.14;
    M.box(Math.min(xf, sx), 2.55, z0 + 0.2, Math.max(xf, sx), 3.2, z1 - 0.2, hex(S[3]));
    var tw = Math.min(bw - 0.2, 0.62 * 4.6);
    signQuad(M, [sx - side * 0.02, 2.875, (z0 + z1) / 2], R, tw, 0.6, S[2]);
    // 차양 (줄무늬)
    var ac = pick(C.umb), n = Math.max(3, Math.round((z1 - z0) / 0.7));
    for (var a = 0; a < n; a++) {
      var za = z0 + 0.25 + (z1 - z0 - 0.5) * a / n, zb = z0 + 0.25 + (z1 - z0 - 0.5) * (a + 1) / n;
      M.quad([xf - side * 0.02, 2.5, za], [xf - side * 0.02, 2.5, zb], [xf - side * 1.25, 2.12, zb], [xf - side * 1.25, 2.12, za], a % 2 ? ac[0] : ac[1]);
    }
    for (var f = 1; f < floors; f++) win(fx, side, z0, z1, f * fh + 0.85, f * fh + 2.25);
    // 가게 앞 물건
    var zc = (z0 + z1) / 2, x0 = side * 4.3, x1 = side * 2.95;
    if (z0 > 0.5 && z1 < L - 0.5 && !nearProd(side, z0, z1)) {
      var t = rnd();
      if (t < 0.32) rack(side, z0 + 0.5, Math.min(z1 - 0.5, z0 + 2.6));
      else if (t < 0.6) table(side, z0 + 0.6, Math.min(z1 - 0.6, z0 + 2.4));
      else if (t < 0.82) crates(side, z0 + 0.5, z1 - 0.5);
      else blanket(Math.min(x0, x1), z0 + 0.4, Math.max(x0, x1), z1 - 0.4, 9);
      ob(x0, z0 + 0.3, x1, z1 - 0.3);
      ACT.push({ kind: 's', x: side * 3.5, z: zc, r: 2.5, name: S[0], text: S[1] });
    }
  }
  function win(fx, side, z0, z1, y0, y1) {
    var n = Math.max(1, Math.floor((z1 - z0) / 1.7)), w = (z1 - z0) / n;
    for (var i = 0; i < n; i++) {
      var a = z0 + i * w + w * 0.2, b = z0 + (i + 1) * w - w * 0.2;
      M.quad([fx, y0, a], [fx, y0, b], [fx, y1, b], [fx, y1, a], jit(C.glass, 0.12));
      var fq = fx - side * 0.015; M.quad([fq, y0 - 0.08, a - 0.06], [fq, y0 - 0.08, b + 0.06], [fq, y0, b + 0.06], [fq, y0, a - 0.06], '#CFC5B7');
    }
  }
  function shopRow(side, za, zb, front) {
    var z = za;
    while (z < zb - 2) { var w = 4 + Math.floor(rnd() * 3.99); if (z + w > zb) w = zb - z; shop(side, z, z + w, front); z += w; }
  }

  /* ---------- 노점 소품 ---------- */
  function parasol(x, z, r, hz, cA, cB, m) {
    var N = 12, apex = [x, hz + r * 0.42, z], A = hex(cA), B = hex(cB);
    for (var i = 0; i < N; i++) {
      var a0 = i / N * Math.PI * 2, a1 = (i + 1) / N * Math.PI * 2;
      var p0 = [x + Math.cos(a0) * r, hz, z + Math.sin(a0) * r], p1 = [x + Math.cos(a1) * r, hz, z + Math.sin(a1) * r];
      M.tri(p0, p1, apex, i % 2 ? A : B, m);
      M.quad(p0, p1, [p1[0], hz - 0.13, p1[2]], [p0[0], hz - 0.13, p0[2]], i % 2 ? A : B, m);
    }
    M.cyl(x, z, 0, hz + r * 0.42 + 0.08, 0.035, 6, '#8E857A');
    M.box(x - 0.22, 0, z - 0.22, x + 0.22, 0.1, z + 0.22, '#6E665E');
  }
  function blanket(x0, z0, x1, z1, n) {
    M.flat(x0, z0, x1, z1, 0.045, jit(pick(C.blank), 0.06));
    for (var i = 0; i < n; i++) {
      var w = 0.16 + rnd() * Math.min(0.36, (x1 - x0) * 0.4), d = 0.16 + rnd() * 0.34, h = 0.05 + rnd() * 0.3;
      var x = x0 + 0.05 + rnd() * Math.max(0.01, x1 - x0 - w - 0.1), z = z0 + 0.05 + rnd() * Math.max(0.01, z1 - z0 - d - 0.1);
      M.box(x, 0.045, z, x + w, 0.045 + h, z + d, jit(pick(C.goods), 0.1));
    }
  }
  function rack(side, z0, z1) {
    var x = side * 3.6, c = '#8E857A';
    M.cyl(x, z0, 0, 1.55, 0.025, 5, c); M.cyl(x, z1, 0, 1.55, 0.025, 5, c);
    M.box(x - 0.02, 1.5, z0, x + 0.02, 1.55, z1, c);
    for (var z = z0 + 0.08; z < z1 - 0.06; z += 0.11) {
      var h = 0.6 + rnd() * 0.35; M.box(x - 0.24, 1.48 - h, z, x + 0.24, 1.48, z + 0.06, jit(pick(C.cloth), 0.12));
    }
  }
  function table(side, z0, z1) {
    var xa = side * 4.2, xb = side * 3.1, x0 = Math.min(xa, xb), x1 = Math.max(xa, xb), c = '#A08A74';
    [[x0 + 0.05, z0 + 0.05], [x1 - 0.05, z0 + 0.05], [x0 + 0.05, z1 - 0.05], [x1 - 0.05, z1 - 0.05]].forEach(function (p) { M.box(p[0] - 0.03, 0, p[1] - 0.03, p[0] + 0.03, 0.74, p[1] + 0.03, c); });
    M.box(x0, 0.74, z0, x1, 0.79, z1, '#C3AE95');
    for (var i = 0; i < 9; i++) {
      var w = 0.12 + rnd() * 0.25, d = 0.12 + rnd() * 0.25, h = 0.05 + rnd() * 0.28, x = x0 + 0.05 + rnd() * (x1 - x0 - w - 0.1), z = z0 + 0.05 + rnd() * (z1 - z0 - d - 0.1);
      M.box(x, 0.79, z, x + w, 0.79 + h, z + d, jit(pick(C.goods), 0.1));
    }
  }
  function crates(side, z0, z1) {
    for (var z = z0; z < z1 - 0.5; z += 0.6) {
      var stack = 1 + Math.floor(rnd() * 3);
      for (var s = 0; s < stack; s++) {
        var xa = side * (4.25 - rnd() * 0.1), xb = side * 3.6, y = s * 0.36;
        M.box(Math.min(xa, xb), y, z, Math.max(xa, xb), y + 0.34, z + 0.52, jit(s % 2 ? '#B9A28C' : '#9C8670', 0.08));
        M.box(Math.min(xa, xb) + 0.04, y + 0.34, z + 0.05, Math.max(xa, xb) - 0.04, y + 0.36, z + 0.47, jit(pick(C.goods), 0.1));
      }
    }
  }
  function tree(x, z, s) {
    M.cyl(x, z, 0, 2.6 * s, 0.13 * s, 6, C.trunk, 0, 0.09 * s);
    M.sph(x, 3.3 * s, z, 1.5 * s, 1.15 * s, 1.5 * s, jit(pick(C.leaf), 0.06), 0, 7, 5);
    M.sph(x + 0.7 * s, 2.9 * s, z - 0.4 * s, 1.0 * s, 0.85 * s, 1.0 * s, jit(pick(C.leaf), 0.08), 0, 7, 5);
    M.sph(x - 0.6 * s, 3.0 * s, z + 0.5 * s, 1.0 * s, 0.8 * s, 1.0 * s, jit(pick(C.leaf), 0.08), 0, 7, 5);
  }
  function hipRoof(x0, z0, x1, z1, y, h, over, col) {
    x0 -= over; z0 -= over; x1 += over; z1 += over;
    var cx = (x0 + x1) / 2, ins = (x1 - x0) / 2 * 0.95, r1 = [cx, y + h, z0 + ins], r2 = [cx, y + h, z1 - ins];
    M.quad([x0, y, z0], [x0, y, z1], r2, r1, col); M.quad([x1, y, z0], [x1, y, z1], r2, r1, col);
    M.tri([x0, y, z0], [x1, y, z0], r1, col); M.tri([x0, y, z1], [x1, y, z1], r2, col);
  }
  function hanok(x0, z0, x1, z1, h, rh) {
    M.box(x0 - 0.5, 0, z0 - 0.5, x1 + 0.5, 0.55, z1 + 0.5, '#D3C9BB');
    M.box(x0, 0.55, z0, x1, 0.55 + h, z1, C.plaster);
    for (var z = z0; z <= z1 + 0.01; z += (z1 - z0) / 4) { M.cyl(x0, z, 0.55, 0.55 + h, 0.14, 6, C.wood); M.cyl(x1, z, 0.55, 0.55 + h, 0.14, 6, C.wood); }
    M.box(x0 - 0.05, 0.55 + h - 0.35, z0 - 0.05, x1 + 0.05, 0.55 + h, z1 + 0.05, '#5E7466');   // 단청 띠
    hipRoof(x0, z0, x1, z1, 0.55 + h, rh, 1.3, C.tile);
  }

  /* ---------- 거리 양쪽 ---------- */
  // 진행 방향 오른쪽(-x): 가게 줄 / 왼쪽(+x): 동관왕묘 돌담 + 담장 앞 좌판, 양 끝은 가게
  shopRow(-1, -8, L + 8, true);
  shopRow(1, -8, 8, true); shopRow(1, 118, L + 8, true);
  // 돌담 (기와 덮개)
  var WX = 4.75;
  M.box(WX - 0.3, 0, 8, WX + 0.3, 2.15, 118, C.wall);
  M.box(WX - 0.33, 0, 8, WX + 0.33, 0.85, 118, C.stone);
  for (var zw = 8; zw < 118; zw += 0.9) M.flat(WX - 0.335, zw, WX - 0.33, zw + 0.03, 0.4, C.stone);
  M.quad([WX - 0.62, 2.12, 8], [WX - 0.62, 2.12, 118], [WX, 2.62, 118], [WX, 2.62, 8], C.tile);
  M.quad([WX + 0.62, 2.12, 8], [WX + 0.62, 2.12, 118], [WX, 2.62, 118], [WX, 2.62, 8], C.tile);
  M.box(WX - 0.08, 2.58, 8, WX + 0.08, 2.72, 118, '#5C5854');
  ob(4.4, 8, 5.2, 118);
  // 담장 안 경내
  M.flat(5.1, 8, 60, 118, 0.02, C.park);
  for (var zt = 11; zt < 117; zt += 5.5 + rnd() * 3) tree(6.6 + rnd() * 1.2, zt, 0.85 + rnd() * 0.35);
  for (var k2 = 0; k2 < 26; k2++) tree(12 + rnd() * 40, 12 + rnd() * 100, 0.9 + rnd() * 0.5);
  hanok(13, 40, 21, 54, 2.6, 3.0); hanok(11, 72, 16, 80, 2.0, 2.2); hanok(18, 72, 23, 80, 2.0, 2.2); hanok(12, 98, 18, 108, 2.2, 2.4);
  // 담장 앞 좌판 (동묘 벼룩시장의 상징 — 담벼락 따라 펼쳐진 돗자리)
  for (var zz = 9.5; zz < 116; zz += 4.3) {
    if (nearProd(1, zz, zz + 3.2) || (zz + 3.2 > HEAP[0] - 0.4 && zz < HEAP[1] + 0.4)) continue;
    var S2 = STALLS[Math.floor(rnd() * STALLS.length)];
    blanket(3.0, zz, 4.35, zz + 3.0, 10);
    if (rnd() > 0.15) { var u2 = pick(C.umb); parasol(3.4, zz + 1.5, 1.1, 2.35, u2[0], u2[1]); }
    if (rnd() > 0.5) crates(1, zz + 2.4, zz + 3.0);
    ob(2.9, zz, 4.4, zz + 3.0);
    ACT.push({ kind: 's', x: 3.4, z: zz + 1.5, r: 2.4, name: S2[0], text: S2[1] });
  }
  // 거리 뒤편 건물 (가게 뒤·양 끝 큰길 너머)
  for (var xr = -150; xr < 150;) {
    var w2 = 7 + rnd() * 9, f2 = 2 + Math.floor(rnd() * 5), c2 = jit(pick(C.build), 0.05);
    if (Math.abs(xr + w2 / 2) > 1) {
      M.box(xr, 0, -40, xr + w2 - 0.6, f2 * 3.1, -24, c2, lit(c2, 0.3));
      M.box(xr, 0, L + 24, xr + w2 - 0.6, f2 * 3.1, L + 40, c2, lit(c2, 0.3));
    }
    xr += w2;
  }
  for (var tq = 0; tq < 18; tq++) {   // 멀리 보이는 높은 건물 (깊이감)
    var tx = (rnd() > 0.5 ? 1 : -1) * (40 + rnd() * 90), tz = -60 + rnd() * (L + 120), th = 18 + rnd() * 30, tw2 = 10 + rnd() * 14;
    var tc = jit('#E9E3DA', 0.04); M.box(tx, 0, tz, tx + tw2, th, tz + tw2, tc, lit(tc, 0.3));
  }
  // 양 끝 대문 간판
  function gate(z, uvFront, uvBack) {
    [-1, 1].forEach(function (s) { M.box(s * 4.0 - 0.18, 0, z - 0.18, s * 4.0 + 0.18, 5.4, z + 0.18, '#3D2E21'); ob(s * 4.0 - 0.3, z - 0.3, s * 4.0 + 0.3, z + 0.3); });
    M.box(-4.3, 5.4, z - 0.2, 4.3, 5.7, z + 0.2, '#3D2E21');
    M.box(-2.9, 4.1, z - 0.08, 2.9, 5.4, z + 0.08, '#3D2E21');
    signQuad(M, [0, 4.74, z - 0.1], [-1, 0, 0], 5.6, 1.2, uvFront);
    signQuad(M, [0, 4.74, z + 0.1], [1, 0, 0], 5.6, 1.2, uvBack);
  }
  gate(1.2, GATE_IN, GATE_BACK); gate(L - 1.2, GATE_END_BACK, GATE_END);
  // 전신주 + 전선, 줄전구
  for (var zp = 14; zp < L - 6; zp += 26) {
    M.cyl(-3.95, zp, 0, 8.2, 0.13, 7, C.pole, 0, 0.1); M.box(-4.6, 7.4, zp - 0.06, -3.3, 7.52, zp + 0.06, C.pole);
    ob(-4.15, zp - 0.2, -3.75, zp + 0.2);
  }
  for (var zl = 7; zl < L - 4; zl += 12) {
    var xa2 = 4.55, ya = 4.4, xb2 = -4.4, yb = 5.0, N2 = 16;
    if (zl > 8 && zl < 118) { M.cyl(4.25, zl, 0, 4.6, 0.04, 5, '#6E665E'); }
    for (var b = 0; b <= N2; b++) {
      var t2 = b / N2, x2 = xa2 + (xb2 - xa2) * t2, y2 = ya + (yb - ya) * t2 - Math.sin(Math.PI * t2) * 0.7;
      if (b < N2) {
        var t3 = (b + 1) / N2, x3 = xa2 + (xb2 - xa2) * t3, y3 = ya + (yb - ya) * t3 - Math.sin(Math.PI * t3) * 0.7;
        M.quad([x2, y2, zl], [x3, y3, zl], [x3, y3 - 0.02, zl], [x2, y2 - 0.02, zl], '#4C4239');
      }
      if (b % 2 === 1) M.sph(x2, y2 - 0.12, zl, 0.07, 0.09, 0.07, [1.35, 1.22, 0.95], 0, 6, 4);
    }
  }

  /* ---------- 제품 파라솔 (초록) ---------- */
  // 옷 무더기 좌판 (바닥에 옷을 산처럼 쌓아 두고 파는 곳)
  (function () {
    var z0 = HEAP[0], z1 = HEAP[1];
    M.flat(2.9, z0, 4.4, z1, 0.045, '#B8A995');
    for (var k = 0; k < 4; k++) {
      var hz = z0 + 0.8 + k * 1.45, hx = 3.55 + (rnd() - 0.5) * 0.3, hr = 0.55 + rnd() * 0.15;
      for (var j = 0; j < 22; j++) {   // 옷을 한 장씩 겹겹이 (납작하고 기울어진 천 조각)
        var a = rnd() * Math.PI * 2, lv = j / 22, d = rnd() * hr * 0.62 * (1 - lv * 0.8), cx = hx + Math.cos(a) * d, cz = hz + Math.sin(a) * d, y = 0.06 + lv * 0.62;
        var w = 0.42 - lv * 0.14, dp = 0.3 - lv * 0.08, th = rnd() * Math.PI, ct = Math.cos(th), st = Math.sin(th), c = jit(pick(C.cloth.concat(['#E8DCC8', '#C9D3DF', '#E7B9A8', '#9FB48A'])), 0.14);
        var tl = (rnd() - 0.5) * 0.18, P0 = [cx - ct * w / 2 + st * dp / 2, y + tl, cz - st * w / 2 - ct * dp / 2], P1 = [cx + ct * w / 2 + st * dp / 2, y - tl, cz + st * w / 2 - ct * dp / 2],
            P2 = [cx + ct * w / 2 - st * dp / 2, y - tl + 0.05, cz + st * w / 2 + ct * dp / 2], P3 = [cx - ct * w / 2 - st * dp / 2, y + tl + 0.05, cz - st * w / 2 + ct * dp / 2];
        M.quad(P0, P1, P2, P3, c); M.quad(P0, P1, [P1[0], P1[1] - 0.07, P1[2]], [P0[0], P0[1] - 0.07, P0[2]], dim(c, 0.85)); M.quad(P2, P3, [P3[0], P3[1] - 0.07, P3[2]], [P2[0], P2[1] - 0.07, P2[2]], dim(c, 0.85));
        if (j < 6) M.sph(hx + (rnd() - 0.5) * 0.3, 0.1 + j * 0.06, hz + (rnd() - 0.5) * 0.3, 0.5 - j * 0.05, 0.24, 0.42 - j * 0.04, dim(c, 0.95), 0, 8, 5);   // 아래쪽 볼록한 더미
      }
    }
    M.box(2.98, 0, z1 - 0.65, 3.02, 0.95, z1 - 0.61, '#8E857A');
    M.box(2.97, 0.62, z1 - 1.05, 3.03, 0.98, z1 - 0.21, '#C9A47C');
    signQuad(M, [2.96, 0.8, z1 - 0.63], [0, 0, 1], 0.8, 0.17, HEAP_SIGN);
    var u = pick(C.umb); parasol(3.9, (z0 + z1) / 2, 1.5, 2.4, u[0], u[1]);
    ob(2.9, z0, 4.4, z1);
    ACT.push({ kind: 's', x: 3.4, z: (z0 + z1) / 2, r: 2.6, name: '구제 옷 무더기', text: '바닥에 산처럼 쌓인 옷더미를 다들 뒤적이고 있어요. “골라 골라, 한 장에 천 원!” 바로 옆 초록 파라솔에서는 고른 옷을 거울로 입어 볼 수 있어요.' });
  })();

  /* ---------- 제품 자리 (초록) ---------- */
  // 제품 자리를 멀리서도 찾기 쉽게: 바닥 초록 원판 + 거리 위를 가로지르는 현수막 + (걷기 중) 은은한 빛기둥
  function standee(s, z, i) {   // "PRODUCT 0n" 안내판 (거리 쪽을 바라봄)
    var bx = s * 2.6, bz = z + 1.55;
    M.box(bx - 0.03, 0, bz - 0.03, bx + 0.03, 1.4, bz + 0.03, '#3D2E21');
    M.box(bx - 0.03, 1.32, bz - 0.7, bx + 0.03, 1.66, bz + 0.7, C.accent);
    signQuad(M, [bx - s * 0.04, 1.49, bz], [0, 0, s], 1.3, 0.28, PSIGN[i]);
    ob(bx - 0.12, bz - 0.12, bx + 0.12, bz + 0.12);
  }
  function pad(x, z, r) {   // 바닥 초록 원판 (테두리 진하게)
    M.cyl(x, z, 0.028, 0.05, r + 0.16, 40, C.accentD, 0, r + 0.16);
    M.cyl(x, z, 0.05, 0.056, r, 40, '#CFE3A6', 0, r);
  }
  function banner(z, i) {   // 거리 위를 가로지르는 초록 현수막 (앞뒤 모두 읽힘)
    var y = 5.35, w = 4.6, h = 1.0;
    M.box(-4.4, y + h / 2 + 0.05, z - 0.015, 4.4, y + h / 2 + 0.08, z + 0.015, '#5C5349');   // 매다는 줄
    [-1, 1].forEach(function (k) { M.box(k * w / 2 - 0.02, y + h / 2, z - 0.02, k * w / 2 + 0.02, y + h / 2 + 0.06, z + 0.02, '#5C5349'); });
    M.box(-w / 2 - 0.06, y - h / 2 - 0.06, z - 0.03, w / 2 + 0.06, y + h / 2 + 0.06, z + 0.03, C.accentD);
    signQuad(M, [0, y, z - 0.035], [-1, 0, 0], w, h, PBAN[i]);
    signQuad(M, [0, y, z + 0.035], [1, 0, 0], w, h, PBAN[i]);
  }
  function stallTable(s, z) {
    var x0 = s * 4.25, x1 = s * 2.75;
    M.box(Math.min(x0, x1), 0, z - 1.2, Math.max(x0, x1), 0.78, z + 1.2, '#F4EFE6', '#FFFFFF');
    M.box(Math.min(x0, x1) - 0.02, 0.7, z - 1.22, Math.max(x0, x1) + 0.02, 0.78, z + 1.22, C.accent);
    ob(x0, z - 1.25, x1, z + 1.25);
  }
  // YZ 평면(거리 쪽을 바라보는 면)에 놓인 원·고리 — 거울판, 팔찌
  function ringYZ(cx, cy, cz, r0, r1, x0, x1, a0, a1, seg, colFn) {
    for (var k = 0; k < seg; k++) {
      var t0 = a0 + (a1 - a0) * k / seg, t1 = a0 + (a1 - a0) * (k + 1) / seg, col = colFn(k, seg);
      var o0 = [Math.cos(t0), Math.sin(t0)], o1 = [Math.cos(t1), Math.sin(t1)];
      var P = function (x, r, o) { return [x, cy + o[1] * r, cz + o[0] * r]; };
      M.quad(P(x0, r1, o0), P(x0, r1, o1), P(x1, r1, o1), P(x1, r1, o0), col);   // 바깥
      M.quad(P(x0, r0, o0), P(x0, r0, o1), P(x1, r0, o1), P(x1, r0, o0), dim(col, 0.88));   // 안쪽
      M.quad(P(x0, r0, o0), P(x0, r0, o1), P(x0, r1, o1), P(x0, r1, o0), col);   // 앞뒤 면
      M.quad(P(x1, r0, o0), P(x1, r0, o1), P(x1, r1, o1), P(x1, r1, o0), col);
    }
  }
  function discYZ(x, cy, cz, r, seg, col) { var c = hex(col); for (var k = 0; k < seg; k++) { var t0 = k / seg * Math.PI * 2, t1 = (k + 1) / seg * Math.PI * 2; M.tri([x, cy, cz], [x, cy + Math.sin(t0) * r, cz + Math.cos(t0) * r], [x, cy + Math.sin(t1) * r, cz + Math.cos(t1) * r], c); } }
  function bandYZ(x, y0, z0, y1, z1, col) { M.quad([x, y0, z0], [x, y0, z1], [x, y1, z1], [x, y1, z0], col); }

  // 1 · 스마트 AI 스크린 거울 : 샴페인 골드 받침·기둥 + 둥근 스모키 거울 (홀로그램 착장 화면)
  function mirrorProduct(s, z) {
    var cx = s * 3.55, GOLD = '#CDB88F', GOLD_D = '#A99470', cy = 1.92, R = 0.56, pz = z + 0.66;
    M.cyl(cx, pz, 0, 0.05, 0.3, 24, GOLD, 0, 0.28);                       // 둥근 받침
    M.cyl(cx, pz, 0.05, cy + 0.02, 0.028, 10, GOLD);                     // 기둥
    M.box(cx - 0.025, cy - 0.025, z + R - 0.02, cx + 0.025, cy + 0.025, pz + 0.02, GOLD);   // 기둥 → 거울 연결
    var xf = cx - s * 0.03, xb = cx + s * 0.03;
    ringYZ(cx, cy, z, R - 0.035, R, Math.min(xf, xb) - 0.005, Math.max(xf, xb) + 0.005, 0, Math.PI * 2, 40, function () { return hex(GOLD); });
    discYZ(xf - s * 0.001, cy, z, R - 0.03, 40, '#2D3236'); discYZ(xb, cy, z, R - 0.03, 40, GOLD_D);
    var xs = xf - s * 0.006, HC = '#9CC6EA';   // 홀로그램 착장 (사람 실루엣 + 옷 아이콘)
    M.box(xs - 0.004, cy + 0.17, z - 0.045, xs + 0.004, cy + 0.27, z + 0.045, HC);
    bandYZ(xs, cy - 0.28, z - 0.11, cy + 0.15, z + 0.11, HC);
    bandYZ(xs - s * 0.002, cy - 0.25, z - 0.085, cy + 0.12, z + 0.085, '#3F6F96');
    bandYZ(xs - s * 0.003, cy - 0.27, z - 0.06, cy - 0.44, z - 0.02, HC); bandYZ(xs - s * 0.003, cy - 0.27, z + 0.02, cy - 0.44, z + 0.06, HC);
    [[-0.32, 0.1], [-0.32, -0.08], [-0.32, -0.26]].forEach(function (q) { bandYZ(xs, cy + q[1] - 0.06, z + q[0] - 0.05 * s, cy + q[1] + 0.06, z + q[0] + 0.05 * s, '#6E9CC4'); });
    bandYZ(xs, cy + R - 0.13, z - 0.07, cy + R - 0.1, z + 0.07, '#D9D4CC');   // 위쪽 센서 바
    ob(cx - 0.35, z - 0.6, cx + 0.35, pz + 0.35);
  }
  // 2 · TALKTIDE : 크림색 C자 팔찌 + 로즈핑크 패널 (진열용 큰 모형 + 테이블 위 실물)
  function braceletProduct(s, z) {
    stallTable(s, z);
    var cx = s * 3.45, CREAM = '#EFE8DC', PINK = '#D59E9C', yb = 0.78;
    var R1 = 0.3, R0 = 0.235, gap = 0.95;   // 진열 모형 (아래가 트인 C자)
    var a0 = -Math.PI / 2 + gap / 2, a1 = Math.PI * 1.5 - gap / 2;
    ringYZ(cx, yb + R1 * 0.82, z, R0, R1, cx - 0.09, cx + 0.09, a0, a1, 30, function (k, n) { var t = (k + 0.5) / n; return hex(Math.abs(t - 0.5) < 0.09 ? PINK : CREAM); });
    M.box(cx - 0.02, yb, z - 0.3, cx + 0.02, yb + 0.03, z + 0.3, '#E3DACB');
    // 테이블 위 작은 팔찌들
    for (var b = 0; b < 4; b++) {
      var zb = z - 0.95 + b * 0.32 + (b > 1 ? 0.95 : 0), xb = s * (3.3 + (b % 2) * 0.35);
      M.cyl(xb, zb, yb, yb + 0.035, 0.075, 14, CREAM, 0, 0.075); M.cyl(xb, zb, yb + 0.035, yb + 0.037, 0.05, 14, '#F4EFE6', 0, 0.05);
      M.box(xb - 0.02, yb + 0.035, zb - 0.07, xb + 0.02, yb + 0.04, zb - 0.03, PINK);
    }
  }
  // 3 · DONGMYO MARKET 2031 : 나무 받침 + 크림색 받침대 + 크림 프레임 디스플레이 + 위쪽 나무 손잡이 (양면 화면)
  function screenProduct(z, i) {
    var CREAM = '#EFE7D9', WOOD = '#B88B5F';
    M.box(-1.15, 0, z - 0.62, 1.15, 0.16, z + 0.62, WOOD, lit(hex(WOOD), 0.15));
    M.cyl(0, z, 0.16, 0.5, 0.5, 20, CREAM, 0, 0.36); M.cyl(0, z, 0.5, 1.45, 0.36, 20, CREAM, 0, 0.27);
    M.box(-1.32, 1.42, z - 0.2, 1.32, 4.05, z + 0.2, CREAM, lit(hex(CREAM), 0.2));
    [-1, 1].forEach(function (k) { M.box(k * 1.32 - 0.06, 3.85, z - 0.16, k * 1.32 + 0.06, 3.97, z + 0.16, CREAM); M.cyl(k * 1.38, z, 2.66, 2.74, 0.05, 8, '#9A9893'); });
    [-0.85, 0.85].forEach(function (x) { M.box(x - 0.05, 4.05, z - 0.05, x + 0.05, 4.22, z + 0.05, CREAM); });
    M.box(-1.45, 4.22, z - 0.07, 1.45, 4.33, z + 0.07, WOOD);
    [-1, 1].forEach(function (d) {
      var zf = z + d * 0.205, R = [d, 0, 0];
      M.quad([-1.16, 1.6, zf], [1.16, 1.6, zf], [1.16, 3.88, zf], [-1.16, 3.88, zf], '#1E2422');
      signQuad(M, [0, 3.58, zf + d * 0.005], R, 1.75, 0.38, SCREEN_T);
      for (var k = 0; k < 9; k++) {   // 거래 활동 막대그래프
        var h = 0.25 + ((k * 37 + i * 11) % 9) / 9 * 0.95, x = (-0.98 + k * 0.245) * d;
        M.quad([x - 0.075 * d, 1.8, zf + d * 0.006], [x + 0.075 * d, 1.8, zf + d * 0.006], [x + 0.075 * d, 1.8 + h, zf + d * 0.006], [x - 0.075 * d, 1.8 + h, zf + d * 0.006], k % 3 ? '#A2BA75' : '#E8CB8E');
      }
      signQuad(M, [0, 0.98, z + d * 0.37], R, 1.0, 0.22, PSIGN[i]);
    });
  }
  // 3 · 흥정 소리 센서 : 크림 갓 + 크림 돔 + 회색 패브릭 몸체 (가게 앞 벽에 부착)
  function sensorPod(s, z) {
    var x = s * 4.36, y = 2.55, d = -s;   // d : 거리 쪽 방향
    M.box(Math.min(x, x + d * 0.05), y - 0.2, z - 0.1, Math.max(x, x + d * 0.05), y + 0.24, z + 0.1, '#EFE7D9');
    M.box(Math.min(x + d * 0.05, x + d * 0.2), y - 0.2, z - 0.09, Math.max(x + d * 0.05, x + d * 0.2), y + 0.02, z + 0.09, '#B5B2AC');
    M.sph(x + d * 0.13, y + 0.06, z, 0.075, 0.08, 0.075, '#F2ECE2', 0, 10, 6);
    M.box(Math.min(x, x + d * 0.24), y + 0.2, z - 0.12, Math.max(x, x + d * 0.24), y + 0.26, z + 0.12, '#EFE7D9');
  }
  // 4 · AI 빈티지 디스커버리 태그 : 흰 알약형 몸체 + 원형 화면 + 초록 커버 (물건마다 매달림, 큰 진열 모형)
  // YZ 평면의 볼록 다각형(pts=[[y,z],...])을 x0~x1 두께로 세움
  function slabYZ(pts, x0, x1, col) {
    var c = hex(col), n = pts.length, cy = 0, cz = 0;
    pts.forEach(function (q) { cy += q[0] / n; cz += q[1] / n; });
    for (var k = 0; k < n; k++) {
      var p = pts[k], q = pts[(k + 1) % n];
      M.tri([x0, cy, cz], [x0, p[0], p[1]], [x0, q[0], q[1]], c); M.tri([x1, cy, cz], [x1, q[0], q[1]], [x1, p[0], p[1]], c);
      M.quad([x0, p[0], p[1]], [x0, q[0], q[1]], [x1, q[0], q[1]], [x1, p[0], p[1]], dim(c, 0.93));
    }
  }
  function tagMini(x, y, z, s, k, red) {   // 물건 앞에 매달린 알약형 태그 (거리 쪽을 바라봄)
    var w = 0.03 * k, h = 0.128 * k, t = 0.006 * k + 0.003, hr = h / 2 - w, split = y - hr * 0.45, xa = x - t, xb = x + t, ff = x - s * (t + 0.0015);
    var top = [], bot = [], N = 14;
    for (var i = 0; i <= N; i++) { var a = Math.PI * i / N; top.push([y + hr + Math.sin(a) * w, z + Math.cos(a) * w]); }
    top.push([split, z - w]); top.push([split, z + w]);
    for (var j = 0; j <= N; j++) { var b2 = Math.PI + Math.PI * j / N; bot.push([y - hr + Math.sin(b2) * w, z + Math.cos(b2) * w]); }
    bot.push([split, z + w]); bot.push([split, z - w]);
    slabYZ(top, xa, xb, '#F1EEE8'); slabYZ(bot, xa - 0.0008, xb + 0.0008, '#7E8C86');
    M.box(x - 0.006, y + hr + w * 0.55, z - 0.006, x + 0.006, y + hr + w + 0.05 * k, z + 0.006, '#C9CCC9');   // 스트랩
    discYZ(ff, y + hr * 0.15, z, w * 0.6, 22, red ? '#F08070' : '#2A2C2E');                                     // 원형 화면
    for (var g = 0; g < 3; g++) { var gy = split - w * 0.35 - g * w * 0.2; M.quad([ff, gy, z - w * 0.32], [ff, gy, z + w * 0.32], [ff, gy + w * 0.07, z + w * 0.32], [ff, gy + w * 0.07, z - w * 0.32], '#6C7973'); }
  }
  function tagProduct(s, z) {
    stallTable(s, z);
    var cx = s * 3.5, yb = 0.78;
    var items = [['#3A3633', '#C9C6C0'], ['#B08A55', '#B08A55'], ['#3A3633', '#C9C6C0'], ['#8E6E50', '#B39B7E']];
    for (var q = 0; q < 4; q++) {   // 카메라·놋그릇 같은 빈티지 물건 + 태그
      var zq = z - 0.95 + q * 0.62, it = items[q];
      if (q % 2 === 0) { M.box(cx - 0.09, yb, zq - 0.14, cx + 0.09, yb + 0.13, zq + 0.14, it[0]); M.box(cx - 0.09, yb + 0.13, zq - 0.14, cx + 0.09, yb + 0.17, zq + 0.14, it[1]); M.cyl(cx - s * 0.1, zq, yb + 0.04, yb + 0.1, 0.05, 10, '#1F1D1B'); }
      else { M.cyl(cx, zq, yb, yb + 0.2, 0.1, 12, it[0], 0, 0.07); M.cyl(cx, zq, yb + 0.2, yb + 0.25, 0.07, 12, it[1], 0, 0.09); }
      tagMini(cx - s * 0.22, yb + 0.12, zq, s, 1.2, q === 1);
    }
    // 큰 진열 모형 (테이블 끝에 세움)
    var mx = s * 3.95, mz = z + 0.95, my = yb + 0.62;
    M.box(mx - 0.025, yb, mz - 0.025, mx + 0.025, my - 0.42, mz + 0.025, '#8E857A');
    tagMini(mx - s * 0.02, my, mz, s, 5.2, true);
  }

  var PRODS = PDEF.map(function (p, i) {
    var s = p.side, z = p.z;
    if (s === 0) {   // 3 · 시장 정중앙 : 양쪽으로 보이는 대형 디스플레이 + 초록 파라솔
      pad(0, z, 3.4);
      screenProduct(z, i);
      parasol(0, z, 2.3, 5.0, C.accent, C.accentD);
      banner(z - 7, i); banner(z + 7, i);
      ob(-1.45, z - 0.7, 1.45, z + 0.7);
      ACT.push({ kind: 'p', x: 0, z: z, r: 4.0, i: i });
      return { x: 0, z: z, side: 0, ax: 0, az: z - 3.2, yaw: 0, ly: 1.6 };
    }
    pad(s * 3.1, z, 2.2);
    parasol(s * 4.05, z, 1.75, 2.75, C.accent, C.accentD);
    if (i === 0) { M.flat(s * 2.85, z - 1.1, s * 4.35, z + 1.1, 0.06, '#C5D2A6'); mirrorProduct(s, z); rack(s, z + 1.05, z + 2.25); ob(s * 3.3, z + 1.0, s * 4.3, z + 2.3); }
    else if (i === 1) braceletProduct(s, z);
    else tagProduct(s, z);
    standee(s, z, i);
    banner(z, i);
    ACT.push({ kind: 'p', x: s * 3.2, z: z, r: 3.5, i: i });
    return { x: s * 3.3, z: z, side: s, ax: s * 0.3, az: z, yaw: s > 0 ? Math.PI / 2 : -Math.PI / 2, ly: 0 };
  });
  // 흥정 소리 센서 : 시장 가운데 화면 주변 가게 앞
  [[-1, 58], [1, 66], [-1, 72], [1, 92], [-1, 96], [1, 104], [-1, 112], [1, 52]].forEach(function (q) { sensorPod(q[0], q[1]); });

  /* ---------- 사람 ---------- */
  var BODY = new Mesh(), LEG = new Mesh(), HEAD = new Mesh();
  BODY.box(-0.19, 0.84, -0.11, 0.19, 1.42, 0.11, [1, 1, 1], 0, 1);
  BODY.box(-0.27, 0.9, -0.07, -0.19, 1.4, 0.07, [1, 1, 1], 0, 1); BODY.box(0.19, 0.9, -0.07, 0.27, 1.4, 0.07, [1, 1, 1], 0, 1);
  BODY.box(-0.05, 1.42, -0.05, 0.05, 1.48, 0.05, [0.85, 0.72, 0.62]);
  HEAD.sph(0, 1.59, 0, 0.115, 0.13, 0.115, [1, 1, 1], 1, 8, 6);
  HEAD.sph(0, 1.635, -0.015, 0.122, 0.1, 0.124, '#2B2420', 0, 8, 4);
  LEG.box(-0.075, -0.8, -0.075, 0.075, 0, 0.075, [1, 1, 1], 0, 1); LEG.box(-0.08, -0.84, -0.06, 0.08, -0.76, 0.13, '#2F2B28');
  var NPC = [];
  function addNpc(o) {
    o.shirt = jit(pick(C.cloth), 0.1); o.pant = hex(pick(C.pants)); o.skin = hex(pick(C.skin)); o.ph = rnd() * 6; o.sc = 0.92 + rnd() * 0.16; NPC.push(o);
  }
  for (var n1 = 0; n1 < 54; n1++) addNpc({ walk: true, x: -2 + rnd() * 4, z: 2 + rnd() * (L - 4), dir: rnd() > 0.5 ? 1 : -1, sp: 0.9 + rnd() * 0.55, pause: 0 });
  ACT.forEach(function (a) {
    if (a.kind !== 's' || rnd() > 0.5) return;
    var s = a.x > 0 ? 1 : -1; addNpc({ walk: false, x: s * (2.2 + rnd() * 0.35), z: a.z + (rnd() - 0.5) * 1.6, yaw: s > 0 ? Math.PI / 2 : -Math.PI / 2 });
  });
  // 옷 무더기 앞에서 고르는 사람들
  for (var hb = 0; hb < 3; hb++) addNpc({ walk: false, x: 2.45 + rnd() * 0.2, z: HEAP[0] + 1 + hb * 1.8, yaw: Math.PI / 2 });

  /* ---------- 제품 앞에서 제품을 쓰는 사람들 (팔이 움직이는 사람) ---------- */
  // 몸(팔 없음) · 팔(어깨 기준) · 손에 든 물건
  var BODY2 = new Mesh(), ARM = new Mesh();
  BODY2.box(-0.19, 0.84, -0.11, 0.19, 1.42, 0.11, [1, 1, 1], 0, 1);
  BODY2.box(-0.05, 1.42, -0.05, 0.05, 1.48, 0.05, [0.85, 0.72, 0.62]);
  ARM.box(-0.042, -0.46, -0.046, 0.042, 0.03, 0.046, [1, 1, 1], 0, 1);
  ARM.box(-0.036, -0.56, -0.04, 0.036, -0.46, 0.04, '#DDB898');
  var GARM = new Mesh();   // 옷걸이에 걸린 옷 (몸 앞에 대 봄)
  GARM.box(-0.21, 0.74, 0.3, 0.21, 1.33, 0.325, [1, 1, 1], 0, 1);
  GARM.box(-0.26, 1.12, 0.3, -0.21, 1.33, 0.325, [1, 1, 1], 0, 1); GARM.box(0.21, 1.12, 0.3, 0.26, 1.33, 0.325, [1, 1, 1], 0, 1);
  GARM.box(-0.13, 1.33, 0.305, 0.13, 1.355, 0.32, '#6B6660'); GARM.box(-0.012, 1.355, 0.305, 0.012, 1.43, 0.32, '#6B6660');
  var PHONE = new Mesh(); PHONE.box(-0.035, -0.64, -0.01, 0.035, -0.5, 0.012, '#26272B'); PHONE.box(-0.03, -0.635, 0.012, 0.03, -0.505, 0.015, '#5E7C93');
  var READER = new Mesh(); READER.box(-0.05, -0.6, -0.02, 0.05, -0.52, 0.07, '#F2F0EC'); READER.box(-0.035, -0.59, 0.07, 0.035, -0.54, 0.075, '#2C3A35');
  var CAMH = new Mesh();   // 손에 든 필름 카메라 + 매달린 태그
  CAMH.box(-0.09, -0.62, -0.045, 0.09, -0.52, 0.045, '#3A3633'); CAMH.box(-0.09, -0.52, -0.045, 0.09, -0.49, 0.045, '#C9C6C0');
  CAMH.box(-0.035, -0.6, 0.045, 0.035, -0.54, 0.09, '#1F1D1B');
  CAMH.box(0.075, -0.75, -0.012, 0.125, -0.63, 0.012, '#F1EEE8'); CAMH.box(0.075, -0.75, -0.013, 0.125, -0.715, 0.013, '#7E8C86'); CAMH.box(0.09, -0.69, 0.012, 0.11, -0.67, 0.014, '#2A2C2E');
  var BRW = new Mesh();    // 손목에 찬 TALKTIDE 팔찌
  BRW.box(-0.052, -0.45, -0.052, 0.052, -0.39, 0.052, '#EFE8DC'); BRW.box(-0.053, -0.44, 0.03, 0.053, -0.4, 0.053, '#D59E9C');
  var BRH = new Mesh();    // 손에 든 팔찌 (보여 주는 중)
  BRH.box(-0.08, -0.66, -0.016, 0.08, -0.62, 0.016, '#EFE8DC'); BRH.box(-0.08, -0.66, -0.016, -0.045, -0.54, 0.016, '#EFE8DC'); BRH.box(0.045, -0.66, -0.016, 0.08, -0.54, 0.016, '#EFE8DC'); BRH.box(-0.03, -0.665, 0.016, 0.03, -0.645, 0.02, '#D59E9C');

  var VCAM = new Mesh();   // 손에 든 구제(빈티지) 카메라 : 가죽 바디 + 은색 상판 + 렌즈 + 뷰파인더 + 가격 태그
  (function () {
    var C = new Mesh(), y = -0.585;   // 손 위에 얹힌 높이 기준 (수평 상태로 만든 뒤 팔 각도만큼 되돌림)
    C.box(-0.1, y, -0.04, 0.1, y + 0.075, 0.04, '#4A3426');                                      // 갈색 가죽 바디
    C.box(-0.101, y + 0.075, -0.041, 0.101, y + 0.105, 0.041, '#CFCBC3');                        // 은색 상판
    C.box(-0.101, y - 0.008, -0.041, 0.101, y, 0.041, '#CFCBC3');                                // 은색 하판
    C.box(-0.032, y + 0.105, -0.026, 0.032, y + 0.13, 0.026, '#BDB8AF');                         // 프리즘 상단
    C.box(-0.082, y + 0.105, -0.014, -0.056, y + 0.12, 0.014, '#2A2622');                        // 왼쪽 다이얼
    C.box(0.056, y + 0.105, -0.014, 0.082, y + 0.12, 0.014, '#2A2622');                          // 오른쪽 다이얼
    C.box(0.062, y + 0.12, -0.007, 0.075, y + 0.127, 0.007, '#B0504A');                          // 셔터 버튼
    C.box(-0.044, y + 0.002, 0.04, 0.044, y + 0.09, 0.06, '#DAD6CF');                            // 렌즈 링(은색)
    C.box(-0.034, y + 0.012, 0.06, 0.034, y + 0.08, 0.098, '#1E1C1A');                           // 렌즈 경통
    C.box(-0.022, y + 0.024, 0.098, 0.022, y + 0.068, 0.101, '#5E7C93');                         // 렌즈 유리
    C.box(0.058, y + 0.08, 0.041, 0.088, y + 0.098, 0.044, '#8FA3B3');                           // 뷰파인더 창
    C.box(-0.098, y - 0.11, -0.004, -0.094, y, 0.004, '#B9A688');                                // 태그 끈
    C.box(-0.128, y - 0.16, -0.006, -0.07, y - 0.11, 0.006, '#F1EEE8');                          // 가격 태그
    C.box(-0.128, y - 0.16, -0.007, -0.07, y - 0.145, 0.007, '#A2BA75');
    // 상인 팔(약 -1.0rad)만큼 앞으로 숙여지는 것을 되돌려 카메라가 수평으로 보이게
    var A = 1.0, ca = Math.cos(A), sa = Math.sin(A), py = -0.56, d = C.d;
    for (var i = 0; i < d.length; i += 12) {
      var yy = d[i + 1] - py, zz = d[i + 2]; d[i + 1] = py + yy * ca - zz * sa; d[i + 2] = yy * sa + zz * ca;
      var ny = d[i + 4], nz = d[i + 5]; d[i + 4] = ny * ca - nz * sa; d[i + 5] = ny * sa + nz * ca;
    }
    VCAM.d = d;
  })();

  var ACTORS = [];
  var face = function (x, z, tx, tz) { return Math.atan2(tx - x, tz - z); };
  function actor(o) {
    o.shirt = o.shirt ? hex(o.shirt) : jit(pick(C.cloth), 0.1); o.pant = hex(o.pant || pick(C.pants)); o.skin = hex(pick(C.skin));
    o.sc = o.sc || (0.94 + rnd() * 0.12); o.ph = rnd() * 6; o.props = o.props || [];
    o.armL = o.armL || function () { return 0.06; }; o.armR = o.armR || function () { return 0.06; };
    o.yawF = o.yawF || function () { return o.yaw; };
    ACTORS.push(o); ob(o.x - 0.24, o.z - 0.24, o.x + 0.24, o.z + 0.24);
  }
  (function () {
    var w = function (base, amp, sp, ph) { return function (t) { return base + amp * Math.sin(t * sp + (ph || 0)); }; };
    // 1 · 거울 앞 : 옷을 몸에 대 보며 이리저리 돌아보는 손님 + 옆에서 봐 주는 친구
    var p0 = PRODS[0], mx = p0.side * 2.55, mz = p0.z;
    actor({ x: mx, z: mz, yaw: Math.PI / 2 * p0.side, shirt: '#E4D9C8', pant: '#3F4A57',
      yawF: function (t) { return Math.PI / 2 * p0.side + Math.sin(t * 0.85) * 0.55; },
      armL: w(-0.78, 0.05, 0.85), armR: w(-0.78, 0.05, 0.85, 0.3), props: [{ g: 'garm', on: 'body', tint: '#6F7F8F' }] });
    actor({ x: p0.side * 1.85, z: mz - 1.15, yaw: face(p0.side * 1.85, mz - 1.15, mx, mz), shirt: '#A0705F',
      armR: w(-1.05, 0.3, 2.0), armL: w(-0.25, 0.04, 1.2) });
    // 2 · 팔찌 좌판 : 상인이 구제 카메라를 들어 보이며 손님과 흥정 (손님 손목에 TALKTIDE)
    var p1 = PRODS[1], s1 = p1.side, mzx = s1 * 3.75, mzz = p1.z - 1.85, czx = s1 * 2.5, czz = p1.z - 1.6;
    actor({ x: mzx, z: mzz, yaw: face(mzx, mzz, czx, czz), shirt: '#5E6B57', pant: '#4B4540', sc: 1.0,
      armR: w(-0.55, 0.38, 2.3), armL: w(-1.0, 0.06, 1.1), props: [{ g: 'vcam', on: 'L' }] });
    actor({ x: czx, z: czz, yaw: face(czx, czz, mzx, mzz), shirt: '#6F7F8F', pant: '#2F2E2C',
      armL: w(-1.25, 0.12, 1.4, 1.5), armR: w(-0.5, 0.35, 2.3, Math.PI), props: [{ g: 'brw', on: 'L' }] });
    // 3 · 가운데 대형 화면 : 화면 속 거래 정보를 바라보는 사람들 (양쪽)
    var p2 = PRODS[2], z2 = p2.z;
    actor({ x: -1.15, z: z2 - 3.3, yaw: 0.06, shirt: '#C9B79C', armR: w(-2.35, 0.1, 1.6) });
    actor({ x: 0.05, z: z2 - 3.6, yaw: -0.05, shirt: '#4F4A45' });
    actor({ x: 0.95, z: z2 - 3.15, yaw: -0.1, shirt: '#E8CB8E', sc: 0.72, armL: w(-0.35, 0.05, 1) });
    actor({ x: 1.55, z: z2 - 3.5, yaw: -0.2, shirt: '#7B6A8C', armR: w(-1.9, 0.04, 0.8), props: [{ g: 'phone', on: 'R' }] });
    actor({ x: -0.75, z: z2 + 3.4, yaw: Math.PI + 0.08, shirt: '#A9BAD2' });
    actor({ x: 0.55, z: z2 + 3.25, yaw: Math.PI - 0.06, shirt: '#8C8178', armL: w(-2.2, 0.12, 1.3, 1) });
    actor({ x: 1.45, z: z2 + 3.6, yaw: Math.PI - 0.25, shirt: '#D9A6A1' });
    // 4 · 태그 좌판 : 태그로 가격을 확인하고 거래하는 손님과 상인 (카드 단말기에 휴대폰을 대는 중)
    var p3 = PRODS[3], s3 = p3.side, sx = s3 * 3.55, sz = p3.z - 1.85, kx = s3 * 2.45, kz = p3.z - 2.25;
    actor({ x: sx, z: sz, yaw: face(sx, sz, kx, kz), shirt: '#5A4A3E', pant: '#3F4A57', armR: w(-1.08, 0.04, 1.1), props: [{ g: 'reader', on: 'R' }], armL: w(-0.2, 0.05, 1.6) });
    actor({ x: kx, z: kz, yaw: face(kx, kz, sx, sz), shirt: '#B8A48C', pant: '#2F2E2C',
      armR: function (t) { return -1.02 + 0.16 * Math.max(0, Math.sin(t * 2.4)); }, props: [{ g: 'phone', on: 'R' }, { g: 'cam', on: 'L' }], armL: w(-0.62, 0.03, 1.2) });
  })();

  /* ---------- 표시용 (마커·빛기둥·하늘) ---------- */
  var MARK = new Mesh(), RING = new Mesh(), BEAM = new Mesh(), SKY = new Mesh();
  (function () {
    var t = [0, 0.26, 0], b = [0, -0.26, 0], e = [[0.18, 0, 0], [0, 0, 0.18], [-0.18, 0, 0], [0, 0, -0.18]], c = hex(C.accent);
    for (var i = 0; i < 4; i++) { MARK.tri(e[i], e[(i + 1) % 4], t, c); MARK.tri(e[(i + 1) % 4], e[i], b, dim(c, 0.85)); }
    for (var k = 0; k < 28; k++) {
      var a0 = k / 28 * Math.PI * 2, a1 = (k + 1) / 28 * Math.PI * 2, r0 = 0.42, r1 = 0.48;
      RING.quad([Math.cos(a0) * r0, 0, Math.sin(a0) * r0], [Math.cos(a1) * r0, 0, Math.sin(a1) * r0], [Math.cos(a1) * r1, 0, Math.sin(a1) * r1], [Math.cos(a0) * r1, 0, Math.sin(a0) * r1], [1, 1, 1], 1);
    }
    BEAM.cyl(0, 0, 0, 16, 0.55, 16, [1, 1, 1], 1, 0.55);   // 초록으로 물들도록 (tint 적용)
    var top = hex('#BCCFDE'), hor = hex('#F2E8DB'), low = hex('#E9DFD1');
    for (var i2 = 0; i2 < 24; i2++) for (var j = 0; j < 10; j++) {
      var P = function (ii, jj) { var th = ii / 24 * Math.PI * 2, ph = jj / 10 * Math.PI; return [Math.cos(th) * Math.sin(ph) * 600, Math.cos(ph) * 600, Math.sin(th) * Math.sin(ph) * 600]; };
      var col = function (p) { var y = p[1] / 600; return y > 0 ? [hor[0] + (top[0] - hor[0]) * Math.pow(y, 0.6), hor[1] + (top[1] - hor[1]) * Math.pow(y, 0.6), hor[2] + (top[2] - hor[2]) * Math.pow(y, 0.6)] : low; };
      var a = P(i2, j), b2 = P(i2 + 1, j), c3 = P(i2 + 1, j + 1), d = P(i2, j + 1);
      SKY.v(a, [0, 1, 0], col(a)); SKY.v(b2, [0, 1, 0], col(b2)); SKY.v(c3, [0, 1, 0], col(c3));
      SKY.v(a, [0, 1, 0], col(a)); SKY.v(c3, [0, 1, 0], col(c3)); SKY.v(d, [0, 1, 0], col(d));
    }
  })();

  /* =========================================================
     WebGL
     ========================================================= */
  var VS = 'attribute vec3 aP,aN;attribute vec4 aC;attribute vec2 aU;uniform mat4 uVP,uM;uniform vec3 uTint;' +
    'varying vec3 vN,vW,vC;varying vec2 vU;void main(){vec4 w=uM*vec4(aP,1.);vW=w.xyz;vN=(uM*vec4(aN,0.)).xyz;' +
    'vC=aC.a>.5?aC.rgb*uTint:aC.rgb;vU=aU;gl_Position=uVP*w;}';
  var FS = 'precision mediump float;uniform sampler2D uTex;uniform vec3 uEmis,uCam,uFogCol,uSun;uniform float uLit,uFogOn,uAlpha,uFogD;' +
    'varying vec3 vN,vW,vC;varying vec2 vU;void main(){vec3 n=normalize(vN);if(!gl_FrontFacing)n=-n;vec4 t=texture2D(uTex,vU);vec3 b=vC*t.rgb;vec3 c=b;' +
    'if(uLit>.5){float d=max(dot(n,uSun),0.);float h=n.y*.5+.5;vec3 amb=mix(vec3(.76,.71,.65),vec3(.98,.98,1.),h);c=b*(amb*.92+vec3(1.,.95,.86)*d*.3);}' +
    'c+=uEmis;if(uFogOn>.5){float ds=length(vW-uCam);float f=1.-exp(-pow(ds*uFogD,1.5));c=mix(c,uFogCol,clamp(f,0.,1.));}gl_FragColor=vec4(c,uAlpha*t.a);}';
  function sh(type, src) { var s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) console.warn(gl.getShaderInfoLog(s)); return s; }
  var prog = gl.createProgram(); gl.attachShader(prog, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FS)); gl.linkProgram(prog); gl.useProgram(prog);
  var A = {}, U = {};
  ['aP', 'aN', 'aC', 'aU'].forEach(function (k) { A[k] = gl.getAttribLocation(prog, k); gl.enableVertexAttribArray(A[k]); });
  ['uVP', 'uM', 'uTint', 'uEmis', 'uCam', 'uFogCol', 'uSun', 'uLit', 'uFogOn', 'uAlpha', 'uFogD', 'uTex'].forEach(function (k) { U[k] = gl.getUniformLocation(prog, k); });
  function upload(mesh, dyn) { var b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(mesh.d), dyn ? gl.DYNAMIC_DRAW : gl.STATIC_DRAW); return { b: b, n: mesh.d.length / 12 }; }
  var G = { world: upload(M), body: upload(BODY), leg: upload(LEG), head: upload(HEAD), mark: upload(MARK), ring: upload(RING), beam: upload(BEAM), sky: upload(SKY),
    body2: upload(BODY2), arm: upload(ARM), garm: upload(GARM), phone: upload(PHONE), reader: upload(READER), cam: upload(CAMH), brw: upload(BRW), brh: upload(BRH), vcam: upload(VCAM) };
  M = null;
  var chev = { b: gl.createBuffer(), n: 0 };
  var tex = gl.createTexture();
  function upTex() { gl.bindTexture(gl.TEXTURE_2D, tex); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, AT); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE); }
  upTex();
  if (document.fonts && document.fonts.load) Promise.all([document.fonts.load("700 40px 'PretendardLocal'"), document.fonts.load("500 15px 'PretendardLocal'")]).then(function () { drawAtlas(); upTex(); }).catch(function () {});
  gl.enable(gl.DEPTH_TEST); gl.disable(gl.CULL_FACE); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  gl.uniform1i(U.uTex, 0);
  var sun = [0.45, 0.78, -0.43], sl = Math.hypot(sun[0], sun[1], sun[2]); gl.uniform3f(U.uSun, sun[0] / sl, sun[1] / sl, sun[2] / sl);
  var FOG = hex('#EFE6DA'); gl.uniform3fv(U.uFogCol, FOG);
  var I4 = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
  function bind(g) {
    gl.bindBuffer(gl.ARRAY_BUFFER, g.b);
    gl.vertexAttribPointer(A.aP, 3, gl.FLOAT, false, 48, 0); gl.vertexAttribPointer(A.aN, 3, gl.FLOAT, false, 48, 12);
    gl.vertexAttribPointer(A.aC, 4, gl.FLOAT, false, 48, 24); gl.vertexAttribPointer(A.aU, 2, gl.FLOAT, false, 48, 40);
  }
  function draw(g, m, tint, emis) { gl.uniformMatrix4fv(U.uM, false, m || I4); gl.uniform3fv(U.uTint, tint || [1, 1, 1]); gl.uniform3fv(U.uEmis, emis || [0, 0, 0]); gl.drawArrays(gl.TRIANGLES, 0, g.n); }

  /* ---------- 행렬 ---------- */
  function persp(fov, asp, n, f) { var t = 1 / Math.tan(fov / 2), nf = 1 / (n - f); return [t / asp, 0, 0, 0, 0, t, 0, 0, 0, 0, (f + n) * nf, -1, 0, 0, 2 * f * n * nf, 0]; }
  function lookAt(e, c) {
    var zx = e[0] - c[0], zy = e[1] - c[1], zz = e[2] - c[2], l = Math.hypot(zx, zy, zz); zx /= l; zy /= l; zz /= l;
    var xx = zz, xy = 0, xz = -zx; l = Math.hypot(xx, xz) || 1; xx /= l; xz /= l;   // x = up × z
    var yx = zy * xz - zz * xy, yy = zz * xx - zx * xz, yz = zx * xy - zy * xx;
    return [xx, yx, zx, 0, xy, yy, zy, 0, xz, yz, zz, 0, -(xx * e[0] + xy * e[1] + xz * e[2]), -(yx * e[0] + yy * e[1] + yz * e[2]), -(zx * e[0] + zy * e[1] + zz * e[2]), 1];
  }
  function mul(a, b) { var o = new Array(16); for (var i = 0; i < 4; i++) for (var j = 0; j < 4; j++) { var s = 0; for (var k = 0; k < 4; k++) s += a[k * 4 + j] * b[i * 4 + k]; o[i * 4 + j] = s; } return o; }
  function trs(x, y, z, ry, rx, s) {
    var cy = Math.cos(ry), sy = Math.sin(ry), cx = Math.cos(rx || 0), sx = Math.sin(rx || 0); s = s || 1;
    return [cy * s, 0, -sy * s, 0, sy * sx * s, cx * s, cy * sx * s, 0, sy * cx * s, -sx * s, cy * cx * s, 0, x, y, z, 1];
  }

  /* =========================================================
     카메라 · 상태
     ========================================================= */
  var Wd = 1, Hd = 1, DPR = 1;
  function resize() {
    DPR = mode === 'walk' ? Math.min(window.devicePixelRatio || 1, 1.5) : Math.min(2.25, Math.max(2, window.devicePixelRatio || 1));   // 처음 화면은 2배로 그려 가는 줄무늬가 지글거리지 않게
    Wd = Math.max(1, stage.clientWidth); Hd = Math.max(1, stage.clientHeight);
    cv.width = Math.round(Wd * DPR); cv.height = Math.round(Hd * DPR);
  }
  var mode = 'over';               // over | enter | walk | exit
  var OV = { th: 2.62, ph: 0.6, drag: 0 };
  function ovPose(t) {
    var asp = Wd / Hd, D = 150 * Math.max(1, 1.5 / asp), th = OV.th + OV.drag, cp = Math.cos(OV.ph);
    var T = [2, 0, L * 0.47];
    var sx = (document.getElementById('map').classList.contains('dm-portal-next') && Wd > 900) ? 0.12 : 0;   // 왼쪽 아래 안내 영역을 살짝 피해 거리를 약간 오른쪽으로 (숫자를 줄이면 왼쪽으로)
    return { e: [T[0] + Math.sin(th) * cp * D, Math.sin(OV.ph) * D, T[2] + Math.cos(th) * cp * D], c: T, fov: 0.6, near: 3, fog: 1 / 900, sx: sx };
  }
  var P = { x: 0, z: 3, yaw: 0, pitch: -0.04, vx: 0, vz: 0, bob: 0, mv: 0 };
  function fwd(y, p) { return [Math.sin(y) * Math.cos(p), Math.sin(p), Math.cos(y) * Math.cos(p)]; }
  function walkPose() { var e = [P.x, 1.62 + Math.sin(P.bob) * 0.035 * P.mv, P.z], f = fwd(P.yaw, P.pitch); return { e: e, c: [e[0] + f[0], e[1] + f[1], e[2] + f[2]], fov: 1.2, near: 0.12, fog: 1 / 150, sx: 0 }; }
  var anim = null;   // {from, toFn, t0, ms, done}
  var VP = I4, camE = [0, 0, 0];

  /* =========================================================
     UI
     ========================================================= */
  var labWrap = $('.wk-labs'), prompt = $('.wk-prompt'), toast = $('.wk-toast'), card = $('.wk-card'), navP = $('.wk-navpanel'),
      chip = $('.wk-chip'), chipArr = $('.wk-chip .arr'), chipT = $('.wk-chip .t'), fade = $('.wk-fade');
  var labs = PRODS.map(function (p, i) {
    var b = document.createElement('button'); b.type = 'button'; b.className = 'wk-lab';
    var nm = PR[i] ? PR[i].name : ''; b.innerHTML = '<span class="no">PRODUCT 0' + (i + 1) + '</span><span class="nm">' + nm + '</span><span class="ds"></span>';
    b.setAttribute('aria-label', 'PRODUCT ' + (i + 1) + ' 제품 보기');
    b.addEventListener('click', function () { if (mode === 'over') openCard(i); });
    labWrap.appendChild(b); return { el: b, ds: b.querySelector('.ds') };
  });
  // 길 안내 목록
  var navList = $('.wk-navlist');
  PRODS.forEach(function (p, i) {
    var d = PR[i] || {}, li = document.createElement('li');
    li.innerHTML = '<div class="wk-ni"><span class="no">PRODUCT 0' + (i + 1) + '</span><span class="nm">' + (d.name || '') + '</span><span class="ds" data-ds></span></div>' +
      '<div class="wk-nb"><button type="button" data-go="nav">길 안내</button><button type="button" data-go="tp">바로 이동</button></div>';
    li.querySelector('[data-go="nav"]').onclick = function () { startNav(i); };
    li.querySelector('[data-go="tp"]').onclick = function () { teleport(i); };
    navList.appendChild(li);
  });
  var navDs = [].slice.call(navList.querySelectorAll('[data-ds]'));
  var toastT = 0;
  function showToast(h, ms) { toast.innerHTML = h; toast.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(function () { toast.classList.remove('show'); }, ms || 3600); }
  var cardOpen = false;
  var cardI = -1;
  function fillCard(i) {
    var d = PR[i] || {}, u = DURL(i + 1);
    $('.wk-card .ph').style.background = d.img ? (d.bg || '#EEE') + " url('" + d.img + "') center/" + (d.fit || 'cover') + ' no-repeat' : (d.bg || '#EEE');
    $('.wk-card .no').textContent = 'Product 0' + (i + 1);
    $('.wk-card .nm').textContent = d.name || '';
    $('.wk-card .ds').textContent = d.brief || d.summary || d.detail || '';
    $('.wk-card .ct').textContent = (i + 1) + ' / ' + PRODS.length;
    var a = $('.wk-card .go'); if (u) { a.href = u; a.classList.remove('soon'); a.innerHTML = '상세 페이지 보기 <span class="arrow">→</span>'; } else { a.removeAttribute('href'); a.classList.add('soon'); a.textContent = '개인 페이지 준비 중'; }
    labs.forEach(function (L2, k) { L2.el.classList.toggle('on', k === i); });
  }
  var swapT = 0;
  function openCard(i, dir) {
    var was = cardOpen && card.classList.contains('open');
    card.classList.toggle('wk-over', mode === 'over'); prompt.classList.remove('show');
    if (was && i !== cardI) {   // 다른 제품으로 바꿀 때 : 지금 내용은 옆으로 빠지고 새 내용이 반대쪽에서 들어옴
      if (dir === undefined) dir = i > cardI ? 1 : -1;
      clearTimeout(swapT); card.classList.remove('in-l', 'in-r'); card.classList.add(dir > 0 ? 'out-l' : 'out-r');
      cardI = i;
      swapT = setTimeout(function () {
        fillCard(i); card.classList.remove('out-l', 'out-r'); card.classList.add(dir > 0 ? 'in-r' : 'in-l');
        void card.offsetWidth; card.classList.remove('in-l', 'in-r');
      }, 230);
    } else { fillCard(i); cardI = i; card.classList.add('open'); }
    cardOpen = true;
  }
  function stepCard(k) { if (!cardOpen) return; var n = PRODS.length; openCard(((cardI + k) % n + n) % n, k); }
  // 카드 바깥 아무 곳이나 누르면 닫힘 (드래그로 돌려 보는 건 제외)
  var downAt = null;
  stage.addEventListener('pointerdown', function (e) { downAt = [e.clientX, e.clientY]; }, true);
  stage.addEventListener('click', function (e) {
    if (!cardOpen || !downAt || Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]) > 6) return;
    if (e.target.closest('.wk-card, .wk-lab, .wk-navpanel, .wk-btns, .wk-tbtns, .wk-joy')) return;
    closeCard();
  });
  $('.wk-card .walk').onclick = function () { var i = cardI; closeCard(); enter(i); };
  $('.wk-card .prev').onclick = function () { stepCard(-1); };
  $('.wk-card .next').onclick = function () { stepCard(1); };
  function closeCard() { card.classList.remove('open'); cardOpen = false; near = null; labs.forEach(function (L2) { L2.el.classList.remove('on'); }); }
  $('.wk-card .x').onclick = closeCard;
  function toggleNav(on) { var o = on === undefined ? !navP.classList.contains('open') : on; navP.classList.toggle('open', o); $('.wk-navbtn').setAttribute('aria-expanded', o); }
  $('.wk-navbtn').onclick = function () { toggleNav(); };
  $('.wk-exit').onclick = function () { exit(); };
  $('.wk-enter').onclick = function () { enter(-1); };

  /* ---------- 길 안내 ---------- */
  var navI = -1;
  function startNav(i) {
    navI = i; toggleNav(false); chip.classList.add('show');
    showToast('<b>PRODUCT 0' + (i + 1) + '</b> 초록 파라솔까지 바닥의 화살표를 따라가세요', 3000);
  }
  function stopNav() { navI = -1; chip.classList.remove('show'); chev.n = 0; }
  function teleport(i) {
    toggleNav(false); stopNav();
    if (mode !== 'walk') { if (mode === 'over') enter(i); return; }
    fade.classList.add('on');
    setTimeout(function () {
      var p = PRODS[i]; P.x = p.ax; P.z = p.az; P.vx = P.vz = 0; P.yaw = p.yaw; P.pitch = p.side ? -0.2 : 0.08;
      fade.classList.remove('on'); showToast('<b>PRODUCT 0' + (i + 1) + '</b> 앞이에요 · <kbd>E</kbd>를 눌러 살펴보세요', 3000);
    }, 380);
  }
  function buildChevrons(t) {
    var p = PRODS[navI], dx = p.ax - P.x, dz = p.az - P.z, D = Math.hypot(dx, dz);
    if (D < 1.6) { var n = navI; stopNav(); showToast('<b>PRODUCT 0' + (n + 1) + '</b>에 도착했어요 · <kbd>E</kbd>를 눌러 살펴보세요', 3200); return; }
    var ux = dx / D, uz = dz / D, sx = uz, sz = -ux, d = [], g = hex(C.accent), off = (t * 1.6) % 1.4;
    for (var s = 1.0 + off; s < D - 0.4 && s < 60; s += 1.4) {
      var cx = P.x + ux * s, cz = P.z + uz * s, k = 0.55 + 0.45 * Math.max(0, Math.sin((s - t * 6) * 0.9)), col = [g[0] * k + (1 - k) * 0.95, g[1] * k + (1 - k) * 0.97, g[2] * k + (1 - k) * 0.9];
      var tip = [cx + ux * 0.32, 0.03, cz + uz * 0.32], l = [cx - ux * 0.22 + sx * 0.34, 0.03, cz - uz * 0.22 + sz * 0.34], m = [cx - ux * 0.02, 0.03, cz - uz * 0.02], r = [cx - ux * 0.22 - sx * 0.34, 0.03, cz - uz * 0.22 - sz * 0.34];
      [tip, l, m, tip, m, r].forEach(function (v) { d.push(v[0], v[1], v[2], 0, 1, 0, col[0], col[1], col[2], 0, W0, W0); });
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, chev.b); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(d), gl.DYNAMIC_DRAW); chev.n = d.length / 12;
    var ang = Math.atan2(dx, dz) - P.yaw; chipArr.style.transform = 'rotate(' + (-ang) + 'rad)';
    chipT.innerHTML = '<b>PRODUCT 0' + (navI + 1) + '</b>까지 ' + Math.round(D) + 'm';
  }

  /* ---------- 들어가기 · 나가기 ---------- */
  var welcomed = false;
  function goFull(on) {
    if (on) {
      var r = wrap.getBoundingClientRect();
      stage.style.transition = 'none';
      stage.style.clipPath = 'inset(' + Math.max(0, r.top) + 'px ' + Math.max(0, innerWidth - r.right) + 'px ' + Math.max(0, innerHeight - r.bottom) + 'px ' + Math.max(0, r.left) + 'px)';
      stage.classList.add('wk-full'); document.documentElement.classList.add('wk-lock');
      void stage.offsetWidth; stage.style.transition = 'clip-path .8s cubic-bezier(.65,0,.35,1)'; stage.style.clipPath = 'inset(0px 0px 0px 0px)';
    } else {
      stage.classList.remove('wk-full'); document.documentElement.classList.remove('wk-lock'); stage.style.transition = ''; stage.style.clipPath = '';
    }
    resize();
  }
  function enter(i) {
    if (mode !== 'over') return;
    closeCard();
    var t = performance.now() / 1000, from = ovPose(t);
    if (i >= 0) { var p = PRODS[i]; P.x = p.ax; P.z = p.az; P.yaw = p.yaw; P.pitch = p.side ? -0.2 : 0.08; }
    else { P.x = 0; P.z = 3.2; P.yaw = 0; P.pitch = -0.03; }
    P.vx = P.vz = 0; P.mv = 0;
    mode = 'enter'; stage.classList.add('wk-on'); goFull(true);
    anim = { from: from, to: walkPose, t0: performance.now(), ms: reduce ? 10 : 2200, done: function () {
      mode = 'walk'; stage.focus({ preventScroll: true });
      if (i >= 0) showToast('<b>PRODUCT 0' + (i + 1) + '</b> 앞이에요 · <kbd>E</kbd>를 눌러 살펴보세요', 3200);
      else if (!welcomed) showToast('동묘 벼룩시장에 오신 걸 환영해요 · 초록 파라솔에 제품이 있어요<br><kbd>N</kbd> 길 안내로 찾아가 보세요', 5200);
      welcomed = true;
    } };
    kick();
  }
  function exit() {
    if (mode !== 'walk') return;
    closeCard(); toggleNav(false); stopNav(); prompt.classList.remove('show'); toast.classList.remove('show'); keys = {};
    var from = walkPose(); mode = 'exit'; stage.classList.remove('wk-on');
    anim = { from: from, to: function () { return ovPose(performance.now() / 1000); }, t0: performance.now(), ms: reduce ? 10 : 1600, done: function () { mode = 'over'; goFull(false); } };
  }

  /* ---------- 입력 ---------- */
  var keys = {};
  var MOVE = { KeyW: 1, KeyA: 1, KeyS: 1, KeyD: 1, ArrowUp: 1, ArrowDown: 1, ArrowLeft: 1, ArrowRight: 1, ShiftLeft: 1, ShiftRight: 1, Space: 1 };
  addEventListener('keydown', function (e) {
    if (mode === 'over') { if (!cardOpen) return; if (e.code === 'Escape') closeCard(); if (e.code === 'ArrowRight') { e.preventDefault(); stepCard(1); } if (e.code === 'ArrowLeft') { e.preventDefault(); stepCard(-1); } return; }
    if (mode !== 'walk' && mode !== 'enter') return;
    var c = e.code;
    if (MOVE[c]) { keys[c] = true; e.preventDefault(); }
    if (c === 'Escape') { e.preventDefault(); if (cardOpen) closeCard(); else if (navP.classList.contains('open')) toggleNav(false); else exit(); }
    if (mode !== 'walk' || e.repeat) return;
    if (c === 'KeyE') { e.preventDefault(); if (cardOpen) closeCard(); else interact(); }
    if (c === 'KeyN') { e.preventDefault(); toggleNav(); }
  });
  addEventListener('keyup', function (e) { keys[e.code] = false; });
  addEventListener('blur', function () { keys = {}; });
  var drag = null;
  cv.addEventListener('pointerdown', function (e) {
    if (e.pointerType === 'touch' && mode === 'walk' && joy.id === e.pointerId) return;
    drag = { id: e.pointerId, x: e.clientX, y: e.clientY }; try { cv.setPointerCapture(e.pointerId); } catch (er) {}
    stage.classList.add('dragging'); hideHint();
  });
  cv.addEventListener('pointermove', function (e) {
    if (!drag || drag.id !== e.pointerId) return;
    var dx = e.clientX - drag.x, dy = e.clientY - drag.y; drag.x = e.clientX; drag.y = e.clientY;
    var k = e.pointerType === 'touch' ? 1.4 : 1;
    if (mode === 'walk') { P.yaw -= dx * 0.0034 * k; P.pitch = clamp(P.pitch - dy * 0.003 * k, -1.15, 1.0); }
    else if (mode === 'over') { OV.drag -= dx * 0.005; if (e.pointerType !== 'touch') OV.ph = clamp(OV.ph + dy * 0.003, 0.3, 1.2); }
  });
  var endDrag = function (e) { if (drag && drag.id === e.pointerId) { drag = null; stage.classList.remove('dragging'); } };
  cv.addEventListener('pointerup', endDrag); cv.addEventListener('pointercancel', endDrag);
  // 터치: 왼쪽 아래 조이스틱 + 상호작용 버튼
  var joy = { id: null, x: 0, y: 0, dx: 0, dy: 0 }, joyEl = $('.wk-joy'), knob = $('.wk-joy i');
  joyEl.addEventListener('pointerdown', function (e) { joy.id = e.pointerId; var r = joyEl.getBoundingClientRect(); joy.x = r.left + r.width / 2; joy.y = r.top + r.height / 2; joyEl.setPointerCapture(e.pointerId); moveJoy(e); e.stopPropagation(); });
  function moveJoy(e) { if (joy.id !== e.pointerId) return; var dx = e.clientX - joy.x, dy = e.clientY - joy.y, l = Math.hypot(dx, dy), m = 44; if (l > m) { dx *= m / l; dy *= m / l; } joy.dx = dx / m; joy.dy = dy / m; knob.style.transform = 'translate(' + dx + 'px,' + dy + 'px)'; }
  joyEl.addEventListener('pointermove', moveJoy);
  var endJoy = function (e) { if (joy.id !== e.pointerId) return; joy.id = null; joy.dx = joy.dy = 0; knob.style.transform = ''; };
  joyEl.addEventListener('pointerup', endJoy); joyEl.addEventListener('pointercancel', endJoy);
  $('.wk-act').onclick = function () { if (cardOpen) closeCard(); else interact(); };
  var runT = $('.wk-run'); runT.onclick = function () { runT.classList.toggle('on'); };
  if (coarse) stage.classList.add('wk-touch');

  /* ---------- 상호작용 ---------- */
  var near = null;
  function findNear() {
    var f = fwd(P.yaw, 0), best = null, bs = 1e9;
    ACT.forEach(function (a) {
      var dx = a.x - P.x, dz = a.z - P.z, d = Math.hypot(dx, dz); if (d > a.r) return;
      var dot = (dx * f[0] + dz * f[2]) / (d || 1); if (dot < 0.15 && d > 1.4) return;
      var sc = d - dot * 0.8 - (a.kind === 'p' ? 1.2 : 0); if (sc < bs) { bs = sc; best = a; }
    });
    return best;
  }
  function interact() {
    if (!near) return;
    if (near.kind === 'p') { openCard(near.i); if (navI === near.i) stopNav(); }
    else showToast('<b>' + near.name + '</b><br>' + near.text, 4200);
  }
  function updPrompt() {
    var n = cardOpen ? null : findNear();
    if (n === near) return; near = n;
    if (!n) { prompt.classList.remove('show'); return; }
    var nm = n.kind === 'p' ? 'PRODUCT 0' + (n.i + 1) + ' · ' + ((PR[n.i] || {}).name || '') + ' 살펴보기' : n.name + ' 둘러보기';
    prompt.innerHTML = '<kbd>E</kbd><span>' + nm + '</span>'; prompt.classList.add('show');
  }

  /* ---------- 이동 · 충돌 ---------- */
  function collide() {
    var R = 0.34;
    P.x = clamp(P.x, -3.3, 3.3); P.z = clamp(P.z, 0.5, L - 0.5);
    for (var i = 0; i < OBS.length; i++) {
      var o = OBS[i]; if (P.z < o[1] - 1 || P.z > o[3] + 1) continue;
      var qx = clamp(P.x, o[0], o[2]), qz = clamp(P.z, o[1], o[3]), dx = P.x - qx, dz = P.z - qz, d = Math.hypot(dx, dz);
      if (d < R) { if (d > 1e-4) { P.x = qx + dx / d * R; P.z = qz + dz / d * R; } else { P.x += (P.x > 0 ? -1 : 1) * R; } }
    }
    for (var j = 0; j < NPC.length; j++) {
      var n = NPC[j], ex = P.x - n.x, ez = P.z - n.z, e = Math.hypot(ex, ez);
      if (e < 0.55 && e > 1e-4) { P.x = n.x + ex / e * 0.55; P.z = n.z + ez / e * 0.55; }
    }
  }
  function stepWalk(dt) {
    var f = [Math.sin(P.yaw), Math.cos(P.yaw)], r = [-Math.cos(P.yaw), Math.sin(P.yaw)];
    var inp = 0, st = 0;
    if (!cardOpen) {
      inp = (keys.KeyW || keys.ArrowUp ? 1 : 0) - (keys.KeyS || keys.ArrowDown ? 1 : 0) - joy.dy;
      st = (keys.KeyD ? 1 : 0) - (keys.KeyA ? 1 : 0) + joy.dx;
      if (keys.ArrowLeft) P.yaw += 1.9 * dt; if (keys.ArrowRight) P.yaw -= 1.9 * dt;
    }
    var mx = f[0] * inp + r[0] * st, mz = f[1] * inp + r[1] * st, ml = Math.hypot(mx, mz);
    if (ml > 1) { mx /= ml; mz /= ml; ml = 1; }
    var run = keys.ShiftLeft || keys.ShiftRight || runT.classList.contains('on'), sp = run ? 6.4 : 3.1;
    var k = 1 - Math.exp(-dt * 9);
    P.vx += (mx * sp - P.vx) * k; P.vz += (mz * sp - P.vz) * k;
    P.x += P.vx * dt; P.z += P.vz * dt; collide();
    var v = Math.hypot(P.vx, P.vz); P.mv += (Math.min(1, v / 3) - P.mv) * k; P.bob += v * dt * (run ? 2.1 : 2.4);
  }
  function stepNpc(dt, t) {
    for (var i = 0; i < NPC.length; i++) {
      var n = NPC[i];
      if (!n.walk) continue;
      if (n.pause > 0) { n.pause -= dt; continue; }
      var blocked = mode === 'walk' && Math.abs(P.x - n.x) < 0.7 && (P.z - n.z) * n.dir > 0 && (P.z - n.z) * n.dir < 1.3;
      if (!blocked) n.z += n.dir * n.sp * dt;
      n.x += Math.sin(t * 0.3 + n.ph) * 0.12 * dt;
      if (Math.abs(n.z - L / 2) < 4.8 && Math.abs(n.x) < 2.05) n.x += (n.x >= 0 ? 1 : -1) * 2.6 * dt;   // 가운데 디스플레이 비켜 가기
      n.x = clamp(n.x, -2.3, 2.3);
      if (n.z > L - 2) { n.z = L - 2; n.dir = -1; } if (n.z < 2) { n.z = 2; n.dir = 1; }
      if (rnd() < dt * 0.04) n.pause = 1 + rnd() * 3;
    }
  }

  /* =========================================================
     매 프레임
     ========================================================= */
  var visible = false, raf = 0, last = 0, readyTick = 0;
  function kick() { if (!raf) { last = performance.now(); raf = requestAnimationFrame(frame); } }
  function lerp3(a, b, k) { return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k]; }
  function frame(now) {
    raf = 0;
    if (!visible && mode === 'over') return;
    var dt = Math.min(0.05, (now - last) / 1000); last = now; var t = now / 1000;
    if (cv.width !== Math.round(stage.clientWidth * DPR) || cv.height !== Math.round(stage.clientHeight * DPR)) resize();
    if (mode === 'walk') stepWalk(dt);
    stepNpc(dt, t);
    var pose;
    if (anim) {
      var k = Math.min(1, (now - anim.t0) / anim.ms), a = anim.from, b = anim.to();
      var ke = smooth(k), kc = smooth(Math.min(1, k * 1.25));
      var e = lerp3(a.e, b.e, ke); if (mode === 'enter') e[1] += Math.sin(Math.PI * ke) * 6 * (1 - ke);   // 살짝 활공하듯
      pose = { e: e, c: lerp3(a.c, b.c, kc), fov: a.fov + (b.fov - a.fov) * ke, near: a.near + (b.near - a.near) * ke, fog: a.fog + (b.fog - a.fog) * ke, sx: a.sx + (b.sx - a.sx) * ke };
      if (k >= 1) { var dn = anim.done; anim = null; dn(); }
    } else pose = mode === 'walk' ? walkPose() : ovPose(t);
    camE = pose.e;
    var PM = persp(pose.fov, Wd / Hd, pose.near, 900); PM[8] = -(pose.sx || 0);
    VP = mul(PM, lookAt(pose.e, pose.c));
    render(t, pose);
    placeLabels(t);
    if (mode === 'walk') { updPrompt(); if (navI >= 0) buildChevrons(t); }
    else if (mode === 'over' && (++readyTick % 8 === 0)) checkReady();
    raf = requestAnimationFrame(frame);
  }
  function render(t, pose) {
    gl.viewport(0, 0, cv.width, cv.height);
    gl.clearColor(FOG[0], FOG[1], FOG[2], 1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.uniformMatrix4fv(U.uVP, false, VP); gl.uniform3fv(U.uCam, camE); gl.uniform1f(U.uFogD, pose.fog); gl.uniform1f(U.uAlpha, 1);
    // 하늘
    gl.depthMask(false); gl.uniform1f(U.uLit, 0); gl.uniform1f(U.uFogOn, 0);
    bind(G.sky); draw(G.sky, trs(camE[0], camE[1] * 0.2, camE[2], 0, 0, 1));
    gl.depthMask(true); gl.uniform1f(U.uLit, 1); gl.uniform1f(U.uFogOn, 1);
    bind(G.world); draw(G.world);
    // 사람
    bind(G.body);
    var walkers = [];
    for (var i = 0; i < NPC.length; i++) {
      var n = NPC[i], moving = n.walk && n.pause <= 0, ph = t * n.sp * 5.2 + n.ph, yaw = n.walk ? (n.dir > 0 ? 0 : Math.PI) : n.yaw;
      var bob = moving ? Math.abs(Math.sin(ph)) * 0.035 : Math.sin(t * 1.3 + n.ph) * 0.006;
      n.m = trs(n.x, bob, n.z, yaw, 0, n.sc); n.yw = yaw; n.sw = moving ? Math.sin(ph) * 0.5 : 0; n.bb = bob;
      draw(G.body, n.m, n.shirt);
      walkers.push(n);
    }
    bind(G.head); for (var h = 0; h < walkers.length; h++) draw(G.head, walkers[h].m, walkers[h].skin);
    bind(G.leg);
    for (var l = 0; l < walkers.length; l++) {
      var w = walkers[l], cy = Math.cos(w.yw), sy = Math.sin(w.yw), s = w.sc;
      for (var side = -1; side <= 1; side += 2) {
        var hx = 0.1 * side * s;
        draw(G.leg, trs(w.x + cy * hx, (0.84 * s) + w.bb, w.z - sy * hx, w.yw, w.sw * side, s), w.pant);
      }
    }
    // 제품을 쓰는 사람들 (팔·손에 든 물건)
    if (ACTORS.length) {
      var AM = [];
      for (var ai = 0; ai < ACTORS.length; ai++) {
        var o = ACTORS[ai], yw = o.yawF(t), bb = Math.sin(t * 1.3 + o.ph) * 0.008, cyw = Math.cos(yw), syw = Math.sin(yw), sc = o.sc;
        var sh2 = function (lx) { return [o.x + cyw * lx * sc, (1.38 * sc) + bb, o.z - syw * lx * sc]; };
        var sL = sh2(0.23), sR = sh2(-0.23);
        AM.push({ o: o, m: trs(o.x, bb, o.z, yw, 0, sc), L: trs(sL[0], sL[1], sL[2], yw, o.armL(t + o.ph * 0), sc), R: trs(sR[0], sR[1], sR[2], yw, o.armR(t), sc), yw: yw, bb: bb });
      }
      bind(G.body2); AM.forEach(function (a) { draw(G.body2, a.m, a.o.shirt); });
      bind(G.head); AM.forEach(function (a) { draw(G.head, a.m, a.o.skin); });
      bind(G.arm); AM.forEach(function (a) { draw(G.arm, a.L, a.o.shirt); draw(G.arm, a.R, a.o.shirt); });
      bind(G.leg);
      AM.forEach(function (a) {
        var c0 = Math.cos(a.yw), s0 = Math.sin(a.yw), s1 = a.o.sc;
        for (var sd = -1; sd <= 1; sd += 2) { var hx = 0.1 * sd * s1; draw(G.leg, trs(a.o.x + c0 * hx, 0.84 * s1 + a.bb, a.o.z - s0 * hx, a.yw, 0, s1), a.o.pant); }
      });
      AM.forEach(function (a) {
        a.o.props.forEach(function (pp) { bind(G[pp.g]); draw(G[pp.g], pp.on === 'body' ? a.m : pp.on === 'L' ? a.L : a.R, pp.tint ? hex(pp.tint) : [1, 1, 1]); });
      });
    }
    // 제품 마커 (떠서 회전)
    gl.uniform1f(U.uLit, 0);
    bind(G.mark);
    PRODS.forEach(function (p, i) { var y = 4.05 + p.ly + Math.sin(t * 2 + i) * 0.12; draw(G.mark, trs(p.x, y, p.z, t * 1.4, 0, 1.25), [1, 1, 1], [0.08, 0.1, 0.04]); });
    bind(G.ring);
    PRODS.forEach(function (p, i) { var big = mode === 'over' || mode === 'exit'; draw(G.ring, trs(p.x, 0.07, p.z, t * 0.5, 0, (big ? 7.5 + ((t * 0.6 + i * 0.3) % 1) * 4 : 1.6) + Math.sin(t * 2.2 + i) * 0.1), hex(C.accent), big ? [0.2, 0.24, 0.1] : [0, 0, 0]); });
    // 빛기둥 + 바닥 화살표 (반투명)
    gl.enable(gl.BLEND); gl.depthMask(false);
    bind(G.beam);   // 제품 자리 빛기둥 : 걷는 중에도 항상 은은하게 (길 안내 중인 제품은 더 진하게)
    PRODS.forEach(function (p, i) {
      var ov = mode !== 'walk', a = ov ? 0.3 + Math.sin(t * 2 + i) * 0.06 : i === navI ? 0.2 + Math.sin(t * 3) * 0.05 : 0.09 + Math.sin(t * 1.6 + i) * 0.02;
      gl.uniform1f(U.uAlpha, a);
      draw(G.beam, trs(p.x, 0, p.z, 0, 0, ov ? 1.7 : 1), hex(C.accent), [0.15, 0.18, 0.08]);
    });
    if (navI >= 0 && chev.n) { gl.uniform1f(U.uAlpha, 0.92); bind(chev); draw(chev); }
    gl.uniform1f(U.uAlpha, 1); gl.depthMask(true); gl.disable(gl.BLEND);
  }
  function placeLabels(t) {
    var walk = mode === 'walk' || mode === 'enter';
    PRODS.forEach(function (p, i) {
      var y = (walk ? 6.7 : 6.2) + p.ly, v = [p.x, y, p.z, 1], c = [0, 0, 0, 0];
      for (var r = 0; r < 4; r++) c[r] = VP[r] * v[0] + VP[4 + r] * v[1] + VP[8 + r] * v[2] + VP[12 + r];
      var L2 = labs[i], d = Math.hypot(p.x - camE[0], p.z - camE[2]);
      if (navDs[i]) navDs[i].textContent = Math.round(Math.hypot(p.ax - P.x, p.az - P.z)) + 'm';
      var show = c[3] > 0.1 && (!walk || (d < 70 && d > 2.2)) && mode !== 'exit';
      if (!show) { L2.el.style.opacity = 0; return; }
      var sx = (c[0] / c[3] * 0.5 + 0.5) * Wd, sy = (1 - (c[1] / c[3] * 0.5 + 0.5)) * Hd;
      L2.el.style.opacity = walk ? Math.min(1, (70 - d) / 20) : 1;
      L2.el.style.transform = 'translate(' + sx.toFixed(1) + 'px,' + sy.toFixed(1) + 'px) translate(-50%,-100%)';
      L2.ds.textContent = walk ? Math.round(d) + 'm' : '';
    });
    stage.classList.toggle('wk-labwalk', walk);
  }

  /* ---------- 조작 버튼 위치(제목 바로 아래) · 지도에 완전히 들어온 뒤 등장 ---------- */
  var head = document.querySelector('#map .section-head'), sec = document.getElementById('map');
  function placeIntro() {   // 제목 '동묘 벼룩시장 거리 걷기'의 왼쪽 끝 선에 맞춤
    var h2 = head && head.querySelector('.h2'); if (!h2) return;
    stage.style.setProperty('--intro-left', Math.round(h2.getBoundingClientRect().left - stage.getBoundingClientRect().left) + 'px');
  }
  function checkReady() {
    var ready;
    if (sec.classList.contains('dm-portal-next')) {
      var sc = document.querySelector('#dmStatement2 .dm-st-scene'), cs = sc && getComputedStyle(sc);
      ready = wrap.getBoundingClientRect().top <= 2 && (!sc || cs.visibility === 'hidden' || +cs.opacity < 0.05);
    } else { var r = wrap.getBoundingClientRect(); ready = r.top < innerHeight * 0.6 && r.bottom > innerHeight * 0.3; }
    stage.classList.toggle('wk-ready', !!ready);
  }
  // 문장 'ㅁ' 장면이 다음 프레임에 사라지므로, 스크롤 직후 + 두 프레임 뒤에 다시 확인 (스크롤이 멈춘 뒤에도 버튼이 꼭 나타나도록)
  addEventListener('scroll', function () { checkReady(); requestAnimationFrame(function () { requestAnimationFrame(checkReady); }); setTimeout(checkReady, 180); }, { passive: true });
  addEventListener('resize', function () { placeIntro(); checkReady(); });
  setTimeout(function () { placeIntro(); checkReady(); }, 120);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(placeIntro);

  /* ---------- 처음 안내 · 보이는 동안만 그리기 ---------- */
  function hideHint() { stage.classList.add('wk-hinted'); }
  new IntersectionObserver(function (es) { es.forEach(function (e) { visible = e.isIntersecting; if (visible) kick(); }); }, { rootMargin: '100% 0px 100% 0px' }).observe(wrap);
  addEventListener('resize', function () { resize(); kick(); });
  resize(); kick();
  // 첫 프레임을 바로 그려 둠 (문장 'ㅁ' 구멍 속 미리보기용)
  visible = true; frame(performance.now()); visible = false; kick();
  window.DMWalk = { enter: enter, exit: exit, teleport: teleport, startNav: startNav, state: function () { return { mode: mode, P: P, navI: navI, near: near && (near.name || near.i) }; } };
})();
