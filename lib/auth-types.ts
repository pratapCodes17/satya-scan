export type UserRole = "ADMIN" | "INSPECTOR";

export type AuthUser = {
  id: string;
  email: string;
  displayName: string;
  role: UserRole;
};
