import express from "express";
import auth from "../../middleware/auth";
import { SearchController } from "./search.controller";

const router = express.Router();

/**
 * @route   GET /api/search
 * @desc    Global search across users and services
 * @query   query (string), type (users|services), limit, page
 * @access  Private
 */
router.get("/", auth(), SearchController.globalSearch);

/**
 * @route   GET /api/search/services
 * @desc    Advanced search for services with filters
 * @query   query, minPrice, maxPrice, sortBy, sortOrder, limit, page
 * @access  Public
 */
router.get("/services", SearchController.searchServices);

/**
 * @route   GET /api/search/autocomplete
 * @desc    Autocomplete suggestions for search
 * @query   query (string), type (users|services), limit
 * @access  Private
 */
router.get("/autocomplete", auth(), SearchController.autocomplete);

export const SearchRoutes = router;
