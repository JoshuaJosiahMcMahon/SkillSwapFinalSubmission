import { Database } from '../config/database.js';
import { User } from '../models/User.js';
import { Session } from '../models/Session.js';
import { Skill } from '../models/Skill.js';
import { Degree } from '../models/Degree.js';
import { Profile } from '../models/Profile.js';
import { Announcement } from '../models/Announcement.js';
import { Report } from '../models/Report.js';
import PDFDocument from 'pdfkit';

export class AdminController {
    async getStats(req, res, router) {
        try {
            const db = Database.getInstance();
            const { count: totalUsers } = await db.getClient()
                .from('users')
                .select('*', { count: 'exact', head: true });

            const { count: totalTutors } = await db.getClient()
                .from('users')
                .select('*', { count: 'exact', head: true })
                .eq('is_tutor', true);

            const { count: totalSessions } = await db.getClient()
                .from('sessions')
                .select('*', { count: 'exact', head: true });

            const { count: completedSessions } = await db.getClient()
                .from('sessions')
                .select('*', { count: 'exact', head: true })
                .eq('status', 'completed');

            const { count: totalSkills } = await db.getClient()
                .from('skills')
                .select('*', { count: 'exact', head: true });

            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

            const { data: recentSessions } = await db.getClient()
                .from('sessions')
                .select('*')
                .gte('created_at', thirtyDaysAgo.toISOString())
                .order('created_at', { ascending: false })
                .limit(10);

            router.sendJson(res, {
                totalUsers: totalUsers || 0,
                totalTutors: totalTutors || 0,
                totalSessions: totalSessions || 0,
                completedSessions: completedSessions || 0,
                totalSkills: totalSkills || 0,
                recentSessions: (recentSessions || []).map(s => new Session(s).toJSON())
            });
        } catch (error) {
            console.error('Error getting stats:', error);
            router.sendJson(res, {
                totalUsers: 0,
                totalTutors: 0,
                totalSessions: 0,
                completedSessions: 0,
                totalSkills: 0,
                recentSessions: []
            }, 500);
        }
    }

    async getUsers(req, res, router) {
        try {
            const db = Database.getInstance();
            const { data: users, error } = await db.getClient()
                .from('users')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;
            router.sendJson(res, {
                users: (users || []).map(u => new User(u).toJSON())
            });
        } catch (error) {
            console.error('Error getting users:', error);
            router.sendJson(res, { users: [] }, 500);
        }
    }

    async getSessions(req, res, router) {
        try {
            const db = Database.getInstance();
            const { data: sessions, error } = await db.getClient()
                .from('sessions')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(100);

            if (error) throw error;
            router.sendJson(res, {
                sessions: (sessions || []).map(s => new Session(s).toJSON())
            });
        } catch (error) {
            console.error('Error getting sessions:', error);
            router.sendJson(res, { sessions: [] }, 500);
        }
    }

    async createSkill(req, res, router) {
        try {
            const { name, category } = req.body;
            if (!name || !category) {
                return router.sendJson(res, { error: 'Name and category are required' }, 400);
            }

            const skill = await Skill.create({ name, category });
            router.sendJson(res, { success: true, skill: skill.toJSON() });
        } catch (error) {
            console.error('Error creating skill:', error);
            router.sendJson(res, { error: error.message || 'Failed to create skill' }, 500);
        }
    }

    async deleteSkill(req, res, router) {
        try {
            const skillId = parseInt(req.body.skillId);
            if (!skillId || isNaN(skillId)) {
                return router.sendJson(res, { error: 'Valid skill ID is required' }, 400);
            }

            const success = await Skill.delete(skillId);
            if (success) {
                router.sendJson(res, { success: true, message: 'Skill deleted successfully' });
            } else {
                router.sendJson(res, { error: 'Failed to delete skill' }, 500);
            }
        } catch (error) {
            console.error('Error deleting skill:', error);
            router.sendJson(res, { error: error.message || 'Failed to delete skill' }, 500);
        }
    }

    async getAllSkills(req, res, router) {
        try {
            const skills = await Skill.findAll();
            router.sendJson(res, { skills: skills.map(s => s.toJSON()) });
        } catch (error) {
            console.error('Error getting skills:', error);
            router.sendJson(res, { skills: [] }, 500);
        }
    }

