import { SchedulingService } from '../services/SchedulingService.js';
import { Session } from '../models/Session.js';
import { Skill } from '../models/Skill.js';
import { User } from '../models/User.js';

export class SessionController {
    async book(req, res, router) {
        try {
            const userId = parseInt(req.userId);
            const { tutorId, skillId, scheduledTime, pointCost } = req.body;

            if (!tutorId || !skillId || !scheduledTime) {
                return router.sendJson(res, {
                    success: false,
                    error: 'Missing required fields'
                }, 400);
            }

            const scheduledDate = new Date(scheduledTime);
            if (isNaN(scheduledDate.getTime())) {
                return router.sendJson(res, {
                    success: false,
                    error: 'Invalid date format'
                }, 400);
            }

            const cost = pointCost !== undefined ? parseInt(pointCost) : 10;
            if (isNaN(cost) || cost < 0) {
                return router.sendJson(res, {
                    success: false,
                    error: 'Point cost cannot be negative'
                }, 400);
            }

            const result = await SchedulingService.bookSession(
                userId,
                parseInt(tutorId),
                parseInt(skillId),
                scheduledDate,
                cost
            );

            router.sendJson(res, result, result.success ? 200 : 400);
        } catch (error) {
            console.error('Error booking session:', error);
            router.sendJson(res, {
                success: false,
                error: 'Failed to book session'
            }, 500);
        }
    }

    async accept(req, res, router) {
        try {
            const userId = parseInt(req.userId);
            const { sessionId } = req.body;

            if (!sessionId) {
                return router.sendJson(res, {
                    success: false,
                    error: 'Session ID is required'
                }, 400);
            }

            const result = await SchedulingService.acceptSession(parseInt(sessionId), userId);
            router.sendJson(res, result, result.success ? 200 : 400);
        } catch (error) {
            console.error('Error accepting session:', error);
            router.sendJson(res, {
                success: false,
                error: 'Failed to accept session'
            }, 500);
        }
    }

    async complete(req, res, router) {
        try {
            const userId = parseInt(req.userId);
            const { sessionId } = req.body;

            if (!sessionId) {
                return router.sendJson(res, {
                    success: false,
                    error: 'Session ID is required'
                }, 400);
            }

            const result = await SchedulingService.completeSession(parseInt(sessionId), userId);
            router.sendJson(res, result, result.success ? 200 : 400);
        } catch (error) {
            console.error('Error completing session:', error);
            router.sendJson(res, {
                success: false,
                error: 'Failed to complete session'
            }, 500);
        }
    }

    async cancel(req, res, router) {
        try {
            const userId = parseInt(req.userId);
            const { sessionId } = req.body;

            if (!sessionId) {
                return router.sendJson(res, {
                    success: false,
                    error: 'Session ID is required'
                }, 400);
            }

            const result = await SchedulingService.cancelSession(parseInt(sessionId), userId);
            router.sendJson(res, result, result.success ? 200 : 400);
        } catch (error) {
            console.error('Error cancelling session:', error);
            router.sendJson(res, {
                success: false,
                error: 'Failed to cancel session'
            }, 500);
        }
    }

    async show(req, res, router) {
        try {
            const userId = parseInt(req.userId);
            const sessionId = parseInt(req.pathname.split('/').pop());

            const session = await Session.findById(sessionId);
            if (!session) {
                return router.sendJson(res, { error: 'Session not found' }, 404);
            }

            if (session.tutorId !== userId && session.tuteeId !== userId) {
                return router.sendJson(res, { error: 'Unauthorized' }, 403);
            }

            const tutor = await User.findById(session.tutorId);
            const tutee = await User.findById(session.tuteeId);
            const skill = await Skill.findById(session.skillId);

            router.sendJson(res, {
                session: session.toJSON(),
                tutor: tutor ? tutor.toJSON() : null,
                tutee: tutee ? tutee.toJSON() : null,
                skill: skill ? skill.toJSON() : null
            });
        } catch (error) {
            console.error('Error showing session:', error);
            router.sendJson(res, { error: 'Failed to load session' }, 500);
        }
    }

    async getPendingRequests(req, res, router) {
        try {
            const userId = parseInt(req.userId);

            const sessions = await Session.findByTutorId(userId, { status: 'requested' });

            const enrichedSessions = await Promise.all(
                sessions.map(async (session) => {
                    const tutee = await User.findById(session.tuteeId);
                    const skill = await Skill.findById(session.skillId);
                    return {
                        ...session.toJSON(),
                        tutee: tutee ? tutee.toJSON() : null,
                        skill: skill ? skill.toJSON() : null
                    };
                })
            );

            router.sendJson(res, { requests: enrichedSessions });
        } catch (error) {
            console.error('Error getting pending requests:', error);
            router.sendJson(res, { error: 'Failed to load pending requests' }, 500);
        }
    }

    async reject(req, res, router) {
        try {
            const userId = parseInt(req.userId);
            const { sessionId } = req.body;

            if (!sessionId) {
                return router.sendJson(res, {
                    success: false,
                    error: 'Session ID is required'
                }, 400);
            }

            const result = await SchedulingService.rejectSession(parseInt(sessionId), userId);
            router.sendJson(res, result, result.success ? 200 : 400);
        } catch (error) {
            console.error('Error rejecting session:', error);
            router.sendJson(res, {
                success: false,
                error: 'Failed to reject session'
            }, 500);
        }
    }

    async getNotificationCount(req, res, router) {
        try {
            const userId = parseInt(req.userId);
            const user = await User.findById(userId);
            
            let count = 0;
            
            if (user && user.isTutor) {
                const pendingRequests = await Session.findByTutorId(userId, { status: 'requested' });
                count += pendingRequests.length;
            }
            
            const allSessions = await Session.findByUserId(userId, { status: 'scheduled' });
            allSessions.forEach(session => {
                const isTutor = session.tutorId === userId;
                const hasConfirmed = isTutor ? session.tutorConfirmed : session.tuteeConfirmed;
                const otherConfirmed = isTutor ? session.tuteeConfirmed : session.tutorConfirmed;
                
                if (otherConfirmed && !hasConfirmed) {
                    count++;
                }
            });

            router.sendJson(res, { count });
        } catch (error) {
            console.error('Error getting session notification count:', error);
            router.sendJson(res, { count: 0 }, 500);
        }
    }
}
