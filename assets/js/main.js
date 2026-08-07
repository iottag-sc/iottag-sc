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
/* the /platform/ pages sit under Solutions → Atlas Core now that Platform has
   left the top-level nav, so their data-page highlights Solutions instead */
const NAV_ALIAS = { platform: 'solutions' };

function setActiveNav() {
  const page = document.body.dataset.page;
  if (!page) return;
  const link = document.querySelector(`.nav__link[data-nav="${NAV_ALIAS[page] || page}"]`);
  if (link) link.setAttribute('aria-current', 'page');
}

/* ---- top-level nav items: menu openers, never links -------------------- */
/* The section hub pages (/solutions/, /platform/, …) no longer exist, so the
   top-level items are <button>s, not links — there is nowhere for them to go.
   Desktop opens the mega-menu on hover/focus (CSS). Below 1100px the mega-menu
   is hidden, so tapping a button expands its options as an accordion instead —
   that is the only route to the detail pages on mobile. */
function initTopNavLinks() {
  document.querySelectorAll('.nav__item > .nav__link[data-nav]').forEach((btn) => {
    btn.setAttribute('aria-haspopup', 'true');
    btn.addEventListener('click', () => {
      const item = btn.parentElement;
      const menu = item.querySelector('.megamenu');
      /* desktop: hover/focus already reveals the menu — nothing to toggle */
      if (!menu || getComputedStyle(menu).display !== 'none') return;
      const open = !item.classList.contains('is-expanded');
      /* one section open at a time keeps the mobile sheet short */
      item.parentElement.querySelectorAll('.nav__item.is-expanded').forEach((other) => {
        if (other !== item) {
          other.classList.remove('is-expanded');
          const b = other.querySelector('.nav__link[data-nav]');
          if (b) b.setAttribute('aria-expanded', 'false');
        }
      });
      item.classList.toggle('is-expanded', open);
      btn.setAttribute('aria-expanded', String(open));
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
  document.querySelectorAll('[data-video], .video-thumb[data-embed] .video-thumb__play').forEach((btn) => {
    const thumb = btn.closest('.video-thumb');
    const video = thumb && thumb.querySelector('video');
    btn.addEventListener('click', () => {
      if (video) {
        thumb.classList.add('is-playing');
        video.controls = true;
        video.play();
      } else if (thumb && thumb.dataset.embed) {
        const frame = document.createElement('iframe');
        frame.className = 'video-thumb__frame';
        frame.src = thumb.dataset.embed;
        frame.allow = 'autoplay; encrypted-media; fullscreen';
        frame.allowFullscreen = true;
        frame.title = btn.getAttribute('aria-label') || 'Video';
        thumb.appendChild(frame);
        thumb.classList.add('is-playing');
      } else {
        console.log('Play video:', btn.dataset.video || '(demo)');
      }
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

/* ---- ODT map explorer (sidebar tabs toggle layered overlay views) ------ */
function initMapExplorer() {
  document.querySelectorAll('[data-map-explorer]').forEach((root) => {
    const tabs = [...root.querySelectorAll('.odt3-x__tab')];
    const panel = root.querySelector('.odt3-x__panel');
    const views = [...root.querySelectorAll('.odt3-x__view')];
    if (!panel || !views.length) return;
    const activate = (tab) => {
      const key = tab ? tab.dataset.view : '';
      tabs.forEach((t) => {
        t.classList.toggle('is-active', t === tab);
        t.setAttribute('aria-selected', String(t === tab));
      });
      views.forEach((v) => v.classList.toggle('is-active', v.dataset.view === key));
      if (key) panel.dataset.active = key;
      else delete panel.dataset.active;
    };
    const tablist = root.querySelector('.odt3-x__tabs');
    tabs.forEach((tab) => {
      // a view shows only while its tab is hovered (click covers touch + keyboard)
      tab.addEventListener('pointerenter', () => activate(tab));
      tab.addEventListener('click', () => activate(tab));
      tab.addEventListener('focus', () => activate(tab));
    });
    // leaving the tab rail -> back to the plain full map (no overlay popups);
    // touch fires pointerleave right after a tap, so only revert for mouse
    tablist.addEventListener('pointerleave', (e) => {
      if (e.pointerType !== 'touch') activate(null);
    });
    tablist.addEventListener('focusout', (e) => {
      if (!tablist.contains(e.relatedTarget)) activate(null);
    });
    // warm the cache once the explorer is first approached: lazy images inside
    // display:none views never load until shown, so force-fetch them here
    root.addEventListener('pointerenter', () => {
      root.querySelectorAll('.odt3-x__view img').forEach((im) => { new Image().src = im.src; });
    }, { once: true });
  });
}

/* ---- ODT tablet dashboard fade carousel -------------------------------- */
function initDashCarousel() {
  document.querySelectorAll('[data-dash-carousel]').forEach((root) => {
    const slides = [...root.querySelectorAll('.odt3-tablet__screen img')];
    const dots = [...root.querySelectorAll('.odt3-dots span')];
    if (slides.length < 2) return;
    let index = 0;
    const show = (n) => {
      index = n;
      slides.forEach((s, j) => s.classList.toggle('is-active', j === n));
      dots.forEach((d, j) => d.classList.toggle('is-active', j === n));
    };
    let timer = setInterval(() => show((index + 1) % slides.length), 5000);
    dots.forEach((dot, j) => {
      dot.style.cursor = 'pointer';
      dot.addEventListener('click', () => {
        clearInterval(timer);
        show(j);
        timer = setInterval(() => show((index + 1) % slides.length), 5000);
      });
    });
  });
}

/* ---- brand logo marquee ------------------------------------------------ */
/* The CSS loop translates the track by -50%, which is only seamless while
   half the track is at least as wide as the viewport. On very wide viewports
   (e.g. the page zoomed far out) the two logo sets in the HTML aren't enough
   and a gap appears, so keep doubling the logo cards until they are. */
function initBrandMarquee() {
  document.querySelectorAll('.brand-marquee__track').forEach((track) => {
    const baseDuration = 40; // s, matches the CSS animation for the 2 HTML sets
    let doublings = 0;
    const fill = () => {
      while (track.scrollWidth < window.innerWidth * 2 && doublings < 5) {
        [...track.children].forEach((card) => {
          const clone = card.cloneNode(true);
          clone.setAttribute('aria-hidden', 'true');
          track.appendChild(clone);
        });
        doublings += 1;
        // twice the cards means twice the -50% travel; slow the loop to match
        track.style.animationDuration = `${baseDuration * 2 ** doublings}s`;
      }
    };
    fill();
    window.addEventListener('resize', fill);
  });
}

/* ---- white paper download gate ---------------------------------------- */
/* Featured white paper "Download" buttons carry data-wp-download="<pdf>".
   Clicking one opens the gate; submitting it downloads that pdf. The name /
   email fields are a placeholder — nothing is captured or validated yet, so
   the download always proceeds. Post the values here once there is a backend. */
function initWhitePaperGate() {
  const gate = document.querySelector('[data-wp-gate]');
  if (!gate) return;
  const form = gate.querySelector('[data-wp-gate-form]');
  let file = '';
  let opener = null;

  /* hiding the page scrollbar widens the viewport — measure how much and let
     .is-gate-open pad it back, so the page behind does not shift right */
  const lockScroll = () => {
    const before = document.documentElement.clientWidth;
    document.body.classList.add('is-gate-open');
    const gap = document.documentElement.clientWidth - before;
    document.documentElement.style.setProperty('--sb-gutter', `${Math.max(gap, 0)}px`);
  };
  const unlockScroll = () => {
    document.body.classList.remove('is-gate-open');
    document.documentElement.style.removeProperty('--sb-gutter');
  };

  const open = (btn) => {
    file = btn.dataset.wpDownload || '';
    opener = btn;
    gate.hidden = false;
    lockScroll();
    const first = gate.querySelector('input');
    if (first) first.focus();
  };
  const close = () => {
    gate.hidden = true;
    unlockScroll();
    if (form) form.reset();
    if (opener) opener.focus();
    opener = null;
  };

  document.querySelectorAll('[data-wp-download]').forEach((btn) => {
    btn.addEventListener('click', () => open(btn));
  });
  gate.querySelectorAll('[data-wp-gate-close]').forEach((el) => {
    el.addEventListener('click', close);
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !gate.hidden) close();
  });

  if (form) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      /* TODO: send new FormData(form) to the lead capture endpoint */
      if (file) {
        const a = document.createElement('a');
        a.href = file;
        a.download = file.split('/').pop();
        document.body.appendChild(a);
        a.click();
        a.remove();
      }
      close();
    });
  }
}

/* ---- LinkedIn embeds: scale native-size iframes to their column --------- */
/* A cross-origin iframe cannot grow to fit its content, so a fluid-width
   embed clips whatever exceeds its fixed CSS height. Instead each embed keeps
   LinkedIn's native 504px layout at its full post height (data-h on the
   .li-embed wrapper) and is scaled down to the column width — the content
   never rewraps, so the height stays valid and nothing is cut off at any
   viewport size. */
function initLinkedInEmbeds() {
  const wraps = document.querySelectorAll('.li-embed');
  if (!wraps.length) return;
  const NATIVE_W = 504;
  const fit = () => {
    wraps.forEach((wrap) => {
      const frame = wrap.querySelector('iframe');
      if (!frame) return;
      const h = parseInt(wrap.dataset.h, 10) || 1200;
      const scale = wrap.clientWidth / NATIVE_W;
      frame.style.width = `${NATIVE_W}px`;
      frame.style.height = `${h}px`;
      frame.style.transform = `scale(${scale})`;
      wrap.style.height = `${h * scale}px`;
    });
  };
  fit();
  window.addEventListener('resize', fit);
}

/* ---- "View more" card reveal (Tunnelling · Recent Projects) ------------ */
/* The overflow cards ship in the HTML behind [hidden] so crawlers still see
   them; the button flips them on and relabels itself View more / View less. */
function initCardReveal() {
  document.querySelectorAll('[data-proj-toggle]').forEach((btn) => {
    const grid = document.getElementById(btn.getAttribute('aria-controls'));
    if (!grid) return;
    const extras = grid.querySelectorAll('.proj-card--more');
    if (!extras.length) return;
    const label = btn.querySelector('.proj-more__label');

    btn.addEventListener('click', () => {
      const open = btn.getAttribute('aria-expanded') === 'true';
      extras.forEach((card) => { card.hidden = open; });
      btn.setAttribute('aria-expanded', String(!open));
      if (label) label.textContent = open ? 'View more' : 'View less';
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
  initMapExplorer();
  initDashCarousel();
  initBrandMarquee();
  initCardReveal();
  initWhitePaperGate();
  initLinkedInEmbeds();
});
