/* firebase init & save (Firestore compat) */

// ★ここに Firebase コンソールで取得した設定値を入れてください。
// 例）const FIREBASE_CONFIG = { apiKey: "...", authDomain: "...", projectId: "...", ... };
const FIREBASE_CONFIG ={
  apiKey: "AIzaSyCSt4SKKSpsJMosQ2WUXFxBi9QWDAQYYXE",
  authDomain: "bandit-tod.firebaseapp.com",
  projectId: "bandit-tod",
  storageBucket: "bandit-tod.firebasestorage.app",
  messagingSenderId: "740146200078",
  appId: "1:740146200078:web:63b46bba3e7f04e8bc865f",
  measurementId: "G-9VE06HSBHN"
};; // ← nullのままなら無効（CSVフォールバック）

(function () {
  function initFirebase() {
    try {
      if (!window.firebase) {
        return { ok: false, reason: 'Firebase SDK not loaded' };
      }
      if (!FIREBASE_CONFIG) {
        return { ok: false, reason: 'FIREBASE_CONFIG is null' };
      }
      // すでに初期化済みなら再利用
      if (firebase.apps && firebase.apps.length) {
        window.__fbApp = firebase.apps[0];
      } else {
        window.__fbApp = firebase.initializeApp(FIREBASE_CONFIG);
      }
      window.__db = firebase.firestore();
      return { ok: true, app: window.__fbApp, db: window.__db };
    } catch (e) {
      console.error('Firebase init error:', e);
      return { ok: false, reason: String(e) };
    }
  }

  /**
   * Firestore に 1 ドキュメントで保存（trialsを配列で格納）
   * - コレクション: bandit_sessions
   * - ドキュメントID: <pid>_<session>_<timestamp>
   */
  async function saveToFirebase(payload) {
    if (!window.__db) throw new Error('Firestore is not initialized');
    const id =
      payload.id ||
      `${payload.pid || 'P'}_${payload.session || 'na'}_${Date.now()}`;
    const ref = window.__db.collection('bandit_sessions').doc(id);

    const meta = {
      pid: payload.pid,
      session: payload.session,
      total: payload.total,
      n: payload.n,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      clientTime: new Date().toISOString(),
      agent: 'bandit_v8_keyboard',
      userAgent: navigator.userAgent
    };

    // ※ Firestore doc の 1MB 制限に注意。400試行・小さめのログなら十分収まります。
    const doc = { ...meta, trials: payload.trials || [] };
    await ref.set(doc, { merge: false });
    return id;
  }

  // グローバル公開
  window.initFirebase = initFirebase;
  window.saveToFirebase = saveToFirebase;
})();
