
import { initializeApp } from "firebase/app";
import {
  createUserWithEmailAndPassword,
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword
} from "firebase/auth";
import { DataSnapshot, getDatabase, onValue, push, ref, set, update } from "firebase/database";
import { collection, doc, getDoc, getDocs, getFirestore, query, setDoc, where } from "firebase/firestore";

const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY || process.env.API_KEY,
  authDomain: process.env.FIREBASE_AUTH_DOMAIN,
  projectId: process.env.FIREBASE_PROJECT_ID,
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.FIREBASE_APP_ID,
  measurementId: process.env.FIREBASE_MEASUREMENT_ID
};

if (!firebaseConfig.apiKey || !firebaseConfig.projectId || !firebaseConfig.appId) {
  console.error(
    "[Aegis Mesh] CRITICAL: Firebase configuration is missing essential keys."
  );
}

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const rtdb = getDatabase(app);

// Auth Exports (Email/Password for Free Tier)
export {
  createUserWithEmailAndPassword,
  onAuthStateChanged, signInWithEmailAndPassword
};

// Firestore Exports
  export { collection, doc, getDoc, getDocs, query, setDoc, where };

// Database Exports
  export { onValue, push, ref, set, update };
  export type { DataSnapshot };

