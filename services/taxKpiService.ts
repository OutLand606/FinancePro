
import { Transaction, TransactionType, TransactionStatus, InvoiceType, Project, Contract, ContractStatus, CategoryType, CategoryMaster, ContractType } from '../types';
import { DEFAULT_KPI_TARGETS } from '../constants';

export interface TaxKpiStats {
  revenue: number;
  totalExpense: number;
  expenseWithVat: number;
  vatInputRatio: number;
  totalContractValue: number; // NEW
  alerts: {
    missingVatCount: number;
    missingVatAmount: number; 
    missingLaborContractCount: number;
    missingLaborContractAmount: number; 
    missingMaterialInvoiceCount: number;
    missingFilesCount: number;
  };
  details: {
    missingVatTransactions: Transaction[];
    missingLaborTransactions: Transaction[];
  }
}

export interface ProjectCostKpi {
  projectId: string;
  projectName: string;
  contractTotalValue: number;
  
  materialCost: number;
  laborCost: number;
  
  materialRatio: number;
  laborRatio: number;
  
  warnings: string[];
}

export const calculateTaxKpi = (
  transactions: Transaction[],
  projects: Project[], 
  contracts: Contract[], // ADDED
  filters: {
    startDate?: string;
    endDate?: string;
    projectId?: string;
    partnerId?: string;
    accountId?: string;
    onlyPaid?: boolean;
  }
): TaxKpiStats => {
  // 1. Filter Transactions
  const filtered = transactions.filter(t => {
    if (filters.startDate && t.date < filters.startDate) return false;
    if (filters.endDate && t.date > filters.endDate) return false;
    if (filters.projectId && t.projectId !== filters.projectId) return false;
    if (filters.partnerId && t.partnerId !== filters.partnerId) return false;
    if (filters.accountId && t.targetAccountId !== filters.accountId) return false;
    if (filters.onlyPaid && t.status !== TransactionStatus.PAID) return false;
    return true;
  });

  // 2. Calculate Aggregates
  let revenue = 0;
  let totalExpense = 0;
  let expenseWithVat = 0;
  
  const missingVatTrans: Transaction[] = [];
  let missingVatAmount = 0;

  const missingLaborTrans: Transaction[] = [];
  let missingLaborAmount = 0;

  const missingMaterialTrans: Transaction[] = [];
  let missingFilesCount = 0;

  filtered.forEach(t => {
    if (t.type === TransactionType.INCOME) {
      revenue += t.amount;
    } else {
      totalExpense += t.amount;
      
      // VAT Check
      if (t.hasVATInvoice) {
        expenseWithVat += t.amount;
      } else {
        // Logic: Chi phí lớn > 200k hoặc Vật tư đều cần VAT
        if (t.isMaterialCost || t.amount > 200000) {
             missingVatTrans.push(t);
             missingVatAmount += t.amount;
        }
      }

      // Labor Contract Check
      if (t.isLaborCost && (!t.contractId)) {
          missingLaborTrans.push(t);
          missingLaborAmount += t.amount;
      }

      // Material Invoice Check
      if (t.isMaterialCost && !t.hasVATInvoice) {
          missingMaterialTrans.push(t);
      }

      // File Check
      if (!t.attachments || t.attachments.length === 0) {
          missingFilesCount++;
      }
    }
  });

  // 3. Calculate Total Active Contract Value (Revenue Contracts)
  // Logic: Sum of all Revenue Contracts that are active/signed within range (or all if range is wide)
  // For simplicity, sum all REVENUE contracts related to filtered projects or all.
  const relevantContracts = contracts.filter(c => 
      c.type === ContractType.REVENUE && 
      (c.status === ContractStatus.SIGNED || c.status === ContractStatus.COMPLETED) &&
      (!filters.projectId || c.projectId === filters.projectId)
  );
  
  const totalContractValue = relevantContracts.reduce((sum, c) => sum + c.value, 0);

  // KPI Base: Prefer Contract Value if available, else Revenue
  const baseForRatio = totalContractValue > 0 ? totalContractValue : revenue;
  
  const vatInputRatio = baseForRatio > 0 ? (expenseWithVat / baseForRatio) * 100 : 0;

  return {
    revenue,
    totalExpense,
    expenseWithVat,
    vatInputRatio,
    totalContractValue,
    alerts: {
      missingVatCount: missingVatTrans.length,
      missingVatAmount,
      missingLaborContractCount: missingLaborTrans.length,
      missingLaborContractAmount: missingLaborAmount,
      missingMaterialInvoiceCount: missingMaterialTrans.length,
      missingFilesCount
    },
    details: {
        missingVatTransactions: missingVatTrans,
        missingLaborTransactions: missingLaborTrans
    }
  };
};

export const calculateProjectCostKpi = (
    project: Project,
    transactions: Transaction[],
    contracts: Contract[]
): ProjectCostKpi => {
    const projTrans = transactions.filter(t => t.projectId === project.id && t.status === TransactionStatus.PAID);
    
    const materialCost = projTrans
        .filter(t => t.isMaterialCost)
        .reduce((sum, t) => sum + t.amount, 0);

    const laborCost = projTrans
        .filter(t => t.isLaborCost)
        .reduce((sum, t) => sum + t.amount, 0);

    const contractTotalValue = project.contractTotalValue || 0;
    
    const materialRatio = contractTotalValue > 0 ? (materialCost / contractTotalValue) * 100 : 0;
    const laborRatio = contractTotalValue > 0 ? (laborCost / contractTotalValue) * 100 : 0;

    const warnings: string[] = [];
    if (materialRatio > DEFAULT_KPI_TARGETS.targetMaterialRatio) {
        warnings.push(`Chi phí vật tư (${materialRatio.toFixed(1)}%) vượt định mức (${DEFAULT_KPI_TARGETS.targetMaterialRatio}%)`);
    }
    if (laborRatio > DEFAULT_KPI_TARGETS.targetLaborRatio) {
        warnings.push(`Chi phí nhân công (${laborRatio.toFixed(1)}%) vượt định mức (${DEFAULT_KPI_TARGETS.targetLaborRatio}%)`);
    }

    return {
        projectId: project.id,
        projectName: project.name,
        contractTotalValue,
        materialCost,
        laborCost,
        materialRatio,
        laborRatio,
        warnings
    };
};
