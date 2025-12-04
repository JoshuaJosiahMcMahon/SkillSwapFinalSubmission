import { Database } from '../config/database.js';

export class Announcement {
    constructor(data = {}) {
        this.id = data.id || null;
        this.title = data.title || '';
        this.content = data.content || '';
        this.createdBy = data.created_by || data.createdBy || null;
        this.createdAt = data.created_at || data.createdAt || null;
        this.updatedAt = data.updated_at || data.updatedAt || null;
        this.isActive = data.is_active !== undefined ? data.is_active : true;
    }

    validate() {
        const errors = [];

        if (!this.title || this.title.trim().length === 0) {
            errors.push('Title is required');
        }

        if (!this.content || this.content.trim().length === 0) {
            errors.push('Content is required');
        }

        if (!this.createdBy) {
            errors.push('Created by (admin ID) is required');
        }

        return {
            valid: errors.length === 0,
            errors
        };
    }

    static async findActive() {
        try {
            const db = Database.getInstance();
            const { data, error } = await db.getClient()
                .from('announcements')
                .select('*')
                .eq('is_active', true)
                .order('created_at', { ascending: false });

            if (error) throw error;
            return (data || []).map(item => new Announcement(item));
        } catch (error) {
            console.error('Error finding active announcements:', error);
            return [];
        }
    }

    static async findAll() {
        try {
            const db = Database.getInstance();
            const { data, error } = await db.getClient()
                .from('announcements')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;
            return (data || []).map(item => new Announcement(item));
        } catch (error) {
            console.error('Error finding announcements:', error);
            return [];
        }
    }

    static async create(announcementData) {
        try {
            const announcement = new Announcement(announcementData);
            const validation = announcement.validate();

            if (!validation.valid) {
                throw new Error(validation.errors.join(', '));
            }

            const db = Database.getInstance();
            const { data, error } = await db.getClient()
                .from('announcements')
                .insert({
                    title: announcement.title,
                    content: announcement.content,
                    created_by: announcement.createdBy,
                    is_active: announcement.isActive
                })
                .select()
                .single();

            if (error) throw error;
            return new Announcement(data);
        } catch (error) {
            console.error('Error creating announcement:', error);
            throw error;
        }
    }

    static async delete(announcementId) {
        try {
            const db = Database.getInstance();
            const { error } = await db.getClient()
                .from('announcements')
                .delete()
                .eq('id', announcementId);

            if (error) throw error;
            return true;
        } catch (error) {
            console.error('Error deleting announcement:', error);
            throw error;
        }
    }

    toJSON() {
        return {
            id: this.id,
            title: this.title,
            content: this.content,
            createdBy: this.createdBy,
            createdAt: this.createdAt,
            updatedAt: this.updatedAt,
            isActive: this.isActive
        };
    }
}
