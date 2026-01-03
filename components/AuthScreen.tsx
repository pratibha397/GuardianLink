
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

  // Normalization logic identical to SettingsPanel.tsx
  const normalizeForLookup = (p: string) => {
    const digits = p.replace(/\D/g, '');
    return digits.length >= 10 ? digits.slice(-10) : digits;
  };

  const handlePhoneSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const fullPhone = `${selectedCountry.code}${phone}`;
    const normalizedFull = normalizeForLookup(fullPhone);
    
    if (phone.length < 8) {
      setError("Please enter a valid phone number.");
      return;
    }

    setLoading(true);
    
    // Check global registry
    const registry = JSON.parse(localStorage.getItem(GLOBAL_REGISTRY_KEY) || '[]');
    const existingUser = registry.find((u: any) => normalizeForLookup(u.phone) === normalizedFull);

    if (authMode === 'register' && existingUser) {
      setTimeout(() => {
        setLoading(false);
        setError("Account exists. Please log in using the same number.");
      }, 700);
      return;
    }

    if (authMode === 'login' && !existingUser) {
      setTimeout(() => {
        setLoading(false);
        setError("No account found with this number. Please register first.");
      }, 700);
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
      setTimeout(() => setShowDemoToast(false), 12000);
    }, 1100);
  };

  const handleVerify = (e: React.FormEvent) => {
    e.preventDefault();
    const enteredOtp = otp.join('');
    const fullPhone = `${selectedCountry.code}${phone}`;
    const normalizedFull = normalizeForLookup(fullPhone);
    
    if (enteredOtp !== demoOtp) {
      setError("Incorrect Shield Code. Check the simulated SMS notification.");
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
        // Verify again just in case of race conditions
        if (!registry.some((u: any) => normalizeForLookup(u.phone) === normalizedFull)) {
          registry.push(activeUser);
          localStorage.setItem(GLOBAL_REGISTRY_KEY, JSON.stringify(registry));
        } else {
          activeUser = registry.find((u: any) => normalizeForLookup(u.phone) === normalizedFull);
        }
      } else {
        activeUser = registry.find((u: any) => normalizeForLookup(u.phone) === normalizedFull);
      }

      setLoading(false);
      onLogin(activeUser);
    }, 900);
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 overflow-hidden relative">
      {/* Simulated SMS Notification */}
      {showDemoToast && (
        <div className="fixed top-8 left-1/2 -translate-x-1/2 w-[92%] max-w-sm z-50 animate-in slide-in-from-top-full duration-700">
          <div className="bg-slate-900/95 backdrop-blur-3xl border border-blue-500/40 p-5 rounded-[2.5rem] shadow-[0_25px_80px_rgba(0,0,0,0.7)] flex gap-4 items-center">
            <div className="p-3 bg-blue-600 rounded-[1.2rem] shadow-lg"><MessageSquare size={22} className="text-white" /></div>
            <div className="flex-1">
               <p className="text-[10px] text-blue-500 font-black uppercase tracking-[0.3em] mb-1">Guardian Link SMS</p>
               <p className="text-sm text-white font-medium">Your verification code is <span className="font-black text-xl text-blue-400 ml-1 tracking-tighter tabular-nums">{demoOtp}</span></p>
            </div>
          </div>
        </div>
      )}

      <div className="w-full max-w-md space-y-12 relative z-10">
        <div className="text-center space-y-6">
          <div className="inline-flex p-6 bg-blue-600 rounded-[2.5rem] shadow-[0_30px_60px_rgba(37,99,235,0.4)] border-4 border-slate-950 relative">
            <Shield size={56} className="text-white" />
            <div className="absolute -top-2 -right-2 w-6 h-6 bg-green-500 border-4 border-slate-950 rounded-full animate-pulse" />
          </div>
          <div>
            <h1 className="text-5xl font-black text-white italic tracking-tighter leading-none">Guardian</h1>
            <p className="text-slate-600 text-[11px] font-black uppercase tracking-[0.5em] mt-3">Personal Security Mesh</p>
          </div>
        </div>

        <div className="bg-slate-900/50 p-10 rounded-[4rem] border border-slate-800/80 backdrop-blur-3xl shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-blue-500/60 to-transparent" />
          
          {step === 'phone' ? (
            <form onSubmit={handlePhoneSubmit} className="space-y-8">
              <div className="flex bg-slate-950/90 p-1.5 rounded-3xl border border-slate-800/60 shadow-inner">
                <button type="button" onClick={() => {setAuthMode('register'); setError(null);}} className={`flex-1 py-4 text-[11px] font-black uppercase tracking-[0.2em] rounded-[1.2rem] transition-all duration-300 ${authMode === 'register' ? 'bg-blue-600 text-white shadow-2xl scale-105' : 'text-slate-600 hover:text-slate-400'}`}>Register</button>
                <button type="button" onClick={() => {setAuthMode('login'); setError(null);}} className={`flex-1 py-4 text-[11px] font-black uppercase tracking-[0.2em] rounded-[1.2rem] transition-all duration-300 ${authMode === 'login' ? 'bg-blue-600 text-white shadow-2xl scale-105' : 'text-slate-600 hover:text-slate-400'}`}>Login</button>
              </div>

              {authMode === 'register' && (
                <div className="relative group">
                  <div className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-600 group-focus-within:text-blue-500 transition-colors"><UserIcon size={20} /></div>
                  <input type="text" required placeholder="Display Name" value={name} onChange={(e) => setName(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-3xl py-5 pl-14 pr-6 text-white focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500/50 outline-none transition-all font-bold shadow-inner" />
                </div>
              )}

              <div className="flex gap-3">
                <select value={selectedCountry.code} onChange={(e) => setSelectedCountry(COUNTRY_CODES.find(c => c.code === e.target.value)!)} className="bg-slate-950 border border-slate-800 rounded-3xl p-5 text-white text-sm font-black focus:border-blue-500/50 outline-none appearance-none shadow-inner">
                  {COUNTRY_CODES.map(c => <option key={c.code} value={c.code}>{c.flag} {c.code}</option>)}
                </select>
                <input type="tel" required placeholder="Phone Number" value={phone} onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))} className="grow bg-slate-950 border border-slate-800 rounded-3xl py-5 px-6 text-white font-black tracking-[0.2em] focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500/50 outline-none transition-all shadow-inner placeholder:text-slate-800" />
              </div>

              {error && (
                <div className="text-red-400 text-[10px] font-black uppercase flex items-center gap-4 bg-red-500/10 p-4 rounded-3xl border border-red-500/20 animate-in slide-in-from-left-4">
                  <AlertCircle size={20} className="shrink-0" />
                  <span className="leading-tight">{error}</span>
                </div>
              )}

              <button type="submit" disabled={loading} className="w-full bg-blue-600 hover:bg-blue-500 py-6 rounded-[2rem] text-white font-black uppercase tracking-[0.2em] shadow-[0_20px_50px_rgba(37,99,235,0.4)] active:scale-95 transition-all flex items-center justify-center gap-4 group">
                {loading ? (
                  <div className="w-6 h-6 border-4 border-white/20 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <span>{authMode === 'register' ? 'Initialize Protection' : 'Access Network'}</span>
                    <ArrowRight size={20} className="group-hover:translate-x-2 transition-transform" />
                  </>
                )}
              </button>
            </form>
          ) : (
            <form onSubmit={handleVerify} className="space-y-12">
              <div className="text-center">
                <h3 className="text-2xl font-black text-white uppercase italic tracking-tighter leading-none">Enter Shield Code</h3>
                <p className="text-slate-600 text-[11px] mt-3 font-black uppercase tracking-widest leading-relaxed">Sent to security link at<br/>{selectedCountry.code} {phone}</p>
              </div>
              <div className="flex justify-center gap-4">
                {otp.map((digit, i) => (
                  <input key={i} ref={otpRefs[i]} type="text" maxLength={1} value={digit} onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, '');
                    const n = [...otp]; n[i] = val.slice(-1); setOtp(n);
                    if (val && i < 3) otpRefs[i+1].current?.focus();
                  }} className="w-16 h-24 bg-slate-950 border-2 border-slate-800 rounded-[1.8rem] text-center text-4xl font-black text-blue-500 focus:border-blue-600 focus:ring-4 focus:ring-blue-500/10 focus:outline-none shadow-inner transition-all tabular-nums" />
                ))}
              </div>
              
              {error && (
                <div className="text-red-400 text-[10px] font-black uppercase flex items-center gap-4 bg-red-500/10 p-4 rounded-3xl border border-red-500/20 animate-pulse">
                  <AlertCircle size={20} className="shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <button type="submit" disabled={loading} className="w-full bg-blue-600 py-6 rounded-[2rem] text-white font-black uppercase tracking-[0.2em] shadow-[0_20px_40px_rgba(37,99,235,0.4)] active:scale-95 transition-all flex items-center justify-center">
                {loading ? <div className="w-6 h-6 border-4 border-white/20 border-t-white rounded-full animate-spin" /> : 'Confirm Security Identity'}
              </button>
              
              <button type="button" onClick={() => setStep('phone')} className="w-full text-slate-700 text-[10px] font-black uppercase tracking-[0.4em] hover:text-white transition-colors py-2">Restart Authentication</button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default AuthScreen;
