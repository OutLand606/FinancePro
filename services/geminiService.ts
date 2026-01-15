
import { GoogleGenAI } from "@google/genai";
import { Project, Transaction, TransactionType, MaterialEstimation, PriceRecord, Partner, PartnerPerformance, Office } from '../types';
import { getAIKnowledge } from './aiKnowledgeService';
import { api } from "./api";

const getAiClient = async () => {
    try {
        const res: any = await api.get<{apiKey: string}>('/api/gemini-key');
        const apiKey = (res.success && res.apiKey) ? res.apiKey : '';
        const modelName = (res.success && res.model) ? res.model : 'gemini-3-flash-preview';
        if (!apiKey) {
            throw new Error("Key chưa được cấu hình trong hệ thống.");
        }

        return {
            ai: new GoogleGenAI({ apiKey }),
            model: modelName
        };
        
    } catch (error) {
        console.error("AI Client Init Error:", error);
        throw new Error("⛔ LỖI CẤU HÌNH: Chưa nhập Gemini API Key.\nVui lòng vào Cấu hình > Google Integration để kích hoạt AI.");
    }
};

// --- SYSTEM CHECK: Dùng để test kết nối ở màn hình Cấu hình ---
export const testGeminiConnection = async (): Promise<boolean> => {
    try {
        const {ai, model} = await getAiClient();
        const response = await ai.models.generateContent({
            model: model,
            contents: "Ping. Reply with 'Pong' only.",
        });
        return !!response.text;
    } catch (error) {
        console.error("Gemini Connection Failed:", error);
        throw new Error("Kết nối thất bại. Kiểm tra lại Key hoặc Internet.");
    }
};

export const analyzeProjectFinances = async (
  project: Project,
  transactions: Transaction[]
): Promise<string> => {
  const {ai, model} = await getAiClient();
  const knowledge = getAIKnowledge(); // LOAD TRÍ NHỚ ĐÃ HỌC TỪ CÁC DỰ ÁN KHÁC

  const projectTrans = transactions.filter(t => t.projectId === project.id);
  const income = projectTrans
    .filter(t => t.type === TransactionType.INCOME)
    .reduce((sum, t) => sum + t.amount, 0);
  const expense = projectTrans
    .filter(t => t.type === TransactionType.EXPENSE)
    .reduce((sum, t) => sum + t.amount, 0);

  // AI sẽ so sánh dự án này với kiến thức đã học (Hao hụt, Mua lẻ...)
  const prompt = `
    Bạn là một chuyên gia phân tích tài chính xây dựng cao cấp.
    Hãy phân tích dữ liệu sau đây cho công trình: "${project.name}" (Mã: ${project.code}).
    
    TRI THỨC TÍCH LŨY CỦA CÔNG TY (MEMORY):
    - Các vật tư thường bị hao hụt/lãng phí: ${Object.keys(knowledge.wasteCoefficients).join(', ')}
    - Các khoản chi lắt nhắt cần cảnh báo: ${knowledge.edgeMaterialKeywords.join(', ')}

    Dữ liệu thực tế:
    - Tổng thu: ${income.toLocaleString('vi-VN')} VND
    - Tổng chi: ${expense.toLocaleString('vi-VN')} VND
    - Lợi nhuận hiện tại: ${(income - expense).toLocaleString('vi-VN')} VND

    Danh sách chi tiết các giao dịch (Mới nhất trước):
    ${projectTrans.slice(0, 20).map(t => 
      `- ${t.date}: [${t.type === TransactionType.INCOME ? 'THU' : 'CHI'}] ${t.amount.toLocaleString('vi-VN')} VND - ${t.category} - ${t.description}`
    ).join('\n')}

    Vui lòng đưa ra nhận xét:
    1. So sánh với kinh nghiệm cũ (Memory), dự án này có đang phạm phải các lỗi lãng phí thường gặp không?
    2. Đánh giá dòng tiền và rủi ro.
    
    Định dạng câu trả lời bằng Markdown, dùng các gạch đầu dòng rõ ràng.
  `;

  try {
    const response = await ai.models.generateContent({
        model: model,
        contents: "Ping. Reply with 'Pong' only.",
    });
    return response.text || "Không thể tạo phân tích vào lúc này.";
  } catch (error: any) {
    console.error("Gemini API Error:", error);
    return `Lỗi AI: ${error.message}`;
  }
};

