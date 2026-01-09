import { AlertCircle, ArrowRight, Eye, EyeOff, Lock, Mail, RefreshCw, Shield, User as UserIcon } from 'lucide-react';
import { useState } from 'react';
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

type AuthMode = 'LOGIN' | 'REGISTER';

const AuthScreen: React.FC<AuthScreenProps> = ({ onLogin }) => {
  const [mode, setMode] = useState<AuthMode>('LOGIN');
  
  // Form State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  
  // UI State
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const cleanEmail = email.trim().toLowerCase();
    const cleanName = name.trim();

    try {
      if (mode === 'REGISTER') {
        // --- REGISTRATION FLOW ---
        
        // 1. Validate Input
        if (cleanName.length < 2) throw new Error("Please enter your full name.");
        if (password.length < 6) throw new Error("Password must be at least 6 characters.");

        // 2. Create Auth User
        try {
          const userCredential = await createUserWithEmailAndPassword(auth, cleanEmail, password);
          const firebaseUser = userCredential.user;

          if (!firebaseUser) throw new Error("Registration failed.");

          // 3. Create Firestore User Profile
          // CRITICAL FIX: Use UID as document Key, not Email. 
          // This aligns with "allow write: if request.auth.uid == userId" security rules.
          const newUser: User = {
            id: firebaseUser.uid,
            email: cleanEmail,
            name: cleanName
          };

          await setDoc(doc(db, "users", firebaseUser.uid), newUser);
          
          // 4. Complete Login
          onLogin(newUser);

        } catch (authErr: any) {
          if (authErr.code === 'auth/email-already-in-use') {
            throw new Error("This email is already registered. Please Login.");
          }
          throw authErr;
        }

      } else {
        // --- LOGIN FLOW ---
        
        // 1. Authenticate
        try {
          const userCredential = await signInWithEmailAndPassword(auth, cleanEmail, password);
          const firebaseUser = userCredential.user;
          
          if (!firebaseUser) throw new Error("Authentication failed.");

          // 2. Fetch User Profile using UID
          const userDoc = await getDoc(doc(db, "users", firebaseUser.uid));
          
          let userData: User;
          if (userDoc.exists()) {
            userData = userDoc.data() as User;
          } else {
            // Fallback: If auth exists but Firestore doc is missing (rare/legacy)
            // Re-create the doc using current auth info
            userData = {
              id: firebaseUser.uid,
              email: cleanEmail,
              name: firebaseUser.displayName || "Guardian User"
            };
            await setDoc(doc(db, "users", firebaseUser.uid), userData);
          }

          onLogin(userData);

        } catch (authErr: any) {
          if (authErr.code === 'auth/user-not-found' || authErr.code === 'auth/wrong-password' || authErr.code === 'auth/invalid-credential') {
            throw new Error("Invalid email or password.");
          }
          if (authErr.code === 'auth/too-many-requests') {
             throw new Error("Too many failed attempts. Try again later.");
          }
          throw authErr;
        }
      }

    } catch (err: any) {
      console.error("Auth Error:", err);
      const msg = err.message?.replace('Firebase: ', '') || "An unknown error occurred.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#020617] flex flex-col items-center justify-center p-6 relative overflow-hidden font-sans">
      {/* Ambient Background */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-blue-600/5 rounded-full blur-[120px] pointer-events-none" />
      
      {/* Logo Section */}
      <div className="relative z-10 flex flex-col items-center mb-10 animate-in fade-in slide-in-from-top-5 duration-700">
        <div className="w-24 h-24 bg-gradient-to-br from-blue-500 to-blue-700 rounded-[2rem] shadow-[0_20px_60px_-10px_rgba(37,99,235,0.5)] flex items-center justify-center mb-6 transform hover:scale-105 transition-transform duration-500 border border-white/10">
          <Shield size={48} className="text-white drop-shadow-md" />
        </div>
        <h1 className="text-4xl font-extrabold text-white tracking-tight mb-2">GuardianLink</h1>
        <p className="text-slate-400 font-medium italic tracking-wide text-sm">Safety & Security simplified.</p>
      </div>

      {/* Auth Card */}
      <div className="w-full max-w-[400px] relative z-10 animate-in fade-in slide-in-from-bottom-5 duration-700 delay-150">
        <div className="glass bg-[#0f172a]/60 backdrop-blur-xl rounded-[2.5rem] p-2 border border-white/5 shadow-2xl">
          
          {/* Tabs */}
          <div className="flex bg-[#020617]/50 rounded-[2rem] p-1.5 mb-8 relative">
            <button 
              onClick={() => { setMode('LOGIN'); setError(null); }}
              className={`flex-1 py-4 rounded-[1.7rem] text-xs font-black uppercase tracking-widest transition-all duration-300 relative z-10 ${mode === 'LOGIN' ? 'text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
            >
              Login
            </button>
            <button 
              onClick={() => { setMode('REGISTER'); setError(null); }}
              className={`flex-1 py-4 rounded-[1.7rem] text-xs font-black uppercase tracking-widest transition-all duration-300 relative z-10 ${mode === 'REGISTER' ? 'text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
            >
              Register
            </button>
            
            {/* Sliding Background */}
            <div 
              className={`absolute top-1.5 bottom-1.5 w-[calc(50%-6px)] bg-blue-600 rounded-[1.7rem] transition-all duration-300 ease-out shadow-lg shadow-blue-600/20 ${mode === 'REGISTER' ? 'translate-x-full left-0' : 'left-1.5'}`} 
            />
          </div>

          <form onSubmit={handleAuth} className="px-6 pb-6 space-y-5">
            {mode === 'REGISTER' && (
              <div className="space-y-4 animate-in fade-in slide-in-from-right duration-300">
                <div className="relative group">
                  <div className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-blue-500 transition-colors">
                    <UserIcon size={18} />
                  </div>
                  <input 
                    type="text" 
                    placeholder="Full Name" 
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-[#020617] border border-white/5 rounded-2xl py-4 pl-12 pr-5 text-sm font-bold text-white placeholder:text-slate-600 outline-none focus:border-blue-500/50 transition-all focus:bg-[#020617]/80"
                    required
                  />
                </div>
              </div>
            )}

            <div className="relative group">
              <div className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-blue-500 transition-colors">
                <Mail size={18} />
              </div>
              <input 
                type="email" 
                placeholder="Email Address" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-[#020617] border border-white/5 rounded-2xl py-4 pl-12 pr-5 text-sm font-bold text-white placeholder:text-slate-600 outline-none focus:border-blue-500/50 transition-all focus:bg-[#020617]/80"
                required
              />
            </div>

            <div className="relative group">
              <div className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-blue-500 transition-colors">
                <Lock size={18} />
              </div>
              <input 
                type={showPassword ? "text" : "password"} 
                placeholder="Password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-[#020617] border border-white/5 rounded-2xl py-4 pl-12 pr-12 text-sm font-bold text-white placeholder:text-slate-600 outline-none focus:border-blue-500/50 transition-all focus:bg-[#020617]/80"
                required
              />
              <button 
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-600 hover:text-slate-400 transition-colors"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>

            <button 
              type="submit" 
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-500 text-white font-black uppercase text-xs tracking-[0.2em] py-5 rounded-2xl shadow-[0_10px_40px_-10px_rgba(37,99,235,0.5)] active:scale-[0.98] transition-all disabled:opacity-70 disabled:cursor-not-allowed mt-4 flex items-center justify-center gap-2 group"
            >
              {loading ? (
                <>
                  <RefreshCw className="animate-spin" size={16} /> Processing
                </>
              ) : (
                <>
                  {mode === 'LOGIN' ? 'Login' : 'Register'} <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </button>
          </form>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mt-6 mx-4 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-start gap-3 animate-in slide-in-from-top-2">
            <AlertCircle size={18} className="text-red-500 shrink-0 mt-0.5" />
            <p className="text-xs font-bold text-red-400 leading-relaxed">{error}</p>
          </div>
        )}
      </div>

      <div className="absolute bottom-6 text-center">
         <p className="text-[10px] font-bold text-slate-700 uppercase tracking-widest">Secured by Aegis Mesh Protocol</p>
      </div>
    </div>
  );
};

export default AuthScreen;