
import { auth, signInAnonymously } from './firebase';

export const AuthService = {
  sendLoginOTP: async (email: string): Promise<boolean> => {
    // Simulate network delay
    return new Promise((resolve) => setTimeout(() => resolve(true), 1500));
  },

  verifyLoginOTP: async (otp: string): Promise<boolean> => {
    // Mock validation - accept '123456'
    const isValid = otp === '123456';
    
    if (isValid) {
      try {
        // Authenticate anonymously with Firebase to allow Database writes
        // This fixes the "Permission Denied" error for rules requiring auth
        await signInAnonymously(auth);
      } catch (error) {
        console.warn("Anonymous auth failed, continuing locally:", error);
      }
    }

    return new Promise((resolve) => setTimeout(() => resolve(isValid), 1500));
  },

  sendResetOTP: async (email: string): Promise<boolean> => {
    return new Promise((resolve) => setTimeout(() => resolve(true), 1500));
  },

  resetPassword: async (newPass: string): Promise<boolean> => {
    return new Promise((resolve) => setTimeout(() => resolve(true), 1500));
  }
};
