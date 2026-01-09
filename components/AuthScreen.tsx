import { AlertCircle, ArrowRight, Mail, RefreshCw, Shield, User as UserIcon } from 'lucide-react';
import { useState } from 'react';
import { auth, signInAnonymously } from '../services/firebase';
import { User } from '../types';

interface AuthScreenProps {
  onLogin: (user: User) => void;
}

const AuthScreen: React.FC<AuthScreenProps> = ({ onLogin }) => {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.includes('@') || name.length < 2) {
      setError("Please enter a valid name and email.");
      return;
    }
    
    setError(null);
    setLoading(true);
    
    try {
      // Authenticate with Firebase anonymously to ensure DB access
      await signInAnonymously(auth);
      
      const mockUser: User = {
        id: `user_${Date.now()}`,
        email: email.trim(),
        name: name.trim()
      };
      
      onLogin(mockUser);
    } catch (err) {
      console.error("Login Error:", err);
      // Fallback: Try login anyway for offline demo if auth fails (though DB won't work)
      const mockUser: User = {
        id: `user_${Date.now()}`,
        email: email.trim(),
        name: name.trim()
      };
      onLogin(mockUser);
    } finally {
      setLoading(false);
    }
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
          <form onSubmit={handleLogin} className="space-y-6 animate-in fade-in slide-in-from-right duration-300">
            <div className="space-y-2 text-center mb-8">
              <h2 className="text-xl font-bold text-white">Get Started</h2>
              <p className="text-xs text-slate-500 font-medium">Create your secure profile</p>
            </div>
            
            <div className="relative group">
              <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600 group-focus-within:text-blue-500 transition-colors" size={18} />
              <input 
                type="text" required placeholder="Your Name" value={name} 
                onChange={(e) => setName(e.target.value)} 
                className="w-full bg-slate-950 border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-sm text-white font-medium outline-none focus:border-blue-500 transition-all" 
              />
            </div>

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
              className="w-full bg-blue-600 hover:bg-blue-500 py-4 rounded-2xl text-white font-bold uppercase tracking-widest text-xs shadow-xl active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? <RefreshCw className="animate-spin" size={16}/> : 'Enter System'} <ArrowRight size={16} />
            </button>
          </form>

          {error && (
            <div className="mt-6 flex items-center gap-3 bg-red-500/10 border border-red-500/20 p-4 rounded-2xl animate-in slide-in-from-top-1">
              <AlertCircle size={16} className="text-red-500 shrink-0" />
              <p className="text-[11px] font-bold text-red-400 uppercase tracking-tight">{error}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AuthScreen;