    async createDegree(req, res, router) {
        try {
            const { name } = req.body;
            if (!name) {
                return router.sendJson(res, { error: 'Name is required' }, 400);
            }

            const degree = await Degree.create({ name });
            router.sendJson(res, { success: true, degree: degree.toJSON() });
        } catch (error) {
            console.error('Error creating degree:', error);
            router.sendJson(res, { error: error.message || 'Failed to create degree' }, 500);
        }
    }

    async deleteDegree(req, res, router) {
        try {
            const degreeId = parseInt(req.body.degreeId);
            if (!degreeId || isNaN(degreeId)) {
                return router.sendJson(res, { error: 'Valid degree ID is required' }, 400);
            }

            const success = await Degree.delete(degreeId);
            if (success) {
                router.sendJson(res, { success: true, message: 'Degree deleted successfully' });
            } else {
                router.sendJson(res, { error: 'Failed to delete degree' }, 500);
            }
        } catch (error) {
            console.error('Error deleting degree:', error);
            router.sendJson(res, { error: error.message || 'Failed to delete degree' }, 500);
        }
    }

    async getAllDegrees(req, res, router) {
        try {
            const degrees = await Degree.findAll();
            router.sendJson(res, { degrees: degrees.map(d => d.toJSON()) });
        } catch (error) {
            console.error('Error getting degrees:', error);
            router.sendJson(res, { degrees: [] }, 500);
        }
    }

    async deleteUser(req, res, router) {
        try {
            const userId = parseInt(req.body.userId);
            if (!userId || isNaN(userId)) {
                return router.sendJson(res, { error: 'Valid user ID is required' }, 400);
            }

            const user = await User.findById(userId);
            if (user && user.isAdmin) {
                return router.sendJson(res, { error: 'Cannot delete admin accounts' }, 403);
            }

            const db = Database.getInstance();
            const { error } = await db.getClient()
                .from('users')
                .delete()
                .eq('id', userId);

            if (error) throw error;
            router.sendJson(res, { success: true, message: 'User deleted successfully' });
        } catch (error) {
            console.error('Error deleting user:', error);
            router.sendJson(res, { error: 'Failed to delete user' }, 500);
        }
    }

    async toggleTutorRole(req, res, router) {
        try {
            const userId = parseInt(req.body.userId);
            if (!userId || isNaN(userId)) {
                return router.sendJson(res, { error: 'Valid user ID is required' }, 400);
            }

            const user = await User.findById(userId);
            if (!user) {
                return router.sendJson(res, { error: 'User not found' }, 404);
            }

            const db = Database.getInstance();
            const { data, error } = await db.getClient()
                .from('users')
                .update({ is_tutor: !user.isTutor })
                .eq('id', userId)
                .select()
                .single();

            if (error) throw error;
            router.sendJson(res, { success: true, user: new User(data).toJSON() });
        } catch (error) {
            console.error('Error toggling tutor role:', error);
            router.sendJson(res, { error: 'Failed to update tutor role' }, 500);
        }
    }

    async adjustPoints(req, res, router) {
        try {
            const userId = parseInt(req.body.userId);
            const points = parseInt(req.body.points);

            if (!userId || isNaN(userId)) {
                return router.sendJson(res, { error: 'Valid user ID is required' }, 400);
            }

            if (isNaN(points)) {
                return router.sendJson(res, { error: 'Valid points amount is required' }, 400);
            }

            const user = await User.findById(userId);
            if (!user) {
                return router.sendJson(res, { error: 'User not found' }, 404);
            }

            const newBalance = user.pointsBalance + points;
            if (newBalance < 0) {
                return router.sendJson(res, { error: 'Points balance cannot be negative' }, 400);
            }

            const success = await User.updatePointsBalance(userId, newBalance);
            if (success) {
                router.sendJson(res, {
                    success: true,
                    newBalance,
                    message: points > 0 ? 'Points added successfully' : 'Points removed successfully'
                });
            } else {
                router.sendJson(res, { error: 'Failed to update points' }, 500);
            }
        } catch (error) {
            console.error('Error adjusting points:', error);
            router.sendJson(res, { error: 'Failed to adjust points' }, 500);
        }
    }

