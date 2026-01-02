import { Document, ProcessingStatus, DocumentType, PriceRecord, ExtractedItem, DataSource } from '../types';
import { api } from './api';
import { extractInvoiceDataWithGemini } from './aiExtractionService';
import { fetchMaterialMaster } from './masterDataService';
import { uploadFileToDrive } from './googleDriveService'; // Import service upload đã tạo

// --- DOCUMENT MANAGEMENT (API BACKEND) ---

export const fetchDocuments = async (): Promise<Document[]> => {
    const res = await api.get<Document[]>('/documents');
    return res.success ? res.data : [];
};

export const fetchDocLineItems = async (docId: string): Promise<ExtractedItem[]> => {
    // Gọi API lấy dòng chi tiết. Nếu Backend hỗ trợ filter thì tốt, không thì filter client
    const res = await api.get<ExtractedItem[]>('/doc_lines', { docId });
    if (res.success) {
        // Nếu API trả về tất cả, ta filter lại cho chắc
        return res.data.filter(l => l.docId === docId);
    }
    return [];
};

export const uploadDocument = async (file: File, partnerId: string): Promise<Document> => {
    // 1. Upload File lên Backend/Drive
    let fileUrl = '';
    let driveLink = '';
    
    try {
        const attachment = await uploadFileToDrive(file);
        // Ưu tiên dùng URL local (backend) để hiển thị preview (iframe/img) vì nó ổn định hơn link Drive View
        fileUrl = attachment.url; 
        driveLink = attachment.driveLink || '';
    } catch (e) {
        console.error("Upload file thất bại, dùng Blob tạm thời:", e);
        fileUrl = URL.createObjectURL(file);
    }

    // 2. Tạo bản ghi Document
    const newDoc: Document = {
        id: `doc_${Date.now()}`,
        name: file.name,
        type: file.name.toLowerCase().includes('invoice') ? DocumentType.INVOICE : DocumentType.QUOTATION,
        fileUrl: fileUrl, 
        // driveLink: driveLink, // Nếu interface Document có trường này thì bỏ comment
        partnerId,
        uploadedBy: 'ADMIN', // Nên lấy từ User Context
        status: ProcessingStatus.ANALYZING,
        createdAt: new Date().toISOString()
    };

    // Lưu Document vào DB
    const createRes = await api.post<Document>('/documents', newDoc);
    if (!createRes.success) throw new Error("Không thể tạo bản ghi tài liệu: " + createRes.message);

    // 3. Gọi AI Extraction (Client-side)
    try {
        const { lineItems, validation } = await extractInvoiceDataWithGemini(file, newDoc.id);
        
        // 4. Auto-Mapping với Master Data (Lấy mới nhất từ API)
        const masterData = await fetchMaterialMaster();
        const processedLines = lineItems.map(line => {
            if (!line.mappedMaterialId) {
                const match = masterData.find(m => 
                    m.name.toLowerCase() === line.rawName.toLowerCase() ||
                    line.rawName.toLowerCase().includes(m.name.toLowerCase())
                );
                if (match) return { ...line, mappedMaterialId: match.id };
            }
            return line;
        });

        // 5. Lưu các dòng chi tiết (Doc Lines) vào DB
        // Dùng Promise.all để lưu song song cho nhanh
        const stagingLines = processedLines.map(l => ({ ...l, status: 'PENDING' }));
        await Promise.all(stagingLines.map(line => api.post('/doc_lines', line)));

        // 6. Cập nhật trạng thái Document -> REVIEW_NEEDED
        const updatedDoc = { 
            ...newDoc, 
            status: ProcessingStatus.REVIEW_NEEDED, 
            aiValidation: validation 
        };
        await api.put(`/documents/${newDoc.id}`, updatedDoc);

        return updatedDoc;

    } catch (e) {
        console.error("Lỗi xử lý AI:", e);
        // Cập nhật trạng thái lỗi
        await api.put(`/documents/${newDoc.id}`, { ...newDoc, status: ProcessingStatus.ERROR });
        throw e;
    }
};

export const commitDocument = async (docId: string, lines: ExtractedItem[]): Promise<void> => {
    // 1. Lấy thông tin Document hiện tại
    const docRes = await api.get<Document>(`/documents/${docId}`);
    if (!docRes.success || !docRes.data) throw new Error("Không tìm thấy tài liệu.");
    const doc = docRes.data;

    const validLines = lines.filter(l => !l.isIgnored && l.mappedMaterialId);
    if (validLines.length === 0) {
        throw new Error("Không có dòng nào được map với vật tư. Vui lòng kiểm tra lại.");
    }

    // 2. Cập nhật lại Doc Lines (để lưu trạng thái Ignored/Mapped)
    // Lưu ý: Update từng dòng có thể chậm nếu nhiều, nhưng an toàn.
    await Promise.all(lines.map(l => api.put(`/doc_lines/${l.id}`, l)));

    // 3. Tạo Price Records (Lịch sử giá)
    const newRecords: PriceRecord[] = validLines.map(line => ({
        id: `pr_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
        materialId: line.mappedMaterialId!,
        partnerId: doc.partnerId!,
        price: line.rawPrice,
        unit: line.rawUnit,
        date: new Date().toISOString().split('T')[0],
        dataSource: DataSource.FROM_AI,
        sourceType: doc.type as DocumentType,
        sourceDocId: doc.id,
        resolvedName: line.rawName,
        createdAt: new Date().toISOString()
    }));

    await Promise.all(newRecords.map(r => api.post('/price_records', r)));

    // 4. Hoàn tất Document
    await api.put(`/documents/${docId}`, { ...doc, status: ProcessingStatus.COMPLETED });
};