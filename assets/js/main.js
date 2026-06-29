/* ==========================================================================
   iottag — site JavaScript
   Header + footer are EMBEDDED here (not fetched) so the site works when the
   HTML files are opened directly from disk (file://) as well as over http.
   - injects shared header / footer into [data-include] placeholders
   - rewrites the root-relative ("/…") links to the page's depth (data-base)
   - active nav highlighting, mobile nav toggle, small UI hooks
   ========================================================================== */

const HEADER_HTML = `
<header class="site-header">
  <a class="brand" href="/index.html" aria-label="iottag home">
    <svg class="brand__mark" width="26" height="26" viewBox="0 0 26 26" fill="none" aria-hidden="true">
      <line x1="5" y1="20" x2="13" y2="11" stroke="#2da2db" stroke-width="1.8"/>
      <line x1="13" y1="11" x2="20" y2="17" stroke="#2da2db" stroke-width="1.8"/>
      <circle cx="5" cy="20" r="3" fill="#2da2db"/>
      <circle cx="20" cy="17" r="3" fill="#2da2db"/>
      <circle cx="14.5" cy="9" r="5" fill="none" stroke="#2da2db" stroke-width="2.2"/>
    </svg>
    <span class="brand__name">iottag</span>
    <span class="brand__tm">&trade;</span>
  </a>
  <nav class="nav" id="primary-nav" aria-label="Primary">
    <div class="nav__item">
      <a class="nav__link" href="/solutions/index.html" data-nav="solutions">Solutions</a>
      <div class="megamenu"><div class="megamenu__inner">
        <a class="megamenu__opt" href="/solutions/operational-digital-twin/index.html"><strong>Operational Digital Twin</strong><span>A live operational understanding of the operation</span></a>
        <a class="megamenu__opt" href="/solutions/fatal-risk-intelligence/index.html"><strong>Fatal Risk Intelligence</strong><span>Predicting risk before it escalates</span></a>
        <a class="megamenu__opt" href="/solutions/production-intelligence/index.html"><strong>Production Intelligence</strong><span>Understanding the factors influencing performance</span></a>
      </div></div>
    </div>
    <div class="nav__item">
      <a class="nav__link" href="/platform/index.html" data-nav="platform">Platform</a>
      <div class="megamenu"><div class="megamenu__inner">
        <a class="megamenu__opt" href="/platform/operational-intelligence/index.html"><strong>Operational Intelligence</strong><span>The next evolution of operational visibility</span></a>
        <a class="megamenu__opt" href="/platform/workforce-visibility/index.html"><strong>Workforce Visibility</strong><span>See personnel activity and accountability</span></a>
        <a class="megamenu__opt" href="/platform/fleet-visibility/index.html"><strong>Fleet Visibility</strong><span>Understand vehicle movement and interaction</span></a>
        <a class="megamenu__opt" href="/platform/asset-visibility/index.html"><strong>Asset Visibility</strong><span>Track critical assets and resources</span></a>
        <a class="megamenu__opt" href="/platform/environmental-monitoring/index.html"><strong>Environmental Monitoring</strong><span>Understand changing site conditions</span></a>
        <a class="megamenu__opt" href="/platform/executive-visibility/index.html"><strong>Executive Visibility &amp; Benchmarking</strong><span>Portfolio-level dashboards and KPIs</span></a>
      </div></div>
    </div>
    <div class="nav__item">
      <a class="nav__link" href="/industries/index.html" data-nav="industries">Industries</a>
      <div class="megamenu"><div class="megamenu__inner">
        <a class="megamenu__opt" href="/industries/mining/index.html"><strong>Mining</strong><span>Underground and open-cut operations</span></a>
        <a class="megamenu__opt" href="/industries/tunnelling/index.html"><strong>Tunnelling</strong><span>Major tunnel construction projects</span></a>
        <a class="megamenu__opt" href="/industries/construction-infrastructure/index.html"><strong>Construction &amp; Infrastructure</strong><span>Civil and transport infrastructure</span></a>
        <a class="megamenu__opt" href="/industries/bridge-construction-maintenance/index.html"><strong>Bridge Construction &amp; Maintenance</strong><span>Construction and refurbishment</span></a>
        <a class="megamenu__opt" href="/industries/critical-infrastructure/index.html"><strong>Critical Infrastructure</strong><span>Healthcare and critical facilities</span></a>
      </div></div>
    </div>
    <div class="nav__item">
      <a class="nav__link" href="/technology/index.html" data-nav="technology">Technology</a>
      <div class="megamenu"><div class="megamenu__inner">
        <a class="megamenu__opt" href="/technology/engineering-hardware/index.html"><strong>Engineering &amp; Hardware</strong><span>Purpose-built, supported and maintained</span></a>
        <a class="megamenu__opt" href="/technology/vector-tag/index.html"><strong>Vector Tag</strong><span>The industrial wearable at the core</span></a>
        <a class="megamenu__opt" href="/technology/positioning-technologies/index.html"><strong>Positioning Technologies</strong><span>Granular positioning everywhere</span></a>
        <a class="megamenu__opt" href="/technology/iot-security-governance/index.html"><strong>IoT Security &amp; Governance</strong><span>Enterprise-grade security and control</span></a>
        <a class="megamenu__opt" href="/technology/integrations-ecosystem/index.html"><strong>Integrations &amp; Ecosystem</strong><span>Connect existing operational systems</span></a>
      </div></div>
    </div>
    <div class="nav__item">
      <a class="nav__link" href="/resources/index.html" data-nav="resources">Resources</a>
      <div class="megamenu"><div class="megamenu__inner">
        <a class="megamenu__opt" href="/resources/case-studies/index.html"><strong>Case Studies</strong><span>Real projects, real outcomes</span></a>
        <a class="megamenu__opt" href="/resources/video-library/index.html"><strong>Video Library</strong><span>Watch the platform in action</span></a>
        <a class="megamenu__opt" href="/resources/articles-insights/index.html"><strong>Articles &amp; Insights</strong><span>Perspectives on Operational Intelligence</span></a>
        <a class="megamenu__opt" href="/resources/white-papers/index.html"><strong>White Papers</strong><span>In-depth research and analysis</span></a>
      </div></div>
    </div>
    <div class="nav__item">
      <a class="nav__link" href="/company/index.html" data-nav="company">Company</a>
      <div class="megamenu"><div class="megamenu__inner">
        <a class="megamenu__opt" href="/company/about/index.html"><strong>About iottag</strong><span>Our story and mission</span></a>
        <a class="megamenu__opt" href="/company/why-iottag/index.html"><strong>Why iottag</strong><span>What makes us different</span></a>
        <a class="megamenu__opt" href="/company/partners/index.html"><strong>Partners</strong><span>Building stronger together</span></a>
        <a class="megamenu__opt" href="/company/careers/index.html"><strong>Careers</strong><span>Join the team</span></a>
        <a class="megamenu__opt" href="/company/contact/index.html"><strong>Contact</strong><span>Let's explore what's possible</span></a>
      </div></div>
    </div>
  </nav>
  <div class="nav-actions">
    <a class="btn btn--ghost" href="/company/contact/index.html">Login</a>
    <a class="btn btn--primary" href="/company/contact/index.html">Book Demo</a>
    <button class="nav-toggle" id="nav-toggle" aria-label="Toggle menu" aria-expanded="false"><span class="icon">menu</span></button>
  </div>
</header>`;

