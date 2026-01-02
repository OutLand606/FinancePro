
import { PayrollRun, Payslip, SalaryComponent, SalaryTemplate, Transaction, TransactionType, TransactionScope, TransactionStatus } from '../types';
import { getEmployees, getSalaryTemplates } from './employeeService';
import { fetchTimesheets, getAttendancePeriod } from './timesheetService';
import { createTransaction } from './sheetService';
import { getKpiRecords, getKpiPeriod } from './kpiService';
import { getHolidaysInMonth } from '../utils/dateUtils';
import { api } from './api';

const STORAGE_KEYS = {
  COMPONENTS: 'finance_salary_components',
  MONTHLY_INPUTS: 'finance_payroll_monthly_inputs_v2'
};

const FALLBACK_COMPONENTS: SalaryComponent[] = [
    { id: 'c1', code: 'LUONG_CB', name: 'Lương cơ bản', type: 'LUONG', nature: 'THU_NHAP', isTaxable: true, formula: '0', value: 0, status: 'ACTIVE', isSystem: true },
    { id: 'c3', code: 'HOA_HONG', name: 'Hoa hồng KPI', type: 'LUONG', nature: 'THU_NHAP', isTaxable: true, formula: '{kpi_money}', status: 'ACTIVE' },
    { id: 'c6', code: 'THUC_LINH', name: 'Thực lĩnh', type: 'KHAC', nature: 'KHAC', isTaxable: false, formula: '=grossIncome - totalDeduction', status: 'ACTIVE' },
];

// --- COMPONENTS MANAGEMENT (API NOW) ---

export const getSalaryComponents = async (): Promise<SalaryComponent[]> => {
    // Gọi API lấy danh sách components từ bảng 'salary_components'
    const res = await api.get<SalaryComponent[]>('/salary_components');
    return res.success ? res.data : [];
};

export const saveSalaryComponent = async (comp: SalaryComponent) => {
    // Upsert logic
    const existing = await api.get(`/salary_components/${comp.id}`);
    if (existing.success && existing.data) {
        await api.put(`/salary_components/${comp.id}`, comp);
    } else {
        await api.post('/salary_components', comp);
    }
};

export const deleteSalaryComponent = async (id: string) => {
    await api.delete(`/salary_components/${id}`);
};

export const saveMonthlyInputs = (month: string, inputs: Record<string, any>) => {
    const all = JSON.parse(localStorage.getItem(STORAGE_KEYS.MONTHLY_INPUTS) || '{}');
    all[month] = inputs;
    localStorage.setItem(STORAGE_KEYS.MONTHLY_INPUTS, JSON.stringify(all));
};

export const getMonthlyInputs = (month: string): Record<string, any> => {
    const all = JSON.parse(localStorage.getItem(STORAGE_KEYS.MONTHLY_INPUTS) || '{}');
    return all[month] || {};
};

// --- CORE PAYROLL ENGINE ---

const evaluateFormula = (formula: string, vars: Record<string, number>): number => {
    if (!formula || formula === '0' || formula === '') return 0;
    let expression = formula.startsWith('=') ? formula.substring(1) : formula;

    try {
        expression = expression.replace(/\{(\w+)\}/g, (match, key) => {
            return (vars[key] !== undefined ? vars[key] : 0).toString();
        });
        
        const sortedKeys = Object.keys(vars).sort((a, b) => b.length - a.length);
        sortedKeys.forEach(key => {
            const regex = new RegExp(`\\b${key}\\b`, 'g');
            if (expression.includes(key)) {
                expression = expression.replace(regex, (vars[key] || 0).toString());
            }
        });
        
        // eslint-disable-next-line no-eval
        const result = eval(expression);
        return typeof result === 'number' && !isNaN(result) ? result : 0;
    } catch (e) {
        return 0;
    }
};

