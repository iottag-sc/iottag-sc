/* Password gate for protected pages (articles + articles-insights listing).
   The real page content lives in Firestore (collection "articles", one doc
   per page, field "content"); Security Rules only allow reads after signing
   in with the shared reader account, so nothing readable ships in this repo.
   Pages opt in with <body data-protect="<docId>"> and an empty
   [data-protected-content] container inside <main>. */

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import { getFirestore, doc, getDoc } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

const firebaseConfig = {
  apiKey: 'AIzaSyDiwdce0lvMAM6PrX5YF1tWn0iXFhsgpI8',
  authDomain: 'iottag-site-91016.firebaseapp.com',
  projectId: 'iottag-site-91016',
  storageBucket: 'iottag-site-91016.firebasestorage.app',
  messagingSenderId: '816271022953',
  appId: '1:816271022953:web:ab55ebd07fd4ad76337bf8'
};
const SHARED_EMAIL = 'reader@iottag.com';

const docId = document.body.dataset.protect;
const base = document.body.dataset.base || './';
const target = document.querySelector('[data-protected-content]');
if (docId && target) init();

function init() {
  const app = initializeApp(firebaseConfig);
  const auth = getAuth(app);
  const db = getFirestore(app);

  const gate = buildGate();
  target.before(gate);

  const form = gate.querySelector('[data-pw-form]');
  const input = gate.querySelector('#pw-gate-input');
  const error = gate.querySelector('[data-pw-error]');
  const submit = form.querySelector('button[type="submit"]');
  let loaded = false;

  const showGate = () => { gate.hidden = false; document.body.classList.add('is-gate-open'); };
  const hideGate = () => { gate.hidden = true; document.body.classList.remove('is-gate-open'); };

  onAuthStateChanged(auth, (user) => {
    if (user) loadContent();
    else showGate();
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    error.hidden = true;
    submit.disabled = true;
    try {
      await signInWithEmailAndPassword(auth, SHARED_EMAIL, input.value);
      /* onAuthStateChanged fires and loads the content */
    } catch (err) {
      error.textContent = 'Incorrect password. Please try again.';
      error.hidden = false;
      input.select();
    } finally {
      submit.disabled = false;
    }
  });

  gate.querySelector('[data-pw-back]').addEventListener('click', () => {
    if (document.referrer && new URL(document.referrer).origin === location.origin && history.length > 1) {
      history.back();
    } else {
      location.href = base;
    }
  });

  async function loadContent() {
    if (loaded) return;
    loaded = true;
    try {
      const snap = await getDoc(doc(db, 'articles', docId));
      if (!snap.exists()) throw new Error(`missing articles/${docId}`);
      target.innerHTML = snap.data().content;
      hideGate();
      /* the listing page's white-paper download buttons arrive with the
         content, after main.js already booted — wire them up now (they
         no-opped on page load) */
      if (window.initWhitePaperGate) window.initWhitePaperGate();
    } catch (err) {
      loaded = false;
      showGate();
      error.textContent = 'Something went wrong loading this page. Please try again.';
      error.hidden = false;
    }
  }
}

function buildGate() {
  const gate = document.createElement('div');
  gate.className = 'pw-gate';
  gate.setAttribute('data-pw-gate', '');
  gate.hidden = true;
  gate.innerHTML = `
    <div class="pw-gate__ovl"></div>
    <div class="pw-gate__card">
      <h1 class="pw-gate__title">Please fill in the password to view this page</h1>
      <form class="pw-gate__form" data-pw-form novalidate>
        <div class="pw-gate__field">
          <label for="pw-gate-input">Password</label>
          <input type="password" id="pw-gate-input" name="password" autocomplete="current-password" required>
        </div>
        <button type="submit" class="btn btn--primary">Continue <span class="icon" aria-hidden="true">arrow_forward</span></button>
      </form>
      <p class="pw-gate__error" data-pw-error hidden>Incorrect password. Please try again.</p>
      <div class="pw-gate__actions">
        <button type="button" class="btn btn--secondary" data-pw-back><span class="icon" aria-hidden="true">arrow_back</span> Go back</button>
        <a class="btn btn--secondary" href="${base}company/contact/"><span class="icon" aria-hidden="true">support_agent</span> Contact Us</a>
      </div>
    </div>`;
  return gate;
}
