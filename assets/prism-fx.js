/* gabe-imagine · the disk target's motion runtime.
 *
 * THREE DRIVERS, one file, because they share a clock, a pause and a registry —
 * splitting them would mean three copies of the pause obligation and only one of
 * them getting fixed:
 *
 *   console   ambient loop + scrub bar. Autoplays; the reader can stop it, step
 *             hop-by-hop in either direction, and resume. Used by console pages
 *             and by every embedded fragment (operator ruling: a fragment
 *             autoplays and carries its OWN controls, not a page conductor's).
 *   article   each scene assembles once as it scrolls into view, then holds.
 *             Never loops — an article is read forward, and a scene that keeps
 *             replaying behind the reader is noise.
 *   cover     a console floor at the end of an article. Same console driver,
 *             but it waits until it is scrolled to, so the thing the article was
 *             building toward starts running exactly when the reader arrives.
 *
 * THE PAUSE CONTRACT is gabe-artifact's, unchanged and deliberately so: this
 * file injects `#af-motion` with `.af-opt[data-id="off"]` into the center's cog
 * panel and defines `window.__setMotion`, which is precisely what
 * verify-motion.mjs already reaches for. One contract, two targets, one gate.
 *
 * REGISTRY: every floor with `data-fx="<slug>"` registers window.FXREPLAY[slug],
 * a function that rewinds and replays it. The gate fingerprints `[data-fx=…]`.
 */
