
import { CategoryMaster } from '../types';
import { api } from './api';

export const fetchCategories = async (): Promise<CategoryMaster[]> => {
  const res = await api.get<CategoryMaster[]>('/categories');
  return res.success ? res.data : [];
};

export const createCategory = async (category: CategoryMaster): Promise<void> => {
  // Validate duplicate code handled by API/MockDB
  const res = await api.post('/categories', category);
  if (!res.success) throw new Error(res.message);
};

export const updateCategory = async (category: CategoryMaster): Promise<void> => {
  const res = await api.put(`/categories/${category.id}`, category);
  if (!res.success) throw new Error(res.message);
};

export const deleteCategory = async (id: string): Promise<void> => {
  const res = await api.delete(`/categories/${id}`);
  if (!res.success) throw new Error(res.message);
};
