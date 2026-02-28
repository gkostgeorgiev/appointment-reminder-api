import { Request, Response, NextFunction } from "express";
import { ZodType, ZodError, z } from "zod";

export const validate =
  <T>(schema: ZodType<T>) =>
  (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = schema.parse({
        body: req.body,
        params: req.params,
        query: req.query,
      });

      req.validated = parsed; // store safely

      next();
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          message: "Validation failed",
          errors: z.treeifyError(error),
        });
      }

      return res.status(500).json({ message: "Unexpected error" });
    }
  };