(function () {
  "use strict";

  var MIN_SCALE = 0.92;   /* 13px authored × 0.92 = the 12px legibility floor */
  var TICK = 1400;        /* ms per hop unless the floor says otherwise */
  var MKEY = "a3:motion";

  window.FXREPLAY = window.FXREPLAY || {};

  var reduced = false;
  try {
    reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch (e) { /* ancient browser: treat as full motion */ }

  function motionOn() {
    return document.documentElement.getAttribute("data-motion") !== "off";
  }

  /* ── the fit box — scale-to-fit, then scroll ───────────────────────────── */
  var floors = [];

  function fit(f) {
    var wrap = f.el.closest(".pfwrap");
    var size = f.el.closest(".pfsize");
    var box = f.el.closest(".pffit");
    if (!wrap || !size || !box) return;

    box.style.transform = "none";
    size.style.width = "";
    size.style.height = "";

    /* max() rather than offsetWidth alone: width:max-content covers the
       normal case, and scrollWidth catches any floor whose own contents
       still overflow it. Measuring too WIDE only over-scales; measuring
       too narrow spills the page, which is the failure worth avoiding. */
    var natural = Math.max(f.el.offsetWidth, f.el.scrollWidth);
    var tall = f.el.offsetHeight;
    if (!natural || !tall) return;

    var avail = wrap.clientWidth;
    var s = avail / natural;
    if (s > 1) s = 1;
    if (s < MIN_SCALE) s = MIN_SCALE;   /* below this the drawing scrolls instead */

    box.style.transform = s === 1 ? "none" : "scale(" + s + ")";
    size.style.width = Math.ceil(natural * s) + "px";
    size.style.height = Math.ceil(tall * s) + "px";
    f.scale = s;

    /* Scale-to-fit stops at MIN_SCALE; past that the BOX scrolls. Say so —
       a silently scrollable box reads as a drawing that was cut off. */
    var over = wrap.scrollWidth - wrap.clientWidth > 2;
    wrap.classList.toggle("can-scroll", over);
    if (over && !f.hint) {
      /* A div, not a p: this is furniture of the drawing, and check-prism-fit
         measures every <p> against the 76ch prose cap — correctly, which is how
         this line got caught at 578px against a 503px cap on its first run. */
      f.hint = document.createElement("div");
      f.hint.className = "pfhint";
      f.hint.textContent = "↔ scroll the drawing, or collapse the sidebar";
      if (wrap.parentNode) wrap.parentNode.insertBefore(f.hint, wrap.nextSibling);
    }
    if (f.hint) f.hint.classList.toggle("on", over);
  }

  function fitAll() { floors.forEach(fit); }

  /* ── the console driver ────────────────────────────────────────────────── */
  function consoleDriver(f) {
    var nodes = f.nodes, hops = f.hops;
    var total = nodes.length || 1;
    f.step = 0;
    f.playing = false;
    f.timer = null;

    function paint() {
      nodes.forEach(function (n, i) {
        n.classList.toggle("is-active", i === f.step);
        n.classList.toggle("is-done", i < f.step);
        n.classList.toggle("is-waiting", i > f.step);
      });
      hops.forEach(function (h, i) {
        h.classList.remove("is-live");
        if (i === f.step) {
          /* Re-trigger the ride animation from its first frame. Removing the
             class alone does not restart a CSS animation in the same frame —
             the reflow read in between is what makes the restart real. */
          void h.offsetWidth;
          h.classList.add("is-live");
        }
      });
      if (f.scrub) {
        f.scrub.now.textContent = hops[f.step]
          ? (hops[f.step].getAttribute("data-payload") || "")
          : (nodes[f.step] ? "output · " + (nodes[f.step].getAttribute("data-out") || "") : "");
        f.scrub.at.textContent = String(f.step + 1);
        f.scrub.of.textContent = String(total);
      }
    }

    function schedule() {
      if (f.timer) { clearTimeout(f.timer); f.timer = null; }
      if (!f.playing || reduced || !motionOn()) return;
      f.timer = setTimeout(function () {
        f.step = (f.step + 1) % total;
        paint();
        schedule();
      }, f.tick);
    }

    f.goto = function (k) {
      f.step = ((k % total) + total) % total;
      paint();
      schedule();
    };
    f.play = function () {
      f.playing = true;
      if (f.scrub) { f.scrub.play.textContent = "▮▮"; f.scrub.play.title = "Pause this line"; }
      schedule();
    };
    f.pause = function () {
      f.playing = false;
      if (f.timer) { clearTimeout(f.timer); f.timer = null; }
      if (f.scrub) { f.scrub.play.textContent = "▶"; f.scrub.play.title = "Run this line"; }
    };
    f.replay = function () {
      /* Under reduced motion a replay must NOT start moving — it rewinds to a
         legible finished state and stops, which is what the gate samples. */
      f.step = 0;
      paint();
      if (reduced) { f.pause(); return; }
      f.play();
    };

    buildScrub(f, total);
    paint();
    if (reduced) { f.pause(); return; }
    if (f.deferred) whenSeen(f.el, function () { f.play(); });
    else f.play();
  }

  /* ── the scrub bar — the reader's hand on the line ─────────────────────── */
  function buildScrub(f, total) {
    if (f.el.getAttribute("data-scrub") === "off") return;
    var bar = document.createElement("div");
    bar.className = "pf-scrub";
    bar.setAttribute("role", "group");
    bar.setAttribute("aria-label", "Playback for " + (f.slug || "this line"));
    bar.innerHTML =
      '<button type="button" data-act="prev" title="Previous hop">◀</button>' +
      '<button type="button" class="pf-play" data-act="toggle" title="Pause this line">▮▮</button>' +
      '<button type="button" data-act="next" title="Next hop">▶</button>' +
      '<span class="pf-count">step <b class="pf-at">1</b>/<b class="pf-of">' + total + "</b></span>" +
      '<span class="pf-now"></span>' +
      '<button type="button" data-act="reset" title="Back to the start">reset</button>';

    var host = f.el.closest(".pfwrap");
    (host && host.parentNode ? host.parentNode : f.el.parentNode).insertBefore(bar, host || f.el);

    f.scrub = {
      bar: bar,
      play: bar.querySelector(".pf-play"),
      at: bar.querySelector(".pf-at"),
      of: bar.querySelector(".pf-of"),
      now: bar.querySelector(".pf-now")
    };

    bar.addEventListener("click", function (e) {
      var b = e.target.closest("button");
      if (!b) return;
      var act = b.getAttribute("data-act");
      /* Stepping by hand means the reader took over: autoplay stops rather than
         yanking the view forward one tick after they chose a step. */
      if (act === "prev") { f.pause(); f.goto(f.step - 1); }
      else if (act === "next") { f.pause(); f.goto(f.step + 1); }
      else if (act === "reset") { f.pause(); f.goto(0); }
      else if (act === "toggle") { f.playing ? f.pause() : f.play(); }
    });

    bar.addEventListener("keydown", function (e) {
      if (e.key === "ArrowLeft") { e.preventDefault(); f.pause(); f.goto(f.step - 1); }
      else if (e.key === "ArrowRight") { e.preventDefault(); f.pause(); f.goto(f.step + 1); }
    });
  }

  /* ── the article driver — each scene assembles once ────────────────────── */
  function articleScenes(root) {
    var scenes = [].slice.call(root.querySelectorAll(".pf-scene"));
    scenes.forEach(function (sc) {
      var parts = [].slice.call(sc.querySelectorAll(".pf-node, .pf-hop, .pf-gate"));
      parts.forEach(function (p, i) { p.style.setProperty("--i", String(i)); });
      if (reduced) { sc.classList.add("played"); return; }
      whenSeen(sc, function () { sc.classList.add("played"); }, 0.28);
    });
  }

  function whenSeen(el, fn, ratio) {
    if (!("IntersectionObserver" in window)) { fn(); return; }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { io.disconnect(); fn(); }
      });
    }, { threshold: ratio || 0.2 });
    io.observe(el);
  }

  /* ── the assembly driver — one floor, revealed beat by beat ───────────── */
  /* Distinct from the scene driver above: a scene plays ONCE and is done, an
     assembly is a scrubber the reader drives with the scroll wheel, forwards
     AND backwards. Scrolling back up un-reveals, because a reader who returns
     to beat 3 is asking what the net looked like at beat 3. */
  function assemblyDriver(root) {
    var pf = root.querySelector(".pf[data-assemble]");
    var beats = [].slice.call(root.querySelectorAll(".pf-beat[data-reveal]"));
    if (!pf || !beats.length) return;
    var nodes = [].slice.call(pf.querySelectorAll(".pf-node"));
    var hops = [].slice.call(pf.querySelectorAll(".pf-hop"));

    function reveal(level) {
      nodes.forEach(function (n, i) {
        n.classList.toggle("shown", i < level);
        n.classList.toggle("is-active", i === level - 1);
      });
      hops.forEach(function (h, i) { h.classList.toggle("shown", i < level - 1); });
      beats.forEach(function (bt) {
        bt.classList.toggle("on", parseInt(bt.getAttribute("data-reveal"), 10) === level);
      });
    }

    if (reduced) { reveal(nodes.length); return; }
    reveal(1);
    if (!("IntersectionObserver" in window)) { reveal(nodes.length); return; }
    /* The band is the middle of the viewport, not its top: a beat becomes
       current when the reader is reading it, not when its first pixel appears. */
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) reveal(parseInt(en.target.getAttribute("data-reveal"), 10));
      });
    }, { rootMargin: "-42% 0px -42% 0px", threshold: 0 });
    beats.forEach(function (bt) { io.observe(bt); });
  }

  /* ── inspectors — a cell that opens nothing is a defect (P1) ───────────── */
  function wireInspectors(root) {
    root.addEventListener("click", function (e) {
      var node = e.target.closest("[data-detail]");
      if (!node || !root.contains(node)) return;
      var panel = document.querySelector(node.getAttribute("data-detail"));
      if (!panel) return;
      var open = panel.classList.contains("is-open");
      /* One inspector at a time per page: two open panels put the reader in a
         comparison they did not ask for and push the floor off screen. */
      [].slice.call(document.querySelectorAll(".pf-detail.is-open"))
        .forEach(function (p) { p.classList.remove("is-open"); });
      if (!open) {
        panel.classList.add("is-open");
        panel.scrollIntoView({ block: "nearest", behavior: reduced ? "auto" : "smooth" });
      }
    });
  }

  /* ── the section rail — h2 pills become a sticky in-page nav ──────────── */
  function buildToc(stage) {
    var heads = [].slice.call(stage.querySelectorAll(".prismprose h2"));
    if (heads.length < 2) return;
    var bar = document.createElement("nav");
    bar.className = "prism-toc";
    bar.setAttribute("aria-label", "page sections");
    var links = heads.map(function (h, i) {
      if (!h.id) h.id = "psec-" + (i + 1);
      var a = document.createElement("a");
      a.href = "#" + h.id;
      var ic = h.querySelector("svg");
      if (ic) a.appendChild(ic.cloneNode(true));
      a.appendChild(document.createTextNode(h.textContent.trim()));
      bar.appendChild(a);
      return a;
    });
    stage.insertBefore(bar, stage.firstChild);
    /* Drag-to-scroll: a rail that overflows pans by grabbing anywhere on it —
       including on a chip. A press that MOVES (>6px) is a pan and must not
       navigate; a clean press is a click. Pointer events cover mouse + touch. */
    var drag = { down: false, moved: false, x: 0, sl: 0 };
    bar.addEventListener("pointerdown", function (e) {
      drag.down = true; drag.moved = false; drag.x = e.clientX; drag.sl = bar.scrollLeft;
    });
    window.addEventListener("pointermove", function (e) {
      if (!drag.down) return;
      var dx = e.clientX - drag.x;
      if (Math.abs(dx) > 6) drag.moved = true;
      if (drag.moved) bar.scrollLeft = drag.sl - dx;
    });
    window.addEventListener("pointerup", function () { drag.down = false; });
    window.addEventListener("pointercancel", function () { drag.down = false; });
    bar.addEventListener("click", function (e) {
      var a = e.target.closest("a");
      if (!a) return;
      e.preventDefault();
      if (drag.moved) return;                       /* a pan, not a choice */
      var t = document.getElementById(a.getAttribute("href").slice(1));
      if (!t) return;
      t.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });
      history.replaceState(null, "", a.getAttribute("href"));
    });
    if (!("IntersectionObserver" in window)) return;
    /* The band sits high: a section is "current" while its title is in the
       top third — matching where a reader looks after a jump. */
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        var ix = heads.indexOf(en.target);
        links.forEach(function (l, i) { l.classList.toggle("on", i === ix); });
      });
    }, { rootMargin: "-8% 0px -78% 0px", threshold: 0 });
    heads.forEach(function (h) { io.observe(h); });
  }

  /* ── the gravity driver — seats pull bodies: the relationship layer ────── */
  /* A .gv is NOT a floor: nothing transforms, so it carries no data-prism and
     the contract gate ignores it. It still MOVES, so it registers in floors and
     FXREPLAY and answers the same pause, spacebar and reduced-motion contract —
     a moving thing outside the pause contract would be the defect the cog
     exists to prevent. */
  function gravityDriver(el) {
    var seats = [].slice.call(el.querySelectorAll(".gv-seat"));
    if (!seats.length) return;
    var chips = {};
    [].slice.call(el.querySelectorAll(".gv-body[data-body]")).forEach(function (c) {
      chips[c.getAttribute("data-body")] = c;
    });
    var svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("class", "gv-links");
    svg.setAttribute("aria-hidden", "true");
    el.appendChild(svg);

    var g = {
      el: el,
      slug: el.getAttribute("data-fx") || "",
      tick: parseInt(el.getAttribute("data-tick"), 10) || TICK,
      step: 0, playing: false, timer: null, scale: 1
    };

    function pulls(seat) {
      return (seat.getAttribute("data-pull") || "").split(",")
        .map(function (s) { return s.trim(); }).filter(Boolean);
    }

    function draw(seat) {
      while (svg.firstChild) svg.removeChild(svg.firstChild);
      var host = el.getBoundingClientRect();
      if (!host.width) return;
      svg.setAttribute("viewBox", "0 0 " + host.width + " " + host.height);
      var a = seat.getBoundingClientRect();
      var x1 = a.left - host.left + a.width / 2;
      var y1 = a.bottom - host.top;
      pulls(seat).forEach(function (id) {
        var c = chips[id];
        if (!c) return;
        var b = c.getBoundingClientRect();
        var x2 = b.left - host.left + b.width / 2;
        var y2 = b.top - host.top;
        var bend = Math.max(30, (y2 - y1) * 0.55);
        var p = document.createElementNS(svg.namespaceURI, "path");
        p.setAttribute("d", "M" + x1 + "," + y1 +
          " C" + x1 + "," + (y1 + bend) + " " + x2 + "," + (y2 - bend) +
          " " + x2 + "," + y2);
        svg.appendChild(p);
      });
    }

    function paint() {
      var seat = seats[g.step];
      var on = {};
      pulls(seat).forEach(function (id) { on[id] = true; });
      seats.forEach(function (s, i) { s.classList.toggle("is-active", i === g.step); });
      Object.keys(chips).forEach(function (id) {
        chips[id].classList.toggle("is-pulled", !!on[id]);
        chips[id].classList.toggle("is-dim", !on[id]);
      });
      el.classList.add("gv-on");
      draw(seat);
    }

    function schedule() {
      if (g.timer) { clearTimeout(g.timer); g.timer = null; }
      if (!g.playing || reduced || !motionOn()) return;
      g.timer = setTimeout(function () {
        g.step = (g.step + 1) % seats.length;
        paint();
        schedule();
      }, g.tick);
    }

    g.goto = function (k) {
      g.step = ((k % seats.length) + seats.length) % seats.length;
      paint();
      schedule();
    };
    g.play = function () { g.playing = true; schedule(); };
    g.pause = function () {
      g.playing = false;
      if (g.timer) { clearTimeout(g.timer); g.timer = null; }
    };
    g.replay = function () {
      /* Under reduced motion a replay rewinds to a legible held state and
         stops — the same obligation the console driver carries. */
      g.step = 0;
      paint();
      if (reduced) { g.pause(); return; }
      g.play();
    };

    el.addEventListener("click", function (e) {
      var s = e.target.closest(".gv-seat");
      if (!s) return;
      /* Choosing a seat by hand means the reader took over: the cycle stops on
         their seat instead of yanking it away one tick later. */
      g.pause();
      g.goto(seats.indexOf(s));
    });

    var rt;
    window.addEventListener("resize", function () {
      clearTimeout(rt);
      rt = setTimeout(function () { draw(seats[g.step]); }, 140);
    });

    floors.push(g);
    if (g.slug) window.FXREPLAY[g.slug] = g.replay;

    paint();
    if (reduced) { g.pause(); return; }
    whenSeen(el, function () { g.play(); });
  }

  /* ── the cog's Motion group — gabe-artifact's contract, verbatim ───────── */
  function setMotion(on) {
    document.documentElement.setAttribute("data-motion", on ? "on" : "off");
    try { localStorage.setItem(MKEY, on ? "on" : "off"); } catch (e) { /* private mode */ }
    floors.forEach(function (f) {
      if (!f.play) return;
      if (!on) { if (f.timer) { clearTimeout(f.timer); f.timer = null; } }
      else if (f.playing) { f.play(); }
    });
    paintMotion();
  }
  window.__setMotion = setMotion;

  function paintMotion() {
    var grp = document.getElementById("af-motion");
    if (!grp) return;
    var on = motionOn();
    [].slice.call(grp.querySelectorAll(".af-opt")).forEach(function (o) {
      o.classList.toggle("on", o.getAttribute("data-id") === (on ? "on" : "off"));
      o.setAttribute("aria-pressed", String(o.getAttribute("data-id") === (on ? "on" : "off")));
    });
  }

  function injectMotionControl() {
    var panel = document.querySelector(".a3panel");
    if (!panel || document.getElementById("af-motion")) return;
    var lab = document.createElement("label");
    lab.className = "row";
    lab.textContent = "Motion";
    var seg = document.createElement("div");
    seg.className = "a3seg";
    seg.id = "af-motion";
    seg.innerHTML =
      '<button type="button" class="af-opt" data-id="on">Running</button>' +
      '<button type="button" class="af-opt" data-id="off">Paused</button>';
    seg.addEventListener("click", function (e) {
      var b = e.target.closest(".af-opt");
      if (!b) return;
      setMotion(b.getAttribute("data-id") === "on");
    });
    panel.appendChild(lab);
    panel.appendChild(seg);
    paintMotion();
  }

  /* ── boot ──────────────────────────────────────────────────────────────── */
  function boot() {
    var stored = "on";
    try { stored = localStorage.getItem(MKEY) || "on"; } catch (e) { /* private mode */ }
    document.documentElement.setAttribute("data-motion", stored === "off" ? "off" : "on");

    var stage = document.querySelector(".prismstage");
    var pageMode = stage ? stage.getAttribute("data-prism-mode") : "";

    [].slice.call(document.querySelectorAll(".pf[data-prism]")).forEach(function (el) {
      var inCover = !!el.closest(".pf-cover");
      var inFrag = !!el.closest(".pxfrag");
      var mode = el.getAttribute("data-motion-mode") ||
        (el.hasAttribute("data-assemble") ? "assemble"
          : inFrag ? "console" : (inCover ? "cover" : (pageMode === "article" ? "article" : "console")));
      if (mode === "off") return;

      var f = {
        el: el,
        slug: el.getAttribute("data-fx") || "",
        mode: mode,
        deferred: mode === "cover" || inFrag,
        tick: parseInt(el.getAttribute("data-tick"), 10) || TICK,
        nodes: [].slice.call(el.querySelectorAll(".pf-node")),
        hops: [].slice.call(el.querySelectorAll(".pf-hop")),
        scale: 1
      };
      el.style.setProperty("--pf-tick", f.tick + "ms");
      floors.push(f);

      if (mode === "assemble") {
        /* Revealing is the scroll's job; the replay the gate calls re-runs the
           reveal from the first machine so there is something to fingerprint. */
        f.replay = function () {
          var host = el.closest(".pf-assembly");
          if (host) assemblyDriver(host);
        };
      } else if (mode === "article") {
        /* An article floor holds still; its assembly is the scene driver's job.
           It still registers a replay so the motion gate can address it. */
        f.replay = function () {
          var sc = el.closest(".pf-scene");
          if (!sc) return;
          sc.classList.remove("played");
          void sc.offsetWidth;
          sc.classList.add("played");
        };
      } else {
        consoleDriver(f);
      }
      if (f.slug) window.FXREPLAY[f.slug] = f.replay;
    });

    [].slice.call(document.querySelectorAll(".gv[data-gravity]")).forEach(gravityDriver);

    if (stage) {
      articleScenes(stage);
      [].slice.call(stage.querySelectorAll(".pf-assembly")).forEach(assemblyDriver);
      wireInspectors(stage);
      buildToc(stage);
    }
    /* Only fragments OUTSIDE the stage — the stage's own delegated listener
       already covers everything inside it, and a second listener on the same
       click toggles the panel open then shut in one press (net: dead click).
       Found while converting gastify to a fragment-composed page. */
    [].slice.call(document.querySelectorAll(".pxfrag"))
      .filter(function (el) { return !el.closest(".prismstage"); })
      .forEach(wireInspectors);

    fitAll();
    /* No floor on this page ⇒ no motion obligation ⇒ no control. A Motion knob
       on a page that never moves is a lie about what the page does. */
    if (floors.length) injectMotionControl();

    var rt;
    window.addEventListener("resize", function () {
      clearTimeout(rt);
      rt = setTimeout(fitAll, 120);
    });
    /* The cog's text-size and rail knobs both change how much room the drawing
       has; without this the floor keeps a scale measured against the old width. */
    if ("MutationObserver" in window) {
      new MutationObserver(function () { clearTimeout(rt); rt = setTimeout(fitAll, 60); })
        .observe(document.documentElement, { attributes: true, attributeFilter: ["style", "data-rail", "data-compact"] });
    }

    document.addEventListener("keydown", function (e) {
      if (e.code !== "Space" || e.target.closest("input, select, textarea, button")) return;
      if (!floors.length) return;
      e.preventDefault();
      setMotion(!motionOn());
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
