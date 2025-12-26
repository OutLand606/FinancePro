
import { EmployeeSubmission, SubmissionStatus, Employee } from '../types';
import { getEmployees } from './employeeService';
import { saveTimesheets } from './timesheetService';

const STORAGE_KEYS = {
    SUBMISSIONS: 'finance_emp_submissions'
};

const getSubmissions = (): EmployeeSubmission[] => {
    const s = localStorage.getItem(STORAGE_KEYS.SUBMISSIONS);
    return s ? JSON.parse(s) : [];
};

export const createSubmission = async (
    empId: string, 
    month: string, 
    workingDays: number, 
    revenue: number,
    note?: string
): Promise<void> => {
    const subs = getSubmissions();
    // Check if exists for this month, if so, overwrite if pending, else throw error
    const existing = subs.find(s => s.empId === empId && s.month === month);
    
    if (existing && existing.status === SubmissionStatus.APPROVED) {
        throw new Error("Báo cáo tháng này đã được duyệt, không thể gửi lại.");
    }

    const submission: EmployeeSubmission = {
        id: existing ? existing.id : `sub_${Date.now()}`,
        empId,
        month,
        workingDays,
        revenue,
        note,
        status: SubmissionStatus.PENDING,
        submittedAt: new Date().toISOString()
    };

    const updated = existing 
        ? subs.map(s => s.id === existing.id ? submission : s)
        : [...subs, submission];
        
    localStorage.setItem(STORAGE_KEYS.SUBMISSIONS, JSON.stringify(updated));
};

export const getSubmissionsByMonth = async (month: string): Promise<EmployeeSubmission[]> => {
    const subs = getSubmissions();
    return subs.filter(s => s.month === month);
};

export const reviewSubmission = async (
    submissionId: string, 
    status: SubmissionStatus, 
    reviewerId: string,
    adjustedData?: { workingDays: number, revenue: number }
): Promise<void> => {
    const subs = getSubmissions();
    const subIndex = subs.findIndex(s => s.id === submissionId);
    if (subIndex === -1) throw new Error("Không tìm thấy báo cáo.");

    const original = subs[subIndex];
    
    // Update Submission Status
    const updatedSub = {
        ...original,
        status,
        reviewedAt: new Date().toISOString(),
        reviewedBy: reviewerId,
        // Apply adjustments if any (Manager edits before approve)
        workingDays: adjustedData ? adjustedData.workingDays : original.workingDays,
        revenue: adjustedData ? adjustedData.revenue : original.revenue
    };
    
    subs[subIndex] = updatedSub;
    localStorage.setItem(STORAGE_KEYS.SUBMISSIONS, JSON.stringify(subs));

    // IF APPROVED -> TRIGGER AUTO-SYNC TO PAYROLL SYSTEM
    if (status === SubmissionStatus.APPROVED) {
        await syncToPayroll(updatedSub);
    }
};

const syncToPayroll = async (sub: EmployeeSubmission) => {
    // 1. Sync Timesheet
    // We create a single aggregate entry for the month to represent total days.
    // In a real system with daily timesheets, this might be complex. 
    // Here we treat it as "Total Actual Days" for the payroll formula.
    
    // NOTE: Our payroll engine reads detailed timesheets. 
    // To make this compatible, we'll create a dummy timesheet entry on the 1st of month 
    // with 'workUnits' = reported days.
    // Or better, we ensure payrollService reads from this "Aggregated" source if available.
    // For now, let's inject into Timesheet service as a bulk entry.
    const tsEntry = {
        id: `ts_auto_${sub.id}`,
        date: `${sub.month}-01`, // 1st of month
        empId: sub.empId,
        projectId: 'p_general', // General Overhead or needs selection?
        workUnits: sub.workingDays,
        otHours: 0,
        note: `Tự khai báo: ${sub.workingDays} công (Auto-approved)`,
        createdAt: new Date().toISOString()
    };
    await saveTimesheets([tsEntry]);

    // 2. Sync Revenue to MonthlyInputs
    // Fetch existing inputs first to preserve KPI scores if they exist
    // This part requires access to payrollService storage which we can do via helper
    // We will do a localized update here mimicking saveMonthlyInputs behavior
    
    // We need to fetch current inputs to merge
    const inputsKey = 'finance_payroll_inputs_v2';
    const s = localStorage.getItem(inputsKey);
    const allInputs = s ? JSON.parse(s) : {};
    const monthInputs = allInputs[sub.month] || {};
    
    const empInput = monthInputs[sub.empId] || { kpiScorePersonal: 100, kpiScoreManager: 100 };
    
    // Update Revenue
    monthInputs[sub.empId] = {
        ...empInput,
        revenueActual: sub.revenue
    };
    
    allInputs[sub.month] = monthInputs;
    localStorage.setItem(inputsKey, JSON.stringify(allInputs));
};
