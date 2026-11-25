/* =============================================================
   dm-gl.js — 2030 DONGMYO MARKET · HERO 3D
   외부 라이브러리·CDN 없이 동작하는 순수 WebGL(1.0) 장면.
   텍스처는 전부 <canvas>에서 직접 그려 만들기 때문에
   file:// 로 열어도 CORS/모듈 오류가 없습니다.
   window.DMHero3D.create(canvas, {mobile}) → {resize, render, dispose}
   ============================================================= */
(function () {
  'use strict';

  function rng(seed) {
    var a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function hex(h) { return [((h >> 16) & 255) / 255, ((h >> 8) & 255) / 255, (h & 255) / 255]; }
  function mul(c, k) { return [c[0] * k, c[1] * k, c[2] * k]; }
  function mix3(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }
  var FONT = "'PretendardLocal','PretendardEmbed','Pretendard','Malgun Gothic','Apple SD Gothic Neo',sans-serif";

  /* 팔레트 (기존 사이트: 아이보리·브라운·뮤트 그린) */
  var AWN = [hex(0xB07260), hex(0x8E9F7B), hex(0xE6DAC4), hex(0x6F7A92), hex(0xB99C62), hex(0x5F6B4C), hex(0xC89C8E), hex(0x4B4E54)];
  var WOOD = hex(0x6B5038), WOOD_D = hex(0x4A3626), WOOD_L = hex(0x9A7B59);
  var CLOTH = [hex(0x7F6A58), hex(0x8E9F7B), hex(0xC9B79B), hex(0x667DAD), hex(0x9B6F5E), hex(0x3F4A42), hex(0xD9CBB2), hex(0x5C5148), hex(0xA2BA75), hex(0xB58A74)];
  var LEAF = [hex(0xB9B45A), hex(0x9CAB59), hex(0xCDB65A), hex(0x839D58), hex(0xA9B05B)];
  var FACADE = [hex(0xE4D8C4), hex(0xC9B79B), hex(0xB8A58F), hex(0xB58A74), hex(0xA9B293), hex(0xD8CCB6)];
  var SKIN = [hex(0xD8B08C), hex(0xC99A78), hex(0xE2BE9E), hex(0xB78560)];

  /* ---------- Batch : 정점 버퍼 빌더 (위치3 · 법선3 · 색3 · uv2 · fx3 = 14 floats) ---------- */
  var STRIDE = 14;
  function Batch() {
    this.d = new Float32Array(1 << 16); this.n = 0;
    this.R = [1, 0, 0, 0, 1, 0, 0, 0, 1]; this.S = [1, 1, 1]; this.T = [0, 0, 0];
  }
  Batch.prototype.xf = function (tx, ty, tz, ry, rx, rz, sx, sy, sz) {
    ry = ry || 0; rx = rx || 0; rz = rz || 0;
    var cy = Math.cos(ry), sy_ = Math.sin(ry), cx = Math.cos(rx), sx_ = Math.sin(rx), cz = Math.cos(rz), sz_ = Math.sin(rz);
    var Ry = [cy, 0, sy_, 0, 1, 0, -sy_, 0, cy], Rx = [1, 0, 0, 0, cx, -sx_, 0, sx_, cx], Rz = [cz, -sz_, 0, sz_, cz, 0, 0, 0, 1];
    function m3(a, b) {
      var o = [];
      for (var i = 0; i < 3; i++) for (var j = 0; j < 3; j++) o[i * 3 + j] = a[i * 3] * b[j] + a[i * 3 + 1] * b[3 + j] + a[i * 3 + 2] * b[6 + j];
      return o;
    }
    this.R = m3(m3(Ry, Rx), Rz);
    this.S = [sx == null ? 1 : sx, sy == null ? 1 : sy, sz == null ? 1 : sz];
    this.T = [tx, ty, tz];
  };
  Batch.prototype.rst = function () { this.R = [1, 0, 0, 0, 1, 0, 0, 0, 1]; this.S = [1, 1, 1]; this.T = [0, 0, 0]; };
  Batch.prototype.v = function (x, y, z, nx, ny, nz, c, u, vv, fx) {
    var R = this.R, S = this.S, T = this.T;
    var X = x * S[0], Y = y * S[1], Z = z * S[2];
    var px = R[0] * X + R[1] * Y + R[2] * Z + T[0], py = R[3] * X + R[4] * Y + R[5] * Z + T[1], pz = R[6] * X + R[7] * Y + R[8] * Z + T[2];
    var Nx = nx / S[0], Ny = ny / S[1], Nz = nz / S[2];
    var qx = R[0] * Nx + R[1] * Ny + R[2] * Nz, qy = R[3] * Nx + R[4] * Ny + R[5] * Nz, qz = R[6] * Nx + R[7] * Ny + R[8] * Nz;
    var l = Math.sqrt(qx * qx + qy * qy + qz * qz) || 1;
    if ((this.n + 1) * STRIDE > this.d.length) { var nd = new Float32Array(this.d.length * 2); nd.set(this.d); this.d = nd; }
    var d = this.d, o = this.n * STRIDE;
    d[o] = px; d[o + 1] = py; d[o + 2] = pz; d[o + 3] = qx / l; d[o + 4] = qy / l; d[o + 5] = qz / l;
    d[o + 6] = c[0]; d[o + 7] = c[1]; d[o + 8] = c[2]; d[o + 9] = u; d[o + 10] = vv;
    d[o + 11] = fx ? fx[0] : 0; d[o + 12] = fx ? fx[1] : 0; d[o + 13] = fx ? (fx[2] == null ? 1 : fx[2]) : 1;
    this.n++;
  };
  var UVP = null;
  Batch.prototype.quad = function (a, b, c, d, col, uv, fx, fxs) {
    var e1x = b[0] - a[0], e1y = b[1] - a[1], e1z = b[2] - a[2], e2x = d[0] - a[0], e2y = d[1] - a[1], e2z = d[2] - a[2];
    var nx = e1y * e2z - e1z * e2y, ny = e1z * e2x - e1x * e2z, nz = e1x * e2y - e1y * e2x;
    var l = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1; nx /= l; ny /= l; nz /= l;
    uv = uv || UVP; var u0 = uv[0], v0 = uv[1], u1 = uv[2], v1 = uv[3];
    var f = fx, g = fxs || fx;
    this.v(a[0], a[1], a[2], nx, ny, nz, col, u0, v1, f);
    this.v(b[0], b[1], b[2], nx, ny, nz, col, u1, v1, f);
    this.v(c[0], c[1], c[2], nx, ny, nz, col, u1, v0, g);
    this.v(a[0], a[1], a[2], nx, ny, nz, col, u0, v1, f);
    this.v(c[0], c[1], c[2], nx, ny, nz, col, u1, v0, g);
    this.v(d[0], d[1], d[2], nx, ny, nz, col, u0, v0, g);
  };
  Batch.prototype.tri = function (a, b, c, col, fx) {
    var e1x = b[0] - a[0], e1y = b[1] - a[1], e1z = b[2] - a[2], e2x = c[0] - a[0], e2y = c[1] - a[1], e2z = c[2] - a[2];
    var nx = e1y * e2z - e1z * e2y, ny = e1z * e2x - e1x * e2z, nz = e1x * e2y - e1y * e2x;
    var l = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1; nx /= l; ny /= l; nz /= l;
    this.v(a[0], a[1], a[2], nx, ny, nz, col, UVP[0], UVP[1], fx);
    this.v(b[0], b[1], b[2], nx, ny, nz, col, UVP[0], UVP[1], fx);
    this.v(c[0], c[1], c[2], nx, ny, nz, col, UVP[0], UVP[1], fx);
  };
  Batch.prototype.box = function (cx, cy, cz, w, h, d, col, o) {
    o = o || {}; var fx = o.fx, uvs = o.uv || {};
    var x0 = cx - w / 2, x1 = cx + w / 2, y0 = cy - h / 2, y1 = cy + h / 2, z0 = cz - d / 2, z1 = cz + d / 2;
    var W = [1, 1, 1];
    this.quad([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], uvs.pz ? W : col, uvs.pz, fx);
    this.quad([x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], uvs.nz ? W : col, uvs.nz, fx);
    this.quad([x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], uvs.px ? W : col, uvs.px, fx);
    this.quad([x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], uvs.nx ? W : col, uvs.nx, fx);
    this.quad([x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0], uvs.py ? W : col, uvs.py, fx);
    if (!o.noBottom) this.quad([x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], col, null, fx);
  };
  Batch.prototype.cyl = function (cx, cy, cz, r0, r1, h, seg, col, fx, caps) {
    var i, a0, a1, y0 = cy - h / 2, y1 = cy + h / 2;
    for (i = 0; i < seg; i++) {
      a0 = i / seg * Math.PI * 2; a1 = (i + 1) / seg * Math.PI * 2;
      var c0 = Math.cos(a0), s0 = Math.sin(a0), c1 = Math.cos(a1), s1 = Math.sin(a1);
      var sl = (r0 - r1) / (h || 1);
      this.v(cx + c0 * r0, y0, cz + s0 * r0, c0, sl, s0, col, UVP[0], UVP[1], fx);
      this.v(cx + c1 * r0, y0, cz + s1 * r0, c1, sl, s1, col, UVP[0], UVP[1], fx);
      this.v(cx + c1 * r1, y1, cz + s1 * r1, c1, sl, s1, col, UVP[0], UVP[1], fx);
      this.v(cx + c0 * r0, y0, cz + s0 * r0, c0, sl, s0, col, UVP[0], UVP[1], fx);
      this.v(cx + c1 * r1, y1, cz + s1 * r1, c1, sl, s1, col, UVP[0], UVP[1], fx);
      this.v(cx + c0 * r1, y1, cz + s0 * r1, c0, sl, s0, col, UVP[0], UVP[1], fx);
      if (caps) {
        this.v(cx, y1, cz, 0, 1, 0, col, UVP[0], UVP[1], fx);
        this.v(cx + c1 * r1, y1, cz + s1 * r1, 0, 1, 0, col, UVP[0], UVP[1], fx);
        this.v(cx + c0 * r1, y1, cz + s0 * r1, 0, 1, 0, col, UVP[0], UVP[1], fx);
      }
    }
  };
  Batch.prototype.sphere = function (cx, cy, cz, r, lat, lon, col, fx, jit, rnd) {
    var i, j, self = this;
    for (i = 0; i < lat; i++) {
      var t0 = i / lat * Math.PI, t1 = (i + 1) / lat * Math.PI;
      for (j = 0; j < lon; j++) {
        var p0 = j / lon * Math.PI * 2, p1 = (j + 1) / lon * Math.PI * 2;
        var k = jit ? 1 + (rnd() - 0.5) * jit : 1, c = k === 1 ? col : mul(col, k);
        var P = function (t, p) { return [Math.sin(t) * Math.cos(p), Math.cos(t), Math.sin(t) * Math.sin(p)]; };
        var A = P(t0, p0), B = P(t0, p1), C = P(t1, p1), D = P(t1, p0);
        var put = function (q) { self.v(cx + q[0] * r, cy + q[1] * r, cz + q[2] * r, q[0], q[1], q[2], c, UVP[0], UVP[1], fx); };
        put(A); put(D); put(C); put(A); put(C); put(B);
      }
    }
  };
  Batch.prototype.torus = function (cx, cy, cz, R, r, s1, s2, col, fx) {
    var i, j, self = this;
    function P(a, b) {
      var ca = Math.cos(a), sa = Math.sin(a), cb = Math.cos(b), sb = Math.sin(b);
      return { p: [cx + (R + r * cb) * ca, cy + r * sb, cz + (R + r * cb) * sa], n: [cb * ca, sb, cb * sa] };
    }
    for (i = 0; i < s1; i++) for (j = 0; j < s2; j++) {
      var a0 = i / s1 * Math.PI * 2, a1 = (i + 1) / s1 * Math.PI * 2, b0 = j / s2 * Math.PI * 2, b1 = (j + 1) / s2 * Math.PI * 2;
      var A = P(a0, b0), B = P(a1, b0), C = P(a1, b1), D = P(a0, b1);
      [A, B, C, A, C, D].forEach(function (q) { self.v(q.p[0], q.p[1], q.p[2], q.n[0], q.n[1], q.n[2], col, UVP[0], UVP[1], fx); });
    }
  };

  /* ---------- 텍스처 아틀라스 (전부 canvas 2D 로 직접 그림 → 외부 이미지 0장) ---------- */
  var AW = 2048, AH = 1024;
  var CELL = {
    white: [0, 0, 16, 16], glow: [32, 0, 128, 128], shad: [176, 0, 128, 128],
    sign: [0, 160, 1024, 256], bnG: [1056, 160, 224, 512], bnC: [1296, 160, 224, 512], board: [1536, 160, 480, 600],
    win: [1056, 700, 256, 256]
  };
  var SIGNS = ['구제의류', '골동품', 'LP · 레코드', '카메라', '전자 · 가전', '고서 · 엽서', '빈티지 시계', '그릇 · 소품'];
  SIGNS.forEach(function (_, i) { CELL['sg' + i] = [(i % 4) * 260, 432 + Math.floor(i / 4) * 108, 256, 96]; });
  var ITEMS = ['camera', 'radio', 'frame1', 'frame2', 'speaker', 'books', 'clock', 'record', 'lamp', 'frame3'];
  ITEMS.forEach(function (n, i) { CELL['it_' + n] = [i * 104, 660, 96, 96]; });

  function uvOf(name) { var c = CELL[name]; return [c[0] / AW, c[1] / AH, (c[0] + c[2]) / AW, (c[1] + c[3]) / AH]; }
  function spaced(ctx, str, cx, y, ls) {
    var w = 0, i, ws = [];
    for (i = 0; i < str.length; i++) { ws[i] = ctx.measureText(str[i]).width; w += ws[i]; }
    w += ls * (str.length - 1);
    var x = cx - w / 2, al = ctx.textAlign; ctx.textAlign = 'left';
    for (i = 0; i < str.length; i++) { ctx.fillText(str[i], x, y); x += ws[i] + ls; }
    ctx.textAlign = al;
  }
  function rrect(ctx, x, y, w, h, r) {
    ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }
  function makeAtlas(mobile) {
    var cv = document.createElement('canvas'), sc = mobile ? 0.5 : 1;
    cv.width = AW * sc; cv.height = AH * sc;
    var ctx = cv.getContext('2d'); ctx.scale(sc, sc);
    ctx.textBaseline = 'middle'; ctx.textAlign = 'center';
    var c, g;
    c = CELL.white; ctx.fillStyle = '#fff'; ctx.fillRect(c[0], c[1], c[2], c[3]);
    c = CELL.glow; g = ctx.createRadialGradient(c[0] + 64, c[1] + 64, 0, c[0] + 64, c[1] + 64, 64);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(.25, 'rgba(255,255,255,.45)'); g.addColorStop(.6, 'rgba(255,255,255,.1)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g; ctx.fillRect(c[0], c[1], 128, 128);
    c = CELL.shad; g = ctx.createRadialGradient(c[0] + 64, c[1] + 64, 0, c[0] + 64, c[1] + 64, 64);
    g.addColorStop(0, 'rgba(40,28,18,.55)'); g.addColorStop(.55, 'rgba(40,28,18,.3)'); g.addColorStop(1, 'rgba(40,28,18,0)');
    ctx.fillStyle = g; ctx.fillRect(c[0], c[1], 128, 128);

    c = CELL.sign; ctx.fillStyle = '#35312F'; ctx.fillRect(c[0], c[1], c[2], c[3]);
    ctx.strokeStyle = 'rgba(236,226,208,.35)'; ctx.lineWidth = 3; ctx.strokeRect(c[0] + 14, c[1] + 14, c[2] - 28, c[3] - 28);
    ctx.fillStyle = '#EFE6D4'; ctx.font = '600 128px ' + FONT; spaced(ctx, '동묘시장', c[0] + 512, c[1] + 108, 46);
    ctx.font = '300 30px ' + FONT; ctx.fillStyle = 'rgba(239,230,212,.78)'; spaced(ctx, 'DONGMYO MARKET', c[0] + 512, c[1] + 206, 16);

    c = CELL.bnG; ctx.fillStyle = '#4C6A52'; ctx.fillRect(c[0], c[1], c[2], c[3]);
    ctx.fillStyle = 'rgba(255,255,255,.08)'; ctx.fillRect(c[0], c[1], c[2], 10);
    banner(ctx, c, '#EDE6D6');
    c = CELL.bnC; ctx.fillStyle = '#EFE6D4'; ctx.fillRect(c[0], c[1], c[2], c[3]);
    ctx.fillStyle = 'rgba(61,46,33,.1)'; ctx.fillRect(c[0], c[1], c[2], 10);
    banner(ctx, c, '#4C6A52', '#3D2E21');

    c = CELL.board; var bx = c[0], by = c[1];
    ctx.fillStyle = '#3C4647'; rrect(ctx, bx, by, c[2], c[3], 22); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.06)'; ctx.fillRect(bx, by, c[2], 6);
    ctx.fillStyle = '#E8E0CF'; ctx.font = '500 34px ' + FONT; ctx.textAlign = 'left'; ctx.fillText('현재 혼잡도', bx + 34, by + 56);
    ctx.fillStyle = '#A2BA75'; [0, 1, 2, 3].forEach(function (i) { ctx.fillRect(bx + 360 + i * 22, by + 66 - 14 - i * 9, 14, 14 + i * 9); });
    ctx.strokeStyle = 'rgba(232,224,207,.28)'; ctx.lineWidth = 2;
    var pts = [[60, 190], [150, 150], [250, 230], [330, 170], [420, 210], [300, 300], [180, 320], [90, 280], [230, 120], [400, 120]];
    pts.forEach(function (p, i) { pts.forEach(function (q, j) { if (j > i && Math.hypot(p[0] - q[0], p[1] - q[1]) < 150) { ctx.beginPath(); ctx.moveTo(bx + p[0], by + p[1]); ctx.lineTo(bx + q[0], by + q[1]); ctx.stroke(); } }); });
    ctx.strokeStyle = '#D9A19A'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(bx + 150, by + 150); ctx.lineTo(bx + 250, by + 230); ctx.lineTo(bx + 300, by + 300); ctx.lineTo(bx + 180, by + 320); ctx.stroke();
    ['#A2BA75', '#D9A19A', '#8FB3B0'].forEach(function (col, i) { ctx.fillStyle = col; var p = pts[[3, 2, 6][i]]; ctx.beginPath(); ctx.arc(bx + p[0], by + p[1], 9, 0, 7); ctx.fill(); });
    var rows = [['A', '구제의류', 'r'], ['B', '전자/가전', 'u'], ['C', '골동품/수집품', 'l']];
    rows.forEach(function (r, i) {
      var y = by + 400 + i * 62;
      ctx.strokeStyle = 'rgba(232,224,207,.18)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(bx + 26, y - 31); ctx.lineTo(bx + c[2] - 26, y - 31); ctx.stroke();
      ctx.strokeStyle = '#E8E0CF'; ctx.lineWidth = 3; arrow(ctx, bx + 52, y, r[2]);
      ctx.fillStyle = '#E8E0CF'; ctx.font = '600 32px ' + FONT; ctx.textAlign = 'left'; ctx.fillText(r[0], bx + 100, y);
      ctx.font = '400 28px ' + FONT; ctx.fillText(r[1], bx + 150, y);
    });

    SIGNS.forEach(function (s, i) {
      var k = CELL['sg' + i], light = i % 2 === 0;
      ctx.fillStyle = light ? '#E9DEC8' : '#5A4331'; ctx.fillRect(k[0], k[1], k[2], k[3]);
      ctx.strokeStyle = light ? 'rgba(61,46,33,.4)' : 'rgba(233,222,200,.45)'; ctx.lineWidth = 3; ctx.strokeRect(k[0] + 7, k[1] + 7, k[2] - 14, k[3] - 14);
      ctx.fillStyle = light ? '#3D2E21' : '#EFE6D4'; ctx.textAlign = 'center'; ctx.font = '600 42px ' + FONT; ctx.fillText(s, k[0] + 128, k[1] + 50, 224);
    });
    drawItems(ctx);

    c = CELL.win; ctx.fillStyle = '#C9C2B4'; ctx.fillRect(c[0], c[1], 256, 256);
    var ix, iy;
    for (iy = 0; iy < 8; iy++) for (ix = 0; ix < 5; ix++) {
      ctx.fillStyle = (ix + iy * 3) % 7 === 0 ? '#E7D7A9' : '#76838F';
      ctx.fillRect(c[0] + 12 + ix * 48, c[1] + 10 + iy * 30, 30, 18);
    }
    return cv;
  }
  function banner(ctx, c, col, col2) {
    var cx = c[0] + c[2] / 2, y = c[1];
    ctx.fillStyle = col; ctx.strokeStyle = col; ctx.lineWidth = 7; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(cx - 62, y + 120); ctx.quadraticCurveTo(cx, y + 88, cx + 62, y + 120); ctx.moveTo(cx - 50, y + 134); ctx.lineTo(cx + 50, y + 134);
    ctx.moveTo(cx - 34, y + 108); ctx.quadraticCurveTo(cx, y + 54, cx + 34, y + 108); ctx.stroke();
    ctx.textAlign = 'center'; ctx.font = '700 40px ' + FONT; ctx.fillStyle = col2 || col;
    ctx.fillText('동묘시장', cx, y + 214); ctx.font = '300 16px ' + FONT; spaced(ctx, 'DONGMYO MARKET', cx, y + 252, 3);
  }
  function arrow(ctx, x, y, d) {
    ctx.beginPath();
    if (d === 'r') { ctx.moveTo(x - 16, y); ctx.lineTo(x + 16, y); ctx.moveTo(x + 6, y - 10); ctx.lineTo(x + 16, y); ctx.lineTo(x + 6, y + 10); }
    if (d === 'l') { ctx.moveTo(x + 16, y); ctx.lineTo(x - 16, y); ctx.moveTo(x - 6, y - 10); ctx.lineTo(x - 16, y); ctx.lineTo(x - 6, y + 10); }
    if (d === 'u') { ctx.moveTo(x, y + 16); ctx.lineTo(x, y - 16); ctx.moveTo(x - 10, y - 6); ctx.lineTo(x, y - 16); ctx.lineTo(x + 10, y - 6); }
    ctx.stroke();
  }
  function drawItems(ctx) {
    function cell(n, bg) { var k = CELL['it_' + n]; ctx.fillStyle = bg; ctx.fillRect(k[0], k[1], 96, 96); return k; }
    var k, i;
    k = cell('camera', '#6B5646'); ctx.fillStyle = '#2E2B29'; ctx.fillRect(k[0] + 10, k[1] + 30, 76, 42); ctx.fillStyle = '#BDB7AA'; ctx.fillRect(k[0] + 10, k[1] + 22, 76, 12);
    ctx.fillStyle = '#1C1B1A'; ctx.beginPath(); ctx.arc(k[0] + 48, k[1] + 54, 19, 0, 7); ctx.fill(); ctx.fillStyle = '#4E5A63'; ctx.beginPath(); ctx.arc(k[0] + 48, k[1] + 54, 11, 0, 7); ctx.fill();
    k = cell('radio', '#5F4A39'); ctx.fillStyle = '#B99C62'; rrect(ctx, k[0] + 8, k[1] + 20, 80, 58, 6); ctx.fill(); ctx.fillStyle = '#3D2E21';
    for (i = 0; i < 6; i++) ctx.fillRect(k[0] + 16, k[1] + 30 + i * 6, 34, 2); ctx.fillStyle = '#EFE6D4'; ctx.beginPath(); ctx.arc(k[0] + 68, k[1] + 40, 8, 0, 7); ctx.fill(); ctx.beginPath(); ctx.arc(k[0] + 68, k[1] + 62, 6, 0, 7); ctx.fill();
    [['frame1', '#C9B79B', '#8E9F7B', '#E7D7A9'], ['frame2', '#6F5441', '#9DB0B8', '#C59A82'], ['frame3', '#3F4A42', '#E4D8C4', '#B07260']].forEach(function (f) {
      k = cell(f[0], '#5A4331'); ctx.fillStyle = f[1]; ctx.fillRect(k[0] + 12, k[1] + 8, 72, 80); ctx.fillStyle = f[2]; ctx.fillRect(k[0] + 20, k[1] + 16, 56, 64);
      ctx.fillStyle = f[3]; ctx.beginPath(); ctx.arc(k[0] + 58, k[1] + 34, 9, 0, 7); ctx.fill(); ctx.fillStyle = 'rgba(40,40,30,.45)'; ctx.beginPath(); ctx.moveTo(k[0] + 20, k[1] + 80); ctx.lineTo(k[0] + 44, k[1] + 46); ctx.lineTo(k[0] + 76, k[1] + 80); ctx.fill();
    });
    k = cell('speaker', '#5A4331'); ctx.fillStyle = '#3B3532'; ctx.fillRect(k[0] + 16, k[1] + 6, 64, 84); ctx.fillStyle = '#85796D'; ctx.beginPath(); ctx.arc(k[0] + 48, k[1] + 34, 18, 0, 7); ctx.fill(); ctx.beginPath(); ctx.arc(k[0] + 48, k[1] + 68, 12, 0, 7); ctx.fill();
    k = cell('books', '#5A4331'); ['#8E9F7B', '#B07260', '#E4D8C4', '#667DAD', '#B99C62', '#5F6B4C', '#C89C8E'].forEach(function (col, j) { ctx.fillStyle = col; ctx.fillRect(k[0] + 8 + j * 11, k[1] + 12 + (j % 3) * 4, 9, 76 - (j % 3) * 4); });
    k = cell('clock', '#5A4331'); ctx.fillStyle = '#EFE6D4'; ctx.beginPath(); ctx.arc(k[0] + 48, k[1] + 48, 34, 0, 7); ctx.fill(); ctx.strokeStyle = '#3D2E21'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(k[0] + 48, k[1] + 48, 34, 0, 7); ctx.stroke(); ctx.beginPath(); ctx.moveTo(k[0] + 48, k[1] + 48); ctx.lineTo(k[0] + 48, k[1] + 26); ctx.moveTo(k[0] + 48, k[1] + 48); ctx.lineTo(k[0] + 64, k[1] + 56); ctx.stroke();
    k = cell('record', '#6B5646'); ctx.fillStyle = '#D9CBB2'; ctx.fillRect(k[0] + 10, k[1] + 10, 76, 76); ctx.fillStyle = '#26231F'; ctx.beginPath(); ctx.arc(k[0] + 48, k[1] + 48, 30, 0, 7); ctx.fill(); ctx.fillStyle = '#B07260'; ctx.beginPath(); ctx.arc(k[0] + 48, k[1] + 48, 10, 0, 7); ctx.fill();
    k = cell('lamp', '#5F4A39'); ctx.fillStyle = '#E7D7A9'; ctx.beginPath(); ctx.moveTo(k[0] + 28, k[1] + 16); ctx.lineTo(k[0] + 68, k[1] + 16); ctx.lineTo(k[0] + 80, k[1] + 56); ctx.lineTo(k[0] + 16, k[1] + 56); ctx.fill(); ctx.fillStyle = '#3D2E21'; ctx.fillRect(k[0] + 45, k[1] + 56, 6, 28); ctx.fillRect(k[0] + 32, k[1] + 82, 32, 6);
  }

  /* ---------- 장면 구성 ---------- */
  var Z_START = 12, Z_END = -41;
  var ARCH_Z = -64;

  function buildScene(mobile) {
    var O = new Batch(), A = new Batch(), G = new Batch();
    var r = rng(2030);
    var EM = function (e, s, a) { return [e || 0, s || 0, a == null ? 1 : a]; };
    var uvSign = uvOf('sign'), uvBnG = uvOf('bnG'), uvBnC = uvOf('bnC'), uvBoard = uvOf('board'), uvWin = uvOf('win'), uvGlow = uvOf('glow'), uvShad = uvOf('shad');
    var pitch = mobile ? 6.6 : 3.3;
    var zFar = -78, zNear = 18;

    function glow(x, y, z, size, col, a) { G.quad([x - size, y - size, z], [x + size, y - size, z], [x + size, y + size, z], [x - size, y + size, z], col, uvGlow, EM(0, 0, a)); }
    function shadowPatch(x, z, w, d, a) { A.quad([x - w / 2, 0.012, z + d / 2], [x + w / 2, 0.012, z + d / 2], [x + w / 2, 0.012, z - d / 2], [x - w / 2, 0.012, z - d / 2], [1, 1, 1], uvShad, EM(0, 0, a)); }
    function wallItem(s, x, y, z, w, h, name) {
      var a = z - s * w / 2, b = z + s * w / 2;
      O.quad([x, y, a], [x, y, b], [x, y + h, b], [x, y + h, a], [1, 1, 1], uvOf(name));
    }

    /* 바닥 */
    var ix, iz;
    for (iz = zFar - 30; iz < zNear; iz += 1.5) for (ix = -3.5; ix < 3.5; ix += 1) {
      var k = 0.86 + r() * 0.12, tone = mix3(hex(0xBDB2A2), hex(0xA89B89), r() * 0.55);
      O.quad([ix + 0.02, 0, iz + 1.48], [ix + 0.98, 0, iz + 1.48], [ix + 0.98, 0, iz + 0.02], [ix + 0.02, 0, iz + 0.02], mul(tone, k));
    }
    O.quad([-3.5, -0.004, zNear], [3.5, -0.004, zNear], [3.5, -0.004, zFar - 30], [-3.5, -0.004, zFar - 30], hex(0x8F8474));
    [-1, 1].forEach(function (s) {
      O.quad([s * 3.5, 0.003, zNear], [s * 9, 0.003, zNear], [s * 9, 0.003, zFar - 40], [s * 3.5, 0.003, zFar - 40], hex(0x978A77));
    });
    A.quad([-0.03, 0.01, zNear], [0.03, 0.01, zNear], [0.03, 0.01, zFar - 30], [-0.03, 0.01, zFar - 30], hex(0xA2BA75), null, EM(0, 0, 0.16));

    /* 노점 */
    var nStall = Math.floor((zNear - zFar) / pitch);
    function stall(s, zc, idx) {
      var w = pitch * 0.9, hw = w / 2, x0 = s * 3.05, xb = s * 5.5;
      var ac = AWN[Math.floor(r() * AWN.length)], striped = r() < 0.4;
      O.box(s * 5.6, 1.5, zc, 0.14, 3.0, w, mul(WOOD_D, 0.9));
      [0.75, 1.35, 1.95].forEach(function (y) {
        O.box(s * 5.3, y, zc, 0.55, 0.05, w - 0.05, WOOD);
        var n = mobile ? 3 : 5, j;
        for (j = 0; j < n; j++) {
          var it = ITEMS[Math.floor(r() * ITEMS.length)], sz = 0.3 + r() * 0.16;
          wallItem(s, s * 5.5, y + 0.03, zc - hw + 0.3 + j * ((w - 0.6) / (n - 1 || 1)), sz, sz * 1.02, 'it_' + it);
        }
      });
      var cc = mix3(AWN[(idx * 3 + 1) % AWN.length], hex(0xE4D8C4), 0.55);
      O.box(s * 3.95, 0.45, zc, 0.85, 0.9, w - 0.2, mul(WOOD_L, 0.82));
      O.box(s * 3.95, 0.92, zc, 0.92, 0.05, w - 0.12, cc);
      var m = mobile ? 4 : 7, q;
      for (q = 0; q < m; q++) {
        var z0 = zc - hw + 0.35 + q * ((w - 0.7) / (m - 1)), kind = r();
        if (kind < 0.5) {
          var nm = ITEMS[Math.floor(r() * ITEMS.length)], bh = 0.22 + r() * 0.12;
          O.box(s * 3.95, 0.945 + bh / 2, z0, 0.32, bh, 0.34, mul(WOOD_L, 0.8 + r() * 0.2), { uv: s > 0 ? { nx: uvOf('it_' + nm) } : { px: uvOf('it_' + nm) } });
        } else {
          var layers = 3 + Math.floor(r() * 3), li;
          for (li = 0; li < layers; li++) O.box(s * 3.95, 0.97 + li * 0.07, z0, 0.42, 0.07, 0.4, CLOTH[Math.floor(r() * CLOTH.length)]);
        }
      }
      [-1, 1].forEach(function (e) { O.cyl(x0 + s * 0.12, 1.25, zc + e * hw, 0.035, 0.035, 2.5, 6, WOOD); });
      var yF = 2.55, yB = 3.5, zL = zc - hw - 0.12, zR = zc + hw + 0.12;
      if (striped) {
        var ns = 6, si;
        for (si = 0; si < ns; si++) {
          var za = zL + (zR - zL) * si / ns, zb = zL + (zR - zL) * (si + 1) / ns, col = si % 2 ? hex(0xE9DFCB) : ac;
          O.quad([x0, yF, za], [x0, yF, zb], [xb, yB, zb], [xb, yB, za], col);
        }
      } else O.quad([x0, yF, zL], [x0, yF, zR], [xb, yB, zR], [xb, yB, zL], ac);
      var sc = 9, vi, vc = striped ? ac : mul(ac, 0.92);
      for (vi = 0; vi < sc; vi++) {
        var za2 = zL + (zR - zL) * vi / sc, zb2 = zL + (zR - zL) * (vi + 1) / sc, zm = (za2 + zb2) / 2;
        O.quad([x0 - s * 0.01, yF - 0.18, za2], [x0 - s * 0.01, yF - 0.18, zb2], [x0 - s * 0.01, yF, zb2], [x0 - s * 0.01, yF, za2], vc, null, EM(0, 0.4));
        O.tri([x0 - s * 0.01, yF - 0.18, za2], [x0 - s * 0.01, yF - 0.18, zb2], [x0 - s * 0.01, yF - 0.3, zm], vc, EM(0, 0.6));
      }
      shadowPatch(s * 4.3, zc, 2.5, w + 0.2, 0.42);
      var sg = 'sg' + ((idx + (s > 0 ? 0 : 3)) % SIGNS.length);
      var sx = x0 + s * 0.02, sz = zc - hw - 0.02;
      var sxa = Math.min(sx, sx + s * 0.9), sxb = Math.max(sx, sx + s * 0.9);
      A.quad([sxa, 1.7, sz], [sxb, 1.7, sz], [sxb, 2.12, sz], [sxa, 2.12, sz], [1, 1, 1], uvOf(sg), EM(0, 0.0, 1));
      if (idx % 3 !== 1) {
        O.box(s * 4.75, 2.1, zc, 0.03, 0.03, w - 0.2, mul(WOOD_D, 1.2));
        var gn = mobile ? 4 : 8, gi;
        for (gi = 0; gi < gn; gi++) {
          var gz = zc - hw + 0.3 + gi * ((w - 0.6) / (gn - 1)), gc = CLOTH[Math.floor(r() * CLOTH.length)], gh = 0.75 + r() * 0.35, gw = 0.4 + r() * 0.12;
          var nxn = s * 0.5, nzn = 0.87, tx = -nzn, tz = nxn;
          var cx = s * 4.75;
          O.quad([cx - tx * gw / 2 * 1.15, 2.05 - gh, gz - tz * gw / 2 * 1.15], [cx + tx * gw / 2 * 1.15, 2.05 - gh, gz + tz * gw / 2 * 1.15], [cx + tx * gw / 2 * 0.55, 2.05, gz + tz * gw / 2 * 0.55], [cx - tx * gw / 2 * 0.55, 2.05, gz - tz * gw / 2 * 0.55], gc, null, EM(0, 0.9), EM(0, 0));
        }
      }
      var bn = mobile ? 2 : 4, bi;
      for (bi = 0; bi < bn; bi++) {
        var bz = zc - hw + 0.25 + bi * ((w - 0.5) / (bn - 1)), by = 2.38;
        O.sphere(x0 + s * 0.35, by, bz, 0.055, 5, 6, hex(0xFFE6B0), EM(1.2, 0));
        glow(x0 + s * 0.35, by, bz + 0.05, 0.42, [1, 0.8, 0.5], 0.5);
      }
      if (idx % 4 === 2) {
        O.box(x0 + s * 0.04, 2.0, zc + hw, 0.07, 0.16, 0.07, hex(0x57595B));
        O.sphere(x0 + s * 0.04, 2.0, zc + hw + 0.04, 0.018, 4, 5, hex(0xA2BA75), EM(1.6, 0));
        glow(x0 + s * 0.04, 2.0, zc + hw + 0.06, 0.2, hex(0xA2BA75), 0.55);
      }
    }
    [-1, 1].forEach(function (s) { for (var i = 0; i < nStall; i++) stall(s, zNear - pitch * (i + 0.5), i + (s > 0 ? 1 : 0)); });

    /* 가로수 */
    var treeStep = mobile ? 14 : 9.5, tz;
    [-1, 1].forEach(function (s) {
      for (tz = zNear - 2; tz > zFar - 40; tz -= treeStep) {
        var jz = tz + (r() - 0.5) * 3, tx = s * (6.8 + r() * 0.5), th = 5 + r() * 1.2;
        O.cyl(tx, th / 2, jz, 0.22, 0.12, th, 7, hex(0x5A4636));
        var cn = mobile ? 7 : 12, ci;
        for (ci = 0; ci < cn; ci++) {
          var ang = r() * 6.283, rad = r() * 2.1, cx2 = tx - s * (0.9 + r() * 1.6) + Math.cos(ang) * rad * 0.7, cy2 = th + 0.8 + r() * 2.6, cz2 = jz + Math.sin(ang) * rad;
          O.sphere(cx2, cy2, cz2, 1.05 + r() * 0.8, 7, 10, LEAF[Math.floor(r() * LEAF.length)], EM(0, 1, 1), 0.14, r);
        }
      }
    });

    /* 센서 기둥 · 배너 */
    var pStep = pitch * 4, pz;
    [-1, 1].forEach(function (s) {
      for (pz = zNear - pitch; pz > zFar; pz -= pStep) {
        var px = s * 2.93, jp = pz;
        O.cyl(px, 2.6, jp, 0.055, 0.055, 5.2, 8, hex(0x8D8A85));
        O.cyl(px, 0.12, jp, 0.12, 0.09, 0.24, 8, hex(0x6F6C68));
        O.box(px - s * 0.1, 5.22, jp, 0.2, 0.1, 0.12, hex(0x4A4A4C));
        O.sphere(px - s * 0.2, 5.26, jp + 0.04, 0.22, 7, 9, hex(0x34363A));
        O.sphere(px - s * 0.2, 5.18, jp + 0.2, 0.11, 6, 8, hex(0x0F1012));
        O.sphere(px - s * 0.2, 5.2, jp + 0.27, 0.035, 4, 5, hex(0x6F7C86), EM(0.2, 0));
        O.xf(px, 4.55, jp, 0, 0, 0, 1, 1, 1);
        O.torus(0, 0, 0, 0.11, 0.012, 20, 5, hex(0xA2BA75), EM(1.7, 0)); O.rst();
        glow(px, 4.56, jp + 0.1, 0.5, hex(0xA2BA75), 0.45);
        O.box(px, 3.9, jp, 0.2, 0.34, 0.16, hex(0x56595C)); O.box(px, 3.9, jp + 0.081, 0.12, 0.2, 0.002, hex(0x2E3236));
        O.sphere(px, 4.02, jp + 0.09, 0.016, 4, 5, hex(0xA2BA75), EM(1.7, 0));
        var bw = 0.5, bh = 1.3, bxx = px - s * 0.42, byy = 2.9, isG = ((Math.round(jp / pStep)) % 2 === 0);
        O.box(px - s * 0.2, byy + bh + 0.02, jp, 0.5, 0.025, 0.025, hex(0x6F6C68));
        O.quad([bxx - bw / 2, byy, jp + 0.02], [bxx + bw / 2, byy, jp + 0.02], [bxx + bw / 2, byy + bh, jp + 0.02], [bxx - bw / 2, byy + bh, jp + 0.02], [1, 1, 1], isG ? uvBnG : uvBnC, EM(0, 0.5), EM(0, 0));
      }
    });

    /* 혼잡도 안내판 */
    (function () {
      var bz = -7.5, bx = 3.0;
      O.cyl(bx + 0.55, 1.6, bz, 0.05, 0.05, 3.2, 8, hex(0x6F6C68));
      O.xf(bx, 2.1, bz, -0.55, 0, 0, 1, 1, 1);
      O.quad([-0.62, -0.78, 0], [0.62, -0.78, 0], [0.62, 0.78, 0], [-0.62, 0.78, 0], [1, 1, 1], uvBoard, EM(0.28, 0));
      O.rst();
    })();

    /* 건물 */
    [-1, 1].forEach(function (s) {
      var bz2 = zNear + 4;
      while (bz2 > zFar - 40) {
        var bw2 = 6 + r() * 6, bh2 = 7 + r() * 6, fc = FACADE[Math.floor(r() * FACADE.length)], cxx = s * (9.8 + r() * 0.6), zc2 = bz2 - bw2 / 2;
        O.box(cxx + s * 3, bh2 / 2, zc2, 6, bh2, bw2 - 0.3, fc);
        var fx0 = cxx - s * 0.002, rows = Math.floor(bh2 / 3), rw;
        O.box(cxx - s * 0.1, 3.6, zc2, 0.25, 0.5, bw2 - 0.3, mul(fc, 0.78));
        for (rw = 1; rw <= rows; rw++) {
          var wn = Math.floor((bw2 - 1) / 1.6), wi;
          for (wi = 0; wi < wn; wi++) {
            var wz = zc2 - (bw2 - 0.3) / 2 + 0.9 + wi * 1.6, wy = 3.9 + rw * 2.5 - 1.2;
            O.quad(s > 0 ? [fx0, wy, wz - 0.5] : [fx0, wy, wz + 0.5], s > 0 ? [fx0, wy, wz + 0.5] : [fx0, wy, wz - 0.5], s > 0 ? [fx0, wy + 1.15, wz + 0.5] : [fx0, wy + 1.15, wz - 0.5], s > 0 ? [fx0, wy + 1.15, wz - 0.5] : [fx0, wy + 1.15, wz + 0.5], hex(0x6C7782), null, EM(r() < 0.12 ? 0.35 : 0, 0));
          }
        }
        bz2 -= bw2;
      }
    });

    /* 가로질러 걸린 전구 줄 */
    var lz;
    for (lz = zNear - 6; lz > ARCH_Z + 4; lz -= (mobile ? 30 : 15)) {
      var n2 = 15, li2;
      for (li2 = 0; li2 < n2; li2++) {
        var t = li2 / (n2 - 1), lx = -3 + 6 * t, ly = 4.75 - Math.sin(t * Math.PI) * 0.45;
        O.sphere(lx, ly, lz, 0.05, 4, 6, hex(0xFFE6B0), EM(1.2, 0));
        if (li2 % 2 === 0) glow(lx, ly, lz + 0.04, 0.38, [1, 0.82, 0.55], 0.4);
        if (li2 < n2 - 1) { var t2 = (li2 + 1) / (n2 - 1), lx2 = -3 + 6 * t2, ly2 = 4.75 - Math.sin(t2 * Math.PI) * 0.45; O.quad([lx, ly - 0.01, lz], [lx2, ly2 - 0.01, lz], [lx2, ly2 + 0.01, lz], [lx, ly + 0.01, lz], hex(0x3A322C)); }
      }
    }

    /* 보행자 (등을 보이며 걷는 단순한 형태) */
    var np = mobile ? 6 : 16, pi2;
    for (pi2 = 0; pi2 < np; pi2++) {
      var side = r() < 0.5 ? -1 : 1, ppx = side * (1.55 + r() * 1.1), ppz = 8.5 - r() * (8.5 - ARCH_Z - 8), hgt = 1.55 + r() * 0.25;
      var jc = CLOTH[Math.floor(r() * CLOTH.length)], pc = mul(hex(0x4A4A52), 0.8 + r() * 0.4), sk = SKIN[Math.floor(r() * SKIN.length)];
      O.cyl(ppx - 0.09, hgt * 0.24, ppz, 0.075, 0.06, hgt * 0.48, 6, pc); O.cyl(ppx + 0.09, hgt * 0.24, ppz + 0.03, 0.075, 0.06, hgt * 0.48, 6, pc);
      O.cyl(ppx, hgt * 0.7, ppz, 0.2, 0.17, hgt * 0.42, 8, jc);
      O.sphere(ppx, hgt * 0.94, ppz, 0.115, 6, 8, sk);
      O.sphere(ppx, hgt * 0.97, ppz - 0.02, 0.12, 5, 8, mul(hex(0x3A2F28), 0.8 + r() * 0.5));
      if (r() < 0.45) O.box(ppx, hgt * 0.72, ppz + 0.17, 0.3, 0.38, 0.14, mul(CLOTH[Math.floor(r() * CLOTH.length)], 0.8));
      shadowPatch(ppx, ppz, 0.7, 0.5, 0.3);
    }

    /* 동묘시장 입구 아치 */
    (function () {
      var z = ARCH_Z, hwid = 6.4, pillar = hex(0x5A5654);
      [-1, 1].forEach(function (s) { O.box(s * (hwid + 0.45), 3.4, z, 0.9, 6.8, 2.4, pillar); });
      O.box(0, 5.15, z, hwid * 2 + 0.3, 3.0, 0.7, hex(0x35312F), { uv: { pz: uvSign } });
      var nr = 9, i, j, seg = 22, rise = 3.6, baseY = 6.8, depth = 4.2;
      function arc(t, zz) { var x = (t * 2 - 1) * (hwid + 0.4), y = baseY + rise * (1 - Math.pow(t * 2 - 1, 2)); return [x, y, zz]; }
      for (i = 0; i < seg; i++) {
        var t0 = i / seg, t1 = (i + 1) / seg;
        var a0 = arc(t0, z + depth / 2), a1 = arc(t1, z + depth / 2), b0 = arc(t0, z - depth / 2), b1 = arc(t1, z - depth / 2);
        A.quad(b0, b1, a1, a0, [0.78, 0.86, 0.9], null, EM(0.15, 0, 0.32));
        O.quad([a0[0], a0[1] - 0.14, a0[2]], [a1[0], a1[1] - 0.14, a1[2]], [a1[0], a1[1] + 0.14, a1[2]], [a0[0], a0[1] + 0.14, a0[2]], hex(0xE7E3DA));
        O.quad([b0[0], b0[1] - 0.12, b0[2]], [b1[0], b1[1] - 0.12, b1[2]], [b1[0], b1[1] + 0.12, b1[2]], [b0[0], b0[1] + 0.12, b0[2]], hex(0xD5D0C6));
      }
      for (j = 0; j <= nr; j++) {
        var tt = j / nr, p0 = arc(tt, z + depth / 2), p1 = arc(tt, z - depth / 2);
        O.quad([p0[0] - 0.05, p0[1], p0[2]], [p0[0] + 0.05, p0[1], p0[2]], [p1[0] + 0.05, p1[1], p1[2]], [p1[0] - 0.05, p1[1], p1[2]], hex(0xEDE9E0));
      }
      O.box(0, 6.72, z, hwid * 2 + 0.3, 0.24, 0.8, hex(0x4A4745));
      [-1, 1].forEach(function (s) { O.quad([s * 5 - 0.3, 3.2, z + 1.3], [s * 5 + 0.3, 3.2, z + 1.3], [s * 5 + 0.3, 4.6, z + 1.3], [s * 5 - 0.3, 4.6, z + 1.3], [1, 1, 1], uvBnG, EM(0, 0.5), EM(0, 0)); });
      shadowPatch(0, z + 1.5, 10, 4, 0.18);
    })();

    /* 먼 풍경 */
    (function () {
      var far = [[-18, -118, 15, 34], [-5, -124, 16, 40], [10, -121, 14, 30], [24, -128, 16, 38], [-32, -130, 14, 26], [38, -122, 14, 24]];
      far.forEach(function (f, i2) {
        O.box(f[0], f[3] / 2, f[1], f[2], f[3], 10, mix3(hex(0xCFC8B9), hex(0xB9C0C2), i2 / 6), { uv: { pz: uvWin } });
      });
      O.xf(6, -4, -178, 0, 0, 0, 120, 38, 40); O.sphere(0, 0, 0, 1, 7, 12, hex(0x7E8F73), null, 0.1, r); O.rst();
      O.xf(-60, -4, -170, 0, 0, 0, 80, 30, 30); O.sphere(0, 0, 0, 1, 7, 12, hex(0x8A9A7D), null, 0.1, r); O.rst();
      var nx = 22, nz = -172, ny = 44;
      O.cyl(nx, ny + 18, nz, 0.9, 1.5, 36, 8, hex(0xC9C4B8)); O.cyl(nx, ny + 38, nz, 3.6, 3.6, 2.4, 10, hex(0xD8D3C6), null, true); O.cyl(nx, ny + 46, nz, 0.1, 0.5, 14, 6, hex(0xC9C4B8));
    })();

    return { O: O, A: A, G: G };
  }

  /* ---------- 셰이더 ---------- */
  var VS = [
    'attribute vec3 aPos;attribute vec3 aNrm;attribute vec3 aCol;attribute vec2 aUv;attribute vec3 aFx;',
    'uniform mat4 uVP;uniform vec3 uCam;uniform float uTime;uniform float uSway;',
    'varying vec3 vN;varying vec3 vC;varying vec2 vUv;varying vec3 vFx;varying float vD;',
    'void main(){vec3 p=aPos;float sw=aFx.y*uSway;',
    ' p.x+=sw*sin(uTime*1.1+aPos.z*0.6+aPos.y)*0.045;p.z+=sw*sin(uTime*0.9+aPos.x*0.8)*0.03;',
    ' vN=aNrm;vC=aCol;vUv=aUv;vFx=aFx;vec3 d=p-uCam;vD=length(d);gl_Position=uVP*vec4(d,1.0);}'
  ].join('\n');
  var FS = [
    '#ifdef GL_FRAGMENT_PRECISION_HIGH',
    'precision highp float;',
    '#else',
    'precision mediump float;',
    '#endif',
    'uniform sampler2D uTex;uniform vec3 uSun;uniform vec3 uSunCol;uniform vec3 uSky;uniform vec3 uGnd;uniform vec3 uFog;uniform float uFogD;uniform float uMode;',
    'varying vec3 vN;varying vec3 vC;varying vec2 vUv;varying vec3 vFx;varying float vD;',
    'void main(){vec4 t=texture2D(uTex,vUv);vec3 alb=vC*t.rgb;',
    ' vec3 n=normalize(gl_FrontFacing?vN:-vN);',
    ' float ndl=max(dot(n,uSun),0.0);vec3 hemi=mix(uGnd,uSky,n.y*0.5+0.5);',
    ' vec3 lit=alb*(hemi+uSunCol*ndl);',
    ' lit+=vC*t.rgb*vFx.x;',
    ' float f=1.0-exp(-vD*uFogD);f=clamp(f,0.0,0.92);',
    ' float lum=dot(lit,vec3(0.299,0.587,0.114));lit=mix(vec3(lum),lit,0.9);',
    ' float a=1.0;',
    ' if(uMode>0.5){a=t.a*vFx.z;if(a<0.01)discard;}',
    ' if(uMode>1.5){gl_FragColor=vec4(lit*(1.0-f*0.8),a);return;}',
    ' lit=mix(lit,uFog,f);gl_FragColor=vec4(lit,a);}'
  ].join('\n');
  var SVS = 'attribute vec2 p;varying vec2 uv;void main(){uv=p*0.5+0.5;gl_Position=vec4(p,0.9999,1.0);}';
  var SFS = [
    'precision mediump float;varying vec2 uv;uniform vec3 uTop;uniform vec3 uHor;uniform float uVp;uniform float uAsp;uniform float uTime;',
    'float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}',
    'float nz(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y);}',
    'void main(){float t=clamp((uv.y-uVp)/(1.0-uVp),0.0,1.0);vec3 c=mix(uHor,uTop,pow(t,0.65));',
    ' float n=nz(vec2(uv.x*uAsp*1.6+uTime*0.004,uv.y*3.2))*0.6+nz(vec2(uv.x*uAsp*3.6,uv.y*7.0))*0.4;',
    ' c=mix(c,vec3(0.99,0.97,0.93),smoothstep(0.52,0.82,n)*0.42*smoothstep(0.02,0.3,t)*(1.0-t*0.35));',
    ' gl_FragColor=vec4(c,1.0);}'
  ].join('\n');

  function sh(gl, type, src) {
    var s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error('shader: ' + gl.getShaderInfoLog(s));
    return s;
  }
  function prog(gl, vs, fs) {
    var p = gl.createProgram(); gl.attachShader(p, sh(gl, gl.VERTEX_SHADER, vs)); gl.attachShader(p, sh(gl, gl.FRAGMENT_SHADER, fs)); gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error('link: ' + gl.getProgramInfoLog(p));
    return p;
  }

  /* ---------- 공개 API ---------- */
  function create(canvas, opt) {
    opt = opt || {};
    var mobile = !!opt.mobile;
    var aa = !mobile && opt.aa !== false;
    var gl = canvas.getContext('webgl', { antialias: aa, alpha: false, powerPreference: 'high-performance', preserveDrawingBuffer: !!opt.preserve }) ||
      canvas.getContext('experimental-webgl', { antialias: aa, alpha: false });
    if (!gl) throw new Error('nogl');

    var atlas = makeAtlas(mobile);
    var wuv = uvOf('white'); UVP = [(wuv[0] + wuv[2]) / 2, (wuv[1] + wuv[3]) / 2];
    var scene = buildScene(mobile);

    var P = prog(gl, VS, FS), SP = prog(gl, SVS, SFS);
    var U = {}, SU = {};
    ['uVP', 'uCam', 'uTime', 'uSway', 'uTex', 'uSun', 'uSunCol', 'uSky', 'uGnd', 'uFog', 'uFogD', 'uMode'].forEach(function (n) { U[n] = gl.getUniformLocation(P, n); });
    ['uTop', 'uHor', 'uVp', 'uAsp', 'uTime'].forEach(function (n) { SU[n] = gl.getUniformLocation(SP, n); });
    var AT = { pos: gl.getAttribLocation(P, 'aPos'), nrm: gl.getAttribLocation(P, 'aNrm'), col: gl.getAttribLocation(P, 'aCol'), uv: gl.getAttribLocation(P, 'aUv'), fx: gl.getAttribLocation(P, 'aFx') };

    var tex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, atlas);
    var pot = (atlas.width & (atlas.width - 1)) === 0 && (atlas.height & (atlas.height - 1)) === 0;
    if (pot) { gl.generateMipmap(gl.TEXTURE_2D); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR); }
    else gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    var aniso = gl.getExtension('EXT_texture_filter_anisotropic');
    if (aniso) gl.texParameterf(gl.TEXTURE_2D, aniso.TEXTURE_MAX_ANISOTROPY_EXT, Math.min(4, gl.getParameter(aniso.MAX_TEXTURE_MAX_ANISOTROPY_EXT)));

    function upload(b) {
      var buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, b.d.subarray(0, b.n * STRIDE), gl.STATIC_DRAW);
      return { buf: buf, n: b.n };
    }
    var BO = upload(scene.O), BA = upload(scene.A), BG = upload(scene.G);
    scene = null;
    var sbuf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, sbuf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);

    var W = 1, H = 1, aspect = 1;
    var VP = new Float32Array(16);
    var HOR = [0.93, 0.9, 0.83], TOP = [0.71, 0.79, 0.84], VPY = opt.vpY == null ? 0.12 : opt.vpY;

    function resize(w, h, dpr) {
      W = Math.max(2, Math.round(w * dpr)); H = Math.max(2, Math.round(h * dpr)); aspect = W / H;
      canvas.width = W; canvas.height = H; gl.viewport(0, 0, W, H);
    }
    function persp() {
      var fovY = aspect >= 1.4 ? 50 * Math.PI / 180 : Math.min(2.0, 2 * Math.atan(Math.tan(25 * Math.PI / 180) * 1.4 / aspect));
      var f = 1 / Math.tan(fovY / 2), n = 0.3, fa = 420;
      var m = VP; for (var i = 0; i < 16; i++) m[i] = 0;
      m[0] = f / aspect; m[5] = f; m[10] = (fa + n) / (n - fa); m[11] = -1; m[14] = 2 * fa * n / (n - fa);
      m[9] = -VPY;
    }
    function bind(b) {
      gl.bindBuffer(gl.ARRAY_BUFFER, b.buf);
      var S4 = STRIDE * 4;
      gl.enableVertexAttribArray(AT.pos); gl.vertexAttribPointer(AT.pos, 3, gl.FLOAT, false, S4, 0);
      gl.enableVertexAttribArray(AT.nrm); gl.vertexAttribPointer(AT.nrm, 3, gl.FLOAT, false, S4, 12);
      gl.enableVertexAttribArray(AT.col); gl.vertexAttribPointer(AT.col, 3, gl.FLOAT, false, S4, 24);
      gl.enableVertexAttribArray(AT.uv); gl.vertexAttribPointer(AT.uv, 2, gl.FLOAT, false, S4, 36);
      gl.enableVertexAttribArray(AT.fx); gl.vertexAttribPointer(AT.fx, 3, gl.FLOAT, false, S4, 44);
    }
    function render(p, time) {
      p = Math.min(1, Math.max(0, p));
      var e = p * 0.78 + (p * p * (3 - 2 * p)) * 0.22;
      var camZ = Z_START + (Z_END - Z_START) * e, camX = Math.sin(p * 9) * 0.07, camY = 1.64 + Math.sin(p * 46) * 0.012;
      persp();

      gl.disable(gl.DEPTH_TEST); gl.disable(gl.BLEND); gl.disable(gl.CULL_FACE);
      gl.useProgram(SP); gl.bindBuffer(gl.ARRAY_BUFFER, sbuf);
      var sp = gl.getAttribLocation(SP, 'p'); gl.enableVertexAttribArray(sp); gl.vertexAttribPointer(sp, 2, gl.FLOAT, false, 0, 0);
      gl.uniform3fv(SU.uTop, TOP); gl.uniform3fv(SU.uHor, HOR); gl.uniform1f(SU.uVp, 0.5 + VPY * 0.5); gl.uniform1f(SU.uAsp, aspect); gl.uniform1f(SU.uTime, time);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      gl.disableVertexAttribArray(sp);

      gl.useProgram(P);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, tex); gl.uniform1i(U.uTex, 0);
      gl.uniformMatrix4fv(U.uVP, false, VP);
      gl.uniform3f(U.uCam, camX, camY, camZ);
      gl.uniform1f(U.uTime, time); gl.uniform1f(U.uSway, mobile || opt.still ? 0 : 1);
      gl.uniform3f(U.uSun, -0.16, 0.62, 0.77); gl.uniform3f(U.uSunCol, 0.62, 0.55, 0.42);
      gl.uniform3f(U.uSky, 0.62, 0.64, 0.66); gl.uniform3f(U.uGnd, 0.42, 0.36, 0.3);
      gl.uniform3f(U.uFog, 0.87, 0.85, 0.79); gl.uniform1f(U.uFogD, 0.0034);

      gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL); gl.depthMask(true);
      gl.uniform1f(U.uMode, 0); bind(BO); gl.drawArrays(gl.TRIANGLES, 0, BO.n);

      gl.enable(gl.BLEND); gl.depthMask(false);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      gl.uniform1f(U.uMode, 1); bind(BA); gl.drawArrays(gl.TRIANGLES, 0, BA.n);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
      gl.uniform1f(U.uMode, 2); bind(BG); gl.drawArrays(gl.TRIANGLES, 0, BG.n);
      gl.depthMask(true); gl.disable(gl.BLEND);
    }
    return {
      resize: resize, render: render,
      stats: { verts: BO.n + BA.n + BG.n },
      dispose: function () { var x = gl.getExtension('WEBGL_lose_context'); if (x) x.loseContext(); }
    };
  }

  window.DMHero3D = { create: create };
})();
