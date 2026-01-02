
import { DocumentValidation, MaterialEstimation, EstimationStatus } from '../types';
import { getAIKnowledge } from './aiKnowledgeService';
import { GoogleGenAI } from "@google/genai";
import { GEMINI_API_KEY } from '@/constants';

const getAiClient = async () => {
    const apiKey = GEMINI_API_KEY
    if (!apiKey) throw new Error("Vui lòng cấu hình Gemini API Key trong phần Cài đặt hệ thống.");
    return new GoogleGenAI({ apiKey });
};

const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = error => reject(error);
  });
};

// --- NEW: EXTRACT TIMESHEET ---
export const extractTimesheetFromImage = async (file: File, month: string): Promise<any[]> => {
    const ai = await getAiClient();
    try {
        const base64Data = await fileToBase64(file);
        const prompt = `
            BẠN LÀ CHUYÊN GIA SỐ HÓA BẢNG CHẤM CÔNG.
            Nhiệm vụ: Phân tích hình ảnh bảng chấm công tháng ${month}.
            
            Quy tắc đọc dữ liệu:
            1. Tìm các hàng chứa tên nhân viên.
            2. Tìm các cột ngày (1, 2, 3... 31).
            3. Đọc ký hiệu chấm công:
               - "X", "x", "1", "V", tích : 1 công (Full day)
               - "/", "1/2", "0.5", "N" : 0.5 công (Half day)
               - Trống hoặc "0": 0 công.
            
            Yêu cầu Output JSON:
            [
                {
                    "empName": "Tên nhân viên trên giấy",
                    "days": {
                        "1": 1,
                        "2": 0.5,
                        ... (chỉ liệt kê ngày có đi làm)
                    }
                }
            ]
            
            Chỉ trả về JSON thuần túy, không Markdown.
        `;

        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: {
                parts: [
                    { inlineData: { mimeType: file.type, data: base64Data } },
                    { text: prompt }
                ]
            }
        });

        const text = response.text || '';
        const cleanJson = text.replace(/```json/g, '').replace(/```/g, '').trim();
        return JSON.parse(cleanJson);
    } catch (error) {
        console.error("AI Timesheet Scan Error:", error);
        throw new Error("Không thể đọc bảng công. Vui lòng đảm bảo ảnh rõ nét và chụp thẳng góc.");
    }
};

// --- NEW: PARSE TEXT COMMAND ---
export const parseTransactionFromText = async (textCommand: string) => {
    const ai = await getAiClient();
    
    try {
        const prompt = `
            BẠN LÀ TRỢ LÝ KẾ TOÁN AI.
            Nhiệm vụ: Phân tích câu lệnh nhập liệu tự nhiên của nhân viên.
            Input: "${textCommand}"
            
            Yêu cầu logic:
            1. Loại phiếu: Nếu có từ "thu", "nhận", "ứng" (từ khách) -> INCOME. Nếu "chi", "trả", "chuyển", "mua" -> EXPENSE.
            2. Số tiền: Chuyển đổi các từ lóng (k, củ, tr, triệu) thành số nguyên. VD: 5 củ -> 5000000.
            3. Đối tượng: Tìm tên người hoặc công ty.
            4. Hạng mục: Suy luận từ nội dung (VD: xi măng -> Vật liệu xây thô, cơm -> Ăn ca, lương -> Nhân công).
            
            Trả về JSON duy nhất (Không markdown):
            {
                "date": "YYYY-MM-DD" (mặc định hôm nay nếu không nói rõ),
                "amount": number,
                "description": "string" (viết lại cho chuẩn văn phong kế toán),
                "partnerName": "string",
                "category": "string",
                "type": "INCOME" | "EXPENSE"
            }
        `;

        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: prompt
        });

        const raw = response.text || '';
        const cleanJson = raw.replace(/```json/g, '').replace(/```/g, '').trim();
        return JSON.parse(cleanJson);
    } catch (error) {
        console.error("AI Text Parse Error:", error);
        return null;
    }
};

