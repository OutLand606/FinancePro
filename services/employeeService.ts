
import { Employee, SalaryType, SalaryTemplate } from '../types';
import { api } from './api';

const STORAGE_KEYS = {
  SALARY_TYPES: 'finance_salary_types',
  TEMPLATES: 'finance_salary_templates'
}

// INLINED DEFAULTS (Still needed for Templates until migrated)
const DEFAULT_SALARY_TEMPLATES: SalaryTemplate[] = [
    {
        id: 'tpl_office_basic', name: 'Mẫu lương Văn Phòng', appliedPositions: ['Nhân viên', 'Kế toán', 'Hành chính'], status: 'ACTIVE',
        components: []
    }
];

// --- EMPLOYEE API METHODS ---

export const getEmployees = async (): Promise<Employee[]> => {
    const res = await api.get<Employee[]>('/employees');
    return res.success ? res.data : [];
};

export const getEmployeeById = async (id: string): Promise<Employee | undefined> => {
    const res = await api.get<Employee>(`/employees/${id}`);
    return res.success ? res.data : undefined;
};

export const updateEmployee = async (emp: Employee): Promise<void> => {
    const res = await api.put(`/employees/${emp.id}`, emp);
    if (!res.success) throw new Error(res.message);
};

export const createEmployee = async (emp: Employee): Promise<void> => {
    // API logic handles duplicate check
    if (!emp.password) emp.password = '123456';
    const res = await api.post('/employees', emp);
    if (!res.success) throw new Error(res.message);
};

// --- SALARY CONFIG (Still Local for now, or migrate next) ---

export const getSalaryTemplates = async (): Promise<SalaryTemplate[]> => {
    // TODO: Migrate to API /salary-templates
    const res = await api.get<SalaryTemplate[]>('/salary-templates');
    if (res.success && res.data.length > 0) return res.data;
    return DEFAULT_SALARY_TEMPLATES;
};

export const saveSalaryTemplate = async (template: SalaryTemplate): Promise<void> => {
    // Hybrid approach: Try API first
    const existing = await api.get<SalaryTemplate>(`/salary-templates/${template.id}`);
    if (existing.success && existing.data) {
        await api.put(`/salary-templates/${template.id}`, template);
    } else {
        await api.post('/salary-templates', template);
    }
};

export const getSalaryTypes = async (): Promise<SalaryType[]> => {
  const s = localStorage.getItem(STORAGE_KEYS.SALARY_TYPES);
  return s ? JSON.parse(s) : [];
};

export const saveSalaryType = async (type: SalaryType): Promise<void> => {
    const types = await getSalaryTypes();
    const idx = types.findIndex(t => t.id === type.id);
    if (idx >= 0) types[idx] = type; else types.push(type);
    localStorage.setItem(STORAGE_KEYS.SALARY_TYPES, JSON.stringify(types));
};

export const countEmployeesByRole = async (roleId: string): Promise<number> => {
    const emps = await getEmployees();
    return emps.filter(e => e.roleId === roleId && e.status === 'ACTIVE').length;
};
