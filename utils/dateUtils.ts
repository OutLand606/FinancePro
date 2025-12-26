
// Utility to handle Vietnamese Holidays and Working Days

const FIXED_HOLIDAYS = [
    '01-01', // Tết Dương lịch
    '04-30', // Giải phóng MN
    '05-01', // Quốc tế Lao động
    '09-02', // Quốc khánh
];

// Simple approximation for Lunar New Year (Tet) for 2024-2026 to avoid heavy libraries
// Format: YYYY-MM-DD
const LUNAR_HOLIDAYS_MAP: Record<string, string[]> = {
    '2024': ['2024-02-08', '2024-02-09', '2024-02-10', '2024-02-11', '2024-02-12', '2024-02-13', '2024-02-14'],
    '2025': ['2025-01-28', '2025-01-29', '2025-01-30', '2025-01-31', '2025-02-01'], // Approx
};

export const isHoliday = (dateStr: string): { isHoliday: boolean; name?: string } => {
    // dateStr format: YYYY-MM-DD
    const [year, month, day] = dateStr.split('-');
    const mmdd = `${month}-${day}`;

    // Check Fixed
    if (FIXED_HOLIDAYS.includes(mmdd)) {
        let name = '';
        if (mmdd === '01-01') name = 'Tết Dương Lịch';
        if (mmdd === '04-30') name = 'Giải phóng MN';
        if (mmdd === '05-01') name = 'Quốc tế Lao động';
        if (mmdd === '09-02') name = 'Quốc khánh';
        return { isHoliday: true, name };
    }

    // Check Lunar (Tet)
    if (LUNAR_HOLIDAYS_MAP[year] && LUNAR_HOLIDAYS_MAP[year].includes(dateStr)) {
        return { isHoliday: true, name: 'Tết Nguyên Đán' };
    }

    return { isHoliday: false };
};

export const getHolidaysInMonth = (monthStr: string): { count: number, names: string[] } => {
    // monthStr: YYYY-MM
    const [y, m] = monthStr.split('-').map(Number);
    const daysInMonth = new Date(y, m, 0).getDate();
    let count = 0;
    const names: string[] = [];

    for (let d = 1; d <= daysInMonth; d++) {
        const dateString = `${y}-${m.toString().padStart(2, '0')}-${d.toString().padStart(2, '0')}`;
        const check = isHoliday(dateString);
        
        // Only count if it falls on a weekday (Mon-Fri) or Sat depending on policy.
        // For simplicity, we assume paid holidays are paid regardless.
        if (check.isHoliday) {
            count++;
            if (check.name && !names.includes(check.name)) names.push(check.name);
        }
    }
    return { count, names };
};

export const getStandardWorkingDays = (monthStr: string, excludeSaturdays: boolean = false): number => {
    // monthStr: YYYY-MM
    const [y, m] = monthStr.split('-').map(Number);
    const daysInMonth = new Date(y, m, 0).getDate();
    let workingDays = 0;

    for (let d = 1; d <= daysInMonth; d++) {
        const current = new Date(y, m - 1, d);
        const dayOfWeek = current.getDay(); // 0 = Sun, 6 = Sat
        
        const isSun = dayOfWeek === 0;
        const isSat = dayOfWeek === 6;

        if (isSun) continue;
        if (excludeSaturdays && isSat) continue;

        workingDays++;
    }

    return workingDays;
};

export const getPaidLeaveLimit = (roleCode?: string): number => {
    // Logic: Manager/Director = 24, Others = 12
    const code = roleCode?.toUpperCase() || '';
    if (['ADMIN', 'MANAGER', 'DIRECTOR', 'GIAM_DOC', 'KE_TOAN_TRUONG'].some(r => code.includes(r))) {
        return 24;
    }
    return 12;
};
