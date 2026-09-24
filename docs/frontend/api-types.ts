/**
 * Appointment Reminder API — shared types.
 *
 * Hand-maintained to match the backend's Zod validators and Mongoose models.
 * Copy this file into the frontend repo as-is. If an endpoint's shape changes
 * on the backend, this file and `API_GUIDE.md` are what must be updated.
 *
 * Backend source of truth:
 *   src/validators/*.ts      request shapes
 *   src/models/*.ts          response document shapes
 *   src/utils/apiResponse.ts success envelope
 *   src/middleware/errorHandler.ts  error envelope
 *
 * CANONICAL SOURCE: https://api.napomnyane.eu/guide/api-types.ts
 * This file must live in the frontend repo to compile against, so it is a copy.
 * When the API contract changes, re-fetch it from the URL above and diff rather
 * than hand-patching - the served copy is always current with the deployment.
 */

/* -------------------------------------------------------------------------- */
/* Envelope                                                                    */
/* -------------------------------------------------------------------------- */

export interface ApiSuccess<T> {
  ok: true;
  status: number;
  /** Absent on 200s that carry no payload (login, refresh) and on 204s. */
  data?: T;
}

export interface ApiFailure {
  ok: false;
  status: number;
  message: string;
  /** Present on errors from the central error handler; absent on 401/403 from
   *  the auth middleware and on 429 from the rate limiters. */
  requestId?: string;
}

/** Shape of a 401/403 emitted by the auth middleware — note: no envelope. */
export interface BareMessage {
  message: string;
}

export interface Paginated<T> {
  items: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

/* -------------------------------------------------------------------------- */
/* Professional                                                                */
/* -------------------------------------------------------------------------- */

export interface RegisterRequest {
  email: string;
  /** min 8 characters */
  password: string;
  profession?: string;
}

export interface RegisterResponse {
  id: string;
  email: string;
  profession: string;
  /** Non-production only. Never present against api.napomnyane.eu. */
  verificationToken?: string;
}

export interface LoginRequest {
  email: string;
  /** min 8 characters */
  password: string;
}

/** `POST /login` and `POST /refresh` return `{ ok, status }` with no `data`. */
export type LoginResponse = void;

/**
 * `GET /professionals/me` — NOT enveloped. The body is this object directly.
 * `user` is the decoded JWT payload, so it carries nothing beyond id + email.
 */
export interface MeResponse {
  message: string;
  user: {
    userId: string;
    email: string;
    iat?: number;
    iatMs?: number;
    exp?: number;
  };
}

export interface MessageResponse {
  message: string;
}

export interface ForgotPasswordRequest {
  email: string;
}

export interface ResetPasswordRequest {
  token: string;
  /** min 8 characters */
  password: string;
}

/** `POST /change-password` — auth + CSRF required. On success, all three auth cookies are re-issued. */
export interface ChangePasswordRequest {
  currentPassword: string;
  /** min 8 characters, must differ from currentPassword */
  newPassword: string;
}

export interface VerifyEmailRequest {
  token: string;
}

export interface ResendVerificationRequest {
  email: string;
}

export interface ResendVerificationResponse {
  message: string;
  /** Non-production only, and only when a token was actually reissued. */
  verificationToken?: string;
}

/* -------------------------------------------------------------------------- */
/* Customer                                                                    */
/* -------------------------------------------------------------------------- */

export interface Customer {
  _id: string;
  firstName: string;
  lastName: string;
  /** Stored international format with no leading '+', e.g. "359888123456". */
  phone: string;
  email?: string;
  professional: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCustomerRequest {
  firstName: string;
  lastName: string;
  /** A 10-char string starting with '0' is rewritten to 359 + last 9 digits. */
  phone: string;
  email?: string;
}

/** At least one field required. Unknown keys are rejected with 400. */
export type UpdateCustomerRequest = Partial<CreateCustomerRequest>;

export interface ListCustomersQuery {
  /** Case-insensitive substring, matched against firstName OR lastName. */
  name?: string;
  /** Normalized like a stored phone, then matched as a substring. */
  phone?: string;
  /** 1-based. */
  page?: number;
  /** Default 50, max 200. */
  limit?: number;
}

/* -------------------------------------------------------------------------- */
/* Appointment                                                                 */
/* -------------------------------------------------------------------------- */

export const APPOINTMENT_STATUSES = [
  "scheduled",
  "completed",
  "cancelled",
  "no-show",
] as const;

export type AppointmentStatus = (typeof APPOINTMENT_STATUSES)[number];

/** The subset of Customer that GET /appointments populates. */
export interface PopulatedCustomer {
  _id: string;
  firstName: string;
  lastName: string;
  phone: string;
  email?: string;
}

interface AppointmentBase {
  _id: string;
  professional: string;
  /** ISO datetime, UTC. End time is start + duration minutes — not a field. */
  start: string;
  /** Minutes, integer >= 1. */
  duration: number;
  service?: string;
  notes?: string;
  status: AppointmentStatus;
  reminderSent: boolean;
  reminderAttempts: number;
  reminderNextAttemptAt: string | null;
  reminderClaimedUntil: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Returned by GET /appointments and GET /appointments/:id. */
export interface Appointment extends AppointmentBase {
  customer: PopulatedCustomer;
}

/** Returned by POST and PATCH /appointments — customer is NOT populated. */
export interface AppointmentUnpopulated extends AppointmentBase {
  customer: string;
}

export interface CreateAppointmentRequest {
  /** Customer ObjectId. Must belong to the authenticated professional. */
  customer: string;
  /** Full ISO datetime with offset or Z. Must be strictly in the future. */
  start: string;
  duration: number;
  service?: string;
  notes?: string;
}

/** At least one field required. Unknown keys are rejected with 400. */
export type UpdateAppointmentRequest = Partial<CreateAppointmentRequest> & {
  status?: AppointmentStatus;
};

/**
 * At most ONE of: `start`, (`from` and/or `to`), `range`.
 * Combining two returns 400.
 *
 * NOTE the collision: `start` here is a DATE (YYYY-MM-DD) meaning "that whole
 * UTC day", whereas `start` on CreateAppointmentRequest is a full datetime.
 */
export interface ListAppointmentsQuery {
  /** YYYY-MM-DD — a single UTC day. */
  start?: string;
  /** YYYY-MM-DD */
  from?: string;
  /** YYYY-MM-DD */
  to?: string;
  /** UTC-anchored: today, Monday-Sunday of this week, or this calendar month. */
  range?: "today" | "week" | "month";
  /** Customer ObjectId. Independent of the date filters. */
  customer?: string;
  /** 1-based. */
  page?: number;
  /** Default 100, max 500. */
  limit?: number;
}

/* -------------------------------------------------------------------------- */
/* Health                                                                      */
/* -------------------------------------------------------------------------- */

/** GET /health — not under /api/v1, not enveloped. 503 when Mongo is down. */
export interface HealthResponse {
  status: "ok" | "error";
  db: string;
}
