/* firebase init & save (Firestore compat) */
const firebaseConfig = {
  apiKey: "AIzaSyCSt4SKKSpsJMosQ2WUXFxBi9QWDAQYYXE",
  authDomain: "bandit-tod.firebaseapp.com",
  projectId: "bandit-tod",
  storageBucket: "bandit-tod.firebasestorage.app",
  messagingSenderId: "740146200078",
  appId: "1:740146200078:web:63b46bba3e7f04e8bc865f",
  measurementId: "G-9VE06HSBHN"
};

const ENABLE_ANON_AUTH = true;

(function () {
  function initFirebase() {
    try {
      if (!window.firebase) return { ok: false, reason: 'Firebase SDK not loaded' };
      if (firebase.apps && firebase.apps.length) {
        window.__fbApp = firebase.apps[0];
      } else {
        window.__fbApp = firebase.initializeApp(firebaseConfig);
      }
      window.__db = firebase.firestore();

      if (ENABLE_ANON_AUTH && firebase.auth) {
        firebase.auth().signInAnonymously().catch(e => console.warn('anon auth failed:', e));
      }
      return { ok: true, app: window.__fbApp, db: window.__db };
    } catch (e) {
      console.error('Firebase init error:', e);
      return { ok: false, reason: String(e) };
    }
  }

  async function saveToFirebase(payload) {
    if (!window.__db) throw new Error('Firestore is not initialized');
    const id = payload.id || `${payload.pid || 'P'}_${payload.session || 'na'}_${Date.now()}`;
    const ref = window.__db.collection('bandit_sessions').doc(id);
    const meta = {
      pid: payload.pid, session: payload.session, total: payload.total, n: payload.n,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      clientTime: new Date().toISOString(),
      agent: 'bandit_v8_keyboard',
      userAgent: navigator.userAgent
    };
    const doc = { ...meta, trials: payload.trials || [] };
    await ref.set(doc, { merge: false });
    return id;
  }

  window.initFirebase = initFirebase;
  window.saveToFirebase = saveToFirebase;
})();
