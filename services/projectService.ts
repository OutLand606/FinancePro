
import { Project, Transaction, TransactionStatus, TransactionType } from '../types';
import { fetchAllData } from './sheetService';
import { api } from './api';

// This service wraps the raw data fetching and adds domain logic for Projects

export const getProjects = async (): Promise<Project[]> => {
  const res = await api.get<Project[]>('/projects');
  return res.success ? res.data : [];
};

export interface ProjectFinancials {
    income: number;
    expense: number;
    profit: number;
    receivable: number; // Công nợ phải thu (Giá trị HĐ - Đã thu)
    progress: number; // % Thu tiền
    materialCost: number;
    laborCost: number;
    otherCost: number;
}

// DOMAIN LOGIC: Tính toán chỉ số tài chính dự án
// Sau này logic này sẽ nằm ở Backend SQL Query / Aggregation
export const calculateProjectFinancials = (project: Project, transactions: Transaction[]): ProjectFinancials => {
    // 1. Filter Transactions for this project
    const pTrans = transactions.filter(t => t.projectId === project.id && t.status === TransactionStatus.PAID);
    
    // 2. Aggregate
    const income = pTrans.filter(t => t.type === TransactionType.INCOME).reduce((s, t) => s + t.amount, 0);
    const expense = pTrans.filter(t => t.type === TransactionType.EXPENSE).reduce((s, t) => s + t.amount, 0);
    
    const materialCost = pTrans.filter(t => t.type === TransactionType.EXPENSE && t.isMaterialCost).reduce((s, t) => s + t.amount, 0);
    const laborCost = pTrans.filter(t => t.type === TransactionType.EXPENSE && t.isLaborCost).reduce((s, t) => s + t.amount, 0);
    const otherCost = expense - materialCost - laborCost;

    // 3. Derived Metrics
    const totalValue = project.contractTotalValue || 0;
    const receivable = Math.max(0, totalValue - income);
    const progress = totalValue > 0 ? (income / totalValue) * 100 : 0;

    return {
        income,
        expense,
        profit: income - expense,
        receivable,
        progress,
        materialCost,
        laborCost,
        otherCost
    };
};

export const getProjectSummary = (project: Project, transactions: any[]) => {
  const projectTrans = transactions.filter(t => t.projectId === project.id);
  // Add more summary logic here if needed (e.g. profit, unpaid invoices)
  return {
    transactionCount: projectTrans.length,
    lastTransactionDate: projectTrans.length > 0 ? projectTrans[0].date : null
  };
};
