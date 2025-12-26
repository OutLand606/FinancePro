
import { Partner, Transaction, PartnerPerformance, TransactionType, TransactionStatus, PartnerType, Project, Contract } from '../types';

export const analyzePartner = (
    partner: Partner, 
    transactions: Transaction[] = [], // Default empty
    projects: Project[] = [], // Default empty
    contracts: Contract[] = [] // Default empty
): PartnerPerformance => {
    // Defensive check
    if (!partner) return {
        partnerId: 'unknown',
        transactionCount: 0,
        projectCount: 0,
        aiScore: 0,
        riskLevel: 'LOW',
        strengths: [],
        weaknesses: []
    };

    const safeTransactions = Array.isArray(transactions) ? transactions : [];
    const safeProjects = Array.isArray(projects) ? projects : [];
    const safeContracts = Array.isArray(contracts) ? contracts : [];
    
    // --- 1. COMMON METRICS ---
    const allTrans = safeTransactions.filter(t => t.partnerId === partner.id && t.status === TransactionStatus.PAID);
    const lastTransactionDate = allTrans.length > 0 
        ? allTrans.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0].date 
        : undefined;
    const projectSet = new Set(allTrans.map(t => t.projectId).filter(id => id));
    
    let baseResult: PartnerPerformance = {
        partnerId: partner.id,
        transactionCount: allTrans.length,
        projectCount: projectSet.size,
        lastTransactionDate,
        aiScore: 50, // Default base
        riskLevel: 'LOW',
        strengths: [],
        weaknesses: []
    };

    // Flags to determine which logic to run
    const isSupplierLike = partner.type === PartnerType.SUPPLIER || partner.type === PartnerType.LABOR || partner.type === PartnerType.BOTH;
    const isCustomerLike = partner.type === PartnerType.CUSTOMER || partner.type === PartnerType.BOTH;

    // --- 2. SUPPLIER / LABOR LOGIC ---
    if (isSupplierLike) {
        const expenseTrans = allTrans.filter(t => t.type === TransactionType.EXPENSE);
        const totalSpent = expenseTrans.reduce((sum, t) => sum + t.amount, 0);
        
        // Category Analysis
        const catMap: Record<string, number> = {};
        expenseTrans.forEach(t => { catMap[t.category] = (catMap[t.category] || 0) + 1; });
        const topCategories = Object.entries(catMap).sort((a, b) => b[1] - a[1]).slice(0, 3).map(e => e[0]);

        // Scoring for Supplier
        let score = 0;
        if (totalSpent > 1000000000) score += 40; else if (totalSpent > 100000000) score += 20;
        score += Math.min(expenseTrans.length, 30);
        if (partner.rating) score += (partner.rating - 3) * 10;
        
        // Strengths/Weaknesses
        if (totalSpent > 500000000) baseResult.strengths.push("Năng lực cung ứng tốt");
        if (expenseTrans.length > 20) baseResult.strengths.push("Đối tác thân thiết");
        
        if (lastTransactionDate && (new Date().getTime() - new Date(lastTransactionDate).getTime()) / (1000 * 3600 * 24) > 180) {
            baseResult.weaknesses.push("Ngừng giao dịch > 6 tháng");
            baseResult.riskLevel = 'MEDIUM';
        }

        // Merge Supplier Stats
        baseResult = {
            ...baseResult,
            totalSpent,
            topCategories,
            priceTrend: 'STABLE',
            // Update score if it's primarily a supplier or mixed
            aiScore: Math.max(0, Math.min(100, score)) 
        };
    }

    // --- 3. CUSTOMER LOGIC ---
    if (isCustomerLike) {
        const incomeTrans = allTrans.filter(t => t.type === TransactionType.INCOME);
        const totalRevenue = incomeTrans.reduce((sum, t) => sum + t.amount, 0);
        
        // Calculate Debt
        const customerProjects = safeProjects.filter(p => p.customerId === partner.id);
        const estimatedProjectValue = customerProjects.reduce((sum, p) => sum + (p.contractTotalValue || 0), 0);
        
        const customerContracts = safeContracts.filter(c => c.partnerId === partner.id && c.type === 'REVENUE');
        const contractValue = customerContracts.length > 0 
            ? customerContracts.reduce((sum, c) => sum + c.value, 0)
            : estimatedProjectValue;

        const totalDebt = Math.max(0, contractValue - totalRevenue);
        const debtRatio = contractValue > 0 ? (totalDebt / contractValue) * 100 : 0;

        // Scoring (Customer Health) - If BOTH, verify which score to take. Usually prioritize risk.
        let score = 50;
        if (totalRevenue > 1000000000) score += 20;
        if (debtRatio < 10) score += 30;
        else if (debtRatio < 30) score += 10; 
        else if (debtRatio > 60) score -= 20;

        // Risk Assessment
        if (debtRatio > 50) {
            baseResult.riskLevel = 'HIGH';
            baseResult.weaknesses.push(`Công nợ cao (${debtRatio.toFixed(0)}%)`);
        } else if (debtRatio > 30 && baseResult.riskLevel !== 'HIGH') {
            baseResult.riskLevel = 'MEDIUM';
            baseResult.weaknesses.push("Còn nợ tồn đọng");
        }

        if (totalRevenue > 2000000000) baseResult.strengths.push("Khách hàng VIP (Doanh số lớn)");
        if (incomeTrans.length > 5) baseResult.strengths.push("Thanh toán nhiều đợt");
        if (baseResult.riskLevel === 'LOW' && contractValue > 0) baseResult.strengths.push("Tài chính khỏe mạnh");

        // Merge Customer Stats
        baseResult = {
            ...baseResult,
            totalRevenue,
            totalDebt,
            debtRatio,
            paymentSpeed: score > 70 ? 'FAST' : score > 40 ? 'NORMAL' : 'SLOW',
            // If strictly customer, take this score. If BOTH, maybe average or take min? Let's take customer score if project exists.
            aiScore: (partner.type === PartnerType.CUSTOMER) ? Math.max(0, Math.min(100, score)) : baseResult.aiScore
        };
    }

    return baseResult;
};
