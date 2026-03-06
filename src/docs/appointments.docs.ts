/**
 * @swagger
 * tags:
 *   name: Appointments
 *   description: Appointment scheduling and management
 */

/**
 * @swagger
 * /api/appointments:
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
 *                 example: 2026-03-20T15:00:00Z
 *               duration:
 *                 type: number
 *                 example: 30
 *               service:
 *                 type: string
 *                 example: Check-up
 *               notes:
 *                 type: string
 *     responses:
 *       201:
 *         description: Appointment created
 */

/**
 * @swagger
 * /api/appointments:
 *   get:
 *     summary: Get appointments
 *     tags: [Appointments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: start
 *         schema:
 *           type: string
 *         description: Filter appointments by specific day
 *
 *       - in: query
 *         name: from
 *         schema:
 *           type: string
 *         description: Start date of range
 *
 *       - in: query
 *         name: to
 *         schema:
 *           type: string
 *         description: End date of range
 *
 *       - in: query
 *         name: range
 *         schema:
 *           type: string
 *           enum: [today, week, month]
 *         description: Predefined date range
 *
 *     responses:
 *       200:
 *         description: List of appointments
 */

/**
 * @swagger
 * /api/appointments/{id}:
 *   get:
 *     summary: Get appointment by ID
 *     tags: [Appointments]
 *     security:
 *       - bearerAuth: []
 */

/**
 * @swagger
 * /api/appointments/{id}:
 *   patch:
 *     summary: Update appointment
 *     tags: [Appointments]
 *     security:
 *       - bearerAuth: []
 */

/**
 * @swagger
 * /api/appointments/{id}:
 *   delete:
 *     summary: Delete appointment
 *     tags: [Appointments]
 *     security:
 *       - bearerAuth: []
 */
