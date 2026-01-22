
import { Transaction, TransactionType, TransactionStatus, Partner, Project, InvoiceObligation, CostPlan, CostSnapshot, Contract, ContractType, ContractStatus } from '../types';
import { api } from './api';

const COST_PLAN_KEY = 'finance_cost_plan_config';

// --- COST PLAN MANAGEMENT ---
export const getCostPlan = async (): Promise<CostPlan> => {
    const defaultPlan: CostPlan = {
        id: 'plan_default',
        year: new Date().getFullYear(),
        name: 'Định mức tiêu chuẩn',
        targetMaterial: 65,
        targetLabor: 23,
        targetOverhead: 10,
        targetProfit: 2
    };

    try {
        const res: any = await api.get('/kpi-finance_cost_plan_config');
        if (res.success && res.data) {
            return res.data;
        }
    } catch (error) {
        console.error("Lỗi lấy định mức chi phí (dùng mặc định):", error);
    }
    return defaultPlan;
};

// export const saveCostPlan = (plan: CostPlan) => {
//     localStorage.setItem(COST_PLAN_KEY, JSON.stringify(plan));
// };
export const saveCostPlan = async (plan: CostPlan): Promise<boolean> => {
    try {
        // Gọi API POST tới endpoint tương ứng (dùng chung endpoint với GET)
        const res: any = await api.post('/kpi-finance_cost_plan_config', plan);
        
        // Kiểm tra kết quả trả về từ backend
        if (res.success) {
            return true;
        } else {
            console.error("Lỗi khi lưu Cost Plan:", res.message);
            return false;
        }
    } catch (error) {
        console.error("Lỗi kết nối khi lưu Cost Plan:", error);
        return false;
    }
};

// --- INVOICE GENERATOR LOGIC ---
export const generateInvoiceObligations = (
    contracts: Contract[], 
    projects: Project[],
    transactions: Transaction[],
    partners: Partner[]
): InvoiceObligation[] => {
    const obligations: InvoiceObligation[] = [];

    // 1. GENERATE FROM CONTRACTS (Supplier/Labor Contracts)
    // Rule: Contract Value = Obligation to collect Invoice
    const inputContracts = contracts.filter(c => 
        (c.type === ContractType.SUPPLIER_MATERIAL || c.type === ContractType.LABOR || c.type === ContractType.SUB_CONTRACT) &&
        c.status !== ContractStatus.DRAFT
    );

    inputContracts.forEach(contract => {
        const partner = partners.find(p => p.id === contract.partnerId);
        
        // Find linked transactions that have VAT
        const linkedTrans = transactions.filter(t => 
            t.contractId === contract.id && 
            t.type === TransactionType.EXPENSE &&
            t.hasVATInvoice
        );
        const collectedAmount = linkedTrans.reduce((sum, t) => sum + t.amount, 0);

        obligations.push({
            id: `obl_c_${contract.id}`,
            sourceType: 'CONTRACT',
            sourceId: contract.id,
            sourceName: contract.name,
            partnerId: contract.partnerId,
            partnerName: partner?.name || 'Unknown',
            totalObligationAmount: contract.value,
            collectedAmount,
            missingAmount: Math.max(0, contract.value - collectedAmount),
            status: collectedAmount >= contract.value ? 'FULFILLED' : (collectedAmount > 0 ? 'PARTIAL' : 'MISSING'),
            linkedTransactionIds: linkedTrans.map(t => t.id)
        });
    });

    // 2. GENERATE FROM ORPHAN TRANSACTIONS (High value expenses without contract but need invoice)
    // Rule: Expense > 200k without contract is an obligation itself
    const orphanTrans = transactions.filter(t => 
        t.type === TransactionType.EXPENSE &&
        !t.contractId &&
        t.amount > 200000 &&
        !t.isPayroll // Payroll usually doesn't have VAT invoice in typical sense, has specialized docs
    );

    // Group orphans by Partner
    const groupedOrphans: Record<string, Transaction[]> = {};
    orphanTrans.forEach(t => {
        const key = t.partnerId || 'unknown_partner';
        if (!groupedOrphans[key]) groupedOrphans[key] = [];
        groupedOrphans[key].push(t);
    });

    Object.entries(groupedOrphans).forEach(([partnerId, transList]) => {
        const partner = partners.find(p => p.id === partnerId);
        // Calculate
        const totalAmount = transList.reduce((sum, t) => sum + t.amount, 0);
        const collected = transList.filter(t => t.hasVATInvoice).reduce((sum, t) => sum + t.amount, 0);
        
        if (totalAmount > 0) {
            obligations.push({
                id: `obl_orph_${partnerId}`,
                sourceType: 'ORPHAN_EXPENSE',
                sourceId: partnerId,
                sourceName: 'Chi phí lẻ (Không HĐ)',
                partnerId: partnerId === 'unknown_partner' ? '' : partnerId,
                partnerName: partner?.name || 'Vãng lai/Khác',
                totalObligationAmount: totalAmount,
                collectedAmount: collected,
                missingAmount: Math.max(0, totalAmount - collected),
                status: collected >= totalAmount ? 'FULFILLED' : (collected > 0 ? 'PARTIAL' : 'MISSING'),
                linkedTransactionIds: transList.map(t => t.id)
            });
        }
    });

    // Sort by Missing Amount Descending
    return obligations.sort((a,b) => b.missingAmount - a.missingAmount);
};