export const extractTransactionFromImage = async (file: File) => {
    const ai = await getAiClient();
    
    try {
        const base64Data = await fileToBase64(file);
        const prompt = `
            BẠN LÀ KẾ TOÁN TRƯỞNG XÂY DỰNG. 
            Nhiệm vụ: Phân tích ảnh phiếu thu, phiếu chi, hóa đơn hoặc lệnh chuyển tiền đính kèm.
            Yêu cầu:
            1. Trích xuất chính xác: Ngày tháng, Tổng số tiền, Nội dung/Lý do, Tên đối tượng (NCC hoặc người nộp).
            2. Xác định loại phiếu là 'INCOME' (Thu) hay 'EXPENSE' (Chi).
            3. Trả về định dạng JSON duy nhất:
            {
                "date": "YYYY-MM-DD",
                "amount": number,
                "description": "string",
                "partnerName": "string",
                "type": "INCOME" | "EXPENSE"
            }
            Lưu ý: Nếu không đọc được trường nào, hãy để null. Không trả thêm văn bản ngoài JSON.
        `;

        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: {
                parts: [
                    { inlineData: { mimeType: file.type, data: base64Data } },
                    { text: prompt }
                ]
            }
        });

        const text = response.text || '';
        const cleanJson = text.replace(/```json/g, '').replace(/```/g, '').trim();
        return JSON.parse(cleanJson);
    } catch (error) {
        console.error("AI Scan Error:", error);
        throw new Error("AI không thể đọc được ảnh này. Vui lòng kiểm tra API Key hoặc dùng ảnh rõ nét hơn.");
    }
};

export const extractBOQDataWithGemini = async (file: File, projectId: string): Promise<MaterialEstimation[]> => {
    const ai = await getAiClient();
    const coreKnowledge = getAIKnowledge();
    const wasteContext = JSON.stringify(coreKnowledge.wasteCoefficients);
    const edgeKeywords = coreKnowledge.edgeMaterialKeywords.join(', ');

    try {
        const base64Data = await fileToBase64(file);
        const prompt = `
            BẠN LÀ KỸ SƯ QS TRƯỞNG VỚI TRÍ NHỚ ĐÃ ĐƯỢC HUẤN LUYỆN.
            TRI THỨC ĐỊNH MỨC: ${wasteContext}
            TRI THỨC VẬT TƯ MUA LẺ: ${edgeKeywords}
            Bóc tách danh mục vật tư từ BOQ đính kèm. Trả về JSON: { "estimations": [{ "rawName": string, "unit": string, "estimatedQty": number }] }
        `;
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: { parts: [{ inlineData: { mimeType: file.type, data: base64Data } }, { text: prompt }] }
        });
        const text = response.text || '';
        const cleanJson = text.replace(/```json/g, '').replace(/```/g, '').trim();
        const result = JSON.parse(cleanJson);
        return (result.estimations || []).map((item: any) => ({
            id: `est_ai_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
            projectId: projectId,
            rawName: item.rawName,
            unit: item.unit || 'Cái',
            estimatedQty: Number(item.estimatedQty) || 0,
            usedQty: 0,
            status: EstimationStatus.PLANNED,
            source: 'BOQ',
            createdAt: new Date().toISOString()
        }));
    } catch (error: any) { throw error; }
};

export const extractInvoiceDataWithGemini = async (file: File, docId: string): Promise<{lineItems: any[], validation: DocumentValidation}> => {
    const ai = await getAiClient();
    try {
        const base64Data = await fileToBase64(file);
        const prompt = `Bạn là chuyên gia kế toán xây dựng. Hãy phân tích hóa đơn/báo giá. Chỉ trả về JSON duy nhất: { "items": [{ "rawName": string, "rawUnit": string, "rawQty": number, "rawPrice": number }], "validation": { "isValid": boolean, "riskLevel": "LOW"|"MEDIUM"|"HIGH", "issues": string[], "detectedType": string, "confidence": number } }`;
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: { parts: [{ inlineData: { mimeType: file.type, data: base64Data } }, { text: prompt }] }
        });
        const text = response.text || '';
        const cleanJson = text.replace(/```json/g, '').replace(/```/g, '').trim();
        const result = JSON.parse(cleanJson);
        return { lineItems: (result.items || []).map((item: any, idx: number) => ({ id: `line_${docId}_${idx}`, docId, ...item, status: 'PENDING', isIgnored: false })), validation: result.validation };
    } catch (error: any) { throw error; }
};