    async banUser(req, res, router) {
        try {
            const userId = parseInt(req.body.userId);
            const banReason = req.body.banReason || 'Your account has been banned from using SkillSwap. Please contact the administrator if you believe this is an error.';

            if (!userId || isNaN(userId)) {
                return router.sendJson(res, { error: 'Valid user ID is required' }, 400);
            }

            const user = await User.findById(userId);
            if (!user) {
                return router.sendJson(res, { error: 'User not found' }, 404);
            }

            if (user.isAdmin) {
                return router.sendJson(res, { error: 'Cannot ban admin accounts' }, 403);
            }

            const db = Database.getInstance();
            const { data, error } = await db.getClient()
                .from('users')
                .update({ banned: true, ban_reason: banReason })
                .eq('id', userId)
                .select()
                .single();

            if (error) throw error;
            router.sendJson(res, { success: true, user: new User(data).toJSON() });
        } catch (error) {
            console.error('Error banning user:', error);
            router.sendJson(res, { error: 'Failed to ban user' }, 500);
        }
    }

    async unbanUser(req, res, router) {
        try {
            const userId = parseInt(req.body.userId);
            if (!userId || isNaN(userId)) {
                return router.sendJson(res, { error: 'Valid user ID is required' }, 400);
            }

            const db = Database.getInstance();
            const { data, error } = await db.getClient()
                .from('users')
                .update({ banned: false, ban_reason: null })
                .eq('id', userId)
                .select()
                .single();

            if (error) throw error;
            router.sendJson(res, { success: true, user: new User(data).toJSON() });
        } catch (error) {
            console.error('Error unbanning user:', error);
            router.sendJson(res, { error: 'Failed to unban user' }, 500);
        }
    }

    async toggleAdminRole(req, res, router) {
        try {
            const userId = parseInt(req.body.userId);
            if (!userId || isNaN(userId)) {
                return router.sendJson(res, { error: 'Valid user ID is required' }, 400);
            }

            if (userId === parseInt(req.userId)) {
                return router.sendJson(res, { error: 'Cannot change your own admin status' }, 400);
            }

            const user = await User.findById(userId);
            if (!user) {
                return router.sendJson(res, { error: 'User not found' }, 404);
            }

            const success = await User.updateAdminStatus(userId, !user.isAdmin);
            if (success) {
                const updatedUser = await User.findById(userId);
                router.sendJson(res, { success: true, user: updatedUser.toJSON() });
            } else {
                router.sendJson(res, { error: 'Failed to update admin role' }, 500);
            }
        } catch (error) {
            console.error('Error toggling admin role:', error);
            router.sendJson(res, { error: 'Failed to update admin role' }, 500);
        }
    }

    async createAnnouncement(req, res, router) {
        try {
            const { title, content } = req.body;
            const adminId = parseInt(req.userId);

            if (!title || !content) {
                return router.sendJson(res, { error: 'Title and content are required' }, 400);
            }

            const announcement = await Announcement.create({
                title,
                content,
                createdBy: adminId,
                isActive: true
            });

            router.sendJson(res, { success: true, announcement: announcement.toJSON() });
        } catch (error) {
            console.error('Error creating announcement:', error);
            router.sendJson(res, { error: error.message || 'Failed to create announcement' }, 500);
        }
    }

    async getAnnouncements(req, res, router) {
        try {
            const announcements = await Announcement.findAll();
            router.sendJson(res, { announcements: announcements.map(a => a.toJSON()) });
        } catch (error) {
            console.error('Error getting announcements:', error);
            router.sendJson(res, { announcements: [] }, 500);
        }
    }

    async deleteAnnouncement(req, res, router) {
        try {
            const announcementId = parseInt(req.body.announcementId);
            if (!announcementId || isNaN(announcementId)) {
                return router.sendJson(res, { error: 'Valid announcement ID is required' }, 400);
            }

            const success = await Announcement.delete(announcementId);
            if (success) {
                router.sendJson(res, { success: true, message: 'Announcement deleted successfully' });
            } else {
                router.sendJson(res, { error: 'Failed to delete announcement' }, 500);
            }
        } catch (error) {
            console.error('Error deleting announcement:', error);
            router.sendJson(res, { error: 'Failed to delete announcement' }, 500);
        }
    }

