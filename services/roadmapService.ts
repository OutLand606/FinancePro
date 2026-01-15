// services/roadmapService.ts
import { 
    ProjectRoadmap, RoadmapTemplate, StageStatus, RoadmapLog, 
    LogType, RoadmapAccessLink, Attachment, RoadmapStage 
} from '../types';
import { api } from './api';

// Định nghĩa tên Collection trong DB Backend
const COLLECTION_ROADMAPS = 'project_roadmaps';
const COLLECTION_TEMPLATES = 'roadmap_templates';

// Dữ liệu mẫu mặc định (Sẽ được ghi vào DB nếu chưa có)
const DEFAULT_TEMPLATES: RoadmapTemplate[] = [
    {
        id: 'tpl_pccc_basic',
        name: 'Thi công PCCC Nhà dân/Cửa hàng',
        stages: [
            { title: 'Tập kết vật tư & Thiết bị', description: 'Vận chuyển ống, tủ báo cháy, dây tín hiệu. Kiểm tra số lượng/chất lượng đầu vào.', weightPercent: 10 },
            { title: 'Nhận mặt bằng & Định vị', description: 'Xác nhận mặt bằng, đánh dấu vị trí đầu báo, tủ trung tâm.', weightPercent: 10 },
            { title: 'Thi công thô (Đi ống/Dây)', description: 'Lắp đặt đường ống, kéo dây tín hiệu âm tường/trần.', weightPercent: 30 },
            { title: 'Lắp đặt thiết bị', description: 'Đấu nối đầu báo, nút nhấn, chuông đèn, tủ trung tâm.', weightPercent: 30 },
            { title: 'Chạy thử (Test nội bộ)', description: 'Kích hoạt thử hệ thống, kiểm tra tín hiệu về tủ.', weightPercent: 10 },
            { title: 'Nghiệm thu & Bàn giao', description: 'Mời CĐT nghiệm thu, hướng dẫn sử dụng.', weightPercent: 10 }
        ]
    },
    {
        id: 'tpl_pccc_building',
        name: 'Hệ thống Chữa cháy Vách tường',
        stages: [
            { title: 'Nhập vật tư đường ống', description: 'Ống thép, van, tê, cút...', weightPercent: 15 },
            { title: 'Gia công & Hàn ống', description: 'Cắt, ren, hàn ống tại xưởng/hiện trường.', weightPercent: 20 },
            { title: 'Lắp đặt trục đứng', description: 'Thi công ống cấp nước chữa cháy trục chính.', weightPercent: 20 },
            { title: 'Lắp đặt nhánh tầng', description: 'Đấu nối vào các tủ chữa cháy vách tường từng tầng.', weightPercent: 20 },
            { title: 'Lắp đặt Bơm & Tủ', description: 'Kết nối cụm bơm chính, bơm bù, tủ điều khiển.', weightPercent: 15 },
            { title: 'Test áp & Nghiệm thu', description: 'Thử kín đường ống (Test áp), vận hành bơm.', weightPercent: 10 }
        ]
    }
];

// --- INTERNAL HELPERS ---

/**
 * Logic tự động gán Log vào Stage
 */
const autoMapLogToStage = (content: string, stages: RoadmapStage[]): string | undefined => {
    const lowerContent = content.toLowerCase();
    const matchedStage = stages.find(s => lowerContent.includes(s.title.toLowerCase()));
    if (matchedStage) return matchedStage.id;
    const activeStage = stages.find(s => s.status === StageStatus.IN_PROGRESS);
    if (activeStage) return activeStage.id;
    const nextStage = stages.find(s => s.status === StageStatus.PENDING);
    if (nextStage) return nextStage.id;
    return undefined;
};

// --- EXPORTED SERVICES (API BASED) ---

// services/roadmapService.ts

