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

/* ---- top-level nav links: menu-only on desktop ------------------------ */
/* The hub index pages are not used — on desktop the top-level items only
   open their mega-menu; navigation happens through the menu options.
   On mobile the mega-menu is hidden (display:none), so the top-level links
   must keep navigating — hence the computed-style check. */
function initTopNavLinks() {
  document.querySelectorAll('.nav__item > .nav__link[data-nav]').forEach((link) => {
    link.setAttribute('aria-haspopup', 'true');
    link.addEventListener('click', (e) => {
      const menu = link.parentElement.querySelector('.megamenu');
      if (menu && getComputedStyle(menu).display !== 'none') e.preventDefault();
    });
  });
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
    // minicards in the same section act as tabs (data-slide="<index>")
    const scope = carousel.closest('section') || document;
    const tabs = [...scope.querySelectorAll('.minicard[data-slide]')];
    const AUTO_MS = 6000;
    let index = 0;
    let timer = null;

    const isPlaying = () =>
      !!carousel.querySelector('iframe') ||
      [...carousel.querySelectorAll('video')].some((v) => !v.paused);
    const stopVideos = () => {
      slides.forEach((slide) => {
        const frame = slide.querySelector('iframe');
        if (frame) frame.remove();
        const vid = slide.querySelector('video');
        if (vid) { vid.pause(); vid.controls = false; }
        slide.classList.remove('is-playing');
      });
    };
    const goTo = (i) => {
      index = (i + slides.length) % slides.length;
      stopVideos();
      track.style.transform = `translateX(-${index * 100}%)`;
      tabs.forEach((tab) => tab.classList.toggle('minicard--active', Number(tab.dataset.slide) === index));
    };
    const startAuto = () => {
      clearInterval(timer);
      timer = setInterval(() => { if (!isPlaying()) goTo(index + 1); }, AUTO_MS);
    };

    tabs.forEach((tab) => {
      tab.addEventListener('click', (e) => {
        if (e.target.closest('a')) return;   // let the Learn More link navigate
        goTo(Number(tab.dataset.slide));
        startAuto();                          // reset the auto-advance timer
      });
    });
    slides.forEach((slide) => {
      const btn = slide.querySelector('.video-thumb__play');
      if (!btn) return;
      const vid = slide.querySelector('video');
      btn.addEventListener('click', () => {
        if (vid) {
          vid.controls = true;
          vid.play();
        } else if (slide.dataset.embed) {
          const frame = document.createElement('iframe');
          frame.src = slide.dataset.embed;
          frame.allow = 'autoplay; encrypted-media; fullscreen';
          frame.allowFullscreen = true;
          frame.title = btn.getAttribute('aria-label') || 'Video';
          slide.appendChild(frame);
        } else return;
        slide.classList.add('is-playing');
      });
    });

    carousel.addEventListener('mouseenter', () => clearInterval(timer));
    carousel.addEventListener('mouseleave', startAuto);
    startAuto();
  });
}

/* ---- tab panels (solutions visibility tabs) ---------------------------- */
function initTabs() {
  document.querySelectorAll('[data-tabs]').forEach((root) => {
    const tabs = [...root.querySelectorAll('[role="tab"]')];
    const panels = [...root.querySelectorAll('[role="tabpanel"]')];
    tabs.forEach((tab, i) => {
      tab.addEventListener('click', () => {
        tabs.forEach((t, j) => {
          t.classList.toggle('is-active', j === i);
          t.setAttribute('aria-selected', String(j === i));
        });
        panels.forEach((p, j) => p.classList.toggle('is-active', j === i));
      });
    });
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
  initTopNavLinks();
  initNavToggle();
  initHeaderScroll();
  initVideoButtons();
  initVideoCarousel();
  initTabs();
  initBrandDots();
});
