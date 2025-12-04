import { Database } from '../config/database.js';

export class Message {
    constructor(data = {}) {
        this.id = data.id || null;
        this.senderId = data.sender_id || data.senderId || null;
        this.receiverId = data.receiver_id || data.receiverId || null;
        this.content = data.content || '';
        this.read = data.read || false;
        this.createdAt = data.created_at || data.createdAt || null;
    }

    validate() {
        const errors = [];

        if (!this.senderId) {
            errors.push('Sender ID is required');
        }

        if (!this.receiverId) {
            errors.push('Receiver ID is required');
        }

        if (this.senderId === this.receiverId) {
            errors.push('Cannot send message to yourself');
        }

        if (!this.content || this.content.trim().length === 0) {
            errors.push('Message content is required');
        }

        if (this.content && this.content.length > 5000) {
            errors.push('Message content cannot exceed 5000 characters');
        }

        return {
            valid: errors.length === 0,
            errors
        };
    }

    static async create(messageData) {
        try {
            const message = new Message(messageData);
            const validation = message.validate();

            if (!validation.valid) {
                throw new Error(validation.errors.join(', '));
            }

            const db = Database.getInstance();
            const { data, error } = await db.getClient()
                .from('messages')
                .insert({
                    sender_id: message.senderId,
                    receiver_id: message.receiverId,
                    content: message.content.trim()
                })
                .select()
                .single();

            if (error) throw error;
            return new Message(data);
        } catch (error) {
            console.error('Error creating message:', error);
            throw error;
        }
    }

    static async getConversation(userId1, userId2) {
        try {
            const db = Database.getInstance();
            const { data, error } = await db.getClient()
                .from('messages')
                .select('*')
                .or(`and(sender_id.eq.${userId1},receiver_id.eq.${userId2}),and(sender_id.eq.${userId2},receiver_id.eq.${userId1})`)
                .order('created_at', { ascending: true });

            if (error) throw error;
            return (data || []).map(item => new Message(item));
        } catch (error) {
            console.error('Error getting conversation:', error);
            return [];
        }
    }

    static async getConversations(userId) {
        try {
            const db = Database.getInstance();

            const { data: allMessages, error: messagesError } = await db.getClient()
                .from('messages')
                .select('sender_id, receiver_id, created_at, read')
                .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
                .order('created_at', { ascending: false });

            if (messagesError) throw messagesError;

            const partners = new Map();

            (allMessages || []).forEach(msg => {
                const partnerId = msg.sender_id === userId ? msg.receiver_id : msg.sender_id;
                const existing = partners.get(partnerId);

                if (!existing || new Date(msg.created_at) > new Date(existing.lastMessage)) {
                    partners.set(partnerId, {
                        userId: partnerId,
                        lastMessage: msg.created_at,
                        unreadCount: (msg.receiver_id === userId && msg.read === false) ? 1 : 0
                    });
                } else if (msg.receiver_id === userId && msg.read === false) {
                    existing.unreadCount = (existing.unreadCount || 0) + 1;
                }
            });

            return Array.from(partners.values());
        } catch (error) {
            console.error('Error getting conversations:', error);
            return [];
        }
    }

    static async markAsRead(userId, otherUserId) {
        try {
            const db = Database.getInstance();
            const { error } = await db.getClient()
                .from('messages')
                .update({ read: true })
                .eq('receiver_id', userId)
                .eq('sender_id', otherUserId)
                .eq('read', false);

            if (error) throw error;
            return true;
        } catch (error) {
            console.error('Error marking messages as read:', error);
            return false;
        }
    }

    static async getUnreadCount(userId) {
        try {
            const db = Database.getInstance();
            const { count, error } = await db.getClient()
                .from('messages')
                .select('*', { count: 'exact', head: true })
                .eq('receiver_id', userId)
                .eq('read', false);

            if (error) throw error;
            return count || 0;
        } catch (error) {
            console.error('Error getting unread count:', error);
            return 0;
        }
    }

    toJSON() {
        return {
            id: this.id,
            senderId: this.senderId,
            receiverId: this.receiverId,
            content: this.content,
            read: this.read,
            createdAt: this.createdAt
        };
    }
}