    async generateAnalyticsPDF(req, res, router) {
        try {
            const db = Database.getInstance();
            const startDate = req.query.startDate ? new Date(req.query.startDate) : null;
            const endDate = req.query.endDate ? new Date(req.query.endDate + 'T23:59:59') : null;
            const reportType = req.query.reportType || 'full';

            const dateRangeText = startDate || endDate 
                ? `Date Range: ${startDate ? startDate.toLocaleDateString() : 'All time'} to ${endDate ? endDate.toLocaleDateString() : 'Now'}`
                : 'Date Range: All Time';

            let totalUsers = 0, totalTutors = 0, bannedUsers = 0;
            let totalSessions = 0, completedSessions = 0, requestedSessions = 0, scheduledSessions = 0, cancelledSessions = 0;
            let totalSkills = 0, totalReports = 0, pendingReports = 0;
            let sortedSkills = [];
            let sessionsLast30Days = 0, sessionsLast7Days = 0;

            if (reportType === 'full' || reportType === 'users') {
                let userQuery = db.getClient().from('users').select('*', { count: 'exact', head: true });
                if (startDate) userQuery = userQuery.gte('created_at', startDate.toISOString());
                if (endDate) userQuery = userQuery.lte('created_at', endDate.toISOString());
                const { count: users } = await userQuery;
                totalUsers = users || 0;

                let tutorQuery = db.getClient().from('users').select('*', { count: 'exact', head: true }).eq('is_tutor', true);
                if (startDate) tutorQuery = tutorQuery.gte('created_at', startDate.toISOString());
                if (endDate) tutorQuery = tutorQuery.lte('created_at', endDate.toISOString());
                const { count: tutors } = await tutorQuery;
                totalTutors = tutors || 0;

                const { count: banned } = await db.getClient()
                    .from('users')
                    .select('*', { count: 'exact', head: true })
                    .eq('banned', true);
                bannedUsers = banned || 0;
            }

            if (reportType === 'full' || reportType === 'sessions') {
                let sessionQuery = db.getClient().from('sessions').select('*', { count: 'exact', head: true });
                if (startDate) sessionQuery = sessionQuery.gte('created_at', startDate.toISOString());
                if (endDate) sessionQuery = sessionQuery.lte('created_at', endDate.toISOString());
                const { count: sessions } = await sessionQuery;
                totalSessions = sessions || 0;

                let completedQuery = db.getClient().from('sessions').select('*', { count: 'exact', head: true }).eq('status', 'completed');
                if (startDate) completedQuery = completedQuery.gte('created_at', startDate.toISOString());
                if (endDate) completedQuery = completedQuery.lte('created_at', endDate.toISOString());
                const { count: completed } = await completedQuery;
                completedSessions = completed || 0;

                let requestedQuery = db.getClient().from('sessions').select('*', { count: 'exact', head: true }).eq('status', 'requested');
                if (startDate) requestedQuery = requestedQuery.gte('created_at', startDate.toISOString());
                if (endDate) requestedQuery = requestedQuery.lte('created_at', endDate.toISOString());
                const { count: requested } = await requestedQuery;
                requestedSessions = requested || 0;

                let scheduledQuery = db.getClient().from('sessions').select('*', { count: 'exact', head: true }).eq('status', 'scheduled');
                if (startDate) scheduledQuery = scheduledQuery.gte('created_at', startDate.toISOString());
                if (endDate) scheduledQuery = scheduledQuery.lte('created_at', endDate.toISOString());
                const { count: scheduled } = await scheduledQuery;
                scheduledSessions = scheduled || 0;

                let cancelledQuery = db.getClient().from('sessions').select('*', { count: 'exact', head: true }).eq('status', 'cancelled');
                if (startDate) cancelledQuery = cancelledQuery.gte('created_at', startDate.toISOString());
                if (endDate) cancelledQuery = cancelledQuery.lte('created_at', endDate.toISOString());
                const { count: cancelled } = await cancelledQuery;
                cancelledSessions = cancelled || 0;

                const now = new Date();
                const last30Days = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
                const last7Days = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

                const { count: s30 } = await db.getClient()
                    .from('sessions')
                    .select('*', { count: 'exact', head: true })
                    .gte('created_at', last30Days.toISOString());
                sessionsLast30Days = s30 || 0;

                const { count: s7 } = await db.getClient()
                    .from('sessions')
                    .select('*', { count: 'exact', head: true })
                    .gte('created_at', last7Days.toISOString());
                sessionsLast7Days = s7 || 0;
            }

            if (reportType === 'full' || reportType === 'skills') {
                const { count: skills } = await db.getClient()
                    .from('skills')
                    .select('*', { count: 'exact', head: true });
                totalSkills = skills || 0;

                const { data: allSkills } = await db.getClient()
                    .from('skills')
                    .select('id, name');
                
                const skillNameMap = {};
                (allSkills || []).forEach(skill => {
                    skillNameMap[skill.id] = skill.name;
                });

                let skillStatsQuery = db.getClient().from('sessions').select('skill_id').not('skill_id', 'is', null);
                if (startDate) skillStatsQuery = skillStatsQuery.gte('created_at', startDate.toISOString());
                if (endDate) skillStatsQuery = skillStatsQuery.lte('created_at', endDate.toISOString());
                const { data: skillStats } = await skillStatsQuery;

                const skillCounts = {};
                (skillStats || []).forEach(s => {
                    skillCounts[s.skill_id] = (skillCounts[s.skill_id] || 0) + 1;
                });

                sortedSkills = Object.entries(skillCounts)
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, 10)
                    .map(([skillId, count]) => ({
                        id: skillId,
                        name: skillNameMap[skillId] || `Unknown Skill`,
                        count: count
                    }));
            }

            if (reportType === 'full') {
                const { count: reports } = await db.getClient()
                    .from('reports')
                    .select('*', { count: 'exact', head: true });
                totalReports = reports || 0;

                const { count: pending } = await db.getClient()
                    .from('reports')
                    .select('*', { count: 'exact', head: true })
                    .eq('status', 'pending');
                pendingReports = pending || 0;
            }

            const doc = new PDFDocument({ margin: 40, size: 'A4' });

            res.writeHead(200, {
                'Content-Type': 'application/pdf',
                'Content-Disposition': `attachment; filename="skillswap-analytics-${new Date().toISOString().split('T')[0]}.pdf"`
            });

            doc.pipe(res);

            const colors = {
                primary: '#10B981',
                primaryDark: '#047857',
                secondary: '#14B8A6',
                success: '#22C55E',
                warning: '#F59E0B',
                danger: '#EF4444',
                info: '#3B82F6',
                gray: '#6B7280',
                grayLight: '#E5E7EB',
                grayDark: '#374151',
                white: '#FFFFFF',
                background: '#F0FDF4'
            };

            const pageWidth = doc.page.width - 80;
            const leftMargin = 40;

            const drawHeader = () => {
                doc.rect(0, 0, doc.page.width, 120).fill(colors.primary);
                
                doc.fillColor(colors.white)
                   .fontSize(28)
                   .font('Helvetica-Bold')
                   .text('SkillSwap Analytics Report', leftMargin, 35);
                
                doc.fontSize(12)
                   .font('Helvetica')
                   .fillColor(colors.white)
                   .text(`Generated: ${new Date().toLocaleString()}`, leftMargin, 75);
                
                doc.text(dateRangeText, leftMargin, 93);
            };

            const drawStatCard = (x, y, width, height, label, value, color) => {
                doc.rect(x, y, width, height).fill(colors.white);
                doc.rect(x, y, width, height).lineWidth(1).stroke(colors.grayLight);
                doc.rect(x, y, 5, height).fill(color);
                
                doc.fillColor(colors.gray)
                   .fontSize(9)
                   .font('Helvetica')
                   .text(label.toUpperCase(), x + 12, y + 10, { width: width - 20 });
                
                doc.fillColor(color)
                   .fontSize(22)
                   .font('Helvetica-Bold')
                   .text(value.toString(), x + 12, y + 28, { width: width - 20 });
            };

            const drawSectionHeader = (title, yPos) => {
                doc.rect(leftMargin, yPos, pageWidth, 28).fill(colors.primaryDark);
                doc.fillColor(colors.white)
                   .fontSize(13)
                   .font('Helvetica-Bold')
                   .text(title, leftMargin + 12, yPos + 8);
                return yPos + 38;
            };

            const drawBarChart = (x, y, data, maxWidth, barHeight, labelWidth = 100) => {
                const maxValue = Math.max(...data.map(d => d.value), 1);
                let currentY = y;
                const barStartX = x + labelWidth + 10;
                
                data.forEach((item) => {
                    const barWidth = (item.value / maxValue) * maxWidth;
                    
                    doc.fillColor(colors.grayDark)
                       .fontSize(10)
                       .font('Helvetica')
                       .text(item.label, x, currentY + 2, { width: labelWidth, align: 'left' });
                    
                    doc.rect(barStartX, currentY, Math.max(barWidth, 4), barHeight - 6)
                       .fill(item.color || colors.primary);
                    
                    doc.fillColor(colors.gray)
                       .fontSize(9)
                       .text(`${item.value}`, barStartX + Math.max(barWidth, 4) + 8, currentY + 3);
                    
                    currentY += barHeight;
                });
                
                return currentY;
            };

            const drawSimplePieChart = (x, y, data) => {
                const total = data.reduce((sum, d) => sum + d.value, 0);
                if (total === 0) return y + 80;
                
                let currentY = y;
                const barMaxWidth = 150;
                
                data.forEach((item) => {
                    if (item.value === 0) return;
                    const percentage = ((item.value / total) * 100).toFixed(1);
                    const barWidth = (item.value / total) * barMaxWidth;
                    
                    doc.rect(x, currentY, 12, 12).fill(item.color);
                    
                    doc.fillColor(colors.grayDark)
                       .fontSize(10)
                       .font('Helvetica')
                       .text(`${item.label}:`, x + 18, currentY + 1);
                    
                    doc.rect(x + 80, currentY + 2, barWidth, 10).fill(item.color);
                    
                    doc.fillColor(colors.gray)
                       .fontSize(9)
                       .text(`${item.value} (${percentage}%)`, x + 85 + barWidth, currentY + 2);
                    
                    currentY += 22;
                });
                
                return currentY + 10;
            };

            drawHeader();
            let currentY = 135;

            if (reportType === 'full' || reportType === 'users') {
                currentY = drawSectionHeader('User Statistics', currentY);
                
                const cardWidth = (pageWidth - 30) / 4;
                drawStatCard(leftMargin, currentY, cardWidth, 55, 'Total Users', totalUsers, colors.primary);
                drawStatCard(leftMargin + cardWidth + 10, currentY, cardWidth, 55, 'Tutors', totalTutors, colors.success);
                drawStatCard(leftMargin + (cardWidth + 10) * 2, currentY, cardWidth, 55, 'Students', totalUsers - totalTutors, colors.info);
                drawStatCard(leftMargin + (cardWidth + 10) * 3, currentY, cardWidth, 55, 'Banned', bannedUsers, colors.danger);
                
                currentY += 70;
                
                if (totalUsers > 0) {
                    doc.fillColor(colors.grayDark)
                       .fontSize(11)
                       .font('Helvetica-Bold')
                       .text('User Distribution', leftMargin, currentY);
                    currentY += 18;
                    
                    const pieData = [
                        { label: 'Tutors', value: totalTutors, color: colors.success },
                        { label: 'Students', value: totalUsers - totalTutors, color: colors.info },
                        { label: 'Banned', value: bannedUsers, color: colors.danger }
                    ];
                    
                    currentY = drawSimplePieChart(leftMargin, currentY, pieData);
                }
            }

            if (reportType === 'full' || reportType === 'sessions') {
                if (currentY > 580) {
                    doc.addPage();
                    currentY = 50;
                }
                
                currentY = drawSectionHeader('Session Statistics', currentY);
                
                const cardWidth = (pageWidth - 20) / 3;
                drawStatCard(leftMargin, currentY, cardWidth, 55, 'Total Sessions', totalSessions, colors.primary);
                drawStatCard(leftMargin + cardWidth + 10, currentY, cardWidth, 55, 'Last 30 Days', sessionsLast30Days, colors.info);
                drawStatCard(leftMargin + (cardWidth + 10) * 2, currentY, cardWidth, 55, 'Last 7 Days', sessionsLast7Days, colors.secondary);
                
                currentY += 70;
                
                doc.fillColor(colors.grayDark)
                   .fontSize(11)
                   .font('Helvetica-Bold')
                   .text('Session Status Breakdown', leftMargin, currentY);
                currentY += 18;
                
                const sessionData = [
                    { label: 'Completed', value: completedSessions, color: colors.success },
                    { label: 'Scheduled', value: scheduledSessions, color: colors.info },
                    { label: 'Requested', value: requestedSessions, color: colors.warning },
                    { label: 'Cancelled', value: cancelledSessions, color: colors.danger }
                ];
                
                currentY = drawBarChart(leftMargin, currentY, sessionData, 200, 26, 80);
                currentY += 15;
                
                const completionRate = totalSessions > 0 ?
                    (completedSessions / totalSessions * 100).toFixed(1) : '0.0';
                
                doc.rect(leftMargin, currentY, pageWidth, 45).fill(colors.background);
                doc.fillColor(colors.primaryDark)
                   .fontSize(11)
                   .font('Helvetica-Bold')
                   .text('Completion Rate', leftMargin + 12, currentY + 8);
                doc.fontSize(20)
                   .text(`${completionRate}%`, leftMargin + 12, currentY + 22);
                
                const progressWidth = pageWidth - 140;
                const progressX = leftMargin + 120;
                doc.rect(progressX, currentY + 18, progressWidth, 14).fill(colors.grayLight);
                const filledWidth = Math.max((parseFloat(completionRate) / 100) * progressWidth, 0);
                if (filledWidth > 0) {
                    doc.rect(progressX, currentY + 18, filledWidth, 14).fill(colors.success);
                }
                
                currentY += 60;
            }

            if (reportType === 'full' || reportType === 'skills') {
                if (currentY > 520) {
                    doc.addPage();
                    currentY = 50;
                }
                
                currentY = drawSectionHeader('Skills Statistics', currentY);
                
                drawStatCard(leftMargin, currentY, 140, 55, 'Total Skills', totalSkills, colors.secondary);
                currentY += 70;
                
                if (sortedSkills.length > 0) {
                    doc.fillColor(colors.grayDark)
                       .fontSize(11)
                       .font('Helvetica-Bold')
                       .text('Top Skills by Session Count', leftMargin, currentY);
                    currentY += 18;
                    
                    const skillData = sortedSkills.map((skill, index) => ({
                        label: skill.name,
                        value: skill.count,
                        color: index === 0 ? colors.primary : 
                               index === 1 ? colors.secondary : 
                               index === 2 ? colors.success : colors.info
                    }));
                    
                    currentY = drawBarChart(leftMargin, currentY, skillData, 180, 22, 140);
                    currentY += 15;
                }
            }

            if (reportType === 'full') {
                if (currentY > 550) {
                    doc.addPage();
                    currentY = 50;
                }
                
                currentY = drawSectionHeader('Reports & Moderation', currentY);
                
                const cardWidth = (pageWidth - 10) / 2;
                drawStatCard(leftMargin, currentY, cardWidth, 55, 'Total Reports', totalReports, colors.warning);
                drawStatCard(leftMargin + cardWidth + 10, currentY, cardWidth, 55, 'Pending Review', pendingReports, colors.danger);
                
                currentY += 75;
                
                currentY = drawSectionHeader('Executive Summary', currentY);
                
                doc.rect(leftMargin, currentY, pageWidth, 80).fill(colors.background);
                
                const completionRateVal = totalSessions > 0 ?
                    (completedSessions / totalSessions * 100).toFixed(1) : '0.0';
                
                const summaryItems = [
                    { label: 'Platform Health', value: bannedUsers === 0 ? 'Excellent' : bannedUsers < 5 ? 'Good' : 'Attention', color: bannedUsers === 0 ? colors.success : colors.warning },
                    { label: 'Success Rate', value: `${completionRateVal}%`, color: parseFloat(completionRateVal) > 70 ? colors.success : colors.warning },
                    { label: 'Active Tutors', value: totalTutors.toString(), color: colors.info },
                    { label: 'Pending Actions', value: pendingReports.toString(), color: pendingReports > 0 ? colors.danger : colors.success }
                ];
                
                let summaryX = leftMargin + 15;
                const summaryWidth = (pageWidth - 40) / 4;
                
                summaryItems.forEach(item => {
                    doc.fillColor(colors.gray)
                       .fontSize(8)
                       .font('Helvetica')
                       .text(item.label.toUpperCase(), summaryX, currentY + 12, { width: summaryWidth });
                    doc.fillColor(item.color)
                       .fontSize(18)
                       .font('Helvetica-Bold')
                       .text(item.value, summaryX, currentY + 30, { width: summaryWidth });
                    summaryX += summaryWidth;
                });
                
                currentY += 100;
            }

            const footerY = doc.page.height - 35;
            doc.rect(0, footerY - 8, doc.page.width, 45).fill(colors.grayLight);
            doc.fillColor(colors.gray)
               .fontSize(8)
               .font('Helvetica')
               .text('SkillSwap Analytics Report | Confidential', leftMargin, footerY);
            doc.text('University of the West Indies - Irvine Hall Mentorship Program', leftMargin, footerY + 12);

            doc.end();
        } catch (error) {
            console.error('Error generating analytics PDF:', error);
            router.sendJson(res, { error: 'Failed to generate analytics report' }, 500);
        }
    }
}