export const calculatePayrollDraft = async (month: string): Promise<{ slips: Payslip[], warnings: string[] }> => {
    if (!/^\d{4}-\d{2}$/.test(month)) {
        throw new Error("Định dạng tháng không hợp lệ (YYYY-MM).");
    }

    const warnings: string[] = [];
    
    // 1. Get Source Data (Now fully async/API)
    const [kpiPeriod, attendPeriod] = await Promise.all([
        getKpiPeriod(month),
        getAttendancePeriod(month)
    ]);
    
    if (!kpiPeriod || kpiPeriod.status !== 'LOCKED') warnings.push("KPI chưa được Chốt (Lock). Dữ liệu có thể thay đổi.");
    if (!attendPeriod || attendPeriod.status !== 'LOCKED') warnings.push("Bảng công chưa được Chốt. Dữ liệu có thể thay đổi.");

    const [allEmployees, templates, timesheets, kpiRecords] = await Promise.all([
        getEmployees(),
        getSalaryTemplates(),
        fetchTimesheets(month),
        getKpiRecords(month)
    ]);
    
    const monthlyInputs = getMonthlyInputs(month);
    const holidayInfo = getHolidaysInMonth(month);

    if (allEmployees.length === 0) {
        throw new Error("Chưa có danh sách nhân viên. Vui lòng thêm nhân sự trước.");
    }

    const employees = allEmployees.filter(e => e.status === 'ACTIVE');

    const slips = employees.map(emp => {
        const template = templates.find(t => t.id === emp.salaryTemplateId);
        
        const empTimesheets = timesheets ? timesheets.filter(ts => ts.empId === emp.id) : [];
        const actualWorkDays = empTimesheets.reduce((sum, ts) => sum + (ts.workUnits || 0), 0);
        const otHours = empTimesheets.reduce((sum, ts) => sum + (ts.otHours || 0), 0);
        
        const kpiRecord = kpiRecords.find(r => r.empId === emp.id);
        const kpiMoney = kpiRecord ? kpiRecord.totalCommission : 0;
        
        const manualInputs = monthlyInputs[emp.id] || {};

        const context: Record<string, number> = {
            'std_days': 26,
            'actual_work_days': actualWorkDays,
            'ot_hours': otHours,
            'holiday_days': holidayInfo.count,
            'unused_leave': 0, 
            'dependents': emp.dependents || 0,
            'base_salary': emp.baseSalary || 0,
            'eval_salary': emp.evalSalary || 0,
            'insurance_salary': emp.insuranceSalary || 0,
            'fixed_allowance': emp.fixedAllowance || 0,
            'kpi_money': kpiMoney,
            'bonus': Number(manualInputs.bonus) || 0,
            'deduction': Number(manualInputs.deduction) || 0
        };

        const details: Record<string, number> = {};
        let grossIncome = 0;
        let totalDeduction = 0;

        if (template) {
            template.components.forEach(comp => {
                let formula = comp.formula || '0';
                if ((comp.code === 'HOA_HONG' || comp.code === 'KPI') && (formula === '0' || formula === '')) {
                    formula = '{kpi_money}';
                }

                const val = evaluateFormula(formula, { ...context, ...details });
                details[comp.code] = val;
                
                if (comp.nature === 'THU_NHAP') grossIncome += val;
                if (comp.nature === 'KHAU_TRU') totalDeduction += val;
                
                details['grossIncome'] = grossIncome;
                details['totalDeduction'] = totalDeduction;
            });
        } else {
            warnings.push(`Nhân viên ${emp.fullName} chưa được gán Mẫu lương.`);
        }

        const netSalary = details['THUC_LINH'] !== undefined ? details['THUC_LINH'] : (grossIncome - totalDeduction);

        return {
            id: `slip_${month}_${emp.id}`,
            empId: emp.id,
            empName: emp.fullName, 
            roleName: emp.position || '',
            baseSalary: emp.baseSalary || 0,
            actualWorkDays,
            otHours,
            kpiMoney,
            allowance: emp.fixedAllowance || 0,
            insuranceSalary: emp.insuranceSalary || 0,
            bonus: Number(manualInputs.bonus) || 0,
            deduction: Number(manualInputs.deduction) || 0,
            note: manualInputs.note,
            grossIncome,
            totalDeduction,
            netSalary,
            details,
            templateSnapshot: template
        } as Payslip;
    });

    return { slips, warnings };
};