export const getRoadmapTemplates = async (): Promise<RoadmapTemplate[]> => {
    try {
        const res = await api.get<RoadmapTemplate[]>(`/${COLLECTION_TEMPLATES}`);
        
        // TRƯỜNG HỢP 1: Có dữ liệu từ Server -> Trả về bình thường
        if (res.success && res.data && Array.isArray(res.data) && res.data.length > 0) {
            return res.data;
        }

        // TRƯỜNG HỢP 2: Server trả về rỗng -> Tiến hành "Lưu ngầm" (Seeding)
        console.log("Database chưa có Templates. Đang khởi tạo mẫu mặc định...");
        
        try {
            // Gửi toàn bộ mảng DEFAULT_TEMPLATES lên để Backend lưu (Bulk Insert)
            // Backend server.js của bạn đã có logic xử lý Array.isArray(body) nên việc này hợp lệ
            await api.post(`/${COLLECTION_TEMPLATES}`, DEFAULT_TEMPLATES);
            console.log("Đã lưu mẫu mặc định vào Database thành công.");
        } catch (seedError) {
            console.error("Lỗi khi lưu mẫu mặc định (không ảnh hưởng hiển thị):", seedError);
        }

        // Trả về dữ liệu mặc định để hiển thị ngay lập tức
        return DEFAULT_TEMPLATES; 

    } catch (error) {
        console.error("Error fetching templates:", error);
        // Nếu lỗi mạng hoặc lỗi Server, vẫn trả về default để App không bị trắng trang
        return DEFAULT_TEMPLATES;
    }
};

export const saveRoadmapTemplate = async (template: RoadmapTemplate): Promise<void> => {
    // Lưu template mới vào DB
    await api.post(`/${COLLECTION_TEMPLATES}`, template);
};

export const getProjectRoadmap = async (projectId: string): Promise<ProjectRoadmap | null> => {
    // Query backend: select * from records where collection='project_roadmaps' and data->>'projectId' = projectId
    // Backend generic của bạn hỗ trợ query params để filter JSON
    const res = await api.get<ProjectRoadmap[]>(`/${COLLECTION_ROADMAPS}`, { projectId });
    
    if (res.success && res.data && res.data.length > 0) {
        return res.data[0]; // Lấy bản ghi đầu tiên khớp projectId
    }
    return null;
};

export const createRoadmapFromTemplate = async (projectId: string, templateId: string): Promise<ProjectRoadmap> => {
    // 1. Lấy danh sách template (có thể từ API hoặc biến local nếu đã cache)
    const templates = await getRoadmapTemplates();
    const tpl = templates.find(t => t.id === templateId);
    if (!tpl) throw new Error("Template not found");

    const roadmapId = `rm_${projectId}_${Date.now()}`;
    const newRoadmap: ProjectRoadmap = {
        id: roadmapId,
        projectId,
        templateName: tpl.name,
        lastUpdated: new Date().toISOString(),
        overallProgress: 0,
        logs: [],
        stages: tpl.stages.map((s, idx) => ({
            id: `st_${Date.now()}_${idx}`,
            roadmapId,
            title: s.title,
            description: s.description,
            status: StageStatus.PENDING,
            order: idx,
            weightPercent: s.weightPercent || 0
        }))
    };

    // 2. Gọi API tạo mới
    await api.post(`/${COLLECTION_ROADMAPS}`, newRoadmap);
    return newRoadmap;
};

export const saveProjectRoadmap = async (roadmap: ProjectRoadmap): Promise<void> => {
    // Update toàn bộ object roadmap
    await api.put(`/${COLLECTION_ROADMAPS}/${roadmap.id}`, roadmap);
};

export const addNewStageToRoadmap = async (roadmap: ProjectRoadmap, title: string): Promise<ProjectRoadmap> => {
    const maxOrder = roadmap.stages.reduce((max, s) => Math.max(max, s.order), -1);
    const newStage: RoadmapStage = {
        id: `st_${Date.now()}_new`,
        roadmapId: roadmap.id,
        title: title,
        description: 'Mô tả công việc...',
        status: StageStatus.PENDING,
        order: maxOrder + 1,
        weightPercent: 0
    };
    
    const updatedRoadmap = {
        ...roadmap,
        stages: [...roadmap.stages, newStage]
    };
    
    await saveProjectRoadmap(updatedRoadmap);
    return updatedRoadmap;
};

/**
 * CORE FUNCTION: Thêm Log - Cần fetch data mới nhất từ server trước khi update để tránh conflict
 */
