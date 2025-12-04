import { Database } from '../config/database.js';
import { User } from '../models/User.js';
import { Profile } from '../models/Profile.js';
import { Skill } from '../models/Skill.js';

export class MatchingService {

    static async findTutorsBySkill(skillId, options = {}) {
        try {
            const db = Database.getInstance();
            const limit = options.limit || 20;
            const offset = options.offset || 0;

            const { data: tutorsData, error } = await db.getClient()
                .from('users')
                .select(`
                    id,
                    email,
                    first_name,
                    last_name,
                    is_tutor,
                    points_balance,
                    block_name,
                    profiles (*)
                `)
                .eq('is_tutor', true)
                .range(offset, offset + limit - 1);

            if (error) throw error;

            const tutors = (tutorsData || []).map(tutor => {

                let profileData = null;
                if (tutor.profiles) {
                    profileData = Array.isArray(tutor.profiles) ? tutor.profiles[0] : tutor.profiles;
                }

                const fullName = tutor.first_name && tutor.last_name
                    ? `${tutor.first_name} ${tutor.last_name}`
                    : tutor.email;

                return {
                    id: tutor.id,
                    email: tutor.email,
                    firstName: tutor.first_name,
                    lastName: tutor.last_name,
                    fullName: fullName,
                    isTutor: tutor.is_tutor,
                    pointsBalance: tutor.points_balance,
                    blockName: tutor.block_name,
                    profile: profileData ? new Profile(profileData).toJSON() : null
                };
            });

            return tutors;
        } catch (error) {
            console.error('Error finding tutors by skill:', error);
            return [];
        }
    }

    static async findTutorsByMajor(major, options = {}) {
        try {
            const db = Database.getInstance();
            const limit = options.limit || 20;
            const offset = options.offset || 0;

            const { data: tutorsData, error } = await db.getClient()
                .from('users')
                .select(`
                    id,
                    email,
                    first_name,
                    last_name,
                    is_tutor,
                    points_balance,
                    block_name,
                    profiles (*)
                `)
                .eq('is_tutor', true)
                .ilike('profiles.major', `%${major}%`)
                .range(offset, offset + limit - 1);

            if (error) throw error;

            const tutors = (tutorsData || []).map(tutor => {

                let profileData = null;
                if (tutor.profiles) {
                    profileData = Array.isArray(tutor.profiles) ? tutor.profiles[0] : tutor.profiles;
                }

                const fullName = tutor.first_name && tutor.last_name
                    ? `${tutor.first_name} ${tutor.last_name}`
                    : tutor.email;

                return {
                    id: tutor.id,
                    email: tutor.email,
                    firstName: tutor.first_name,
                    lastName: tutor.last_name,
                    fullName: fullName,
                    isTutor: tutor.is_tutor,
                    pointsBalance: tutor.points_balance,
                    blockName: tutor.block_name,
                    profile: profileData ? new Profile(profileData).toJSON() : null
                };
            });

            return tutors;
        } catch (error) {
            console.error('Error finding tutors by major:', error);
            return [];
        }
    }

    static async searchTutors(criteria = {}, options = {}) {
        try {
            const db = Database.getInstance();
            const limit = options.limit || 20;
            const offset = options.offset || 0;

            let selectString = `
                id,
                email,
                first_name,
                last_name,
                is_tutor,
                points_balance,
                block_name,
                profiles!inner(*)
            `;

            if (criteria.skillId) {
                selectString += `, user_skills!inner(skill_id)`;
            }

            let query = db.getClient()
                .from('users')
                .select(selectString)
                .eq('is_tutor', true);

            if (criteria.skillId) {
                query = query.eq('user_skills.skill_id', criteria.skillId);
            }

            if (criteria.blockName) {
                query = query.eq('block_name', criteria.blockName);
            }

            if (criteria.major) {

                query = query.eq('profiles.major', criteria.major);
            }

            if (criteria.yearOfStudy) {
                query = query.eq('profiles.year_of_study', criteria.yearOfStudy);
            }

            const { data: tutorsData, error, count } = await query
                .range(offset, offset + limit - 1);

            if (error) throw error;

            const tutors = (tutorsData || []).map(tutor => {

                let profileData = null;
                if (tutor.profiles) {
                    profileData = Array.isArray(tutor.profiles) ? tutor.profiles[0] : tutor.profiles;
                }

                const fullName = tutor.first_name && tutor.last_name
                    ? `${tutor.first_name} ${tutor.last_name}`
                    : tutor.email;

                return {
                    id: tutor.id,
                    email: tutor.email,
                    firstName: tutor.first_name,
                    lastName: tutor.last_name,
                    fullName: fullName,
                    isTutor: tutor.is_tutor,
                    pointsBalance: tutor.points_balance,
                    blockName: tutor.block_name,
                    profile: profileData ? new Profile(profileData).toJSON() : null
                };
            });

            return {
                tutors,
                total: count || tutors.length
            };
        } catch (error) {
            console.error('Error searching tutors:', error);
            return { tutors: [], total: 0 };
        }
    }
}
