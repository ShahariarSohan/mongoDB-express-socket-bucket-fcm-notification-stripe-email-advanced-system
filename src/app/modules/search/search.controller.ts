import { Request, Response } from "express";
import catchAsync from "../../../shared/catchAsync";
import logger from "../../../utils/logger";
import { prisma } from "../../../utils/prisma";
import sendResponse from "../../middleware/sendResponse";
import { getResponseMessage } from "../../helper/languageHelper";

const globalSearch = catchAsync(async (req: Request, res: Response) => {
    const { query, type, limit = 10, page = 1 } = req.query;
    const language = req.language || 'en';
    if (!query || typeof query !== "string") {
        return sendResponse(res, { statusCode: 400, success: false, message: getResponseMessage("error.validation", language) });
    }
    const searchQuery = query.toLowerCase();
    const limitNum = Number(limit);
    const skip = (Number(page) - 1) * limitNum;
    let results: any = { users: [], services: [], total: 0 };
    try {
        if (!type || type === "users") {
            const users = await prisma.user.findMany({
                where: { OR: [{ name: { contains: searchQuery, mode: "insensitive" } }, { email: { contains: searchQuery, mode: "insensitive" } }] },
                select: { id: true, name: true, email: true, role: true, image: true, status: true },
                take: limitNum, skip: skip
            });
            results.users = users;
        }
        results.total = results.users.length + results.services.length;
        sendResponse(res, { statusCode: 200, success: true, message: getResponseMessage("success.retrieved", language), data: results, meta: { page: Number(page), limit: limitNum, total: results.total } });
    } catch (error) {
        logger.error("Error in global search:", error);
        sendResponse(res, { statusCode: 500, success: false, message: getResponseMessage("error.validation", language) });
    }
});

const searchServices = catchAsync(async (req: Request, res: Response) => {
    const language = req.language || 'en';
    sendResponse(res, { statusCode: 200, success: true, message: getResponseMessage("success.retrieved", language), data: [], meta: { page: 1, limit: 10, total: 0, totalPage: 0 } });
});

const autocomplete = catchAsync(async (req: Request, res: Response) => {
    const { query, type = "services", limit = 5 } = req.query;
    const language = req.language || 'en';
    if (!query || typeof query !== "string" || query.length < 2) {
        return sendResponse(res, { statusCode: 400, success: false, message: getResponseMessage("error.validation", language) });
    }
    const searchQuery = query.toLowerCase();
    let suggestions: any[] = [];
    if (type === "users") {
        const users = await prisma.user.findMany({
            where: { OR: [{ name: { contains: searchQuery, mode: "insensitive" } }, { email: { contains: searchQuery, mode: "insensitive" } }] },
            select: { id: true, name: true, email: true },
            take: Number(limit)
        });
        suggestions = users.map((u) => ({ id: u.id, label: u.name || u.email, type: "user" }));
    }
    sendResponse(res, { statusCode: 200, success: true, message: getResponseMessage("success.retrieved", language), data: suggestions });
});

export const SearchController = { globalSearch, searchServices, autocomplete };