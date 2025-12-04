import { Database } from '../config/database.js';
import bcrypt from 'bcryptjs';

export class User {
    constructor(data = {}) {
        this.id = data.id || null;
        this.email = data.email || '';
        this.username = data.username || '';
        this.firstName = data.first_name || data.firstName || '';
        this.lastName = data.last_name || data.lastName || '';
        this.nameChangeCount = data.name_change_count || 0;
        this.passwordHash = data.password_hash || data.passwordHash || '';
        this.isTutor = data.is_tutor || data.isTutor || false;
        this.isAdmin = data.is_admin || data.isAdmin || false;
        this.banned = data.banned || false;
        this.banReason = data.ban_reason || data.banReason || null;
        this.pointsBalance = data.points_balance || data.pointsBalance || 0;
        this.blockName = data.block_name || data.blockName || '';
        this.currentSessionToken = data.current_session_token || data.currentSessionToken || null;
        this.createdAt = data.created_at || data.createdAt || null;
    }

    getFullName() {
        if (this.firstName && this.lastName) {
            return `${this.firstName} ${this.lastName}`;
        }
        return this.username || this.email;
    }

    validate() {
        const errors = [];

        if (!this.email || !this.email.includes('@')) {
            errors.push('Valid email is required');
        }

        if (this.passwordHash && this.passwordHash.length < 6) {
            errors.push('Password must be at least 6 characters');
        }

        if (this.blockName && this.blockName.trim().length === 0) {
            errors.push('Block name is required');
        }

        return {
            valid: errors.length === 0,
            errors
        };
    }

    static async hashPassword(plainPassword) {
        const saltRounds = 10;
        return await bcrypt.hash(plainPassword, saltRounds);
    }

    static async comparePassword(plainPassword, hash) {
        return await bcrypt.compare(plainPassword, hash);
    }

    static async findById(userId) {
        try {
            const db = Database.getInstance();
            console.log('User.findById - Querying database_schema for userId:', userId);

            const { data, error } = await db.getClient()
                .from('users')
                .select('*')
                .eq('id', userId)
                .single();

            if (error) {
                console.error('Database error finding user by ID:', error);
                console.error('Error code:', error.code, 'Error message:', error.message);
                if (error.code === 'PGRST116' || error.message?.includes('relation') || error.message?.includes('does not exist')) {
                    console.error('⚠️ Database table "users" does not exist! Please run database_schema/COMPLETE_SETUP.sql in Supabase.');
                }
                return null;
            }

            if (!data) {
                console.log('No user found with ID:', userId);
                return null;
            }

            console.log('User found:', data.email);
            return new User(data);
        } catch (error) {
            console.error('Exception in findById:', error);
            console.error('Error stack:', error.stack);
            return null;
        }
    }

    static async findByEmail(email) {
        try {
            const db = Database.getInstance();
            const { data, error } = await db.getClient()
                .from('users')
                .select('*')
                .eq('email', email)
                .single();

            if (error || !data) return null;
            return new User(data);
        } catch (error) {
            console.error('Error finding user by email:', error);
            return null;
        }
    }

    static async findByUsername(username) {
        try {
            const db = Database.getInstance();
            const { data, error } = await db.getClient()
                .from('users')
                .select('*')
                .eq('username', username)
                .single();

            if (error || !data) return null;
            return new User(data);
        } catch (error) {
            console.error('Error finding user by username:', error);
            return null;
        }
    }

    static async create(userData) {
        try {
            const user = new User(userData);
            const validation = user.validate();

            if (!validation.valid) {
                throw new Error(validation.errors.join(', '));
            }

            if (userData.password) {
                user.passwordHash = await User.hashPassword(userData.password);
            }

            if (!user.username) {
                user.username = user.email.split('@')[0] + '_' + Math.floor(Math.random() * 10000);
            }

            const db = Database.getInstance();
            const { data, error } = await db.getClient()
                .from('users')
                .insert({
                    email: user.email,
                    username: user.username,
                    first_name: user.firstName || null,
                    last_name: user.lastName || null,
                    password_hash: user.passwordHash,
                    is_tutor: user.isTutor,
                    points_balance: user.pointsBalance,
                    block_name: user.blockName
                })
                .select()
                .single();

            if (error) throw error;
            return new User(data);
        } catch (error) {
            console.error('Error creating user:', error);
            throw error;
        }
    }

