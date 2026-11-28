/* dm-features.js — PLACE FEATURES : 세로 스트립 호버 모션 + 카드 상세
   스크롤 로직과 완전히 분리되어 있습니다. */
(function () {
  'use strict';
  var sec = document.getElementById('features');
  if (!sec) return;
  var list = sec.querySelector('.fx-list');
  var items = [].slice.call(list.querySelectorAll('.fx-item'));
  var n = items.length;
  var rows = items.map(function (li) { return li.querySelector('.fx-row'); });
  var ins = items.map(function (li) { return li.querySelector('.fx-in'); });
  var reduce = matchMedia('(prefers-reduced-motion: reduce)');
  var fine = matchMedia('(hover: hover) and (pointer: fine)');

  /* ================= 호버 모션 (세로 피시아이 + 원근) =================
     포인터와 가까운 줄일수록 키가 커지고(나머지는 줄어듦) 앞으로 나오며 글자가 커지고,
     멀어질수록 어둡고 기울어집니다. 가로 스트립을 세로로 돌린 형태입니다. */
  var live = false, H = 0, rest = 0;
  var target = 0.5, py = 0.5, act = 0, actT = 0, raf = 0, focusI = -1;
  var SIGMA = 1.15, AMP = 1.25;

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

  function measure() { H = list.clientHeight; rest = H / n; }

  function frame() {
    raf = 0;
    var kp = 1 - Math.exp(-16 * 0.016), ka = 1 - Math.exp(-7 * 0.016);
    py += (target - py) * kp;
    act += (actT - act) * ka;
    var ppx = py * H, w = [], m = [], sum = 0, i;
    for (i = 0; i < n; i++) {
      var d = ((i + 0.5) * rest - ppx) / (rest * SIGMA);
      w[i] = Math.exp(-d * d) * act;
      m[i] = 1 + AMP * w[i];
      sum += m[i];
    }
    var y = 0;
    for (i = 0; i < n; i++) {
      var h = H * m[i] / sum, c = y + h / 2;
      var dd = (c - ppx) / rest;
      var tilt = -clamp(dd, -3, 3) * 3.2 * act;
      var z = w[i] * 70;
      var dim = 1 - act * (1 - (0.34 + 0.66 * clamp(w[i] / Math.max(act, 0.0001), 0, 1)));
      var it = items[i];
      it.style.height = h.toFixed(2) + 'px';
      it.style.transform = 'translate3d(' + (w[i] * -14).toFixed(2) + 'px,' + y.toFixed(2) + 'px,' + z.toFixed(1) + 'px) rotateX(' + tilt.toFixed(2) + 'deg)';
      it.style.opacity = dim.toFixed(3);
      it.style.zIndex = String(10 + Math.round(w[i] * 10));
      rows[i].style.setProperty('--w', w[i].toFixed(3));
      ins[i].style.transform = 'scale(' + (1 + 0.16 * w[i]).toFixed(3) + ') translateX(' + (w[i] * 10).toFixed(1) + 'px)';
      y += h;
    }
    if (Math.abs(target - py) > 0.0008 || Math.abs(actT - act) > 0.002) raf = requestAnimationFrame(frame);
  }
  function kick() { if (!raf && live) raf = requestAnimationFrame(frame); }

  function onMove(e) {
    if (!live || e.pointerType === 'touch') return;
    var r = list.getBoundingClientRect();
    target = clamp((e.clientY - r.top) / r.height, 0, 1);
    if (actT === 0) py = target;
    actT = 1; focusI = -1; kick();
  }
  function onLeave() { if (!live) return; actT = 0; kick(); }
  function onFocusIn(e) {
    if (!live) return;
    var li = e.target.closest('.fx-item'); if (!li) return;
    focusI = items.indexOf(li);
    target = (focusI + 0.5) / n; actT = 1; kick();
  }
  function onFocusOut() { if (live && focusI >= 0) { actT = 0; focusI = -1; kick(); } }

  function setLive(on) {
    if (on === live) return;
    live = on;
    list.classList.toggle('fx-live', on);
    if (on) {
      measure(); target = py = 0.5; act = actT = 0; frame();
    } else {
      cancelAnimationFrame(raf); raf = 0;
      items.forEach(function (it, i) {
        it.style.cssText = ''; ins[i].style.cssText = ''; rows[i].style.removeProperty('--w');
      });
    }
  }
  function applyMode() {
    var on = !reduce.matches && fine.matches && innerWidth > 1024;
    setLive(on);
    if (on) { measure(); cancelAnimationFrame(raf); raf = 0; frame(); }
  }
  list.addEventListener('pointermove', onMove);
  list.addEventListener('pointerenter', onMove);
  list.addEventListener('pointerleave', onLeave);
  list.addEventListener('focusin', onFocusIn);
  list.addEventListener('focusout', onFocusOut);
  addEventListener('resize', applyMode);
  if (reduce.addEventListener) { reduce.addEventListener('change', applyMode); fine.addEventListener('change', applyMode); }

  /* ================= 카드 상세 ================= */
  var modal = document.getElementById('fxModal');
  var card = modal.querySelector('.fx-card');
  var cnt = modal.querySelector('.fx-count');
  var btnClose = modal.querySelector('.fx-close');
  var btnPrev = modal.querySelector('.fx-prev');
  var btnNext = modal.querySelector('.fx-next');
  var cur = -1, opener = null, busy = false, isOpen = false;

  function fill(i) {
    card.innerHTML = items[i].querySelector('.fx-full').innerHTML;
    cnt.textContent = ('0' + (i + 1)).slice(-2) + ' / ' + ('0' + n).slice(-2);
    cur = i;
  }
  function open(i) {
    if (isOpen) return;
    isOpen = true; opener = rows[i];
    fill(i);
    modal.hidden = false; modal.setAttribute('aria-hidden', 'false');
    card.style.transition = 'none';
    var rr = rows[i].getBoundingClientRect();
    card.style.transform = 'none';
    var cr = card.getBoundingClientRect();
    if (!reduce.matches) {
      var s = clamp(rr.width / cr.width, 0.5, 1);
      var dx = (rr.left + rr.width / 2) - (cr.left + cr.width / 2);
      var dy = (rr.top + rr.height / 2) - (cr.top + cr.height / 2);
      card.style.transform = 'translate3d(' + dx.toFixed(1) + 'px,' + dy.toFixed(1) + 'px,0) scale(' + s.toFixed(3) + ')';
    }
    void card.offsetWidth;
    card.style.transition = '';
    modal.classList.add('open');
    card.style.transform = 'none';
    setTimeout(function () { btnClose.focus({ preventScroll: true }); }, 60);
  }
  function close() {
    if (!isOpen) return;
    isOpen = false;
    modal.classList.remove('open'); modal.setAttribute('aria-hidden', 'true');
    var rr = rows[cur].getBoundingClientRect(), cr = card.getBoundingClientRect();
    if (!reduce.matches) {
      var s = clamp(rr.width / cr.width, 0.5, 1);
      card.style.transform = 'translate3d(' + ((rr.left + rr.width / 2) - (cr.left + cr.width / 2)).toFixed(1) + 'px,' + ((rr.top + rr.height / 2) - (cr.top + cr.height / 2)).toFixed(1) + 'px,0) scale(' + s.toFixed(3) + ')';
    }
    setTimeout(function () { if (!isOpen) modal.hidden = true; }, 560);
    var o = rows[cur] || opener;
    if (o) o.focus({ preventScroll: true });
  }
  function go(dir) {
    if (!isOpen || busy) return;
    busy = true;
    var next = (cur + dir + n) % n;
    card.classList.add('swap-out');
    setTimeout(function () {
      fill(next);
      card.classList.remove('swap-out'); card.classList.add('swap-in');
      void card.offsetWidth;
      card.classList.remove('swap-in');
      setTimeout(function () { busy = false; }, 420);
    }, reduce.matches ? 0 : 320);
  }

  rows.forEach(function (r, i) { r.addEventListener('click', function () { open(i); }); });
  btnClose.addEventListener('click', close);
  modal.querySelector('.fx-backdrop').addEventListener('click', close);
  modal.addEventListener('click', function (e) { if (e.target === modal) close(); });
  btnPrev.addEventListener('click', function () { go(-1); });
  btnNext.addEventListener('click', function () { go(1); });
  document.addEventListener('keydown', function (e) {
    if (!isOpen) return;
    if (e.key === 'Escape') { e.preventDefault(); close(); }
    else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); go(1); }
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); go(-1); }
    else if (e.key === 'Tab') {
      var f = [btnClose, btnPrev, btnNext], k = f.indexOf(document.activeElement);
      e.preventDefault();
      f[(k + (e.shiftKey ? -1 : 1) + 3) % 3].focus();
    }
  });
  /* 모달이 열려 있는 동안 뒤 화면이 스크롤되지 않게 */
  function stop(e) { if (isOpen) e.preventDefault(); }
  addEventListener('wheel', stop, { passive: false });
  addEventListener('touchmove', stop, { passive: false });

  /* ================= 왼쪽 글자 : 스크롤 진행에 맞춰 한 줄씩 우 → 좌 ================= */
  (function () {
    var intro = sec.querySelector('.fx-intro');
    var lines = [].slice.call(intro.querySelectorAll('.fx-ln'));
    if (!lines.length || reduce.matches) return;
    sec.classList.add('fx-rev');
    var p = 0, rafI = 0, last = 0;
    function target() {
      var vh = innerHeight, top = intro.getBoundingClientRect().top;
      return clamp((vh * 0.95 - top) / (vh * 0.5), 0, 1);
    }
    function paint() {
      for (var i = 0; i < lines.length; i++) {
        var a = 0.03 + i * 0.14, t = clamp((p - a) / 0.32, 0, 1), e = 1 - Math.pow(1 - t, 3);
        lines[i].style.opacity = e.toFixed(3);
        lines[i].style.transform = 'translate3d(' + ((1 - e) * 140).toFixed(1) + 'px,0,0)';
      }
    }
    function tick(ts) {
      rafI = 0;
      var dt = last ? Math.min(0.1, (ts - last) / 1000) : 0.016; last = ts;
      var tg = target();
      p += (tg - p) * (1 - Math.exp(-dt * 2.6));
      if (Math.abs(tg - p) < 0.0008) p = tg;
      paint();
      if (p !== tg) rafI = requestAnimationFrame(tick); else last = 0;
    }
    function kickI() { if (!rafI) rafI = requestAnimationFrame(tick); }
    addEventListener('scroll', kickI, { passive: true });
    addEventListener('resize', kickI);
    kickI();
  })();

  applyMode();
})();
