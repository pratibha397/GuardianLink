
import { getApp, getApps, initializeApp, multiTabManager, type FirebaseApp } from "firebase/app";
import {
  createUserWithEmailAndPassword,
  getAuth,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  updateProfile,
  type Auth
} from "firebase/auth";
import {
  getDatabase,
  onValue,
  push,
  ref,
  set,
  update,
  type DataSnapshot,
  type Database
} from "firebase/database";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  indexedDBLocalCache,
  initializeFirestore,
  query,
  setDoc,
  updateDoc,
  where,
  type Firestore
} from "firebase/firestore";

const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY || process.env.API_KEY || "",
  authDomain: process.env.FIREBASE_AUTH_DOMAIN || "",
  projectId: process.env.FIREBASE_PROJECT_ID || "",
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET || "",
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || "",
  appId: process.env.FIREBASE_APP_ID || "",
  measurementId: process.env.FIREBASE_MEASUREMENT_ID || ""
};

// Check configuration
export const isFirebaseConfigured = !!(firebaseConfig.apiKey && firebaseConfig.projectId && firebaseConfig.appId);

// Strictly ordered initialization
const app: FirebaseApp = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// Export initialized services
export const auth: Auth = getAuth(app);
export const rtdb: Database = getDatabase(app);

// Initialize Firestore with standard getter first
let firestoreInstance: Firestore;
try {
  firestoreInstance = initializeFirestore(app, {
    localCache: indexedDBLocalCache({ tabManager: multiTabManager() })
  });
} catch (e) {
  console.warn("Firestore custom initialization failed, falling back to default.", e);
  firestoreInstance = getFirestore(app);
}
export const db = firestoreInstance;

// Auth Exports
export {
  createUserWithEmailAndPassword, onAuthStateChanged, sendPasswordResetEmail, signInWithEmailAndPassword, updateProfile
};

// Firestore Exports
  export { collection, doc, getDoc, getDocs, query, setDoc, updateDoc, where };

// Database Exports
  export { onValue, push, ref, set, update };
  export type { DataSnapshot };

