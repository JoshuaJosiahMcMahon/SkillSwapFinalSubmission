import { Profile } from '../models/Profile.js';
import { AuthService } from '../services/AuthService.js';

export class ProfileController {
    async getProfile(req, res, router) {
        try {
            const userId = parseInt(req.userId);
            if (!userId || isNaN(userId)) {
                return router.sendJson(res, { error: 'Invalid user ID' }, 401);
            }

            const user = await AuthService.getUserWithProfile(userId);
            if (!user) {
                return router.sendJson(res, { error: 'User not found' }, 404);
            }

            router.sendJson(res, { profile: user });
        } catch (error) {
            console.error('Error getting profile:', error);
            router.sendJson(res, { error: 'Failed to load profile' }, 500);
        }
    }

    async updateProfile(req, res, router) {
        try {
            const userId = parseInt(req.userId);
            if (!userId || isNaN(userId)) {
                return router.sendJson(res, { error: 'Invalid user ID' }, 401);
            }

            const { bio, major, yearOfStudy, blockName, firstName, lastName } = req.body;
            const updates = {};
            if (bio !== undefined) updates.bio = bio;
            if (major !== undefined) updates.major = major;
            if (yearOfStudy !== undefined) updates.year_of_study = yearOfStudy;

            const profile = await Profile.update(userId, updates);
            if (!profile) {
                return router.sendJson(res, { error: 'Failed to update profile' }, 500);
            }

            const { User } = await import('../models/User.js');

            if (blockName !== undefined && blockName.trim().length > 0) {
                await User.updateBlockName(userId, blockName.trim());
            }

            let nameError = null;
            if (firstName && lastName) {
                const newFirstName = firstName.trim();
                const newLastName = lastName.trim();

                if (newFirstName.length > 0 && newLastName.length > 0) {
                    const user = await User.findById(userId);

                    if (user.firstName !== newFirstName || user.lastName !== newLastName) {
                        const result = await User.updateName(userId, newFirstName, newLastName);
                        if (!result.success) {
                            nameError = result.error;
                        }
                    }
                }
            }

            const updatedUser = await AuthService.getUserWithProfile(userId);

            router.sendJson(res, {
                success: !nameError,
                profile: updatedUser,
                error: nameError ? `Profile updated, but name update failed: ${nameError}` : null
            });
        } catch (error) {
            console.error('Error updating profile:', error);
            router.sendJson(res, { error: 'Failed to update profile' }, 500);
        }
    }

    async updateProfilePicture(req, res, router) {
        try {
            const userId = parseInt(req.userId);
            if (!userId || isNaN(userId)) {
                return router.sendJson(res, { error: 'Invalid user ID' }, 401);
            }

            const { profilePicture } = req.body;
            if (!profilePicture) {
                return router.sendJson(res, { error: 'Profile picture URL is required' }, 400);
            }

            const profile = await Profile.update(userId, { profile_picture: profilePicture });

            if (!profile) {
                return router.sendJson(res, { error: 'Failed to update profile picture' }, 500);
            }

            router.sendJson(res, {
                success: true,
                profilePicture: profile.profilePicture,
                url: profilePicture
            });
        } catch (error) {
            console.error('Error updating profile picture:', error);
            router.sendJson(res, { error: 'Failed to update profile picture' }, 500);
        }
    }

    async getSkills(req, res, router) {
        try {
            const userId = parseInt(req.userId);
            const { User } = await import('../models/User.js');
            const skills = await User.getSkills(userId);
            router.sendJson(res, { skills });
        } catch (error) {
            console.error('Error getting user skills:', error);
            router.sendJson(res, { error: 'Failed to load skills' }, 500);
        }
    }

    async addSkill(req, res, router) {
        try {
            const userId = parseInt(req.userId);
            const { skillId } = req.body;

            if (!skillId) {
                return router.sendJson(res, { error: 'Skill ID is required' }, 400);
            }

            const { User } = await import('../models/User.js');
            const success = await User.addSkill(userId, parseInt(skillId));

            if (success) {
                router.sendJson(res, { success: true });
            } else {
                router.sendJson(res, { error: 'Failed to add skill' }, 500);
            }
        } catch (error) {
            console.error('Error adding user skill:', error);
            router.sendJson(res, { error: 'Failed to add skill' }, 500);
        }
    }

    async removeSkill(req, res, router) {
        try {
            const userId = parseInt(req.userId);
            const { skillId } = req.body;

            if (!skillId) {
                return router.sendJson(res, { error: 'Skill ID is required' }, 400);
            }

            const { User } = await import('../models/User.js');
            const success = await User.removeSkill(userId, parseInt(skillId));

            if (success) {
                router.sendJson(res, { success: true });
            } else {
                router.sendJson(res, { error: 'Failed to remove skill' }, 500);
            }
        } catch (error) {
            console.error('Error removing user skill:', error);
            router.sendJson(res, { error: 'Failed to remove skill' }, 500);
        }
    }
}
