import { ValidationError } from './../error/error-type/ValidationError';
import { IReviewModel } from './../model/reviewModel';
import { Application, NextFunction, Request, Response } from 'express';
import { ReviewService } from './../service/reviewService';
import { Channel } from 'amqplib';
import subscribeMessage from './../message-queue/pub-sub/subscribeMessage';
import EventType from './../types/eventType';
import { PRODUCT_SERVICE } from '../config';
import publishMessage from './../message-queue/pub-sub/publishMessage';

export default (app: Application, channel: Channel) => {
    const reviewService = new ReviewService();

    subscribeMessage(channel, reviewService);

    app.get('/review/all', async (_, res, next) => {
        try {
            const reviews = await reviewService.getAllReviews();
            return res.status(200).json(reviews);
        } catch (error) {
            next(error);
            return;
        }
    });
    // Get all reviews for a product by product id in query of request
    app.get(
        '/review/api/reviews',
        async (req: Request, res: Response, next: NextFunction) => {
            try {
                const productId = req.query.productId as string;
                if (!productId) {
                    throw new ValidationError('Missing productId in query');
                }

                const reviews = await reviewService.getReviewsByProductId(
                    productId
                );
                return res.status(200).json(reviews);
            } catch (error) {
                next(error);
                return;
            }
        }
    );

    app.get(
        '/review/getByProductId/:id',
        async (_: Request, res: Response, next: NextFunction) => {
            try {
                const { id: productId } = _.params;
                if (!productId) {
                    throw new ValidationError('Missing productId in query');
                }

                const reviews = await reviewService.getReviewsByProductId(
                    productId
                );
                return res.status(200).json(reviews);
            } catch (error) {
                console.log('Error in getReviewsByProductId', error);
                next(error);
                return;
            }
        }
    );

    // Get comment of user for a product
    app.get(
        '/review/reviewOfUserForProduct',
        async (req: Request, res: Response, next: NextFunction) => {
            try {
                const { productId, userId } = req.query;
                if (!productId || !userId) {
                    throw new ValidationError(
                        'Missing productId or userId in query'
                    );
                }
                const review = await reviewService.getReviewByProductIdAndUserId(productId as string, userId as string);
                return res.status(200).json(review);
            } catch (error) {
                next(error);
                return;
            }
        }
    );  

    app.post(
        '/review/create',
        async (req: Request, res: Response, next: NextFunction) => {
            try {
                const { id, productId, rating, comment, userId } = req.body;
                const review = {
                    productId,
                    rating,
                    comment,
                } as IReviewModel;
                if (!id || !review) {
                    throw new ValidationError('Missing review or id in body');
                }
                if (review && userId) {
                    // const newReview = await reviewService.createReview(
                    //     review,
                    //     userId
                    // );
    
                    const updatedReview = await reviewService.updateReview(
                        id,
                        review
                    );
                    if (!updatedReview) {
                        throw new ValidationError('Review not found');
                    }
                    // Publish message to product service
                    await publishReviewEvent(updatedReview.productId, EventType.CREATE_REVIEW);

                    return res.status(200).json(updatedReview);
                } else {
                    throw new ValidationError(
                        'Missing review or authorId in body'
                    );
                }
            } catch (error) {
                console.log('Error in create review', error);
                next(error);
                return;
            }
        }
    );

    app.put(
        '/review/update/:id',
        async (req: Request, res: Response, next: NextFunction) => {
            try {
                const { id } = req.params;
                const { rating, comment } = req.body;
                if (!id || !rating || !comment) {
                    throw new ValidationError('Missing review or id in body');
                }

                const updatedReview = await reviewService.updateReviewContent(
                    id,
                    rating,
                    comment
                );
                // Publish message to product service
                await publishReviewEvent(updatedReview.productId, EventType.CREATE_REVIEW);
                return res.status(200).json(updatedReview);
            } catch (error) {
                console.log('Error in update review', error);
                next(error);
                return;
            }
        }
    );

    app.delete(
        '/review/delete/:id',
        async (req: Request, res: Response, next: NextFunction) => {
            try {
                const { id } = req.params;
                if (!id) {
                    throw new ValidationError('Missing id in body');
                }

                const deletedReview = await reviewService.deleteReview(id);

                // publish the review event to product service
                await publishReviewEvent(
                    deletedReview?.id!,
                    EventType.DELETE_REVIEW
                );
                
                return res.status(200).json(deletedReview);
            } catch (error) {
                console.log('Error in delete review', error);
                next(error);
                return;
            }
        }
    );

    app.delete(
        '/review/deleteByProductId/:id',
        async (req: Request, res: Response, next: NextFunction) => {
            try {
                const { id } = req.params;
                if (!id) {
                    throw new ValidationError('Missing product id in body');
                }

                const deletedReviews =
                    await reviewService.deleteReviewsByProductId(id);
                return res.status(200).json(deletedReviews);
            } catch (error) {
                console.log('Error in delete reviews by product id', error);
                next(error);
                return;
            }
        }
    );

    app.delete(
        '/review/deleteByAuthorId/:id',
        async (req: Request, res: Response, next: NextFunction) => {
            try {
                const { id } = req.params;
                if (!id) {
                    throw new ValidationError('Missing author id in body');
                }

                const deletedReviews =
                    await reviewService.deleteReviewsByUserId(id);
                res.status(200).json(deletedReviews);
            } catch (error) {
                console.log('Error in delete reviews by author id', error);
                next(error);
                return;
            }
        }
    );

    async function publishReviewEvent(productId: string, eventType: string) {
        const { averageRating, reviewCount } =
            await reviewService.getReviewAnalysisByProductId(productId);
        const payload = {
            event: eventType,
            data: {
                productId,
                averageRating,
                reviewCount,
            },
        };
        await publishMessage(channel, PRODUCT_SERVICE, payload);
    }
};