// --- COST BALANCE LOGIC ---

export const calculateCostBalance = async  (
    transactions: Transaction[], 
    projects: Project[]
) => {
    const plan = await getCostPlan();
    const periodName = `${new Date().getFullYear()}`;

    // Calculate Actuals (Paid Income & Expense)
    const actualRevenue = transactions
        .filter(t => t.type === TransactionType.INCOME && t.status === TransactionStatus.PAID)
        .reduce((sum, t) => sum + t.amount, 0);

    const expenses = transactions
        .filter(t => t.type === TransactionType.EXPENSE && t.status === TransactionStatus.PAID);

    const actualMaterial = expenses.filter(t => t.isMaterialCost).reduce((sum, t) => sum + t.amount, 0);
    const actualLabor = expenses.filter(t => t.isLaborCost).reduce((sum, t) => sum + t.amount, 0);
    const actualOverhead = expenses.filter(t => !t.isMaterialCost && !t.isLaborCost).reduce((sum, t) => sum + t.amount, 0);

    // Calculate Ratios
    const revenueBase = actualRevenue > 0 ? actualRevenue : 1; // Avoid div by zero
    const ratioMaterial = (actualMaterial / revenueBase) * 100;
    const ratioLabor = (actualLabor / revenueBase) * 100;
    const ratioOverhead = (actualOverhead / revenueBase) * 100;

    // Analyze Warnings based on Plan
    const warnings: string[] = [];

    if (ratioMaterial > plan.targetMaterial) warnings.push(`Chi phí VẬT TƯ (${ratioMaterial.toFixed(1)}%) vượt định mức chuẩn (${plan.targetMaterial}%)`);
    if (ratioLabor > plan.targetLabor) warnings.push(`Chi phí NHÂN CÔNG (${ratioLabor.toFixed(1)}%) vượt định mức chuẩn (${plan.targetLabor}%)`);
    if (ratioOverhead > plan.targetOverhead) warnings.push(`Chi phí QUẢN LÝ (${ratioOverhead.toFixed(1)}%) vượt định mức chuẩn (${plan.targetOverhead}%)`);

    if (actualRevenue > 0 && (actualMaterial + actualLabor + actualOverhead) > actualRevenue) {
        warnings.push("CẢNH BÁO NGUY HIỂM: Đang LỖ thực tế (Chi > Thu)");
    }

    return {
        period: periodName,
        actualRevenue,
        actualMaterial,
        actualLabor,
        actualOverhead,
        ratioMaterial,
        ratioLabor,
        ratioOverhead,
        plan,
        warnings
    };
};
