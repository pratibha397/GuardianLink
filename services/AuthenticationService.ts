
const DB_KEY = 'guardian_mock_auth_db';

const getDb = (): Record<string, string> => {
  try {
    const data = localStorage.getItem(DB_KEY);
    return data ? JSON.parse(data) : {};
  } catch {
    return {};
  }
};

const saveDb = (db: Record<string, string>) => {
  localStorage.setItem(DB_KEY, JSON.stringify(db));
};

export const AuthService = {
  login: async (email: string, pass: string): Promise<boolean> => {
    await new Promise(r => setTimeout(r, 1000)); // Simulate net delay
    const db = getDb();
    const normalizedEmail = email.toLowerCase().trim();
    return db[normalizedEmail] === pass;
  },

  register: async (email: string, pass: string): Promise<'success' | 'exists'> => {
    await new Promise(r => setTimeout(r, 1000));
    const db = getDb();
    const normalizedEmail = email.toLowerCase().trim();
    
    if (db[normalizedEmail]) {
      return 'exists';
    }
    
    db[normalizedEmail] = pass;
    saveDb(db);
    return 'success';
  },

  sendResetOTP: async (email: string): Promise<boolean> => {
    await new Promise(r => setTimeout(r, 1000));
    const db = getDb();
    const normalizedEmail = email.toLowerCase().trim();
    // Only send OTP if user exists
    return !!db[normalizedEmail];
  },

  verifyResetOTP: async (otp: string): Promise<boolean> => {
    await new Promise(r => setTimeout(r, 1000));
    return otp === '123456';
  },

  resetPassword: async (email: string, newPass: string): Promise<'success' | 'same_as_old' | 'error'> => {
    await new Promise(r => setTimeout(r, 1000));
    const db = getDb();
    const normalizedEmail = email.toLowerCase().trim();
    
    if (db[normalizedEmail]) {
      if (db[normalizedEmail] === newPass) {
        return 'same_as_old';
      }
      db[normalizedEmail] = newPass;
      saveDb(db);
      return 'success';
    }
    return 'error';
  },

  changePassword: async (email: string, oldPass: string, newPass: string): Promise<'success' | 'wrong_old' | 'same_as_old'> => {
    await new Promise(r => setTimeout(r, 1000));
    const db = getDb();
    const normalizedEmail = email.toLowerCase().trim();

    if (db[normalizedEmail] !== oldPass) {
      return 'wrong_old';
    }
    if (oldPass === newPass) {
      return 'same_as_old';
    }

    db[normalizedEmail] = newPass;
    saveDb(db);
    return 'success';
  }
};
