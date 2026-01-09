
import { getApp, getApps, initializeApp } from "firebase/app";
import type { User as FirebaseUser } from "firebase/auth";
import {
  createUserWithEmailAndPassword,
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInAnonymously,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile
} from "firebase/auth";
import {
  DataSnapshot,
  getDatabase,
  onValue,
  push,
  ref,
  remove,
  set,
  update
} from "firebase/database";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  onSnapshot,
  query,
  setDoc,
  Timestamp,
  updateDoc,
  where
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

// Initialize services
const auth = getAuth(app);
const db = getFirestore(app);
const rtdb = getDatabase(app);

// Export instances and all commonly used modular functions
export {
  addDoc, app,
  auth, collection, createUserWithEmailAndPassword, DataSnapshot, db,
  // Firestore
  doc,
  getDoc, getDocs, GoogleAuthProvider, onAuthStateChanged, onSnapshot, onValue, push, query,
  // Realtime Database
  ref, remove, rtdb, sendPasswordResetEmail, set, setDoc,
  // Auth
  signInAnonymously, signInWithEmailAndPassword, signInWithPopup, signOut, Timestamp, update, updateDoc, updateProfile, where
};
export type { FirebaseUser };

