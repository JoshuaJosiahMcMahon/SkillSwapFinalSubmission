import { Database } from '../config/database.js';

export class Skill {
    constructor(data = {}) {
        this.id = data.id || null;
        this.name = data.name || '';
        this.category = data.category || '';
        this.createdAt = data.created_at || data.createdAt || null;
    }

    validate() {
        const errors = [];

        if (!this.name || this.name.trim().length === 0) {
            errors.push('Skill name is required');
        }

        if (!this.category || this.category.trim().length === 0) {
            errors.push('Skill category is required');
        }

        return {
            valid: errors.length === 0,
            errors
        };
    }

    static async findById(skillId) {
        try {
            const db = Database.getInstance();
            const { data, error } = await db.getClient()
                .from('skills')
                .select('*')
                .eq('id', skillId)
                .single();

            if (error || !data) return null;
            return new Skill(data);
        } catch (error) {
            console.error('Error finding skill by ID:', error);
            return null;
        }
    }

    static async findAll(filters = {}) {
        try {
            const db = Database.getInstance();
            let query = db.getClient().from('skills').select('*');

            if (filters.category) {
                query = query.eq('category', filters.category);
            }

            if (filters.search) {
                query = query.ilike('name', `%${filters.search}%`);
            }

            const { data, error } = await query.order('name', { ascending: true });

            if (error) throw error;
            return (data || []).map(item => new Skill(item));
        } catch (error) {
            console.error('Error finding skills:', error);
            return [];
        }
    }

    static async create(skillData) {
        try {
            const skill = new Skill(skillData);
            const validation = skill.validate();

            if (!validation.valid) {
                throw new Error(validation.errors.join(', '));
            }

            const db = Database.getInstance();
            const { data, error } = await db.getClient()
                .from('skills')
                .insert({
                    name: skill.name,
                    category: skill.category
                })
                .select()
                .single();

            if (error) throw error;
            return new Skill(data);
        } catch (error) {
            console.error('Error creating skill:', error);
            throw error;
        }
    }

    static async delete(skillId) {
        try {
            const db = Database.getInstance();
            const { error } = await db.getClient()
                .from('skills')
                .delete()
                .eq('id', skillId);

            if (error) throw error;
            return true;
        } catch (error) {
            console.error('Error deleting skill:', error);
            throw error;
        }
    }

    static async getCategories() {
        try {
            const db = Database.getInstance();
            const { data, error } = await db.getClient()
                .from('skills')
                .select('category')
                .order('category', { ascending: true });

            if (error) throw error;
            const categories = [...new Set((data || []).map(item => item.category))];
            return categories;
        } catch (error) {
            console.error('Error getting categories:', error);
            return [];
        }
    }

    toJSON() {
        return {
            id: this.id,
            name: this.name,
            category: this.category,
            createdAt: this.createdAt
        };
    }
}
