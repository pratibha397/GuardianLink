
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

export const GLOBAL_REGISTRY_KEY = 'guardian_link_network_db';

/**
 * Robust Normalization: Strips non-digits and uses last 10 digits.
 * Solves the registration matching bug.
 */
export const normalizePhone = (p: string) => {
  if (!p) return "";
  const digits = p.replace(/\D/g, '');
  return digits.length >= 10 ? digits.slice(-10) : digits;
};

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
    const normalizedTarget = normalizePhone(fullPhone);
    
    if (phone.length < 8) {
      setError("Please enter a valid phone number.");
      return;
    }

    setLoading(true);
    
    const db = JSON.parse(localStorage.getItem(GLOBAL_REGISTRY_KEY) || '[]');
    const existingUser = db.find((u: any) => normalizePhone(u.phone) === normalizedTarget);

    if (authMode === 'register' && existingUser) {
      setLoading(false);
      setError("Number already registered. Please login.");
      return;
    }

    if (authMode === 'login' && !existingUser) {
      setLoading(false);
      setError("User not found in Guardian mesh.");
      return;
    }

    const newCode = Math.floor(1000 + Math.random() * 9000).toString();
    setDemoOtp(newCode);

    setTimeout(() => {
      setLoading(false);
      setStep('otp');
      setShowDemoToast(true);
      setTimeout(() => setShowDemoToast(false), 10000);
    }, 1000);
  };

  const handleVerify = (e: React.FormEvent) => {
    e.preventDefault();
    if (otp.join('') !== demoOtp) {
      setError("Incorrect security code.");
      return;
    }
    
    setLoading(true);
    const fullPhone = `${selectedCountry.code}${phone}`;
    const normalizedTarget = normalizePhone(fullPhone);

    setTimeout(() => {
      const db = JSON.parse(localStorage.getItem(GLOBAL_REGISTRY_KEY) || '[]');
      let activeUser: User;

      if (authMode === 'register') {
        activeUser = { id: Date.now().toString(), phone: fullPhone, name };
        db.push(activeUser);
        localStorage.setItem(GLOBAL_REGISTRY_KEY, JSON.stringify(db));
      } else {
        activeUser = db.find((u: any) => normalizePhone(u.phone) === normalizedTarget);
      }

      setLoading(false);
      onLogin(activeUser);
    }, 800);
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6">
      {showDemoToast && (
        <div className="fixed top-8 left-1/2 -translate-x-1/2 w-full max-w-xs z-50 animate-bounce">
          <div className="bg-blue-600 p-5 rounded-3xl shadow-2xl flex items-center gap-4">
            <MessageSquare size={24} className="text-white" />
            <div>
              <p className="text-[10px] text-white/70 font-black uppercase">Guardian SMS</p>
              <p className="text-lg text-white font-black">Code: {demoOtp}</p>
            </div>
          </div>
        </div>
      )}

      <div className="w-full max-w-md space-y-12">
        <div className="text-center space-y-4">
          <div className="inline-block p-7 bg-blue-600 rounded-[3rem] shadow-2xl border-4 border-slate-950">
            <Shield size={64} className="text-white" />
          </div>
          <h1 className="text-5xl font-black text-white italic tracking-tighter">Guardian</h1>
        </div>

        <div className="bg-slate-900/50 p-10 rounded-[4rem] border border-slate-800 backdrop-blur-3xl">
          {step === 'phone' ? (
            <form onSubmit={handlePhoneSubmit} className="space-y-8">
              <div className="flex bg-slate-950 p-1.5 rounded-2xl border border-slate-800">
                <button type="button" onClick={() => setAuthMode('register')} className={`flex-1 py-4 text-xs font-black uppercase rounded-xl transition-all ${authMode === 'register' ? 'bg-blue-600 text-white shadow-xl' : 'text-slate-600'}`}>Register</button>
                <button type="button" onClick={() => setAuthMode('login')} className={`flex-1 py-4 text-xs font-black uppercase rounded-xl transition-all ${authMode === 'login' ? 'bg-blue-600 text-white shadow-xl' : 'text-slate-600'}`}>Login</button>
              </div>

              {authMode === 'register' && (
                <div className="relative">
                  <UserIcon className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-600" size={20} />
                  <input type="text" required placeholder="Full Name" value={name} onChange={(e) => setName(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-3xl py-5 pl-14 pr-6 text-white font-bold outline-none" />
                </div>
              )}

              <div className="flex gap-3">
                <select value={selectedCountry.code} onChange={(e) => setSelectedCountry(COUNTRY_CODES.find(c => c.code === e.target.value)!)} className="bg-slate-950 border border-slate-800 rounded-3xl p-5 text-white font-black outline-none">
                  {COUNTRY_CODES.map(c => <option key={c.code} value={c.code}>{c.flag} {c.code}</option>)}
                </select>
                <input type="tel" required placeholder="Phone Number" value={phone} onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))} className="grow bg-slate-950 border border-slate-800 rounded-3xl py-5 px-6 text-white font-black tracking-widest outline-none" />
              </div>

              {error && <div className="text-red-400 text-[10px] font-black uppercase flex items-center gap-4 bg-red-500/10 p-4 rounded-3xl border border-red-500/20"><AlertCircle size={20} className="shrink-0" />{error}</div>}

              <button type="submit" disabled={loading} className="w-full bg-blue-600 hover:bg-blue-500 py-6 rounded-[2.5rem] text-white font-black uppercase tracking-widest shadow-2xl active:scale-95 transition-all">
                {loading ? "Authenticating..." : "Initialise Shield"}
              </button>
            </form>
          ) : (
            <form onSubmit={handleVerify} className="space-y-12">
              <div className="text-center space-y-2">
                <h3 className="text-2xl font-black text-white uppercase italic tracking-tighter">Mesh Authorisation</h3>
                <p className="text-slate-600 text-[11px] font-black uppercase tracking-widest">Sent to {selectedCountry.code} {phone}</p>
              </div>
              <div className="flex justify-center gap-4">
                {otp.map((digit, i) => (
                  <input key={i} ref={otpRefs[i]} type="text" maxLength={1} value={digit} onChange={(e) => {
                    const n = [...otp]; n[i] = e.target.value.slice(-1); setOtp(n);
                    if (e.target.value && i < 3) otpRefs[i+1].current?.focus();
                  }} className="w-16 h-24 bg-slate-950 border-2 border-slate-800 rounded-[1.8rem] text-center text-4xl font-black text-blue-500 shadow-inner outline-none transition-all" />
                ))}
              </div>
              <button type="submit" className="w-full bg-blue-600 py-6 rounded-[2.5rem] text-white font-black uppercase shadow-xl active:scale-95 transition-all">Verify Mesh Identity</button>
              <button type="button" onClick={() => setStep('phone')} className="w-full text-slate-700 text-[10px] font-black uppercase hover:text-white transition-colors">Change Number</button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default AuthScreen;
