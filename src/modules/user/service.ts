const bcrypt: any = require("bcrypt");
import { AppError } from "../../core/errors";
import { signToken } from "../../core/middleware/session";
import prisma from "../../lib/prisma";

const BCRYPT_ROUNDS = Number(process.env.BCRYPT_ROUNDS) || 12;

export async function registerUser(
  email: string,
  name: string | null,
  password: string,
  role = "user",
) {
  const hash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  return prisma.users.create({
    data: {
      email,
      name,
      password_hash: hash,
      role,
    },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
    },
  });
}

export async function findUserByEmail(email: string) {
  return prisma.users.findUnique({
    where: { email },
  });
}

export async function verifyPassword(plain: string, hash: string) {
  try {
    return await bcrypt.compare(plain, hash);
  } catch (e) {
    return false;
  }
}

export async function createSessionToken(user: any) {
  // sub = user id
  return signToken(
    { sub: user.id, email: user.email, role: user.role },
    { expiresIn: "2h" },
  );
}

export async function register(input: {
  email?: string;
  name?: string | null;
  password?: string;
  role?: string;
}) {
  if (!input.email || !input.password) {
    throw AppError.BadRequest("missing_credentials", "Missing credentials");
  }

  const exists = await findUserByEmail(input.email);
  if (exists) {
    throw new AppError("user_exists", "User already exists", 409);
  }

  const created = await registerUser(
    input.email,
    input.name || null,
    input.password,
    input.role || "user",
  );

  return { user: created };
}

export async function login(input: { email?: string; password?: string }) {
  if (!input.email || !input.password) {
    throw AppError.BadRequest("missing_credentials", "Missing credentials");
  }

  const user = await findUserByEmail(input.email);
  if (!user || !user.password_hash) {
    throw AppError.Unauthorized("invalid_credentials", "Invalid credentials");
  }

  const ok = await verifyPassword(input.password, user.password_hash);
  if (!ok) {
    throw AppError.Unauthorized("invalid_credentials", "Invalid credentials");
  }

  const token = await createSessionToken(user);
  return {
    token,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    },
  };
}
