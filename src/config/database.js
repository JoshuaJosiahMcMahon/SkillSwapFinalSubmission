import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

export class Database {
    static instance = null;
    client = null;

    constructor() {
        if (Database.instance) {
            return Database.instance;
        }

        const supabaseUrl = process.env.SUPABASE_URL;
        const supabaseKey = process.env.SUPABASE_ANON_KEY;

        if (!supabaseUrl || !supabaseKey) {
            throw new Error(
                'Missing Supabase configuration. Please set SUPABASE_URL and SUPABASE_ANON_KEY in your .env file.'
            );
        }

        this.client = createClient(supabaseUrl, supabaseKey);
        Database.instance = this;
    }

    static getInstance() {
        if (!Database.instance) {
            Database.instance = new Database();
        }
        return Database.instance;
    }

    getClient() {
        return this.client;
    }

    async testConnection() {
        try {
            const { data, error } = await this.client
                .from('users')
                .select('count')
                .limit(1);

            if (error && error.code !== 'PGRST116') {

                throw error;
            }

            return true;
        } catch (error) {
            console.error('Database connection test failed:', error.message);
            return false;
        }
    }

    getServiceRoleClient() {
        const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

        if (!serviceRoleKey) {
            throw new Error(
                'SUPABASE_SERVICE_ROLE_KEY is not set. Service role operations are not available.'
            );
        }

        return createClient(process.env.SUPABASE_URL, serviceRoleKey);
    }
}
