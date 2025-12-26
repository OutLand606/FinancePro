
import { Partner, Material, MaterialMaster } from '../types';
import { api } from './api';

// --- PARTNER METHODS ---

export const fetchPartners = async (): Promise<Partner[]> => {
  const res = await api.get<Partner[]>('/partners');
  return res.success ? res.data : [];
};

export const createPartner = async (partner: Partner): Promise<Partner> => {
  const res = await api.post<Partner>('/partners', partner);
  if (!res.success) throw new Error(res.message);
  return res.data;
};

export const updatePartner = async (partner: Partner): Promise<void> => {
  const res = await api.put(`/partners/${partner.id}`, partner);
  if (!res.success) throw new Error(res.message);
};

// --- MATERIAL METHODS (Migrated to API) ---

export const fetchMaterials = async (): Promise<Material[]> => {
    const res = await api.get<Material[]>('/materials');
    return res.success ? res.data : [];
};

export const createMaterial = async (material: Material): Promise<void> => {
    const res = await api.post('/materials', material);
    if (!res.success) throw new Error(res.message);
};

export const fetchMaterialMaster = async (): Promise<MaterialMaster[]> => {
    const res = await api.get<MaterialMaster[]>('/material-master');
    return res.success ? res.data : [];
};

export const createMaterialMaster = async (item: MaterialMaster): Promise<void> => {
    const res = await api.post('/material-master', item);
    if (!res.success) throw new Error(res.message);
};

// --- SEARCH UTILS ---

export const searchPartners = (partners: Partner[], query: string): Partner[] => {
  const lowerQuery = query.toLowerCase();
  return partners.filter(p => 
    p.name.toLowerCase().includes(lowerQuery) || 
    (p.taxCode && p.taxCode.includes(lowerQuery)) ||
    (p.phone && p.phone.includes(lowerQuery))
  );
};
