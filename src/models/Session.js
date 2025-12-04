import { Database } from '../config/database.js';

export class Session {
    constructor(data = {}) {
        this.id = data.id || null;
        this.tutorId = data.tutor_id || data.tutorId || null;
        this.tuteeId = data.tutee_id || data.tuteeId || null;
        this.skillId = data.skill_id || data.skillId || null;
        this.status = data.status || 'requested';
        this.scheduledTime = data.scheduled_time || data.scheduledTime || null;
        this.completedAt = data.completed_at || data.completedAt || null;
        this.createdAt = data.created_at || data.createdAt || null;
        this.pointCost = data.point_cost !== undefined && data.point_cost !== null 
            ? data.point_cost 
            : (data.pointCost !== undefined && data.pointCost !== null ? data.pointCost : 10);
        this.tutorConfirmed = data.tutor_confirmed || data.tutorConfirmed || false;
        this.tuteeConfirmed = data.tutee_confirmed || data.tuteeConfirmed || false;
    }

    validate() {
        const errors = [];

        if (!this.tutorId) {
            errors.push('Tutor ID is required');
        }

        if (!this.tuteeId) {
            errors.push('Tutee ID is required');
        }

        if (this.tutorId === this.tuteeId) {
            errors.push('Tutor and tutee cannot be the same user');
        }

        if (!this.skillId) {
            errors.push('Skill ID is required');
        }

        const validStatuses = ['requested', 'scheduled', 'completed', 'cancelled'];
        if (!validStatuses.includes(this.status)) {
            errors.push(`Status must be one of: ${validStatuses.join(', ')}`);
        }

        if (this.scheduledTime && new Date(this.scheduledTime) < new Date()) {
            errors.push('Scheduled time cannot be in the past');
        }

        return {
            valid: errors.length === 0,
            errors
        };
    }

    static async findById(sessionId) {
        try {
            const db = Database.getInstance();
            const { data, error } = await db.getClient()
                .from('sessions')
                .select('*')
                .eq('id', sessionId)
                .single();

            if (error || !data) return null;
            return new Session(data);
        } catch (error) {
            console.error('Error finding session by ID:', error);
            return null;
        }
    }

    static async findByUserId(userId, filters = {}) {
        try {
            const db = Database.getInstance();
            let query = db.getClient()
                .from('sessions')
                .select('*')
                .or(`tutor_id.eq.${userId},tutee_id.eq.${userId}`);

            if (filters.status) {
                query = query.eq('status', filters.status);
            }

            const { data, error } = await query.order('created_at', { ascending: false });

            if (error) throw error;
            return (data || []).map(item => new Session(item));
        } catch (error) {
            console.error('Error finding sessions by user ID:', error);
            return [];
        }
    }

    static async findByTutorId(tutorId, filters = {}) {
        try {
            const db = Database.getInstance();
            let query = db.getClient()
                .from('sessions')
                .select('*')
                .eq('tutor_id', tutorId);

            if (filters.status) {
                query = query.eq('status', filters.status);
            }

            const { data, error } = await query.order('created_at', { ascending: false });

            if (error) throw error;
            return (data || []).map(item => new Session(item));
        } catch (error) {
            console.error('Error finding sessions by tutor ID:', error);
            return [];
        }
    }

    static async create(sessionData) {
        try {
            const session = new Session(sessionData);
            const validation = session.validate();

            if (!validation.valid) {
                throw new Error(validation.errors.join(', '));
            }

            const db = Database.getInstance();
            const { data, error } = await db.getClient()
                .from('sessions')
                .insert({
                    tutor_id: session.tutorId,
                    tutee_id: session.tuteeId,
                    skill_id: session.skillId,
                    status: session.status,
                    scheduled_time: session.scheduledTime,
                    point_cost: session.pointCost !== undefined && session.pointCost !== null ? session.pointCost : 10
                })
                .select()
                .single();

            if (error) throw error;
            return new Session(data);
        } catch (error) {
            console.error('Error creating session:', error);
            throw error;
        }
    }

    static async updateStatus(sessionId, status, additionalData = {}) {
        try {
            const updateData = { status, ...additionalData };

            if (status === 'completed') {
                updateData.completed_at = new Date().toISOString();
            }

            const db = Database.getInstance();
            const { data, error } = await db.getClient()
                .from('sessions')
                .update(updateData)
                .eq('id', sessionId)
                .select()
                .single();

            if (error) throw error;
            return data ? new Session(data) : null;
        } catch (error) {
            console.error('Error updating session status:', error);
            throw error;
        }
    }

    static async hasTimeConflict(tutorId, scheduledTime, excludeSessionId = null) {
        try {
            const db = Database.getInstance();
            let query = db.getClient()
                .from('sessions')
                .select('id')
                .eq('tutor_id', tutorId)
                .in('status', ['requested', 'scheduled'])
                .eq('scheduled_time', scheduledTime.toISOString());

            if (excludeSessionId) {
                query = query.neq('id', excludeSessionId);
            }

            const { data, error } = await query;

            if (error) throw error;
            return (data || []).length > 0;
        } catch (error) {
            console.error('Error checking time conflict:', error);
            return false;
        }
    }

    toJSON() {
        return {
            id: this.id,
            tutorId: this.tutorId,
            tuteeId: this.tuteeId,
            skillId: this.skillId,
            status: this.status,
            scheduledTime: this.scheduledTime,
            completedAt: this.completedAt,
            createdAt: this.createdAt,
            pointCost: this.pointCost,
            tutorConfirmed: this.tutorConfirmed,
            tuteeConfirmed: this.tuteeConfirmed
        };
    }
}
