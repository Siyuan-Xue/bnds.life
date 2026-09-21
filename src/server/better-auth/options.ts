import { betterAuth } from "better-auth";
import { APIError } from "better-auth/api";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import type { db as database } from "../db/index";

export function createSiteAuth(
  db: typeof database,
  baseURL: string,
  secret?: string,
) {
  return betterAuth({
    baseURL,
    secret,
    // Nginx overwrites X-Real-IP; the app only listens on loopback.
    advanced: { ipAddress: { ipAddressHeaders: ["x-real-ip"] } },
    database: drizzleAdapter(db, { provider: "pg" }),
    emailAndPassword: { enabled: true, requireEmailVerification: false },
    user: {
      additionalFields: {
        isOfficial: { type: "boolean", defaultValue: false, input: false },
      },
    },
    databaseHooks: {
      user: {
        create: {
          before: async (user) => {
            const name = user.name.trim();
            if (
              !name ||
              name.length > 40 ||
              name.normalize("NFKC").toLowerCase() === "official"
            )
              throw new APIError("BAD_REQUEST", {
                message: "昵称请使用 1–40 个字符，official 为保留名称",
              });
            return { data: { ...user, name, isOfficial: false } };
          },
        },
        update: {
          before: async (user) => {
            if (
              user.name !== undefined &&
              (!user.name.trim() ||
                user.name.trim().length > 40 ||
                user.name.trim().normalize("NFKC").toLowerCase() === "official")
            )
              throw new APIError("BAD_REQUEST", { message: "该昵称不可使用" });
            return { data: user };
          },
        },
      },
    },
  });
}
