/* A3 command-center viewer settings — typography + density, per browser.
 *
 * Injects its own control into .topbar, so no station skeleton carries settings
 * markup: every page gets the panel for free and the shell stays declarative.
 * Preferences persist in localStorage and are re-applied on load.
 *
 * Four knobs, chosen so each changes exactly one thing:
 *   font   -> --font-content   CONTENT ONLY (incl. diagram text); the navigation
 *                              keeps its identity. Default: Menlo.
 *   size   -> --root-size      every rem in the shell, so nav + content scale
 *                              together. Default: S (14px).
 *   compact-> data-compact     VERTICAL density — same width, less padding, so
 *                              more rows fit without changing what a row says
 *   rail   -> data-rail        collapse to icons, width to content. Toggled from
 *                              the sidebar's own bottom-right button, not the panel.
 */
(function () {
  var KEY = { font: "a3:font", size: "a3:size", compact: "a3:compact", rail: "a3:rail", theme: "a3:theme" };

  /* Kept by operator request: Helvetica, Tahoma, Menlo (default). The rest are
     distinct, widely-available stacks — no webfont, so nothing hits the network. */
  var FONTS = [
    ["Menlo (mono, default)", "Menlo,Consolas,'DejaVu Sans Mono',ui-monospace,monospace"],
    ["Helvetica", "'Helvetica Neue',Helvetica,Arial,sans-serif"],
    ["Tahoma", "Tahoma,Verdana,sans-serif"],
    ["Cascadia (mono)", "'Cascadia Mono',Consolas,'Liberation Mono',monospace"],
    ["Courier (mono)", "'Courier New',Courier,monospace"],
    ["Segoe / Roboto", "'Segoe UI',Roboto,'Noto Sans',sans-serif"],
    ["Candara (humanist)", "Candara,Optima,'Gill Sans','Trebuchet MS',sans-serif"],
    ["Cambria (serif)", "Cambria,'Hoefler Text',Constantia,Georgia,serif"],
    ["Baskerville (serif)", "Baskerville,'Book Antiqua','Palatino Linotype',serif"],
    ["Charter (serif)", "Charter,'Iowan Old Style','Bitstream Charter',Georgia,serif"]
  ];
  var SIZES = [["S", "14px"], ["M", "16px"], ["L", "18px"], ["XL", "20px"]];

  function get(k, d) { try { return localStorage.getItem(k) || d; } catch (e) { return d; } }
  function set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* private mode */ } }

  function apply() {
    var root = document.documentElement;
    root.style.setProperty("--font-content", get(KEY.font, FONTS[0][1]));
    root.style.setProperty("--root-size", get(KEY.size, "14px"));
    root.setAttribute("data-compact", get(KEY.compact, "0"));
    root.setAttribute("data-rail", get(KEY.rail, "0"));
    root.setAttribute("data-theme", get(KEY.theme, "light"));
  }
  apply();

  function build() {
    var bar = document.querySelector(".topbar");
    if (!bar || document.querySelector(".a3gear")) return;

    var gear = document.createElement("button");
    gear.className = "a3gear";
    gear.type = "button";
    gear.setAttribute("aria-label", "View settings");
    gear.innerHTML = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" ' +
      'stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
      '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9c.2.61.75 1.03 1.51 1H21a2 2 0 1 1 0 4h-.09c-.76 0-1.31.42-1.51 1z"/></svg>';

    var panel = document.createElement("div");
    panel.className = "a3panel";
    panel.innerHTML =
      "<h4>View settings</h4>" +
      '<label class="row" for="a3font">Content font</label>' +
      '<select id="a3font">' + FONTS.map(function (f, i) {
        return '<option value="' + i + '">' + f[0] + "</option>";
      }).join("") + "</select>" +
      '<label class="row">Text size</label><div class="a3seg" id="a3size">' +
      SIZES.map(function (s) {
        return '<button type="button" data-v="' + s[1] + '">' + s[0] + "</button>";
      }).join("") + "</div>" +
      '<label class="row">Density</label>' +
      '<div class="a3toggle"><span>Compact navigation</span>' +
      '<input type="checkbox" id="a3compact"></div>' +
      '<label class="row">Theme</label><div class="a3seg" id="a3theme">' +
      '<button type="button" data-v="light">Light</button>' +
      '<button type="button" data-v="dark">Dark</button></div>';

    gear.classList.add("icononly");
    gear.title = "View settings";
    var brand = document.querySelector(".side .brand");
    if (brand) { brand.appendChild(gear); }
    else { bar.appendChild(gear); }
    document.body.appendChild(panel);

    var sel = panel.querySelector("#a3font");
    var cur = get(KEY.font, FONTS[0][1]);
    FONTS.forEach(function (f, i) { if (f[1] === cur) sel.value = String(i); });
    sel.addEventListener("change", function () {
      set(KEY.font, FONTS[+sel.value][1]); apply();
    });

    var seg = panel.querySelector("#a3size");
    function paintSeg() {
      var v = get(KEY.size, "14px");
      seg.querySelectorAll("button").forEach(function (b) {
        b.classList.toggle("on", b.dataset.v === v);
      });
    }
    seg.addEventListener("click", function (e) {
      var b = e.target.closest("button");
      if (!b) return;
      set(KEY.size, b.dataset.v); apply(); paintSeg();
    });
    paintSeg();

    var cb = panel.querySelector("#a3compact");
    cb.checked = get(KEY.compact, "0") === "1";
    cb.addEventListener("change", function () {
      set(KEY.compact, cb.checked ? "1" : "0"); apply();
    });


    // Rail toggle lives in the sidebar's bottom-right corner — a placement
    // control, so it belongs on the thing it collapses, not in the panel.
    var side = document.querySelector(".side");
    if (side && !side.querySelector(".a3rail")) {
      var rail = document.createElement("button");
      rail.className = "a3rail";
      rail.type = "button";
      rail.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" ' +
        'stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
        '<rect x="3" y="3" width="18" height="18" rx="2"/><line x1="9" y1="3" x2="9" y2="21"/>' +
        '</svg>';
      rail.title = "Collapse the sidebar to icons";
      rail.addEventListener("click", function () {
        set(KEY.rail, get(KEY.rail, "0") === "1" ? "0" : "1");
        apply();
      });
      // Right after the last menu group, not pinned to the bottom.
      var foot = side.querySelector(".foot");
      if (foot) { side.insertBefore(rail, foot); } else { side.appendChild(rail); }
    }

    // Theme lives INSIDE the settings panel, beside font/size/density.
    var tseg = panel.querySelector("#a3theme");
    function paintTheme() {
      var v = get(KEY.theme, "light");
      tseg.querySelectorAll("button").forEach(function (btn) {
        btn.classList.toggle("on", btn.dataset.v === v);
      });
    }
    tseg.addEventListener("click", function (e) {
      var btn = e.target.closest("button");
      if (!btn) return;
      set(KEY.theme, btn.dataset.v); apply(); paintTheme();
    });
    paintTheme();

    gear.addEventListener("click", function (e) {
      e.stopPropagation();
      var willOpen = !panel.classList.contains("on");
      if (willOpen) {
        // Open FROM the cog: anchor below it, clamped to the viewport.
        var r = gear.getBoundingClientRect();
        var left = Math.min(r.left, window.innerWidth - 290);
        var top = Math.min(r.bottom + 8, window.innerHeight - 320);
        panel.style.left = Math.max(8, left) + "px";
        panel.style.top = Math.max(8, top) + "px";
        panel.style.right = "auto";
        panel.style.bottom = "auto";
      }
      panel.classList.toggle("on");
    });
    document.addEventListener("click", function (e) {
      if (!panel.contains(e.target)) panel.classList.remove("on");
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", build);
  } else {
    build();
  }
})();
