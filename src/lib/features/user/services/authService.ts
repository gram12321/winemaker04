import { notificationService } from '@/lib/services/core/notificationService';
import { NotificationCategory } from '@/lib/types/types';
import { supabase, getUserById, insertUser, updateUser, deleteUser, type PlayerProfile as PlayerProfileRecord } from '@/lib/database';

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
  private currentUser: PlayerProfileRecord | null = null;
  private listeners: ((user: PlayerProfileRecord | null) => void)[] = [];

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

  private setCurrentUser(user: PlayerProfileRecord | null) {
    this.currentUser = user;
    this.notifyListeners();
  }

  private notifyListeners() {
    this.listeners.forEach(listener => listener(this.currentUser));
  }

  private mapPlayerProfileRow(row: {
    id: string;
    email?: string;
    name: string;
    avatar?: string;
    avatar_color?: string;
    created_at: string;
    updated_at?: string;
  }): PlayerProfileRecord {
    return {
      id: row.id,
      email: row.email,
      name: row.name,
      avatar: row.avatar,
      avatarColor: row.avatar_color,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at ?? row.created_at)
    };
  }

  public onAuthStateChange(callback: (user: PlayerProfileRecord | null) => void) {
    this.listeners.push(callback);
    // Call immediately with current state
    callback(this.currentUser);
    
    // Return unsubscribe function
    return () => {
      this.listeners = this.listeners.filter(l => l !== callback);
    };
  }

  public getCurrentUser(): PlayerProfileRecord | null {
    return this.currentUser;
  }

  /** Selects the local player used by the offline/gameplay flow. */
  public selectLocalPlayer(user: PlayerProfileRecord | null): void {
    this.setCurrentUser(user);
  }

  public async getUserProfileById(userId: string): Promise<PlayerProfileRecord | null> {
    return await getUserById(userId);
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
      const profileResult = await insertUser({
        id: authData.user.id,
        email,
        name,
        avatar: avatar || 'default',
        avatar_color: avatarColor || 'blue'
      });

      if (!profileResult.success) {
        console.error('Error creating user profile:', profileResult.error);
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

  public async updateProfile(updates: Partial<Pick<PlayerProfileRecord, 'name' | 'avatar' | 'avatarColor'>>): Promise<{ success: boolean; error?: string }> {
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

  public async createLocalUserProfile(name: string): Promise<{ success: boolean; user?: PlayerProfileRecord; error?: string }> {
    try {
      const result = await insertUser({
        name: name.trim(),
        created_at: new Date().toISOString()
      });

      if (!result.success || !result.data) {
        return { success: false, error: result.error || 'Failed to create user' };
      }

      const user = this.mapPlayerProfileRow(result.data);
      this.setCurrentUser(user);

      return {
        success: true,
        user
      };
    } catch (error) {
      console.error('Create local user profile error:', error);
      return { success: false, error: 'An unexpected error occurred' };
    }
  }

  public async updateUserProfileById(
    userId: string,
    updates: Partial<Pick<PlayerProfileRecord, 'name' | 'avatar' | 'avatarColor'>>
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const result = await updateUser(userId, {
        name: updates.name,
        avatar: updates.avatar,
        avatar_color: updates.avatarColor
      });

      if (!result.success) {
        return result;
      }

      if (this.currentUser?.id === userId) {
        await this.loadUserProfile(userId);
      }

      return { success: true };
    } catch (error) {
      console.error('Update user profile by ID error:', error);
      return { success: false, error: 'An unexpected error occurred' };
    }
  }

  public async deleteUserProfileById(userId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const result = await deleteUser(userId);
      if (!result.success) {
        return result;
      }

      if (this.currentUser?.id === userId) {
        this.setCurrentUser(null);
      }

      return { success: true };
    } catch (error) {
      console.error('Delete user profile by ID error:', error);
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
