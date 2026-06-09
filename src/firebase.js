// src/firebase.js
// ─────────────────────────────────────────────────────────────
// STEP 1: Paste your Firebase config here (from Firebase Console
//         → Project Settings → Your apps → Web app → Config)
// ─────────────────────────────────────────────────────────────
import { initializeApp } from "firebase/app";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
} from "firebase/auth";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  onSnapshot,
} from "firebase/firestore";

const firebaseConfig = {
  // ⬇ PASTE YOUR CONFIG HERE
  apiKey: "AIzaSyCMFBmj0dM54SWU_crwBK2UzBjx9rCQC4o",
  authDomain: "skincare-app-555.firebaseapp.com",
  projectId: "skincare-app-555",
  storageBucket: "skincare-app-555.firebasestorage.app",
  messagingSenderId: "737550841033",
  appId: "1:737550841033:web:6580102506e4ffdb1d8918",
  measurementId: "G-7FKB7H4Y8L"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db   = getFirestore(app);

// ── Auth helpers ──────────────────────────────────────────────
const provider = new GoogleAuthProvider();

export const signInWithGoogle = () => signInWithPopup(auth, provider);
export const signOutUser      = () => signOut(auth);
export { onAuthStateChanged };

// ── Firestore helpers ─────────────────────────────────────────
// All user data lives under users/{uid}/{field}

export async function loadUserData(uid, field) {
  const snap = await getDoc(doc(db, "users", uid, "data", field));
  return snap.exists() ? snap.data().value : null;
}

export async function saveUserData(uid, field, value) {
  await setDoc(
    doc(db, "users", uid, "data", field),
    { value },
    { merge: true }
  );
}

export function subscribeUserData(uid, field, callback) {
  return onSnapshot(doc(db, "users", uid, "data", field), (snap) => {
    callback(snap.exists() ? snap.data().value : null);
  });
}

export async function loadProfile(uid) {
  const snap = await getDoc(doc(db, "users", uid, "data", "profile"));
  return snap.exists() ? snap.data().value : null;
}

export async function saveProfile(uid, profile) {
  await setDoc(
    doc(db, "users", uid, "data", "profile"),
    { value: profile },
    { merge: true }
  );
}
