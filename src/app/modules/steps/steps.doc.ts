/**
 * @swagger
 * tags:
 *   name: Steps
 *   description: Steps tracking and points management
 */

/**
 * @swagger
 * /api/v1/steps/submit:
 *   post:
 *     summary: Submit or update daily steps
 *     tags: [Steps]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - steps
 *             properties:
 *               steps:
 *                 type: number
 *                 description: Number of steps taken
 *                 example: 5000
 *               date:
 *                 type: string
 *                 format: date
 *                 description: Date for the steps (defaults to today)
 *                 example: "2025-12-20"
 *     responses:
 *       200:
 *         description: Steps submitted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                     userId:
 *                       type: string
 *                     steps:
 *                       type: number
 *                     points:
 *                       type: number
 *                     date:
 *                       type: string
 *                       format: date-time
 *       401:
 *         description: Unauthorized
 */

/**
 * @swagger
 * /api/v1/steps/history:
 *   get:
 *     summary: Get last 30 days history with streak information
 *     tags: [Steps]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: History retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     history:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                           steps:
 *                             type: number
 *                           points:
 *                             type: number
 *                           date:
 *                             type: string
 *                             format: date-time
 *                           createdAt:
 *                             type: string
 *                             format: date-time
 *                     totalPoints:
 *                       type: number
 *                       description: User's total accumulated points
 *                     streak:
 *                       type: object
 *                       properties:
 *                         currentStreak:
 *                           type: number
 *                           description: Current consecutive days with steps
 *                         bestStreak:
 *                           type: number
 *                           description: Best streak ever achieved
 *                         totalDays:
 *                           type: number
 *                           description: Total days with recorded steps
 *       401:
 *         description: Unauthorized
 */

/**
 * @swagger
 * /api/v1/steps/points:
 *   get:
 *     summary: Get user's total points
 *     tags: [Steps]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Total points retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     totalPoints:
 *                       type: number
 *       401:
 *         description: Unauthorized
 */

/**
 * @swagger
 * /api/v1/steps/streak:
 *   get:
 *     summary: Get streak information only
 *     tags: [Steps]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Streak information retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     currentStreak:
 *                       type: number
 *                       description: Current consecutive days with steps (how many days streak is running)
 *                     bestStreak:
 *                       type: number
 *                       description: Best streak ever achieved
 *                     totalDays:
 *                       type: number
 *                       description: Total days with recorded steps
 *       401:
 *         description: Unauthorized
 */
