
import { ApiResponse } from '../types';
import { 
    INITIAL_PROJECTS, INITIAL_TRANSACTIONS, INITIAL_PARTNERS, 
    INITIAL_CASH_ACCOUNTS, INITIAL_TIMESHEETS, INITIAL_KPI_CONFIGS,
    INITIAL_SYSTEM_ROLES, INITIAL_OFFICES, INITIAL_CONTRACTS, INITIAL_CATEGORY_MASTER,
    INITIAL_MATERIAL_MASTER, INITIAL_PRICE_RECORDS, MOCK_EMPLOYEES_LIST,
    INITIAL_ASSETS, INITIAL_INVENTORY
} from '../constants';

// --- CONFIG LOADER ---
const SETTINGS_KEY = 'finance_settings';

const getApiConfig = () => {
    try {
        const local = localStorage.getItem(SETTINGS_KEY);
        const settings = local ? JSON.parse(local) : {};
        return {
            // Priority: LocalStorage Settings > Env Var > Default
            // useMock: settings.useMockData !== undefined ? settings.useMockData : true,
            // baseUrl: settings.apiEndpoint || 'http://localhost:3001' // Default to local backend
            useMock: false,
            baseUrl: 'http://localhost:3001' // Default to local backend
        };
    } catch {
        return { useMock: true, baseUrl: '' };
    }
};

export const USE_MOCK_BACKEND = getApiConfig().useMock;

// MOCK LATENCY SIMULATION
const MOCK_DELAY = 300;

// --- MOCK DATABASE ENGINE ---
// (Mock Database Logic kept for Fallback/Demo)
class MockDatabase {
    private getTableData(table: string): any[] {
        const key = `finance_${table}`;
        try {
            const data = localStorage.getItem(key);
            const isCriticalTable = ['employees', 'system_roles', 'cash_accounts', 'kpi_configs', 'assets'].includes(table);
            
            if (!data || (data === '[]' && isCriticalTable)) {
                switch (table) {
                    case 'projects': return INITIAL_PROJECTS;
                    case 'transactions': return INITIAL_TRANSACTIONS;
                    case 'partners': return INITIAL_PARTNERS;
                    case 'cash_accounts': return INITIAL_CASH_ACCOUNTS;
                    case 'employees': return MOCK_EMPLOYEES_LIST; 
                    case 'timesheets': return INITIAL_TIMESHEETS;
                    case 'kpi_configs': return INITIAL_KPI_CONFIGS;
                    case 'system_roles': return INITIAL_SYSTEM_ROLES;
                    case 'offices': return INITIAL_OFFICES;
                    case 'contracts': return INITIAL_CONTRACTS;
                    case 'categories': return INITIAL_CATEGORY_MASTER;
                    case 'material_master': return INITIAL_MATERIAL_MASTER;
                    case 'price_records': return INITIAL_PRICE_RECORDS;
                    case 'assets': return INITIAL_ASSETS;
                    case 'inventory': return INITIAL_INVENTORY;
                    case 'inventory_logs': return [];
                    default: return [];
                }
            }
            return JSON.parse(data);
        } catch {
            return [];
        }
    }

    private saveTableData(table: string, data: any[]) {
        localStorage.setItem(`finance_${table}`, JSON.stringify(data));
    }

    async find(table: string, query?: any): Promise<any[]> {
        const rows = this.getTableData(table);
        if (!query) return rows;
        return rows.filter(row => {
            return Object.entries(query).every(([key, value]) => {
                if (value === undefined) return true;
                if (Array.isArray(value)) return value.includes(row[key]);
                return row[key] === value;
            });
        });
    }

    async findOne(table: string, id: string): Promise<any | null> {
        const rows = this.getTableData(table);
        return rows.find(r => r.id === id) || null;
    }

    async create(table: string, data: any): Promise<any> {
        const rows = this.getTableData(table);
        const newItem = { ...data }; 
        if (!newItem.id) newItem.id = `${table}_${Date.now()}_${Math.random().toString(36).substr(2,5)}`;
        rows.unshift(newItem); 
        this.saveTableData(table, rows);
        return newItem;
    }

    async createMany(table: string, items: any[]): Promise<any[]> {
        const rows = this.getTableData(table);
        const newItems = items.map(item => ({
            ...item,
            id: item.id || `${table}_${Date.now()}_${Math.random().toString(36).substr(2,5)}`
        }));
        const updatedRows = [...newItems, ...rows];
        this.saveTableData(table, updatedRows);
        return newItems;
    }

    async update(table: string, id: string, data: any): Promise<any> {
        const rows = this.getTableData(table);
        const index = rows.findIndex(r => r.id === id);
        if (index === -1) throw new Error(`${table} not found with id ${id}`);
        const updatedItem = { ...rows[index], ...data };
        rows[index] = updatedItem;
        this.saveTableData(table, rows);
        return updatedItem;
    }

    async delete(table: string, id: string): Promise<boolean> {
        const rows = this.getTableData(table);
        const filtered = rows.filter(r => r.id !== id);
        this.saveTableData(table, filtered);
        return true;
    }
}

const db = new MockDatabase();

// --- API CLIENT CORE ---
class ApiClient {
    private getHeaders() {
        const token = localStorage.getItem('access_token');
        return {
            'Content-Type': 'application/json',
            'Authorization': token ? `Bearer ${token}` : ''
        };
    }

