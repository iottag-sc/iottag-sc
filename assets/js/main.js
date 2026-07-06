/* ==========================================================================
   iottag — site JavaScript
   Header + footer live in /partials/*.html and are FETCHED at runtime into
   [data-include] placeholders. Serve over http (e.g. `python -m http.server`)
   — fetch does not work on the file:// protocol.
   - injects shared header / footer from /partials into [data-include] slots
   - rewrites the root-relative ("/…") links to the page's depth (data-base)
   - active nav highlighting, mobile nav toggle, small UI hooks
   ========================================================================== */

/* map a data-include name to its partial file under /partials */
const PARTIALS = {
  header: 'partials/header.html',
  footer: 'partials/footer.html',
};

/* ---- inject shared partials (fetched from /partials) ------------------- */
async function injectPartials() {
  const base = document.body.dataset.base || '';
  const rebase = (html) => html.replace(/(href|src)="\/(?!\/)/g, `$1="${base}`);
  const slots = document.querySelectorAll('[data-include]');

  await Promise.all(Array.from(slots, async (el) => {
    const which = el.getAttribute('data-include') || '';
    const key = which.includes('footer') ? 'footer'
              : which.includes('header') ? 'header' : '';
    const path = PARTIALS[key];
    if (!path) return;
    try {
      const res = await fetch(`${base}${path}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      el.outerHTML = rebase(await res.text());
    } catch (err) {
      console.error(`Failed to load partial "${key}" from ${base}${path}:`, err);
    }
  }));
}

/* ---- active nav ------------------------------------------------------- */
function setActiveNav() {
  const page = document.body.dataset.page;
  if (!page) return;
  const link = document.querySelector(`.nav__link[data-nav="${page}"]`);
  if (link) link.setAttribute('aria-current', 'page');
}

/* ---- mobile nav toggle ------------------------------------------------ */
function initNavToggle() {
  const toggle = document.getElementById('nav-toggle');
  const nav = document.getElementById('primary-nav');
  if (!toggle || !nav) return;
  toggle.addEventListener('click', () => {
    const open = nav.classList.toggle('is-open');
    toggle.setAttribute('aria-expanded', String(open));
    toggle.querySelector('.icon').textContent = open ? 'close' : 'menu';
  });
}

/* ---- sticky header color state --------------------------------------- */
function initHeaderScroll() {
  const header = document.querySelector('.site-header');
  if (!header) return;

  const updateHeaderState = () => {
    header.classList.toggle('site-header--scrolled', window.scrollY > 8);
  };

  updateHeaderState();
  window.addEventListener('scroll', updateHeaderState, { passive: true });
}

/* ---- video overlays ---------------------------------------------------- */
function initVideoButtons() {
  document.querySelectorAll('[data-video]').forEach((btn) => {
    const thumb = btn.closest('.video-thumb');
    const video = thumb && thumb.querySelector('video');
    btn.addEventListener('click', () => {
      if (!video) { console.log('Play video:', btn.dataset.video || '(demo)'); return; }
      thumb.classList.add('is-playing');
      video.controls = true;
      video.play();
    });
  });
}

/* ---- video carousel (factors banner) ----------------------------------- */
function initVideoCarousel() {
  document.querySelectorAll('[data-video-carousel]').forEach((carousel) => {
    const track = carousel.querySelector('.video-carousel__track');
    const slides = [...carousel.querySelectorAll('.video-carousel__slide')];
    const dots = [...carousel.querySelectorAll('.slider__dots > *')];
    const AUTO_MS = 6000;
    let index = 0;
    let timer = null;

    const isPlaying = () => !!carousel.querySelector('iframe');
    const stopVideos = () => {
      slides.forEach((slide) => {
        const frame = slide.querySelector('iframe');
        if (frame) frame.remove();
        slide.classList.remove('is-playing');
      });
    };
    const goTo = (i) => {
      index = (i + slides.length) % slides.length;
      stopVideos();
      track.style.transform = `translateX(-${index * 100}%)`;
      dots.forEach((d, n) => d.classList.toggle('is-active', n === index));
    };
    const startAuto = () => {
      clearInterval(timer);
      timer = setInterval(() => { if (!isPlaying()) goTo(index + 1); }, AUTO_MS);
    };

    dots.forEach((dot, n) => dot.addEventListener('click', () => goTo(n)));
    slides.forEach((slide) => {
      const btn = slide.querySelector('.video-thumb__play');
      if (!btn || !slide.dataset.embed) return;
      btn.addEventListener('click', () => {
        const frame = document.createElement('iframe');
        frame.src = slide.dataset.embed;
        frame.allow = 'autoplay; encrypted-media; fullscreen';
        frame.allowFullscreen = true;
        frame.title = btn.getAttribute('aria-label') || 'Video';
        slide.appendChild(frame);
        slide.classList.add('is-playing');
      });
    });

    carousel.addEventListener('mouseenter', () => clearInterval(timer));
    carousel.addEventListener('mouseleave', startAuto);
    startAuto();
  });
}

/* ---- brand carousel dots (decorative) --------------------------------- */
function initBrandDots() {
  document.querySelectorAll('[data-dots]').forEach((group) => {
    const dots = group.querySelectorAll('span');
    dots.forEach((dot) => {
      dot.style.cursor = 'pointer';
      dot.addEventListener('click', () => {
        dots.forEach((d) => d.classList.remove('is-active'));
        dot.classList.add('is-active');
      });
    });
  });
}

/* ---- boot ------------------------------------------------------------- */
document.addEventListener('DOMContentLoaded', async () => {
  await injectPartials();   // nav/footer must exist before wiring the hooks below
  setActiveNav();
  initNavToggle();
  initHeaderScroll();
  initVideoButtons();
  initVideoCarousel();
  initBrandDots();
});
