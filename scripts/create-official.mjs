import postgres from "postgres";
import { hashPassword } from "better-auth/crypto";
import { randomUUID } from "node:crypto";
import { z } from "zod";
// Credentials arrive through stdin; never via arguments, logs or a remote disk file.
let input = "";
for await (const chunk of process.stdin) {
  input += chunk;
  if (input.length > 4096) throw new Error("凭据输入过长");
}
const { email, password } = z
  .object({
    email: z
      .string()
      .email()
      .transform((v) => v.toLowerCase()),
    password: z.string().min(16).max(128),
  })
  .parse(JSON.parse(input));
const sql = postgres(process.env.DATABASE_URL, { max: 1 });
try {
  const hash = await hashPassword(password);
  const result = await sql.begin(async (tx) => {
    await tx`LOCK TABLE "user" IN SHARE ROW EXCLUSIVE MODE`;
    const existing =
      await tx`SELECT id,email,is_official FROM "user" WHERE lower(email)=${email} OR is_official=true`;
    if (existing.length)
      throw new Error(
        "官方账户或邮箱已存在；不会提升普通账户权限或覆盖现有密码",
      );
    const id = randomUUID();
    await tx`INSERT INTO "user" (id,name,email,email_verified,is_official,created_at,updated_at) VALUES(${id},'official',${email},false,true,now(),now())`;
    await tx`INSERT INTO account (id,account_id,provider_id,user_id,password,created_at,updated_at) VALUES(${randomUUID()},${id},'credential',${id},${hash},now(),now())`;
    return { id, email, created: true };
  });
  console.log(JSON.stringify(result));
} finally {
  await sql.end();
}
