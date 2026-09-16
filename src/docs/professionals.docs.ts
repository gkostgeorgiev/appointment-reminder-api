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
 *     description: >
 *       Creates the account and emails a verification link (valid 24 hours)
 *       via Resend. No session is issued at this point - `data` contains no
 *       token, and no cookies are set. The account must be verified (see
 *       `/verify-email`) before `/login` will succeed. Outside production,
 *       `data.verificationToken` also carries the raw token directly, so it
 *       can be verified without needing a real, deliverable inbox.
 *     responses:
 *       201:
 *         description: Professional registered successfully; a verification email has been sent.
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
 *                   required: [id, email, profession]
 *                   properties:
 *                     id:
 *                       type: string
 *                     email:
 *                       type: string
 *                       format: email
 *                     profession:
 *                       type: string
 *                     verificationToken:
 *                       type: string
 *                       description: Only present when NODE_ENV !== "production".
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
 *           Successful login. Issues no token in the response body - the JWT
 *           is set as an httpOnly `token` cookie, a companion `csrfToken`
 *           cookie for CSRF protection on subsequent cookie-authenticated
 *           requests, and an httpOnly `refreshToken` cookie (valid 30 days,
 *           scoped to `/api/v1/professionals`) that `POST /refresh` accepts
 *           to obtain a new `token` once the 1h access token expires.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required: [ok, status]
 *               properties:
 *                 ok:
 *                   type: boolean
 *                 status:
 *                   type: integer
 *       403:
 *         description: Credentials are valid, but the account's email has not been verified yet
 */

/**
 * @swagger
 * /api/v1/professionals/refresh:
 *   post:
 *     summary: Exchange a refresh token for a new access token
 *     tags: [Professionals]
 *     security: []
 *     description: >
 *       Reads the httpOnly `refreshToken` cookie set by `/login` (or a
 *       previous `/refresh` call) and, if it is still valid, issues a new
 *       `token`/`csrfToken`/`refreshToken` cookie triple - rotating the
 *       refresh token on every use, so a previously-used refresh cookie is
 *       immediately rejected afterwards. The refresh token is invalidated by
 *       `/logout` and by a password change/reset. No request body; no CSRF
 *       header required, since this endpoint doesn't require a prior access
 *       token and has no exploitable cross-site effect.
 *     responses:
 *       200:
 *         description: New access/CSRF/refresh cookies issued
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required: [ok, status]
 *               properties:
 *                 ok:
 *                   type: boolean
 *                 status:
 *                   type: integer
 *       401:
 *         description: Missing, invalid, or expired refresh token
 */

/**
 * @swagger
 * /api/v1/professionals/me:
 *   get:
 *     summary: Get current authenticated professional
 *     tags: [Professionals]
 *     security:
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
 * /api/v1/professionals/forgot-password:
 *   post:
 *     summary: Request a password reset email
 *     tags: [Professionals]
 *     security: []
 *     description: >
 *       Always responds with the same generic message whether or not an
 *       account exists for the given email, to avoid revealing account
 *       existence. If the account exists, a reset link (containing a
 *       single-use token valid for 1 hour) is emailed via Resend.
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
 *                 format: email
 *                 example: doctor@example.com
 *     responses:
 *       200:
 *         description: Generic confirmation message
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
 *                       example: If an account with that email exists, a password reset link has been sent.
 *       429:
 *         description: Too many password reset requests from this client
 */

/**
 * @swagger
 * /api/v1/professionals/reset-password:
 *   post:
 *     summary: Reset password using a reset token
 *     tags: [Professionals]
 *     security: []
 *     description: >
 *       Consumes the single-use token emailed by forgot-password. On
 *       success, invalidates any JWT issued before the reset (via
 *       passwordChangedAt) - the client must log in again to obtain a
 *       new token.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - token
 *               - password
 *             properties:
 *               token:
 *                 type: string
 *                 example: 9f1c2e...64-hex-chars
 *               password:
 *                 type: string
 *                 minLength: 8
 *                 example: newSecurePassword123
 *     responses:
 *       200:
 *         description: Password reset successfully
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
 *                       example: Password has been reset successfully. Please log in.
 *       400:
 *         description: Invalid or expired reset token
 */

/**
 * @swagger
 * /api/v1/professionals/verify-email:
 *   post:
 *     summary: Verify email using a verification token
 *     tags: [Professionals]
 *     security: []
 *     description: >
 *       Consumes the single-use token emailed on registration (or by
 *       `/resend-verification`). On success, marks the account verified so
 *       that `/login` will succeed.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - token
 *             properties:
 *               token:
 *                 type: string
 *                 example: 9f1c2e...64-hex-chars
 *     responses:
 *       200:
 *         description: Email verified successfully
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
 *                       example: Email verified successfully. Please log in.
 *       400:
 *         description: Invalid or expired verification token
 */

/**
 * @swagger
 * /api/v1/professionals/resend-verification:
 *   post:
 *     summary: Resend the email verification link
 *     tags: [Professionals]
 *     security: []
 *     description: >
 *       Always responds with the same generic message whether or not an
 *       account exists for the given email, or whether it's already
 *       verified, to avoid revealing account existence/state. If the
 *       account exists and is not yet verified, a new verification link
 *       (valid 24 hours) is emailed via Resend. Outside production,
 *       `data.verificationToken` also carries the raw token directly when
 *       one was (re)issued, so it can be verified without a real inbox.
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
 *                 format: email
 *                 example: doctor@example.com
 *     responses:
 *       200:
 *         description: Generic confirmation message
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
 *                       example: If an account with that email exists and is not yet verified, a verification link has been sent.
 *                     verificationToken:
 *                       type: string
 *                       description: Only present outside production, and only when a token was actually (re)issued.
 *       429:
 *         description: Too many verification email requests from this client
 */

/**
 * @swagger
 * /api/v1/professionals/logout:
 *   post:
 *     summary: Log out the current professional
 *     tags: [Professionals]
 *     security:
 *       - cookieAuth: []
 *     description: >
 *       Clears the `token`, `csrfToken`, and `refreshToken` cookies, and
 *       invalidates the stored refresh token server-side so a copy of the
 *       refresh cookie can no longer be used to obtain a new access token.
 *       Requires the `X-CSRF-Token` header (see the parameter below).
 *     parameters:
 *       - in: header
 *         name: X-CSRF-Token
 *         required: true
 *         schema:
 *           type: string
 *         description: >
 *           Must match the `csrfToken` cookie's value, or the request is
 *           rejected with 403.
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
