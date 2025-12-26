import { Partner } from '../types';
import { fetchPartners } from './masterDataService';

export const getPartners = async (): Promise<Partner[]> => {
  return await fetchPartners();
};

export const searchPartnerLogic = (partner: Partner, query: string): boolean => {
  const q = query.toLowerCase();
  return (
    partner.name.toLowerCase().includes(q) ||
    (partner.phone || '').includes(q) ||
    (partner.taxCode || '').includes(q)
  );
};