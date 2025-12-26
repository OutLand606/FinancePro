
import { Office } from '../types';
import { api } from './api';

export const fetchOffices = async (): Promise<Office[]> => {
    const res = await api.get<Office[]>('/offices');
    return res.success ? res.data : [];
};

export const createOffice = async (office: Office): Promise<void> => {
    // 1. Validate Required Fields
    if (!office.name || !office.code) {
        throw new Error("Tên và Mã đơn vị là bắt buộc.");
    }
    
    // 2. Normalize Code
    const cleanOffice = { ...office, code: office.code.trim().toUpperCase() };

    // 3. Call API (Duplicate check handled in API/MockDB layer)
    const res = await api.post('/offices', cleanOffice);
    if (!res.success) throw new Error(res.message);
};

export const updateOffice = async (office: Office): Promise<void> => {
    if (!office.name || !office.code) {
        throw new Error("Tên và Mã đơn vị là bắt buộc.");
    }
    
    const cleanOffice = { ...office, code: office.code.trim().toUpperCase() };
    const res = await api.put(`/offices/${office.id}`, cleanOffice);
    if (!res.success) throw new Error(res.message);
};

export const deleteOffice = async (id: string): Promise<void> => {
    const res = await api.delete(`/offices/${id}`);
    if (!res.success) throw new Error(res.message);
};
