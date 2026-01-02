import { ModuleConfig, FieldConfig, GlobalConfig, FeatureConfig, SystemRole } from '../types.ts';
import { DEFAULT_FEATURES } from '../constants.ts';
import { api } from './api';

// --- SYSTEM ROLES (Lưu trong bảng 'system_roles') ---

export const getSystemRoles = async (): Promise<SystemRole[]> => {
    const res = await api.get<SystemRole[]>('/system_roles');
    return res.success ? res.data : [] ;
};

export const saveSystemRole = async (role: SystemRole): Promise<void> => {
    // Upsert logic
    const existing = await api.get<SystemRole>(`/system_roles/${role.id}`);
    if (existing.success && existing.data) {
        await api.put(`/system_roles/${role.id}`, role);
    } else {
        await api.post('/system_roles', role);
    }
};

export const deleteSystemRole = async (id: string): Promise<void> => {
    await api.delete(`/system_roles/${id}`);
};

// --- MODULE CONFIGS (Lưu trong bảng 'sys_module_config') ---
// Chúng ta sẽ lưu 1 bản ghi duy nhất có id='main_modules' chứa mảng cấu hình

const DEFAULT_MODULES: ModuleConfig[] = [
  { key: 'dashboard', label: 'Tổng quan', enabled: true },
  { key: 'tax-kpi', label: 'Thuế & KPI', enabled: true },
  { key: 'projects', label: 'Quản lý Công Trình', enabled: true, requiredPermission: 'PROJECT_VIEW_OWN' },
  { key: 'transactions', label: 'Sổ Thu Chi', enabled: true, requiredPermission: 'TRANS_CREATE' },
  { key: 'contracts', label: 'Hợp đồng', enabled: true },
  { key: 'suppliers', label: 'Thị trường & NCC', enabled: true },
  { key: 'hr', label: 'Nhân sự & Lương', enabled: true },
  { key: 'analysis', label: 'AI Phân tích', enabled: true, requiredPermission: 'PROJECT_VIEW_ALL' },
  { key: 'settings', label: 'Cấu hình', enabled: true },
];

export const getModuleConfigs = async (): Promise<ModuleConfig[]> => {
    try {
        const res = await api.get<any>('/sys_module_config/main_modules');
        if (res.success && res.data && res.data.value) {
            const stored: ModuleConfig[] = res.data.value;
            // Merge với default để đảm bảo không mất module mới khi update code
            return DEFAULT_MODULES.map(def => {
                const existing = stored.find(m => m.key === def.key);
                return existing ? { ...def, ...existing } : def;
            });
        }
        return DEFAULT_MODULES;
    } catch {
        return DEFAULT_MODULES;
    }
};

export const saveModuleConfig = async (configs: ModuleConfig[]): Promise<void> => {
    const payload = { id: 'main_modules', value: configs };
    await api.put('/sys_module_config/main_modules', payload);
};

// Hàm này cần đổi thành Async nếu muốn gọi từ logic khác, 
// nhưng thường check quyền sync ở UI. Nếu cần sync:
export const isModuleEnabled = async (key: string): Promise<boolean> => {
    const modules = await getModuleConfigs();
    const mod = modules.find(m => m.key === key);
    return mod ? mod.enabled : false;
};

// --- FIELD CONFIGS (Lưu trong bảng 'sys_field_config') ---

export const getFieldConfigs = async (module?: string): Promise<FieldConfig[]> => {
    const res = await api.get<any>('/sys_field_config/main_fields');
    const all: FieldConfig[] = (res.success && res.data && res.data.value) ? res.data.value : [];
    if (module) return all.filter(f => f.module === module);
    return all;
};

export const saveFieldConfig = async (configs: FieldConfig[]): Promise<void> => {
    // Lưu ý: Logic này đang replace toàn bộ. Nếu muốn merge phải get trước.
    // Để đơn giản cho Mock/MVP -> Replace.
    const payload = { id: 'main_fields', value: configs };
    await api.put('/sys_field_config/main_fields', payload);
};

// --- GLOBAL & FEATURE CONFIGS ---

export const getGlobalConfigs = async (): Promise<GlobalConfig[]> => {
    const res = await api.get<any>('/sys_global_config/main_globals');
    return (res.success && res.data && res.data.value) ? res.data.value : [];
};

export const saveGlobalConfig = async (configs: GlobalConfig[]): Promise<void> => {
    await api.put('/sys_global_config/main_globals', { id: 'main_globals', value: configs });
};

export const getFeatureConfigs = async (): Promise<FeatureConfig[]> => {
    const res = await api.get<any>('/sys_feature_config/main_features');
    if (res.success && res.data && res.data.value) return res.data.value;
    return DEFAULT_FEATURES;
};

export const saveFeatureConfig = async (configs: FeatureConfig[]): Promise<void> => {
    await api.put('/sys_feature_config/main_features', { id: 'main_features', value: configs });
};