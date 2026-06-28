"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const supertest_1 = __importDefault(require("supertest"));
const app_1 = __importDefault(require("../../src/app"));
describe('Health Check Endpoints', () => {
    describe('GET /health', () => {
        it('should return 200 and health status', () => __awaiter(void 0, void 0, void 0, function* () {
            const response = yield (0, supertest_1.default)(app_1.default).get('/health');
            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('success', true);
            expect(response.body).toHaveProperty('message');
            expect(response.body).toHaveProperty('timestamp');
            expect(response.body).toHaveProperty('uptime');
        }));
    });
    describe('GET /health/liveness', () => {
        it('should return 200 for liveness probe', () => __awaiter(void 0, void 0, void 0, function* () {
            const response = yield (0, supertest_1.default)(app_1.default).get('/health/liveness');
            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('success', true);
            expect(response.body).toHaveProperty('alive', true);
        }));
    });
    describe('GET /health/detailed', () => {
        it('should return detailed health information', () => __awaiter(void 0, void 0, void 0, function* () {
            const response = yield (0, supertest_1.default)(app_1.default).get('/health/detailed');
            expect(response.body).toHaveProperty('checks');
            expect(response.body.checks).toHaveProperty('server');
            expect(response.body.checks).toHaveProperty('database');
        }));
    });
});
describe('API Root', () => {
    describe('GET /', () => {
        it('should return welcome message', () => __awaiter(void 0, void 0, void 0, function* () {
            const response = yield (0, supertest_1.default)(app_1.default).get('/');
            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('success', true);
            expect(response.body).toHaveProperty('message');
        }));
    });
});
describe('404 Handler', () => {
    describe('GET /non-existent-route', () => {
        it('should return 404 for non-existent routes', () => __awaiter(void 0, void 0, void 0, function* () {
            const response = yield (0, supertest_1.default)(app_1.default).get('/non-existent-route');
            expect(response.status).toBe(404);
            expect(response.body).toHaveProperty('success', false);
            expect(response.body).toHaveProperty('message', 'API NOT FOUND!');
        }));
    });
});