// --- NEW: PROJECT STRATEGY ADVISOR ---
export const generateProjectStrategy = async (
    project: Project,
    estimations: MaterialEstimation[],
    priceRecords: PriceRecord[]
): Promise<any> => {
    const {ai, model} = await getAiClient();
    const knowledge = getAIKnowledge(); // LOAD TRÍ NHỚ

    // Prepare context data
    const materialSummary = estimations.slice(0, 20).map(e => 
        `- ${e.rawName} (${e.estimatedQty} ${e.unit})`
    ).join('\n');

    const priceContext = priceRecords.slice(0, 10).map(r => 
        `- ${r.resolvedName}: ${r.price} VND (NCC: ${r.partnerId})`
    ).join('\n');

    const prompt = `
        BẠN LÀ GIÁM ĐỐC DỰ ÁN & CHUYÊN GIA CUNG ỨNG (PROCUREMENT MANAGER).
        Nhiệm vụ: Đưa ra chiến lược mua sắm và quản lý rủi ro cho công trình: "${project.name}".

        TRI THỨC TÍCH LŨY (MEMORY) TỪ CÁC DỰ ÁN TRƯỚC:
        - Hệ số hao hụt thực tế đã học: ${JSON.stringify(knowledge.wasteCoefficients)}
        - Danh sách vật tư hay bị mua lẻ tẻ (cần gom đơn): ${knowledge.edgeMaterialKeywords.join(', ')}

        Dữ liệu đầu vào hiện tại:
        1. Danh mục vật tư (BOQ):
        ${materialSummary}

        2. Dữ liệu giá thị trường gần đây:
        ${priceContext}

        Yêu cầu Output JSON (Không Markdown, Chỉ JSON thuần túy):
        {
            "risks": [
                { "level": "HIGH" | "MEDIUM" | "LOW", "title": "Tên rủi ro", "content": "Mô tả ngắn gọn và giải pháp (Dựa trên Memory)" }
            ],
            "strategy": {
                "buyingMode": "BATCH" | "PHASED",
                "title": "Chiến lược mua hàng",
                "explanation": "Tại sao nên mua gộp hay chia đợt? Dựa trên khối lượng vật tư và dòng tiền."
            },
            "hiddenItems": [
                { "name": "Tên vật tư ẩn", "reason": "Tại sao cần mua thêm (ví dụ: phụ kiện, vật tư tiêu hao thường bị quên)" }
            ],
            "supplierRecommendations": [
                { "material": "Tên vật tư", "supplier": "Tên NCC gợi ý", "reason": "Lý do (Giá rẻ / Uy tín)" }
            ]
        }

        Logic suy luận:
        - Sử dụng "Hệ số hao hụt" từ Memory để cảnh báo nếu số lượng ước tính có vẻ thiếu.
        - Nếu vật tư nằm trong danh sách "mua lẻ" (edgeMaterialKeywords), hãy gợi ý mua dư ra một chút hoặc gom đơn lớn ngay từ đầu.
        - "hiddenItems": Hãy suy luận dựa trên loại công trình và tri thức xây dựng.
    `;

    try {
        const response = await ai.models.generateContent({
            model: model,
            contents: "Ping. Reply with 'Pong' only.",
        });
        
        return JSON.parse(response.text || '{}');
    } catch (error) {
        console.error("AI Strategy Error:", error);
        return null;
    }
};

// --- NEW FEATURE: PARTNER INSIGHT GENERATOR ---
export const generatePartnerInsight = async (
    partner: Partner,
    stats: PartnerPerformance
): Promise<string> => {
    const {ai, model} = await getAiClient();

    const prompt = `
        Bạn là Chuyên gia Quản trị Quan hệ Khách hàng (CRM) & Tài chính.
        Hãy phân tích đối tác/khách hàng sau:
        - Tên: ${partner.name}
        - Vai trò: ${partner.type === 'CUSTOMER' ? 'Khách hàng (Chủ đầu tư)' : 'Đối tác cung ứng'}
        - Tổng giá trị giao dịch (Thực thu/Thực chi): ${(stats.totalRevenue || stats.totalSpent || 0).toLocaleString()} VNĐ
        - Công nợ hiện tại: ${(stats.totalDebt || 0).toLocaleString()} VNĐ
        - Tỷ lệ nợ: ${stats.debtRatio?.toFixed(1)}%
        - Số lượng dự án tham gia: ${stats.projectCount}
        - Điểm tín nhiệm hệ thống chấm: ${stats.aiScore}/100

        Nhiệm vụ: Đưa ra nhận xét và lời khuyên hành động cụ thể trong 1 đoạn văn ngắn (tối đa 3 câu).
        Văn phong: Chuyên nghiệp, sắc sảo, tập trung vào dòng tiền và quản trị rủi ro.
        
        Ví dụ:
        - Nếu nợ cao: Cảnh báo rủi ro, đề xuất ngừng cung cấp dịch vụ hoặc yêu cầu thanh toán trước.
        - Nếu doanh số lớn, nợ thấp: Đề xuất chăm sóc VIP, tặng quà hoặc upsell.
        - Nếu không có giao dịch gần đây: Đề xuất liên hệ lại để hâm nóng quan hệ.
    `;

    try {
        const response = await ai.models.generateContent({
            model: model,
            contents: "Ping. Reply with 'Pong' only.",
        });
        return response.text || "Chưa đủ dữ liệu để AI phân tích.";
    } catch (error) {
        console.error("AI Partner Insight Error:", error);
        return "Hệ thống AI đang bận hoặc chưa cấu hình Key.";
    }
};

