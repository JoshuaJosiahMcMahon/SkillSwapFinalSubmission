import { Database } from '../config/database.js';

export class Profile {
    constructor(data = {}) {
        this.userId = data.user_id || data.userId || null;
        this.bio = data.bio || '';
        this.major = data.major || '';
        this.yearOfStudy = data.year_of_study || data.yearOfStudy || null;
        this.profilePicture = data.profile_picture || data.profilePicture || null;
        this.updatedAt = data.updated_at || data.updatedAt || null;
    }

    validate() {
        const errors = [];

        if (!this.userId) {
            errors.push('User ID is required');
        }

        if (this.yearOfStudy && (this.yearOfStudy < 1 || this.yearOfStudy > 5)) {
            errors.push('Year of study must be between 1 and 5');
        }

        if (this.bio && this.bio.length > 500) {
            errors.push('Bio must be 500 characters or less');
        }

        return {
            valid: errors.length === 0,
            errors
        };
    }

    static async findByUserId(userId) {
        try {
            const db = Database.getInstance();
            const { data, error } = await db.getClient()
                .from('profiles')
                .select('*')
                .eq('user_id', userId)
                .single();

            if (error || !data) return null;
            return new Profile(data);
        } catch (error) {
            console.error('Error finding profile by user ID:', error);
            return null;
        }
    }

    static async upsert(profileData) {
        try {
            const profile = new Profile(profileData);
            const validation = profile.validate();

            if (!validation.valid) {
                throw new Error(validation.errors.join(', '));
            }

            const db = Database.getInstance();
            const { data, error } = await db.getClient()
                .from('profiles')
                .upsert({
                    user_id: profile.userId,
                    bio: profile.bio,
                    major: profile.major,
                    year_of_study: profile.yearOfStudy,
                    profile_picture: profile.profilePicture
                }, {
                    onConflict: 'user_id'
                })
                .select()
                .single();

            if (error) throw error;
            return new Profile(data);
        } catch (error) {
            console.error('Error upserting profile:', error);
            throw error;
        }
    }

    static async update(userId, updates) {
        try {

            const existingProfile = await Profile.findByUserId(userId);

            if (!existingProfile) {

                return await Profile.upsert({
                    userId: userId,
                    ...updates
                });
            }

            const db = Database.getInstance();
            const { data, error } = await db.getClient()
                .from('profiles')
                .update(updates)
                .eq('user_id', userId)
                .select()
                .single();

            if (error) throw error;
            return data ? new Profile(data) : null;
        } catch (error) {
            console.error('Error updating profile:', error);
            throw error;
        }
    }

    toJSON() {
        return {
            userId: this.userId,
            bio: this.bio,
            major: this.major,
            yearOfStudy: this.yearOfStudy,
            profilePicture: this.profilePicture,
            updatedAt: this.updatedAt
        };
    }
}
