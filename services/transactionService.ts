
import { Transaction, TransactionType, TransactionStatus, TransactionScope, UserContext, ApiError } from '../types';
import { api } from './api';

// --- BUSINESS LOGIC LAYER ---
// Nơi này chứa các quy tắc nghiệp vụ.

export const TransactionService = {
    // 1. Validation Logic
    validate: (data: Partial<Transaction>): string | null => {
        if (!data.amount || data.amount <= 0) return "Số tiền giao dịch phải lớn hơn 0.";
        if (!data.description?.trim()) return "Vui lòng nhập nội dung chi tiết.";
        if (data.scope === TransactionScope.PROJECT && !data.projectId) return "Vui lòng chọn Công trình / Dự án.";
        if (!data.targetAccountId) return "Vui lòng chọn Tài khoản / Quỹ tiền.";
        
        // Expense Rules
        if (data.type === TransactionType.EXPENSE) {
            // Business Rule: Expense must have a category or cost group
            if (data.scope === TransactionScope.PROJECT && !data.costGroup) return "Vui lòng chọn Nhóm chi phí (Vật tư/Nhân công/Khác).";
        }
        
        return null;
    },

    // 2. Code Generation (Simulate Backend Sequence)
    generateCode: (type: TransactionType): string => {
        const prefix = type === TransactionType.INCOME ? 'PT' : 'PC';
        const date = new Date();
        const yymm = `${date.getFullYear().toString().slice(-2)}${(date.getMonth()+1).toString().padStart(2, '0')}`;
        // In real backend, this would use Redis or DB Sequence
        const random = Math.floor(Math.random() * 9000) + 1000;
        return `${prefix}-${yymm}-${random}`;
    },

    // 3. CRUD Operations wrapping API
    getAll: async (): Promise<Transaction[]> => {
        const res = await api.get<Transaction[]>('/transactions');
        return res.success ? res.data : [];
    },

    create: async (data: Transaction, user: UserContext): Promise<Transaction> => {
        // Validate
        const error = TransactionService.validate(data);
        if (error) throw new Error(error);

        // Enrich Data (Server-side logic simulation)
        const enrichedTransaction: Transaction = {
            ...data,
            id: data.id || `trans_${Date.now()}`,
            createdAt: new Date().toISOString(),
            performedBy: user.id, // Force current user as creator if not set
            status: data.status || TransactionStatus.SUBMITTED
        };

        const res = await api.post<Transaction>('/transactions', enrichedTransaction);
        if (!res.success) throw new Error(res.message);
        return res.data;
    },

    update: async (transaction: Transaction): Promise<Transaction> => {
        const res = await api.put<Transaction>(`/transactions/${transaction.id}`, transaction);
        if (!res.success) throw new Error(res.message);
        return res.data;
    },

    delete: async (id: string): Promise<void> => {
        const res = await api.delete(`/transactions/${id}`);
        if (!res.success) throw new Error(res.message);
    },

    // 4. Workflow Actions (Approve, Reject, Pay)
    approve: async (transaction: Transaction, approverId: string): Promise<Transaction> => {
        if (transaction.status !== TransactionStatus.SUBMITTED) throw new Error("Chỉ có thể duyệt phiếu ở trạng thái Chờ duyệt.");
        
        const updated = {
            ...transaction,
            status: TransactionStatus.APPROVED,
            confirmedBy: approverId,
            confirmedAt: new Date().toISOString()
        };
        return TransactionService.update(updated);
    },

    reject: async (transaction: Transaction, reason: string, rejectorId: string): Promise<Transaction> => {
        const updated = {
            ...transaction,
            status: TransactionStatus.REJECTED,
            rejectionReason: reason,
            confirmedBy: rejectorId,
            confirmedAt: new Date().toISOString()
        };
        return TransactionService.update(updated);
    },

    pay: async (transaction: Transaction, accountId: string, payerId: string): Promise<Transaction> => {
        if (transaction.type !== TransactionType.EXPENSE) throw new Error("Chỉ có thể chi tiền cho Phiếu Chi.");
        
        const updated = {
            ...transaction,
            status: TransactionStatus.PAID,
            targetAccountId: accountId,
            performedBy: payerId, // Update the actual performer of payment
            // confirmedBy: payerId, // Optional: if payer is distinct from approver
        };
        return TransactionService.update(updated);
    },

    // NEW: Confirm Income (Xác nhận thu tiền)
    confirmIncome: async (transaction: Transaction, accountId: string, performerId: string): Promise<Transaction> => {
        if (transaction.type !== TransactionType.INCOME) throw new Error("Hành động này chỉ dành cho Phiếu Thu.");
        
        const updated = {
            ...transaction,
            status: TransactionStatus.PAID, // Chuyển trạng thái thành PAID để tính vào quỹ
            targetAccountId: accountId,
            performedBy: performerId,
            confirmedBy: performerId, // Auto confirm khi đã nhận tiền
            confirmedAt: new Date().toISOString()
        };
        return TransactionService.update(updated);
    },
    
    // 5. Analytics Helper
    calculateBalance: (transactions: Transaction[], accountId: string): number => {
        return transactions
            .filter(t => t.targetAccountId === accountId && t.status === TransactionStatus.PAID)
            .reduce((sum, t) => sum + (t.type === TransactionType.INCOME ? t.amount : -t.amount), 0);
    }
};
