
import { 
    MaterialEstimation, PurchaseProposal, ProposalStatus, EstimationStatus, 
    Document, Transaction, TransactionType, 
    TransactionScope, TransactionStatus, FeedbackStatus, ProcessingStatus
} from '../types';
import { TransactionService } from './transactionService'; // NEW Dependency
import { learnPriceHistory, confirmAndLearnWaste } from './aiKnowledgeService';
import { extractBOQDataWithGemini } from './aiExtractionService';
import { api } from './api'; // Use API for consistency

const STORAGE_KEYS = {
    BOQ_FILES: 'procure_boq_files_v1',
    ESTIMATIONS: 'procure_estimations_v1',
    PROPOSALS: 'procure_proposals_v1'
};

// --- DATA ACCESS (To be moved to API later) ---
// Currently keeping localStorage for specific procurement tables not yet in MockDB
const getLocalData = <T>(key: string): T[] => {
    const s = localStorage.getItem(key);
    return s ? JSON.parse(s) : [];
};
const saveLocalData = (key: string, data: any[]) => localStorage.setItem(key, JSON.stringify(data));

export const fetchProjectEstimations = async (projectId: string): Promise<MaterialEstimation[]> => {
    // In future: api.get(`/procurement/estimations?projectId=${projectId}`)
    const all = getLocalData<MaterialEstimation>(STORAGE_KEYS.ESTIMATIONS);
    return all.filter(e => e.projectId === projectId);
};

export const saveEstimations = async (items: MaterialEstimation[]): Promise<void> => {
    const all = getLocalData<MaterialEstimation>(STORAGE_KEYS.ESTIMATIONS);
    const updated = [...all, ...items];
    saveLocalData(STORAGE_KEYS.ESTIMATIONS, updated);
};

export const updateEstimation = async (updated: MaterialEstimation): Promise<void> => {
    const all = getLocalData<MaterialEstimation>(STORAGE_KEYS.ESTIMATIONS);
    const newAll = all.map(e => e.id === updated.id ? updated : e);
    saveLocalData(STORAGE_KEYS.ESTIMATIONS, newAll);
};

export const deleteEstimation = async (id: string): Promise<void> => {
    const all = getLocalData<MaterialEstimation>(STORAGE_KEYS.ESTIMATIONS);
    const newAll = all.filter(e => e.id !== id);
    saveLocalData(STORAGE_KEYS.ESTIMATIONS, newAll);
};

export const parsePastedBoqData = (text: string, projectId: string): MaterialEstimation[] => {
    // Basic parser for Tab-separated (Excel) or Comma-separated
    const lines = text.trim().split('\n');
    const result: MaterialEstimation[] = [];
    
    lines.forEach((line, idx) => {
        const parts = line.split(/\t|,/).map(s => s.trim());
        if (parts.length < 2) return;

        // Heuristic mapping: Name | Unit | Qty
        const name = parts[0];
        let unit = parts[1];
        let qtyStr = parts[2];

        // Swap check
        if (!isNaN(Number(parts[1])) && isNaN(Number(parts[2]))) {
            qtyStr = parts[1];
            unit = parts[2];
        }

        const qty = Number(qtyStr?.replace(/[^0-9.]/g, '')) || 0;

        if (name && qty > 0) {
            let group = 'Khác';
            const nLower = name.toLowerCase();
            if (nLower.includes('xi măng') || nLower.includes('gạch') || nLower.includes('cát') || nLower.includes('đá')) group = 'Xây Thô';
            if (nLower.includes('sơn') || nLower.includes('bả') || nLower.includes('gạch ốp')) group = 'Hoàn Thiện';
            if (nLower.includes('dây') || nLower.includes('đèn') || nLower.includes('ống') || nLower.includes('công tắc')) group = 'Điện Nước';

            result.push({
                id: `est_paste_${Date.now()}_${idx}`,
                projectId,
                rawName: name,
                unit: unit || 'Cái',
                estimatedQty: qty,
                usedQty: 0,
                categoryGroup: group,
                status: EstimationStatus.PLANNED,
                source: 'MANUAL',
                createdAt: new Date().toISOString()
            });
        }
    });
    return result;
};

export const submitMaterialFeedback = async (estimationId: string, actualQty: number, note: string): Promise<void> => {
    const all = getLocalData<MaterialEstimation>(STORAGE_KEYS.ESTIMATIONS);
    const updated = all.map(e => e.id === estimationId ? {
        ...e,
        actualRequiredQty: actualQty,
        discrepancyNote: note,
        feedbackStatus: FeedbackStatus.PENDING 
    } : e);
    saveLocalData(STORAGE_KEYS.ESTIMATIONS, updated);
};

