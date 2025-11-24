import { getUserById, updateUser } from '@/lib/database';
import { authService } from './authService';

/**
 * Get current player cash balance
 * @param userId - Optional user ID, uses current user if not provided
 * @returns Player cash balance in euros
 */
export async function getPlayerBalance(userId?: string): Promise<number> {
  try {
    if (!userId) {
      const currentUser = authService.getCurrentUser();
      if (!currentUser) {
        return 0;
      }
      userId = currentUser.id;
    }

    const user = await getUserById(userId);
    return user?.cashBalance ?? 0;
  } catch (error) {
    console.error('Error getting player balance:', error);
    return 0;
  }
}

/**
 * Update player cash balance
 * @param amount - Amount to add (positive) or subtract (negative)
 * @param userId - Optional user ID, uses current user if not provided
 * @returns Success status and new balance
 */
export async function updatePlayerBalance(
  amount: number,
  userId?: string
): Promise<{ success: boolean; newBalance?: number; error?: string }> {
  try {
    if (!userId) {
      const currentUser = authService.getCurrentUser();
      if (!currentUser) {
        return { success: false, error: 'No user authenticated' };
      }
      userId = currentUser.id;
    }

    const user = await getUserById(userId);
    if (!user) {
      return { success: false, error: 'User not found' };
    }

    const currentBalance = user.cashBalance ?? 0;
    const newBalance = currentBalance + amount;

    // Prevent negative balance
    if (newBalance < 0) {
      return { success: false, error: 'Insufficient balance' };
    }

    const result = await updateUser(userId, {
      cash_balance: newBalance
    });

    if (!result.success) {
      return { success: false, error: result.error || 'Failed to update balance' };
    }

    // Reload user profile to get updated balance
    const updatedUser = await getUserById(userId);

    return {
      success: true,
      newBalance: updatedUser?.cashBalance ?? newBalance
    };
  } catch (error) {
    console.error('Error updating player balance:', error);
    return { success: false, error: 'Failed to update balance' };
  }
}

/**
 * Set player cash balance to a specific amount
 * @param balance - New balance amount
 * @param userId - Optional user ID, uses current user if not provided
 * @returns Success status and new balance
 */
export async function setPlayerBalance(
  balance: number,
  userId?: string
): Promise<{ success: boolean; newBalance?: number; error?: string }> {
  try {
    if (!userId) {
      const currentUser = authService.getCurrentUser();
      if (!currentUser) {
        return { success: false, error: 'No user authenticated' };
      }
      userId = currentUser.id;
    }

    if (balance < 0) {
      return { success: false, error: 'Balance cannot be negative' };
    }

    const result = await updateUser(userId, {
      cash_balance: balance
    });

    if (!result.success) {
      return { success: false, error: result.error || 'Failed to set balance' };
    }

    // Reload user profile
    const updatedUser = await getUserById(userId);

    return {
      success: true,
      newBalance: updatedUser?.cashBalance ?? balance
    };
  } catch (error) {
    console.error('Error setting player balance:', error);
    return { success: false, error: 'Failed to set balance' };
  }
}

