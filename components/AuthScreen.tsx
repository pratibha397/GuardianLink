
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

  // Strict normalization: remove all non-digits for comparison
  const normalizePhone = (p: string) => p.replace(/\D/g, '');

  const handlePhoneSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const fullPhone = `${selectedCountry.code}${phone}`;
    const normalizedFull = normalizePhone(fullPhone);
    
    if (phone.length < 8) {
      setError("Please enter a valid phone number.");
      return;
    }

    setLoading(true);
    
    // Check global registry
    const registry = JSON.parse(localStorage.getItem(GLOBAL_REGISTRY_KEY) || '[]');
    const existingUser = registry.find((u: any) => normalizePhone(u.phone) === normalizedFull);

    if (authMode === 'register' && existingUser) {
      setTimeout(() => {
        setLoading(false);
        setError("Number already registered. Please login instead.");
      }, 600);
      return;
    }

    if (authMode === 'login' && !existingUser) {
      setTimeout(() => {
        setLoading(false);
        setError("User not found on the network. Please register first.");
      }, 600);
      return;
    }

    // Simulate secure OTP generation
    const newCode = Math.floor(1000 + Math.random() * 9000).toString();
    setDemoOtp(newCode);

    setTimeout(() => {
      setLoading(false);
      setStep('otp');
      setShowDemoToast(true);
      setOtp(['', '', '', '']);
      // Simulate toast timeout
      setTimeout(() => setShowDemoToast(false), 12000);
    }, 1000);
  };

  const handleVerify = (e: React.FormEvent) => {
    e.preventDefault();
    const enteredOtp = otp.join('');
    const fullPhone = `${selectedCountry.code}${phone}`;
    const normalizedFull = normalizePhone(fullPhone);
    
    if (enteredOtp !== demoOtp) {
      setError("Verification code incorrect. Please check the simulated SMS.");
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
          phone: fullPhone, // Store with country code
          name 
        };
        // Save to global registry
        registry.push(activeUser);
        localStorage.setItem(GLOBAL_REGISTRY_KEY, JSON.stringify(registry));
      } else {
        activeUser = registry.find((u: any) => normalizePhone(u.phone) === normalizedFull);
      }

      setLoading(false);
      onLogin(activeUser);
    }, 800);
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 overflow-hidden relative">
      {/* Simulated SMS Toast */}
      {showDemoToast && (
        <div className="fixed top-8 left-1/2 -translate-x-1/2 w-[90%] max-w-sm z-50 animate-in slide-in-from-top-full duration-500">
          <div className="bg-slate-900/90 backdrop-blur-2xl border border-blue-500/30 p-5 rounded-3xl shadow-[0_20px_60px_rgba(0,0,0,0.5)] flex gap-4 items-center">
            <div className="p-2 bg-blue-600 rounded-xl"><MessageSquare size={20} className="text-white" /></div>
            <div className="flex-1">
               <p className="text-[10px] text-blue-400 font-black uppercase tracking-widest mb-1">Guardian Security</p>
               <p className="text-sm text-white font-medium">Your verification code is: <span className="font-black text-lg text-blue-400 ml-1">{demoOtp}</span></p>
            </div>
          </div>
        </div>
      )}

      <div className="w-full max-w-md space-y-10 relative z-10">
        <div className="text-center space-y-4">
          <div className="inline-flex p-5 bg-blue-600 rounded-[2rem] shadow-[0_20px_40px_rgba(37,99,235,0.3)] border-4 border-slate-950">
            <Shield size={44} className="text-white" />
          </div>
          <h1 className="text-4xl font-black text-white italic tracking-tighter">Guardian Link</h1>
          <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.4em]">Personal Security Mesh</p>
        </div>

        <div className="bg-slate-900/40 p-8 rounded-[3rem] border border-slate-800/60 backdrop-blur-2xl shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-blue-500/50 to-transparent" />
          
          {step === 'phone' ? (
            <form onSubmit={handlePhoneSubmit} className="space-y-6">
              <div className="flex bg-slate-950/80 p-1 rounded-2xl border border-slate-800/50">
                <button type="button" onClick={() => {setAuthMode('register'); setError(null);}} className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${authMode === 'register' ? 'bg-blue-600 text-white shadow-xl scale-105' : 'text-slate-500'}`}>Register</button>
                <button type="button" onClick={() => {setAuthMode('login'); setError(null);}} className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${authMode === 'login' ? 'bg-blue-600 text-white shadow-xl scale-105' : 'text-slate-500'}`}>Login</button>
              </div>

              {authMode === 'register' && (
                <div className="relative group">
                  <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-blue-500 transition-colors" size={18} />
                  <input type="text" required placeholder="Display Name" value={name} onChange={(e) => setName(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-2xl py-4 pl-12 pr-4 text-white focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500/50 outline-none transition-all font-bold" />
                </div>
              )}

              <div className="flex gap-2">
                <select value={selectedCountry.code} onChange={(e) => setSelectedCountry(COUNTRY_CODES.find(c => c.code === e.target.value)!)} className="bg-slate-950 border border-slate-800 rounded-2xl p-4 text-white text-sm font-bold focus:border-blue-500/50 outline-none">
                  {COUNTRY_CODES.map(c => <option key={c.code} value={c.code}>{c.flag} {c.code}</option>)}
                </select>
                <input type="tel" required placeholder="Phone Number" value={phone} onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))} className="grow bg-slate-950 border border-slate-800 rounded-2xl py-4 px-4 text-white font-bold tracking-[0.2em] focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500/50 outline-none transition-all" />
              </div>

              {error && (
                <div className="text-red-400 text-[10px] font-bold uppercase flex items-center gap-3 bg-red-500/10 p-3 rounded-2xl animate-in slide-in-from-left-2">
                  <AlertCircle size={18} className="shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <button type="submit" disabled={loading} className="w-full bg-blue-600 hover:bg-blue-500 py-5 rounded-2xl text-white font-black uppercase tracking-widest shadow-[0_15px_30px_rgba(37,99,235,0.3)] active:scale-95 transition-all flex items-center justify-center gap-3 group">
                {loading ? (
                  <div className="w-5 h-5 border-3 border-white/20 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <span>{authMode === 'register' ? 'Join Network' : 'Access Feed'}</span>
                    <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                  </>
                )}
              </button>
            </form>
          ) : (
            <form onSubmit={handleVerify} className="space-y-10">
              <div className="text-center">
                <h3 className="text-2xl font-black text-white uppercase italic tracking-tighter">Enter Shield Code</h3>
                <p className="text-slate-500 text-[10px] mt-2 font-black uppercase tracking-widest">Sent to {selectedCountry.code} {phone}</p>
              </div>
              <div className="flex justify-center gap-4">
                {otp.map((digit, i) => (
                  <input key={i} ref={otpRefs[i]} type="text" maxLength={1} value={digit} onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, '');
                    const n = [...otp]; n[i] = val.slice(-1); setOtp(n);
                    if (val && i < 3) otpRefs[i+1].current?.focus();
                  }} className="w-16 h-20 bg-slate-950 border-2 border-slate-800 rounded-3xl text-center text-3xl font-black text-blue-500 focus:border-blue-600 focus:ring-4 focus:ring-blue-500/10 focus:outline-none shadow-inner transition-all" />
                ))}
              </div>
              
              {error && (
                <div className="text-red-400 text-[10px] font-bold uppercase flex items-center gap-3 bg-red-500/10 p-3 rounded-2xl animate-pulse">
                  <AlertCircle size={18} className="shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <button type="submit" disabled={loading} className="w-full bg-blue-600 py-5 rounded-2xl text-white font-black uppercase tracking-widest shadow-xl active:scale-95 transition-all flex items-center justify-center">
                {loading ? <div className="w-5 h-5 border-3 border-white/20 border-t-white rounded-full animate-spin" /> : 'Confirm Authentication'}
              </button>
              
              <button type="button" onClick={() => setStep('phone')} className="w-full text-slate-500 text-[9px] font-black uppercase tracking-widest hover:text-white transition-colors">Change Phone Number</button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default AuthScreen;
