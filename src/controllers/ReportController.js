import { Report } from '../models/Report.js';
import { User } from '../models/User.js';

export class ReportController {
    async createReport(req, res, router) {
        try {
            const userId = parseInt(req.userId);
            const { reportedUserId, reason, description } = req.body;

            if (!reportedUserId || !reason) {
                return router.sendJson(res, {
                    success: false,
                    error: 'Reported user ID and reason are required'
                }, 400);
            }

            const reportedUser = await User.findById(parseInt(reportedUserId));
            if (!reportedUser) {
                return router.sendJson(res, {
                    success: false,
                    error: 'Reported user not found'
                }, 404);
            }

            if (userId === parseInt(reportedUserId)) {
                return router.sendJson(res, {
                    success: false,
                    error: 'Cannot report yourself'
                }, 400);
            }

            const report = await Report.create({
                reporterId: userId,
                reportedUserId: parseInt(reportedUserId),
                reason: reason.trim(),
                description: description ? description.trim() : null
            });

            router.sendJson(res, {
                success: true,
                report: report.toJSON(),
                message: 'Report submitted successfully'
            });
        } catch (error) {
            console.error('Error creating report:', error);
            router.sendJson(res, {
                success: false,
                error: error.message || 'Failed to submit report'
            }, 500);
        }
    }

    async getReports(req, res, router) {
        try {
            const { status } = req.query;
            const filters = {};
            if (status) filters.status = status;

            const reports = await Report.findAll(filters);
            router.sendJson(res, { reports: reports.map(r => r.toJSON()) });
        } catch (error) {
            console.error('Error getting reports:', error);
            router.sendJson(res, { error: 'Failed to retrieve reports' }, 500);
        }
    }

    async resolveReport(req, res, router) {
        try {
            const adminId = parseInt(req.userId);
            const { reportId, status, notes } = req.body;

            if (!reportId || !status) {
                return router.sendJson(res, { error: 'Report ID and status are required' }, 400);
            }

            const validStatuses = ['pending', 'reviewed', 'resolved', 'dismissed'];
            if (!validStatuses.includes(status)) {
                return router.sendJson(res, { error: 'Invalid status' }, 400);
            }

            const report = await Report.updateStatus(parseInt(reportId), status, adminId, notes);
            router.sendJson(res, { success: true, report: report.toJSON() });
        } catch (error) {
            console.error('Error resolving report:', error);
            router.sendJson(res, { error: error.message || 'Failed to resolve report' }, 500);
        }
    }
}
