import { AuthController } from '../controllers/AuthController.js';
import { SessionController } from '../controllers/SessionController.js';
import { SearchController } from '../controllers/SearchController.js';
import { DashboardController } from '../controllers/DashboardController.js';
import { AdminController } from '../controllers/AdminController.js';
import { ProfileController } from '../controllers/ProfileController.js';
import { UploadController } from '../controllers/UploadController.js';
import { ReportController } from '../controllers/ReportController.js';
import { MessageController } from '../controllers/MessageController.js';
import { ReviewController } from '../controllers/ReviewController.js';

export class ApiRouter {
    constructor() {
        this.authController = new AuthController();
        this.sessionController = new SessionController();
        this.searchController = new SearchController();
        this.dashboardController = new DashboardController();
        this.adminController = new AdminController();
        this.profileController = new ProfileController();
        this.uploadController = new UploadController();
        this.reportController = new ReportController();
        this.messageController = new MessageController();
        this.reviewController = new ReviewController();
    }

    async parseBody(req) {
        return new Promise((resolve) => {
            let body = '';
            req.on('data', chunk => {
                body += chunk.toString();
            });
            req.on('end', () => {
                try {
                    resolve(body ? JSON.parse(body) : {});
                } catch {
                    resolve({});
                }
            });
        });
    }

    async parseQuery(url) {
        const query = {};
        const params = new URLSearchParams(url.search);
        for (const [key, value] of params) {
            query[key] = value;
        }
        return query;
    }

    async sendJson(res, data, statusCode = 200) {
        res.writeHead(statusCode, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(data));
    }

    async requireAuth(req, res) {
        const cookies = req.headers.cookie || '';
        const sessionIdMatch = cookies.match(/sessionId=([^;]+)/);
        const sessionTokenMatch = cookies.match(/sessionToken=([^;]+)/);

        const userId = sessionIdMatch ? sessionIdMatch[1].trim() : null;
        const token = sessionTokenMatch ? sessionTokenMatch[1].trim() : null;

        if (!userId) {
            return null;
        }

        try {
            const { User } = await import('../models/User.js');
            const user = await User.findById(parseInt(userId));

            if (!user || !user.currentSessionToken || user.currentSessionToken !== token) {
                console.log('Invalid session token for user:', userId);
                return null;
            }

            return userId;
        } catch (error) {
            console.error('Auth check failed:', error);
            return null;
        }
    }

    async checkBan(userId) {
        try {
            const { User } = await import('../models/User.js');
            const user = await User.findById(parseInt(userId));
            if (user && user.banned) {
                return {
                    banned: true,
                    reason: user.banReason || 'Your account has been banned from using SkillSwap. Please contact the administrator if you believe this is an error.'
                };
            }
            return { banned: false };
        } catch (error) {
            console.error('Error checking ban status:', error);
            return { banned: false };
        }
    }

    async checkAdmin(userId) {
        try {
            const { User } = await import('../models/User.js');
            const user = await User.findById(parseInt(userId));
            return user && user.isAdmin === true;
        } catch (error) {
            console.error('Error checking admin status:', error);
            return false;
        }
    }

