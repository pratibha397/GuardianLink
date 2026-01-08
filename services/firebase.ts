
import firebase from 'firebase/app';
import 'firebase/auth';
import 'firebase/database';
import 'firebase/firestore';

const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY || process.env.API_KEY || "",
  authDomain: process.env.FIREBASE_AUTH_DOMAIN || "",
  projectId: process.env.FIREBASE_PROJECT_ID || "",
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET || "",
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || "",
  appId: process.env.FIREBASE_APP_ID || "",
  measurementId: process.env.FIREBASE_MEASUREMENT_ID || ""
};

// Singleton initialization using v8/compat API
const app = firebase.apps.length === 0 ? firebase.initializeApp(firebaseConfig) : firebase.app();

// Export instances
export const auth = app.auth();
export const db = app.firestore();
export const rtdb = app.database();

// --- Auth Adapters (v9 signature -> v8 implementation) ---
export const signInAnonymously = (authInstance: firebase.auth.Auth) => authInstance.signInAnonymously();
export const signInWithEmailAndPassword = (authInstance: firebase.auth.Auth, email: string, pass: string) => authInstance.signInWithEmailAndPassword(email, pass);
export const createUserWithEmailAndPassword = (authInstance: firebase.auth.Auth, email: string, pass: string) => authInstance.createUserWithEmailAndPassword(email, pass);
export const sendPasswordResetEmail = (authInstance: firebase.auth.Auth, email: string) => authInstance.sendPasswordResetEmail(email);
export const onAuthStateChanged = (authInstance: firebase.auth.Auth, cb: (user: firebase.User | null) => void) => authInstance.onAuthStateChanged(cb);
export const updateProfile = (user: firebase.User, args: { displayName?: string; photoURL?: string }) => user.updateProfile(args);

// --- Firestore Adapters (v9 signature -> v8 implementation) ---
export const doc = (firestore: firebase.firestore.Firestore, ...args: string[]) => {
  if (args.length === 1) return firestore.doc(args[0]);
  if (args.length >= 2) return firestore.collection(args[0]).doc(args[1]);
  return firestore.doc(args.join('/'));
};

export const getDoc = async (ref: firebase.firestore.DocumentReference) => {
  const snap = await ref.get();
  // v9 expects exists() method, v8 has exists property. Wrap it.
  return {
    exists: () => snap.exists,
    data: () => snap.data(),
    id: snap.id,
    ref: snap.ref
  };
};

export const setDoc = (ref: firebase.firestore.DocumentReference, data: any, options?: any) => ref.set(data, options);
export const updateDoc = (ref: firebase.firestore.DocumentReference, data: any) => ref.update(data);
export const collection = (firestore: firebase.firestore.Firestore, path: string) => firestore.collection(path);

// Stub/Simple implementations for Query/Where (unused in provided files but kept for safety)
export const getDocs = (query: firebase.firestore.Query) => query.get();
export const query = (ref: any) => ref; // No-op shim
export const where = (field: string, op: any, val: any) => null; // Stub

// --- Realtime Database Adapters (v9 signature -> v8 implementation) ---
export const ref = (database: firebase.database.Database, path?: string) => database.ref(path);
export const set = (ref: firebase.database.Reference, value: any) => ref.set(value);
export const push = (ref: firebase.database.Reference, value: any) => ref.push(value);
export const update = (ref: firebase.database.Reference, value: any) => ref.update(value);

export const onValue = (
  query: firebase.database.Query, 
  onNext: (snap: firebase.database.DataSnapshot) => void, 
  onError?: (err: Error) => void
) => {
  query.on('value', onNext, onError);
  return () => query.off('value', onNext);
};

// --- Types ---
export type DataSnapshot = firebase.database.DataSnapshot;
export type Auth = firebase.auth.Auth;
export type Firestore = firebase.firestore.Firestore;
export type Database = firebase.database.Database;
export type FirebaseApp = firebase.app.App;

export {
  app,
  firebase
};

export const isFirebaseConfigured = !!(firebaseConfig.apiKey && firebaseConfig.projectId);
