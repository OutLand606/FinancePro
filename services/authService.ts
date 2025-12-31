import { UserContext, LoginResponse } from "../types";
import { api } from "./api";

const TOKEN_KEY = "access_token";
const REFRESH_KEY = "refresh_token";

// Helper để giải mã Base64 sang Unicode/Tiếng Việt
const b64_to_utf8 = (str: string) => {
  return decodeURIComponent(escape(window.atob(str)));
};

const parseJwt = (token: string): any => {
  try {
    const base64Url = token.split(".")[1];
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    // Sử dụng hàm helper b64_to_utf8 để giải mã đúng tiếng Việt
    const jsonPayload = b64_to_utf8(base64);
    return JSON.parse(jsonPayload);
  } catch (e) {
    return null;
  }
};

export const loginWithEmail = async (
  email: string,
  password?: string
): Promise<UserContext> => {
  // --- REAL API CALL ---
  const res = await api.post<LoginResponse>("/auth/login", {
    email,
    password,
  });
  if (res.success && res.data) {
    localStorage.setItem(TOKEN_KEY, res.data.tokens.accessToken);
    localStorage.setItem(REFRESH_KEY, res.data.tokens.refreshToken);
    return res.data.user;
  }
  throw new Error(res.message || "Login failed");
};

export const logout = () => {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_KEY);
  // Legacy cleanup
  localStorage.removeItem("finance_user_session");
  window.location.reload();
};

export const checkSession = (): UserContext | null => {
  try {
    const token = localStorage.getItem(TOKEN_KEY);

    if (!token) return null;
    const decoded = parseJwt(token);

    if (!decoded || !decoded.context) return null;
    let expInMillis = decoded.exp;

    if (decoded.exp && decoded.exp.toString().length === 10) {
      expInMillis = decoded.exp * 1000;
    }

    if (Date.now() > expInMillis) {
      console.warn("Token expired (Real Backend), logging out...");
      logout();
      return null;
    }

    if (!localStorage.getItem(TOKEN_KEY)) {
      localStorage.setItem(TOKEN_KEY, token);
    }

    return decoded.context as UserContext;
  } catch (e) {
    console.error("Session check failed:", e);
    return null;
  }
};

export const hasPermission = (
  user: UserContext | null,
  permission: string
): boolean => {
  if (!user || !user.isAuthenticated) return false;

  // Safe check: Đảm bảo permissions luôn là mảng
  const perms = user.permissions || [];

  if (perms.includes("SYS_ADMIN")) return true;
  return perms.includes(permission);
};

export const canAccessProject = (
  user: UserContext | null,
  projectManagerId?: string
): boolean => {
  if (!user) return false;
  if (hasPermission(user, "PROJECT_VIEW_ALL")) return true;
  if (hasPermission(user, "PROJECT_VIEW_OWN")) {
    const isDirectManager = projectManagerId === user.id;
    // Safe check cho managedProjectIds
    const projects = user.managedProjectIds || [];
    return (
      isDirectManager ||
      projects.includes("ALL") ||
      projects.includes(projectManagerId || "")
    );
  }
  return false;
};

export const isProjectManager = (
  user: UserContext,
  projectId: string
): boolean => {
  if (user.managedProjectIds.includes(projectId)) return true;
  return false;
};
