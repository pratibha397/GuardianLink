
import { List, MessageSquare, Mic, Trash2, UserPlus } from 'lucide-react';
import React, { useState } from 'react';
import { AppSettings, EmergencyContact } from '../types';

interface SettingsPanelProps {
  settings: AppSettings;
  updateSettings: (s: Partial<AppSettings>) => void;
}

const SettingsPanel: React.FC<SettingsPanelProps> = ({ settings, updateSettings }) => {
  const [newContact, setNewContact] = useState<{name: string; phone: string}>({ name: '', phone: '' });

  const addContact = () => {
    if (newContact.name && newContact.phone) {
      const contact: EmergencyContact = {
        id: Date.now().toString(),
        name: newContact.name,
        phone: newContact.phone,
        isRegisteredUser: false
      };
      updateSettings({ contacts: [...settings.contacts, contact] });
      setNewContact({ name: '', phone: '' });
    }
  };

  const removeContact = (id: string) => {
    updateSettings({
      contacts: settings.contacts.filter((c: EmergencyContact) => c.id !== id)
    });
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <section>
        <div className="flex items-center gap-2 mb-4">
          <Mic size={18} className="text-blue-500" />
          <h3 className="font-bold text-sm uppercase tracking-widest text-slate-400">Trigger Phrase</h3>
        </div>
        <div className="space-y-2">
          <input 
            type="text" 
            value={settings.triggerPhrase}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateSettings({ triggerPhrase: e.target.value })}
            placeholder="e.g. Help Help"
            className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
          />
          <p className="text-[10px] text-slate-500 px-1">
            Pick a short, clear phrase that is unlikely to be said by mistake but easy to say in distress.
          </p>
        </div>
      </section>

      <section>
        <div className="flex items-center gap-2 mb-4">
          <MessageSquare size={18} className="text-blue-500" />
          <h3 className="font-bold text-sm uppercase tracking-widest text-slate-400">Alert Message</h3>
        </div>
        <div className="space-y-2">
          <textarea 
            rows={3}
            value={settings.messageTemplate}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => updateSettings({ messageTemplate: e.target.value })}
            className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500/50 text-sm"
          />
          <p className="text-[10px] text-slate-500 px-1">
            Use <strong>{'{location}'}</strong> where you want your GPS link to appear.
          </p>
        </div>
      </section>

      <section>
        <div className="flex items-center gap-2 mb-4">
          <List size={18} className="text-blue-500" />
          <h3 className="font-bold text-sm uppercase tracking-widest text-slate-400">Emergency Contacts</h3>
        </div>
        
        <div className="space-y-3">
          {settings.contacts.map((contact: EmergencyContact) => (
            <div key={contact.id} className="flex items-center justify-between bg-slate-800/60 p-4 rounded-xl border border-slate-700/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center font-bold text-slate-300">
                  {contact.name[0]?.toUpperCase()}
                </div>
                <div>
                  <h4 className="font-semibold text-sm">{contact.name}</h4>
                  <p className="text-xs text-slate-400">{contact.phone}</p>
                </div>
              </div>
              <button 
                onClick={() => removeContact(contact.id)}
                className="p-2 text-slate-500 hover:text-red-400 transition-colors"
              >
                <Trash2 size={18} />
              </button>
            </div>
          ))}

          {settings.contacts.length === 0 && (
            <div className="py-8 text-center border-2 border-dashed border-slate-800 rounded-xl text-slate-500">
              <p className="text-sm">No contacts added yet</p>
            </div>
          )}
        </div>

        <div className="mt-6 p-4 bg-blue-600/5 rounded-2xl border border-blue-500/20 space-y-3">
          <h4 className="text-xs font-bold uppercase tracking-wider text-blue-400 flex items-center gap-2">
            <UserPlus size={14} /> Add New Contact
          </h4>
          <div className="grid grid-cols-2 gap-2">
            <input 
              type="text" 
              placeholder="Name"
              value={newContact.name}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewContact(prev => ({ ...prev, name: e.target.value }))}
              className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <input 
              type="tel" 
              placeholder="Phone"
              value={newContact.phone}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewContact(prev => ({ ...prev, phone: e.target.value }))}
              className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <button 
            onClick={addContact}
            disabled={!newContact.name || !newContact.phone}
            className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-bold py-2 rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            Add Contact
          </button>
        </div>
      </section>
      
      <div className="pt-4 text-center">
         <p className="text-[10px] text-slate-500 italic">Settings are saved automatically to your device.</p>
      </div>
    </div>
  );
};

export default SettingsPanel;
