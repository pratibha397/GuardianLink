
import { AlertCircle, Eye, EyeOff, Lock, Mail, Shield, User as UserIcon, Zap } from 'lucide-react';
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
      let finalName = name;
      
      if (authMode === 'register') {
        if (!name.trim()) throw new Error("A name is required for node identification.");
        const credential = await createUserWithEmailAndPassword(auth, email, password);
        firebaseUser = credential.user;

        // Register in Mesh Registry
        await setDoc(doc(db, "users", email.toLowerCase()), {
          uid: firebaseUser.uid,
          email: email.toLowerCase(),
          name: name.trim(),
          lastLogin: Date.now()
        });
      } else {
        const credential = await signInWithEmailAndPassword(auth, email, password);
        firebaseUser = credential.user;
        
        // Fetch identity from Mesh Registry
        const userSnap = await getDoc(doc(db, "users", email.toLowerCase()));
        if (userSnap.exists()) {
          finalName = userSnap.data().name || 'Mesh Agent';
        }
      }

      const activeUser: User = { 
        id: firebaseUser.uid, 
        email: email.toLowerCase(),
        name: finalName || 'Mesh Agent' 
      };

      onLogin(activeUser);
    } catch (err: any) {
      console.error(err);
      let message = "Neural link failed.";
      if (err.code === 'auth/email-already-in-use') message = "Identity already registered in Mesh.";
      if (err.code === 'auth/invalid-credential') message = "Invalid credentials supplied.";
      if (err.code === 'auth/weak-password') message = "Access key too weak (min 6 chars).";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#020617] flex flex-col items-center justify-center p-6 font-sans">
      <div className="w-full max-w-sm space-y-12">
        <div className="text-center space-y-4">
          <div className="relative inline-block p-5 bg-sky-500 rounded-3xl shadow-[0_0_40px_rgba(56,189,248,0.4)]">
            <Shield size={48} className="text-white" />
            <div className="absolute -top-1 -right-1 w-4 h-4 bg-white rounded-full flex items-center justify-center">
              <Zap size={10} className="text-sky-500 fill-current" />
            </div>
          </div>
          <div className="space-y-1">
            <h1 className="text-3xl font-black text-white italic tracking-tighter uppercase leading-none">AEGIS MESH</h1>
            <p className="text-[9px] mono text-sky-500/60 font-bold tracking-[0.4em] uppercase italic">Tactical Safety Protocol</p>
          </div>
        </div>

        <div className="bg-slate-900/30 p-8 rounded-[3rem] border border-white/5 backdrop-blur-2xl shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-sky-500/50 to-transparent" />
          
          <form onSubmit={handleAuth} className="space-y-6">
            <div className="flex bg-slate-950 p-1 rounded-2xl border border-white/5">
              <button 
                type="button" 
                onClick={() => setAuthMode('register')} 
                className={`flex-1 py-3 text-[10px] font-black uppercase rounded-xl transition-all duration-300 ${authMode === 'register' ? 'bg-sky-500 text-white shadow-lg' : 'text-slate-600 hover:text-slate-400'}`}
              >
                Enroll
              </button>
              <button 
                type="button" 
                onClick={() => setAuthMode('login')} 
                className={`flex-1 py-3 text-[10px] font-black uppercase rounded-xl transition-all duration-300 ${authMode === 'login' ? 'bg-sky-500 text-white shadow-lg' : 'text-slate-600 hover:text-slate-400'}`}
              >
                Access
              </button>
            </div>

            <div className="space-y-3">
              {authMode === 'register' && (
                <div className="group">
                  <div className="relative">
                    <UserIcon className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-700 group-focus-within:text-sky-500 transition-colors" size={16} />
                    <input 
                      type="text" required placeholder="Display Name" value={name} 
                      onChange={(e) => setName(e.target.value)} 
                      className="w-full bg-slate-950 border border-white/5 rounded-2xl py-5 pl-14 pr-6 text-sm text-white font-bold outline-none focus:border-sky-500/50 transition-all placeholder:text-slate-800" 
                    />
                  </div>
                </div>
              )}

              <div className="group">
                <div className="relative">
                  <Mail className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-700 group-focus-within:text-sky-500 transition-colors" size={16} />
                  <input 
                    type="email" required placeholder="Mesh ID (Email)" value={email} 
                    onChange={(e) => setEmail(e.target.value)} 
                    className="w-full bg-slate-950 border border-white/5 rounded-2xl py-5 pl-14 pr-6 text-sm text-white font-bold outline-none focus:border-sky-500/50 transition-all placeholder:text-slate-800" 
                  />
                </div>
              </div>

              <div className="group">
                <div className="relative">
                  <Lock className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-700 group-focus-within:text-sky-500 transition-colors" size={16} />
                  <input 
                    type={showPassword ? "text" : "password"} required placeholder="Access Key" value={password} 
                    onChange={(e) => setPassword(e.target.value)} 
                    className="w-full bg-slate-950 border border-white/5 rounded-2xl py-5 pl-14 pr-14 text-sm text-white font-bold outline-none focus:border-sky-500/50 transition-all placeholder:text-slate-800" 
                  />
                  <button 
                    type="button" onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-700 hover:text-sky-500 transition-colors"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>
            </div>

            {error && (
              <div className="text-red-400 text-[9px] font-black uppercase flex items-center gap-3 bg-red-500/5 p-4 rounded-2xl border border-red-500/20 animate-in slide-in-from-top-2">
                <AlertCircle size={14} className="shrink-0" />
                {error}
              </div>
            )}

            <button 
              type="submit" disabled={loading} 
              className="w-full bg-sky-500 hover:bg-sky-400 py-5 rounded-2xl text-white font-black uppercase tracking-[0.2em] text-[11px] shadow-[0_10px_20px_rgba(56,189,248,0.3)] active:scale-95 transition-all disabled:opacity-50 relative overflow-hidden group"
            >
              <span className="relative z-10">{loading ? "Synchronizing..." : (authMode === 'register' ? "Enroll Node" : "Access Mesh")}</span>
              <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
            </button>
          </form>
        </div>
        
        <p className="text-center text-[9px] text-slate-800 font-bold uppercase tracking-[0.3em]">
          End-to-End Encrypted • Free Resource Tier
        </p>
      </div>
    </div>
  );
};

export default AuthScreen;
