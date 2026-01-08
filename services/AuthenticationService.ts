
export const AuthService = {
  login: async (email: string, pass: string): Promise<boolean> => {
    // Simulate network delay
    return new Promise((resolve) => setTimeout(() => resolve(email === 'user@test.com' && pass === 'password'), 1500));
  },

  sendResetOTP: async (email: string): Promise<boolean> => {
    // Simulate sending OTP
    return new Promise((resolve) => setTimeout(() => resolve(true), 1500));
  },

  verifyResetOTP: async (otp: string): Promise<boolean> => {
    // Mock validation - accept '123456'
    return new Promise((resolve) => setTimeout(() => resolve(otp === '123456'), 1500));
  },

  resetPassword: async (newPass: string): Promise<boolean> => {
    // Simulate password update
    return new Promise((resolve) => setTimeout(() => resolve(true), 1500));
  }
};
