/* Vector Tag cradle 360 viewer — homepage "End-to-End Accountability" highlight.
   Single auto-spinning panel; the fixed-geometry card (sized in main.css) is
   scaled to fit whatever width .d81-fit gets from the layout. */
(function () {
  var fit = document.getElementById('d81-fit');
  if (!fit) return;
  var card = fit.querySelector('.d81-card');
  var img = document.getElementById('d81-cradle-img');

  /* Scale the fixed-geometry card to the container */
  function rescale() {
    var s = Math.min(1, fit.clientWidth / card.offsetWidth);
    card.style.transform = 'scale(' + s + ')';
    fit.style.height = Math.round(card.offsetHeight * s) + 'px';
  }
  if (window.ResizeObserver) new ResizeObserver(rescale).observe(fit);
  else window.addEventListener('resize', rescale);
  rescale();

  /* 36 frames at 10 degree steps — renders captured from the designer's
     Spline scene; only the src swaps. */
  var frames = [];
  for (var i = 1; i <= 36; i++) {
    frames.push('assets/img/vectortag360/cradle360-' + (i < 10 ? '0' : '') + i + '.webp');
  }
  frames.forEach(function (src) { new Image().src = src; });   // preload

  /* Auto-spin: one frame every 110ms ≈ 4s per full revolution.
     Paused while the tab is hidden (setInterval throttles anyway, but the
     visibility check keeps the rotation from jumping when tabbing back). */
  var f = 0;
  setInterval(function () {
    if (document.hidden) return;
    f = (f + 1) % frames.length;
    img.src = frames[f];
  }, 110);
})();
