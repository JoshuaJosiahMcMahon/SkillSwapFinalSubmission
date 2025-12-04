import { User } from '../models/User.js';
import { Profile } from '../models/Profile.js';
import crypto from 'crypto';

export class AuthService {

    static async register(userData) {
        try {

            const existingUser = await User.findByEmail(userData.email);
            if (existingUser) {
                return {
                    success: false,
                    user: null,
                    error: 'Email already registered'
                };
            }

            const user = await User.create({
                email: userData.email,
                firstName: userData.firstName,
                lastName: userData.lastName,
                password: userData.password,
                isTutor: userData.isTutor || false,
                pointsBalance: userData.pointsBalance || 100,
                blockName: userData.blockName
            });

            if (userData.bio || userData.major || userData.yearOfStudy) {
                await Profile.upsert({
                    userId: user.id,
                    bio: userData.bio,
                    major: userData.major,
                    yearOfStudy: userData.yearOfStudy
                });
            }

            const token = crypto.randomUUID();
            await User.updateSessionToken(user.id, token);
            user.currentSessionToken = token;

            return {
                success: true,
                user: user.toJSON(),
                token: token,
                error: null
            };
        } catch (error) {
            return {
                success: false,
                user: null,
                error: error.message || 'Registration failed'
            };
        }
    }

    static async login(email, password) {
        try {
            const user = await User.findByEmail(email);
            if (!user) {
                return {
                    success: false,
                    user: null,
                    error: 'Invalid email or password'
                };
            }

            if (user.banned) {
                return {
                    success: false,
                    user: null,
                    error: 'Your account has been banned',
                    banned: true,
                    banReason: user.banReason || 'Your account has been banned from using SkillSwap. Please contact the administrator if you believe this is an error.'
                };
            }

            const passwordMatch = await User.comparePassword(password, user.passwordHash);
            if (!passwordMatch) {
                return {
                    success: false,
                    user: null,
                    error: 'Invalid email or password'
                };
            }

            const token = crypto.randomUUID();
            await User.updateSessionToken(user.id, token);
            user.currentSessionToken = token;

            return {
                success: true,
                user: user.toJSON(),
                token: token,
                error: null
            };
        } catch (error) {
            return {
                success: false,
                user: null,
                error: error.message || 'Login failed'
            };
        }
    }

    static async getUserWithProfile(userId) {
        try {
            console.log('getUserWithProfile called with userId:', userId);
            const user = await User.findById(userId);
            if (!user) {
                console.error('User.findById returned null for userId:', userId);
                return null;
            }

            const profile = await Profile.findByUserId(userId);
            const userData = user.toJSON();

            return {
                ...userData,
                profile: profile ? profile.toJSON() : null
            };
        } catch (error) {
            console.error('Error getting user with profile:', error);
            console.error('Error stack:', error.stack);
            return null;
        }
    }
}
