
import { Contract, Transaction, TransactionType, TransactionStatus, ContractType } from '../types';

export interface ContractPaymentStatus {
    totalPaid: number;
    paidPercent: number;
    remaining: number;
    isOverBudget: boolean;
    relatedTransactions: Transaction[];
    
    // Revenue Specific
    isRevenue?: boolean;
    totalCollected?: number; // Alias for totalPaid in revenue context
    collectedPercent?: number; // Alias for paidPercent
    receivable?: number; // Remaining to be collected
}

export const calculateContractStatus = (contract: Contract, allTransactions: Transaction[]): ContractPaymentStatus => {
    const isRevenue = contract.type === ContractType.REVENUE;
    const targetType = isRevenue ? TransactionType.INCOME : TransactionType.EXPENSE;

    // 1. Filter related transactions
    const relatedTransactions = allTransactions.filter(t => 
        t.contractId === contract.id && 
        t.type === targetType
    );

    // 2. Calculate Real Cash Flow (PAID only)
    // Source of Truth is the Transaction log with status = PAID
    const paidTransactions = relatedTransactions.filter(t => t.status === TransactionStatus.PAID);

    const totalProcessed = paidTransactions.reduce((sum, t) => sum + t.amount, 0);
    const percent = contract.value > 0 ? (totalProcessed / contract.value) * 100 : 0;
    const remaining = contract.value - totalProcessed;

    return {
        totalPaid: totalProcessed, // For Revenue, this is "Total Collected"
        paidPercent: percent,
        remaining: remaining,
        isOverBudget: !isRevenue && totalProcessed > contract.value, // Only warn over budget for expenses
        relatedTransactions: relatedTransactions,
        
        // Semantic aliases
        isRevenue,
        totalCollected: totalProcessed,
        collectedPercent: percent,
        receivable: remaining
    };
};
