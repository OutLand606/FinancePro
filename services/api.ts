import { ApiResponse } from "../types";

// --- CONFIG LOADER ---
const SETTINGS_KEY = "finance_settings";

const getApiConfig = () => {
  try {
    const local = localStorage.getItem(SETTINGS_KEY);
    const settings = local ? JSON.parse(local) : {};
    return {
      useMock: false,
      baseUrl: "http://localhost:3001",
    };
  } catch {
    return { useMock: true, baseUrl: "" };
  }
};

export const USE_MOCK_BACKEND = getApiConfig().useMock;

// --- API CLIENT CORE ---
class ApiClient {
  private getHeaders(customHeaders?: Record<string, string>) {
    const token = localStorage.getItem("access_token");
    const defaultHeaders = {
      "Content-Type": "application/json",
      Authorization: token ? `Bearer ${token}` : "",
    };
    if (customHeaders) {
      return { ...defaultHeaders, ...customHeaders };
    }
    return defaultHeaders;
  }

  private resolveUrl(endpoint: string, params?: any): string {
    const { baseUrl } = getApiConfig();
    // Remove double slashes if any
    const cleanBase = baseUrl.replace(/\/$/, "");
    const cleanEndpoint = endpoint.replace(/^\//, "");
    const url = new URL(`${cleanBase}/${cleanEndpoint}`);
    if (params)
      Object.keys(params).forEach((key) =>
        url.searchParams.append(key, params[key])
      );
    return url.toString();
  }

  // --- HEALTH CHECK (Essential for VPS Deployment) ---
  async checkHealth(): Promise<boolean> {
    const config = getApiConfig();
    if (config.useMock) return true; // Mock is always healthy
    try {
      const res = await fetch(this.resolveUrl("health"), { method: "GET" });
      return res.ok;
    } catch (e) {
      console.error("Health Check Failed:", e);
      return false;
    }
  }

  async get<T>(endpoint: string, params?: any): Promise<ApiResponse<T>> {
    try {
      const res = await fetch(this.resolveUrl(endpoint, params), {
        method: "GET",
        headers: this.getHeaders(),
      });
      return await res.json();
    } catch (e: any) {
      return {
        success: false,
        message: "Network Error: " + e.message,
        data: null as any,
        timestamp: new Date().toISOString(),
      };
    }
  }

  async post<T>(
    endpoint: string,
    body: any,
    options?: { headers?: Record<string, string> }
  ): Promise<ApiResponse<T>> {
    try {
      const headers = this.getHeaders(options?.headers);

      if (body instanceof FormData) {
        delete (headers as any)["Content-Type"];
      }

      const res = await fetch(this.resolveUrl(endpoint), {
        method: "POST",
        headers: headers as any, // Cast any để tránh lỗi TS strict
        body: body instanceof FormData ? body : JSON.stringify(body),
      });
      return await res.json();
    } catch (e: any) {
      return {
        success: false,
        message: "Network Error: " + e.message,
        data: null as any,
        timestamp: new Date().toISOString(),
      };
    }
  }

  async put<T>(
    endpoint: string,
    body: any,
    options?: { headers?: Record<string, string> }
  ): Promise<ApiResponse<T>> {
    try {
      const headers = this.getHeaders(options?.headers);
      if (body instanceof FormData) delete (headers as any)["Content-Type"];

      const res = await fetch(this.resolveUrl(endpoint), {
        method: "PUT",
        headers: headers as any,
        body: body instanceof FormData ? body : JSON.stringify(body),
      });
      return await res.json();
    } catch (e: any) {
      return {
        success: false,
        message: "Network Error: " + e.message,
        data: null as any,
        timestamp: new Date().toISOString(),
      };
    }
  }

  async delete<T>(endpoint: string): Promise<ApiResponse<T>> {
    try {
      const res = await fetch(this.resolveUrl(endpoint), {
        method: "DELETE",
        headers: this.getHeaders(),
      });
      return await res.json();
    } catch (e: any) {
      return {
        success: false,
        message: "Network Error: " + e.message,
        data: null as any,
        timestamp: new Date().toISOString(),
      };
    }
  }
}

export const api = new ApiClient();
