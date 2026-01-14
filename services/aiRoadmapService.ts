
import { GoogleGenAI } from "@google/genai";
import { RoadmapTemplate, RoadmapStage, RoadmapLog, ProjectRoadmap, StageStatus } from "../types";
import { getSettings } from "./sheetService";
import { GEMINI_API_KEY } from "@/constants";

// --- CLIENT SETUP ---
const getAiClient = () => {
    const apiKey = GEMINI_API_KEY;
    if (!apiKey) return null;
    return new GoogleGenAI({ apiKey });
};

// --- AI #1: TẠO LỘ TRÌNH TỰ ĐỘNG ---
export interface RoadmapGenParams {
    buildingType: string; // Nhà dân, Chung cư, Xưởng...
    floors: number;
    area: string;
    systems: string[]; // Báo cháy, Chữa cháy, ...
}

export const generateRoadmapTemplateAI = async (params: RoadmapGenParams): Promise<RoadmapTemplate | null> => {
    const ai = getAiClient();
    if (!ai) throw new Error("Chưa cấu hình API Key");

    const prompt = `
        Bạn là Kỹ sư trưởng PCCC & Cơ điện. Hãy thiết lập khung lộ trình thi công (Roadmap) cho dự án sau:
        - Loại công trình: ${params.buildingType}
        - Quy mô: ${params.floors} tầng, Diện tích: ${params.area}
        - Hệ thống: ${params.systems.join(', ')}

        Yêu cầu Output JSON chuẩn (RoadmapTemplate):
        {
            "name": "Tên lộ trình gợi ý",
            "stages": [
                { "title": "Tên giai đoạn (Ngắn gọn)", "description": "Mô tả công việc chính", "weightPercent": number (Tổng = 100) }
            ]
        }
        
        Quy tắc:
        1. Trình tự thi công phải chuẩn logic xây dựng (Đi ống -> Kéo dây -> Lắp thiết bị -> Test).
        2. Chia thành 5-8 giai đoạn chính.
        3. Ngôn ngữ chuyên ngành PCCC Việt Nam.
    `;

    try {
        const res = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: prompt,
            config: { responseMimeType: "application/json" }
        });
        const json = JSON.parse(res.text || '{}');
        return {
            id: `tpl_ai_${Date.now()}`,
            name: json.name || 'Lộ trình AI Đề xuất',
            stages: json.stages || []
        };
    } catch (e) {
        console.error("AI Roadmap Gen Error:", e);
        return null;
    }
};

// --- AI #3: GỢI Ý NỘI DUNG NHẬT KÝ ---
export const suggestLogContentAI = async (
    rawInput: string, 
    stageTitle: string, 
    location: string
): Promise<string> => {
    const ai = getAiClient();
    if (!ai) return rawInput; // Fallback

    const prompt = `
        Bạn là thư ký công trường. Hãy viết lại nội dung nhật ký thi công sau cho chuyên nghiệp, chuẩn văn phong báo cáo hành chính.
        
        Input thô của thợ: "${rawInput}"
        Ngữ cảnh: Giai đoạn "${stageTitle}", Vị trí "${location}".
        
        Yêu cầu:
        - Giữ nguyên ý nghĩa, chỉ làm văn phong trang trọng hơn.
        - Ngắn gọn (dưới 30 từ).
        - Ví dụ: "làm ống tầng 2 xong rồi" -> "Hoàn thành thi công đường ống cứu hỏa khu vực Tầng 2."
    `;

    try {
        const res = await ai.models.generateContent({ model: 'gemini-3-flash-preview', contents: prompt });
        return res.text?.trim() || rawInput;
    } catch { return rawInput; }
};

// --- AI #4: TÓM TẮT TIẾN ĐỘ CHO CĐT ---
export const generateProgressSummaryAI = async (logs: RoadmapLog[], stages: RoadmapStage[]): Promise<string> => {
    const ai = getAiClient();
    if (!ai) return "Chưa kết nối AI.";

    // Lấy 10 log mới nhất
    const recentLogs = logs.slice(0, 10).map(l => `- ${l.timestamp.split('T')[0]}: ${l.content} (${l.locationTag})`).join('\n');
    const currentStage = stages.find(s => s.status === StageStatus.IN_PROGRESS)?.title || 'Chưa xác định';

    const prompt = `
        Bạn là Trợ lý dự án. Hãy viết một đoạn tóm tắt ngắn (3-4 câu) để báo cáo cho Chủ Đầu Tư về tình hình thi công tuần qua.
        
        Dữ liệu nhật ký gần đây:
        ${recentLogs}
        
        Giai đoạn đang chạy: ${currentStage}
        
        Yêu cầu:
        - Giọng văn lịch sự, chuyên nghiệp, yên tâm.
        - Nêu rõ đã làm được gì và đang làm gì.
        - Nếu không có log nào, hãy nói "Chưa ghi nhận hoạt động mới trong tuần qua."
    `;

    try {
        const res = await ai.models.generateContent({ model: 'gemini-3-flash-preview', contents: prompt });
        return res.text || "Không thể tạo tóm tắt.";
    } catch (e) {
        return "Lỗi AI Summary.";
    }
};

// --- AI #5: BUSINESS ALERTS (Rule-based mostly) ---
export const checkRoadmapHealth = (roadmap: ProjectRoadmap): string[] => {
    const alerts: string[] = [];
    const today = new Date();
    
    // 1. Check inactive days
    if (roadmap.logs.length > 0) {
        const lastLogDate = new Date(roadmap.logs[0].timestamp);
        const diffDays = Math.floor((today.getTime() - lastLogDate.getTime()) / (1000 * 3600 * 24));
        if (diffDays > 3) {
            alerts.push(`⚠️ Đã ${diffDays} ngày không có nhật ký mới.`);
        }
    } else {
        alerts.push("⚠️ Dự án chưa có nhật ký nào.");
    }

    // 2. Check stage evidence
    const completedStages = roadmap.stages.filter(s => s.status === StageStatus.COMPLETED);
    completedStages.forEach(s => {
        const hasProof = roadmap.logs.some(l => l.stageId === s.id && l.photos.length > 0);
        if (!hasProof) {
            alerts.push(`📷 Giai đoạn "${s.title}" đã xong nhưng thiếu ảnh bằng chứng.`);
        }
    });

    // 3. Check pending approval
    const pendingCount = roadmap.logs.filter(l => l.status === 'PENDING_APPROVAL').length;
    if (pendingCount > 5) {
        alerts.push(`📝 Có ${pendingCount} nhật ký chờ duyệt.`);
    }

    return alerts;
};
