import { FilterBySize } from './filter/FilterBySize';
import { FilterByColor } from './filter/FilterByColor';
import {
    FilterProductRequest,
    RetrieveProductRequest,
} from './../types/product';
import { ProductRetrieveMediator } from './filter/ProductRetrieveMediator';
import EventType from '../types/eventType';
import { difference } from '../util/util';
import { ValidationError } from '../error/error-type/ValidationError';
import { NotFoundError } from '../error/error-type/NotFoundError';
import { IService } from './IService';
import { RPCTypes } from '../types/rpcType';
import { EventPayload, RPCPayload } from '../types/utilTypes';
import { IProductModel } from '../model/productModel';
import { ProductRepository } from '../repository/ProductRepository';
import CategoryService from './categoryService';
import { FilterByCategories } from './filter/FilterByCategories';
import { FilterByPrice } from './filter/FilterByPrice';
import { Filter } from './filter/Filter';
import {
    FilterByVariantOptions,
    VariantOptionsType,
} from './filter/FilterByVariantOptions';

export default class ProductService implements IService {
    private productRepository: ProductRepository;
    private categoryService: CategoryService;
    private productRetrieveMediator: ProductRetrieveMediator;

    constructor() {
        this.productRepository = new ProductRepository();
        this.categoryService = new CategoryService();
        this.productRetrieveMediator = new ProductRetrieveMediator(
            this.productRepository
        );
    }

    async getProducts() {
        return await this.productRepository.getProducts();
    }

    async getProductById(id: string) {
        const product = await this.productRepository.getProductById(id);
        if (!product) {
            throw new NotFoundError('Product id did not match');
        }
        return product;
    }

    async createProduct(product: IProductModel) {
        product = await this.productRepository.createProduct(product);
        if (!product) {
            throw new ValidationError('product create body did not match');
        }
        await this.categoryService.addProductToCategories(
            product.id!,
            product.categories
        );
        return product;
    }

    async updateProduct(id: string, updateProduct: IProductModel) {
        const existingProduct = await this.productRepository.getProductById(id);
        if (!existingProduct) {
            throw new NotFoundError('Product id did not match');
        }
        await this.modifyCategoriesOfProduct(
            existingProduct,
            updateProduct.categories || []
        );
        return await this.productRepository.updateProduct(id, updateProduct);
    }

    async modifyCategoriesOfProduct(
        existingProduct: IProductModel,
        updatedCategories: string[]
    ): Promise<void> {
        const existingCategories = existingProduct.categories || [];

        const addedCategories = difference(
            updatedCategories,
            existingCategories
        );
        const removedCategories = difference(
            existingCategories,
            updatedCategories
        );

        if (addedCategories.length === 0 && removedCategories.length === 0) {
            return;
        }
        await this.categoryService.addProductToCategories(
            existingProduct.id!,
            addedCategories
        );
        await this.categoryService.removeProductFromCategories(
            existingProduct.id!,
            removedCategories
        );
    }

    async deleteProduct(id: string) {
        const product = await this.productRepository.getProductById(id);
        if (!product) {
            throw new NotFoundError('Product id did not match');
        }
        this.categoryService.removeProductFromCategories(
            product.id!,
            product.categories || []
        );
        return await this.productRepository.deleteProduct(id);
    }

    async updateProductReviewStatistics(
        productId: string,
        averageRating: number,
        reviewCount: number
    ) {
        const product = await this.productRepository.getProductById(productId);
        if (!product) {
            return;
        }

        product.rating = averageRating;
        product.reviewed = reviewCount;
        await this.productRepository.updateProduct(productId, product);
    }

    async paginateProducts(page: number, limit: number) {
        return await this.productRepository.paginateProducts(page, limit);
    }

    async sortProducts(
        page: number,
        limit: number,
        orderBy: string,
        sortBy: 'asc' | 'desc'
    ) {
        return await this.productRepository.paginateProducts(
            page,
            limit,
            orderBy,
            sortBy
        );
    }

    async retrieveProductByFilters(
        retrieveProductRequest: RetrieveProductRequest
    ) {
        const {
            page,
            pageSize,
            orderBy,
            sortBy,
            filters: filterOptionsRequest,
        } = retrieveProductRequest;
        
        const filterCommands = this.createFilterCommandsFromRequest(
            filterOptionsRequest!,
            this.filterByEntityFieldCommandFactory
        );
        const filterByRPCVariantCommands = this.createFilterCommandsFromRequest(
            filterOptionsRequest!,
            this.filterByRPCVariantCommandFactory
        );
        const variantFilterOptions = this.createVariantOptionsType(
            filterByRPCVariantCommands
        );

        if (variantFilterOptions) {
            filterCommands.push(
                new FilterByVariantOptions(variantFilterOptions)
            );
        }
        return await this.productRetrieveMediator.retrieveProducts(
            filterCommands,
            page,
            pageSize,
            orderBy,
            sortBy
        );
    }

    createVariantOptionsType(FilterByVariants: Filter[]) {
        if (!FilterByVariants || FilterByVariants.length === 0) {
            return null;
        }
        const filterByVariantOptions = {};
        for (const filter of FilterByVariants) {
            filter.extendFilterOptions(filterByVariantOptions);
        }
        return filterByVariantOptions as VariantOptionsType;
    }

    createFilterCommandsFromRequest(
        filterOptionsRequest: FilterProductRequest,
        filterFactoryFunction: (
            name: string,
            value: string | string[]
        ) => Filter | null
    ) {
        const filters = [];
        for (const [key, value] of Object.entries(filterOptionsRequest)) {
            if (value) {
                const filter = filterFactoryFunction(key, value);
                if (!filter) {
                    continue;
                }
                filters.push(filter);
            }
        }
        return filters;
    }

    filterByEntityFieldCommandFactory(name: string, value: string | string[]) {
        switch (name) {
            case 'category':
                return new FilterByCategories(value as string[]);
            case 'priceRange':
                return new FilterByPrice(value as string);
            default:
                return null;
        }
    }

    filterByRPCVariantCommandFactory(name: string, value: string[] | string) {
        switch (name) {
            case 'color':
                return new FilterByColor(value as string[]);
            case 'size':
                return new FilterBySize(value as string[]);
            default:
                return null;
        }
    }

    subscribeEvents(payload: string): void {
        const eventPayload: EventPayload = JSON.parse(payload);
        const { event, data } = eventPayload;

        switch (event) {
            case EventType.CREATE_REVIEW:
            case EventType.DELETE_REVIEW:
                const { productId, averageRating, reviewCount } = data;
                this.updateProductReviewStatistics(
                    productId,
                    averageRating,
                    reviewCount
                );
                break;
            default:
                break;
        }
    }

    serveRPCRequest(payload: RPCPayload) {
        const { type, data } = payload;
        switch (type) {
            case RPCTypes.GET_PRODUCT_BY_ID:
                return this.getProductById(data?.id as string);
            default:
                return null;
        }
    }
}
