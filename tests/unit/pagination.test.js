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
Object.defineProperty(exports, "__esModule", { value: true });
const pagination_1 = require("../../src/app/helper/pagination");
describe('Pagination Helper', () => {
    it('should paginate results with default values', () => __awaiter(void 0, void 0, void 0, function* () {
        const mockData = Array.from({ length: 50 }, (_, i) => ({ id: i + 1 }));
        const mockReq = {
            query: {},
        };
        const result = yield (0, pagination_1.paginationSystem)(mockData, mockReq);
        expect(result.limit).toBe(10);
        expect(result.page).toBe(1);
        expect(result.data).toHaveLength(10);
        expect(result.total).toBe(50);
        expect(result.totalPage).toBe(5);
    }));
    it('should paginate with custom limit and page', () => __awaiter(void 0, void 0, void 0, function* () {
        const mockData = Array.from({ length: 50 }, (_, i) => ({ id: i + 1 }));
        const mockReq = {
            query: { limit: '20', page: '2' },
        };
        const result = yield (0, pagination_1.paginationSystem)(mockData, mockReq);
        expect(result.limit).toBe(20);
        expect(result.page).toBe(2);
        expect(result.data).toHaveLength(20);
        expect(result.data[0]).toEqual({ id: 21 });
    }));
    it('should handle empty results', () => __awaiter(void 0, void 0, void 0, function* () {
        const mockData = [];
        const mockReq = {
            query: {},
        };
        const result = yield (0, pagination_1.paginationSystem)(mockData, mockReq);
        expect(result.data).toHaveLength(0);
        expect(result.total).toBe(0);
        expect(result.totalPage).toBe(0);
    }));
});
