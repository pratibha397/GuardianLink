
import { AlertCircle, Eye, EyeOff, Lock, Mail, Shield, User as UserIcon } from 'lucide-react';
import React, { useState } from 'react';
import {
  auth,
  createUserWithEmailAndPassword,
  db,
  doc,
  getDoc,
  setDoc,
  signInWithEmailAndPassword
} from '../services/firebase';
import { User } from '../types';

interface AuthScreenProps {
  onLogin: (user: User) => void;
}

const AuthScreen: React.FC<AuthScreenProps> = ({ onLogin }) => {
  const [authMode, setAuthMode] = useState<'login' | 'register'>('register');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      let firebaseUser;
      
      if (authMode === 'register') {
        if (!name.trim()) throw new Error("Full Name is required for mesh registration.");
        const credential = await createUserWithEmailAndPassword(auth, email, password);
        firebaseUser = credential.user;

        // Register in Mesh Registry (Firestore)
        const userRef = doc(db, "users", email.toLowerCase());
        await setDoc(userRef, {
          uid: firebaseUser.uid,
          email: email.toLowerCase(),
          name: name.trim(),
          lastLogin: Date.now()
        });
      } else {
        const credential = await signInWithEmailAndPassword(auth, email, password);
        firebaseUser = credential.user;
        
        // Fetch name from Registry
        const userSnap = await getDoc(doc(db, "users", email.toLowerCase()));
        if (userSnap.exists()) {
          const data = userSnap.data();
          setName(data.name || 'Mesh User');
        }
      }

      const activeUser: User = { 
        id: firebaseUser.uid, 
        phone: email.toLowerCase(), // We reuse 'phone' field as identifier for the UI/Types
        name: name || 'Mesh User' 
      };

      onLogin(activeUser);
    } catch (err: any) {
      console.error(err);
      let message = "Authentication failed.";
      if (err.code === 'auth/email-already-in-use') message = "Email already in the Guardian registry.";
      if (err.code === 'auth/invalid-credential') message = "Invalid email or password.";
      if (err.code === 'auth/weak-password') message = "Password must be at least 6 characters.";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-md space-y-10">
        <div className="text-center space-y-4">
          <div className="inline-block p-6 bg-blue-600 rounded-[2.5rem] shadow-[0_0_50px_rgba(37,99,235,0.3)] border-4 border-slate-950">
            <Shield size={56} className="text-white" />
          </div>
          <h1 className="text-4xl font-black text-white italic tracking-tighter uppercase">Aegis Mesh</h1>
          <p className="text-[10px] mono text-slate-500 font-bold tracking-[0.4em] uppercase">Tactical AI Safety • Free Tier</p>
        </div>

        <div className="bg-slate-900/40 p-10 rounded-[4rem] border border-slate-800 backdrop-blur-3xl shadow-2xl">
          <form onSubmit={handleAuth} className="space-y-6">
            <div className="flex bg-slate-950 p-1.5 rounded-2xl border border-slate-800">
              <button 
                type="button" 
                onClick={() => setAuthMode('register')} 
                className={`flex-1 py-4 text-[10px] font-black uppercase rounded-xl transition-all ${authMode === 'register' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-600'}`}
              >
                Enroll
              </button>
              <button 
                type="button" 
                onClick={() => setAuthMode('login')} 
                className={`flex-1 py-4 text-[10px] font-black uppercase rounded-xl transition-all ${authMode === 'login' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-600'}`}
              >
                Log In
              </button>
            </div>

            <div className="space-y-4">
              {authMode === 'register' && (
                <div className="relative">
                  <UserIcon className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-600" size={18} />
                  <input 
                    type="text" required placeholder="Display Name" value={name} 
                    onChange={(e) => setName(e.target.value)} 
                    className="w-full bg-slate-950 border border-slate-800 rounded-2xl py-5 pl-14 pr-6 text-sm text-white font-bold outline-none focus:border-blue-500/50 transition-all" 
                  />
                </div>
              )}

              <div className="relative">
                <Mail className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-600" size={18} />
                <input 
                  type="email" required placeholder="Mesh Email ID" value={email} 
                  onChange={(e) => setEmail(e.target.value)} 
                  className="w-full bg-slate-950 border border-slate-800 rounded-2xl py-5 pl-14 pr-6 text-sm text-white font-black outline-none focus:border-blue-500/50 transition-all" 
                />
              </div>

              <div className="relative">
                <Lock className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-600" size={18} />
                <input 
                  type={showPassword ? "text" : "password"} required placeholder="Mesh Access Key" value={password} 
                  onChange={(e) => setPassword(e.target.value)} 
                  className="w-full bg-slate-950 border border-slate-800 rounded-2xl py-5 pl-14 pr-14 text-sm text-white font-black outline-none focus:border-blue-500/50 transition-all tracking-widest" 
                />
                <button 
                  type="button" onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-600 hover:text-slate-400 transition-colors"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {error && (
              <div className="text-red-400 text-[9px] font-black uppercase flex items-center gap-3 bg-red-500/10 p-4 rounded-2xl border border-red-500/20 animate-in slide-in-from-top-2">
                <AlertCircle size={16} className="shrink-0" />
                {error}
              </div>
            )}

            <button 
              type="submit" disabled={loading} 
              className="w-full bg-blue-600 hover:bg-blue-500 py-6 rounded-[2rem] text-white font-black uppercase tracking-[0.2em] text-xs shadow-[0_15px_30px_rgba(37,99,235,0.4)] active:scale-95 transition-all disabled:opacity-50"
            >
              {loading ? "Decrypting..." : (authMode === 'register' ? "Initialise Mesh Node" : "Access Feed")}
            </button>
          </form>
        </div>
        
        <p className="text-center text-[9px] text-slate-700 font-black uppercase tracking-widest">
          Secure Mesh Communication Layer • No Billing Required
        </p>
      </div>
    </div>
  );
};

export default AuthScreen;
