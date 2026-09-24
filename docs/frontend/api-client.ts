/**
 * Appointment Reminder API — reference client.
 *
 * Framework-agnostic, zero dependencies, browser-only (it reads document.cookie).
 * Copy this file into the frontend repo and build on top of it — do not
 * reimplement the transport layer. It encodes four rules that are easy to get
 * wrong and hard to debug:
 *
 *   1. credentials: "include" on every request (auth is cookie-only)
 *   2. x-csrf-token echoed from the csrfToken cookie on every mutation
 *   3. a single-flight 401 -> refresh -> retry-once recovery
 *   4. unwrapping the { ok, status, data } envelope, including the endpoints
 *      that don't use it
 *
 * See API_GUIDE.md for the why behind each of those.
 *
 * CANONICAL SOURCE: https://api.napomnyane.eu/guide/api-client.ts
 * This file must live in the frontend repo to compile against, so it is a copy.
 * When the API contract changes, re-fetch it from the URL above and diff rather
 * than hand-patching - the served copy is always current with the deployment.
 */

import type {
  ApiFailure,
  Appointment,
  AppointmentUnpopulated,
  ChangePasswordRequest,
  CreateAppointmentRequest,
  CreateCustomerRequest,
  Customer,
  ForgotPasswordRequest,
  HealthResponse,
  ListAppointmentsQuery,
  ListCustomersQuery,
  LoginRequest,
  MeResponse,
  MessageResponse,
  Paginated,
  RegisterRequest,
  RegisterResponse,
  ResendVerificationRequest,
  ResendVerificationResponse,
  ResetPasswordRequest,
  UpdateAppointmentRequest,
  UpdateCustomerRequest,
  VerifyEmailRequest,
} from "./api-types.js";

/* -------------------------------------------------------------------------- */
/* Configuration                                                               */
/* -------------------------------------------------------------------------- */

/**
 * Origin only, no trailing slash and no /api/v1 suffix — the prefix is added
 * below. Override it once at app start from whatever the chosen framework
 * exposes, e.g.:
 *
 *   configureApi({ origin: import.meta.env.VITE_API_ORIGIN });
 *
 * Left as a runtime setting rather than reading a build-time global directly,
 * so this file stays framework-agnostic and typechecks in a plain DOM project.
 */
let apiOrigin = "https://api.napomnyane.eu";

export const configureApi = (config: { origin: string }) => {
  apiOrigin = config.origin.replace(/\/+$/, "");
};

const apiBase = () => `${apiOrigin}/api/v1`;

const CSRF_COOKIE = "csrfToken";
const CSRF_HEADER = "x-csrf-token";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/* -------------------------------------------------------------------------- */
/* Errors                                                                      */
/* -------------------------------------------------------------------------- */

export class ApiError extends Error {
  readonly status: number;
  /** Present only on errors from the central error handler. */
  readonly requestId?: string;

  constructor(status: number, message: string, requestId?: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.requestId = requestId;
  }

  /** CSRF failure vs. unverified-email login — both are 403, different UI. */
  get isCsrfFailure() {
    return this.status === 403 && /csrf/i.test(this.message);
  }

  get isUnverifiedEmail() {
    return this.status === 403 && /verify your email/i.test(this.message);
  }

  get isRateLimited() {
    return this.status === 429;
  }

  /** Overlap, duplicate phone, or customer-has-appointments — check the call site. */
  get isConflict() {
    return this.status === 409;
  }
}

/**
 * Called when a 401 survives a refresh attempt — i.e. the session is really
 * gone. Wire this to your router/auth store once, at app start.
 */
let onSessionExpired: () => void = () => {};

export const setSessionExpiredHandler = (handler: () => void) => {
  onSessionExpired = handler;
};

/* -------------------------------------------------------------------------- */
/* Internals                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * The csrfToken cookie is deliberately not httpOnly so it can be read here.
 * It is re-issued on every login and every refresh, so it must be read at
 * request time rather than cached.
 */
const readCsrfToken = (): string | undefined => {
  if (typeof document === "undefined") return undefined;

  const match = document.cookie
    .split("; ")
    .find((row) => row.startsWith(`${CSRF_COOKIE}=`));

  return match ? decodeURIComponent(match.slice(CSRF_COOKIE.length + 1)) : undefined;
};

const buildQuery = (params?: Record<string, unknown>): string => {
  if (!params) return "";

  const search = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") {
      search.set(key, String(value));
    }
  }

  const qs = search.toString();
  return qs ? `?${qs}` : "";
};

/**
 * Single-flight refresh. Without this, N requests expiring together each fire
 * their own refresh; the backend rotates the refresh token on the first one,
 * so the other N-1 get a 401 and log the user out.
 */
let refreshInFlight: Promise<boolean> | null = null;

const refreshSession = (): Promise<boolean> => {
  if (!refreshInFlight) {
    refreshInFlight = fetch(`${apiBase()}/professionals/refresh`, {
      method: "POST",
      credentials: "include",
    })
      .then((res) => res.ok)
      .catch(() => false)
      .finally(() => {
        refreshInFlight = null;
      });
  }

  return refreshInFlight;
};

interface RequestOptions {
  method?: string;
  body?: unknown;
  query?: Record<string, unknown>;
  /** Endpoints that return a bare body instead of { ok, status, data }. */
  unenveloped?: boolean;
  /** Internal: prevents an infinite refresh loop. */
  _isRetry?: boolean;
}

