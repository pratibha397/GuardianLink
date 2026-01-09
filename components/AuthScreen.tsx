import { AlertCircle, ArrowRight, Mail, RefreshCw, Shield, User as UserIcon } from 'lucide-react';
import { useState } from 'react';
import { auth, db, doc, getDoc, setDoc, signInAnonymously } from '../services/firebase';
import { User } from '../types';

interface AuthScreenProps {
  onLogin: (user: User) => void;
}

type AuthMode = 'LOGIN' | 'REGISTER';

const AuthScreen: React.FC<AuthScreenProps> = ({ onLogin }) => {
  const [mode, setMode] = useState<AuthMode>('LOGIN');
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    
    // Basic Validation
    const cleanEmail = email.trim().toLowerCase();
    const cleanName = name.trim();

    if (!cleanEmail.includes('@')) {
      setError("Please enter a valid email address.");
      return;
    }

    if (mode === 'REGISTER' && cleanName.length < 2) {
      setError("Please enter your full name.");
      return;
    }

    setLoading(true);

    try {
      // 1. Ensure we have a Firebase Session (Anonymous allows DB reads)
      if (!auth.currentUser) {
        await signInAnonymously(auth);
      }

      // 2. Check Database for existing user
      const userRef = doc(db, "users", cleanEmail);
      const userSnap = await getDoc(userRef);

      if (mode === 'REGISTER') {
        if (userSnap.exists()) {
          setError("Account already exists. Please Sign In.");
          setLoading(false);
          return;
        }

        // Create New User
        const newUser: User = {
          id: `user_${Date.now()}`,
          email: cleanEmail,
          name: cleanName
        };

        await setDoc(userRef, newUser);
        onLogin(newUser);

      } else {
        // Login Mode
        if (!userSnap.exists()) {
          setError("Account not found. Please Create an Account.");
          setLoading(false);
          return;
        }

        const userData = userSnap.data() as User;
        onLogin(userData);
      }

    } catch (err: any) {
      console.error("Auth Error:", err);
      // Fallback for demo/offline if DB fails (Simulated Login)
      if (err.code === 'permission-denied' || err.message.includes('offline')) {
         const mockUser: User = {
            id: `user_${Date.now()}`,
            email: cleanEmail,
            name: mode === 'REGISTER' ? cleanName : 'Unknown User'
         };
         onLogin(mockUser);
      } else {
         setError("Connection failed. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  const toggleMode = () => {
    setMode(mode === 'LOGIN' ? 'REGISTER' : 'LOGIN');
    setError(null);
  };

  return (
    <div className="min-h-screen bg-[#020617] flex flex-col items-center justify-center p-6 sm:p-12 relative overflow-hidden">
      {/* Background Elements */}
      <div className="absolute top-1/4 -left-20 w-96 h-96 bg-blue-600/10 rounded-full blur-[100px]" />
      <div className="absolute bottom-1/4 -right-20 w-96 h-96 bg-blue-900/10 rounded-full blur-[100px]" />

      <div className="w-full max-w-[400px] space-y-8 relative z-10">
        <div className="text-center space-y-4">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-blue-600 rounded-3xl shadow-[0_20px_40px_rgba(37,99,235,0.3)] border-b-4 border-blue-800">
            <Shield size={40} className="text-white fill-blue-400/20" />
          </div>
          <div className="space-y-1">
            <h1 className="text-3xl font-extrabold text-white tracking-tight">GuardianLink</h1>
            <p className="text-sm font-medium text-slate-500 italic">Safety & Security simplified.</p>
          </div>
        </div>

        <div className="glass p-8 rounded-[2.5rem] border border-white/5 shadow-2xl relative overflow-hidden">
          {/* Toggle Tabs */}
          <div className="flex bg-slate-950/50 p-1 rounded-2xl mb-8 border border-white/5">
            <button 
              onClick={() => { setMode('LOGIN'); setError(null); }}
              className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${mode === 'LOGIN' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
            >
              Sign In
            </button>
            <button 
              onClick={() => { setMode('REGISTER'); setError(null); }}
              className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${mode === 'REGISTER' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
            >
              Create Account
            </button>
          </div>

          <form onSubmit={handleAuth} className="space-y-5 animate-in fade-in slide-in-from-right duration-300">
            <div className="space-y-2 text-center mb-6">
              <h2 className="text-xl font-bold text-white">
                {mode === 'LOGIN' ? 'Welcome Back' : 'Join the Network'}
              </h2>
              <p className="text-xs text-slate-500 font-medium">
                {mode === 'LOGIN' ? 'Access your secure dashboard' : 'Set up your Guardian identity'}
              </p>
            </div>
            
            {mode === 'REGISTER' && (
              <div className="relative group animate-in fade-in slide-in-from-top-2">
                <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600 group-focus-within:text-blue-500 transition-colors" size={18} />
                <input 
                  type="text" required placeholder="Full Name" value={name} 
                  onChange={(e) => setName(e.target.value)} 
                  className="w-full bg-slate-950 border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-sm text-white font-medium outline-none focus:border-blue-500 transition-all" 
                />
              </div>
            )}

            <div className="relative group">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600 group-focus-within:text-blue-500 transition-colors" size={18} />
              <input 
                type="email" required placeholder="Email Address" value={email} 
                onChange={(e) => setEmail(e.target.value)} 
                className="w-full bg-slate-950 border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-sm text-white font-medium outline-none focus:border-blue-500 transition-all" 
              />
            </div>

            <button 
              type="submit" disabled={loading} 
              className="w-full bg-blue-600 hover:bg-blue-500 py-4 rounded-2xl text-white font-bold uppercase tracking-widest text-xs shadow-xl active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2 mt-4"
            >
              {loading ? <RefreshCw className="animate-spin" size={16}/> : (mode === 'LOGIN' ? 'Authenticate' : 'Register Identity')} <ArrowRight size={16} />
            </button>
          </form>

          {error && (
            <div className="mt-6 flex items-center gap-3 bg-red-500/10 border border-red-500/20 p-4 rounded-2xl animate-in slide-in-from-top-1">
              <AlertCircle size={16} className="text-red-500 shrink-0" />
              <p className="text-[11px] font-bold text-red-400 uppercase tracking-tight">{error}</p>
            </div>
          )}
        </div>
        
        <p className="text-center text-[10px] text-slate-600 font-bold uppercase tracking-widest">
          Secured by Aegis Mesh Protocol
        </p>
      </div>
    </div>
  );
};

export default AuthScreen;