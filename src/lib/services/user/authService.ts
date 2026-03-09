import { supabase } from '../../database/core/supabase';
import { notificationService } from '@/lib/services';
import { NotificationCategory } from '@/lib/types/types';
import { getUserById, updateUser, deleteUser, insertUser, type AuthUser } from '@/lib/database';

export type { AuthUser } from '@/lib/database';

export interface SignUpData {
  email: string;
  password: string;
  name: string;
  avatar?: string;
  avatarColor?: string;
}

export interface SignInData {
  email: string;
  password: string;
}

class AuthService {
  private currentUser: AuthUser | null = null;
  private listeners: ((user: AuthUser | null) => void)[] = [];

  constructor() {
    this.initializeAuth();
  }

  private async initializeAuth() {
    // Get current session
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      await this.loadUserProfile(session.user.id);
    }

    // Listen for auth changes
    supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        await this.loadUserProfile(session.user.id);
      } else if (event === 'SIGNED_OUT') {
        this.setCurrentUser(null);
      }
    });
  }

  private async loadUserProfile(userId: string): Promise<void> {
    try {
      const user = await getUserById(userId);

      if (user) {
        this.setCurrentUser(user);
      }
    } catch (error) {
      console.error('Error loading user profile:', error);
    }
  }

  private setCurrentUser(user: AuthUser | null) {
    this.currentUser = user;
    this.notifyListeners();
  }

  private notifyListeners() {
    this.listeners.forEach(listener => listener(this.currentUser));
  }

  public onAuthStateChange(callback: (user: AuthUser | null) => void) {
    this.listeners.push(callback);
    // Call immediately with current state
    callback(this.currentUser);
    
    // Return unsubscribe function
    return () => {
      this.listeners = this.listeners.filter(l => l !== callback);
    };
  }

  public getCurrentUser(): AuthUser | null {
    return this.currentUser;
  }

  public async getUserProfileById(userId: string): Promise<AuthUser | null> {
    try {
      return await getUserById(userId);
    } catch (error) {
      console.error('Error loading user profile by ID:', error);
      return null;
    }
  }

  public async createUserProfile(name: string): Promise<{ success: boolean; user?: AuthUser; error?: string }> {
    try {
      const result = await insertUser({
        name: name.trim(),
        created_at: new Date().toISOString()
      });

      if (!result.success || !result.data) {
        return { success: false, error: result.error || 'Failed to create user profile' };
      }

      const user: AuthUser = {
        id: result.data.id,
        email: result.data.email,
        name: result.data.name,
        avatar: result.data.avatar,
        avatarColor: result.data.avatar_color,
        createdAt: new Date(result.data.created_at),
        updatedAt: new Date(result.data.updated_at)
      };

      return { success: true, user };
    } catch (error) {
      console.error('Error creating user profile:', error);
      return { success: false, error: 'An unexpected error occurred' };
    }
  }

  public async updateUserProfileById(
    userId: string,
    updates: Partial<Pick<AuthUser, 'name' | 'avatar' | 'avatarColor'>>
  ): Promise<{ success: boolean; error?: string }> {
    try {
      return await updateUser(userId, {
        name: updates.name,
        avatar: updates.avatar,
        avatar_color: updates.avatarColor
      });
    } catch (error) {
      console.error('Error updating user profile by ID:', error);
      return { success: false, error: 'An unexpected error occurred' };
    }
  }

  public async deleteUserProfileById(userId: string): Promise<{ success: boolean; error?: string }> {
    try {
      return await deleteUser(userId);
    } catch (error) {
      console.error('Error deleting user profile by ID:', error);
      return { success: false, error: 'An unexpected error occurred' };
    }
  }

  public isAuthenticated(): boolean {
    return this.currentUser !== null;
  }

  public async signUp({ email, password, name, avatar, avatarColor }: SignUpData): Promise<{ success: boolean; error?: string }> {
    try {
      // First create auth user
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password
      });

      if (authError) {
        return { success: false, error: authError.message };
      }

      if (!authData.user) {
        return { success: false, error: 'Failed to create user account' };
      }

      // Create user profile
      const { error: profileError } = await supabase
        .from('users')
        .insert({
          id: authData.user.id,
          email,
          name,
          avatar: avatar || 'default',
          avatar_color: avatarColor || 'blue'
        });

      if (profileError) {
        console.error('Error creating user profile:', profileError);
        // Auth user was created but profile failed - this should trigger email verification
        return { success: false, error: 'Failed to create user profile' };
      }

      await notificationService.addMessage(`Welcome ${name}! Please check your email to verify your account.`, 'authService.register', 'User Registration', NotificationCategory.SYSTEM);
      return { success: true };
    } catch (error) {
      console.error('Sign up error:', error);
      return { success: false, error: 'An unexpected error occurred' };
    }
  }

  public async signIn({ email, password }: SignInData): Promise<{ success: boolean; error?: string }> {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (error) {
        return { success: false, error: error.message };
      }

      if (data.user) {
        await notificationService.addMessage('Welcome back!', 'authService.signIn', 'User Sign In', NotificationCategory.SYSTEM);
        return { success: true };
      }

      return { success: false, error: 'Failed to sign in' };
    } catch (error) {
      console.error('Sign in error:', error);
      return { success: false, error: 'An unexpected error occurred' };
    }
  }

  public async signOut(): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await supabase.auth.signOut();
      
      if (error) {
        return { success: false, error: error.message };
      }

      await notificationService.addMessage('Signed out successfully', 'authService.signOut', 'User Sign Out', NotificationCategory.SYSTEM);
      return { success: true };
    } catch (error) {
      console.error('Sign out error:', error);
      return { success: false, error: 'An unexpected error occurred' };
    }
  }

  public async updateProfile(updates: Partial<Pick<AuthUser, 'name' | 'avatar' | 'avatarColor'>>): Promise<{ success: boolean; error?: string }> {
    if (!this.currentUser) {
      return { success: false, error: 'Not authenticated' };
    }

    try {
      const result = await updateUser(this.currentUser.id, {
        name: updates.name,
        avatar: updates.avatar,
        avatar_color: updates.avatarColor
      });

      if (!result.success) {
        return { success: false, error: result.error };
      }

      // Reload user profile
      await this.loadUserProfile(this.currentUser.id);
      await notificationService.addMessage('Profile updated successfully', 'authService.updateProfile', 'Profile Update', NotificationCategory.SYSTEM);
      return { success: true };
    } catch (error) {
      console.error('Update profile error:', error);
      return { success: false, error: 'An unexpected error occurred' };
    }
  }

  public async deleteAccount(): Promise<{ success: boolean; error?: string }> {
    if (!this.currentUser) {
      return { success: false, error: 'Not authenticated' };
    }

    try {
      // Delete user profile (this will cascade delete companies, settings, etc.)
      const result = await deleteUser(this.currentUser.id);

      if (!result.success) {
        return { success: false, error: result.error };
      }

      // Sign out from auth
      await supabase.auth.signOut();
      
      await notificationService.addMessage('Account deleted successfully', 'authService.deleteAccount', 'Account Deletion', NotificationCategory.SYSTEM);
      return { success: true };
    } catch (error) {
      console.error('Delete account error:', error);
      return { success: false, error: 'An unexpected error occurred' };
    }
  }
}

export const authService = new AuthService();
export default authService;
