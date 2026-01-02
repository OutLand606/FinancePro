
import { CashAccount } from '../types';
import { api } from './api';



export const fetchCashAccounts = async (): Promise<CashAccount[]> => {
    const res = await api.get<CashAccount[]>('/cash_accounts'); 
    return res.success ? res.data : [];
};

export const createCashAccount = async (account: CashAccount): Promise<void> => {
    await api.post('/cash_accounts', account);
};

export const updateCashAccount = async (account: CashAccount): Promise<void> => {
    await api.put(`/cash_accounts/${account.id}`, account);
};

export const deleteCashAccount = async (id: string): Promise<void> => {
    await api.delete(`/cash_accounts/${id}`);
};

