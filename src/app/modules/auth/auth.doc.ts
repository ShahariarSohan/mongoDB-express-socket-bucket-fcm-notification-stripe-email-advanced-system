/**
 * @openapi
 * /auth/login:
 *   post:
 *     summary: User login
 *     tags:
 *       - Authentication
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 example: user@example.com
 *               password:
 *                 type: string
 *                 example: secret123
 *     responses:
 *       200:
 *         description: Successful login
 *       400:
 *         description: Invalid credentials
 *
 * /auth/verify-otp:
 *   post:
 *     summary: Verify OTP for authentication
 *     tags:
 *       - Authentication
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - otp
 *             properties:
 *               email:
 *                 type: string
 *                 example: user@example.com
 *               otp:
 *                 type: number
 *                 example: 123456
 *     responses:
 *       200:
 *         description: OTP verified successfully
 *       400:
 *         description: Invalid or expired OTP
 *
 * /auth/forget-password:
 *   post:
 *     summary: Request password reset via email
 *     tags:
 *       - Authentication
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *             properties:
 *               email:
 *                 type: string
 *                 example: user@example.com
 *     responses:
 *       200:
 *         description: Password reset email sent
 *       400:
 *         description: Invalid email
 *
 * /auth/forget-otp-verify:
 *   post:
 *     summary: Verify OTP for password reset
 *     tags:
 *       - Authentication
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - otp
 *             properties:
 *               email:
 *                 type: string
 *                 example: user@example.com
 *               otp:
 *                 type: number
 *                 example: 654321
 *     responses:
 *       200:
 *         description: OTP verified, proceed to reset password
 *       400:
 *         description: Invalid OTP
 *
 * /auth/resend-otp:
 *   post:
 *     summary: Resend OTP code
 *     tags:
 *       - Authentication
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - otp
 *             properties:
 *               email:
 *                 type: string
 *                 example: user@example.com
 *               otp:
 *                 type: number
 *                 example: 123456
 *     responses:
 *       200:
 *         description: OTP resent successfully
 *       400:
 *         description: Could not resend OTP
 *
 * /auth/reset-password:
 *   post:
 *     summary: Reset user password
 *     tags:
 *       - Authentication
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - newPassword
 *             properties:
 *               newPassword:
 *                 type: string
 *                 example: NewStrongPassword123!
 *     responses:
 *       200:
 *         description: Password reset successful
 *       400:
 *         description: Reset failed
 *
 * /auth/social:
 *   post:
 *     summary: Social login (Google, Facebook, etc.)
 *     tags:
 *       - Authentication
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               provider:
 *                 type: string
 *                 example: google
 *               token:
 *                 type: string
 *                 example: ya29.a0AfH6SMC...
 *     responses:
 *       200:
 *         description: Social login successful
 *       400:
 *         description: Social login failed
 */
