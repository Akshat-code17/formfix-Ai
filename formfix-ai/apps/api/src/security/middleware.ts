import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import type { RequestHandler } from "express";
import type { Store } from "../repositories/store.js";
import type { Settings } from "../config.js";
import { AppError } from "./errors.js";
export function safeEqual(a: string, b: string) {
  const aa = Buffer.from(a),
    bb = Buffer.from(b);
  return aa.length === bb.length && timingSafeEqual(aa, bb);
}
export function signed(id: string, c: Settings) {
  return (
    id + "." + createHmac("sha256", c.SESSION_SECRET).update(id).digest("hex")
  );
}
export function cookieOwner(value: unknown, c: Settings) {
  if (typeof value !== "string") return "";
  const [id] = value.split(".");
  return /^[a-f0-9-]{36}$/.test(id) && safeEqual(value, signed(id, c))
    ? id
    : "";
}
export const requestLog: RequestHandler = (req, res, next) => {
  res.locals.requestId = randomUUID();
  res.setHeader("X-Request-ID", res.locals.requestId);
  const start = Date.now();
  res.on("finish", () =>
    console.info(
      JSON.stringify({
        requestId: res.locals.requestId,
        method: req.method,
        operation: req.route?.path ?? "unmatched",
        status: res.statusCode,
        ms: Date.now() - start,
      }),
    ),
  );
  next();
};
export function auth(store: Store, c: Settings): RequestHandler {
  return async (req, res, next) => {
    try {
      const owner = cookieOwner(req.cookies?.ff_session, c);
      if (!owner)
        throw new AppError(
          401,
          "SESSION_REQUIRED",
          "Create a guest session first.",
        );
      const guest = await store.guest(owner);
      res.locals.owner = owner;
      res.locals.guest = guest;
      if (!["GET", "HEAD", "OPTIONS"].includes(req.method)) {
        if (
          req.get("origin") !== c.APP_ORIGIN ||
          !safeEqual(req.get("x-csrf-token") ?? "", guest.csrf)
        )
          throw new AppError(
            403,
            "CSRF_REJECTED",
            "Origin and CSRF token are required.",
          );
      }
      next();
    } catch (e) {
      next(e);
    }
  };
}
export function ipLimit(
  store: Store,
  c: Settings,
  limit = c.IP_REQUESTS_PER_MINUTE,
): RequestHandler {
  return async (req, _res, next) => {
    try {
      const minute = Math.floor(Date.now() / 60000);
      const key = createHmac("sha256", c.SESSION_SECRET)
        .update((req.ip ?? "unknown") + ":" + minute)
        .digest("hex");
      const collection = store.db.collection<{
        _id: string;
        count: number;
        expiresAt: Date;
      }>("limits");
      let result;
      try {
        result = await collection.findOneAndUpdate(
          { _id: key },
          {
            $inc: { count: 1 },
            $setOnInsert: { expiresAt: new Date(Date.now() + 120000) },
          },
          { upsert: true, returnDocument: "after" },
        );
      } catch (e: any) {
        if (e.code === 11000)
          result = await collection.findOneAndUpdate(
            { _id: key },
            { $inc: { count: 1 } },
            { returnDocument: "after" },
          );
        else throw e;
      }
      if (result!.count > limit)
        throw new AppError(
          429,
          "RATE_LIMIT",
          "Request rate limit reached.",
          true,
        );
      next();
    } catch (e) {
      next(e);
    }
  };
}