    static async updateSessionToken(userId, token) {
        try {
            const db = Database.getInstance();
            const { error } = await db.getClient()
                .from('users')
                .update({ current_session_token: token })
                .eq('id', userId);

            if (error) throw error;
            return true;
        } catch (error) {
            console.error('Error updating session token:', error);
            return false;
        }
    }

    static async updatePointsBalance(userId, newBalance) {
        try {
            const db = Database.getInstance();
            const { error } = await db.getClient()
                .from('users')
                .update({ points_balance: newBalance })
                .eq('id', userId);

            if (error) throw error;
            return true;
        } catch (error) {
            console.error('Error updating points balance:', error);
            return false;
        }
    }

    static async updateBlockName(userId, blockName) {
        try {
            const db = Database.getInstance();
            const { error } = await db.getClient()
                .from('users')
                .update({ block_name: blockName })
                .eq('id', userId);

            if (error) throw error;
            return true;
        } catch (error) {
            console.error('Error updating block name:', error);
            return false;
        }
    }

    static async updateName(userId, firstName, lastName) {
        try {
            const db = Database.getInstance();

            const user = await User.findById(userId);
            if (user.nameChangeCount >= 1) {
                return { success: false, error: 'Name can only be changed once' };
            }

            const { error } = await db.getClient()
                .from('users')
                .update({
                    first_name: firstName,
                    last_name: lastName,
                    name_change_count: user.nameChangeCount + 1
                })
                .eq('id', userId);

            if (error) throw error;
            return { success: true };
        } catch (error) {
            console.error('Error updating user name:', error);
            return { success: false, error: 'Failed to update name' };
        }
    }

    static async getSkills(userId) {
        try {
            const db = Database.getInstance();
            const { data, error } = await db.getClient()
                .from('user_skills')
                .select('skill_id, skills(id, name, category)')
                .eq('user_id', userId);

            if (error) throw error;
            return (data || []).map(item => item.skills);
        } catch (error) {
            console.error('Error getting user skills:', error);
            return [];
        }
    }

    static async addSkill(userId, skillId) {
        try {
            const db = Database.getInstance();
            const { error } = await db.getClient()
                .from('user_skills')
                .insert({ user_id: userId, skill_id: skillId });

            if (error) {
                 if (error.code === '23505') return true;
                 throw error;
            }
            return true;
        } catch (error) {
            console.error('Error adding user skill:', error);
            return false;
        }
    }

    static async removeSkill(userId, skillId) {
        try {
            const db = Database.getInstance();
            const { error } = await db.getClient()
                .from('user_skills')
                .delete()
                .eq('user_id', userId)
                .eq('skill_id', skillId);

            if (error) throw error;
            return true;
        } catch (error) {
            console.error('Error removing user skill:', error);
            return false;
        }
    }

    static async updateAdminStatus(userId, isAdmin) {
        try {
            const db = Database.getInstance();
            const { error } = await db.getClient()
                .from('users')
                .update({ is_admin: isAdmin })
                .eq('id', userId);

            if (error) throw error;
            return true;
        } catch (error) {
            console.error('Error updating admin status:', error);
            return false;
        }
    }

    toJSON() {
        return {
            id: this.id,
            email: this.email,
            username: this.username,
            firstName: this.firstName,
            lastName: this.lastName,
            nameChangeCount: this.nameChangeCount,
            fullName: this.getFullName(),
            isTutor: this.isTutor,
            isAdmin: this.isAdmin,
            banned: this.banned,
            banReason: this.banReason,
            pointsBalance: this.pointsBalance,
            blockName: this.blockName,
            createdAt: this.createdAt
        };
    }
}
