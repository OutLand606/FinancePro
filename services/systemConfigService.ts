import { ModuleConfig, FieldConfig, GlobalConfig, FeatureConfig, SystemRole } from '../types.ts';
import { DEFAULT_FEATURES, INITIAL_SYSTEM_ROLES } from '../constants.ts';

const STORAGE_KEYS = {
  MODULES: 'sys_module_config',
  FIELDS: 'sys_field_config',
  GLOBALS: 'sys_global_config',
  FEATURES: 'sys_feature_config',
  ROLES: 'sys_roles'
};

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

export const getModuleConfigs = (): ModuleConfig[] => {
  try {
    const s = localStorage.getItem(STORAGE_KEYS.MODULES);
    if (!s) return DEFAULT_MODULES;
    const stored: ModuleConfig[] = JSON.parse(s);
    // Luôn đảm bảo các module mặc định có mặt, không bị mất khi cập nhật code
    const merged = DEFAULT_MODULES.map(def => {
      const existing = stored.find(m => m.key === def.key);
      return existing ? { ...def, ...existing } : def;
    });
    return merged;
  } catch {
    return DEFAULT_MODULES;
  }
};

export const saveModuleConfig = (configs: ModuleConfig[]) => {
  localStorage.setItem(STORAGE_KEYS.MODULES, JSON.stringify(configs));
};

export const isModuleEnabled = (key: string): boolean => {
  const modules = getModuleConfigs();
  const mod = modules.find(m => m.key === key);
  return mod ? mod.enabled : false;
};

export const getFieldConfigs = (module?: string): FieldConfig[] => {
  const s = localStorage.getItem(STORAGE_KEYS.FIELDS);
  const all: FieldConfig[] = s ? JSON.parse(s) : [];
  if (module) return all.filter(f => f.module === module);
  return all;
};

export const saveFieldConfig = (configs: FieldConfig[]) => localStorage.setItem(STORAGE_KEYS.FIELDS, JSON.stringify(configs));
export const getGlobalConfigs = (): GlobalConfig[] => JSON.parse(localStorage.getItem(STORAGE_KEYS.GLOBALS) || '[]');
export const saveGlobalConfig = (configs: GlobalConfig[]) => localStorage.setItem(STORAGE_KEYS.GLOBALS, JSON.stringify(configs));
export const getFeatureConfigs = (): FeatureConfig[] => JSON.parse(localStorage.getItem(STORAGE_KEYS.FEATURES) || JSON.stringify(DEFAULT_FEATURES));
export const saveFeatureConfig = (configs: FeatureConfig[]) => localStorage.setItem(STORAGE_KEYS.FEATURES, JSON.stringify(configs));
export const isFeatureEnabled = (key: string): boolean => getFeatureConfigs().find(f => f.key === key)?.enabled || false;

export const getSystemRoles = (): SystemRole[] => {
  const s = localStorage.getItem(STORAGE_KEYS.ROLES);
  return s ? JSON.parse(s) : INITIAL_SYSTEM_ROLES;
};

export const saveSystemRole = (role: SystemRole) => {
  const roles = getSystemRoles();
  const idx = roles.findIndex(r => r.id === role.id);
  if (idx >= 0) roles[idx] = role; else roles.push(role);
  localStorage.setItem(STORAGE_KEYS.ROLES, JSON.stringify(roles));
};

export const deleteSystemRole = (id: string) => {
  const roles = getSystemRoles().filter(r => r.id !== id);
  localStorage.setItem(STORAGE_KEYS.ROLES, JSON.stringify(roles));
};