// --- NEW FEATURE: SALARY FORMULA GENERATOR ---
export const generateSalaryFormula = async (
    description: string,
    availableVariables: { code: string; label: string }[]
): Promise<string> => {
    const {ai, model} = await getAiClient();

    const varList = availableVariables.map(v => `- ${v.label}: {${v.code}}`).join('\n');

    const prompt = `
        Bạn là chuyên gia lập trình công thức tính lương (Excel/JS).
        Nhiệm vụ: Chuyển đổi mô tả tự nhiên tiếng Việt sang công thức toán học sử dụng các Mã Biến (Variable Code) có sẵn.

        Danh sách biến hệ thống có sẵn:
        ${varList}
        - Nếu (IF/ELSE): Dùng toán tử 3 ngôi (condition ? true_val : false_val)
        - Cộng (+), Trừ (-), Nhân (*), Chia (/)

        Yêu cầu người dùng: "${description}"

        Quy tắc output:
        1. Chỉ trả về chuỗi công thức. KHÔNG giải thích, KHÔNG markdown.
        2. Nếu không tìm thấy biến phù hợp, hãy cố gắng suy luận hoặc dùng số cứng, nhưng ưu tiên dùng biến trong ngoặc nhọn {}.
        3. Ví dụ input: "Lương cơ bản chia 26 nhân ngày làm" -> output: "{base_salary} / 26 * {actual_work_days}"
    `;

    try {
        const response = await ai.models.generateContent({
            model: model,
            contents: "Ping. Reply with 'Pong' only.",
        });
        return response.text?.trim() || "";
    } catch (error) {
        console.error("AI Formula Gen Error:", error);
        throw new Error("AI không thể tạo công thức lúc này. Vui lòng kiểm tra API Key.");
    }
};

// --- NEW FEATURE: OFFICE & STORE INTELLIGENCE 360 (THE GOD VIEW) ---
export const generateStoreIntelligence = async (
    office: Office,
    transactions: Transaction[]
): Promise<any> => {
    const {ai, model} = await getAiClient();
    const knowledge = getAIKnowledge(); // LOAD TRÍ NHỚ CÔNG TY

    // 1. Pre-process Data (Minimizing tokens while maximizing context)
    // Filter last 6 months for trend analysis
    const sortedTrans = transactions.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 500);
    
    // Summarize for context:
    const dataContext = sortedTrans.map(t => 
        `${t.date}|${t.type}|${t.amount}|${t.description}|${t.category}`
    ).join('\n');

    const prompt = `
        BẠN LÀ GIÁM ĐỐC VẬN HÀNH (COO) & PHÂN TÍCH DỮ LIỆU.
        
        Nhiệm vụ: Phân tích nhật ký giao dịch của "${office.name}" để đưa ra bức tranh toàn cảnh.
        
        SỬ DỤNG TRÍ NHỚ HỆ THỐNG (AI MEMORY):
        - Các khoản chi thường bị lãng phí (Mua lẻ tẻ): ${knowledge.edgeMaterialKeywords.join(', ')}
        - Hãy kiểm tra xem văn phòng này có đang mắc phải các lỗi mua sắm này không.

        Dữ liệu giao dịch (Ngày | Loại | Số tiền | Diễn giải | Hạng mục):
        ${dataContext}

        YÊU CẦU OUTPUT JSON (Strict JSON only):
        {
            "anomalies": [
                { "severity": "HIGH" | "MEDIUM", "title": "Tiêu đề ngắn", "description": "Mô tả bất thường (VD: Chi phí mua lẻ tăng cao, Điện nước tăng đột biến...)" }
            ],
            "salesForecast": [
                { "productName": "Tên sản phẩm/dịch vụ", "trend": "UP" | "DOWN" | "STABLE", "suggestedRestock": number (ước lượng), "reason": "Lý do (VD: Bán chạy vào cuối tuần/cuối tháng...)" }
            ],
            "cashFlowForecast": [
                { "date": "YYYY-MM-DD (Dự kiến)", "amount": number, "description": "Khoản chi dự báo (VD: Trả tiền mặt bằng, Internet...)", "confidence": "Cao" | "TB" }
            ],
            "strategicAdvice": "Lời khuyên quản trị tổng thể sắc sảo (dưới 100 từ). Hãy nhắc nhở nếu thấy Văn phòng đang chi tiêu lãng phí theo thói quen cũ.",
            "topSellingItems": ["Sản phẩm A", "Sản phẩm B"] (Trích xuất từ nội dung thu tiền)
        }

        LOGIC PHÂN TÍCH:
        1. **Anomalies**: Tìm các khoản chi bất thường (giá trị lớn, tần suất lạ) hoặc doanh thu sụt giảm đột ngột.
        2. **Sales Forecast**: Phân tích các giao dịch 'INCOME'. Nhóm các sản phẩm hay bán chạy (dựa vào từ khóa trong description). Dự báo nhu cầu sắp tới.
        3. **Cash Flow**: Tìm các khoản chi định kỳ (tiền nhà, điện, nước, lương) để dự báo ngày phải chi tiếp theo.
        4. **Restock**: Nếu thấy bán nhiều SP A, hãy gợi ý nhập thêm.
    `;

    try {
        const response = await ai.models.generateContent({
            model: model,
            contents: prompt,
            config: { responseMimeType: "application/json" }
        });
        
        return JSON.parse(response.text || '{}');
    } catch (error) {
        console.error("AI Store Intel Error:", error);
        return null;
    }
};

