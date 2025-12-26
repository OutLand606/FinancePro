
import { Document, ProcessingStatus, DocumentType, PriceRecord, MaterialMaster, Partner, DataSource, ExtractedItem } from '../types';
import { INITIAL_PRICE_RECORDS } from '../constants';
import { extractInvoiceDataWithGemini } from './aiExtractionService';
import { getSettings } from './sheetService';
import { fetchMaterialMaster } from './masterDataService';

const STORAGE_KEYS = {
  DOCUMENTS: 'finance_documents',
  DOC_LINES: 'finance_doc_lines', 
  PRICE_RECORDS: 'finance_price_records'
};

const getDocuments = (): Document[] => {
  const s = localStorage.getItem(STORAGE_KEYS.DOCUMENTS);
  return s ? JSON.parse(s) : [];
};

const getExtractedItems = (docId: string): ExtractedItem[] => {
  const s = localStorage.getItem(STORAGE_KEYS.DOC_LINES);
  const allLines: ExtractedItem[] = s ? JSON.parse(s) : [];
  return allLines.filter(l => l.docId === docId);
};

export const uploadDocument = async (file: File, partnerId: string): Promise<Document> => {
  // 1. Create Document Record
  const newDoc: Document = {
    id: `doc_${Date.now()}`,
    name: file.name,
    type: file.name.toLowerCase().includes('invoice') ? DocumentType.INVOICE : DocumentType.QUOTATION,
    fileUrl: URL.createObjectURL(file), // Note: For persistent apps, upload to cloud/drive
    partnerId,
    uploadedBy: 'NV01',
    status: ProcessingStatus.UPLOADED,
    createdAt: new Date().toISOString()
  };

  const docs = getDocuments();
  localStorage.setItem(STORAGE_KEYS.DOCUMENTS, JSON.stringify([newDoc, ...docs]));

  // 2. Trigger AI Extraction (Now passes the actual File object)
  updateDocStatus(newDoc.id, ProcessingStatus.ANALYZING);
  
  // CALL REAL AI SERVICE
  const { lineItems, validation } = await extractInvoiceDataWithGemini(file, newDoc.id);
  
  // Update Document with Validation Result
  const updatedDocs = getDocuments().map(d => d.id === newDoc.id ? { ...d, aiValidation: validation } : d);
  localStorage.setItem(STORAGE_KEYS.DOCUMENTS, JSON.stringify(updatedDocs));

  // 3. Post-Process: Auto-Mapping with Master Data
  const masterData = await fetchMaterialMaster();
  const processedLines = lineItems.map(line => {
      // Fuzzy match logic
      if (!line.mappedMaterialId) {
          const match = masterData.find(m => 
              m.name.toLowerCase() === line.rawName.toLowerCase() ||
              line.rawName.toLowerCase().includes(m.name.toLowerCase())
          );
          if (match) {
              return { ...line, mappedMaterialId: match.id };
          }
      }
      return line;
  });

  const stagingLines: ExtractedItem[] = processedLines.map(l => ({ ...l, status: 'PENDING' }));
  
  const currentLines = localStorage.getItem(STORAGE_KEYS.DOC_LINES);
  const allLines: ExtractedItem[] = currentLines ? JSON.parse(currentLines) : [];
  localStorage.setItem(STORAGE_KEYS.DOC_LINES, JSON.stringify([...stagingLines, ...allLines]));
  
  updateDocStatus(newDoc.id, ProcessingStatus.REVIEW_NEEDED);

  // Return the Updated Document (so UI reflects new status)
  return getDocuments().find(d => d.id === newDoc.id) || newDoc;
};

export const fetchDocuments = async (): Promise<Document[]> => {
  return getDocuments();
};

export const fetchDocLineItems = async (docId: string): Promise<ExtractedItem[]> => {
  return getExtractedItems(docId);
};

export const commitDocument = async (docId: string, lines: ExtractedItem[]): Promise<void> => {
    const docs = getDocuments();
    const doc = docs.find(d => d.id === docId);
    if (!doc) throw new Error("Document not found");

    const validLines = lines.filter(l => !l.isIgnored && l.mappedMaterialId);
    if (validLines.length === 0) {
        throw new Error("Không có dòng nào được map với vật tư.");
    }

    // Fix: Correct mapping for PriceRecord including sourceType and resolvedName
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
        resolvedName: line.rawName, // Added this field
        createdAt: new Date().toISOString()
    }));

    const storedPrices = localStorage.getItem(STORAGE_KEYS.PRICE_RECORDS);
    const existingPrices: PriceRecord[] = storedPrices ? JSON.parse(storedPrices) : INITIAL_PRICE_RECORDS;
    localStorage.setItem(STORAGE_KEYS.PRICE_RECORDS, JSON.stringify([...newRecords, ...existingPrices]));

    updateDocStatus(docId, ProcessingStatus.COMPLETED);
};

const updateDocStatus = (docId: string, status: ProcessingStatus) => {
    const docs = getDocuments();
    const updated = docs.map(d => d.id === docId ? { ...d, status } : d);
    localStorage.setItem(STORAGE_KEYS.DOCUMENTS, JSON.stringify(updated));
};
