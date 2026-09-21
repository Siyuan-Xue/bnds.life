import { env } from "~/env";
import { db } from "~/server/db";
import { createSiteAuth } from "./options";

export const auth = createSiteAuth(
  db,
  env.BETTER_AUTH_URL,
  env.BETTER_AUTH_SECRET,
);
export type Session = typeof auth.$Infer.Session;
