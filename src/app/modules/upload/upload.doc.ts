
/**
 * @swagger
 * /upload/multiple/images:
 *   post:
 *     summary: Upload multiple images
 *     description: Upload one or more images to cloud storage. Returns URLs of uploaded images.
 *     tags:
 *       - Upload
 *     consumes:
 *       - multipart/form-data
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               images:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: binary
 *     responses:
 *       200:
 *         description: Images uploaded successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 urls:
 *                   type: array
 *                   items:
 *                     type: string
 *       400:
 *         description: Invalid file type or upload error
 */