export const getPayrollRuns = async (): Promise<PayrollRun[]> => {
    const res = await api.get<PayrollRun[]>('/payroll-runs');
    return res.success ? res.data : [];
}

export const getPayrollRun = async (month: string): Promise<PayrollRun | undefined> => {
    const runs = await getPayrollRuns();
    return runs.find(r => r.month === month); 
};

export const createOrUpdateDraft = async (month: string): Promise<void> => {
    if (!month) throw new Error("Vui lòng chọn tháng.");
    
    const existing = await getPayrollRun(month);
    if (existing && existing.status === 'LOCKED') throw new Error("Kỳ lương này đã khóa (Locked), không thể tạo lại.");
    if (existing && existing.status === 'PAID') throw new Error("Kỳ lương này đã chi trả (Paid).");

    const { slips, warnings } = await calculatePayrollDraft(month);
    
    if (warnings.length > 0) console.warn("Payroll Warnings:", warnings);

    const totalAmount = slips.reduce((sum, s) => sum + s.netSalary, 0);

    const run: PayrollRun = {
        id: existing ? existing.id : `run_${month}`,
        month,
        status: 'DRAFT',
        totalAmount,
        employeeCount: slips.length,
        createdAt: new Date().toISOString(),
        slips 
    };

    if (existing) {
        await api.put(`/payroll-runs/${existing.id}`, run);
    } else {
        await api.post('/payroll-runs', run);
    }
};

export const lockPayrollRun = async (month: string, performer: string): Promise<void> => {
    const run = await getPayrollRun(month);
    if (!run) throw new Error("Chưa tạo bảng lương.");
    
    const updated = { ...run, status: 'LOCKED', lockedAt: new Date().toISOString() };
    await api.put(`/payroll-runs/${run.id}`, updated);
};

export const payPayrollRun = async (month: string, accountId: string, performer: string) => {
    const run = await getPayrollRun(month);
    if (!run) throw new Error("Run not found");
    if (run.status === 'PAID') throw new Error("Already paid");

    const transaction: Transaction = {
        id: `trans_payroll_${month}_${Date.now()}`,
        date: new Date().toISOString().split('T')[0],
        type: TransactionType.EXPENSE,
        amount: run.totalAmount,
        projectId: 'OFFICE',
        scope: TransactionScope.COMPANY_FIXED,
        category: 'Chi phí Lương',
        description: `Chi trả lương ${month}`,
        status: TransactionStatus.PAID,
        performedBy: performer,
        isPayroll: true,
        targetAccountId: accountId,
        attachments: [],
        createdAt: new Date().toISOString()
    };
    
    await createTransaction(transaction);

    const updated = { ...run, status: 'PAID', paidAt: new Date().toISOString(), paymentTransactionId: transaction.id };
    await api.put(`/payroll-runs/${run.id}`, updated);
};

export const exportPayrollToExcel = (run: PayrollRun) => {
    // CSV logic remains same (client side)
    const headers = [
        'Mã NV', 'Họ Tên', 'Chức danh', 
        'Lương Cơ Bản', 'Ngày Công', 'Lương KPI', 
        'Tổng Thu Nhập', 'Tổng Khấu Trừ', 'Thực Lĩnh', 'Ghi chú'
    ];
    const rows = run.slips.map(s => [
        s.empId, s.empName, s.roleName, s.baseSalary, s.actualWorkDays,
        s.kpiMoney, s.grossIncome, s.totalDeduction, s.netSalary, s.note || ''
    ]);
    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Bang_Luong_${run.month}.csv`;
    link.click();
};


