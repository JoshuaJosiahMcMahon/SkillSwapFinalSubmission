import { Review } from '../models/Review.js';
import { Session } from '../models/Session.js';

export class ReviewController {
    async createReview(req, res, router) {
        try {
            const userId = parseInt(req.userId);
            const { sessionId, rating, comment } = req.body;

            if (!sessionId || !rating) {
                return router.sendJson(res, {
                    success: false,
                    error: 'Session ID and rating are required'
                }, 400);
            }

            if (rating < 1 || rating > 5) {
                return router.sendJson(res, {
                    success: false,
                    error: 'Rating must be between 1 and 5'
                }, 400);
            }

            const session = await Session.findById(parseInt(sessionId));
            if (!session) {
                return router.sendJson(res, {
                    success: false,
                    error: 'Session not found'
                }, 404);
            }

            if (session.status !== 'completed') {
                return router.sendJson(res, {
                    success: false,
                    error: 'Can only rate completed sessions'
                }, 400);
            }

            if (session.tuteeId !== userId) {
                return router.sendJson(res, {
                    success: false,
                    error: 'Only the student (tutee) can rate this session'
                }, 403);
            }

            const revieweeId = session.tutorId;

            const existingReview = await Review.findBySessionAndReviewer(parseInt(sessionId), userId);
            if (existingReview) {
                return router.sendJson(res, {
                    success: false,
                    error: 'You have already reviewed this session'
                }, 400);
            }

            const review = await Review.create({
                sessionId: parseInt(sessionId),
                reviewerId: userId,
                revieweeId: revieweeId,
                rating: parseInt(rating),
                comment: comment ? comment.trim() : null
            });

            router.sendJson(res, {
                success: true,
                review: review.toJSON()
            });
        } catch (error) {
            console.error('Error creating review:', error);
            router.sendJson(res, {
                success: false,
                error: error.message || 'Failed to create review'
            }, 500);
        }
    }

    async getReviews(req, res, router) {
        try {
            const userId = parseInt(req.query.userId);

            if (!userId) {
                return router.sendJson(res, {
                    error: 'User ID is required'
                }, 400);
            }

            const reviews = await Review.findByReviewee(userId);
            const ratingStats = await Review.getAverageRating(userId);

            router.sendJson(res, {
                reviews: reviews.map(r => r.toJSON()),
                averageRating: ratingStats.averageRating,
                totalReviews: ratingStats.totalReviews
            });
        } catch (error) {
            console.error('Error getting reviews:', error);
            router.sendJson(res, { error: 'Failed to retrieve reviews' }, 500);
        }
    }

    async getRatingStats(req, res, router) {
        try {
            const userId = parseInt(req.query.userId);

            if (!userId) {
                return router.sendJson(res, {
                    error: 'User ID is required'
                }, 400);
            }

            const ratingStats = await Review.getAverageRating(userId);
            router.sendJson(res, ratingStats);
        } catch (error) {
            console.error('Error getting rating stats:', error);
            router.sendJson(res, { averageRating: 0, totalReviews: 0 }, 500);
        }
    }

    async deleteReview(req, res, router) {
        try {
            const userId = parseInt(req.userId);
            const { reviewId } = req.body;

            if (!reviewId) {
                return router.sendJson(res, {
                    success: false,
                    error: 'Review ID is required'
                }, 400);
            }

            const review = await Review.findById(parseInt(reviewId));
            if (!review) {
                return router.sendJson(res, {
                    success: false,
                    error: 'Review not found'
                }, 404);
            }

            if (review.reviewerId !== userId) {
                return router.sendJson(res, {
                    success: false,
                    error: 'You can only delete your own reviews'
                }, 403);
            }

            await Review.delete(parseInt(reviewId));

            router.sendJson(res, {
                success: true,
                message: 'Review deleted successfully'
            });
        } catch (error) {
            console.error('Error deleting review:', error);
            router.sendJson(res, {
                success: false,
                error: error.message || 'Failed to delete review'
            }, 500);
        }
    }

    async getMyReviews(req, res, router) {
        try {
            const userId = parseInt(req.userId);
            const reviews = await Review.findByReviewer(userId);

            router.sendJson(res, {
                reviews: reviews.map(r => r.toJSON())
            });
        } catch (error) {
            console.error('Error getting my reviews:', error);
            router.sendJson(res, { error: 'Failed to retrieve reviews' }, 500);
        }
    }
}
