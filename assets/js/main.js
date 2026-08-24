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

    // engaged = an embed is open, or a <video> is playing OR was started and
    // paused mid-way — in all cases the carousel must not auto-advance
    const isEngaged = () =>
      !!carousel.querySelector('iframe') ||
      [...carousel.querySelectorAll('video')].some((v) => !v.paused || (v.currentTime > 0 && !v.ended));
    const stopVideos = () => {
      slides.forEach((slide) => {
        const frame = slide.querySelector('iframe');
        if (frame) frame.remove();
        const vid = slide.querySelector('video');
        if (vid) { vid.pause(); vid.currentTime = 0; }
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
      timer = setInterval(() => { if (!isEngaged()) goTo(index + 1); }, AUTO_MS);
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

/* ---- custom video controls --------------------------------------------- */
/* One shared control bar (play/pause · time · seek · volume · fullscreen)
   injected into every video wrapper. Replaces the browser's native controls
   so the player looks the same in Chrome/Firefox/Safari and matches the
   site palette. Bar shows once the overlay play button starts the video
   (`.is-playing` on the wrapper) and fades out while playing + pointer idle. */
function initCustomVideoControls() {
  const fmt = (s) => {
    if (!isFinite(s) || s < 0) return '0:00';
    return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
  };

  /* inline SVGs — the site's Material Symbols subset (icon_names=…) doesn't
     include the player glyphs, so the bar carries its own icons */
  const ICON = {
    play:    'M8 5v14l11-7z',
    pause:   'M6 19h4V5H6v14zm8-14v14h4V5h-4z',
    replay:  'M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z',
    vol:     'M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z',
    mute:    'M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3 3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4 9.91 6.09 12 8.18V4z',
    fs:      'M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z',
    fsExit:  'M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z',
  };
  const svg = (key) =>
    `<svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" aria-hidden="true"><path d="${ICON[key]}"/></svg>`;

  document.querySelectorAll('.video-thumb video, .video-carousel__slide video').forEach((video) => {
    const box = video.closest('.video-thumb, .video-carousel__slide');
    if (!box || box.querySelector('.vctl')) return;
    video.removeAttribute('controls');

    const bar = document.createElement('div');
    bar.className = 'vctl';
    bar.innerHTML = `
      <button type="button" class="vctl__btn vctl__toggle" aria-label="Pause">${svg('pause')}</button>
      <span class="vctl__time">0:00 / 0:00</span>
      <div class="vctl__track" role="slider" tabindex="0" aria-label="Seek" aria-valuemin="0" aria-valuemax="0" aria-valuenow="0">
        <div class="vctl__fill"></div><div class="vctl__dot"></div>
      </div>
      <button type="button" class="vctl__btn vctl__mute" aria-label="Mute">${svg('vol')}</button>
      <input class="vctl__vol" type="range" min="0" max="1" step="0.05" value="1" aria-label="Volume">
      <button type="button" class="vctl__btn vctl__fs" aria-label="Full screen">${svg('fs')}</button>`;
    box.appendChild(bar);

    const toggleBtn = bar.querySelector('.vctl__toggle');
    const timeEl    = bar.querySelector('.vctl__time');
    const track     = bar.querySelector('.vctl__track');
    const fill      = bar.querySelector('.vctl__fill');
    const dot       = bar.querySelector('.vctl__dot');
    const muteBtn   = bar.querySelector('.vctl__mute');
    const volInput  = bar.querySelector('.vctl__vol');
    const fsBtn     = bar.querySelector('.vctl__fs');

    const setIcon = (btn, key, label) => {
      btn.innerHTML = svg(key);
      btn.setAttribute('aria-label', label);
    };

    /* progress + time readout */
    const paint = () => {
      const dur = video.duration;
      const pct = isFinite(dur) && dur > 0 ? (video.currentTime / dur) * 100 : 0;
      fill.style.width = `${pct}%`;
      dot.style.left = `${pct}%`;
      timeEl.textContent = `${fmt(video.currentTime)} / ${fmt(dur)}`;
      track.setAttribute('aria-valuemax', isFinite(dur) ? Math.round(dur) : 0);
      track.setAttribute('aria-valuenow', Math.round(video.currentTime));
      track.setAttribute('aria-valuetext', `${fmt(video.currentTime)} of ${fmt(dur)}`);
    };
    video.addEventListener('timeupdate', paint);
    video.addEventListener('loadedmetadata', paint);
    video.addEventListener('durationchange', paint);

    /* auto-hide while playing and the pointer is idle */
    let hideTimer = null;
    function wake() {
      bar.classList.remove('vctl--hide');
      clearTimeout(hideTimer);
      if (!video.paused) hideTimer = setTimeout(() => {
        if (!video.paused && !bar.matches(':hover, :focus-within')) bar.classList.add('vctl--hide');
      }, 2600);
    }
    box.addEventListener('pointermove', wake);
    bar.addEventListener('focusin', wake);

    /* play / pause / replay */
    const toggle = () => (video.paused ? video.play() : video.pause());
    toggleBtn.addEventListener('click', toggle);
    video.addEventListener('click', () => { if (box.classList.contains('is-playing')) toggle(); });
    video.addEventListener('play',  () => { setIcon(toggleBtn, 'pause', 'Pause'); wake(); });
    video.addEventListener('pause', () => { setIcon(toggleBtn, video.ended ? 'replay' : 'play', video.ended ? 'Replay' : 'Play'); wake(); });

    /* seek: click / drag / arrow keys */
    const seekTo = (clientX) => {
      const r = track.getBoundingClientRect();
      const p = Math.min(1, Math.max(0, (clientX - r.left) / r.width));
      if (isFinite(video.duration)) video.currentTime = p * video.duration;
      paint();
    };
    track.addEventListener('pointerdown', (e) => {
      seekTo(e.clientX);
      try { track.setPointerCapture(e.pointerId); } catch { /* synthetic events have no active pointer */ }
    });
    track.addEventListener('pointermove', (e) => { if (track.hasPointerCapture(e.pointerId)) seekTo(e.clientX); });
    track.addEventListener('keydown', (e) => {
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
      e.preventDefault();
      const step = e.key === 'ArrowRight' ? 5 : -5;
      video.currentTime = Math.min(video.duration || 0, Math.max(0, video.currentTime + step));
    });

    /* volume */
    const paintVolume = () => {
      const off = video.muted || video.volume === 0;
      setIcon(muteBtn, off ? 'mute' : 'vol', off ? 'Unmute' : 'Mute');
      volInput.value = video.muted ? 0 : video.volume;
    };
    muteBtn.addEventListener('click', () => { video.muted = !video.muted; });
    volInput.addEventListener('input', () => {
      video.volume = Number(volInput.value);
      video.muted = video.volume === 0;
    });
    video.addEventListener('volumechange', paintVolume);

    /* fullscreen on the wrapper so the custom bar stays visible */
    fsBtn.addEventListener('click', () => {
      if (document.fullscreenElement) document.exitFullscreen();
      else if (box.requestFullscreen) box.requestFullscreen();
    });
    document.addEventListener('fullscreenchange', () => {
      const on = document.fullscreenElement === box;
      setIcon(fsBtn, on ? 'fsExit' : 'fs', on ? 'Exit full screen' : 'Full screen');
    });

    paint();
    paintVolume();
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

/* ---- white paper downloads -------------------------------------------- */
/* Featured white paper "Download" buttons carry data-wp-download="<pdf>".
   Clicking one downloads that pdf straight away — there is no name / email
   gate any more. Content that still ships the old [data-wp-gate] modal has it
   stripped here so it can never open. */
function initWhitePaperGate() {
  document.querySelectorAll('[data-wp-gate]').forEach((gate) => gate.remove());

  document.querySelectorAll('[data-wp-download]').forEach((btn) => {
    if (btn.dataset.wpBound) return;
    btn.dataset.wpBound = '1';
    btn.addEventListener('click', () => {
      const file = btn.dataset.wpDownload;
      if (!file) return;
      const a = document.createElement('a');
      a.href = file;
      a.download = file.split('/').pop();
      document.body.appendChild(a);
      a.click();
      a.remove();
    });
  });
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
    /* the 16:9 YouTube box's rendered height, for data-match="yt" posts */
    const yt = document.querySelector('.li-embeds .yt-embed');
    const ytH = yt ? (yt.clientWidth * 9) / 16 : 0;
    wraps.forEach((wrap) => {
      const frame = wrap.querySelector('iframe');
      if (!frame) return;
      const h = parseInt(wrap.dataset.h, 10) || 1200;
      const scale = wrap.clientWidth / NATIVE_W;
      /* data-match="yt" caps the visible height to the YouTube box beside it;
         the rest of the post scrolls inside the iframe (its scrolling
         attribute must not be "no") */
      let view = h;
      if (wrap.dataset.match === 'yt' && ytH) view = Math.min(h, ytH / scale);
      frame.style.width = `${NATIVE_W}px`;
      frame.style.height = `${view}px`;
      frame.style.transform = `scale(${scale})`;
      wrap.style.height = `${view * scale}px`;
    });
  };
  fit();
  window.addEventListener('resize', fit);
}

/* ---- LinkedIn feed widget: whole-post click-through --------------------- */
/* The Common Ninja feed widget has no "open post on LinkedIn" setting — only
   its like/share anchors link out. It renders in an OPEN shadow root, so a
   composed click on the host can be retargeted: any click on a post card
   (article.feed-content-item) opens that post's LinkedIn URL, unless the
   click landed on one of the widget's own links/buttons. */
function initLinkedInFeedClick() {
  const host = document.querySelector('.li-feed .commonninja_component');
  if (!host) return;
  host.addEventListener('click', (e) => {
    const path = e.composedPath();
    if (path.some((n) => n.tagName === 'A' || n.tagName === 'BUTTON')) return;
    const card = path.find((n) => n.classList && n.classList.contains('feed-content-item'));
    const link = card && card.querySelector('a[href*="linkedin.com/posts/"]');
    if (link) window.open(link.href, '_blank', 'noopener');
  });
  /* cursor hint on cards — the widget rebuilds its shadow content on load, so
     wait until the first card exists before appending the style tag */
  const poll = setInterval(() => {
    const sr = host.shadowRoot;
    if (sr && sr.querySelector('.feed-content-item')) {
      const style = document.createElement('style');
      style.textContent = 'article.feed-content-item, article.feed-content-item * { cursor: pointer !important; }';
      sr.appendChild(style);
      clearInterval(poll);
    }
  }, 500);
  setTimeout(() => clearInterval(poll), 30000);
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

/* ---- home: intelligence-engines core — revolving factor text ----------- */
/* Cycles the operational factors Atlas understands through the centre of the
   ie-diagram with a fast fade in / fade out (content request Aug 2026). */
const IE_FACTORS = [
  'Fatigue & Alertness', 'Shift Duration', 'Personnel Location',
  'Situational Awareness', 'Vehicle Proximity', 'Vehicle Speed',
  'Traffic Congestion', 'Temperature & Humidity', 'Gas Concentrations',
  'Oxygen Level', 'DPM & Particulates', 'Ventilation Performance',
  'Airflow Direction', 'Equipment Condition', 'Energy', 'Fire Detection Status',
  'Restricted Zones', 'Competency & Authorisation', 'Training & Inductions', 'PPE Status',
  'Communication Systems', 'Emergency Route Availability',
  'Evacuation Readiness', 'Muster Status', 'Weather Conditions',
  'Noise Exposure', 'Blasting Schedule', 'Fragmentation', 'Work Permits', 'Identified Hazards', 'Ground Stability',
  'Ground Movement', 'Shutdowns', 'Maintenance', 'WHS Regulations',
];
function initIeCycle() {
  const el = document.querySelector('[data-ie-cycle]');
  if (!el) return;
  const words = IE_FACTORS;
  const FADE = 200;   /* ms — matches the CSS opacity transition */
  const HOLD = 1200;  /* ms visible before fading out */
  let i = 0;
  el.textContent = words[0];
  el.classList.add('is-in');
  setInterval(() => {
    el.classList.remove('is-in');
    setTimeout(() => {
      i = (i + 1) % words.length;
      el.textContent = words[i];
      el.classList.add('is-in');
    }, FADE);
  }, HOLD + FADE);
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
  initCustomVideoControls();
  initTabs();
  initMapExplorer();
  initDashCarousel();
  initBrandMarquee();
  initCardReveal();
  initWhitePaperGate();
  initLinkedInEmbeds();
  initLinkedInFeedClick();
  initIeCycle();
});
