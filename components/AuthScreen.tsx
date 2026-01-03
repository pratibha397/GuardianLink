
import { AlertCircle, ArrowRight, MessageSquare, Shield, User as UserIcon } from 'lucide-react';
import React, { useRef, useState } from 'react';
import { User } from '../types';

interface AuthScreenProps {
  onLogin: (user: User) => void;
}

const COUNTRY_CODES = [
  { code: '+91', country: 'IN', flag: '🇮🇳' },
  { code: '+1', country: 'US', flag: '🇺🇸' },
  { code: '+44', country: 'UK', flag: '🇬🇧' },
];

const GLOBAL_REGISTRY_KEY = 'guardian_link_global_users';

const AuthScreen: React.FC<AuthScreenProps> = ({ onLogin }) => {
  const [authMode, setAuthMode] = useState<'login' | 'register'>('register');
  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [selectedCountry, setSelectedCountry] = useState(COUNTRY_CODES[0]);
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [otp, setOtp] = useState(['', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [demoOtp, setDemoOtp] = useState('');
  const [showDemoToast, setShowDemoToast] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const otpRefs = [useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null)];

  /**
   * Universal Normalization:
   * Strips all non-digits. This ensures '+91 99999 88888' and '9999988888' match.
   */
  const normalizeForRegistry = (p: string) => p.replace(/\D/g, '');

  const handlePhoneSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const fullPhone = `${selectedCountry.code}${phone}`;
    const normalizedFull = normalizeForRegistry(fullPhone);
    
    if (phone.length < 8) {
      setError("Please enter a valid phone number.");
      return;
    }

    setLoading(true);
    
    // Simulating a database check with localStorage
    const registry = JSON.parse(localStorage.getItem(GLOBAL_REGISTRY_KEY) || '[]');
    const existingUser = registry.find((u: any) => normalizeForRegistry(u.phone) === normalizedFull);

    if (authMode === 'register' && existingUser) {
      setTimeout(() => {
        setLoading(false);
        setError("This number is already registered. Please use 'Login' instead.");
      }, 700);
      return;
    }

    if (authMode === 'login' && !existingUser) {
      setTimeout(() => {
        setLoading(false);
        setError("Account not found. Please register this number first.");
      }, 700);
      return;
    }

    // Generate a secure simulated OTP
    const newCode = Math.floor(1000 + Math.random() * 9000).toString();
    setDemoOtp(newCode);

    setTimeout(() => {
      setLoading(false);
      setStep('otp');
      setShowDemoToast(true);
      setOtp(['', '', '', '']);
      setTimeout(() => setShowDemoToast(false), 12000);
    }, 1100);
  };

  const handleVerify = (e: React.FormEvent) => {
    e.preventDefault();
    const enteredOtp = otp.join('');
    const fullPhone = `${selectedCountry.code}${phone}`;
    const normalizedFull = normalizeForRegistry(fullPhone);
    
    if (enteredOtp !== demoOtp) {
      setError("Incorrect code. Please check your simulated SMS.");
      return;
    }
    
    setLoading(true);
    setError(null);

    setTimeout(() => {
      const registry = JSON.parse(localStorage.getItem(GLOBAL_REGISTRY_KEY) || '[]');
      let activeUser: User;

      if (authMode === 'register') {
        activeUser = { 
          id: Date.now().toString(), 
          phone: fullPhone, 
          name 
        };
        // Add to global shared registry
        registry.push(activeUser);
        localStorage.setItem(GLOBAL_REGISTRY_KEY, JSON.stringify(registry));
      } else {
        activeUser = registry.find((u: any) => normalizeForRegistry(u.phone) === normalizedFull);
      }

      setLoading(false);
      onLogin(activeUser);
    }, 900);
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 overflow-hidden relative">
      {showDemoToast && (
        <div className="fixed top-8 left-1/2 -translate-x-1/2 w-[92%] max-w-sm z-50 animate-in slide-in-from-top-full duration-700">
          <div className="bg-slate-900/95 backdrop-blur-3xl border border-blue-500/40 p-5 rounded-[2.5rem] shadow-[0_25px_80px_rgba(0,0,0,0.7)] flex gap-4 items-center">
            <div className="p-3 bg-blue-600 rounded-[1.2rem] shadow-lg"><MessageSquare size={22} className="text-white" /></div>
            <div className="flex-1">
               <p className="text-[10px] text-blue-500 font-black uppercase tracking-[0.3em] mb-1">Guardian SMS</p>
               <p className="text-sm text-white font-medium">Your verification code is <span className="font-black text-xl text-blue-400 ml-1 tracking-tighter tabular-nums">{demoOtp}</span></p>
            </div>
          </div>
        </div>
      )}

      <div className="w-full max-w-md space-y-12 relative z-10">
        <div className="text-center space-y-6">
          <div className="inline-flex p-6 bg-blue-600 rounded-[2.5rem] shadow-[0_30px_60px_rgba(37,99,235,0.4)] border-4 border-slate-950">
            <Shield size={56} className="text-white" />
          </div>
          <div>
            <h1 className="text-5xl font-black text-white italic tracking-tighter leading-none">Guardian</h1>
            <p className="text-slate-600 text-[11px] font-black uppercase tracking-[0.5em] mt-3">Safety Registry</p>
          </div>
        </div>

        <div className="bg-slate-900/50 p-10 rounded-[4rem] border border-slate-800/80 backdrop-blur-3xl shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-blue-500/60 to-transparent" />
          
          {step === 'phone' ? (
            <form onSubmit={handlePhoneSubmit} className="space-y-8">
              <div className="flex bg-slate-950/90 p-1.5 rounded-3xl border border-slate-800/60">
                <button type="button" onClick={() => {setAuthMode('register'); setError(null);}} className={`flex-1 py-4 text-[11px] font-black uppercase tracking-[0.2em] rounded-[1.2rem] transition-all duration-300 ${authMode === 'register' ? 'bg-blue-600 text-white shadow-2xl' : 'text-slate-600'}`}>Register</button>
                <button type="button" onClick={() => {setAuthMode('login'); setError(null);}} className={`flex-1 py-4 text-[11px] font-black uppercase tracking-[0.2em] rounded-[1.2rem] transition-all duration-300 ${authMode === 'login' ? 'bg-blue-600 text-white shadow-2xl' : 'text-slate-600'}`}>Login</button>
              </div>

              {authMode === 'register' && (
                <div className="relative group">
                  <div className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-600"><UserIcon size={20} /></div>
                  <input type="text" required placeholder="Full Name" value={name} onChange={(e) => setName(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-3xl py-5 pl-14 pr-6 text-white focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500/50 outline-none transition-all font-bold" />
                </div>
              )}

              <div className="flex gap-3">
                <select value={selectedCountry.code} onChange={(e) => setSelectedCountry(COUNTRY_CODES.find(c => c.code === e.target.value)!)} className="bg-slate-950 border border-slate-800 rounded-3xl p-5 text-white text-sm font-black focus:border-blue-500/50 outline-none appearance-none">
                  {COUNTRY_CODES.map(c => <option key={c.code} value={c.code}>{c.flag} {c.code}</option>)}
                </select>
                <input type="tel" required placeholder="Phone Number" value={phone} onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))} className="grow bg-slate-950 border border-slate-800 rounded-3xl py-5 px-6 text-white font-black tracking-[0.2em] focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500/50 outline-none transition-all" />
              </div>

              {error && (
                <div className="text-red-400 text-[10px] font-black uppercase flex items-center gap-4 bg-red-500/10 p-4 rounded-3xl border border-red-500/20 animate-in slide-in-from-left-4">
                  <AlertCircle size={20} className="shrink-0" />
                  <span className="leading-tight">{error}</span>
                </div>
              )}

              <button type="submit" disabled={loading} className="w-full bg-blue-600 hover:bg-blue-500 py-6 rounded-[2rem] text-white font-black uppercase tracking-[0.2em] shadow-[0_20px_50px_rgba(37,99,235,0.4)] active:scale-95 transition-all flex items-center justify-center gap-4 group">
                {loading ? <div className="w-6 h-6 border-4 border-white/20 border-t-white rounded-full animate-spin" /> : (
                  <>
                    <span>{authMode === 'register' ? 'Register Account' : 'Sign In'}</span>
                    <ArrowRight size={20} className="group-hover:translate-x-2 transition-transform" />
                  </>
                )}
              </button>
            </form>
          ) : (
            <form onSubmit={handleVerify} className="space-y-12">
              <div className="text-center">
                <h3 className="text-2xl font-black text-white uppercase italic tracking-tighter">Enter Shield Code</h3>
                <p className="text-slate-600 text-[11px] mt-3 font-black uppercase tracking-widest leading-relaxed">Verifying {selectedCountry.code} {phone}</p>
              </div>
              <div className="flex justify-center gap-4">
                {otp.map((digit, i) => (
                  <input key={i} ref={otpRefs[i]} type="text" maxLength={1} value={digit} onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, '');
                    const n = [...otp]; n[i] = val.slice(-1); setOtp(n);
                    if (val && i < 3) otpRefs[i+1].current?.focus();
                  }} className="w-16 h-24 bg-slate-950 border-2 border-slate-800 rounded-[1.8rem] text-center text-4xl font-black text-blue-500 focus:border-blue-600 focus:ring-4 focus:ring-blue-500/10 focus:outline-none transition-all tabular-nums" />
                ))}
              </div>
              
              {error && (
                <div className="text-red-400 text-[10px] font-black uppercase flex items-center gap-4 bg-red-500/10 p-4 rounded-3xl border border-red-500/20">
                  <AlertCircle size={20} className="shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <button type="submit" disabled={loading} className="w-full bg-blue-600 py-6 rounded-[2rem] text-white font-black uppercase tracking-[0.2em] shadow-xl active:scale-95 transition-all">
                {loading ? <div className="w-6 h-6 border-4 border-white/20 border-t-white rounded-full animate-spin" /> : 'Complete Authentication'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default AuthScreen;
