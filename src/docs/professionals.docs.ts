/**
 * @swagger
 * tags:
 *   name: Professionals
 *   description: Professional authentication and profile
 */

/**
 * @swagger
 * /api/v1/professionals/register:
 *   post:
 *     summary: Register a new professional
 *     tags: [Professionals]
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
 *                 format: email
 *                 example: doctor@example.com
 *               password:
 *                 type: string
 *                 minLength: 8
 *                 example: securePassword123
 *               profession:
 *                 type: string
 *                 minLength: 1
 *                 example: Dentist
 *     responses:
 *       201:
 *         description: Professional registered successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required: [ok, status, data]
 *               properties:
 *                 ok:
 *                   type: boolean
 *                 status:
 *                   type: integer
 *                 data:
 *                   type: object
 *                   required: [id, email, profession, token]
 *                   properties:
 *                     id:
 *                       type: string
 *                     email:
 *                       type: string
 *                       format: email
 *                     profession:
 *                       type: string
 *                     token:
 *                       type: string
 */

/**
 * @swagger
 * /api/v1/professionals/login:
 *   post:
 *     summary: Login professional
 *     tags: [Professionals]
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
 *                 format: email
 *                 example: doctor@example.com
 *               password:
 *                 type: string
 *                 minLength: 8
 *                 example: securePassword123
 *     responses:
 *       200:
 *         description: Successful login
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required: [ok, status, data]
 *               properties:
 *                 ok:
 *                   type: boolean
 *                 status:
 *                   type: integer
 *                 data:
 *                   type: object
 *                   required: [token]
 *                   properties:
 *                     token:
 *                       type: string
 */

/**
 * @swagger
 * /api/v1/professionals/me:
 *   get:
 *     summary: Get current authenticated professional
 *     tags: [Professionals]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Authenticated user payload returned
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required: [message, user]
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Protected route accessed
 *                 user:
 *                   type: object
 *                   required: [userId, email]
 *                   properties:
 *                     userId:
 *                       type: string
 *                     email:
 *                       type: string
 *                       format: email
 */
