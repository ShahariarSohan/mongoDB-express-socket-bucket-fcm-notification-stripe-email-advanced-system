"use strict";
// Test setup file
// Mock Prisma Client for tests
jest.mock('../src/utils/prisma', () => ({
    prisma: {
        user: {
            findUnique: jest.fn(),
            findMany: jest.fn(),
            create: jest.fn(),
            update: jest.fn(),
            delete: jest.fn(),
        },
        otp: {
            findUnique: jest.fn(),
            create: jest.fn(),
            delete: jest.fn(),
        },
    },
}));
// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.TOKEN_SECRET = 'test-secret-token-for-testing-purposes-only-32-chars';
process.env.DATABASE_URL = 'mongodb://localhost:27017/test-db';
process.env.PORT = '5001';
// Global test timeout
jest.setTimeout(10000);
// Clear all mocks after each test
afterEach(() => {
    jest.clearAllMocks();
});
