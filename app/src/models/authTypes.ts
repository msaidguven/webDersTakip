// Authentication Types
export interface AuthState {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: User | null;
  error: string | null;
}

export interface User {
  id: string;
  email: string;
  fullName?: string;
  avatarUrl?: string;
  role: 'student' | 'teacher' | 'admin';
  gradeId?: number;
  schoolName?: string;
  createdAt?: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterData extends LoginCredentials {
  fullName: string;
  confirmPassword: string;
  gradeId?: number;
  // Bot koruması — sunucuda (app/api/auth/register) yeniden doğrulanır, bkz. authSecurity.ts
  honeypot: string;
  formRenderedAt: number;
  mathA: number;
  mathB: number;
  mathAnswer: string;
}

export interface AuthViewModel {
  // State
  state: AuthState;
  
  // Actions
  login: (credentials: LoginCredentials) => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  logout: () => Promise<void>;
  clearError: () => void;
}
