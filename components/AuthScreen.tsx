
import { ArrowRight, Lock, Phone, Shield, User as UserIcon } from 'lucide-react';
import React, { useState } from 'react';
import { User } from '../types';

interface AuthScreenProps {
  onLogin: (user: User) => void;
}

const AuthScreen: React.FC<AuthScreenProps> = ({ onLogin }) => {
  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);

  const handlePhoneSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (phone.length < 10) return;
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      setStep('otp');
    }, 1500);
  };

  const handleOtpSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (otp.length < 4) return;
    setLoading(true);
    setTimeout(() => {
      onLogin({
        id: Math.random().toString(36).substr(2, 9),
        phone,
        name: name || 'User ' + phone.slice(-4)
      });
    }, 1500);
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-8">
      <div className="w-full max-w-sm space-y-8 animate-in fade-in zoom-in duration-500">
        <div className="flex flex-col items-center text-center space-y-4">
          <div className="p-4 bg-blue-600 rounded-3xl shadow-2xl shadow-blue-500/20">
            <Shield size={48} className="text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-black tracking-tight text-white">GuardianVoice</h1>
            <p className="text-slate-400 font-medium">Secure Voice Protection</p>
          </div>
        </div>

        <div className="bg-slate-900/50 backdrop-blur-xl border border-slate-800 p-8 rounded-[2rem] shadow-xl">
          {step === 'phone' ? (
            <form onSubmit={handlePhoneSubmit} className="space-y-6">
              <div className="space-y-4">
                <div className="relative">
                  <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                  <input 
                    type="text" 
                    required
                    placeholder="Full Name"
                    value={name}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setName(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-2xl py-4 pl-12 pr-4 text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-600 transition-all"
                  />
                </div>
                <div className="relative">
                  <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                  <input 
                    type="tel" 
                    required
                    placeholder="Phone Number"
                    value={phone}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPhone(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-2xl py-4 pl-12 pr-4 text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-600 transition-all"
                  />
                </div>
              </div>
              <button 
                type="submit" 
                disabled={loading}
                className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-2 group transition-all"
              >
                {loading ? 'Sending Request...' : 'Get Started'}
                {!loading && <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />}
              </button>
            </form>
          ) : (
            <form onSubmit={handleOtpSubmit} className="space-y-6">
              <div className="text-center space-y-2 mb-4">
                <h3 className="text-white font-bold">Verify Identity</h3>
                <p className="text-xs text-slate-400">Enter the code sent to {phone}</p>
              </div>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                <input 
                  type="text" 
                  maxLength={4}
                  required
                  placeholder="0 0 0 0"
                  value={otp}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setOtp(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-2xl py-4 pl-12 pr-4 text-white text-center tracking-[1rem] font-black focus:outline-none focus:ring-2 focus:ring-blue-600 transition-all"
                />
              </div>
              <button 
                type="submit"
                disabled={loading}
                className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-4 rounded-2xl flex items-center justify-center transition-all"
              >
                {loading ? 'Verifying...' : 'Verify & Login'}
              </button>
              <button 
                type="button" 
                onClick={() => setStep('phone')}
                className="w-full text-xs text-slate-500 hover:text-white transition-colors"
              >
                Use different number
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default AuthScreen;
