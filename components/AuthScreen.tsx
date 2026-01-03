
import { AlertCircle, ArrowRight, CheckCircle2, ChevronDown, MessageSquare, Phone, Shield, User as UserIcon } from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';
import { User } from '../types';

interface AuthScreenProps {
  onLogin: (user: User) => void;
}

const COUNTRY_CODES = [
  { code: '+91', country: 'IN', flag: '🇮🇳' },
  { code: '+1', country: 'US', flag: '🇺🇸' },
  { code: '+44', country: 'UK', flag: '🇬🇧' },
  { code: '+61', country: 'AU', flag: '🇦🇺' },
  { code: '+49', country: 'DE', flag: '🇩🇪' },
  { code: '+971', country: 'AE', flag: '🇦🇪' },
];

const AuthScreen: React.FC<AuthScreenProps> = ({ onLogin }) => {
  const [authMode, setAuthMode] = useState<'login' | 'register'>('register');
  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [selectedCountry, setSelectedCountry] = useState(COUNTRY_CODES[0]);
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [otp, setOtp] = useState(['', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [timer, setTimer] = useState(0);
  const [demoOtp, setDemoOtp] = useState('');
  const [showDemoToast, setShowDemoToast] = useState(false);
  const [otpError, setOtpError] = useState(false);
  
  const otpRefs = [useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null)];

  useEffect(() => {
    let interval: any;
    if (timer > 0) {
      interval = setInterval(() => setTimer((t) => t - 1), 1000);
    }
    return () => clearInterval(interval);
  }, [timer]);

  const handlePhoneSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (phone.length < 8) return;
    setLoading(true);
    
    // Generate a fresh random 4-digit code
    const newCode = Math.floor(1000 + Math.random() * 9000).toString();
    setDemoOtp(newCode);

    setTimeout(() => {
      setLoading(false);
      setStep('otp');
      setTimer(30);
      setShowDemoToast(true);
      setOtp(['', '', '', '']);
      setOtpError(false);
      setTimeout(() => setShowDemoToast(false), 15000); // Longer toast for visibility
    }, 1200);
  };

  const handleOtpChange = (index: number, value: string) => {
    const sanitized = value.replace(/\D/g, '');
    if (!sanitized && value !== '') return;
    
    setOtpError(false);
    const newOtp = [...otp];
    newOtp[index] = sanitized.slice(-1);
    setOtp(newOtp);

    if (sanitized && index < 3) {
      otpRefs[index + 1].current?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      otpRefs[index - 1].current?.focus();
    }
  };

  const handleVerify = (e: React.FormEvent) => {
    e.preventDefault();
    const fullOtp = otp.join('');
    
    if (fullOtp.length < 4) return;

    // STRICT VERIFICATION: Must match exactly. No random bypass allowed.
    if (fullOtp !== demoOtp) {
      setOtpError(true);
      return;
    }
    
    setLoading(true);
    setTimeout(() => {
      onLogin({
        id: Math.random().toString(36).substr(2, 9),
        phone: `${selectedCountry.code}${phone}`,
        name: authMode === 'register' ? name : 'User ' + phone.slice(-4)
      });
    }, 1000);
  };

  const resendOtp = () => {
    if (timer > 0) return;
    handlePhoneSubmit({ preventDefault: () => {} } as any);
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 sm:p-8 overflow-hidden relative">
      {showDemoToast && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 w-full max-w-xs z-50 animate-in slide-in-from-top-full duration-500">
          <div className="bg-white/10 backdrop-blur-xl border border-white/20 p-4 rounded-2xl shadow-2xl flex gap-3 items-start">
            <div className="bg-blue-600 p-2 rounded-lg text-white">
              <MessageSquare size={18} />
            </div>
            <div className="flex-1">
              <div className="flex justify-between items-center mb-1">
                <span className="text-[10px] font-black text-blue-400 uppercase tracking-widest">Guardian Link Auth</span>
                <span className="text-[10px] text-slate-400">now</span>
              </div>
              <p className="text-xs text-white font-medium leading-relaxed">
                <span className="font-black">Security Code:</span> <span className="bg-blue-600 px-2 py-0.5 rounded font-black text-white text-lg tracking-widest">{demoOtp}</span>
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="w-full max-w-md space-y-8 animate-in fade-in zoom-in duration-500 relative z-10">
        <div className="flex flex-col items-center text-center space-y-4">
          <div className="p-4 bg-blue-600 rounded-[2rem] shadow-2xl shadow-blue-500/20">
            <Shield size={48} className="text-white" />
          </div>
          <div>
            <h1 className="text-4xl font-black tracking-tighter text-white italic">Guardian Link</h1>
            <p className="text-slate-400 font-medium mt-1">Unified Safety Network</p>
          </div>
        </div>

        <div className="bg-slate-900/40 backdrop-blur-2xl border border-slate-800/50 p-1 rounded-[2.8rem] shadow-2xl">
          <div className="bg-slate-900/60 p-7 rounded-[2.5rem]">
            {step === 'phone' ? (
              <>
                <div className="flex p-1 bg-slate-950/50 rounded-2xl mb-8 border border-slate-800/50">
                  <button onClick={() => setAuthMode('register')} className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${authMode === 'register' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500'}`}>Sign Up</button>
                  <button onClick={() => setAuthMode('login')} className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${authMode === 'login' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500'}`}>Sign In</button>
                </div>
                <form onSubmit={handlePhoneSubmit} className="space-y-6">
                  <div className="space-y-4">
                    {authMode === 'register' && (
                      <div className="relative group">
                        <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-blue-500 transition-colors" size={18} />
                        <input type="text" required placeholder="Display Name" value={name} onChange={(e) => setName(e.target.value)} className="w-full bg-slate-950/50 border border-slate-800 rounded-2xl py-4 pl-12 pr-4 text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-600/50 transition-all h-14" />
                      </div>
                    )}
                    <div className="flex gap-2 h-14">
                      <div className="relative shrink-0">
                        <select value={selectedCountry.code} onChange={(e) => { const country = COUNTRY_CODES.find(c => c.code === e.target.value); if (country) setSelectedCountry(country); }} className="appearance-none bg-slate-950/50 border border-slate-800 rounded-2xl py-4 pl-4 pr-10 text-white focus:outline-none focus:ring-2 focus:ring-blue-600/50 transition-all cursor-pointer h-full text-sm font-bold">
                          {COUNTRY_CODES.map(c => <option key={`${c.country}-${c.code}`} value={c.code} className="bg-slate-900 text-white">{c.flag} {c.code}</option>)}
                        </select>
                        <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                      </div>
                      <div className="relative grow group">
                        <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-blue-500 transition-colors" size={18} />
                        <input type="tel" required placeholder="Phone Number" value={phone} onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))} className="w-full bg-slate-950/50 border border-slate-800 rounded-2xl py-4 pl-12 pr-4 text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-600/50 transition-all h-full font-bold tracking-wider" />
                      </div>
                    </div>
                  </div>
                  <button type="submit" disabled={loading || phone.length < 8} className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-black uppercase tracking-widest py-4 rounded-2xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-blue-900/20">
                    {loading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <>{authMode === 'register' ? 'Register Account' : 'Secure Login'} <ArrowRight size={18} /></>}
                  </button>
                </form>
              </>
            ) : (
              <form onSubmit={handleVerify} className={`space-y-8 animate-in slide-in-from-right-4 duration-300 ${otpError ? 'animate-shake' : ''}`}>
                <div className="text-center space-y-2">
                  <div className="inline-flex items-center gap-2 text-blue-400 bg-blue-400/10 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border border-blue-400/20">
                    <CheckCircle2 size={12} /> Verification Pending
                  </div>
                  <h3 className="text-2xl font-black text-white">Enter App Code</h3>
                  <p className="text-sm text-slate-400 italic">Please enter the code shown in the toast notification</p>
                </div>

                <div className="flex justify-center gap-3">
                  {otp.map((digit, i) => (
                    <input key={i} ref={otpRefs[i]} type="text" inputMode="numeric" maxLength={1} value={digit} onChange={(e) => handleOtpChange(i, e.target.value)} onKeyDown={(e) => handleKeyDown(i, e)} className={`w-14 h-16 bg-slate-950/80 border-2 rounded-2xl text-center text-2xl font-black transition-all focus:outline-none focus:ring-4 focus:ring-blue-600/10 ${otpError ? 'border-red-500 text-red-500' : 'border-slate-800 text-blue-500 focus:border-blue-600'}`} />
                  ))}
                </div>

                {otpError && (
                  <div className="flex items-center justify-center gap-2 text-red-500 text-xs font-bold animate-pulse">
                    <AlertCircle size={14} /> INVALID CODE. Check notification.
                  </div>
                )}

                <div className="space-y-4">
                  <button type="submit" disabled={loading || otp.join('').length < 4} className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-black uppercase tracking-widest py-4 rounded-2xl flex items-center justify-center transition-all shadow-lg shadow-blue-900/20">
                    {loading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : 'Confirm & Enter App'}
                  </button>
                  <div className="text-center">
                    <button type="button" onClick={resendOtp} disabled={timer > 0} className={`text-xs font-black uppercase tracking-widest transition-colors ${timer > 0 ? 'text-slate-600' : 'text-blue-500 hover:text-blue-400'}`}>
                      {timer > 0 ? `Retry in ${timer}s` : 'Resend Notification'}
                    </button>
                  </div>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-8px); }
          75% { transform: translateX(8px); }
        }
        .animate-shake { animation: shake 0.2s ease-in-out 0s 2; }
      `}</style>
    </div>
  );
};

export default AuthScreen;
