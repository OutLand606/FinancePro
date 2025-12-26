
import { Employee, Transaction, Project, EmployeePerformance, TransactionType, TransactionStatus } from '../types';

export const analyzeEmployee360 = (
    employee: Employee,
    transactions: Transaction[],
    projects: Project[]
): EmployeePerformance => {
    // 1. Lọc giao dịch liên quan đến nhân viên này (Tạm ứng, Lương, Phí công tác)
    // Bao gồm cả giao dịch trực tiếp (employeeId) và giao dịch với tư cách đối tác (partnerId - nếu có)
    const empTrans = transactions.filter(t => 
        (t.employeeId === employee.id || t.partnerId === employee.id) && 
        t.status === TransactionStatus.PAID
    );

    // 2. Tính toán tài chính
    // Tạm ứng: Các khoản chi có category "Tạm ứng"
    const totalAdvances = empTrans
        .filter(t => t.type === TransactionType.EXPENSE && t.category.toLowerCase().includes('tạm ứng'))
        .reduce((sum, t) => sum + t.amount, 0);
        
    // Thu nhập thực tế: Lương + Hoa hồng + Thưởng (Các khoản chi cho nhân viên không phải tạm ứng)
    const totalEarned = empTrans
        .filter(t => t.type === TransactionType.EXPENSE && (t.isPayroll || t.category.toLowerCase().includes('lương') || t.category.toLowerCase().includes('hoa hồng') || t.category.toLowerCase().includes('thưởng')))
        .reduce((sum, t) => sum + t.amount, 0);

    // 3. Lọc dự án tham gia
    const involvedProjects = projects.filter(p => 
        p.managerEmpId === employee.id || 
        p.salesEmpIds?.includes(employee.id) || 
        p.laborEmpIds?.includes(employee.id)
    );

    // 4. KPI Data Simulation (Mockup logic based on transactions if needed, or static for now)
    // Trong thực tế, cái này nên lấy từ kpiService, nhưng ở đây ta đảm bảo không trả về undefined
    
    return {
        empId: employee.id,
        totalAdvances: totalAdvances || 0,
        totalEarned: totalEarned || 0,
        activeProjectsCount: involvedProjects.filter(p => p.status === 'ACTIVE').length || 0,
        kpiCompletionRate: 0, // Giá trị mặc định, UI sẽ lấy từ KpiRecord thực tế
        recentTransactions: empTrans.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 10),
        involvedProjects: involvedProjects || []
    };
};
