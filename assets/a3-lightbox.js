/* a3-lightbox.js — proof-gallery behaviour: open an artifact IN the page
   instead of navigating to the file, move through its whole SET with the side
   arrows or ← / →, and cascade a row expander to the sub-sections inside it.
   Delegated: works for galleries that live inside closed <details> and for any
   gallery a later generator emits, with no per-page wiring. Inert when the
   page has no [data-lb] anchors. Progressive: the anchors still point at the
   real file, so with JS off a click simply opens it. */
(function () {
  'use strict';

  var lb = null, imgWrap = null, capEl = null, idxEl = null, titleEl = null,
      prevBtn = null, nextBtn = null, group = [], at = 0, opener = null,
      scope = null, pushed = false;

  function build() {
    if (lb) return;
    lb = document.createElement('div');
    lb.className = 'a3lb';
    lb.setAttribute('role', 'dialog');
    lb.setAttribute('aria-modal', 'true');
    lb.setAttribute('aria-label', 'Proof viewer');
    lb.innerHTML =
      '<button class="a3lb-x" aria-label="Close viewer (Esc)">&times;</button>' +
      '<button class="a3lb-nav prev" aria-label="Previous (left arrow)">' +
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
      'stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg></button>' +
      '<button class="a3lb-nav next" aria-label="Next (right arrow)">' +
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
      'stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg></button>' +
      '<div class="a3lb-title"></div>' +
      '<figure class="a3lb-stage"><div class="a3lb-media"></div>' +
      '<figcaption class="a3lb-cap"></figcaption></figure>' +
      '<div class="a3lb-idx"></div>';
    document.body.appendChild(lb);
    imgWrap = lb.querySelector('.a3lb-media');
    titleEl = lb.querySelector('.a3lb-title');
    capEl = lb.querySelector('.a3lb-cap');
    idxEl = lb.querySelector('.a3lb-idx');
    prevBtn = lb.querySelector('.prev');
    nextBtn = lb.querySelector('.next');

    prevBtn.addEventListener('click', function (e) { e.stopPropagation(); step(-1); });
    nextBtn.addEventListener('click', function (e) { e.stopPropagation(); step(1); });
    lb.querySelector('.a3lb-x').addEventListener('click', close);
    // Backdrop closes; the artifact and its caption do not.
    lb.addEventListener('click', function (e) {
      if (e.target === lb || e.target.classList.contains('a3lb-stage')) close();
    });
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  function render() {
    var a = group[at];
    if (!a) return;
    var href = a.getAttribute('href');
    var kind = a.getAttribute('data-kind') || 'image';
    imgWrap.innerHTML = kind === 'video'
      ? '<video src="' + esc(href) + '" controls autoplay playsinline></video>'
      : '<img src="' + esc(href) + '" alt="' + esc(a.getAttribute('data-shot')) + '">';
    var set = a.getAttribute('data-set') || '';
    var leg = a.getAttribute('data-leg') || '';
    var note = a.getAttribute('data-note') || '';
    var shot = a.getAttribute('data-shot') || '';
    // Top line names WHERE IN THE WALK this artifact sits — the leg, its
    // position inside that leg, and what kind of artifact it is. It changes as
    // the arrows cross from one leg into the next.
    titleEl.innerHTML = leg
      ? '<b>' + esc(leg) + '</b> ' + esc(a.getAttribute('data-i') || '') +
        ' of ' + esc(a.getAttribute('data-n') || '') + ' ' +
        esc(a.getAttribute('data-noun') || '')
      : esc(shot);
    capEl.innerHTML =
      '<b>' + esc(shot) + '</b>' +
      (note ? '<span class="note">' + esc(note) + '</span>' : '') +
      (set ? '<span class="set">' + esc(set) + '</span>' : '');
    idxEl.textContent = (at + 1) + ' of ' + group.length + ' in ' +
      (a.getAttribute('data-setname') || 'this set') +
      (siblings().length > 1 ? '   ·   \u2191 \u2193 sets' : '');
    var many = group.length > 1;
    prevBtn.hidden = !many;
    nextBtn.hidden = !many;
    // Warm the neighbours so arrowing through a set does not flash.
    [at - 1, at + 1].forEach(function (i) {
      var n = group[(i + group.length) % group.length];
      if (n && (n.getAttribute('data-kind') || 'image') === 'image') {
        var pre = new Image();
        pre.src = n.getAttribute('href');
      }
    });
  }

  function step(d) {
    if (!group.length) return;
    at = (at + d + group.length) % group.length;
    render();
  }

  /* Every proof set on this page that has artifacts, in reading order. A set
     with none has no expander row, so it is skipped without a special case. */
  function siblings() {
    if (!scope || !scope.closest) return scope ? [scope] : [];
    // Proof sets are .xrow within the same .xtbl — the only producer of
    // data-lb anchors, so there is no other structure to walk.
    var xt = scope.closest('.xtbl');
    if (xt) return Array.prototype.filter.call(
      xt.querySelectorAll('.xrow'),
      function (r) { return r.querySelector('a[data-lb]'); });
    return [scope];
  }

  // Open/close a proof SET — an .xrow opens itself, and the toggle handler below
  // cascades its legs.
  function setOpen(el, v) {
    if (el && el.classList.contains('xrow')) el.open = v;
  }

  /* Up / down move between SETS, not artifacts: the set on screen folds shut,
     the next one unfolds, and the viewer lands on its first artifact. So when
     the viewer closes, the LAST set seen is the one left maximized in the
     table. At either end nothing happens — a wrap would silently change subject. */
  function jumpSet(d) {
    var all = siblings();
    var target = all[all.indexOf(scope) + d];
    if (!target || target === scope) return;
    setOpen(scope, false);   // minimize the set we are leaving
    setOpen(target, true);   // maximize the set we are entering (cascades legs)
    scope = target;
    group = Array.prototype.slice.call(target.querySelectorAll('a[data-lb]'));
    at = 0;
    opener = group[0] || opener;         // closing returns focus to the new set
    render();
  }

  function open(a) {
    build();
    // The navigable group is the whole PROOF SET (the row expander), not the
    // one gallery clicked: a reader arrowing through evidence expects the next
    // leg to follow, not a dead end at the end of the current one.
    scope = a.closest('.xrow') || a.closest('.gal') || a.parentElement;
    group = Array.prototype.slice.call(scope.querySelectorAll('a[data-lb]'));
    at = Math.max(0, group.indexOf(a));
    opener = a;
    lb.classList.add('on');
    document.documentElement.style.overflow = 'hidden';
    // Back is the instinct for "get me out of this overlay". Without a history
    // entry it instead popped the page underneath — the viewer stayed up, the
    // scroll stayed locked, and the reader lost their place without seeing it.
    if (!pushed && window.history && history.pushState) {
      try { history.pushState({ a3lb: 1 }, ''); pushed = true; } catch (e) { /* file:// */ }
    }
    render();
    lb.querySelector('.a3lb-x').focus();
  }

  function close(fromPop) {
    if (!lb) return;
    // Closing by Esc/✕ consumes the history entry we pushed; closing BECAUSE of
    // a popstate must not push another back.
    if (pushed && !fromPop) {
      pushed = false;
      try { history.back(); } catch (e) { /* no-op */ }
    }
    pushed = false;
    lb.classList.remove('on');
    imgWrap.innerHTML = '';          // stop any playing video
    document.documentElement.style.overflow = '';
    if (opener) { opener.focus(); opener = null; }
  }

  window.addEventListener('popstate', function () {
    if (lb && lb.classList.contains('on')) close(true);
  });

  document.addEventListener('click', function (e) {
    var a = e.target.closest ? e.target.closest('a[data-lb]') : null;
    if (!a) return;
    e.preventDefault();
    open(a);
  });

  /* A row expander owns the sub-sections inside it: opening the set opens its
     legs, closing it closes them, so one toggle is one decision. `toggle` does
     not bubble, hence the capture phase. Only `details[data-sub]` cascades —
     an expander also contains truncation toggles, and forcing those open would
     make one click rewrite the whole row. */
  document.addEventListener('toggle', function (e) {
    var d = e.target;
    if (!d || d.tagName !== 'DETAILS') return;
    // A set container is an .xrow (the proof shelf). Only it cascades its legs —
    // not the ⊕ truncation toggles inside the row.
    if (!d.classList.contains('xrow')) return;
    var kids = d.querySelectorAll('details[data-sub]');
    for (var i = 0; i < kids.length; i++) kids[i].open = d.open;
  }, true);

  document.addEventListener('keydown', function (e) {
    if (!lb || !lb.classList.contains('on')) return;
    if (e.key === 'Escape') { close(); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); step(-1); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); step(1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); jumpSet(-1); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); jumpSet(1); }
    else if (e.key === 'Home') { e.preventDefault(); at = 0; render(); }
    else if (e.key === 'End') { e.preventDefault(); at = group.length - 1; render(); }
  });
})();