    async handle(req, res) {
        const parsedUrl = new URL(req.url, `http://${req.headers.host}`);
        const pathname = parsedUrl.pathname;
        const method = req.method;

        req.query = await this.parseQuery(parsedUrl);
        req.pathname = pathname;

        if (pathname === '/api/upload/profile-picture' && method === 'POST') {
            const sessionId = await this.requireAuth(req, res);
            if (!sessionId) {
                this.sendJson(res, { error: 'Unauthorized' }, 401);
                return;
            }

            const banStatus = await this.checkBan(sessionId);
            if (banStatus.banned) {
                this.sendJson(res, {
                    error: 'Account banned',
                    banned: true,
                    banReason: banStatus.reason
                }, 403);
                return;
            }
            req.userId = sessionId;
            await this.uploadController.uploadProfilePicture(req, res, this);
            return;
        }

        const contentType = req.headers['content-type'] || '';
        if (!contentType.includes('multipart/form-data')) {
            req.body = await this.parseBody(req);
        }

        if (pathname.startsWith('/api/auth/')) {
            if (pathname === '/api/auth/register' && method === 'POST') {
                await this.authController.register(req, res, this);
            } else if (pathname === '/api/auth/login' && method === 'POST') {
                await this.authController.login(req, res, this);
            } else if (pathname === '/api/auth/logout' && method === 'POST') {
                await this.authController.logout(req, res, this);
            } else if (pathname === '/api/auth/check-ban' && method === 'GET') {
                const sessionId = await this.requireAuth(req, res);
                if (!sessionId) {
                    this.sendJson(res, { banned: false }, 200);
                    return;
                }
                const banStatus = await this.checkBan(sessionId);
                this.sendJson(res, banStatus, 200);
                return;
            } else {
                this.sendJson(res, { error: 'Not found' }, 404);
            }
            return;
        }

        if (pathname.startsWith('/api/sessions/')) {
            const sessionId = await this.requireAuth(req, res);
            if (!sessionId) {
                this.sendJson(res, { error: 'Unauthorized' }, 401);
                return;
            }

            const banStatus = await this.checkBan(sessionId);
            if (banStatus.banned) {
                this.sendJson(res, {
                    error: 'Account banned',
                    banned: true,
                    banReason: banStatus.reason
                }, 403);
                return;
            }
            req.userId = sessionId;

            if (pathname === '/api/sessions/book' && method === 'POST') {
                await this.sessionController.book(req, res, this);
            } else if (pathname === '/api/sessions/notification-count' && method === 'GET') {
                await this.sessionController.getNotificationCount(req, res, this);
            } else if (pathname === '/api/sessions/pending-requests' && method === 'GET') {
                await this.sessionController.getPendingRequests(req, res, this);
            } else if (pathname.startsWith('/api/sessions/') && pathname !== '/api/sessions/book' &&
                       pathname !== '/api/sessions/accept' && pathname !== '/api/sessions/reject' &&
                       pathname !== '/api/sessions/complete' && pathname !== '/api/sessions/cancel' &&
                       pathname !== '/api/sessions/pending-requests' && method === 'GET') {
                await this.sessionController.show(req, res, this);
            } else if (pathname === '/api/sessions/accept' && method === 'POST') {
                await this.sessionController.accept(req, res, this);
            } else if (pathname === '/api/sessions/reject' && method === 'POST') {
                await this.sessionController.reject(req, res, this);
            } else if (pathname === '/api/sessions/complete' && method === 'POST') {
                await this.sessionController.complete(req, res, this);
            } else if (pathname === '/api/sessions/cancel' && method === 'POST') {
                await this.sessionController.cancel(req, res, this);
            } else {
                this.sendJson(res, { error: 'Not found' }, 404);
            }
            return;
        }

        if (pathname === '/api/search/tutors' && method === 'GET') {
            const sessionId = await this.requireAuth(req, res);
            if (!sessionId) {
                this.sendJson(res, { error: 'Unauthorized' }, 401);
                return;
            }

            const banStatus = await this.checkBan(sessionId);
            if (banStatus.banned) {
                this.sendJson(res, {
                    error: 'Account banned',
                    banned: true,
                    banReason: banStatus.reason
                }, 403);
                return;
            }
            req.userId = sessionId;
            await this.searchController.search(req, res, this);
            return;
        }

        if (pathname === '/api/dashboard' && method === 'GET') {
            const sessionId = await this.requireAuth(req, res);
            if (!sessionId) {
                this.sendJson(res, { error: 'Unauthorized' }, 401);
                return;
            }

            const banStatus = await this.checkBan(sessionId);
            if (banStatus.banned) {
                this.sendJson(res, {
                    error: 'Account banned',
                    banned: true,
                    banReason: banStatus.reason
                }, 403);
                return;
            }
            req.userId = sessionId;
            await this.dashboardController.getData(req, res, this);
            return;
        }

        if (pathname === '/api/skills' && method === 'GET') {
            await this.searchController.getSkills(req, res, this);
            return;
        }

        if (pathname === '/api/degrees' && method === 'GET') {
            await this.searchController.getDegrees(req, res, this);
            return;
        }

        if (pathname === '/api/announcements' && method === 'GET') {
            const sessionId = await this.requireAuth(req, res);
            if (!sessionId) {
                this.sendJson(res, { error: 'Unauthorized' }, 401);
                return;
            }

            const banStatus = await this.checkBan(sessionId);
            if (banStatus.banned) {
                this.sendJson(res, {
                    error: 'Account banned',
                    banned: true,
                    banReason: banStatus.reason
                }, 403);
                return;
            }

            await this.adminController.getAnnouncements(req, res, this);
            return;
        }

        if (pathname.startsWith('/api/profile')) {
            const sessionId = await this.requireAuth(req, res);
            if (!sessionId) {
                this.sendJson(res, { error: 'Unauthorized' }, 401);
                return;
            }

            const banStatus = await this.checkBan(sessionId);
            if (banStatus.banned) {
                this.sendJson(res, {
                    error: 'Account banned',
                    banned: true,
                    banReason: banStatus.reason
                }, 403);
                return;
            }
            req.userId = sessionId;

            if (pathname === '/api/profile' && method === 'GET') {
                await this.profileController.getProfile(req, res, this);
            } else if (pathname === '/api/profile' && method === 'PUT') {
                await this.profileController.updateProfile(req, res, this);
            } else if (pathname === '/api/profile/picture' && method === 'PUT') {
                await this.profileController.updateProfilePicture(req, res, this);
            } else if (pathname === '/api/profile/skills' && method === 'GET') {
                await this.profileController.getSkills(req, res, this);
            } else if (pathname === '/api/profile/skills' && method === 'POST') {
                await this.profileController.addSkill(req, res, this);
            } else if (pathname === '/api/profile/skills' && method === 'DELETE') {
                await this.profileController.removeSkill(req, res, this);
            } else {
                this.sendJson(res, { error: 'Not found' }, 404);
            }
            return;
        }

            if (pathname.startsWith('/api/reports')) {
                const sessionId = await this.requireAuth(req, res);
                if (!sessionId) {
                    this.sendJson(res, { error: 'Unauthorized' }, 401);
                    return;
                }
                req.userId = sessionId;

                const banStatus = await this.checkBan(sessionId);
                if (banStatus.banned) {
                    this.sendJson(res, {
                        error: 'Account banned',
                        banned: true,
                        banReason: banStatus.reason
                    }, 403);
                    return;
                }

                if (pathname === '/api/reports' && method === 'POST') {
                    await this.reportController.createReport(req, res, this);
                } else {
                    this.sendJson(res, { error: 'Not found' }, 404);
                }
                return;
            }

            if (pathname.startsWith('/api/messages')) {
                const sessionId = await this.requireAuth(req, res);
                if (!sessionId) {
                    this.sendJson(res, { error: 'Unauthorized' }, 401);
                    return;
                }
                req.userId = sessionId;

                const banStatus = await this.checkBan(sessionId);
                if (banStatus.banned) {
                    this.sendJson(res, {
                        error: 'Account banned',
                        banned: true,
                        banReason: banStatus.reason
                    }, 403);
                    return;
                }

                if (pathname === '/api/messages' && method === 'POST') {
                    await this.messageController.sendMessage(req, res, this);
                } else if (pathname === '/api/messages/conversation' && method === 'GET') {
                    await this.messageController.getConversation(req, res, this);
                } else if (pathname === '/api/messages/conversations' && method === 'GET') {
                    await this.messageController.getConversations(req, res, this);
                } else if (pathname === '/api/messages/unread-count' && method === 'GET') {
                    await this.messageController.getUnreadCount(req, res, this);
                } else {
                    this.sendJson(res, { error: 'Not found' }, 404);
                }
                return;
            }

            if (pathname.startsWith('/api/reviews')) {
                const sessionId = await this.requireAuth(req, res);
                if (!sessionId) {
                    this.sendJson(res, { error: 'Unauthorized' }, 401);
                    return;
                }
                req.userId = sessionId;

                const banStatus = await this.checkBan(sessionId);
                if (banStatus.banned) {
                    this.sendJson(res, {
                        error: 'Account banned',
                        banned: true,
                        banReason: banStatus.reason
                    }, 403);
                    return;
                }

                if (pathname === '/api/reviews' && method === 'POST') {
                    await this.reviewController.createReview(req, res, this);
                } else if (pathname === '/api/reviews' && method === 'GET') {
                    await this.reviewController.getReviews(req, res, this);
                } else if (pathname === '/api/reviews' && method === 'DELETE') {
                    await this.reviewController.deleteReview(req, res, this);
                } else if (pathname === '/api/reviews/my' && method === 'GET') {
                    await this.reviewController.getMyReviews(req, res, this);
                } else if (pathname === '/api/reviews/stats' && method === 'GET') {
                    await this.reviewController.getRatingStats(req, res, this);
                } else {
                    this.sendJson(res, { error: 'Not found' }, 404);
                }
                return;
            }

            if (pathname.startsWith('/api/admin/')) {
                const sessionId = await this.requireAuth(req, res);
                if (!sessionId) {
                    this.sendJson(res, { error: 'Unauthorized' }, 401);
                    return;
                }
                req.userId = sessionId;

                const isAdmin = await this.checkAdmin(sessionId);
                if (!isAdmin) {
                    this.sendJson(res, { error: 'Admin access required' }, 403);
                    return;
                }

            if (pathname === '/api/admin/stats' && method === 'GET') {
                await this.adminController.getStats(req, res, this);
            } else if (pathname === '/api/admin/users' && method === 'GET') {
                await this.adminController.getUsers(req, res, this);
            } else if (pathname === '/api/admin/sessions' && method === 'GET') {
                await this.adminController.getSessions(req, res, this);
            } else if (pathname === '/api/admin/skills/create' && method === 'POST') {
                await this.adminController.createSkill(req, res, this);
            } else if (pathname === '/api/admin/skills/delete' && method === 'POST') {
                await this.adminController.deleteSkill(req, res, this);
            } else if (pathname === '/api/admin/skills' && method === 'GET') {
                await this.adminController.getAllSkills(req, res, this);
            } else if (pathname === '/api/admin/degrees/create' && method === 'POST') {
                await this.adminController.createDegree(req, res, this);
            } else if (pathname === '/api/admin/degrees/delete' && method === 'POST') {
                await this.adminController.deleteDegree(req, res, this);
            } else if (pathname === '/api/admin/degrees' && method === 'GET') {
                await this.adminController.getAllDegrees(req, res, this);
            } else if (pathname === '/api/admin/users/delete' && method === 'POST') {
                await this.adminController.deleteUser(req, res, this);
            } else if (pathname === '/api/admin/users/toggle-tutor' && method === 'POST') {
                await this.adminController.toggleTutorRole(req, res, this);
            } else if (pathname === '/api/admin/users/adjust-points' && method === 'POST') {
                await this.adminController.adjustPoints(req, res, this);
            } else if (pathname === '/api/admin/users/ban' && method === 'POST') {
                await this.adminController.banUser(req, res, this);
            } else if (pathname === '/api/admin/users/unban' && method === 'POST') {
                await this.adminController.unbanUser(req, res, this);
            } else if (pathname === '/api/admin/announcements' && method === 'GET') {
                await this.adminController.getAnnouncements(req, res, this);
            } else if (pathname === '/api/admin/announcements/create' && method === 'POST') {
                await this.adminController.createAnnouncement(req, res, this);
            } else if (pathname === '/api/admin/announcements/delete' && method === 'POST') {
                await this.adminController.deleteAnnouncement(req, res, this);
            } else if (pathname === '/api/admin/reports' && method === 'GET') {
                await this.reportController.getReports(req, res, this);
            } else if (pathname === '/api/admin/reports/resolve' && method === 'POST') {
                await this.reportController.resolveReport(req, res, this);
            } else if (pathname === '/api/admin/users/toggle-admin' && method === 'POST') {
                await this.adminController.toggleAdminRole(req, res, this);
            } else if (pathname === '/api/admin/analytics/pdf' && method === 'GET') {
                await this.adminController.generateAnalyticsPDF(req, res, this);
            } else {
                this.sendJson(res, { error: 'Not found' }, 404);
            }
            return;
        }

        this.sendJson(res, { error: 'Not found' }, 404);
    }
}
