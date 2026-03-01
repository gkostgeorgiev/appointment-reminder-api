declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
      validated?: {
        body?: unknown;
        query?: unknown;
        params?: unknown;
      };
    }
  }
}

export {};
