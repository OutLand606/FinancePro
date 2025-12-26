
import { CashAccount } from '../types';
import { INITIAL_CASH_ACCOUNTS } from '../constants';
import { getSettings } from './sheetService';

const STORAGE_KEYS = {
  ACCOUNTS: 'finance_cash_accounts'
};

// --- HELPER ---
const getLocalAccounts = (): CashAccount[] => {
    const stored = localStorage.getItem(STORAGE_KEYS.ACCOUNTS);
    if (!stored) {
        // Initialize with default if empty
        localStorage.setItem(STORAGE_KEYS.ACCOUNTS, JSON.stringify(INITIAL_CASH_ACCOUNTS));
        return INITIAL_CASH_ACCOUNTS;
    }
    return JSON.parse(stored);
};

export const fetchCashAccounts = async (): Promise<CashAccount[]> => {
  const settings = getSettings();

  if (settings.useMockData || !settings.apiEndpoint) {
    return new Promise(resolve => {
      // Simulate network
      setTimeout(() => resolve(getLocalAccounts()), 200);
    });
  }

  // TODO: Implement API call
  return getLocalAccounts();
};

export const createCashAccount = async (account: CashAccount): Promise<void> => {
    const current = getLocalAccounts();
    const updated = [account, ...current];
    localStorage.setItem(STORAGE_KEYS.ACCOUNTS, JSON.stringify(updated));
    return new Promise(resolve => setTimeout(resolve, 300));
};

export const updateCashAccount = async (account: CashAccount): Promise<void> => {
    const current = getLocalAccounts();
    const updated = current.map(a => a.id === account.id ? account : a);
    localStorage.setItem(STORAGE_KEYS.ACCOUNTS, JSON.stringify(updated));
    return new Promise(resolve => setTimeout(resolve, 300));
};

export const getCashAccountById = (id: string): CashAccount | undefined => {
  return getLocalAccounts().find(acc => acc.id === id);
};
