import firebase from "firebase/compat/app";
import "firebase/compat/auth";
import "firebase/compat/database";
import "firebase/compat/firestore";

// Define User type alias for export compatibility
export type FirebaseUser = firebase.User;
export type DataSnapshot = firebase.database.DataSnapshot;

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
const app = !firebase.apps.length ? firebase.initializeApp(firebaseConfig) : firebase.app();
const auth = app.auth();
const db = app.firestore();
const rtdb = app.database();

// --- Auth Shim ---
const signInAnonymously = (authInstance: any) => authInstance.signInAnonymously();
const signOut = (authInstance: any) => authInstance.signOut();
const onAuthStateChanged = (authInstance: any, observer: any) => authInstance.onAuthStateChanged(observer);
const sendPasswordResetEmail = (authInstance: any, email: string) => authInstance.sendPasswordResetEmail(email);
const updateProfile = (user: any, profile: any) => user.updateProfile(profile);
const signInWithEmailAndPassword = (authInstance: any, e: string, p: string) => authInstance.signInWithEmailAndPassword(e, p);
const createUserWithEmailAndPassword = (authInstance: any, e: string, p: string) => authInstance.createUserWithEmailAndPassword(e, p);
const signInWithPopup = (authInstance: any, provider: any) => authInstance.signInWithPopup(provider);
const GoogleAuthProvider = firebase.auth.GoogleAuthProvider;

// --- Firestore Shim ---
const doc = (firestoreOrColl: any, ...args: string[]) => {
  // Handle doc(db, 'collection', 'id') -> db.collection('collection').doc('id')
  if (args.length === 2) { 
    return firestoreOrColl.collection(args[0]).doc(args[1]);
  }
  // Handle doc(collection, 'id') -> collection.doc('id')
  if (args.length === 1) {
    return firestoreOrColl.doc(args[0]);
  }
  return firestoreOrColl.doc(args[0]);
};
const getDoc = (ref: any) => ref.get();
const setDoc = (ref: any, data: any, options?: any) => ref.set(data, options);
const collection = (firestore: any, path: string) => firestore.collection(path);
const addDoc = (coll: any, data: any) => coll.add(data);
const updateDoc = (ref: any, data: any) => ref.update(data);
const onSnapshot = (ref: any, cb: any) => ref.onSnapshot(cb);
const Timestamp = firebase.firestore.Timestamp;
const getDocs = (query: any) => query.get();

// Simple Query Builder Shim
const query = (ref: any, ...fns: any[]) => fns.reduce((r, fn) => fn(r), ref);
const where = (field: string, op: any, val: any) => (ref: any) => ref.where(field, op, val);

// --- Realtime Database Shim ---
const ref = (database: any, path: string) => database.ref(path);
const set = (ref: any, val: any) => ref.set(val);
const push = (ref: any, val: any) => ref.push(val);
const remove = (ref: any) => ref.remove();
const update = (ref: any, val: any) => ref.update(val);
const onValue = (query: any, cb: (snap: any) => void, cancelCallback?: (error: any) => void) => {
    query.on('value', cb, cancelCallback);
    return () => query.off('value', cb);
};

export {
  addDoc, app,
  auth, collection, createUserWithEmailAndPassword, db,
  // Firestore
  doc,
  getDoc, getDocs, GoogleAuthProvider, onAuthStateChanged, onSnapshot, onValue, push, query,
  // Realtime Database
  ref, remove, rtdb, sendPasswordResetEmail, set, setDoc,
  // Auth
  signInAnonymously, signInWithEmailAndPassword, signInWithPopup, signOut, Timestamp, update, updateDoc, updateProfile, where
};
