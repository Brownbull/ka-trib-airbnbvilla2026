/* Chrome de sitios de caso — los 3 bloques irremplazables del pipeline de
   El Publicador, sobre el shell A3 vendorizado.
   ─────────────────────────────────────────────────────────────────────────
     1. cargador del manifest PII  (botón «Revelar datos»)
     2. overlay de mermaid          (zoom + arrastre)
     3. filtro de prioridad         (tablas con columna Prioridad)

   NO se modifica sin correr `node tests/publicador/pii-fixture.mjs`.
   La FASE-1.3 del pipeline verifica por regex que el bloque PII exista y la
   1.35 verifica que FUNCIONE. */
(function () {
  "use strict";

  /* ── BLOQUE IRREMPLAZABLE 1 · cargador del manifest PII ────────────────
     El manifest nunca viaja con el sitio: el lector lo carga desde su propio
     disco y la sustitución ocurre solo en su navegador. */
  (function () {
    var btn = document.getElementById('pii-load-btn');
    var status = document.getElementById('pii-status');
    if (!btn) return;
    btn.addEventListener('click', function () {
      var input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json,application/json';
      input.onchange = function (e) {
        var file = e.target.files[0];
        if (!file) return;
        var reader = new FileReader();
        reader.onload = function (ev) {
          try {
            var manifest = JSON.parse(ev.target.result);
            var spans = document.querySelectorAll('.pii-redacted');
            var count = 0;
            spans.forEach(function (span) {
              var token = span.getAttribute('data-token');
              if (manifest[token]) {
                span.textContent = manifest[token];
                span.classList.remove('pii-redacted');
                span.classList.add('pii-revealed');
                count++;
              }
            });
            if (count > 0) {
              btn.textContent = 'Datos revelados (' + count + ')';
              btn.classList.add('pii-loaded');
              if (status) status.textContent = '';
            } else {
              if (status) status.textContent = 'Sin datos en esta página';
            }
          } catch (err) {
            if (status) status.textContent = 'Error: JSON inválido';
          }
        };
        reader.readAsText(file);
      };
      input.click();
    });
  })();

  /* ── Mermaid: render local con los tokens del tema activo ───────────────
     El bundle es el clásico vendorizado (expone globalThis.mermaid) y corre
     sobre file://. La fuente de cada diagrama se guarda en data-src ANTES del
     primer render, en un ATRIBUTO y no en texto, para que el gate de
     diagramas no lo lea como «fuente cruda» visible. Se guarda con innerHTML
     y no con textContent: el navegador ya convirtió los `<br/>` de las
     etiquetas en elementos, y textContent los descarta. */
  (function () {
    if (typeof mermaid === 'undefined') return;
    var root = document.documentElement;

    function config() {
      var cs = getComputedStyle(root);
      var t = function (n) { return cs.getPropertyValue(n).trim(); };
      return {
        startOnLoad: false,
        securityLevel: 'antiscript',
        theme: 'base',
        fontFamily: t('--font-content') || t('--font-ui') || 'system-ui, sans-serif',
        themeVariables: {
          background: t('--surface'),
          mainBkg: t('--panel'),
          primaryColor: t('--accent-soft'),
          primaryTextColor: t('--ink'),
          primaryBorderColor: t('--accent'),
          secondaryColor: t('--panel'),
          tertiaryColor: t('--line-2'),
          lineColor: t('--muted'),
          textColor: t('--ink'),
          nodeBorder: t('--line'),
          clusterBkg: t('--line-2'),
          clusterBorder: t('--line'),
          fontSize: '15px'
        }
      };
    }

    function render() {
      var list = document.querySelectorAll('.mermaid');
      if (!list.length) return;
      list.forEach(function (el) {
        if (el.getAttribute('data-src') === null) el.setAttribute('data-src', el.innerHTML);
        el.removeAttribute('data-processed');
        el.innerHTML = el.getAttribute('data-src');
      });
      try {
        mermaid.initialize(config());
        mermaid.run({ querySelector: '.mermaid' });
      } catch (e) { /* un diagrama roto no debe voltear la página */ }
    }

    document.addEventListener('DOMContentLoaded', render);

    /* El engranaje del shell cambia tema y fuente en :root; los colores del
       diagrama salen de esos tokens y quedarían del tema anterior. */
    new MutationObserver(function (muts) {
      for (var i = 0; i < muts.length; i++) {
        var n = muts[i].attributeName;
        if (n === 'data-theme' || n === 'style' || n === 'class') { render(); return; }
      }
    }).observe(root, { attributes: true, attributeFilter: ['data-theme', 'style', 'class'] });
  })();

  /* ── BLOQUE IRREMPLAZABLE 2 · overlay de mermaid (zoom + arrastre) ────── */
  document.addEventListener('DOMContentLoaded', function () {
    var overlay = document.createElement('div');
    overlay.className = 'mermaid-overlay';
    overlay.innerHTML = '<button class="close-overlay no-print" aria-label="Cerrar">&times;</button><div class="mermaid-inner"></div>';
    document.body.appendChild(overlay);

    var inner = overlay.querySelector('.mermaid-inner');
    var closeBtn = overlay.querySelector('.close-overlay');
    var scale = 1, posX = 0, posY = 0, startX, startY, isDragging = false;

    function updateTransform() {
      inner.style.transform = 'translate(' + posX + 'px,' + posY + 'px) scale(' + scale + ')';
    }
    function openOverlay(svg) {
      inner.innerHTML = '';
      var clone = svg.cloneNode(true);
      clone.style.maxWidth = 'none';
      clone.style.maxHeight = 'none';
      inner.appendChild(clone);
      scale = 1; posX = 0; posY = 0;
      updateTransform();
      overlay.classList.add('active');
      document.body.style.overflow = 'hidden';
    }
    function closeOverlay() {
      overlay.classList.remove('active');
      overlay.classList.remove('dragging');
      document.body.style.overflow = '';
    }

    closeBtn.addEventListener('click', closeOverlay);
    overlay.addEventListener('click', function (e) { if (e.target === overlay) closeOverlay(); });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && overlay.classList.contains('active')) closeOverlay();
    });
    document.addEventListener('click', function (e) {
      var merm = e.target.closest('.mermaid');
      if (!merm || overlay.classList.contains('active')) return;
      var svg = merm.querySelector('svg');
      if (svg) openOverlay(svg);
    });

    overlay.addEventListener('mousedown', function (e) {
      if (e.target === closeBtn) return;
      isDragging = true;
      startX = e.clientX - posX; startY = e.clientY - posY;
      overlay.classList.add('dragging');
    });
    document.addEventListener('mousemove', function (e) {
      if (!isDragging) return;
      posX = e.clientX - startX; posY = e.clientY - startY;
      updateTransform();
    });
    document.addEventListener('mouseup', function () {
      isDragging = false; overlay.classList.remove('dragging');
    });

    var lastTouchDist = 0;
    overlay.addEventListener('touchstart', function (e) {
      if (e.touches.length === 1) {
        isDragging = true;
        startX = e.touches[0].clientX - posX; startY = e.touches[0].clientY - posY;
      } else if (e.touches.length === 2) {
        isDragging = false;
        lastTouchDist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY);
      }
    }, { passive: true });
    overlay.addEventListener('touchmove', function (e) {
      if (e.touches.length === 1 && isDragging) {
        posX = e.touches[0].clientX - startX; posY = e.touches[0].clientY - startY;
        updateTransform();
      } else if (e.touches.length === 2) {
        var dist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY);
        if (lastTouchDist > 0) {
          scale = Math.max(0.5, Math.min(5, scale * (dist / lastTouchDist)));
          updateTransform();
        }
        lastTouchDist = dist;
      }
    }, { passive: true });
    overlay.addEventListener('touchend', function () { isDragging = false; lastTouchDist = 0; });

    overlay.addEventListener('wheel', function (e) {
      e.preventDefault();
      scale = Math.max(0.5, Math.min(5, scale * (e.deltaY > 0 ? 0.9 : 1.1)));
      updateTransform();
    }, { passive: false });
  });


  /* ── Riel: grupos plegables ─────────────────────────────────────────────
     El estado se recuerda por navegador: plegar un grupo y encontrarlo
     desplegado en la página siguiente sería un plegado que no sirve. El grupo
     que contiene la página actual se despliega siempre, aunque estuviera
     plegado — si no, el lector no ve dónde está parado. */
  document.addEventListener('DOMContentLoaded', function () {
    var KEY = 'khujta:caso:nav-plegados';
    var plegados = {};
    try { plegados = JSON.parse(localStorage.getItem(KEY) || '{}'); } catch (e) {}

    document.querySelectorAll('.side .navtoggle').forEach(function (btn) {
      var id = btn.getAttribute('data-group');
      var grupo = document.querySelector('.side .navgroup[data-group="' + id + '"]');
      if (!grupo) return;
      var tieneActual = !!grupo.querySelector('[aria-current="page"]');

      function pintar(abierto) {
        btn.setAttribute('aria-expanded', String(abierto));
        if (abierto) grupo.removeAttribute('hidden');
        else grupo.setAttribute('hidden', '');
      }
      pintar(tieneActual || !plegados[id]);

      btn.addEventListener('click', function () {
        var abierto = btn.getAttribute('aria-expanded') !== 'true';
        pintar(abierto);
        plegados[id] = !abierto;
        try { localStorage.setItem(KEY, JSON.stringify(plegados)); } catch (e) {}
      });
    });
  });

  /* ── Barra de secciones del documento ───────────────────────────────────
     Reemplaza al corte en páginas. Se arma en tiempo de lectura desde los H2
     de la página, aparece al bajar del encabezado y marca la sección que se
     está leyendo. */
  document.addEventListener('DOMContentLoaded', function () {
    var main = document.querySelector('.main');
    var topbar = document.querySelector('.topbar');
    var head = document.querySelector('.pagehead');
    if (!main || !topbar) return;

    var heads = [].slice.call(document.querySelectorAll('.docbody h2[id]'));
    if (heads.length < 2) return;   // con una sección no hay nada que navegar

    // La barra superior y la de secciones viajan juntas: se envuelven en un
    // bloque pegajoso en vez de calcular desplazamientos a mano.
    var stick = document.createElement('div');
    stick.className = 'stickhead';
    topbar.parentNode.insertBefore(stick, topbar);
    stick.appendChild(topbar);

    var bar = document.createElement('div');
    bar.className = 'secbar no-print';
    /* Sin el título del documento: ya está en las migas de la barra superior,
       que viaja pegada arriba, y repetirlo gastaba el ancho que las secciones
       necesitan. */

    var chips = heads.map(function (h, i) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'secchip';
      var texto = h.textContent.replace(/^\s*\d+\s*/, '').trim();
      /* 15 caracteres por chip: la barra existe para que quepan MÁS secciones a
         la vista, y un chip con el título entero deja tres en pantalla. Acá sí
         van los puntos suspensivos — a diferencia del riel, el chip se lee de
         corrido junto a sus vecinos y el corte seco se confunde con el título
         de al lado. El título completo queda en el tooltip. */
      var corto = texto.length > 15 ? texto.slice(0, 15).replace(/[\s,;:·—–-]+$/, '') + '…' : texto;
      b.innerHTML = '<span class="n">' + String(i + 1).padStart(2, '0') + '</span>';
      b.appendChild(document.createTextNode(corto));
      b.title = texto;
      b.addEventListener('click', function () {
        h.scrollIntoView({ behavior: 'smooth', block: 'start' });
        history.replaceState(null, '', '#' + h.id);
      });
      bar.appendChild(b);
      return b;
    });
    stick.appendChild(bar);

    function marcar(i) {
      chips.forEach(function (c, j) { c.classList.toggle('is-active', i === j); });
      var act = chips[i];
      if (act && bar.scrollWidth > bar.clientWidth) {
        var izq = act.offsetLeft - bar.offsetLeft;
        if (izq < bar.scrollLeft || izq + act.offsetWidth > bar.scrollLeft + bar.clientWidth) {
          bar.scrollTo({ left: Math.max(0, izq - 90), behavior: 'smooth' });
        }
      }
    }

    /* La sección activa es la ÚLTIMA cuyo encabezado ya pasó bajo la barra.
       Un IntersectionObserver a secas marca la que entra por abajo, y al bajar
       lento el lector ve resaltada una sección que todavía no llegó. */
    function actual() {
      var corte = stick.getBoundingClientRect().bottom + 8;
      var idx = 0;
      for (var i = 0; i < heads.length; i++) {
        if (heads[i].getBoundingClientRect().top <= corte) idx = i;
        else break;
      }
      return idx;
    }

    var pendiente = false;
    function alScroll() {
      if (pendiente) return;
      pendiente = true;
      requestAnimationFrame(function () {
        pendiente = false;
        var limite = head ? head.getBoundingClientRect().bottom : 0;
        bar.classList.toggle('is-on', limite < topbar.getBoundingClientRect().bottom);
        if (bar.classList.contains('is-on')) marcar(actual());
      });
    }
    window.addEventListener('scroll', alScroll, { passive: true });
    window.addEventListener('resize', alScroll, { passive: true });
    alScroll();
  });

  /* ── Anillo de score del panel: relleno + conteo ────────────────────────
     Se perdió en el cambio de shell junto con su CSS. El relleno se calcula
     desde el radio real del círculo, no de una constante: el SVG del panel
     puede venir con otro radio y una circunferencia fija dejaría el arco
     descuadrado. Respeta `prefers-reduced-motion` mostrando el valor final. */
  document.addEventListener('DOMContentLoaded', function () {
    var quieto = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    document.querySelectorAll('.score-ring').forEach(function (ring) {
      var numEl = ring.querySelector('.number[data-target]');
      if (!numEl) return;
      var target = parseInt(numEl.getAttribute('data-target'), 10);
      if (isNaN(target)) return;

      var fill = ring.querySelector('circle.fill');
      if (fill) {
        var r = parseFloat(fill.getAttribute('r') || '44');
        var circ = 2 * Math.PI * r;
        fill.style.strokeDasharray = String(circ);
        fill.style.strokeDashoffset = String(quieto ? circ * (1 - target / 100) : circ);
        if (!quieto) {
          setTimeout(function () {
            fill.style.strokeDashoffset = String(circ * (1 - target / 100));
          }, 150);
        }
      }

      if (quieto) { numEl.textContent = String(target); return; }
      var dur = 1100, t0 = null;
      function paso(ts) {
        if (!t0) t0 = ts;
        var p = Math.min((ts - t0) / dur, 1);
        numEl.textContent = Math.round(target * (1 - Math.pow(1 - p, 3)));
        if (p < 1) requestAnimationFrame(paso);
      }
      requestAnimationFrame(paso);
    });
  });

  /* ── severidad de fila por palabra clave ───────────────────────────────── */
  document.addEventListener('DOMContentLoaded', function () {
    var reCritical = /urgente|cr[ií]tic[ao]|bloqueado|bloqueante/i;
    var reSuccess = /completo|completado|resuelto|listo|blindado/i;
    var reWarning = /pendiente|revisar|verificar|atenci[oó]n/i;
    document.querySelectorAll('.docbody table tr').forEach(function (row) {
      if (row.closest('thead')) return;
      var detected = null;
      row.querySelectorAll('td').forEach(function (td) {
        var t = td.textContent.trim();
        if (t.length > 35) return;
        if (!detected && reCritical.test(t)) detected = 'critical';
        else if (!detected && reSuccess.test(t)) detected = 'success';
        else if (!detected && reWarning.test(t)) detected = 'warning';
      });
      if (detected) row.classList.add('row-' + detected);
    });
  });

  /* ── BLOQUE IRREMPLAZABLE 3 · filtro de prioridad ─────────────────────── */
  document.addEventListener('DOMContentLoaded', function () {
    var hasPriority = false;
    document.querySelectorAll('.docbody table').forEach(function (table) {
      var prioCol = -1;
      table.querySelectorAll('th').forEach(function (th, idx) {
        if (/prioridad/i.test(th.textContent)) prioCol = idx;
      });
      if (prioCol < 0) return;
      hasPriority = true;
      table.querySelectorAll('tbody tr, tr').forEach(function (row) {
        if (row.closest('thead')) return;
        var cells = row.querySelectorAll('td');
        if (cells.length <= prioCol) return;
        var val = cells[prioCol].textContent.trim().toLowerCase();
        if (/cr[ií]tico/.test(val)) row.setAttribute('data-priority', 'critico');
        else if (/importante/.test(val)) row.setAttribute('data-priority', 'importante');
        else if (/deseable/.test(val)) row.setAttribute('data-priority', 'deseable');
      });
    });

    var filterBar = document.getElementById('priority-filter');
    if (!hasPriority || !filterBar) return;
    filterBar.style.display = '';

    var buttons = filterBar.querySelectorAll('.filter-btn');
    buttons.forEach(function (btn) {
      btn.addEventListener('click', function () {
        buttons.forEach(function (b) { b.classList.remove('active'); });
        btn.classList.add('active');
        var prio = btn.getAttribute('data-priority');
        /* `tr[` y no `[data-priority]` a secas: los propios botones del filtro
           llevan data-priority y el selector amplio se ocultaba a sí mismo. */
        document.querySelectorAll('tr[data-priority]').forEach(function (row) {
          row.style.display = (prio === 'all' || row.getAttribute('data-priority') === prio) ? '' : 'none';
        });
      });
    });
  });
})();
