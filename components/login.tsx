
import { ArrowRight, CheckCircle2, ChevronDown, Lock, MessageSquare, Phone, Shield, User as UserIcon } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
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
  const [demoOtp, setDemoOtp] = useState('1234');
  const [showDemoToast, setShowDemoToast] = useState(false);
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
    
    // Generate a random 4-digit code for the demo
    const newCode = Math.floor(1000 + Math.random() * 9000).toString();
    setDemoOtp(newCode);

    // Simulate API call and SMS delivery
    setTimeout(() => {
      setLoading(false);
      setStep('otp');
      setTimer(30);
      setShowDemoToast(true);
      // Hide the "Incoming SMS" toast after 6 seconds
      setTimeout(() => setShowDemoToast(false), 6000);
    }, 1200);
  };

  const handleOtpChange = (index: number, value: string) => {
    const sanitized = value.replace(/\D/g, '');
    if (!sanitized && value !== '') return;
    
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
    
    if (fullOtp !== demoOtp) {
      alert("Invalid verification code. Please check the simulated SMS notification.");
      return;
    }
    
    setLoading(true);
    setTimeout(() => {
      onLogin({
        id: Math.random().toString(36).substr(2, 9),
        phone: `${selectedCountry.code}${phone}`,
        name: authMode === 'register' ? name : 'User ' + phone.slice(-4)
      });
    }, 1500);
  };

  const resendOtp = () => {
    if (timer > 0) return;
    setOtp(['', '', '', '']);
    handlePhoneSubmit({ preventDefault: () => {} } as any);
    otpRefs[0].current?.focus();
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 sm:p-8 overflow-hidden relative">
      {/* Simulated SMS Toast */}
      {showDemoToast && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 w-full max-w-xs z-50 animate-in slide-in-from-top-full duration-500">
          <div className="bg-white/10 backdrop-blur-xl border border-white/20 p-4 rounded-2xl shadow-2xl flex gap-3 items-start">
            <div className="bg-blue-600 p-2 rounded-lg text-white">
              <MessageSquare size={18} />
            </div>
            <div className="flex-1">
              <div className="flex justify-between items-center mb-1">
                <span className="text-[10px] font-black text-blue-400 uppercase tracking-widest">Messages</span>
                <span className="text-[10px] text-slate-400">now</span>
              </div>
              <p className="text-xs text-white font-medium leading-relaxed">
                <span className="font-black">Guardian:</span> Your verification code is <span className="bg-blue-600 px-1.5 rounded font-black">{demoOtp}</span>. Valid for 5 minutes.
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="w-full max-w-md space-y-8 animate-in fade-in zoom-in duration-500 relative z-10">
        <div className="flex flex-col items-center text-center space-y-4">
          <div className="p-4 bg-blue-600 rounded-[2rem] shadow-2xl shadow-blue-500/20 rotate-3 hover:rotate-0 transition-transform duration-500">
            <Shield size={48} className="text-white" />
          </div>
          <div>
            <h1 className="text-4xl font-black tracking-tighter text-white">GuardianVoice</h1>
            <p className="text-slate-400 font-medium mt-1">AI-Powered Personal Safety</p>
          </div>
        </div>

        <div className="bg-slate-900/40 backdrop-blur-2xl border border-slate-800/50 p-1 rounded-[2.8rem] shadow-2xl">
          <div className="bg-slate-900/60 p-7 rounded-[2.5rem]">
            {step === 'phone' && (
              <div className="flex p-1 bg-slate-950/50 rounded-2xl mb-8 border border-slate-800/50">
                <button 
                  onClick={() => setAuthMode('register')}
                  className={`flex-1 py-3 text-xs font-black uppercase tracking-widest rounded-xl transition-all ${authMode === 'register' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500'}`}
                >
                  Register
                </button>
                <button 
                  onClick={() => setAuthMode('login')}
                  className={`flex-1 py-3 text-xs font-black uppercase tracking-widest rounded-xl transition-all ${authMode === 'login' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500'}`}
                >
                  Login
                </button>
              </div>
            )}

            {step === 'phone' ? (
              <form onSubmit={handlePhoneSubmit} className="space-y-6">
                <div className="space-y-4">
                  {authMode === 'register' && (
                    <div className="relative group">
                      <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-blue-500 transition-colors" size={18} />
                      <input 
                        type="text" 
                        required
                        placeholder="Full Name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="w-full bg-slate-950/50 border border-slate-800 rounded-2xl py-4 pl-12 pr-4 text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-600/50 transition-all h-14"
                      />
                    </div>
                  )}
                  
                  <div className="flex gap-2 h-14">
                    <div className="relative shrink-0">
                      <select 
                        value={selectedCountry.code}
                        onChange={(e) => {
                          const country = COUNTRY_CODES.find(c => c.code === e.target.value);
                          if (country) setSelectedCountry(country);
                        }}
                        className="appearance-none bg-slate-950/50 border border-slate-800 rounded-2xl py-4 pl-4 pr-10 text-white focus:outline-none focus:ring-2 focus:ring-blue-600/50 transition-all cursor-pointer h-full text-sm font-bold"
                      >
                        {COUNTRY_CODES.map(c => (
                          <option key={`${c.country}-${c.code}`} value={c.code} className="bg-slate-900 text-white">
                            {c.flag} {c.code}
                          </option>
                        ))}
                      </select>
                      <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                    </div>
                    
                    <div className="relative grow group">
                      <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-blue-500 transition-colors" size={18} />
                      <input 
                        type="tel" 
                        required
                        placeholder="Phone Number"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
                        className="w-full bg-slate-950/50 border border-slate-800 rounded-2xl py-4 pl-12 pr-4 text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-600/50 transition-all h-full font-bold tracking-wider"
                      />
                    </div>
                  </div>
                </div>

                <div className="pt-2">
                  <button 
                    type="submit" 
                    disabled={loading || phone.length < 8}
                    className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-black uppercase tracking-widest py-4 rounded-2xl flex items-center justify-center gap-2 group transition-all shadow-lg shadow-blue-900/20"
                  >
                    {loading ? (
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <>
                        {authMode === 'register' ? 'Create Account' : 'Secure Login'}
                        <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                      </>
                    )}
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleVerify} className="space-y-8 animate-in slide-in-from-right-4 duration-300">
                <div className="text-center space-y-2">
                  <div className="inline-flex items-center gap-2 text-blue-400 bg-blue-400/10 px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest border border-blue-400/20">
                    <CheckCircle2 size={14} /> SMS Request Sent
                  </div>
                  <h3 className="text-2xl font-black text-white">Verify Phone</h3>
                  <p className="text-sm text-slate-400">
                    Enter the code sent to <span className="text-white font-bold">{selectedCountry.code} {phone}</span>
                  </p>
                </div>

                <div className="flex justify-center gap-3">
                  {otp.map((digit, i) => (
                    <input
                      key={i}
                      ref={otpRefs[i]}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => handleOtpChange(i, e.target.value)}
                      onKeyDown={(e) => handleKeyDown(i, e)}
                      className="w-14 h-16 bg-slate-950/80 border-2 border-slate-800 rounded-2xl text-center text-2xl font-black text-blue-500 focus:outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-600/10 transition-all"
                    />
                  ))}
                </div>

                <div className="space-y-4">
                  <button 
                    type="submit"
                    disabled={loading || otp.join('').length < 4}
                    className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-black uppercase tracking-widest py-4 rounded-2xl flex items-center justify-center transition-all shadow-lg shadow-blue-900/20"
                  >
                    {loading ? (
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : 'Confirm Verification'}
                  </button>
                  
                  <div className="text-center">
                    <button 
                      type="button" 
                      onClick={resendOtp}
                      disabled={timer > 0}
                      className={`text-xs font-black uppercase tracking-widest transition-colors ${timer > 0 ? 'text-slate-600' : 'text-blue-500 hover:text-blue-400'}`}
                    >
                      {timer > 0 ? `Resend code in ${timer}s` : 'Request New Code'}
                    </button>
                  </div>

                  <button 
                    type="button" 
                    onClick={() => { setStep('phone'); setOtp(['','','','']); }}
                    className="w-full text-[10px] text-slate-500 hover:text-white transition-colors uppercase tracking-widest font-bold"
                  >
                    Wrong Number?
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
        
        <div className="text-center opacity-40">
          <p className="text-[10px] text-slate-500 flex items-center justify-center gap-1 font-bold uppercase tracking-widest">
            <Lock size={10} /> Secure End-to-End Safety Network
          </p>
        </div>
      </div>
      
      {/* Background decoration */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[150%] h-[150%] bg-blue-600/5 rounded-full blur-[120px] pointer-events-none" />
    </div>
  );
};

export default AuthScreen;