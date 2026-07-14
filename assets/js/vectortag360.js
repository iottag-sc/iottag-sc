/* D81 Vector Tag 360 viewer — homepage "End-to-End Accountability" highlight.
   Two independent drag-rotatable panels; the fixed 800x420 card is
   scaled to fit whatever width .d81-fit gets from the layout. */
(function () {
  var fit = document.getElementById('d81-fit');
  if (!fit) return;
  var card = fit.querySelector('.d81-card');

  /* Scale the fixed-geometry card to the container (column layout when narrow) */
  function rescale() {
    card.classList.toggle('d81-card--col', fit.clientWidth < 480);
    var s = Math.min(1, fit.clientWidth / card.offsetWidth);
    card.style.transform = 'scale(' + s + ')';
    fit.style.height = Math.round(card.offsetHeight * s) + 'px';
  }
  if (window.ResizeObserver) new ResizeObserver(rescale).observe(fit);
  else window.addEventListener('resize', rescale);
  rescale();

  var DIRECTION = 1;      // set to -1 to invert the drag direction

  /* One self-contained viewer per panel — interacting with one never moves the other.
     pxPerStep = drag distance (px) per frame, tuned so a full revolution is ~300px. */
  function initViewer(panelId, imgId, states, pxPerStep) {
    var box = document.getElementById(panelId);
    var img = document.getElementById(imgId);
    states.forEach(function (s) { new Image().src = s.src; });   // preload

    var pos = 0, shown = 0;
    function render() {
      var n = states.length;
      var f = ((Math.round(pos) % n) + n) % n;   // wraps around 360°
      if (f === shown) return;
      shown = f;
      var s = states[f];
      img.src = s.src;
      if (s.l !== undefined) {                   // per-frame geometry (tag only)
        img.style.left = s.l + 'px';
        img.style.top = s.t + 'px';
        img.style.width = s.w + 'px';
        img.style.height = s.h + 'px';
      }
    }

    /* drag (mouse + touch via pointer events) */
    var dragging = false, startX = 0, startPos = 0;
    box.addEventListener('pointerdown', function (e) {
      dragging = true; startX = e.clientX; startPos = pos;
      box.classList.add('grabbing');
      box.setPointerCapture(e.pointerId);
    });
    box.addEventListener('pointermove', function (e) {
      if (!dragging) return;
      pos = startPos + (e.clientX - startX) / pxPerStep * DIRECTION;
      render();
    });
    function endDrag() {
      if (!dragging) return;
      dragging = false; pos = shown;
      box.classList.remove('grabbing');
    }
    box.addEventListener('pointerup', endDrag);
    box.addEventListener('pointercancel', endDrag);

    /* arrow keys */
    function step(d) { pos = shown + d; render(); }
    box.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowLeft') step(-1);
      if (e.key === 'ArrowRight') step(1);
    });
  }

  /* Both devices: 36 frames at 10 degree steps, pre-registered to the panel —
     only the src swaps. Cradle = renders captured from the designer's Spline
     scene; tag = geometric slab-spin synthesis from the 5 studio photos
     (front tag-5, back tag-4, side tag-2 — no 3D model of the bare tag exists). */
  function frames(prefix) {
    var out = [];
    for (var i = 1; i <= 36; i++) {
      out.push({ src: 'assets/img/vectortag360/' + prefix + '-' + (i < 10 ? '0' : '') + i + '.webp' });
    }
    return out;
  }
  initViewer('d81-tag-panel', 'd81-tag-img', frames('tag360'), 8);
  initViewer('d81-cradle-panel', 'd81-cradle-img', frames('cradle360'), 8);
})();
