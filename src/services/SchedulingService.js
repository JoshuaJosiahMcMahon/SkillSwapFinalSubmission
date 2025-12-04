import { Session } from '../models/Session.js';
import { User } from '../models/User.js';
import { PointsSystem } from './PointsSystem.js';
import { Database } from '../config/database.js';

export class SchedulingService {

    static async bookSession(tuteeId, tutorId, skillId, scheduledTime, pointCost = 10) {
        try {
            const cost = pointCost !== undefined && pointCost !== null ? pointCost : 10;

            const hasConflict = await Session.hasTimeConflict(tutorId, scheduledTime);
            if (hasConflict) {
                return {
                    success: false,
                    session: null,
                    error: 'Tutor is already booked at this time'
                };
            }

            const tutor = await User.findById(tutorId);
            if (!tutor || !tutor.isTutor) {
                return {
                    success: false,
                    session: null,
                    error: 'Invalid tutor'
                };
            }

            const tutee = await User.findById(tuteeId);
            if (!tutee) {
                return {
                    success: false,
                    session: null,
                    error: 'Invalid tutee'
                };
            }

            if (cost > 0 && tutee.pointsBalance < cost) {
                return {
                    success: false,
                    session: null,
                    error: `Insufficient points. Required: ${cost}, Available: ${tutee.pointsBalance}`
                };
            }

            const session = await Session.create({
                tutorId,
                tuteeId,
                skillId,
                status: 'requested',
                scheduledTime: scheduledTime.toISOString(),
                pointCost: cost
            });

            return {
                success: true,
                session: session.toJSON(),
                error: null
            };
        } catch (error) {
            return {
                success: false,
                session: null,
                error: error.message || 'Failed to book session'
            };
        }
    }

    static async acceptSession(sessionId, tutorId) {
        try {
            const session = await Session.findById(sessionId);
            if (!session) {
                return {
                    success: false,
                    session: null,
                    error: 'Session not found'
                };
            }

            if (session.tutorId !== tutorId) {
                return {
                    success: false,
                    session: null,
                    error: 'Unauthorized'
                };
            }

            if (session.status !== 'requested') {
                return {
                    success: false,
                    session: null,
                    error: 'Session cannot be accepted in current status'
                };
            }

            const scheduledTime = new Date(session.scheduledTime);
            const hasConflict = await Session.hasTimeConflict(tutorId, scheduledTime, sessionId);
            if (hasConflict) {
                return {
                    success: false,
                    session: null,
                    error: 'Time conflict detected'
                };
            }

            const updatedSession = await Session.updateStatus(sessionId, 'scheduled');

            return {
                success: true,
                session: updatedSession ? updatedSession.toJSON() : null,
                error: null
            };
        } catch (error) {
            return {
                success: false,
                session: null,
                error: error.message || 'Failed to accept session'
            };
        }
    }

    static async completeSession(sessionId, userId) {
        try {
            const session = await Session.findById(sessionId);
            if (!session) {
                return {
                    success: false,
                    session: null,
                    error: 'Session not found'
                };
            }

            if (session.tutorId !== userId && session.tuteeId !== userId) {
                return {
                    success: false,
                    session: null,
                    error: 'Unauthorized'
                };
            }

            if (session.status !== 'scheduled' && session.status !== 'requested') {
                return {
                    success: false,
                    session: null,
                    error: 'Session cannot be completed in current status'
                };
            }

            const isTutor = session.tutorId === userId;
            const updates = {};
            if (isTutor) {
                updates.tutor_confirmed = true;
            } else {
                updates.tutee_confirmed = true;
            }

            const willBeComplete = (isTutor || session.tutorConfirmed) && (!isTutor || session.tuteeConfirmed);

            if (willBeComplete) {
                const FREE_SESSION_TUTOR_BONUS = 50;
                const pointsAmount = session.pointCost !== undefined && session.pointCost !== null 
                    ? session.pointCost 
                    : 0;

                if (pointsAmount > 0) {
                    const transferResult = await PointsSystem.transferPoints(
                        session.tuteeId,
                        session.tutorId,
                        pointsAmount
                    );

                    if (!transferResult.success) {
                        return {
                            success: false,
                            session: null,
                            error: transferResult.error || 'Failed to transfer points'
                        };
                    }
                } else {
                    const bonusResult = await PointsSystem.addPoints(
                        session.tutorId,
                        FREE_SESSION_TUTOR_BONUS
                    );

                    if (!bonusResult.success) {
                        console.error('Failed to add bonus points for free session:', bonusResult.error);
                    }
                }

                const updatedSession = await Session.updateStatus(sessionId, 'completed', {
                    ...updates,
                    tutor_confirmed: true,
                    tutee_confirmed: true
                });

                const completionMessage = pointsAmount > 0 
                    ? 'Session completed successfully' 
                    : `Session completed successfully. Tutor received ${FREE_SESSION_TUTOR_BONUS} bonus points for the free session.`;

                return {
                    success: true,
                    session: updatedSession ? updatedSession.toJSON() : null,
                    message: completionMessage,
                    error: null
                };
            } else {

                const updatedSession = await Session.updateStatus(sessionId, session.status, updates);
                return {
                    success: true,
                    session: updatedSession ? updatedSession.toJSON() : null,
                    message: 'Confirmation received. Waiting for other party to confirm.',
                    error: null
                };
            }
        } catch (error) {
            return {
                success: false,
                session: null,
                error: error.message || 'Failed to complete session'
            };
        }
    }

