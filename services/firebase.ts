
import { initializeApp } from "firebase/app";
import { getAuth, RecaptchaVerifier, signInWithPhoneNumber } from "firebase/auth";
import { DataSnapshot, getDatabase, onValue, push, ref, set, update } from "firebase/database";
import { collection, doc, getDoc, getDocs, getFirestore, query, setDoc, where } from "firebase/firestore";

/**
 * Aegis Mesh Firebase Configuration.
 * 
 * This configuration pulls from your .env file.
 * Ensure you have set: FIREBASE_PROJECT_ID, FIREBASE_APP_ID, etc.
 */
const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY || process.env.API_KEY,
  authDomain: process.env.FIREBASE_AUTH_DOMAIN,
  projectId: process.env.FIREBASE_PROJECT_ID,
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.FIREBASE_APP_ID,
  measurementId: process.env.FIREBASE_MEASUREMENT_ID
};

// Check for required fields to avoid initialization errors
if (!firebaseConfig.projectId || !firebaseConfig.appId) {
  console.warn(
    "[Aegis Mesh] Firebase configuration is incomplete. " +
    "Please ensure FIREBASE_PROJECT_ID and FIREBASE_APP_ID are set in your environment."
  );
}

const app = initializeApp(firebaseConfig);

// Service Instances
export const auth = getAuth(app);
export const db = getFirestore(app);
export const rtdb = getDatabase(app);

// Auth Exports
export { RecaptchaVerifier, signInWithPhoneNumber };

// Firestore Exports
  export { collection, doc, getDoc, getDocs, query, setDoc, where };

// Database Exports
  export { onValue, push, ref, set, update };
  export type { DataSnapshot };

