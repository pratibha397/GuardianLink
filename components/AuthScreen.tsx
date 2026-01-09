import { AlertCircle, ArrowLeft, CheckCircle2, Eye, EyeOff, Lock, Mail, Shield, User as UserIcon } from 'lucide-react';
import { useState } from 'react';
import {
  auth,
  createUserWithEmailAndPassword,
  db,
  doc,
  getDoc,
  sendPasswordResetEmail,
  setDoc,
  signInWithEmailAndPassword,
  updateProfile
} from '../services/firebase';
import { User } from '../types';

interface AuthScreenProps {
  onLogin: (user: User) => void;
}

const AuthScreen: React.FC<AuthScreenProps> = ({ onLogin }) => {
  const [view, setView] = useState<'login' | 'register' | 'forgot'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const isValidEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.trim());

  const syncUserProfile = async (uid: string, email: string, displayName: string) => {
    try {
      await setDoc(doc(db, "users", email.toLowerCase()), {
        uid,
        email: email.toLowerCase(),
        name: displayName,
        lastActive: Date.now()
      }, { merge: true });
    } catch (e) {
      console.error("Discovery sync failed", e);
    }
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    const cleanEmail = email.trim().toLowerCase();

    if (!isValidEmail(cleanEmail)) {
      setError("Please enter a valid email address.");
      return;
    }

    if (view !== 'forgot' && password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    setLoading(true);

    if (!isFirebaseConfigured) {
      setTimeout(() => {
        onLogin({
          id: 'demo_user',
          email: cleanEmail,
          name: name.trim() || 'Guest User'
        });
        setLoading(false);
      }, 800);
      return;
    }

    try {
      if (view === 'forgot') {
        await sendPasswordResetEmail(auth, cleanEmail);
        setSuccessMsg("Reset link sent! Please check your inbox.");
        setView('login');
        setLoading(false);
        return;
      }

      if (view === 'register') {
        if (!name.trim()) throw new Error("A name is required for registration.");
        const credential = await createUserWithEmailAndPassword(auth, cleanEmail, password);
        await updateProfile(credential.user, { displayName: name.trim() });
        await syncUserProfile(credential.user.uid, cleanEmail, name.trim());

        onLogin({
          id: credential.user.uid,
          email: cleanEmail,
          name: name.trim()
        });
      } else {
        const credential = await signInWithEmailAndPassword(auth, cleanEmail, password);
        let finalName = credential.user.displayName || 'User';

        const userSnap = await getDoc(doc(db, "users", cleanEmail));
        if (userSnap.exists()) {
          const userData = userSnap.data();
          if (userData && userData.name) {
            finalName = userData.name;
          }
        }

        await syncUserProfile(credential.user.uid, cleanEmail, finalName);

        onLogin({ 
          id: credential.user.uid, 
          email: cleanEmail,
          name: finalName
        });
      }
    } catch (err: any) {
      console.error("Auth Error:", err);
      let message = "An error occurred during authentication.";
      switch (err.code) {
        case 'auth/email-already-in-use': message = "This email is already registered."; break;
        case 'auth/invalid-credential':
        case 'auth/wrong-password': message = "Incorrect email or password."; break;
        case 'auth/user-not-found': message = "No account exists with this email."; break;
        default: message = err.message || "Sign in failed.";
      }
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#020617] flex flex-col items-center justify-center p-6 sm:p-12">
      <div className="w-full max-w-[400px] space-y-8 animate-in fade-in zoom-in duration-500">
        <div className="text-center space-y-4">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-blue-600 rounded-3xl shadow-[0_20px_40px_rgba(37,99,235,0.3)] border-b-4 border-blue-800">
            <Shield size={40} className="text-white fill-blue-400/20" />
          </div>
          <div className="space-y-1">
            <h1 className="text-3xl font-extrabold text-white tracking-tight">GuardianLink</h1>
            <p className="text-sm font-medium text-slate-500 italic">Safety & Security simplified.</p>
          </div>
        </div>

        <div className="bg-slate-900/40 p-8 rounded-[2.5rem] border border-white/5 backdrop-blur-3xl shadow-2xl relative overflow-hidden">
          {view !== 'forgot' && (
            <div className="flex bg-slate-950/80 p-1.5 rounded-2xl border border-white/5 mb-8">
              <button 
                type="button" 
                onClick={() => { setView('login'); setError(null); }} 
                className={`flex-1 py-3 text-xs font-bold uppercase rounded-xl transition-all duration-300 ${view === 'login' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500'}`}
              >
                Login
              </button>
              <button 
                type="button" 
                onClick={() => { setView('register'); setError(null); }} 
                className={`flex-1 py-3 text-xs font-bold uppercase rounded-xl transition-all duration-300 ${view === 'register' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500'}`}
              >
                Register
              </button>
            </div>
          )}

          <form onSubmit={handleAuth} className="space-y-5">
            {view === 'forgot' && (
              <button 
                type="button" 
                onClick={() => setView('login')}
                className="flex items-center gap-2 text-blue-500 text-xs font-bold mb-6 hover:text-blue-400 transition-colors"
              >
                <ArrowLeft size={14} /> Back to Login
              </button>
            )}

            <div className="space-y-4">
              {view === 'register' && (
                <div className="relative group">
                  <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600 group-focus-within:text-blue-500 transition-colors" size={18} />
                  <input 
                    type="text" required placeholder="Full Name" value={name} 
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setName(e.target.value)} 
                    className="w-full bg-slate-950 border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-sm text-white font-medium outline-none focus:border-blue-500 transition-all" 
                  />
                </div>
              )}

              <div className="relative group">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600 group-focus-within:text-blue-500 transition-colors" size={18} />
                <input 
                  type="email" required placeholder="Email Address" value={email} 
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)} 
                  className="w-full bg-slate-950 border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-sm text-white font-medium outline-none focus:border-blue-500 transition-all" 
                />
              </div>

              {view !== 'forgot' && (
                <div className="relative group">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600 group-focus-within:text-blue-500 transition-colors" size={18} />
                  <input 
                    type={showPassword ? "text" : "password"} required placeholder="Password" value={password} 
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)} 
                    className="w-full bg-slate-950 border border-white/10 rounded-2xl py-4 pl-12 pr-12 text-sm text-white font-medium outline-none focus:border-blue-500 transition-all" 
                  />
                  <button 
                    type="button" onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-600 hover:text-blue-500 transition-colors"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              )}
            </div>

            {error && (
              <div className="flex items-center gap-3 bg-red-500/10 border border-red-500/20 p-4 rounded-2xl animate-in slide-in-from-top-1">
                <AlertCircle size={16} className="text-red-500 shrink-0" />
                <p className="text-[11px] font-bold text-red-400 uppercase tracking-tight">{error}</p>
              </div>
            )}

            {successMsg && (
              <div className="flex items-center gap-3 bg-green-500/10 border border-green-500/20 p-4 rounded-2xl animate-in slide-in-from-top-1">
                <CheckCircle2 size={16} className="text-green-500 shrink-0" />
                <p className="text-[11px] font-bold text-green-400 uppercase tracking-tight">{successMsg}</p>
              </div>
            )}

            <button 
              type="submit" disabled={loading} 
              className="w-full bg-blue-600 hover:bg-blue-500 py-4 rounded-2xl text-white font-bold uppercase tracking-widest text-xs shadow-xl active:scale-95 transition-all disabled:opacity-50"
            >
              {loading ? "Processing..." : (view === 'register' ? "Register Account" : (view === 'login' ? "Login" : "Reset Password"))}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default AuthScreen;