import { env } from "cloudflare:workers";
import { storage } from "./database";
import type { AuthUser, UserRole } from "./auth-types";

const COOKIE_NAME = "satya_session";
const SESSION_SECONDS = 60 * 60 * 12;
// Cloudflare Workers supports PBKDF2 iteration counts up to 100,000.
// Keep this at the platform-supported ceiling so account creation and login
// behave consistently in the deployed Worker as well as local development.
const PASSWORD_ITERATIONS = 100_000;
const encoder = new TextEncoder();

type StoredUser = AuthUser & {
  passwordHash: string;
  active: number;
};

function bytesToBase64Url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/g, "");
}

function base64UrlToBytes(value: string): Uint8Array<ArrayBuffer> {
  const padded = value.replaceAll("-", "+").replaceAll("_", "/") + "=".repeat((4 - (value.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

function safeEqual(left: Uint8Array, right: Uint8Array) {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index++) difference |= left[index] ^ right[index];
  return difference === 0;
}

async function derivePassword(password: string, salt: Uint8Array<ArrayBuffer>, iterations = PASSWORD_ITERATIONS) {
  const material = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations }, material, 256);
  return new Uint8Array(bits);
}

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function validPassword(password: string) {
  return password.length >= 12 && password.length <= 128 && /[A-Za-z]/.test(password) && /\d/.test(password);
}

export async function hashPassword(password: string) {
  const salt: Uint8Array<ArrayBuffer> = crypto.getRandomValues(new Uint8Array(16));
  const derived = await derivePassword(password, salt);
  return `pbkdf2-sha256$${PASSWORD_ITERATIONS}$${bytesToBase64Url(salt)}$${bytesToBase64Url(derived)}`;
}

export async function verifyPassword(password: string, stored: string) {
  const [scheme, count, saltValue, expectedValue] = stored.split("$");
  const iterations = Number(count);
  if (scheme !== "pbkdf2-sha256" || !Number.isInteger(iterations) || iterations < 100_000 || !saltValue || !expectedValue) return false;
  try {
    const actual = await derivePassword(password, base64UrlToBytes(saltValue), iterations);
    return safeEqual(actual, base64UrlToBytes(expectedValue));
  } catch {
    return false;
  }
}

function parseCookies(request: Request) {
  const cookie = request.headers.get("cookie") ?? "";
  return Object.fromEntries(cookie.split(";").map(part => {
    const separator = part.indexOf("=");
    return separator < 0 ? ["", ""] : [part.slice(0, separator).trim(), part.slice(separator + 1).trim()];
  }));
}

async function hashToken(token: string) {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(token));
  return bytesToBase64Url(new Uint8Array(digest));
}

function rowToUser(row: StoredUser): AuthUser {
  return { id: row.id, email: row.email, displayName: row.displayName, role: row.role };
}

export function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  return !origin || origin === new URL(request.url).origin;
}

export function sessionCookie(request: Request, token: string) {
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  return `${COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_SECONDS}${secure}`;
}

export function clearedSessionCookie(request: Request) {
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  return `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`;
}

export async function currentUser(request: Request): Promise<AuthUser | null> {
  const token = parseCookies(request)[COOKIE_NAME];
  if (!token || token.length < 32) return null;
  const tokenHash = await hashToken(token);
  const now = new Date().toISOString();
  const { DB } = storage();
  const row = await DB.prepare(`SELECT users.id, users.email, users.display_name AS displayName, users.role, users.password_hash AS passwordHash, users.active
    FROM user_sessions
    INNER JOIN users ON users.id = user_sessions.user_id
    WHERE user_sessions.token_hash = ? AND user_sessions.expires_at > ? AND users.active = 1`)
    .bind(tokenHash, now)
    .first<StoredUser>();
  return row ? rowToUser(row) : null;
}

export async function findUserByEmail(email: string): Promise<StoredUser | null> {
  const { DB } = storage();
  return DB.prepare(`SELECT id, email, display_name AS displayName, role, password_hash AS passwordHash, active
    FROM users WHERE email = ?`).bind(normalizeEmail(email)).first<StoredUser>();
}

export async function createUser(input: { email: string; displayName: string; password: string; role: UserRole }) {
  const { DB } = storage();
  const user: AuthUser = {
    id: crypto.randomUUID(),
    email: normalizeEmail(input.email),
    displayName: input.displayName.trim(),
    role: input.role,
  };
  const passwordHash = await hashPassword(input.password);
  const createdAt = new Date().toISOString();
  await DB.prepare("INSERT INTO users (id, email, display_name, password_hash, role, active, created_at) VALUES (?, ?, ?, ?, ?, 1, ?)")
    .bind(user.id, user.email, user.displayName, passwordHash, user.role, createdAt)
    .run();
  return user;
}

export async function createSession(user: AuthUser) {
  const { DB } = storage();
  const token = bytesToBase64Url(crypto.getRandomValues(new Uint8Array(32)));
  const createdAt = new Date();
  const expiresAt = new Date(createdAt.getTime() + SESSION_SECONDS * 1000);
  await DB.batch([
    DB.prepare("DELETE FROM user_sessions WHERE expires_at <= ?").bind(createdAt.toISOString()),
    DB.prepare("INSERT INTO user_sessions (id, user_id, token_hash, expires_at, created_at) VALUES (?, ?, ?, ?, ?)")
      .bind(crypto.randomUUID(), user.id, await hashToken(token), expiresAt.toISOString(), createdAt.toISOString()),
  ]);
  return token;
}

export async function deleteCurrentSession(request: Request) {
  const token = parseCookies(request)[COOKIE_NAME];
  if (!token) return;
  const { DB } = storage();
  await DB.prepare("DELETE FROM user_sessions WHERE token_hash = ?").bind(await hashToken(token)).run();
}

export async function userCount() {
  const { DB } = storage();
  const row = await DB.prepare("SELECT COUNT(*) AS count FROM users").first<{ count: number }>();
  return Number(row?.count ?? 0);
}

export function bootstrapKey() {
  return (env as unknown as { AUTH_BOOTSTRAP_KEY?: string }).AUTH_BOOTSTRAP_KEY;
}

export function canAccessInspection(user: AuthUser, ownerUserId: string | null) {
  return user.role === "ADMIN" || ownerUserId === user.id;
}
