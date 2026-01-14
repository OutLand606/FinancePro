
import { 
    ProjectRoadmap, RoadmapTemplate, StageStatus, RoadmapLog, 
    LogType, RoadmapAccessLink, Attachment, RoadmapStage 
} from '../types';

const STORAGE_KEYS = {
    ROADMAPS: 'finance_project_roadmaps',
    TEMPLATES: 'finance_roadmap_templates' // NEW KEY
};

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

const getLocalRoadmaps = (): ProjectRoadmap[] => {
    try {
        const s = localStorage.getItem(STORAGE_KEYS.ROADMAPS);
        return s ? JSON.parse(s) : [];
    } catch { return []; }
};

const saveLocalRoadmaps = (maps: ProjectRoadmap[]) => {
    localStorage.setItem(STORAGE_KEYS.ROADMAPS, JSON.stringify(maps));
};

/**
 * MOCK AI: Tự động đoán Log thuộc về Stage nào
 * Dựa trên: Từ khóa trùng khớp hoặc Giai đoạn đang active
 */
const autoMapLogToStage = (content: string, stages: RoadmapStage[]): string | undefined => {
    const lowerContent = content.toLowerCase();
    
    // 1. Rule-based: Tìm theo từ khóa trong Title
    const matchedStage = stages.find(s => lowerContent.includes(s.title.toLowerCase()));
    if (matchedStage) return matchedStage.id;

    // 2. Context-based: Gán vào giai đoạn đang chạy (IN_PROGRESS)
    const activeStage = stages.find(s => s.status === StageStatus.IN_PROGRESS);
    if (activeStage) return activeStage.id;

    // 3. Fallback: Gán vào giai đoạn PENDING đầu tiên (Giả định là bắt đầu làm cái tiếp theo)
    const nextStage = stages.find(s => s.status === StageStatus.PENDING);
    if (nextStage) return nextStage.id;

    return undefined;
};

// --- EXPORTED SERVICES ---

export const getRoadmapTemplates = (): RoadmapTemplate[] => {
    const stored = localStorage.getItem(STORAGE_KEYS.TEMPLATES);
    const customTemplates = stored ? JSON.parse(stored) : [];
    return [...DEFAULT_TEMPLATES, ...customTemplates];
};

export const saveRoadmapTemplate = (template: RoadmapTemplate) => {
    const stored = localStorage.getItem(STORAGE_KEYS.TEMPLATES);
    const customTemplates = stored ? JSON.parse(stored) : [];
    localStorage.setItem(STORAGE_KEYS.TEMPLATES, JSON.stringify([template, ...customTemplates]));
};

export const getProjectRoadmap = async (projectId: string): Promise<ProjectRoadmap | null> => {
    // Simulate Network Delay
    await new Promise(r => setTimeout(r, 200));
    const maps = getLocalRoadmaps();
    return maps.find(m => m.projectId === projectId) || null;
};

export const createRoadmapFromTemplate = async (projectId: string, templateId: string): Promise<ProjectRoadmap> => {
    const templates = getRoadmapTemplates();
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

    const maps = getLocalRoadmaps();
    // Replace if exists, else add
    const filtered = maps.filter(m => m.projectId !== projectId);
    saveLocalRoadmaps([...filtered, newRoadmap]);
    return newRoadmap;
};

// --- NEW HELPERS FOR ROADMAP MANAGEMENT ---

