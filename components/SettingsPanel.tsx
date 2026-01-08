
import { AlertCircle, CheckCircle2, Lock, Mic, RefreshCw, Search, Star, Trash2, User, UserPlus, Wifi } from 'lucide-react';
import { useEffect, useState } from 'react';
import { AuthService } from '../services/AuthenticationService';
import { db, doc, getDoc } from '../services/firebase';
import { AppSettings, User as AppUser, EmergencyContact } from '../types';

interface SettingsPanelProps {
  settings: AppSettings;
  updateSettings: (s: Partial<AppSettings>) => void;
  user: AppUser;
  onUpdateUser: (u: AppUser) => void;
}

const SettingsPanel: React.FC<SettingsPanelProps> = ({ settings, updateSettings, user, onUpdateUser }) => {
  const [newContact, setNewContact] = useState({ name: '', email: '' });
  const [isSearching, setIsSearching] = useState(false);
  const [lookupResult, setLookupResult] = useState<'found' | 'not_found' | 'error' | null>(null);

  // Password Change State
  const [oldPass, setOldPass] = useState('');
  const [newPass, setNewPass] = useState('');
  const [confirmPass, setConfirmPass] = useState('');
  const [passLoading, setPassLoading] = useState(false);
  const [passMsg, setPassMsg] = useState<{ type: 'error' | 'success', text: string } | null>(null);

  const checkUserExists = async (inputEmail: string) => {
    const normalized = inputEmail.trim().toLowerCase();
    
    if (normalized.length < 5 || !normalized.includes('@')) {
      setLookupResult(null);
      return;
    }

    setIsSearching(true);
    setLookupResult(null);

    try {
      const userRef = doc(db, "users", normalized);
      const userSnap = await getDoc(userRef);
      
      if (userSnap.exists()) {
        const userData = userSnap.data();
        setLookupResult('found');
        if (!newContact.name.trim() && userData && userData.name) {
           setNewContact(prev => ({ ...prev, name: userData.name }));
        }
      } else {
        setLookupResult('not_found');
      }
    } catch (error: any) {
      console.error("Discovery error:", error);
      setLookupResult('error');
    } finally {
      setIsSearching(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      if (newContact.email) {
        checkUserExists(newContact.email);
      } else {
        setLookupResult(null);
      }
    }, 800);
    return () => clearTimeout(timer);
  }, [newContact.email]);

  const addContact = () => {
    const cleanName = newContact.name.trim();
    const cleanEmail = newContact.email.trim().toLowerCase();

    if (cleanName && cleanEmail) {
      const contact: EmergencyContact = {
        id: `contact_${Date.now()}`,
        name: cleanName,
        email: cleanEmail,
        isRegisteredUser: lookupResult === 'found'
      };
      
      const currentContacts = Array.isArray(settings.contacts) ? settings.contacts : [];
      if (currentContacts.some(c => c.email === cleanEmail)) {
        setNewContact({ name: '', email: '' });
        setLookupResult(null);
        return;
      }

      const isFirst = currentContacts.length === 0;
      updateSettings({ 
        contacts: [...currentContacts, contact],
        primaryGuardianEmail: isFirst ? cleanEmail : settings.primaryGuardianEmail 
      });
      setNewContact({ name: '', email: '' });
      setLookupResult(null);
    }
  };

  const removeContact = (id: string, email: string) => {
    const currentContacts = Array.isArray(settings.contacts) ? settings.contacts : [];
    const isPrimary = settings.primaryGuardianEmail === email;
    updateSettings({ 
      contacts: currentContacts.filter((c) => c.id !== id),
      primaryGuardianEmail: isPrimary ? undefined : settings.primaryGuardianEmail
    });
  };

  const setAsPrimary = (email: string) => {
    updateSettings({ primaryGuardianEmail: email });
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPassMsg(null);

    if (newPass.length < 6) {
      setPassMsg({ type: 'error', text: 'New password too short.' });
      return;
    }
    if (newPass !== confirmPass) {
      setPassMsg({ type: 'error', text: 'Passwords do not match.' });
      return;
    }

    setPassLoading(true);
    try {
      const result = await AuthService.changePassword(user.email, oldPass, newPass);
      if (result === 'success') {
        setPassMsg({ type: 'success', text: 'Password updated successfully.' });
        setOldPass('');
        setNewPass('');
        setConfirmPass('');
      } else if (result === 'wrong_old') {
        setPassMsg({ type: 'error', text: 'Incorrect current password.' });
      } else if (result === 'same_as_old') {
        setPassMsg({ type: 'error', text: 'New password cannot be same as old.' });
      }
    } catch (e) {
      setPassMsg({ type: 'error', text: 'Failed to update password.' });
    } finally {
      setPassLoading(false);
    }
  };

  return (
    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-10 duration-700 pb-10">
      
      {/* PROFILE SECTION - PICTURE REMOVED */}
      <section className="space-y-4">
        <div className="flex items-center gap-3 px-2">
          <div className="p-2 bg-blue-600/10 rounded-xl text-blue-500"><User size={18} /></div>
          <h3 className="font-black text-[11px] uppercase tracking-widest text-slate-500 italic">My Account</h3>
        </div>
        
        {/* Simplified User Info Card */}
        <div className="bg-slate-950 p-6 rounded-[2rem] border border-white/5 shadow-inner">
           <div className="flex items-center gap-4 mb-6">
             <div className="w-12 h-12 rounded-xl bg-slate-800 flex items-center justify-center border border-slate-700">
                <User size={24} className="text-slate-400" />
             </div>
             <div>
               <h4 className="text-white font-bold text-lg">{user.name}</h4>
               <p className="text-slate-500 text-xs font-mono">{user.email}</p>
             </div>
           </div>

           {/* Change Password Sub-Section */}
           <div className="bg-slate-900/50 p-5 rounded-2xl border border-white/5">
              <h4 className="text-[10px] font-black uppercase text-slate-600 tracking-widest mb-4 flex items-center gap-2">
                <Lock size={12} /> Change Password
              </h4>
              <form onSubmit={handleChangePassword} className="space-y-3">
                 <input type="password" placeholder="Current Password" value={oldPass} onChange={e => setOldPass(e.target.value)} className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-3 text-xs text-white" />
                 <div className="flex gap-3">
                    <input type="password" placeholder="New Password" value={newPass} onChange={e => setNewPass(e.target.value)} className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-3 text-xs text-white" />
                    <input type="password" placeholder="Confirm" value={confirmPass} onChange={e => setConfirmPass(e.target.value)} className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-3 text-xs text-white" />
                 </div>
                 <button type="submit" disabled={passLoading || !oldPass} className="w-full bg-slate-800 hover:bg-slate-700 text-slate-200 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-colors flex justify-center gap-2">
                   {passLoading ? <RefreshCw className="animate-spin" size={14}/> : 'Update Password'}
                 </button>
                 {passMsg && (
                   <p className={`text-[10px] font-bold text-center ${passMsg.type === 'error' ? 'text-red-500' : 'text-green-500'}`}>
                     {passMsg.text}
                   </p>
                 )}
              </form>
           </div>
        </div>
      </section>

      {/* PANIC PHRASE SECTION */}
      <section className="space-y-4">
        <div className="flex items-center gap-3 px-2">
          <div className="p-2 bg-blue-600/10 rounded-xl text-blue-500"><Mic size={18} /></div>
          <h3 className="font-black text-[11px] uppercase tracking-widest text-slate-500 italic">Panic Phrase</h3>
        </div>
        <div className="bg-slate-950 p-7 rounded-[2.5rem] border border-white/5 shadow-inner">
           <input 
            type="text" 
            value={settings.triggerPhrase}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateSettings({ triggerPhrase: e.target.value })}
            className="w-full bg-slate-900/50 border border-white/5 rounded-2xl px-6 py-5 text-sm font-black text-white focus:border-blue-500 outline-none"
            placeholder="e.g. Guardian, help me"
          />
          <p className="text-[8px] font-bold text-slate-600 uppercase tracking-widest mt-4 px-2">
            The Aegis engine listens in 80+ languages. Detection is automatic.
          </p>
        </div>
      </section>

      {/* CONTACTS SECTION */}
      <section className="space-y-6">
        <div className="flex items-center gap-3 px-2">
          <div className="p-2 bg-blue-600/10 rounded-xl text-blue-500"><UserPlus size={18} /></div>
          <h3 className="font-black text-[11px] uppercase tracking-widest text-slate-500 italic">Guardian Management</h3>
        </div>

        <div className="bg-slate-950 p-8 rounded-[3rem] border border-white/5 space-y-5 shadow-2xl">
          <div className="relative">
             <input 
              type="email" placeholder="Guardian Email" value={newContact.email}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewContact(p => ({...p, email: e.target.value}))}
              className={`w-full bg-slate-950 border rounded-2xl py-4 px-6 text-xs text-white font-bold pr-14 outline-none transition-colors ${lookupResult === 'found' ? 'border-green-500/50' : (lookupResult === 'not_found' || lookupResult === 'error') ? 'border-red-500/50' : 'border-white/5 focus:border-blue-500'}`}
            />
            <div className="absolute right-5 top-1/2 -translate-y-1/2">
              {isSearching ? <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" /> : 
               lookupResult === 'found' ? <CheckCircle2 size={20} className="text-green-500" /> :
               lookupResult === 'not_found' ? <AlertCircle size={20} className="text-red-500" /> : 
               lookupResult === 'error' ? <Wifi size={20} className="text-amber-500 animate-pulse" /> :
               <Search size={20} className="text-slate-800" />}
            </div>
          </div>

          <input 
            type="text" placeholder="Guardian Name" value={newContact.name}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewContact(p => ({...p, name: e.target.value}))}
            className="w-full bg-slate-900 border border-white/5 rounded-2xl px-6 py-4 text-xs text-white font-bold outline-none focus:border-blue-500"
          />
          
          <button 
            onClick={addContact} 
            disabled={!newContact.name.trim() || !newContact.email.trim() || isSearching}
            className="w-full bg-blue-600 py-5 rounded-[2rem] text-white font-black uppercase text-[10px] tracking-widest disabled:opacity-20 shadow-xl active:scale-95 transition-all"
          >
            Authorize Mesh Node
          </button>
        </div>

        <div className="space-y-4">
          {(settings.contacts || []).map(c => {
            const isPrimary = settings.primaryGuardianEmail === c.email;
            return (
              <div key={c.id} className={`bg-slate-900/40 border p-6 rounded-[2.5rem] flex items-center justify-between shadow-lg group transition-all ${isPrimary ? 'border-blue-500/30 ring-1 ring-blue-500/20' : 'border-white/5'}`}>
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-lg uppercase transition-colors ${c.isRegisteredUser ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-500'}`}>
                    {c.name ? c.name[0] : '?'}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h5 className="text-[14px] font-black text-white italic">{c.name}</h5>
                      {isPrimary && (
                        <span className="bg-blue-600/20 text-blue-400 text-[7px] font-black uppercase px-2 py-0.5 rounded-full flex items-center gap-1 border border-blue-500/30">
                          <Star size={8} className="fill-blue-400" /> Primary
                        </span>
                      )}
                    </div>
                    <p className="text-[9px] text-slate-600 font-bold uppercase tracking-widest mt-1">{c.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {!isPrimary && (
                    <button 
                      onClick={() => setAsPrimary(c.email)}
                      className="text-slate-700 hover:text-blue-500 transition-colors p-3 hover:scale-110 transition-transform"
                    >
                      <Star size={18} />
                    </button>
                  )}
                  <button onClick={() => removeContact(c.id, c.email)} className="text-slate-700 hover:text-red-500 transition-colors p-3 group-hover:scale-110 transition-transform">
                    <Trash2 size={20} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
};

export default SettingsPanel;
