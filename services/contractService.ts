
import { Contract } from '../types';
import { api } from './api';

// --- SERVICE METHODS ---

export const fetchContracts = async (): Promise<Contract[]> => {
  const res = await api.get<Contract[]>('/contracts');
  return res.success ? res.data : [];
};

export const createContract = async (contract: Contract): Promise<void> => {
  const res = await api.post('/contracts', contract);
  if (!res.success) throw new Error(res.message);
};

export const getContractById = async (id: string): Promise<Contract | undefined> => {
  const res = await api.get<Contract>(`/contracts/${id}`);
  return res.success ? res.data : undefined;
};

export const getContractsByPartner = async (partnerId: string, projectId: string): Promise<Contract[]> => {
    const res = await api.get<Contract[]>('/contracts', { partnerId, projectId });
    return res.success ? res.data : [];
};