export const addRoadmapLog = async (
    projectId: string, 
    content: string, 
    photos: Attachment[], 
    performer: { id: string, name: string, role: 'WORKER'|'MANAGER'|'CUSTOMER' },
    location?: string,
    manualStageId?: string,
    logType: LogType = LogType.WORK_REPORT
): Promise<ProjectRoadmap> => {
    
    // 1. Fetch latest version from DB
    const map = await getProjectRoadmap(projectId);
    if (!map) throw new Error("Roadmap not found on server.");

    // 2. Logic xử lý Stage
    const targetStageId = manualStageId || autoMapLogToStage(content, map.stages);

    const newLog: RoadmapLog = {
        id: `log_${Date.now()}`,
        projectId,
        roadmapId: map.id,
        stageId: targetStageId,
        performerId: performer.id,
        performerName: performer.name,
        performerRole: performer.role,
        timestamp: new Date().toISOString(),
        content: content || (photos.length > 0 ? 'Cập nhật hình ảnh hiện trường' : 'Ghi chép công việc'),
        locationTag: location,
        photos,
        type: logType,
        isHighlighted: true,
        status: 'APPROVED'
    };

    map.logs = [newLog, ...map.logs];
    map.lastUpdated = new Date().toISOString();

    // 3. Logic suy diễn trạng thái (Status Inference)
    if (targetStageId) {
        const stageIndex = map.stages.findIndex(s => s.id === targetStageId);
        if (stageIndex >= 0) {
            const currentStatus = map.stages[stageIndex].status;
            
            if (currentStatus === StageStatus.PENDING) {
                map.stages[stageIndex].status = StageStatus.IN_PROGRESS;
                if (!map.stages[stageIndex].startDate) {
                    map.stages[stageIndex].startDate = new Date().toISOString();
                }
            }
            if (logType === LogType.ACCEPTANCE) {
                map.stages[stageIndex].status = StageStatus.COMPLETED;
                map.stages[stageIndex].endDate = new Date().toISOString();
            }
            if (logType === LogType.ISSUE_REPORT) {
                map.stages[stageIndex].status = StageStatus.BLOCKED;
            }
        }
    }

    // 4. Tính toán lại Progress
    const totalWeight = map.stages.reduce((sum, s) => sum + (s.weightPercent || 0), 0);
    const completedWeight = map.stages
        .filter(s => s.status === StageStatus.COMPLETED)
        .reduce((sum, s) => sum + (s.weightPercent || 0), 0);
    const inProgressWeight = map.stages
        .filter(s => s.status === StageStatus.IN_PROGRESS)
        .reduce((sum, s) => sum + ((s.weightPercent || 0) * 0.5), 0);

    map.overallProgress = totalWeight > 0 ? Math.round(((completedWeight + inProgressWeight) / totalWeight) * 100) : 0;

    // 5. Lưu ngược lại Server
    await saveProjectRoadmap(map);
    return map;
};

// --- REPORT HELPERS (Không đổi logic) ---
export const groupLogsByDate = (logs: RoadmapLog[]) => {
    const groups: Record<string, RoadmapLog[]> = {};
    logs.forEach(log => {
        const date = log.timestamp.split('T')[0]; 
        if (!groups[date]) groups[date] = [];
        groups[date].push(log);
    });
    return Object.entries(groups).sort((a,b) => b[0].localeCompare(a[0]));
};

// --- ACCESS LINKS ---
export const generateAccessLink = async (projectId: string, role: 'CUSTOMER' | 'WORKER', label?: string): Promise<string> => {
    const map = await getProjectRoadmap(projectId);
    if (!map) throw new Error("Roadmap not found");

    const token = `access_${role.toLowerCase()}_${projectId.slice(-4)}_${Math.random().toString(36).substr(2,8)}`;
    
    const linkObj: RoadmapAccessLink = {
        token,
        projectId,
        role,
        label: label || (role === 'CUSTOMER' ? 'Khách mời' : 'Tổ đội'),
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        isActive: true
    };
    
    map.accessLinks = [...(map.accessLinks || []), linkObj];
    await saveProjectRoadmap(map);

    const baseUrl = window.location.origin;
    return `${baseUrl}/?token=${token}&mode=roadmap`;
};