export const confirmFeedbackAndLearn = async (estimationId: string): Promise<void> => {
    const all = getLocalData<MaterialEstimation>(STORAGE_KEYS.ESTIMATIONS);
    const estimation = all.find(e => e.id === estimationId);
    
    if (estimation && estimation.feedbackStatus === FeedbackStatus.PENDING) {
        const updated = all.map(e => e.id === estimationId ? { ...e, feedbackStatus: FeedbackStatus.CONFIRMED } : e);
        saveLocalData(STORAGE_KEYS.ESTIMATIONS, updated);
        await confirmAndLearnWaste(estimation);
    }
};

// --- CORE BUSINESS LOGIC: PROCUREMENT PAYMENT ---
export const processQuickPayment = async (
    proposal: PurchaseProposal, 
    finalAmount: number,
    targetAccountId: string,
    performedBy: string,
    onTransactionCreated: (t: Transaction) => void // Callback for UI update
): Promise<void> => {
    
    // 1. Prepare Transaction Data
    const transactionData: Transaction = {
        id: `trans_proc_${proposal.id}_${Date.now()}`,
        date: new Date().toISOString().split('T')[0],
        type: TransactionType.EXPENSE,
        amount: finalAmount,
        projectId: proposal.projectId,
        scope: TransactionScope.PROJECT,
        partnerId: proposal.supplierId, 
        category: 'Vật tư thi công',
        description: `Thanh toán: ${proposal.title}`,
        status: TransactionStatus.PAID, // Auto paid
        performedBy: performedBy,
        purchaseProposalId: proposal.id, 
        isMaterialCost: true,
        targetAccountId: targetAccountId,
        costGroup: 'MATERIAL', // Auto classify
        attachments: [],
        createdAt: new Date().toISOString()
    };

    // 2. Call Transaction Service (This ensures validation and API call)
    // NOTE: In the current UI flow, userContext is needed for 'performedBy', here we assume it's passed or handled by service
    // For now we use the `api` directly via service logic simulation inside createTransaction wrapper?
    // Let's use `TransactionService.create` but we need a mock user context if not available. 
    // Actually, `processQuickPayment` args passed `performedBy` (string name). 
    // We should ideally pass the user object. For now we adapt.
    
    // Revert to calling API directly or via TransactionService if possible.
    // To support the existing flow:
    await TransactionService.create(transactionData, { id: performedBy } as any); 
    
    // 3. Trigger Learning Side-effects
    await learnPriceHistory(transactionData);
    
    // 4. Update UI
    onTransactionCreated(transactionData);

    // 5. Update Proposal Status
    const props = getLocalData<PurchaseProposal>(STORAGE_KEYS.PROPOSALS);
    saveLocalData(STORAGE_KEYS.PROPOSALS, props.map(p => p.id === proposal.id ? { ...p, status: ProposalStatus.APPROVED } : p));
};

export const fetchProjectBOQs = async (projectId: string): Promise<Document[]> => {
    const all = getLocalData<Document>(STORAGE_KEYS.BOQ_FILES);
    return all.filter(d => d.partnerId === projectId);
};

export const uploadProjectBOQ = async (file: File, projectId: string, uploadedBy: string): Promise<Document> => {
    // 1. Save Doc Record
    const newDoc: Document = { 
        id: `boq_${Date.now()}`, 
        name: file.name, 
        type: 'BOQ', 
        fileUrl: '', // In real app, this is S3/Drive link
        partnerId: projectId, 
        uploadedBy, 
        status: ProcessingStatus.COMPLETED, 
        createdAt: new Date().toISOString() 
    };
    
    const all = getLocalData<Document>(STORAGE_KEYS.BOQ_FILES);
    saveLocalData(STORAGE_KEYS.BOQ_FILES, [newDoc, ...all]);

    // 2. Trigger AI Extraction
    const aiEstimations = await extractBOQDataWithGemini(file, projectId);
    await saveEstimations(aiEstimations);
    
    return newDoc;
};

export const fetchProjectProposals = async (projectId: string): Promise<PurchaseProposal[]> => {
    const all = getLocalData<PurchaseProposal>(STORAGE_KEYS.PROPOSALS);
    return all.filter(p => p.projectId === projectId);
};

export const createProposal = async (proposal: PurchaseProposal): Promise<void> => {
    const all = getLocalData<PurchaseProposal>(STORAGE_KEYS.PROPOSALS);
    saveLocalData(STORAGE_KEYS.PROPOSALS, [proposal, ...all]);
};