const parseError = async (res: Response): Promise<ApiError> => {
  let message = res.statusText || "Request failed";
  let requestId: string | undefined;

  try {
    // Covers all three error shapes: the full envelope, the rate limiter's
    // envelope-without-requestId, and the auth middleware's bare { message }.
    const body = (await res.json()) as Partial<ApiFailure>;
    if (typeof body?.message === "string") message = body.message;
    if (typeof body?.requestId === "string") requestId = body.requestId;
  } catch {
    // Non-JSON body (e.g. a proxy error page) — keep the status text.
  }

  return new ApiError(res.status, message, requestId);
};

const request = async <T>(path: string, options: RequestOptions = {}): Promise<T> => {
  const method = options.method ?? "GET";
  const headers: Record<string, string> = {};

  if (options.body !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  if (!SAFE_METHODS.has(method)) {
    const csrf = readCsrfToken();
    if (csrf) headers[CSRF_HEADER] = csrf;
  }

  const res = await fetch(`${apiBase()}${path}${buildQuery(options.query)}`, {
    method,
    headers,
    // Non-negotiable: the auth cookies are never sent without it.
    credentials: "include",
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });

  if (res.status === 401 && !options._isRetry) {
    const refreshed = await refreshSession();

    if (refreshed) {
      return request<T>(path, { ...options, _isRetry: true });
    }

    onSessionExpired();
    throw await parseError(res);
  }

  if (!res.ok) {
    throw await parseError(res);
  }

  // DELETE returns 204 with no body — calling .json() here would throw.
  if (res.status === 204) {
    return undefined as T;
  }

  const body = await res.json();

  // GET /me and /health return a bare object rather than the envelope.
  return (options.unenveloped ? body : body?.data) as T;
};

/* -------------------------------------------------------------------------- */
/* Professionals                                                               */
/* -------------------------------------------------------------------------- */

export const auth = {
  /** Creates the account but does NOT log in — the email must be verified first. */
  register: (body: RegisterRequest) =>
    request<RegisterResponse>("/professionals/register", { method: "POST", body }),

  verifyEmail: (body: VerifyEmailRequest) =>
    request<MessageResponse>("/professionals/verify-email", { method: "POST", body }),

  resendVerification: (body: ResendVerificationRequest) =>
    request<ResendVerificationResponse>("/professionals/resend-verification", {
      method: "POST",
      body,
    }),

  /** Sets the token/csrfToken/refreshToken cookies. Returns no user data —
   *  call `auth.me()` afterwards if the UI needs the account. */
  login: (body: LoginRequest) =>
    request<void>("/professionals/login", { method: "POST", body }),

  logout: () => request<MessageResponse>("/professionals/logout", { method: "POST" }),

  /** Requires the current password, not a reset token. Re-issues all three
   *  cookies on success — re-read csrfToken afterward, same as login/refresh. */
  changePassword: (body: ChangePasswordRequest) =>
    request<MessageResponse>("/professionals/change-password", { method: "POST", body }),

  /** Not enveloped, and carries only what's in the JWT (userId + email). */
  me: () => request<MeResponse>("/professionals/me", { unenveloped: true }),

  /** Always 200 with a generic message — never reveals whether the account exists. */
  forgotPassword: (body: ForgotPasswordRequest) =>
    request<MessageResponse>("/professionals/forgot-password", { method: "POST", body }),

  resetPassword: (body: ResetPasswordRequest) =>
    request<MessageResponse>("/professionals/reset-password", { method: "POST", body }),
};

/* -------------------------------------------------------------------------- */
/* Customers                                                                   */
/* -------------------------------------------------------------------------- */

export const customers = {
  list: (query?: ListCustomersQuery) =>
    request<Paginated<Customer>>("/customers", { query: query as Record<string, unknown> }),

  get: (id: string) => request<Customer>(`/customers/${id}`),

  create: (body: CreateCustomerRequest) =>
    request<Customer>("/customers", { method: "POST", body }),

  /** Send only changed fields — unknown keys are rejected with 400. */
  update: (id: string, body: UpdateCustomerRequest) =>
    request<Customer>(`/customers/${id}`, { method: "PATCH", body }),

  /** 409 if the customer still has `scheduled` appointments. */
  remove: (id: string) => request<void>(`/customers/${id}`, { method: "DELETE" }),
};

/* -------------------------------------------------------------------------- */
/* Appointments                                                                */
/* -------------------------------------------------------------------------- */

export const appointments = {
  /** Customer is populated here. With no date filter: -7d to +30d rolling window. */
  list: (query?: ListAppointmentsQuery) =>
    request<Paginated<Appointment>>("/appointments", {
      query: query as Record<string, unknown>,
    }),

  get: (id: string) => request<Appointment>(`/appointments/${id}`),

  /** Returns the appointment with `customer` as a bare id, NOT populated. */
  create: (body: CreateAppointmentRequest) =>
    request<AppointmentUnpopulated>("/appointments", { method: "POST", body }),

  /** Also unpopulated. 409 on overlap. Send only changed fields. */
  update: (id: string, body: UpdateAppointmentRequest) =>
    request<AppointmentUnpopulated>(`/appointments/${id}`, { method: "PATCH", body }),

  remove: (id: string) => request<void>(`/appointments/${id}`, { method: "DELETE" }),
};

/* -------------------------------------------------------------------------- */
/* Misc                                                                        */
/* -------------------------------------------------------------------------- */

/** Not under /api/v1 and not enveloped, so it bypasses `request`. */
export const health = async (): Promise<HealthResponse> => {
  const res = await fetch(`${apiOrigin}/health`, { credentials: "include" });
  return (await res.json()) as HealthResponse;
};

/** End time is not a field on the appointment — derive it. */
export const getAppointmentEnd = (start: string, durationMinutes: number): Date =>
  new Date(new Date(start).getTime() + durationMinutes * 60_000);

export const api = { auth, customers, appointments, health };
