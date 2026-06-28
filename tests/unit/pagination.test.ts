import { Request } from 'express';
import { paginationSystem } from '../../src/app/helper/pagination';

describe('Pagination Helper', () => {
    it('should paginate results with default values', async () => {
        const mockData = Array.from({ length: 50 }, (_, i) => ({ id: i + 1 }));
        const mockReq = {
            query: {},
        } as unknown as Request;

        const result = await paginationSystem(mockData, mockReq);

        expect(result.limit).toBe(10);
        expect(result.page).toBe(1);
        expect(result.data).toHaveLength(10);
        expect(result.total).toBe(50);
        expect(result.totalPage).toBe(5);
    });

    it('should paginate with custom limit and page', async () => {
        const mockData = Array.from({ length: 50 }, (_, i) => ({ id: i + 1 }));
        const mockReq = {
            query: { limit: '20', page: '2' },
        } as unknown as Request;

        const result = await paginationSystem(mockData, mockReq);

        expect(result.limit).toBe(20);
        expect(result.page).toBe(2);
        expect(result.data).toHaveLength(20);
        expect(result.data[0]).toEqual({ id: 21 });
    });

    it('should handle empty results', async () => {
        const mockData: any[] = [];
        const mockReq = {
            query: {},
        } as unknown as Request;

        const result = await paginationSystem(mockData, mockReq);

        expect(result.data).toHaveLength(0);
        expect(result.total).toBe(0);
        expect(result.totalPage).toBe(0);
    });
});
