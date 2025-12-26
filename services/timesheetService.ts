
import { Timesheet, AttendancePeriod, Employee } from '../types';
import { isHoliday } from '../utils/dateUtils';
import { api } from './api';

// --- DATA ACCESS LAYER (API) ---

export const getAttendancePeriod = async (month: string): Promise<AttendancePeriod | undefined> => {
    const res = await api.get<AttendancePeriod[]>('/attendance-periods'); // API filter could be added
    if (res.success) {
        return res.data.find(p => p.month === month);
    }
    return undefined;
};

export const getAllAttendancePeriods = async (): Promise<AttendancePeriod[]> => {
    const res = await api.get<AttendancePeriod[]>('/attendance-periods');
    return res.success ? res.data.sort((a, b) => b.month.localeCompare(a.month)) : [];
};

export const createAttendancePeriod = async (month: string): Promise<void> => {
    const existing = await getAttendancePeriod(month);
    if (existing) return;

    const newPeriod: AttendancePeriod = {
        id: month,
        month,
        status: 'DRAFT',
        totalWorkDays: 0,
        snapshots: []
    };
    await api.post('/attendance-periods', newPeriod);
};

export const fetchTimesheets = async (month?: string): Promise<Timesheet[]> => {
    // Check locked period first logic handled by calling periods API
    if (month) {
        const period = await getAttendancePeriod(month);
        if (period && period.status === 'LOCKED' && period.snapshots) {
            return period.snapshots;
        }
    }

    // If draft, fetch live timesheets
    // Optimized: Filter by month string prefix if possible in real backend
    const res = await api.get<Timesheet[]>('/timesheets');
    if (!res.success) return [];
    
    if (month) {
        return res.data.filter(t => t.date.startsWith(month));
    }
    return res.data;
};

export const saveTimesheets = async (entries: Timesheet[]): Promise<void> => {
    if (entries.length === 0) return;
    const month = entries[0].date.slice(0, 7);
    
    // Check Locked
    const period = await getAttendancePeriod(month);
    if (period && period.status === 'LOCKED') {
        throw new Error("Kỳ chấm công đã khóa.");
    }

    // API Optimization: Use createMany if new, or update individually? 
    // For simplicity in mock, we'll upsert logic.
    // However, API doesn't support UPSERT easily in REST without specific endpoint.
    // Strategy: Delete existing for these dates/emps and create new.
    
    // 1. Find existing IDs to update or delete
    // For specific cells (emp + date), we perform update or create.
    const allSheets = await fetchTimesheets(month);
    
    for (const entry of entries) {
        const existing = allSheets.find(t => t.empId === entry.empId && t.date === entry.date);
        if (existing) {
            await api.put(`/timesheets/${existing.id}`, entry);
        } else {
            await api.post('/timesheets', entry);
        }
    }
    
    // Auto create period draft if not exists
    if (!period) {
        await createAttendancePeriod(month);
    }
};

export const lockAttendancePeriod = async (month: string): Promise<void> => {
    const sheets = await fetchTimesheets(month);
    const totalWorkDays = sheets.reduce((s, t) => s + (t.workUnits || 0), 0);
    
    // Fetch period ID
    const period = await getAttendancePeriod(month);
    if (!period) {
        await createAttendancePeriod(month); // Just in case
    }

    const lockedPeriod: AttendancePeriod = {
        id: month,
        month,
        status: 'LOCKED',
        totalWorkDays,
        lockedAt: new Date().toISOString(),
        snapshots: sheets // Freeze data
    };

    // Update via API
    await api.put(`/attendance-periods/${month}`, lockedPeriod);
};

export const unlockAttendancePeriod = async (month: string): Promise<void> => {
    const period = await getAttendancePeriod(month);
    if (period) {
        const unlocked = { ...period, status: 'DRAFT', snapshots: undefined } as AttendancePeriod;
        await api.put(`/attendance-periods/${month}`, unlocked);
    }
};

export const deleteAttendancePeriod = async (month: string): Promise<void> => {
    // 1. Delete Period
    await api.delete(`/attendance-periods/${month}`);

    // 2. Delete Timesheets (Inefficient in REST, but needed)
    const sheets = await fetchTimesheets(month);
    for (const s of sheets) {
        await api.delete(`/timesheets/${s.id}`);
    }
};