const FOOTER_HTML = `
<footer class="footer">
  <div class="footer__inner">
    <div class="footer__top">
      <img class="footer__logo" src="/assets/img/footer-logo.png" alt="iottag logo" width="138" height="50">
      <div class="footer__cols">
        <div class="footer__col">
          <h2>Solutions</h2>
          <a href="/solutions/operational-digital-twin/index.html">Operational Digital Twin</a>
          <a href="/solutions/fatal-risk-intelligence/index.html">Fatal Risk Intelligence</a>
          <a href="/solutions/production-intelligence/index.html">Production Intelligence</a>
          <a href="/solutions/index.html">All Solutions</a>
        </div>
        <div class="footer__col">
          <h2>Industries</h2>
          <a href="/industries/mining/index.html">Mining</a>
          <a href="/industries/tunnelling/index.html">Tunnelling</a>
          <a href="/industries/construction-infrastructure/index.html">Construction</a>
          <a href="/industries/critical-infrastructure/index.html">Critical Infrastructure</a>
        </div>
        <div class="footer__col">
          <h2>Capabilities</h2>
          <a href="/technology/engineering-hardware/index.html">Engineering</a>
          <a href="/technology/positioning-technologies/index.html">Positioning Technologies</a>
          <a href="/technology/iot-security-governance/index.html">IoT Security &amp; Governance</a>
        </div>
        <div class="footer__col">
          <h2>Resources</h2>
          <a href="/resources/articles-insights/index.html">Insights</a>
          <a href="/resources/white-papers/index.html">White Papers</a>
          <a href="/resources/case-studies/index.html">Case Studies</a>
        </div>
        <div class="footer__col">
          <h2>Company</h2>
          <a href="/company/about/index.html">About</a>
          <a href="/company/contact/index.html">Contact</a>
          <a href="/company/careers/index.html">Careers</a>
          <a href="/company/partners/index.html">Partners</a>
        </div>
        <div class="footer__col">
          <h2>Atlas Platform</h2>
          <a href="/platform/index.html">Platform Overview</a>
          <a href="/platform/operational-intelligence/index.html">Operational Intelligence</a>
          <a href="/technology/vector-tag/index.html">Vector Tag</a>
          <a href="/technology/integrations-ecosystem/index.html">Integrations</a>
        </div>
        <div class="footer__col">
          <h2>Integrations</h2>
          <a href="/technology/integrations-ecosystem/index.html">Autodesk Integration</a>
          <a href="/technology/integrations-ecosystem/index.html">Procore Integration</a>
          <a href="/technology/integrations-ecosystem/index.html">ServiceNow Integration</a>
          <a href="/technology/integrations-ecosystem/index.html">SAP Integration</a>
        </div>
      </div>
    </div>
    <img class="footer__certs" src="/assets/img/footer-certs.jpg" alt="iottag certifications and accreditations" width="320" height="67" loading="lazy">
  </div>
  <div class="footer__bar">
    <span>&copy; All Rights Reserved, iottag&trade; is a registered trademark 2026.</span>
  </div>
</footer>`;

/* ---- inject shared partials (works on file:// — no fetch) -------------- */
function injectPartials() {
  const base = document.body.dataset.base || '';
  const rebase = (html) => html.replace(/(href|src)="\/(?!\/)/g, `$1="${base}`);
  document.querySelectorAll('[data-include]').forEach((el) => {
    const which = el.getAttribute('data-include') || '';
    let html = which.includes('footer') ? FOOTER_HTML
            : which.includes('header') ? HEADER_HTML : '';
    if (html) el.outerHTML = rebase(html);
  });
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

/* ---- video placeholders ----------------------------------------------- */
function initVideoButtons() {
  document.querySelectorAll('[data-video]').forEach((btn) => {
    btn.addEventListener('click', () => console.log('Play video:', btn.dataset.video || '(demo)'));
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
document.addEventListener('DOMContentLoaded', () => {
  injectPartials();
  setActiveNav();
  initNavToggle();
  initVideoButtons();
  initBrandDots();
});
