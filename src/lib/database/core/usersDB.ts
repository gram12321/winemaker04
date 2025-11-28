import { supabase } from './supabase';
import { toOptionalNumber } from '../dbMapperUtils';

const USERS_TABLE = 'users';

/**
 * Users Database Operations
 * Pure CRUD operations for user data persistence
 * NOTE: Auth operations (signup/signin/signout) remain in authService
 */

export interface UserData {
  id?: string;
  email?: string;
  name: string;
  avatar?: string;
  avatar_color?: string;
  cash_balance?: number;
  created_at?: string;
}

export interface AuthUser {
  id: string;
  email?: string;
  name: string;
  avatar?: string;
  avatarColor?: string;
  cashBalance?: number;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Map database row to AuthUser
 */
function mapUserFromDB(dbUser: any): AuthUser {
  return {
    id: dbUser.id,
    email: dbUser.email,
    name: dbUser.name,
    avatar: dbUser.avatar,
    avatarColor: dbUser.avatar_color,
    cashBalance: toOptionalNumber(dbUser.cash_balance) ?? 0,
    createdAt: new Date(dbUser.created_at),
    updatedAt: new Date(dbUser.updated_at)
  };
}

export const insertUser = async (userData: UserData): Promise<{ success: boolean; data?: any; error?: string }> => {
  try {
    const { data, error } = await supabase
      .from(USERS_TABLE)
      .insert(userData)
      .select()
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, data };
  } catch (error: any) {
    console.error('Error inserting user:', error);
    return { success: false, error: error.message || 'An unexpected error occurred' };
  }
};

export const getUserById = async (userId: string): Promise<AuthUser | null> => {
  try {
    const { data, error } = await supabase
      .from(USERS_TABLE)
      .select('*')
      .eq('id', userId)
      .single();

    if (error) return null;
    return data ? mapUserFromDB(data) : null;
  } catch (error) {
    console.error('Error getting user by ID:', error);
    return null;
  }
};

export const updateUser = async (userId: string, updates: Partial<UserData>): Promise<{ success: boolean; error?: string }> => {
  try {
    const { error } = await supabase
      .from(USERS_TABLE)
      .update(updates)
      .eq('id', userId);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error: any) {
    console.error('Error updating user:', error);
    return { success: false, error: error.message || 'An unexpected error occurred' };
  }
};

export const deleteUser = async (userId: string): Promise<{ success: boolean; error?: string }> => {
  try {
    const { error } = await supabase
      .from(USERS_TABLE)
      .delete()
      .eq('id', userId);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error: any) {
    console.error('Error deleting user:', error);
    return { success: false, error: error.message || 'An unexpected error occurred' };
  }
};

