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
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         example: 65f1b9e9d02c9a0012c5c9a1
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
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         example: 65f1b9e9d02c9a0012c5c9a1
 *     responses:
 *       204:
 *         description: Customer deleted
 */
