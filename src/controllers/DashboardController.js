import { AuthService } from '../services/AuthService.js';
import { SchedulingService } from '../services/SchedulingService.js';
import { PointsSystem } from '../services/PointsSystem.js';
import { Session } from '../models/Session.js';
import { Review } from '../models/Review.js';

export class DashboardController {
    async getData(req, res, router) {
        try {
            console.log('Dashboard getData called, req.userId:', req.userId, 'Type:', typeof req.userId);
            const userId = parseInt(req.userId);

            if (!userId || isNaN(userId)) {
                console.error('Invalid userId after parseInt. Original:', req.userId, 'Parsed:', userId);
                return router.sendJson(res, { error: 'Invalid user ID' }, 401);
            }

            console.log('Loading dashboard for userId:', userId, 'Type:', typeof userId);
            const user = await AuthService.getUserWithProfile(userId);
            if (!user) {
                console.error('User not found for userId:', userId);
                console.error('This might mean:');
                console.error('1. Database tables not created - run database_schema/COMPLETE_SETUP.sql');
                console.error('2. User was deleted or ID mismatch');
                console.error('3. Database connection issue');
                return router.sendJson(res, {
                    error: 'User not found. If you just registered, make sure database_schema tables exist (run database_schema/COMPLETE_SETUP.sql in Supabase).'
                }, 404);
            }

            console.log('User loaded successfully:', user.email);

            const upcomingSessions = await SchedulingService.getUpcomingSessions(userId, 5);
            const allSessions = await Session.findByUserId(userId);

            const recentSessionsWithRatings = await Promise.all(
                allSessions.slice(0, 10).map(async (s) => {
                    const sessionJson = s.toJSON();

                    if (s.tuteeId === userId && s.status === 'completed') {
                        const existingReview = await Review.findBySessionAndReviewer(s.id, userId);
                        sessionJson.hasRated = !!existingReview;
                    } else {
                        sessionJson.hasRated = false;
                    }
                    return sessionJson;
                })
            );

            const pointsBalance = await PointsSystem.getBalance(userId);

            router.sendJson(res, {
                user,
                pointsBalance,
                upcomingSessions,
                recentSessions: recentSessionsWithRatings
            });
        } catch (error) {
            console.error('Error getting dashboard data:', error);
            router.sendJson(res, { error: 'Failed to load dashboard' }, 500);
        }
    }
}
