
import { Transaction, Project, TransactionType, TransactionStatus } from '../types';

export interface DashboardStats {
    totalRevenue: number;
    totalExpense: number;
    netProfit: number;
    pendingCount: number;
    activeProjectsCount: number;
    cashFlowTrend: { name: string, income: number, expense: number }[];
}

export const ReportService = {
    calculateDashboardStats: (transactions: Transaction[], projects: Project[]): DashboardStats => {
        // 1. Core Financials
        const totalRevenue = transactions
            .filter(t => t.type === TransactionType.INCOME && t.status === TransactionStatus.PAID)
            .reduce((sum, t) => sum + t.amount, 0);

        const totalExpense = transactions
            .filter(t => t.type === TransactionType.EXPENSE && t.status === TransactionStatus.PAID)
            .reduce((sum, t) => sum + t.amount, 0);

        // 2. Operational Metrics
        const pendingCount = transactions.filter(t => t.status === TransactionStatus.SUBMITTED).length;
        const activeProjectsCount = projects.filter(p => p.status === 'ACTIVE').length;

        // 3. Simple Trend (Last 6 months) - simplified for demo
        const cashFlowTrend = []; 
        // Logic chart would go here in real app
        
        return {
            totalRevenue,
            totalExpense,
            netProfit: totalRevenue - totalExpense,
            pendingCount,
            activeProjectsCount,
            cashFlowTrend
        };
    },

    getRecentActivity: (transactions: Transaction[], limit: number = 5): Transaction[] => {
        return [...transactions]
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
            .slice(0, limit);
    }
};
