/**
 * @swagger
 * tags:
 *   name: Appointments
 *   description: Appointment scheduling and management
 */

/**
 * @swagger
 * /api/v1/appointments:
 *   post:
 *     summary: Create appointment
 *     tags: [Appointments]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - customer
 *               - start
 *               - duration
 *             properties:
 *               customer:
 *                 type: string
 *                 example: 65f1b9e9d02c9a0012c5c9a1
 *               start:
 *                 type: string
 *                 format: date-time
 *                 description: Must be a future ISO datetime
 *                 example: 2026-03-20T15:00:00Z
 *               duration:
 *                 type: integer
 *                 minimum: 1
 *                 example: 30
 *               service:
 *                 type: string
 *                 example: Dental cleaning
 *               notes:
 *                 type: string
 *                 example: First visit consultation
 *     responses:
 *       201:
 *         description: Appointment created
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
 *                     professional:
 *                       type: string
 *                     customer:
 *                       type: string
 *                     start:
 *                       type: string
 *                       format: date-time
 *                     duration:
 *                       type: integer
 *                     service:
 *                       type: string
 *                     notes:
 *                       type: string
 *                     status:
 *                       type: string
 *                       enum: [scheduled, completed, cancelled, no-show]
 *                     reminderSent:
 *                       type: boolean
 *                     createdAt:
 *                       type: string
 *                       format: date-time
 *                     updatedAt:
 *                       type: string
 *                       format: date-time
 */

/**
 * @swagger
 * /api/v1/appointments:
 *   get:
 *     summary: Get appointments
 *     tags: [Appointments]
 *     security:
 *       - bearerAuth: []
 *     description: Use only one filtering method per request (start, range, or from/to)
 *     parameters:
 *       - in: query
 *         name: start
 *         schema:
 *           type: string
 *           format: date
 *         description: Filter appointments by specific day
 *       - in: query
 *         name: from
 *         schema:
 *           type: string
 *           format: date
 *         description: Start date of range
 *       - in: query
 *         name: to
 *         schema:
 *           type: string
 *           format: date
 *         description: End date of range
 *       - in: query
 *         name: range
 *         schema:
 *           type: string
 *           enum: [today, week, month]
 *         description: Predefined date range
 *     responses:
 *       200:
 *         description: List of appointments
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
 *                       professional:
 *                         type: string
 *                       customer:
 *                         type: object
 *                         properties:
 *                           _id:
 *                             type: string
 *                           firstName:
 *                             type: string
 *                           lastName:
 *                             type: string
 *                           phone:
 *                             type: string
 *                           email:
 *                             type: string
 *                             format: email
 *                       start:
 *                         type: string
 *                         format: date-time
 *                       duration:
 *                         type: integer
 *                       service:
 *                         type: string
 *                       notes:
 *                         type: string
 *                       status:
 *                         type: string
 *                         enum: [scheduled, completed, cancelled, no-show]
 *                       reminderSent:
 *                         type: boolean
 *                       createdAt:
 *                         type: string
 *                         format: date-time
 *                       updatedAt:
 *                         type: string
 *                         format: date-time
 */
