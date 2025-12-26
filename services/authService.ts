import { UserContext, Employee, LoginResponse, AuthTokens } from "../types";
import { getEmployees } from "./employeeService";
import { getSystemRoles } from "./systemConfigService";
import { api, USE_MOCK_BACKEND } from "./api";
import { MOCK_EMPLOYEES_LIST } from "../constants";

const TOKEN_KEY = "access_token";
const REFRESH_KEY = "refresh_token";

// --- MOCK JWT GENERATOR ---
// Helper để mã hóa Unicode/Tiếng Việt sang Base64 an toàn
const utf8_to_b64 = (str: string) => {
  return window.btoa(unescape(encodeURIComponent(str)));
};

// Helper để giải mã Base64 sang Unicode/Tiếng Việt
const b64_to_utf8 = (str: string) => {
  return decodeURIComponent(escape(window.atob(str)));
};

const generateMockJwt = (user: UserContext): string => {
  const header = btoa(JSON.stringify({ alg: "HS256", typ: "JWT" }));

  // Sử dụng hàm helper utf8_to_b64 thay vì btoa trực tiếp
  const payloadJson = JSON.stringify({
    sub: user.id,
    name: user.name,
    role: user.roleId,
    context: user,
    exp: Date.now() + 86400000,
  });

  const payload = utf8_to_b64(payloadJson);
  const signature = "MOCK_SIGNATURE_SECRET";
  return `${header}.${payload}.${signature}`;
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
  if (USE_MOCK_BACKEND) {
    // --- MOCK BACKEND LOGIC ---
    // Trong thực tế, đoạn này nằm ở Server Controller
    await new Promise((resolve) => setTimeout(resolve, 600)); // Network delay

    let employees = await getEmployees();

    // FAILSAFE: Luôn đảm bảo tài khoản ec.thaibinhduong@gmail.com tồn tại và có quyền Admin
    const DEFAULT_ADMIN_EMAIL = "ec.thaibinhduong@gmail.com";
    const hasDefaultAdmin = employees.some(
      (e) => e.email.toLowerCase() === DEFAULT_ADMIN_EMAIL.toLowerCase()
    );

    if (!hasDefaultAdmin) {
      console.warn(
        "⚠️ Warning: Default Admin missing. Injecting for recovery."
      );
      // Merge default list so login works
      employees = [...employees, ...MOCK_EMPLOYEES_LIST];
    }

    const roles = await getSystemRoles();

    const emp = employees.find(
      (e) => e.email.toLowerCase() === email.toLowerCase()
    );

    if (!emp)
      throw new Error(
        "Email không tồn tại trong hệ thống. Vui lòng dùng email mặc định (ec.thaibinhduong@gmail.com)."
      );
    if (emp.status !== "ACTIVE")
      throw new Error("Tài khoản nhân viên đã bị khóa.");

    // Password Check (Optional for the default admin for ease of use)
    if (emp.password && email !== DEFAULT_ADMIN_EMAIL) {
      if (!password) throw new Error("Vui lòng nhập mật khẩu.");
      if (emp.password !== password) throw new Error("Mật khẩu không đúng.");
    }

    const userRole = roles.find((r) => r.id === emp.roleId);

    const userContext: UserContext = {
      id: emp.id,
      name: emp.fullName,
      email: emp.email,
      roleId: emp.roleId,
      roleName: userRole ? userRole.name : "Unknown",
      permissions: userRole ? userRole.permissions : [],
      managedProjectIds: emp.managedProjectIds || [],
      isAuthenticated: true,
      avatarUrl:
        emp.avatarUrl ||
        `https://ui-avatars.com/api/?name=${encodeURIComponent(
          emp.fullName
        )}&background=random`,
    };

    // GENERATE TOKENS
    const accessToken = generateMockJwt(userContext);
    const refreshToken = `mock_refresh_${Date.now()}`;

    // SAVE TOKENS (Client Side)
    localStorage.setItem(TOKEN_KEY, accessToken);
    localStorage.setItem(REFRESH_KEY, refreshToken);

    return userContext;
  } else {
    console.log("backend run");
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
  }
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