    static async rejectSession(sessionId, tutorId) {
        try {
            const session = await Session.findById(sessionId);
            if (!session) {
                return {
                    success: false,
                    session: null,
                    error: 'Session not found'
                };
            }

            if (session.tutorId !== tutorId) {
                return {
                    success: false,
                    session: null,
                    error: 'Unauthorized - only the tutor can reject this request'
                };
            }

            if (session.status !== 'requested') {
                return {
                    success: false,
                    session: null,
                    error: 'Session cannot be rejected in current status'
                };
            }

            const updatedSession = await Session.updateStatus(sessionId, 'cancelled');

            return {
                success: true,
                session: updatedSession ? updatedSession.toJSON() : null,
                error: null
            };
        } catch (error) {
            return {
                success: false,
                session: null,
                error: error.message || 'Failed to reject session'
            };
        }
    }

    static async cancelSession(sessionId, userId) {
        try {
            const session = await Session.findById(sessionId);
            if (!session) {
                return {
                    success: false,
                    session: null,
                    error: 'Session not found'
                };
            }

            if (session.tutorId !== userId && session.tuteeId !== userId) {
                return {
                    success: false,
                    session: null,
                    error: 'Unauthorized'
                };
            }

            if (session.status === 'completed' || session.status === 'cancelled') {
                return {
                    success: false,
                    session: null,
                    error: 'Session is already finished'
                };
            }

            const db = Database.getInstance();
            const CANCELLATION_PENALTY = 50;

            if (session.status === 'scheduled') {
                const user = await User.findById(userId);

                const newBalance = user.pointsBalance - CANCELLATION_PENALTY;

                await User.updatePointsBalance(userId, newBalance);

                await db.getClient()
                    .from('sessions')
                    .update({
                        status: 'cancelled',
                        cancelled_by: userId,
                        cancellation_reason: 'User cancelled',
                        penalty_points: CANCELLATION_PENALTY
                    })
                    .eq('id', sessionId);
            } else {

                await Session.updateStatus(sessionId, 'cancelled');
            }

            return {
                success: true,
                message: session.status === 'scheduled' ?
                    `Session cancelled. ${CANCELLATION_PENALTY} points penalty applied.` :
                    'Session cancelled successfully.',
                error: null
            };
        } catch (error) {
            return {
                success: false,
                session: null,
                error: error.message || 'Failed to cancel session'
            };
        }
    }

    static async getUpcomingSessions(userId, limit = 10) {
        try {
            const sessions = await Session.findByUserId(userId, {
                status: 'scheduled'
            });

            const now = new Date();
            const upcoming = sessions
                .filter(session => new Date(session.scheduledTime) > now)
                .sort((a, b) => new Date(a.scheduledTime) - new Date(b.scheduledTime))
                .slice(0, limit);

            return upcoming.map(session => session.toJSON());
        } catch (error) {
            console.error('Error getting upcoming sessions:', error);
            return [];
        }
    }
}
