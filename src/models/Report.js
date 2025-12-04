import { Database } from '../config/database.js';

export class Report {
    constructor(data = {}) {
        this.id = data.id || null;
        this.reporterId = data.reporter_id || data.reporterId || null;
        this.reportedUserId = data.reported_user_id || data.reportedUserId || null;
        this.reason = data.reason || '';
        this.description = data.description || '';
        this.status = data.status || 'pending';
        this.adminNotes = data.admin_notes || data.adminNotes || null;
        this.reviewedBy = data.reviewed_by || data.reviewedBy || null;
        this.reviewedAt = data.reviewed_at || data.reviewedAt || null;
        this.createdAt = data.created_at || data.createdAt || null;
    }

    validate() {
        const errors = [];

        if (!this.reporterId) {
            errors.push('Reporter ID is required');
        }

        if (!this.reportedUserId) {
            errors.push('Reported user ID is required');
        }

        if (this.reporterId === this.reportedUserId) {
            errors.push('Cannot report yourself');
        }

        if (!this.reason || this.reason.trim().length === 0) {
            errors.push('Report reason is required');
        }

        const validStatuses = ['pending', 'reviewed', 'resolved', 'dismissed'];
        if (this.status && !validStatuses.includes(this.status)) {
            errors.push(`Status must be one of: ${validStatuses.join(', ')}`);
        }

        return {
            valid: errors.length === 0,
            errors
        };
    }

    static async create(reportData) {
        try {
            const report = new Report(reportData);
            const validation = report.validate();

            if (!validation.valid) {
                throw new Error(validation.errors.join(', '));
            }

            const db = Database.getInstance();
            const { data, error } = await db.getClient()
                .from('reports')
                .insert({
                    reporter_id: report.reporterId,
                    reported_user_id: report.reportedUserId,
                    reason: report.reason,
                    description: report.description || null,
                    status: report.status
                })
                .select()
                .single();

            if (error) throw error;
            return new Report(data);
        } catch (error) {
            console.error('Error creating report:', error);
            throw error;
        }
    }

    static async findAll(filters = {}) {
        try {
            const db = Database.getInstance();
            let query = db.getClient()
                .from('reports')
                .select('*');

            if (filters.status) {
                query = query.eq('status', filters.status);
            }

            const { data, error } = await query.order('created_at', { ascending: false });

            if (error) throw error;
            return (data || []).map(item => new Report(item));
        } catch (error) {
            console.error('Error finding reports:', error);
            return [];
        }
    }

    static async updateStatus(reportId, status, adminId, notes = null) {
        try {
            const db = Database.getInstance();
            const updateData = {
                status: status,
                reviewed_by: adminId,
                reviewed_at: new Date().toISOString()
            };

            if (notes) {
                updateData.admin_notes = notes;
            }

            const { data, error } = await db.getClient()
                .from('reports')
                .update(updateData)
                .eq('id', reportId)
                .select()
                .single();

            if (error) throw error;
            return new Report(data);
        } catch (error) {
            console.error('Error updating report status:', error);
            throw error;
        }
    }

    toJSON() {
        return {
            id: this.id,
            reporterId: this.reporterId,
            reportedUserId: this.reportedUserId,
            reason: this.reason,
            description: this.description,
            status: this.status,
            adminNotes: this.adminNotes,
            reviewedBy: this.reviewedBy,
            reviewedAt: this.reviewedAt,
            createdAt: this.createdAt
        };
    }
}
