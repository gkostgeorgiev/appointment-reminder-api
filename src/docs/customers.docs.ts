/**
 * @swagger
 * tags:
 *   name: Customers
 *   description: Customer management
 */

/**
 * @swagger
 * /api/v1/customers:
 *   post:
 *     summary: Create a new customer
 *     tags: [Customers]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     description: >
 *       When authenticating via the `token` cookie, this request also
 *       requires the `X-CSRF-Token` header (see the header parameter
 *       below); it is not required when authenticating via
 *       `Authorization: Bearer`.
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
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - firstName
 *               - lastName
 *               - phone
 *             properties:
 *               firstName:
 *                 type: string
 *                 minLength: 1
 *                 example: Maria
 *               lastName:
 *                 type: string
 *                 minLength: 1
 *                 example: Ivanova
 *               phone:
 *                 type: string
 *                 minLength: 1
 *                 example: "+359888123456"
 *               email:
 *                 type: string
 *                 format: email
 *                 example: maria@example.com
 *     responses:
 *       201:
 *         description: Customer created successfully
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
 *                   properties:
 *                     _id:
 *                       type: string
 *                     firstName:
 *                       type: string
 *                     lastName:
 *                       type: string
 *                     phone:
 *                       type: string
 *                     email:
 *                       type: string
 *                       format: email
 *                     professional:
 *                       type: string
 *                     createdAt:
 *                       type: string
 *                       format: date-time
 *                     updatedAt:
 *                       type: string
 *                       format: date-time
 */

/**
 * @swagger
 * /api/v1/customers:
 *   get:
 *     summary: Get all customers
 *     tags: [Customers]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     parameters:
 *       - in: query
 *         name: phone
 *         required: false
 *         schema:
 *           type: string
 *           minLength: 1
 *         description: Partial phone match (case-insensitive)
 *         example: "888"
 *       - in: query
 *         name: name
 *         required: false
 *         schema:
 *           type: string
 *           minLength: 1
 *         description: Partial first or last name match (case-insensitive)
 *         example: "John"
 *     responses:
 *       200:
 *         description: List of customers
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
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       _id:
 *                         type: string
 *                       firstName:
 *                         type: string
 *                       lastName:
 *                         type: string
 *                       phone:
 *                         type: string
 *                       email:
 *                         type: string
 *                         format: email
 *                       professional:
 *                         type: string
 *                       createdAt:
 *                         type: string
 *                         format: date-time
 *                       updatedAt:
 *                         type: string
 *                         format: date-time
 */

/**
 * @swagger
 * /api/v1/customers/{id}:
 *   patch:
 *     summary: Update customer
 *     tags: [Customers]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     description: >
 *       When authenticating via the `token` cookie, this request also
 *       requires the `X-CSRF-Token` header (see the header parameter
 *       below); it is not required when authenticating via
 *       `Authorization: Bearer`.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         example: 65f1b9e9d02c9a0012c5c9a1
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
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             minProperties: 1
 *             properties:
 *               firstName:
 *                 type: string
 *                 minLength: 1
 *                 example: Maria
 *               lastName:
 *                 type: string
 *                 minLength: 1
 *                 example: Ivanova
 *               phone:
 *                 type: string
 *                 minLength: 1
 *                 example: "+359888123456"
 *               email:
 *                 type: string
 *                 format: email
 *                 example: maria@example.com
 *     responses:
 *       200:
 *         description: Customer updated
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
 *                   properties:
 *                     _id:
 *                       type: string
 *                     firstName:
 *                       type: string
 *                     lastName:
 *                       type: string
 *                     phone:
 *                       type: string
 *                     email:
 *                       type: string
 *                       format: email
 *                     professional:
 *                       type: string
 *                     createdAt:
 *                       type: string
 *                       format: date-time
 *                     updatedAt:
 *                       type: string
 *                       format: date-time
 */

/**
 * @swagger
 * /api/v1/customers/{id}:
 *   delete:
 *     summary: Delete customer
 *     tags: [Customers]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     description: >
 *       When authenticating via the `token` cookie, this request also
 *       requires the `X-CSRF-Token` header (see the header parameter
 *       below); it is not required when authenticating via
 *       `Authorization: Bearer`.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         example: 65f1b9e9d02c9a0012c5c9a1
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
 *       204:
 *         description: Customer deleted
 */
