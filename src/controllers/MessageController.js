import { Message } from '../models/Message.js';
import { User } from '../models/User.js';

export class MessageController {
    async sendMessage(req, res, router) {
        try {
            const userId = parseInt(req.userId);
            const { receiverId, content } = req.body;

            if (!receiverId || !content) {
                return router.sendJson(res, {
                    success: false,
                    error: 'Receiver ID and message content are required'
                }, 400);
            }

            const receiver = await User.findById(parseInt(receiverId));
            if (!receiver) {
                return router.sendJson(res, {
                    success: false,
                    error: 'Receiver not found'
                }, 404);
            }

            if (userId === parseInt(receiverId)) {
                return router.sendJson(res, {
                    success: false,
                    error: 'Cannot send message to yourself'
                }, 400);
            }

            const message = await Message.create({
                senderId: userId,
                receiverId: parseInt(receiverId),
                content: content.trim()
            });

            router.sendJson(res, {
                success: true,
                message: message.toJSON()
            });
        } catch (error) {
            console.error('Error sending message:', error);
            router.sendJson(res, {
                success: false,
                error: error.message || 'Failed to send message'
            }, 500);
        }
    }

    async getConversation(req, res, router) {
        try {
            const userId = parseInt(req.userId);
            const otherUserId = parseInt(req.query.userId);

            if (!otherUserId) {
                return router.sendJson(res, {
                    error: 'User ID is required'
                }, 400);
            }

            const messages = await Message.getConversation(userId, otherUserId);

            await Message.markAsRead(userId, otherUserId);

            router.sendJson(res, {
                messages: messages.map(m => m.toJSON())
            });
        } catch (error) {
            console.error('Error getting conversation:', error);
            router.sendJson(res, { error: 'Failed to retrieve conversation' }, 500);
        }
    }

    async getConversations(req, res, router) {
        try {
            const userId = parseInt(req.userId);
            const conversations = await Message.getConversations(userId);

            const enriched = await Promise.all(
                conversations.map(async (conv) => {
                    try {
                        const user = await User.findById(conv.userId);
                        return {
                            ...conv,
                            user: user ? user.toJSON() : null
                        };
                    } catch (err) {
                        console.error(`Error fetching user ${conv.userId} for conversation:`, err);
                        return {
                            ...conv,
                            user: null
                        };
                    }
                })
            );

            router.sendJson(res, {
                conversations: enriched
            });
        } catch (error) {
            console.error('Error getting conversations:', error);
            router.sendJson(res, { error: 'Failed to retrieve conversations' }, 500);
        }
    }

    async getUnreadCount(req, res, router) {
        try {
            const userId = parseInt(req.userId);
            const count = await Message.getUnreadCount(userId);
            router.sendJson(res, { count });
        } catch (error) {
            console.error('Error getting unread count:', error);
            router.sendJson(res, { count: 0 }, 500);
        }
    }
}
