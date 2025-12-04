import { User } from '../models/User.js';
import { Database } from '../config/database.js';

export class PointsSystem {

    static async transferPoints(fromUserId, toUserId, amount) {
        try {
            if (amount <= 0) {
                return {
                    success: false,
                    error: 'Transfer amount must be positive'
                };
            }

            const fromUser = await User.findById(fromUserId);
            const toUser = await User.findById(toUserId);

            if (!fromUser || !toUser) {
                return {
                    success: false,
                    error: 'One or both users not found'
                };
            }

            if (fromUser.pointsBalance < amount) {
                return {
                    success: false,
                    error: 'Insufficient points balance'
                };
            }

            const db = Database.getInstance();
            const client = db.getClient();

            const { error: errorFrom } = await client
                .from('users')
                .update({ points_balance: fromUser.pointsBalance - amount })
                .eq('id', fromUserId);

            if (errorFrom) throw errorFrom;

            const { error: errorTo } = await client
                .from('users')
                .update({ points_balance: toUser.pointsBalance + amount })
                .eq('id', toUserId);

            if (errorTo) {

                await client
                    .from('users')
                    .update({ points_balance: fromUser.pointsBalance })
                    .eq('id', fromUserId);
                throw errorTo;
            }

            return {
                success: true,
                error: null
            };
        } catch (error) {
            console.error('Error transferring points:', error);
            return {
                success: false,
                error: error.message || 'Failed to transfer points'
            };
        }
    }

    static async getBalance(userId) {
        try {
            const user = await User.findById(userId);
            return user ? user.pointsBalance : 0;
        } catch (error) {
            console.error('Error getting balance:', error);
            return 0;
        }
    }

    static async addPoints(userId, amount) {
        try {
            if (amount <= 0) {
                return {
                    success: false,
                    error: 'Amount must be positive'
                };
            }

            const user = await User.findById(userId);
            if (!user) {
                return {
                    success: false,
                    error: 'User not found'
                };
            }

            const success = await User.updatePointsBalance(userId, user.pointsBalance + amount);
            return {
                success,
                error: success ? null : 'Failed to update points'
            };
        } catch (error) {
            return {
                success: false,
                error: error.message || 'Failed to add points'
            };
        }
    }
}
