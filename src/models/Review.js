import { Database } from '../config/database.js';

export class Review {
    constructor(data = {}) {
        this.id = data.id || null;
        this.sessionId = data.session_id || data.sessionId || null;
        this.reviewerId = data.reviewer_id || data.reviewerId || null;
        this.revieweeId = data.reviewee_id || data.revieweeId || null;
        this.rating = data.rating || null;
        this.comment = data.comment || null;
        this.createdAt = data.created_at || data.createdAt || null;
    }

    validate() {
        const errors = [];

        if (!this.sessionId) {
            errors.push('Session ID is required');
        }

        if (!this.reviewerId) {
            errors.push('Reviewer ID is required');
        }

        if (!this.revieweeId) {
            errors.push('Reviewee ID is required');
        }

        if (!this.rating || this.rating < 1 || this.rating > 5) {
            errors.push('Rating must be between 1 and 5');
        }

        return {
            valid: errors.length === 0,
            errors
        };
    }

    static async create(reviewData) {
        try {
            const review = new Review(reviewData);
            const validation = review.validate();

            if (!validation.valid) {
                throw new Error(validation.errors.join(', '));
            }

            const db = Database.getInstance();
            const { data, error } = await db.getClient()
                .from('reviews')
                .insert({
                    session_id: review.sessionId,
                    reviewer_id: review.reviewerId,
                    reviewee_id: review.revieweeId,
                    rating: review.rating,
                    comment: review.comment || null
                })
                .select()
                .single();

            if (error) throw error;
            return new Review(data);
        } catch (error) {
            console.error('Error creating review:', error);
            throw error;
        }
    }

    static async findBySessionAndReviewer(sessionId, reviewerId) {
        try {
            const db = Database.getInstance();
            const { data, error } = await db.getClient()
                .from('reviews')
                .select('*')
                .eq('session_id', sessionId)
                .eq('reviewer_id', reviewerId)
                .single();

            if (error && error.code !== 'PGRST116') throw error;
            return data ? new Review(data) : null;
        } catch (error) {
            console.error('Error finding review:', error);
            return null;
        }
    }

    static async findByReviewee(userId) {
        try {
            const db = Database.getInstance();
            const { data, error } = await db.getClient()
                .from('reviews')
                .select('*')
                .eq('reviewee_id', userId)
                .order('created_at', { ascending: false });

            if (error) throw error;
            return (data || []).map(item => new Review(item));
        } catch (error) {
            console.error('Error finding reviews:', error);
            return [];
        }
    }

    static async getAverageRating(userId) {
        try {
            const db = Database.getInstance();
            const { data, error } = await db.getClient()
                .from('reviews')
                .select('rating')
                .eq('reviewee_id', userId);

            if (error) throw error;

            if (!data || data.length === 0) {
                return { averageRating: 0, totalReviews: 0 };
            }

            const totalRating = data.reduce((sum, review) => sum + review.rating, 0);
            const averageRating = totalRating / data.length;

            return {
                averageRating: Math.round(averageRating * 10) / 10,
                totalReviews: data.length
            };
        } catch (error) {
            console.error('Error getting average rating:', error);
            return { averageRating: 0, totalReviews: 0 };
        }
    }

    static async findById(reviewId) {
        try {
            const db = Database.getInstance();
            const { data, error } = await db.getClient()
                .from('reviews')
                .select('*')
                .eq('id', reviewId)
                .single();

            if (error && error.code !== 'PGRST116') throw error;
            return data ? new Review(data) : null;
        } catch (error) {
            console.error('Error finding review:', error);
            return null;
        }
    }

    static async delete(reviewId) {
        try {
            const db = Database.getInstance();
            const { error } = await db.getClient()
                .from('reviews')
                .delete()
                .eq('id', reviewId);

            if (error) throw error;
            return true;
        } catch (error) {
            console.error('Error deleting review:', error);
            throw error;
        }
    }

    static async findByReviewer(userId) {
        try {
            const db = Database.getInstance();
            const { data, error } = await db.getClient()
                .from('reviews')
                .select('*')
                .eq('reviewer_id', userId)
                .order('created_at', { ascending: false });

            if (error) throw error;
            return (data || []).map(item => new Review(item));
        } catch (error) {
            console.error('Error finding reviews by reviewer:', error);
            return [];
        }
    }

    toJSON() {
        return {
            id: this.id,
            sessionId: this.sessionId,
            reviewerId: this.reviewerId,
            revieweeId: this.revieweeId,
            rating: this.rating,
            comment: this.comment,
            createdAt: this.createdAt
        };
    }
}
