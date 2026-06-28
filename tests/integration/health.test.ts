import request from 'supertest';
import app from '../../src/app';

describe('Health Check Endpoints', () => {
    describe('GET /health', () => {
        it('should return 200 and health status', async () => {
            const response = await request(app).get('/health');

            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('success', true);
            expect(response.body).toHaveProperty('message');
            expect(response.body).toHaveProperty('timestamp');
            expect(response.body).toHaveProperty('uptime');
        });
    });

    describe('GET /health/liveness', () => {
        it('should return 200 for liveness probe', async () => {
            const response = await request(app).get('/health/liveness');

            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('success', true);
            expect(response.body).toHaveProperty('alive', true);
        });
    });

    describe('GET /health/detailed', () => {
        it('should return detailed health information', async () => {
            const response = await request(app).get('/health/detailed');

            expect(response.body).toHaveProperty('checks');
            expect(response.body.checks).toHaveProperty('server');
            expect(response.body.checks).toHaveProperty('database');
        });
    });
});

describe('API Root', () => {
    describe('GET /', () => {
        it('should return welcome message', async () => {
            const response = await request(app).get('/');

            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('success', true);
            expect(response.body).toHaveProperty('message');
        });
    });
});

describe('404 Handler', () => {
    describe('GET /non-existent-route', () => {
        it('should return 404 for non-existent routes', async () => {
            const response = await request(app).get('/non-existent-route');

            expect(response.status).toBe(404);
            expect(response.body).toHaveProperty('success', false);
            expect(response.body).toHaveProperty('message', 'API NOT FOUND!');
        });
    });
});