export const autoFillOfficeTimesheet = async (empIds: string[], month: string, excludeWeekends: boolean = true): Promise<void> => {
    const year = parseInt(month.split('-')[0]);
    const m = parseInt(month.split('-')[1]) - 1; 
    const daysInMonth = new Date(year, m + 1, 0).getDate();
    
    const newEntries: Timesheet[] = [];

    for (let d = 1; d <= daysInMonth; d++) {
        const dateObj = new Date(year, m, d);
        const dayOfWeek = dateObj.getDay(); 
        const dateStr = `${month}-${d.toString().padStart(2, '0')}`;
        const holidayCheck = isHoliday(dateStr);

        if (holidayCheck.isHoliday) {
             empIds.forEach(empId => {
                newEntries.push({
                    id: `ts_auto_${empId}_${dateStr}`,
                    date: dateStr,
                    empId: empId,
                    projectId: 'OFFICE',
                    workUnits: 1,
                    otHours: 0,
                    note: `Nghỉ lễ: ${holidayCheck.name}`,
                    createdAt: new Date().toISOString()
                });
            });
            continue; 
        }

        if (excludeWeekends && (dayOfWeek === 0 || dayOfWeek === 6)) continue;

        empIds.forEach(empId => {
            newEntries.push({
                id: `ts_auto_${empId}_${dateStr}`,
                date: dateStr,
                empId: empId,
                projectId: 'OFFICE', 
                workUnits: 1,
                otHours: 0,
                note: 'Chấm công tự động',
                createdAt: new Date().toISOString()
            });
        });
    }

    // Use Batch Create via API specific route or loop?
    // Let's use loop for safety with our simple mock, but parallelize
    await Promise.all(newEntries.map(e => api.post('/timesheets', e)));
};

// --- IMPORT / EXPORT UTILS (Keeping existing logic but adapting data fetch) ---

const escapeCsv = (str: string | undefined | null) => {
    if (str === null || str === undefined) return '';
    const stringValue = String(str);
    if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
        return `"${stringValue.replace(/"/g, '""')}"`;
    }
    return stringValue;
};

export const exportTimesheetToCSV = async (month: string, employees: Employee[]) => {
    const sheets = await fetchTimesheets(month);
    
    const year = parseInt(month.split('-')[0]);
    const m = parseInt(month.split('-')[1]);
    const daysInMonth = new Date(year, m, 0).getDate();
    
    const headerRow = ['Mã NV', 'Họ Tên'];
    for(let i=1; i<=daysInMonth; i++) headerRow.push(`${i}/${m}`);
    headerRow.push('Tổng công');

    const rows = employees.map(emp => {
        const empSheets = sheets.filter(s => s.empId === emp.id);
        const row = [escapeCsv(emp.code), escapeCsv(emp.fullName)];
        let total = 0;
        
        for(let i=1; i<=daysInMonth; i++) {
            const date = `${month}-${i.toString().padStart(2, '0')}`;
            const entry = empSheets.find(s => s.date === date);
            const val = entry?.workUnits || 0;
            row.push(val > 0 ? val.toString() : '');
            total += val;
        }
        row.push(total.toString());
        return row;
    });

    const csvContent = '\uFEFF' + [headerRow.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Bang_Cham_Cong_T${m}_${year}.csv`;
    link.click();
};

export const exportTimesheetToJSON = async (month: string) => {
    const sheets = await fetchTimesheets(month);
    const period = await getAttendancePeriod(month);
    
    const payload = {
        meta: { type: 'FINANCE_PRO_TIMESHEET_BACKUP', version: 1, month, exportedAt: new Date().toISOString() },
        period,
        data: sheets
    };
    
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Backup_Timesheet_${month}.json`;
    link.click();
};

export const importTimesheetFromJSON = async (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const content = e.target?.result as string;
                const json = JSON.parse(content);
                
                if (json.meta?.type !== 'FINANCE_PRO_TIMESHEET_BACKUP') throw new Error("File không đúng định dạng.");
                
                const month = json.meta.month;
                const importedSheets = json.data || [];
                const importedPeriod = json.period;

                // 1. Create/Update Period
                if (importedPeriod) {
                    // Check existence logic handled by API, we just PUT
                    await api.put(`/attendance-periods/${month}`, importedPeriod);
                } else {
                    await createAttendancePeriod(month);
                }

                // 2. Import Sheets (Delete old first for this month to be clean)
                const currentSheets = await fetchTimesheets(month);
                for(const s of currentSheets) await api.delete(`/timesheets/${s.id}`);
                
                // Batch insert
                await Promise.all(importedSheets.map((s: any) => api.post('/timesheets', s)));
                
                resolve(month);
            } catch (err: any) {
                reject(err);
            }
        };
        reader.readAsText(file);
    });
};
