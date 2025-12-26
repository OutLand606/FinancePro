
import { AIKnowledgeBase, MaterialEstimation, FeedbackStatus, Transaction, DataSource, PriceRecord } from '../types';

const KNOWLEDGE_KEY = 'ai_core_knowledge_v1';
const PRICE_RECORDS_KEY = 'finance_price_records';

export const getAIKnowledge = (): AIKnowledgeBase => {
    const s = localStorage.getItem(KNOWLEDGE_KEY);
    return s ? JSON.parse(s) : { version: 1, lastUpdated: new Date().toISOString(), wasteCoefficients: {}, edgeMaterialKeywords: [] };
};

// LỚP A: Học giá từ Phiếu Chi (Chỉ học khi status = PAID)
export const learnPriceHistory = async (transaction: Transaction): Promise<void> => {
    if (!transaction.isMaterialCost || !transaction.partnerId) return;

    const s = localStorage.getItem(PRICE_RECORDS_KEY);
    const records: PriceRecord[] = s ? JSON.parse(s) : [];

    // Tránh học trùng
    if (records.some(r => r.refTransactionId === transaction.id)) return;

    const newRecord: PriceRecord = {
        id: `pr_learn_${Date.now()}`,
        materialId: 'UNKNOWN', 
        resolvedName: transaction.description, // Học từ mô tả thực tế của kế toán
        partnerId: transaction.partnerId,
        price: transaction.amount, 
        unit: 'Lô/Đợt',
        date: transaction.date,
        dataSource: DataSource.FROM_EXPENSE,
        refTransactionId: transaction.id,
        createdAt: new Date().toISOString()
    };

    localStorage.setItem(PRICE_RECORDS_KEY, JSON.stringify([newRecord, ...records]));
    
    // LỚP C: Học vật tư mua lẻ từ description
    if (transaction.description.length > 5) {
        const knowledge = getAIKnowledge();
        const keywords = transaction.description.toLowerCase().split(' ').filter(w => w.length > 3);
        knowledge.edgeMaterialKeywords = Array.from(new Set([...knowledge.edgeMaterialKeywords, ...keywords])).slice(-500); // Giới hạn 500 từ khóa tinh hoa
        localStorage.setItem(KNOWLEDGE_KEY, JSON.stringify(knowledge));
    }
};

// LỚP B: Học hao hụt (Chỉ học khi Manager CONFIRMED)
export const confirmAndLearnWaste = async (estimation: MaterialEstimation): Promise<void> => {
    if (!estimation.actualRequiredQty || !estimation.estimatedQty) return;

    const knowledge = getAIKnowledge();
    const ratio = estimation.actualRequiredQty / estimation.estimatedQty;
    
    // Cập nhật hệ số hao hụt trung bình cho loại vật tư này
    const currentWaste = knowledge.wasteCoefficients[estimation.rawName] || 1;
    // Công thức học tiến hóa: Giá trị mới = (Giá trị cũ * 0.7) + (Giá trị thực tế * 0.3)
    knowledge.wasteCoefficients[estimation.rawName] = (currentWaste * 0.7) + (ratio * 0.3);
    
    knowledge.lastUpdated = new Date().toISOString();
    knowledge.version += 1;
    
    localStorage.setItem(KNOWLEDGE_KEY, JSON.stringify(knowledge));
};
