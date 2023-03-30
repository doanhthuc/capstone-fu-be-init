import { UserRoleType } from './../types/auth';
import { IWishlistItemModel } from './../model/wishlistModel';
import { AuthorizeError } from './../error/error-type/AuthorizedError';
import { Application } from 'express';
import { WishlistService } from './../service/WishlistService';
import { decodeTokenInRequest } from './../middleware/auth';

export default (app: Application) => {
    const wishlistService = new WishlistService();

    app.get('/shopping/wishlist/all', async (req, res, next) => {
        try {
            const decodedToken = decodeTokenInRequest(req);
            if (decodedToken.role !== UserRoleType.ADMIN) {
                throw new AuthorizeError(
                    'User have no permission to perform this action'
                );
            }
            return res.status(200).json(await wishlistService.getAllWishlists());   
        } catch (error) {
            next(error);
            return;
        }
    });

    app.get('/shopping/wishlist/', async (req, res, next) => {
        try {
            const userId = req.query.userId as string;
            if (!userId) {
                throw new Error('Missing userId in query');
            }
            const decodedToken = decodeTokenInRequest(req);
            if (decodedToken.userId !== userId && decodedToken.role !== UserRoleType.ADMIN) {
                throw new AuthorizeError(
                    'User is not authorized to get wishlist'
                );
            }
            const wishlist = await wishlistService.getWishlistByUserId(userId);
            return res.status(200).json(wishlist);
        } catch (error) {
            next(error);
            return;
        }
    });

    app.get('/shopping/checkItemInWishlist', async (req, res, next) => {
        try {
            const { userId, productId } = req.query as {
                userId: string;
                productId: string;
            };
            if (!userId || !productId) {
                throw new Error('Missing userId or productId in query');
            }
            const isExisting = await wishlistService.checkItemInWishlist(userId, productId); 
            return res.status(200).json(isExisting);
        } catch (error) {
            next(error);
            return;
        }
    });

    app.put('/shopping/toggleAddItemToWishlist', async (req, res, next) => {
        try {
            const { userId, item } = req.body as {
                userId: string;
                item: IWishlistItemModel;
            };
            if (!userId || !item) {
                throw new Error('Missing userId or itemDTO in request body');
            }
            const decodedToken = decodeTokenInRequest(req);
            if (decodedToken.userId !== userId) {
                throw new AuthorizeError(
                    'User is not authorized to get wishlist'
                );
            }
            const newCart = await wishlistService.toggleAddItemToWishlist(
                userId,
                item
            );
            return res.status(200).json(newCart);
        } catch (error) {
            next(error);
            return;
        }
    });

    app.put('/shopping/removeFromWishlist', async (req, res, next) => {
        try {
            const { userId, productId } = req.body as {
                userId: string;
                productId: string;
            };
            if (!userId || !productId) {
                throw new Error('Missing userId or itemDTO in request body');
            }
            const updatedWishlist = await wishlistService.removeItemFromWishlist(
                userId,
                productId
            );
            return res.status(200).json(updatedWishlist);
        } catch (error) {
            next(error);
            return;
        }
    });
};
