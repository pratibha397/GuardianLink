import { AlertCircle, ArrowRight, CheckCircle2, ChevronLeft, KeyRound, Lock, LogIn, Mail, RefreshCw, Shield, UserPlus } from 'lucide-react';
import { useState } from 'react';
import { AuthService } from '../services/AuthenticationService';
import { User } from '../types';

interface AuthScreenProps {
  onLogin: (user: User) => void;
}

type AuthStep = 'LOGIN' | 'REGISTER' | 'FORGOT_PASSWORD_EMAIL' | 'FORGOT_PASSWORD_OTP' | 'RESET_PASSWORD';

const AuthScreen: React.FC<AuthScreenProps> = ({ onLogin }) => {
  const [step, setStep] = useState<AuthStep>('LOGIN');
  
  // Form State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [newPass, setNewPass] = useState('');
  const [confirmPass, setConfirmPass] = useState('');
  
  // UI State
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const clearState = () => {
    setError(null);
    setSuccessMsg(null);
    setLoading(false);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    clearState();
    setLoading(true);
    try {
      const success = await AuthService.login(email, password);
      if (success) {
        // Mock retrieving user profile - in a real app this would come from DB
        const mockUser: User = {
          id: `user_${Date.now()}`,
          email: email,
          name: email.split('@')[0] || 'Guardian User'
        };
        onLogin(mockUser);
      } else {
        setError("Invalid email or password. Has this account been registered?");
      }
    } catch (err) {
      setError("Login failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    clearState();
    setLoading(true);
    try {
      const result = await AuthService.register(email, password);
      if (result === 'success') {
        setSuccessMsg("Account created! Please sign in.");
        setStep('LOGIN');
        setPassword('');
      } else {
        setError("Account already exists with this email.");
      }
    } catch (err) {
      setError("Registration failed.");
    } finally {
      setLoading(false);
    }
  };

  const handleSendResetOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.includes('@')) {
      setError("Please enter a valid email.");
      return;
    }
    clearState();
    setLoading(true);
    try {
      const exists = await AuthService.sendResetOTP(email);
      if (exists) {
        setStep('FORGOT_PASSWORD_OTP');
        setSuccessMsg(`Reset code sent to ${email}`);
      } else {
        setError("No account found with this email.");
      }
    } catch (err) {
      setError("Failed to send reset code.");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyResetOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    clearState();
    setLoading(true);
    try {
      const isValid = await AuthService.verifyResetOTP(otp);
      if (isValid) {
        setStep('RESET_PASSWORD');
        setSuccessMsg("Code verified. Set new password.");
      } else {
        setError("Invalid Code. Try 123456.");
      }
    } catch (err) {
      setError("Verification failed.");
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPass.length < 6) {
      setError("Password too short.");
      return;
    }
    if (newPass !== confirmPass) {
      setError("Passwords do not match.");
      return;
    }
    clearState();
    setLoading(true);
    try {
      const result = await AuthService.resetPassword(email, newPass);
      if (result === 'success') {
        setStep('LOGIN');
        setSuccessMsg("Password updated! Please login.");
        setPassword('');
        setOtp('');
        setNewPass('');
        setConfirmPass('');
      } else if (result === 'same_as_old') {
        setError("New password cannot be the same as the old password.");
      } else {
        setError("Failed to update password.");
      }
    } catch (err) {
      setError("Update failed.");
    } finally {
      setLoading(false);
    }
  };

  const renderContent = () => {
    switch (step) {
      case 'LOGIN':
        return (
          <form onSubmit={handleLogin} className="space-y-6 animate-in fade-in slide-in-from-right duration-300">
            <div className="space-y-2 text-center mb-8">
              <h2 className="text-xl font-bold text-white">Sign In</h2>
              <p className="text-xs text-slate-500 font-medium">Welcome back to GuardianLink</p>
            </div>
            
            <div className="space-y-4">
              <div className="relative group">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600 group-focus-within:text-blue-500 transition-colors" size={18} />
                <input 
                  type="email" required placeholder="Email Address" value={email} 
                  onChange={(e) => setEmail(e.target.value)} 
                  className="w-full bg-slate-950 border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-sm text-white font-medium outline-none focus:border-blue-500 transition-all" 
                />
              </div>
              <div className="relative group">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600 group-focus-within:text-blue-500 transition-colors" size={18} />
                <input 
                  type="password" required placeholder="Password" value={password} 
                  onChange={(e) => setPassword(e.target.value)} 
                  className="w-full bg-slate-950 border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-sm text-white font-medium outline-none focus:border-blue-500 transition-all" 
                />
              </div>
            </div>

            <button 
              type="submit" disabled={loading} 
              className="w-full bg-blue-600 hover:bg-blue-500 py-4 rounded-2xl text-white font-bold uppercase tracking-widest text-xs shadow-xl active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? <RefreshCw className="animate-spin" size={16}/> : 'Sign In'} <LogIn size={16} />
            </button>
            
            <div className="flex justify-between items-center text-[10px] font-bold mt-4">
              <button type="button" onClick={() => { clearState(); setStep('FORGOT_PASSWORD_EMAIL'); }} className="text-slate-500 hover:text-blue-500 transition-colors">
                Forgot Password?
              </button>
              <button type="button" onClick={() => { clearState(); setStep('REGISTER'); }} className="text-blue-500 hover:text-blue-400 transition-colors">
                Create Account
              </button>
            </div>
          </form>
        );

      case 'REGISTER':
        return (
          <form onSubmit={handleRegister} className="space-y-6 animate-in fade-in slide-in-from-right duration-300">
            <div className="space-y-2 text-center mb-8">
              <h2 className="text-xl font-bold text-white">Create Account</h2>
              <p className="text-xs text-slate-500 font-medium">Join the GuardianLink Network</p>
            </div>
            
            <div className="space-y-4">
              <div className="relative group">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600 group-focus-within:text-blue-500 transition-colors" size={18} />
                <input 
                  type="email" required placeholder="Email Address" value={email} 
                  onChange={(e) => setEmail(e.target.value)} 
                  className="w-full bg-slate-950 border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-sm text-white font-medium outline-none focus:border-blue-500 transition-all" 
                />
              </div>
              <div className="relative group">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600 group-focus-within:text-blue-500 transition-colors" size={18} />
                <input 
                  type="password" required placeholder="Create Password" value={password} 
                  onChange={(e) => setPassword(e.target.value)} 
                  className="w-full bg-slate-950 border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-sm text-white font-medium outline-none focus:border-blue-500 transition-all" 
                />
              </div>
            </div>

            <button 
              type="submit" disabled={loading} 
              className="w-full bg-blue-600 hover:bg-blue-500 py-4 rounded-2xl text-white font-bold uppercase tracking-widest text-xs shadow-xl active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? <RefreshCw className="animate-spin" size={16}/> : 'Register'} <UserPlus size={16} />
            </button>
            
            <div className="text-center mt-4">
              <span className="text-[10px] text-slate-500 font-bold mr-2">Already have an account?</span>
              <button type="button" onClick={() => { clearState(); setStep('LOGIN'); }} className="text-[10px] font-bold text-blue-500 hover:text-blue-400 transition-colors">
                Sign In
              </button>
            </div>
          </form>
        );

      case 'FORGOT_PASSWORD_EMAIL':
        return (
          <form onSubmit={handleSendResetOTP} className="space-y-6 animate-in fade-in slide-in-from-right duration-300">
            <div className="space-y-2 text-center mb-8">
              <h2 className="text-xl font-bold text-white">Reset Password</h2>
              <p className="text-xs text-slate-500 font-medium">We'll send a code to your registered email.</p>
            </div>
            <div className="relative group">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600 group-focus-within:text-blue-500 transition-colors" size={18} />
              <input 
                type="email" required placeholder="Registered Email Address" value={email} 
                onChange={(e) => setEmail(e.target.value)} 
                className="w-full bg-slate-950 border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-sm text-white font-medium outline-none focus:border-blue-500 transition-all" 
              />
            </div>
            <button 
              type="submit" disabled={loading} 
              className="w-full bg-blue-600 hover:bg-blue-500 py-4 rounded-2xl text-white font-bold uppercase tracking-widest text-xs shadow-xl active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            >
               {loading ? <RefreshCw className="animate-spin" size={16}/> : 'Send OTP'} <ArrowRight size={16} />
            </button>
            <div className="text-center">
              <button type="button" onClick={() => { clearState(); setStep('LOGIN'); }} className="text-xs font-bold text-slate-500 hover:text-white transition-colors flex items-center justify-center gap-1 mx-auto">
                <ChevronLeft size={14} /> Back to Sign In
              </button>
            </div>
          </form>
        );

      case 'FORGOT_PASSWORD_OTP':
        return (
          <form onSubmit={handleVerifyResetOTP} className="space-y-6 animate-in fade-in slide-in-from-right duration-300">
             <div className="space-y-2 text-center mb-8">
              <h2 className="text-xl font-bold text-white">Check Your Email</h2>
              <p className="text-xs text-slate-500 font-medium">Enter the reset code sent to {email}</p>
            </div>
            <div className="relative group">
              <KeyRound className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600 group-focus-within:text-blue-500 transition-colors" size={18} />
              <input 
                type="text" required placeholder="Enter Code (123456)" value={otp} 
                onChange={(e) => setOtp(e.target.value)} 
                className="w-full bg-slate-950 border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-sm text-white font-medium outline-none focus:border-blue-500 transition-all tracking-widest" 
              />
            </div>
            <button 
              type="submit" disabled={loading} 
              className="w-full bg-blue-600 hover:bg-blue-500 py-4 rounded-2xl text-white font-bold uppercase tracking-widest text-xs shadow-xl active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            >
               {loading ? <RefreshCw className="animate-spin" size={16}/> : 'Verify OTP'} <CheckCircle2 size={16} />
            </button>
            <div className="text-center">
              <button type="button" onClick={() => { clearState(); setStep('FORGOT_PASSWORD_EMAIL'); }} className="text-xs font-bold text-slate-500 hover:text-white transition-colors flex items-center justify-center gap-1 mx-auto">
                <ChevronLeft size={14} /> Change Email
              </button>
            </div>
          </form>
        );

      case 'RESET_PASSWORD':
        return (
          <form onSubmit={handleResetPassword} className="space-y-6 animate-in fade-in slide-in-from-right duration-300">
             <div className="space-y-2 text-center mb-8">
              <h2 className="text-xl font-bold text-white">Create New Password</h2>
              <p className="text-xs text-slate-500 font-medium">Secure your account for {email}</p>
            </div>
            <div className="space-y-4">
              <div className="relative group">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600 group-focus-within:text-blue-500 transition-colors" size={18} />
                <input 
                  type="password" required placeholder="New Password" value={newPass} 
                  onChange={(e) => setNewPass(e.target.value)} 
                  className="w-full bg-slate-950 border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-sm text-white font-medium outline-none focus:border-blue-500 transition-all" 
                />
              </div>
              <div className="relative group">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600 group-focus-within:text-blue-500 transition-colors" size={18} />
                <input 
                  type="password" required placeholder="Confirm Password" value={confirmPass} 
                  onChange={(e) => setConfirmPass(e.target.value)} 
                  className="w-full bg-slate-950 border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-sm text-white font-medium outline-none focus:border-blue-500 transition-all" 
                />
              </div>
            </div>
            <button 
              type="submit" disabled={loading} 
              className="w-full bg-blue-600 hover:bg-blue-500 py-4 rounded-2xl text-white font-bold uppercase tracking-widest text-xs shadow-xl active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            >
               {loading ? <RefreshCw className="animate-spin" size={16}/> : 'Update Password'} <CheckCircle2 size={16} />
            </button>
          </form>
        );
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
          {renderContent()}

          {error && (
            <div className="mt-6 flex items-center gap-3 bg-red-500/10 border border-red-500/20 p-4 rounded-2xl animate-in slide-in-from-top-1">
              <AlertCircle size={16} className="text-red-500 shrink-0" />
              <p className="text-[11px] font-bold text-red-400 uppercase tracking-tight">{error}</p>
            </div>
          )}

          {successMsg && (
            <div className="mt-6 flex items-center gap-3 bg-green-500/10 border border-green-500/20 p-4 rounded-2xl animate-in slide-in-from-top-1">
              <CheckCircle2 size={16} className="text-green-500 shrink-0" />
              <p className="text-[11px] font-bold text-green-400 uppercase tracking-tight">{successMsg}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AuthScreen;
