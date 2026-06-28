/**
 * @swagger
 * tags:
 *   name: Vouchers
 *   description: Voucher management and redemption
 */

/**
 * @swagger
 * /api/v1/vouchers/claim:
 *   post:
 *     summary: Claim a voucher for a deal
 *     tags: [Vouchers]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - dealId
 *             properties:
 *               dealId:
 *                 type: string
 *                 description: ID of the deal to claim voucher for
 *     responses:
 *       201:
 *         description: Voucher claimed successfully
 *       400:
 *         description: Bad request (insufficient points, already claimed, etc.)
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Deal not found
 */

/**
 * @swagger
 * /api/v1/vouchers/redeem/{id}:
 *   patch:
 *     summary: Redeem a voucher (deducts requiredDM points from user)
 *     tags: [Vouchers]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Voucher ID
 *     responses:
 *       200:
 *         description: Voucher redeemed successfully and points deducted
 *       400:
 *         description: Bad request (already redeemed, insufficient points)
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (voucher doesn't belong to user)
 *       404:
 *         description: Voucher not found
 */

/**
 * @swagger
 * /api/v1/vouchers/my-vouchers:
 *   get:
 *     summary: Get user's vouchers
 *     tags: [Vouchers]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *       - in: query
 *         name: isRedeemed
 *         schema:
 *           type: string
 *           enum: [true, false]
 *     responses:
 *       200:
 *         description: Vouchers retrieved successfully
 *       401:
 *         description: Unauthorized
 */

/**
 * @swagger
 * /api/v1/vouchers/{id}:
 *   get:
 *     summary: Get single voucher details
 *     tags: [Vouchers]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Voucher ID
 *     responses:
 *       200:
 *         description: Voucher retrieved successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Voucher not found
 */
