# Password-Protect a GitHub Pages Article with Firebase

A single shared password gates access to one article. The article content lives in Firestore, **not** in your GitHub Pages repo. Security comes from Firestore Security Rules — a real server-side check that clients cannot bypass.

## How it works

```
GitHub Pages (shell: password box + JS)
      │  Firebase Auth (one shared account)
      ▼
Firestore  ──  Security Rules block reads until authenticated
   └─ articles/my-article : { content: "<article HTML>" }
```

The key rule: the article HTML must sit in Firestore, never committed to the public repo. GitHub Pages only serves an empty shell.

## Setup

### 1. Create Firebase project

- Go to <https://console.firebase.google.com> → **Add project**.
- When creating Firestore, choose region **`australia-southeast1`** (cannot be changed later; matches AU data-residency needs).

### 2. Enable the shared login

- **Authentication** → **Sign-in method** → enable **Email/Password**.
- **Users** → **Add user**: create one account, e.g. `reader@iottag.com` with your chosen shared password. Everyone who knows the password signs in as this account.

### 3. Add the article to Firestore

- **Firestore Database** → create a collection `articles`.
- Add a document with ID `my-article` and one field:
  - `content` (string) = the full article HTML.

### 4. Set Security Rules

**Firestore** → **Rules** → paste and publish:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /articles/{articleId} {
      allow read: if request.auth != null;
      allow write: if false;
    }
  }
}
```

Read is allowed only for signed-in requests. Writes from the client are blocked entirely.

### 5. Enable App Check (recommended)

- **App Check** → register your web app with **reCAPTCHA v3**.
- Enforce it on Firestore. This blocks requests that don't come from your app, reducing abuse. It is an extra layer, not a replacement for Security Rules.

### 6. Build the GitHub Pages shell

Deploy only the files below. **Do not** put the article text in the repo.

`index.html`:

```html
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Protected Article</title></head>
<body>
  <div id="gate">
    <input id="pwd" type="password" placeholder="Enter password" />
    <button id="btn">Unlock</button>
  </div>
  <div id="content"></div>
  <script type="module" src="./app.js"></script>
</body>
</html>
```

`app.js`:

```javascript
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import { getAuth, signInWithEmailAndPassword } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import { getFirestore, doc, getDoc } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import { initializeAppCheck, ReCaptchaV3Provider } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app-check.js';

const firebaseConfig = {
  apiKey: "...",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project",
  // ...rest from Firebase console
};

const app = initializeApp(firebaseConfig);

initializeAppCheck(app, {
  provider: new ReCaptchaV3Provider('YOUR_RECAPTCHA_SITE_KEY'),
  isTokenAutoRefresh: true
});

const auth = getAuth(app);
const db = getFirestore(app);

const SHARED_EMAIL = 'reader@iottag.com';

async function unlock() {
  const pwd = document.getElementById('pwd').value;
  try {
    await signInWithEmailAndPassword(auth, SHARED_EMAIL, pwd);
    const snap = await getDoc(doc(db, 'articles', 'my-article'));
    if (snap.exists()) {
      document.getElementById('gate').style.display = 'none';
      document.getElementById('content').innerHTML = snap.data().content;
    }
  } catch (e) {
    alert('Wrong password');
  }
}

document.getElementById('btn').addEventListener('click', unlock);
```

## Important notes

- **`firebaseConfig` in client JS is fine.** It is not a secret. Security comes from Security Rules, not from hiding the config. (This is different from a service account key, which must never be in client-side code.)
- **Never commit the article content to the repo.** If the HTML is public on GitHub Pages, the password is pointless — anyone can read the source.
- **This is a shared gate.** Everyone uses one account, so you cannot tell readers apart. If you later need per-person access or an audit trail, switch to individual accounts.
- If the article may contain personal data under the Australian Privacy Act, keeping Firestore in `australia-southeast1` supports data-residency.

## Checklist

- [ ] Firebase project created, Firestore region `australia-southeast1`
- [ ] Email/Password enabled, one shared user created
- [ ] `articles/my-article` document with `content` field
- [ ] Security Rules published
- [ ] App Check (reCAPTCHA v3) enabled and enforced
- [ ] GitHub Pages serves shell + JS only, no article content in repo
