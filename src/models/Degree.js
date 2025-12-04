import { Database } from '../config/database.js';

export class Degree {
    constructor(data = {}) {
        this.id = data.id || null;
        this.name = data.name || '';
        this.createdAt = data.created_at || data.createdAt || null;
    }

    validate() {
        const errors = [];

        if (!this.name || this.name.trim().length === 0) {
            errors.push('Degree name is required');
        }

        return {
            valid: errors.length === 0,
            errors
        };
    }

    static async findById(degreeId) {
        try {
            const db = Database.getInstance();
            const { data, error } = await db.getClient()
                .from('degrees')
                .select('*')
                .eq('id', degreeId)
                .single();

            if (error || !data) return null;
            return new Degree(data);
        } catch (error) {
            console.error('Error finding degree by ID:', error);
            return null;
        }
    }

    static async findAll(filters = {}) {
        try {
            const db = Database.getInstance();
            let query = db.getClient().from('degrees').select('*');

            if (filters.search) {
                query = query.ilike('name', `%${filters.search}%`);
            }

            const { data, error } = await query.order('name', { ascending: true });

            if (error) throw error;
            return (data || []).map(item => new Degree(item));
        } catch (error) {
            console.error('Error finding degrees:', error);
            return [];
        }
    }

    static async create(degreeData) {
        try {
            const degree = new Degree(degreeData);
            const validation = degree.validate();

            if (!validation.valid) {
                throw new Error(validation.errors.join(', '));
            }

            const db = Database.getInstance();
            const { data, error } = await db.getClient()
                .from('degrees')
                .insert({
                    name: degree.name
                })
                .select()
                .single();

            if (error) throw error;
            return new Degree(data);
        } catch (error) {
            console.error('Error creating degree:', error);
            throw error;
        }
    }

    static async delete(degreeId) {
        try {
            const db = Database.getInstance();
            const { error } = await db.getClient()
                .from('degrees')
                .delete()
                .eq('id', degreeId);

            if (error) throw error;
            return true;
        } catch (error) {
            console.error('Error deleting degree:', error);
            throw error;
        }
    }

    toJSON() {
        return {
            id: this.id,
            name: this.name,
            createdAt: this.createdAt
        };
    }
}
