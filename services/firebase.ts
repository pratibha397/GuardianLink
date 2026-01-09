
import { getApp, getApps, initializeApp } from "firebase/app";
import * as firebaseAuth from "firebase/auth";
import {
  DataSnapshot,
  getDatabase,
  onValue,
  push,
  ref,
  set
} from "firebase/database";
import {
  doc,
  getDoc,
  getFirestore,
  setDoc
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

// Singleton initialization pattern for v9+
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// Destructure from namespace import to avoid named export resolution issues
const { 
  getAuth, 
  signInAnonymously, 
  signOut, 
  onAuthStateChanged, 
  sendPasswordResetEmail 
} = firebaseAuth;

// Initialize services
const auth = getAuth(app);
const db = getFirestore(app);
const rtdb = getDatabase(app);

// Export instances and modular functions
export {
  app,
  auth,
  db, doc,
  getDoc, onAuthStateChanged, onValue, push, ref, rtdb, sendPasswordResetEmail, set, setDoc, signInAnonymously,
  signOut
};
export type { DataSnapshot };

