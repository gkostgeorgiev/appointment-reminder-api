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
 *     security: []
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
 *         description: >
 *           Professional registered successfully. The JWT is also set as an
 *           httpOnly `token` cookie (plus a companion `csrfToken` cookie for
 *           CSRF protection on subsequent cookie-authenticated requests) -
 *           `data.token` is included for clients using the `Authorization`
 *           header instead of the cookie.
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
 *     security: []
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
 *         description: >
 *           Successful login. The JWT is also set as an httpOnly `token`
 *           cookie (plus a companion `csrfToken` cookie for CSRF protection
 *           on subsequent cookie-authenticated requests) - `data.token` is
 *           included for clients using the `Authorization` header instead
 *           of the cookie.
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
 *       - cookieAuth: []
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

/**
 * @swagger
 * /api/v1/professionals/logout:
 *   post:
 *     summary: Log out the current professional
 *     tags: [Professionals]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     description: >
 *       Clears the `token` and `csrfToken` cookies. Has no effect on a
 *       Bearer token already issued to a non-browser client - those simply
 *       expire per the JWT's own expiry. When authenticating via the
 *       cookie, this request also requires the `X-CSRF-Token` header (see
 *       the header parameter below); it is not required when authenticating
 *       via `Authorization: Bearer`.
 *     parameters:
 *       - in: header
 *         name: X-CSRF-Token
 *         required: false
 *         schema:
 *           type: string
 *         description: >
 *           Required when authenticating via the `token` cookie - must
 *           match the `csrfToken` cookie's value, or the request is
 *           rejected with 403. Not required for `Authorization: Bearer`
 *           requests.
 *     responses:
 *       200:
 *         description: Logged out successfully
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
 *                   required: [message]
 *                   properties:
 *                     message:
 *                       type: string
 *                       example: Logged out
 */
