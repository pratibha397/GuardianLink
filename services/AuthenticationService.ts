
export const AuthService = {
  sendLoginOTP: async (email: string): Promise<boolean> => {
    // Simulate network delay
    return new Promise((resolve) => setTimeout(() => resolve(true), 1500));
  },

  verifyLoginOTP: async (otp: string): Promise<boolean> => {
    // Mock validation - accept '123456'
    return new Promise((resolve) => setTimeout(() => resolve(otp === '123456'), 1500));
  },

  sendResetOTP: async (email: string): Promise<boolean> => {
    return new Promise((resolve) => setTimeout(() => resolve(true), 1500));
  },

  resetPassword: async (newPass: string): Promise<boolean> => {
    return new Promise((resolve) => setTimeout(() => resolve(true), 1500));
  }
};