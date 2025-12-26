
import { PriceRecord, DataSource, Transaction, TransactionType, TransactionStatus, MaterialCategory, DocumentType, MaterialMaster } from '../types';
import { fetchMaterialMaster } from './masterDataService';
import { GoogleGenAI } from "@google/genai";
import { getSettings } from './sheetService';
import { api } from './api';

const getAiClient = () => {
    const apiKey = getSettings().geminiApiKey || process.env.API_KEY;
    if (!apiKey) throw new Error("Vui lòng cấu hình Gemini API Key trong phần Cài đặt hệ thống.");
    return new GoogleGenAI({ apiKey });
};

export const fetchPriceRecords = async (): Promise<PriceRecord[]> => {
    const res = await api.get<PriceRecord[]>('/price-records');
    return res.success ? res.data : [];
};

// --- AI ENGINE: BÓC TÁCH ĐƠN GIÁ TỐI ƯU ---
const extractPriceInfoFromDesc = async (description: string, amount: number): Promise<{qty: number, unit: string, price: number} | null> => {
    const ai = getAiClient();
    const prompt = `
        Bạn là kế toán công trường. Hãy bóc tách đơn giá từ nội dung: "${description}". Tổng tiền: ${amount}.
        Yêu cầu trả về JSON: {"qty": number, "unit": "string", "price": number}. 
        Logic: Giá = Tổng tiền / Số lượng. Nếu không rõ số lượng, qty=1.
        Đơn vị: Chuẩn hóa (Cái, Chiếc -> Cái; m -> md; m2 -> m2).
        Chỉ trả về JSON.
    `;
    try {
        const res = await ai.models.generateContent({ model: 'gemini-3-flash-preview', contents: prompt });
        const text = res.text || '';
        const cleanJson = text.replace(/```json/g, '').replace(/```/g, '').trim();
        return JSON.parse(cleanJson);
    } catch { return null; }
};

export const learnPriceFromTransaction = async (t: Transaction): Promise<void> => {
    const records = await fetchPriceRecords();
    if (records.some(r => r.refTransactionId === t.id)) return;

    const materials = await fetchMaterialMaster();
    const aiPrice = await extractPriceInfoFromDesc(t.description, t.amount);
    
    let materialId = 'UNKNOWN';
    const matchedMat = materials.find(m => t.description.toLowerCase().includes(m.name.toLowerCase()));
    if (matchedMat) materialId = matchedMat.id;

    const newRecord: PriceRecord = {
        id: `pr_sync_${Date.now()}`,
        materialId,
        resolvedName: matchedMat ? matchedMat.name : t.description,
        partnerId: t.partnerId || 'UNKNOWN',
        price: aiPrice?.price || t.amount,
        unit: aiPrice?.unit || 'Lô',
        date: t.date,
        dataSource: DataSource.FROM_EXPENSE,
        refTransactionId: t.id,
        trustLevel: matchedMat ? 'HIGH' : 'MEDIUM',
        createdAt: new Date().toISOString()
    } as PriceRecord;

    await api.post('/price-records', newRecord);
};

// --- NEW: GET PENDING SYNC TRANSACTIONS ---
export const getPendingSyncTransactions = async (transactions: Transaction[]): Promise<Transaction[]> => {
    const records = await fetchPriceRecords();
    return transactions.filter(t => 
        t.type === TransactionType.EXPENSE && 
        t.status === TransactionStatus.PAID && 
        t.isMaterialCost &&
        !records.some(r => r.refTransactionId === t.id)
    );
};

export const syncPricesFromTransactions = async (transactions: Transaction[]): Promise<number> => {
    const pendingTrans = await getPendingSyncTransactions(transactions);
    if (pendingTrans.length === 0) return 0;

    const materials = await fetchMaterialMaster();
    
    const syncPromises = pendingTrans.map(async (t) => {
        const aiPrice = await extractPriceInfoFromDesc(t.description, t.amount);
        let materialId = 'UNKNOWN';
        let resolvedName = t.description;

        const matchedMat = materials.find(m => t.description.toLowerCase().includes(m.name.toLowerCase()));
        if (matchedMat) {
            materialId = matchedMat.id;
            resolvedName = matchedMat.name;
        }

        return {
            id: `pr_sync_${t.id}_${Date.now()}`,
            materialId,
            resolvedName,
            partnerId: t.partnerId || 'UNKNOWN',
            price: aiPrice?.price || t.amount,
            unit: aiPrice?.unit || 'Lô',
            date: t.date,
            dataSource: DataSource.FROM_EXPENSE,
            refTransactionId: t.id,
            trustLevel: matchedMat ? 'HIGH' : 'MEDIUM',
            createdAt: new Date().toISOString()
        } as PriceRecord;
    });

    const newRecords = await Promise.all(syncPromises);
    await api.post('/price-records', newRecords); // Batch create support in api.ts
    return newRecords.length;
};

export const getPriceHistoryForMaterial = async (materialId: string, resolvedName?: string): Promise<PriceRecord[]> => {
    const records = await fetchPriceRecords();
    return records
        .filter(r => (materialId !== 'UNKNOWN' ? r.materialId === materialId : r.resolvedName === resolvedName))
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
};

export const fetchMaterialCategories = async (): Promise<MaterialCategory[]> => {
    return [
        { id: 'cat_mat_pccc', name: 'Thiết bị PCCC' },
        { id: 'cat_mat_raw', name: 'Vật liệu Xây Thô' },
        { id: 'cat_mat_fin', name: 'Vật liệu Hoàn Thiện' },
        { id: 'cat_mat_elec', name: 'Vật tư Điện nước' }
    ];
};

export const getLatestPrices = async (records: PriceRecord[]) => {
  const materials = await fetchMaterialMaster();
  const matMap = new Map(materials.map(m => [m.id, m]));
  
  const grouped: Record<string, PriceRecord> = {};
  
  records.forEach(r => {
    const key = r.materialId !== 'UNKNOWN' ? r.materialId : (r.resolvedName || 'MISC');
    const partnerKey = `${key}_${r.partnerId}`;

    if (!grouped[partnerKey] || new Date(r.date) > new Date(grouped[partnerKey].date)) {
      grouped[partnerKey] = { 
          ...r, 
          resolvedName: r.materialId !== 'UNKNOWN' ? matMap.get(r.materialId)?.name : r.resolvedName 
      };
    }
  });

  return Object.values(grouped).sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
};

export const getPriceTrend = (records: PriceRecord[], materialId: string, resolvedName?: string) => {
    const relevant = records
        .filter(r => materialId !== 'UNKNOWN' ? r.materialId === materialId : r.resolvedName === resolvedName)
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    if (relevant.length < 2) return { trend: 'NEW', percent: 0, diff: 0 };

    const latest = relevant[relevant.length - 1].price;
    const prev = relevant[relevant.length - 2].price;
    const diff = latest - prev;
    const percent = prev !== 0 ? (diff / prev) * 100 : 0;

    return {
        trend: diff > 0 ? 'UP' : diff < 0 ? 'DOWN' : 'STABLE',
        percent: Math.abs(percent),
        diff: diff
    };
};