// --- NEW: SMART ASSISTANT INSIGHTS (ACCOUNTANT & DIRECTOR) ---
export const generateSmartAssistantInsights = async (
    role: 'ACCOUNTANT' | 'DIRECTOR',
    transactions: Transaction[]
): Promise<any> => {
    const {ai, model} = await getAiClient();
    const knowledge = getAIKnowledge(); // Load trí nhớ hệ thống
    
    // Slice last 50 transactions for context
    const recentTrans = transactions.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 50);
    const context = recentTrans.map(t => `${t.date}|${t.type}|${t.amount}|${t.category}|${t.description}`).join('\n');

    // System Memory Context
    const memoryContext = `
        - Các vật tư thường bị mua lắt nhắt (cần chú ý gộp đơn): ${knowledge.edgeMaterialKeywords.join(', ')}
    `;

    const prompt = `
        Vai trò của bạn: ${role === 'ACCOUNTANT' ? 'Trợ lý Kế toán Trưởng' : 'Giám đốc Tài chính (CFO) Ảo'}.
        Nhiệm vụ: Phân tích danh sách 50 giao dịch gần nhất và đưa ra gợi ý hành động.
        
        TRI THỨC HỆ THỐNG ĐÃ HỌC (MEMORY):
        ${memoryContext}

        Dữ liệu giao dịch mới nhất:
        ${context}

        Yêu cầu Output JSON (Strict JSON):
        {
            "tasks": [
                { "type": "TODO" | "REMINDER" | "WARNING", "title": "Tiêu đề ngắn", "desc": "Mô tả việc cần làm" }
            ],
            "insights": [
                { "title": "Tiêu đề insight", "value": "Con số/Nội dung chính", "trend": "UP" | "DOWN" | "NEUTRAL" }
            ],
            "forecast": {
                "message": "Dự báo ngắn gọn cho tuần tới (dòng tiền, chi phí...)"
            }
        }

        LOGIC SUY LUẬN:
        ${role === 'ACCOUNTANT' 
            ? `- Tìm các khoản chi định kỳ sắp đến hạn (Điện, Nước, Lương).
               - Cảnh báo nếu có giao dịch trùng lặp hoặc thiếu thông tin.
               - Dựa vào Memory: Nếu thấy đang mua lắt nhắt các vật tư trong danh sách "edgeMaterialKeywords", hãy gợi ý gom đơn.`
            : `- Tập trung vào bức tranh lớn: Tốc độ tiêu tiền (Burn rate).
               - Cảnh báo nếu chi phí tăng đột biến so với doanh thu.
               - Đề xuất cắt giảm lãng phí nếu thấy chi phí "Tiếp khách", "Khác" quá cao.`
        }
    `;

    try {
        const response = await ai.models.generateContent({
            model: model,
            contents: prompt,
            config: { responseMimeType: "application/json" }
        });
        return JSON.parse(response.text || '{}');
    } catch (error) {
        console.error("AI Assistant Error:", error);
        return { tasks: [], insights: [], forecast: { message: "AI đang nghỉ ngơi hoặc chưa có Key..." } };
    }
};