export const saveProjectRoadmap = async (roadmap: ProjectRoadmap): Promise<void> => {
    const maps = getLocalRoadmaps();
    const index = maps.findIndex(m => m.id === roadmap.id);
    if (index >= 0) {
        maps[index] = roadmap;
    } else {
        maps.push(roadmap);
    }
    saveLocalRoadmaps(maps);
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
 * CORE FUNCTION: Thêm Nhật ký (Log) & Tự động cập nhật Trạng thái (Stage)
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
    const maps = getLocalRoadmaps();
    const mapIndex = maps.findIndex(m => m.projectId === projectId);
    if (mapIndex === -1) throw new Error("Roadmap not found. Please create one first.");

    const map = maps[mapIndex];

    // 1. Determine Stage (Manual or Auto-AI)
    const targetStageId = manualStageId || autoMapLogToStage(content, map.stages);

    // 2. Create Log Object
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
        status: 'APPROVED' // Auto-approve for now
    };

    // 3. Append Log (Newest first)
    map.logs = [newLog, ...map.logs];
    map.lastUpdated = new Date().toISOString();

    // 4. INFER STAGE STATUS (Logic suy diễn trạng thái)
    if (targetStageId) {
        const stageIndex = map.stages.findIndex(s => s.id === targetStageId);
        if (stageIndex >= 0) {
            const currentStatus = map.stages[stageIndex].status;
            
            // Rule 1: Có Log -> Chuyển sang IN_PROGRESS (nếu đang Pending)
            if (currentStatus === StageStatus.PENDING) {
                map.stages[stageIndex].status = StageStatus.IN_PROGRESS;
                // Auto-start date
                if (!map.stages[stageIndex].startDate) {
                    map.stages[stageIndex].startDate = new Date().toISOString();
                }
            }

            // Rule 2: Log là Nghiệm thu (ACCEPTANCE) -> Chuyển sang COMPLETED
            if (logType === LogType.ACCEPTANCE) {
                map.stages[stageIndex].status = StageStatus.COMPLETED;
                map.stages[stageIndex].endDate = new Date().toISOString();
            }

            // Rule 3: Log là Sự cố (ISSUE) -> Chuyển sang BLOCKED
            if (logType === LogType.ISSUE_REPORT) {
                map.stages[stageIndex].status = StageStatus.BLOCKED;
            }
        }
    }

    // 5. Recalculate Overall Progress
    const totalWeight = map.stages.reduce((sum, s) => sum + (s.weightPercent || 0), 0);
    const completedWeight = map.stages
        .filter(s => s.status === StageStatus.COMPLETED)
        .reduce((sum, s) => sum + (s.weightPercent || 0), 0);
    
    // Weighted progress + partial progress for IN_PROGRESS items (assumed 50%)
    const inProgressWeight = map.stages
        .filter(s => s.status === StageStatus.IN_PROGRESS)
        .reduce((sum, s) => sum + ((s.weightPercent || 0) * 0.5), 0);

    map.overallProgress = totalWeight > 0 ? Math.round(((completedWeight + inProgressWeight) / totalWeight) * 100) : 0;

    // Save
    maps[mapIndex] = map;
    saveLocalRoadmaps(maps);
    return map;
};

// --- REPORT HELPERS ---

export const groupLogsByDate = (logs: RoadmapLog[]) => {
    const groups: Record<string, RoadmapLog[]> = {};
    logs.forEach(log => {
        // Parse ISO string safely
        const date = log.timestamp.split('T')[0]; 
        if (!groups[date]) groups[date] = [];
        groups[date].push(log);
    });
    // Sort descending by date (Newest days first)
    return Object.entries(groups).sort((a,b) => b[0].localeCompare(a[0]));
};

// --- ACCESS LINKS ---

export const generateAccessLink = async (projectId: string, role: 'CUSTOMER' | 'WORKER', label?: string): Promise<string> => {
    // In real app, create a JWT or UUID token in DB
    const token = `access_${role.toLowerCase()}_${projectId.slice(-4)}_${Math.random().toString(36).substr(2,8)}`;
    
    const maps = getLocalRoadmaps();
    const mapIndex = maps.findIndex(m => m.projectId === projectId);
    
    if (mapIndex >= 0) {
        const linkObj: RoadmapAccessLink = {
            token,
            projectId,
            role,
            label: label || (role === 'CUSTOMER' ? 'Khách mời' : 'Tổ đội'),
            createdAt: new Date().toISOString(),
            expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days
            isActive: true
        };
        
        const map = maps[mapIndex];
        map.accessLinks = [...(map.accessLinks || []), linkObj];
        saveLocalRoadmaps(maps);
    }

    const baseUrl = window.location.origin;
    // URL Format: /?token=...&mode=roadmap
    return `${baseUrl}/?token=${token}&mode=roadmap`;
};