    private resolveUrl(endpoint: string, params?: any): string {
        const { baseUrl } = getApiConfig();
        // Remove double slashes if any
        const cleanBase = baseUrl.replace(/\/$/, '');
        const cleanEndpoint = endpoint.replace(/^\//, '');
        const url = new URL(`${cleanBase}/${cleanEndpoint}`);
        if (params) Object.keys(params).forEach(key => url.searchParams.append(key, params[key]));
        return url.toString();
    }

    // --- HEALTH CHECK (Essential for VPS Deployment) ---
    async checkHealth(): Promise<boolean> {
        const config = getApiConfig();
        if (config.useMock) return true; // Mock is always healthy
        try {
            const res = await fetch(this.resolveUrl('health'), { method: 'GET' });
            return res.ok;
        } catch (e) {
            console.error("Health Check Failed:", e);
            return false;
        }
    }

    async get<T>(endpoint: string, params?: any): Promise<ApiResponse<T>> {
        const config = getApiConfig();
        if (config.useMock) return this.mockRequest('GET', endpoint, undefined, params);
        
        try {
            const res = await fetch(this.resolveUrl(endpoint, params), { method: 'GET', headers: this.getHeaders() });
            return await res.json();
        } catch (e: any) {
            return { success: false, message: 'Network Error: ' + e.message, data: null as any, timestamp: new Date().toISOString() };
        }
    }

    async post<T>(endpoint: string, body: any): Promise<ApiResponse<T>> {
        const config = getApiConfig();
        if (config.useMock) return this.mockRequest('POST', endpoint, body);
        
        try {
            const res = await fetch(this.resolveUrl(endpoint), { method: 'POST', headers: this.getHeaders(), body: JSON.stringify(body) });
            return await res.json();
        } catch (e: any) {
            return { success: false, message: 'Network Error: ' + e.message, data: null as any, timestamp: new Date().toISOString() };
        }
    }

    async put<T>(endpoint: string, body: any): Promise<ApiResponse<T>> {
        const config = getApiConfig();
        if (config.useMock) return this.mockRequest('PUT', endpoint, body);
        
        try {
            const res = await fetch(this.resolveUrl(endpoint), { method: 'PUT', headers: this.getHeaders(), body: JSON.stringify(body) });
            return await res.json();
        } catch (e: any) {
            return { success: false, message: 'Network Error: ' + e.message, data: null as any, timestamp: new Date().toISOString() };
        }
    }

    async delete<T>(endpoint: string): Promise<ApiResponse<T>> {
        const config = getApiConfig();
        if (config.useMock) return this.mockRequest('DELETE', endpoint);
        
        try {
            const res = await fetch(this.resolveUrl(endpoint), { method: 'DELETE', headers: this.getHeaders() });
            return await res.json();
        } catch (e: any) {
            return { success: false, message: 'Network Error: ' + e.message, data: null as any, timestamp: new Date().toISOString() };
        }
    }

    // --- MOCK ROUTER ---
    private async mockRequest(method: string, endpoint: string, body?: any, params?: any): Promise<any> {
        await new Promise(resolve => setTimeout(resolve, MOCK_DELAY));

        try {
            if (endpoint === '/auth/login') return { success: true, data: body };

            const parts = endpoint.split('/').filter(p => p);
            const resource = parts[0];
            const id = parts[1];

            const tableMap: Record<string, string> = {
                'projects': 'projects',
                'transactions': 'transactions',
                'partners': 'partners',
                'cash-accounts': 'cash_accounts',
                'employees': 'employees',
                'contracts': 'contracts',
                'offices': 'offices',
                'categories': 'categories',
                'materials': 'materials',
                'material-master': 'material_master',
                'price-records': 'price_records',
                'documents': 'documents',
                'doc-lines': 'doc_lines',
                'timesheets': 'timesheets',
                'attendance-periods': 'attendance_periods',
                'payroll-runs': 'payroll_runs',
                'salary-templates': 'salary_templates',
                'kpi-records': 'kpi_records',
                'kpi-configs': 'kpi_configs',
                'assets': 'assets',
                'inventory': 'inventory',
                'inventory-logs': 'inventory_logs'
            };

            const tableName = tableMap[resource];

            if (tableName) {
                if (method === 'GET') {
                    if (id) {
                        const item = await db.findOne(tableName, id);
                        return { success: true, data: item };
                    }
                    const items = await db.find(tableName, params);
                    return { success: true, data: items };
                }
                if (method === 'POST') {
                    if (Array.isArray(body)) {
                        const newItems = await db.createMany(tableName, body);
                        return { success: true, data: newItems };
                    }
                    const newItem = await db.create(tableName, body);
                    return { success: true, data: newItem };
                }
                if (method === 'PUT' && id) {
                    const updated = await db.update(tableName, id, body);
                    return { success: true, data: updated };
                }
                if (method === 'DELETE' && id) {
                    await db.delete(tableName, id);
                    return { success: true, data: { id } };
                }
            }
            return { success: false, message: 'Route not found', data: null };
        } catch (error: any) {
            return { success: false, message: error.message };
        }
    }
}

export const api = new ApiClient();
