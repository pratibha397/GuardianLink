
import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
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
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
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

// Singleton initialization
const app: FirebaseApp = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// Explicitly pass app to all services to prevent "Component not registered" errors
export const auth: Auth = getAuth(app);
export const rtdb: Database = getDatabase(app);

let firestoreInstance: Firestore;
try {
  firestoreInstance = initializeFirestore(app, {
    localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() })
  });
} catch (e) {
  // If offline persistence fails (e.g. privacy restrictions), initialize with default settings
  firestoreInstance = initializeFirestore(app, {});
}
export const db = firestoreInstance;

export {
  collection, createUserWithEmailAndPassword, doc,
  getDoc, getDocs, onAuthStateChanged, onValue, push, query, ref, sendPasswordResetEmail, set, setDoc, signInWithEmailAndPassword, update, updateDoc, updateProfile, where
};
export type { DataSnapshot };
export const isFirebaseConfigured = !!(firebaseConfig.apiKey && firebaseConfig.projectId && firebaseConfig.appId);
