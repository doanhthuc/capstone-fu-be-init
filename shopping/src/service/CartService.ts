import { RPCTypes } from './../types/rpcType';
import { IItemModel } from './../model/itemModel';
import { IReplyProductVariant } from './../types/rpcInventoryType';
import { CartDTO } from './../dto/CartDTO';
import { INVENTORY_RPC } from './../config/index';
import { ItemDTO } from './../dto/ItemDTO';
import { ICartModel } from './../model/cartModel';
import { CartRepository } from './../repository/CartRepository';
import { requestRPC } from './../message-queue/rpc/requestRPC';

export class CartService {
    private cartRepository: CartRepository;

    constructor() {
        this.cartRepository = new CartRepository();
    }

    async getAllCarts(): Promise<ICartModel[]> {
        return await this.cartRepository.getAllCarts();
    }

    async getCartByUserId(userId: string): Promise<CartDTO | null> {
        const cartModel = await this.cartRepository.getCartByUserId(userId);
        console.log("cart: ", cartModel?.itemList);
        
        if (!cartModel) {
            return null;
        }
        const productVariantIdList = cartModel.itemList.map(
            (item) => item.productVariantId
        );
        const requestRPCpayload = {
            type: RPCTypes.GET_PRODUCT_VARIANT_LIST_BY_ID_LIST,
            data: {
                productVariantIdList,
            },
        };
        const rpcProductVariantList =
            ((await requestRPC(
                INVENTORY_RPC,
                requestRPCpayload
            )) as IReplyProductVariant[]) ?? [];
        console.log("rpcProductVariantList reply: ", rpcProductVariantList);
            
        const productVariantMap = rpcProductVariantList.reduce(
            (acc, productVariant) => {
                acc.set(productVariant.id, productVariant);
                return acc;
            },
            new Map<string, IReplyProductVariant>()
        );
        const itemModelList = cartModel.itemList;
        
        const itemDTOList = itemModelList.map((item) => {
            const productVariant = productVariantMap.get(item.productVariantId);
            const { color, size, sellingPrice } = productVariant!;
            return {
                productId: item.productId,
                productName: item.productName,
                productPhotoUrl: item.productPhotoUrl,
                productVariantId: item.productVariantId,
                quantity: item.quantity,
                color,
                size,
                sellingPrice,
            };
        }) as ItemDTO[];
        console.log("itemList: ", itemDTOList);
        
        return {
            userId: cartModel.userId,
            itemList: itemDTOList,
        };
    }

    async createCart(cart: ICartModel): Promise<ICartModel> {
        return await this.cartRepository.createCart(cart);
    }

    async updateCart(
        userId: string,
        cart: ICartModel
    ): Promise<ICartModel | null> {
        return await this.cartRepository.updateCart(userId, cart);
    }

    async addItemToCart(
        userId: string,
        itemDTO: ItemDTO
    ): Promise<CartDTO | null> {
        const { productId, color, size } = itemDTO;
        const requestRPCPayload = {
            type: RPCTypes.GET_PRODUCT_VARIANT_BY_PRODUCT_ID_COLOR_SIZE,
            data: {
                productId,
                color,
                size,
            },
        };
        const rpcAddedProductVariant = (await requestRPC(
            INVENTORY_RPC,
            requestRPCPayload
        )) as IReplyProductVariant;
        if (!rpcAddedProductVariant) {
            return null;
        }
        
        const addItem: IItemModel = {
            ...itemDTO,
            productVariantId: rpcAddedProductVariant.id,
        };
        
        let cartModel = await this.cartRepository.getCartByUserId(userId);
        if (!cartModel) {
            cartModel = await this.cartRepository.createCart({
                userId,
                itemList: [addItem],
            });
        } else {
            const existingItemIndex = cartModel.itemList.findIndex(
                (item) => item.productVariantId === addItem.productVariantId
            );
            const itemList = cartModel.itemList;
            if (existingItemIndex !== -1) {
                addItem.quantity +=  itemList[existingItemIndex].quantity;
                itemList[existingItemIndex] = itemList[itemList.length - 1];
                itemList[itemList.length - 1] = addItem;
                cartModel = await this.cartRepository.updateCart(userId, cartModel);
                return await this.getCartByUserId(userId);
            } else {
                cartModel.itemList.push(addItem);
            }
            cartModel = await this.cartRepository.updateCart(userId, cartModel);
        }

        let cartDTO = await this.getCartByUserId(userId);

        return cartDTO;
    }

    async removeItemFromCart(
        userId: string,
        productVariantId: string
    ): Promise<CartDTO | null> {
        const cartModel = await this.cartRepository.getCartByUserId(userId);
        if (!cartModel) {
            return null;
        }
        const existingItemIndex = cartModel.itemList.findIndex(
            (item) => item.productVariantId === productVariantId
        );
        if (existingItemIndex === -1) {
            return null;
        }
        cartModel.itemList.splice(existingItemIndex, 1);
        await this.cartRepository.updateCart(userId, cartModel);
        return await this.getCartByUserId(userId);
    }

    async updateItemQuantity(
        userId: string,
        productVariantId: string,
        quantity: number
    ): Promise<IItemModel | null> {
        const cartModel = await this.cartRepository.getCartByUserId(userId);
        if (!cartModel) {
            return null;
        }
        const existingItemIndex = cartModel.itemList.findIndex(
            (item) => item.productVariantId === productVariantId
        );
        if (existingItemIndex === -1) {
            return null;
        }
        cartModel.itemList[existingItemIndex].quantity = quantity;
        const updatedCartModel = await this.cartRepository.updateCart(userId, cartModel);
        return updatedCartModel!.itemList[existingItemIndex];
    }
}
