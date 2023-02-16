require('dotenv').config();

export const __prod__ = process.env.NODE_ENV === 'production';
export const PORT= process.env.PORT || 3000;
export const MONGO_URI= process.env.MONGO_URI || 'mongodb://localhost:27017/express-ts-api';
export const MESSAGE_BROKER_URL = process.env.MESSAGE_BROKER_URL || 'amqp://localhost';
export const EXCHANGE_NAME='CAPSTONE_EXCHANGE';
export const REVIEW_SERVICE='REVIEW_SERVICE';
export const PRODUCT_SERVICE='PRODUCT_SERVICE';
export const USER_SERVICE='USER_SERVICE';
export const USER_RPC = 'USER_RPC';