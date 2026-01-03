
import { AlertCircle, MessageSquare, Shield, User as UserIcon } from 'lucide-react';
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

  const handlePhoneSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const fullPhone = `${selectedCountry.code}${phone}`;
    
    if (phone.length < 8) return;
    setLoading(true);
    
    const registry = JSON.parse(localStorage.getItem(GLOBAL_REGISTRY_KEY) || '[]');
    const existingUser = registry.find((u: any) => u.phone === fullPhone);

    if (authMode === 'register' && existingUser) {
      setTimeout(() => {
        setLoading(false);
        setError("This number is already registered. Please login instead.");
      }, 800);
      return;
    }

    if (authMode === 'login' && !existingUser) {
      setTimeout(() => {
        setLoading(false);
        setError("User not found. Please register first.");
      }, 800);
      return;
    }

    const newCode = Math.floor(1000 + Math.random() * 9000).toString();
    setDemoOtp(newCode);

    setTimeout(() => {
      setLoading(false);
      setStep('otp');
      setShowDemoToast(true);
      setOtp(['', '', '', '']);
      setTimeout(() => setShowDemoToast(false), 15000);
    }, 1200);
  };

  const handleVerify = (e: React.FormEvent) => {
    e.preventDefault();
    const fullOtp = otp.join('');
    const fullPhone = `${selectedCountry.code}${phone}`;
    
    if (fullOtp !== demoOtp) {
      setError("Invalid code.");
      return;
    }
    
    setLoading(true);
    setTimeout(() => {
      const registry = JSON.parse(localStorage.getItem(GLOBAL_REGISTRY_KEY) || '[]');
      let activeUser: User;

      if (authMode === 'register') {
        activeUser = { id: Date.now().toString(), phone: fullPhone, name };
        registry.push(activeUser);
        localStorage.setItem(GLOBAL_REGISTRY_KEY, JSON.stringify(registry));
      } else {
        activeUser = registry.find((u: any) => u.phone === fullPhone);
      }

      onLogin(activeUser);
    }, 1000);
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 overflow-hidden relative">
      {showDemoToast && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 w-full max-w-xs z-50 animate-in slide-in-from-top-full duration-500">
          <div className="bg-white/10 backdrop-blur-xl border border-white/20 p-4 rounded-2xl shadow-2xl flex gap-3 items-center">
            <MessageSquare size={18} className="text-blue-500" />
            <p className="text-xs text-white font-medium">Your Guardian Code: <span className="font-black text-lg text-blue-400 ml-2">{demoOtp}</span></p>
          </div>
        </div>
      )}

      <div className="w-full max-w-md space-y-8 relative z-10">
        <div className="text-center space-y-4">
          <div className="inline-block p-4 bg-blue-600 rounded-3xl shadow-2xl">
            <Shield size={40} className="text-white" />
          </div>
          <h1 className="text-4xl font-black text-white italic tracking-tighter">Guardian Link</h1>
        </div>

        <div className="bg-slate-900/60 p-8 rounded-[2.5rem] border border-slate-800 backdrop-blur-xl">
          {step === 'phone' ? (
            <form onSubmit={handlePhoneSubmit} className="space-y-6">
              <div className="flex bg-slate-950/50 p-1 rounded-2xl border border-slate-800">
                <button type="button" onClick={() => {setAuthMode('register'); setError(null);}} className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest rounded-xl ${authMode === 'register' ? 'bg-blue-600 text-white' : 'text-slate-500'}`}>Register</button>
                <button type="button" onClick={() => {setAuthMode('login'); setError(null);}} className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest rounded-xl ${authMode === 'login' ? 'bg-blue-600 text-white' : 'text-slate-500'}`}>Login</button>
              </div>

              {authMode === 'register' && (
                <div className="relative">
                  <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                  <input type="text" required placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-2xl py-4 pl-12 pr-4 text-white placeholder:text-slate-600" />
                </div>
              )}

              <div className="flex gap-2">
                <select value={selectedCountry.code} onChange={(e) => setSelectedCountry(COUNTRY_CODES.find(c => c.code === e.target.value)!)} className="bg-slate-950 border border-slate-800 rounded-2xl p-4 text-white text-sm font-bold">
                  {COUNTRY_CODES.map(c => <option key={c.code} value={c.code}>{c.flag} {c.code}</option>)}
                </select>
                <input type="tel" required placeholder="Phone" value={phone} onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))} className="grow bg-slate-950 border border-slate-800 rounded-2xl py-4 px-4 text-white font-bold tracking-widest" />
              </div>

              {error && <div className="text-red-500 text-[10px] font-bold uppercase flex items-center gap-2 animate-pulse"><AlertCircle size={14}/>{error}</div>}

              <button type="submit" disabled={loading} className="w-full bg-blue-600 hover:bg-blue-500 py-4 rounded-2xl text-white font-black uppercase tracking-widest shadow-xl">
                {loading ? 'Authenticating...' : authMode === 'register' ? 'Join Network' : 'Access Account'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleVerify} className="space-y-8">
              <div className="text-center">
                <h3 className="text-2xl font-black text-white">Verification</h3>
                <p className="text-slate-500 text-xs">Enter code from the notification</p>
              </div>
              <div className="flex justify-center gap-3">
                {otp.map((digit, i) => (
                  <input key={i} ref={otpRefs[i]} type="text" maxLength={1} value={digit} onChange={(e) => {
                    const n = [...otp]; n[i] = e.target.value.slice(-1); setOtp(n);
                    if (e.target.value && i < 3) otpRefs[i+1].current?.focus();
                  }} className="w-14 h-16 bg-slate-950 border-2 border-slate-800 rounded-2xl text-center text-2xl font-black text-blue-500 focus:border-blue-600 focus:outline-none" />
                ))}
              </div>
              <button type="submit" className="w-full bg-blue-600 py-4 rounded-2xl text-white font-black uppercase tracking-widest shadow-xl">Verify & Enter</button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default AuthScreen;
