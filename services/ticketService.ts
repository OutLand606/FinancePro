import { Ticket, TicketComment, TicketStatus, UserContext, Attachment, TicketType, TicketStats, ManualReminder, EmployeeEvaluation, TicketLog } from '../types';
import { api } from './api'; // Giả định bạn đã có file api wrapper như ví dụ
import { sendBrowserNotification } from './notificationService';

// --- CONFIGURATION ---
const COLLECTION_TICKETS = 'tickets';
const COLLECTION_REMINDERS = 'ticket_reminders';

// --- CONSTANTS (Giữ nguyên) ---
export const APPROVAL_TYPES: TicketType[] = ['REQUEST_LEAVE', 'REQUEST_PURCHASE', 'REQUEST_PAYMENT', 'SUGGESTION'];
export const TASK_TYPES: TicketType[] = ['REQUEST_BOQ', 'REQUEST_DOCS', 'REQUEST_IT', 'OTHER'];

export const TICKET_TEMPLATES: Record<string, string> = {
    'REQUEST_PURCHASE': "1. Tên vật tư/thiết bị cần mua:\n2. Số lượng:\n3. Mục đích sử dụng:\n4. Ngày cần có hàng:\n5. Nhà cung cấp đề xuất (nếu có):",
    'REQUEST_PAYMENT': "1. Nội dung thanh toán:\n2. Số tiền:\n3. Số hóa đơn/Hợp đồng (nếu có):\n4. Thông tin người nhận (Tên, STK):",
    'REQUEST_BOQ': "1. Tên dự án:\n2. Link bản vẽ (Drive):\n3. Hạng mục cần bóc tách:\n4. Ghi chú đặc biệt:",
    'REQUEST_LEAVE': "1. Loại nghỉ (Phép năm/Ốm/Không lương):\n2. Từ ngày - Đến ngày:\n3. Người bàn giao công việc:\n4. Lý do:",
    'REQUEST_IT': "1. Mô tả sự cố/Yêu cầu:\n2. Thiết bị gặp lỗi (Mã tài sản):\n3. Mức độ ảnh hưởng công việc:",
    'OTHER': "Mô tả chi tiết yêu cầu..."
};

// --- HELPER: WORK TIME CALCULATION (Giữ nguyên logic) ---
const WORK_START_HOUR = 8;
const WORK_END_HOUR = 17.5; 

const isWorkingDay = (date: Date): boolean => {
    const day = date.getDay();
    return day !== 0; 
};

const calculateWorkingTime = (startStr: string, endStr: string): number => {
    let start = new Date(startStr);
    let end = new Date(endStr);
    if (start > end) return 0;
    let totalHours = 0;
    let current = new Date(start);
    current.setSeconds(0, 0);

    while (current < end) {
        if (!isWorkingDay(current)) {
            current.setDate(current.getDate() + 1);
            current.setHours(WORK_START_HOUR, 0, 0, 0);
            continue;
        }
        const workStart = new Date(current);
        workStart.setHours(WORK_START_HOUR, 0, 0, 0);
        const workEnd = new Date(current);
        workEnd.setHours(Math.floor(WORK_END_HOUR), (WORK_END_HOUR % 1) * 60, 0, 0);

        const overlapStart = current > workStart ? current : workStart;
        let segmentEnd = workEnd;
        if (end < workEnd && end.getDate() === current.getDate()) {
            segmentEnd = end;
        }

        if (overlapStart < segmentEnd) {
            totalHours += (segmentEnd.getTime() - overlapStart.getTime()) / (1000 * 60 * 60);
        }
        current.setDate(current.getDate() + 1);
        current.setHours(WORK_START_HOUR, 0, 0, 0);
    }
    return totalHours;
};

export interface AdvancedEmployeeEvaluation extends EmployeeEvaluation {
    avgCalendarDays: number;
    avgWorkingHours: number;
}

// --- AUDIT HELPER ---
const createAuditLog = (action: TicketLog['action'], user: UserContext, details: string, oldVal?: string, newVal?: string): TicketLog => {
    return {
        id: `log_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
        action,
        actorId: user.id,
        actorName: user.name,
        timestamp: new Date().toISOString(),
        details,
        oldValue: oldVal,
        newValue: newVal
    };
};

export const generateTicketCode = (): string => {
    const date = new Date();
    const yymm = `${date.getFullYear().toString().slice(-2)}${(date.getMonth() + 1).toString().padStart(2, '0')}`;
    const random = Math.floor(Math.random() * 9000) + 1000;
    return `TK-${yymm}-${random}`;
};

const calculateSLADeadline = (priority: string): string => {
    const now = new Date();
    let hoursToAdd = 48; 
    if (priority === 'URGENT') hoursToAdd = 4;
    else if (priority === 'HIGH') hoursToAdd = 24;
    else if (priority === 'LOW') hoursToAdd = 72;
    now.setHours(now.getHours() + hoursToAdd);
    return now.toISOString();
}

// ==========================================
// API INTERACTIONS (Backend Sync)
// ==========================================

export const fetchTickets = async (): Promise<Ticket[]> => {
    try {
        const res = await api.get<Ticket[]>(`/${COLLECTION_TICKETS}`);
        const tickets = res.success ? res.data : [];
        
        // Post-processing: Check Overdue
        const now = new Date();
        return tickets.map(t => {
            if (t.status !== 'COMPLETED' && t.status !== 'CANCELLED' && t.slaDeadline) {
                 const deadline = new Date(t.slaDeadline);
                 if (now > deadline) t.isOverdue = true;
            }
            return t;
        }).sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    } catch (error) {
        console.error("Fetch Tickets Error:", error);
        return [];
    }
};

// Lấy 1 ticket mới nhất từ server để đảm bảo dữ liệu không bị conflict khi update
const fetchTicketById = async (id: string): Promise<Ticket> => {
    const res = await api.get<Ticket>(`/${COLLECTION_TICKETS}/${id}`);
    if (!res.success || !res.data) throw new Error("Ticket not found on server");
    return res.data;
};

export const createTicket = async (ticket: Ticket): Promise<Ticket> => {
    const slaDeadline = calculateSLADeadline(ticket.priority);
    let description = ticket.description;
    if (!description && TICKET_TEMPLATES[ticket.type]) {
        description = TICKET_TEMPLATES[ticket.type];
    }
    
    const newTicket: Ticket = { 
        ...ticket, 
        description,
        id: ticket.id || `tic_${Date.now()}`, 
        createdAt: new Date().toISOString(), 
        updatedAt: new Date().toISOString(),
        lastActivityAt: new Date().toISOString(),
        slaDeadline: slaDeadline,
        assigneeIds: ticket.assigneeIds || [],
        followerIds: ticket.followerIds || [],
        comments: [],
        history: [{
            id: `log_init_${Date.now()}`,
            action: 'CREATE',
            actorId: ticket.creatorId,
            actorName: ticket.creatorName,
            timestamp: new Date().toISOString(),
            details: 'Tạo mới yêu cầu'
        }],
        reminderHistory: []
    };

    await api.post(`/${COLLECTION_TICKETS}`, newTicket);
    
    // Notify (Optional: call another API or keep browser notification)
    sendBrowserNotification("FinancePro: Có yêu cầu mới", `[${newTicket.code}] ${newTicket.title} - ${newTicket.creatorName}`);
    
    return newTicket;
};

export const updateTicket = async (ticket: Ticket): Promise<void> => {
    const updated = { 
        ...ticket, 
        updatedAt: new Date().toISOString(),
        lastActivityAt: new Date().toISOString()
    };
    await api.put(`/${COLLECTION_TICKETS}/${ticket.id}`, updated);
};

export const updateTicketStatus = async (ticketId: string, status: TicketStatus, user: UserContext, rating?: number, ratingComment?: string): Promise<void> => {
    // 1. Fetch fresh data
    const ticket = await fetchTicketById(ticketId);

    // 2. Permission Check
    if (ticket.status === 'NEW' && status === 'IN_PROGRESS' && APPROVAL_TYPES.includes(ticket.type)) {
        if (!checkTicketPermission(ticket, user, 'APPROVE')) throw new Error("Bạn không có quyền Phê duyệt yêu cầu này.");
    } else {
        if (!checkTicketPermission(ticket, user, status === 'COMPLETED' || status === 'CANCELLED' ? 'CLOSE' : 'EDIT')) {
            throw new Error("Bạn không có quyền thực hiện thao tác này.");
        }
    }

    // 3. Update Logic
    const oldStatus = ticket.status;
    ticket.status = status;
    ticket.updatedAt = new Date().toISOString();
    ticket.lastActivityAt = new Date().toISOString();
    
    if (status === 'IN_PROGRESS' && !ticket.startedAt) {
        ticket.startedAt = new Date().toISOString();
        if (oldStatus === 'NEW' && APPROVAL_TYPES.includes(ticket.type)) {
             ticket.approvedBy = user.name;
             ticket.approvedAt = new Date().toISOString();
        }
    }
    
    if (status === 'COMPLETED' || status === 'CANCELLED') {
        ticket.closedAt = new Date().toISOString();
        if (rating) ticket.rating = rating;
        if (ratingComment) ticket.ratingComment = ratingComment;
    } else {
        ticket.closedAt = undefined;
    }

    // 4. Logs & Comments
    let logAction: TicketLog['action'] = 'UPDATE_STATUS';
    if (status === 'COMPLETED') logAction = 'APPROVED'; // Reuse APPROVED/REJECTED for simplicity or define new ones
    if (status === 'IN_PROGRESS' && oldStatus === 'WAITING_REVIEW') logAction = 'REJECTED'; 
    if (oldStatus === 'NEW' && status === 'IN_PROGRESS' && APPROVAL_TYPES.includes(ticket.type)) logAction = 'APPROVED';

    const log = createAuditLog(logAction, user, `Thay đổi trạng thái`, oldStatus, status);
    ticket.history = [log, ...(ticket.history || [])];

    let msg = `Đã đổi trạng thái từ ${oldStatus} sang ${status}`;
    if (status === 'WAITING_REVIEW') msg = `Đã báo cáo hoàn thành. Chờ kiểm tra.`;
    if (status === 'COMPLETED') msg = `Đã Duyệt (Đạt). Đóng phiếu.`;
    if (status === 'IN_PROGRESS' && oldStatus === 'WAITING_REVIEW') msg = `Đã Từ Chối (Không đạt). Yêu cầu làm lại.`;
    if (APPROVAL_TYPES.includes(ticket.type)) {
        if (oldStatus === 'NEW' && status === 'IN_PROGRESS') msg = `✅ Đã PHÊ DUYỆT yêu cầu. Chuyển sang thực hiện.`;
        if (oldStatus === 'NEW' && status === 'CANCELLED') msg = `❌ Đã TỪ CHỐI phê duyệt.`;
    }

    ticket.comments.push({
        id: `cm_sys_${Date.now()}`,
        ticketId,
        userId: 'system',
        userName: 'Hệ thống',
        content: msg,
        attachments: [],
        createdAt: new Date().toISOString(),
        isSystemLog: true
    });

    // 5. Save to Backend
    await api.put(`/${COLLECTION_TICKETS}/${ticketId}`, ticket);
};

export const addTicketComment = async (ticketId: string, content: string, user: UserContext, attachments: Attachment[] = []): Promise<void> => {
    // 1. Fetch fresh data to avoid overwriting other comments
    const ticket = await fetchTicketById(ticketId);

    if (!ticket.firstResponseAt && user.id !== ticket.creatorId) {
        ticket.firstResponseAt = new Date().toISOString();
    }
    
    const comment: TicketComment = {
        id: `cm_${Date.now()}`,
        ticketId,
        userId: user.id,
        userName: user.name,
        userAvatar: user.avatarUrl,
        content,
        attachments,
        createdAt: new Date().toISOString()
    };

    ticket.comments.push(comment);
    ticket.updatedAt = new Date().toISOString();
    ticket.lastActivityAt = new Date().toISOString();

    // 2. Save
    await api.put(`/${COLLECTION_TICKETS}/${ticketId}`, ticket);
};

export const sendTicketReminder = async (ticketId: string, sender: UserContext): Promise<void> => {
    const ticket = await fetchTicketById(ticketId);
    
    const now = new Date().toISOString();
    ticket.reminderHistory = [...(ticket.reminderHistory || []), now];
    
    const comment: TicketComment = {
        id: `cm_remind_${Date.now()}`,
        ticketId: ticket.id,
        userId: 'system',
        userName: 'Hệ thống',
        content: `🔔 Sếp ${sender.name} đã gửi nhắc nhở lần ${ticket.reminderHistory.length}. Vui lòng cập nhật tiến độ!`,
        attachments: [],
        createdAt: now,
        isSystemLog: true
    };
    ticket.comments.push(comment);
    
    if(ticket.history) {
        ticket.history.unshift({
            id: `log_remind_${Date.now()}`,
            action: 'AUTO_REMINDER',
            actorId: sender.id,
            actorName: sender.name,
            timestamp: now,
            details: `Gửi nhắc nhở thủ công lần ${ticket.reminderHistory.length}`
        });
    }
    
    await api.put(`/${COLLECTION_TICKETS}/${ticketId}`, ticket);
};

// --- REMINDER API (MANUAL) ---

export const getManualReminders = async (): Promise<ManualReminder[]> => {
    try {
        const res = await api.get<ManualReminder[]>(`/${COLLECTION_REMINDERS}`);
        return res.success ? res.data : [];
    } catch (e) { return []; }
};

export const saveManualReminder = async (reminder: ManualReminder): Promise<void> => {
    // Backend generic support PUT/POST. Here we assume generic Upsert logic on POST or specialized logic
    // Since backend generic code supports array bulk insert or single insert.
    // For simplicity with generic backend: we fetch all, modify array, save? 
    // NO, better to use standard CRUD per item.
    
    // Create new
    await api.post(`/${COLLECTION_REMINDERS}`, reminder);
};

export const toggleReminderStatus = async (id: string): Promise<void> => {
    const res = await api.get<ManualReminder>(`/${COLLECTION_REMINDERS}/${id}`);
    if(res.success && res.data) {
        const updated = { ...res.data, isDone: !res.data.isDone };
        await api.put(`/${COLLECTION_REMINDERS}/${id}`, updated);
    }
};

export const deleteReminder = async (id: string): Promise<void> => {
    await api.delete(`/${COLLECTION_REMINDERS}/${id}`);
};

// --- ANALYTICS & AUTOMATION ---

export const getTicketStats = async (userId: string): Promise<TicketStats> => {
    // This fetches all tickets to calculate stats. 
    // In a real large app, this should be a backend aggregation endpoint.
    // For now, we reuse the fetchTickets logic.
    const tickets = await fetchTickets();
    const now = new Date();
    
    const myTickets = tickets.filter(t => t.assigneeIds?.includes(userId));
    const pendingGlobal = tickets.filter(t => t.status !== 'COMPLETED' && t.status !== 'CANCELLED');
    const myPending = myTickets.filter(t => t.status !== 'COMPLETED' && t.status !== 'CANCELLED');
    const urgent = pendingGlobal.filter(t => t.priority === 'URGENT' || t.priority === 'HIGH');
    const overdueCount = pendingGlobal.filter(t => t.slaDeadline && new Date(t.slaDeadline) < now).length;
    
    const deptMap: Record<string, number> = {};
    pendingGlobal.forEach(t => {
        const d = t.departmentCode || 'OTHER';
        deptMap[d] = (deptMap[d] || 0) + 1;
    });
    const byDept = Object.entries(deptMap).map(([name, value]) => ({ name, value }));
    
    const projMap: Record<string, number> = {};
    pendingGlobal.forEach(t => {
        const p = t.projectName || 'Chung';
        projMap[p] = (projMap[p] || 0) + 1;
    });
    const byProject = Object.entries(projMap).sort((a,b) => b[1] - a[1]).slice(0, 5).map(([name, value]) => ({ name, value }));
    
    const closedTickets = tickets.filter(t => t.status === 'COMPLETED' && t.closedAt);
    let totalHours = 0;
    closedTickets.forEach(t => {
        const diff = new Date(t.closedAt!).getTime() - new Date(t.createdAt).getTime();
        totalHours += diff / (1000 * 3600);
    });
    const avgResolutionHours = closedTickets.length > 0 ? totalHours / closedTickets.length : 0;
    
    const completedWithRating = tickets.filter(t => t.status === 'COMPLETED' && t.rating);
    const avgRating = completedWithRating.length > 0 
        ? completedWithRating.reduce((s,t) => s + (t.rating || 0), 0) / completedWithRating.length 
        : 5;

    let insight = "Hệ thống vận hành ổn định.";
    if (overdueCount > 5) insight = `Báo động: Có ${overdueCount} vé quá hạn SLA! Cần xử lý ngay.`;
    else if (urgent.length > 0) insight = `Có ${urgent.length} yêu cầu gấp đang chờ xử lý!`;
    else if (avgRating < 4) insight = "Lưu ý: Mức độ hài lòng đang giảm nhẹ.";

    const userActivity: Record<string, number> = {};
    tickets.forEach(t => {
        userActivity[t.creatorName] = (userActivity[t.creatorName] || 0) + 1;
    });
    const lazyEmployees = Object.entries(userActivity).sort((a,b) => a[1] - b[1]).slice(0, 5).map(([name, count]) => ({ name, count }));

    return {
        total: tickets.length,
        pending: pendingGlobal.length,
        urgent: urgent.length,
        completedThisMonth: tickets.filter(t => t.status === 'COMPLETED' && t.closedAt && t.closedAt.startsWith(new Date().toISOString().slice(0,7))).length,
        avgSatisfaction: avgRating,
        myPendingCount: myPending.length,
        aiInsight: insight,
        byDept,
        byProject,
        slaStatus: { onTime: pendingGlobal.length - overdueCount, overdue: overdueCount },
        avgResolutionHours,
        lazyEmployees,
        workloadByDept: byDept 
    };
};

export const getEmployeeEvaluations = async (): Promise<AdvancedEmployeeEvaluation[]> => {
    const tickets = await fetchTickets();
    const completed = tickets.filter(t => t.status === 'COMPLETED' && t.closedAt && t.assigneeIds.length > 0);
    const active = tickets.filter(t => (t.status === 'IN_PROGRESS' || t.status === 'NEW' || t.status === 'WAITING' || t.status === 'WAITING_REVIEW') && t.assigneeIds.length > 0);
    const now = new Date();
    
    const stats: Record<string, { 
        count: number, 
        totalHours: number, 
        totalWorkingHours: number,
        totalDays: number,
        totalRating: number, 
        ratingCount: number, 
        activeCount: number, 
        overdueCount: number 
    }> = {};

    active.forEach(t => {
        const isOverdue = t.slaDeadline && new Date(t.slaDeadline) < now;
        t.assigneeIds.forEach(empId => {
            if (!stats[empId]) stats[empId] = { count: 0, totalHours: 0, totalWorkingHours: 0, totalDays: 0, totalRating: 0, ratingCount: 0, activeCount: 0, overdueCount: 0 };
            stats[empId].activeCount++;
            if(isOverdue) stats[empId].overdueCount++;
        });
    });

    completed.forEach(t => {
        const start = t.startedAt ? new Date(t.startedAt) : new Date(t.createdAt);
        const end = new Date(t.closedAt!);
        
        const durationMs = end.getTime() - start.getTime();
        const hours = durationMs / (1000 * 60 * 60);
        const days = durationMs / (1000 * 60 * 60 * 24);
        const workingHours = calculateWorkingTime(start.toISOString(), t.closedAt!);

        t.assigneeIds.forEach(empId => {
            if (!stats[empId]) stats[empId] = { count: 0, totalHours: 0, totalWorkingHours: 0, totalDays: 0, totalRating: 0, ratingCount: 0, activeCount: 0, overdueCount: 0 };
            stats[empId].count++;
            stats[empId].totalHours += hours;
            stats[empId].totalDays += days;
            stats[empId].totalWorkingHours += workingHours;
            
            if (t.rating) {
                stats[empId].totalRating += t.rating;
                stats[empId].ratingCount++;
            }
        });
    });

    return Object.entries(stats).map(([empId, data]) => ({
        empId,
        totalResolved: data.count,
        activeTasks: data.activeCount,
        overdueCount: data.overdueCount,
        avgResolutionHours: data.count > 0 ? data.totalHours / data.count : 0,
        avgRating: data.ratingCount > 0 ? data.totalRating / data.ratingCount : 0,
        avgCalendarDays: data.count > 0 ? data.totalDays / data.count : 0,
        avgWorkingHours: data.count > 0 ? data.totalWorkingHours / data.count : 0
    }));
};
////

// --- THÊM CONSTANTS & HELPER ---
const COLLECTION_SYS_JOBS = 'sys_jobs';
const KEY_JOB_AUTOMATION = 'ticket_automation_run';
const KEY_JOB_RECURRING = 'ticket_recurring_gen';

const getSystemJobStatus = async (jobId: string): Promise<string | null> => {
    try {
        const res = await api.get<{value: string}>(`/${COLLECTION_SYS_JOBS}/${jobId}`);
        return res.success && res.data ? res.data.value : null;
    } catch (e) { return null; }
};

const saveSystemJobStatus = async (jobId: string, value: string): Promise<void> => {
    await api.put(`/${COLLECTION_SYS_JOBS}/${jobId}`, { 
        id: jobId, 
        value: value, 
        updatedAt: new Date().toISOString() 
    });
};

// --- 1. RUN AUTOMATION ---
export const runTicketAutomation = async () => {
    // Lấy thời gian chạy lần cuối từ Server
    const lastRun = await getSystemJobStatus(KEY_JOB_AUTOMATION);
    const now = Date.now();

    // Check 1 giờ (3600000ms)
    if (lastRun && (now - parseInt(lastRun)) < 3600000) return; 

    const tickets = await fetchTickets();
    const activeTickets = tickets.filter(t => t.status !== 'COMPLETED' && t.status !== 'CANCELLED');
    
    for (const t of activeTickets) {
        let updated = false;
        const lastAct = new Date(t.lastActivityAt || t.createdAt).getTime();
        const diffHours = (now - lastAct) / (1000 * 3600);
        
        // Rule 1: Warning inactive (> 48h)
        if (diffHours > 48 && !t.comments.some(c => c.content.includes("Cảnh báo: Ticket không có hoạt động") && new Date(c.createdAt).getTime() > lastAct)) {
            t.comments.push({
                id: `auto_stag_${Date.now()}`,
                ticketId: t.id,
                userId: 'system',
                userName: 'Hệ thống (Auto)',
                content: `⚠️ Cảnh báo: Ticket không có hoạt động trong 48h qua. Vui lòng cập nhật tiến độ.`,
                attachments: [],
                createdAt: new Date().toISOString(),
                isSystemLog: true
            });
            updated = true;
        }

        // Rule 2: SLA Warning (< 4h)
        if (t.slaDeadline) {
            const deadline = new Date(t.slaDeadline).getTime();
            const hoursLeft = (deadline - now) / (1000 * 3600);
            if (hoursLeft > 0 && hoursLeft < 4 && !t.comments.some(c => c.content.includes("Sắp hết hạn SLA"))) {
                 t.comments.push({
                    id: `auto_sla_${Date.now()}`,
                    ticketId: t.id,
                    userId: 'system',
                    userName: 'Hệ thống (Auto)',
                    content: `⏰ Nhắc nhở: Sắp hết hạn SLA (còn < ${hoursLeft.toFixed(1)}h). Ưu tiên xử lý ngay!`,
                    attachments: [],
                    createdAt: new Date().toISOString(),
                    isSystemLog: true
                });
                updated = true;
            }
        }

        if (updated) {
            await updateTicket(t); // Gọi API update
        }
    }
    
    // Lưu lại thời gian chạy lên Server
    await saveSystemJobStatus(KEY_JOB_AUTOMATION, now.toString());
};

// --- PERMISSION HELPER (Client-Side Check) ---
export const checkTicketPermission = (ticket: Ticket, user: UserContext, action: 'VIEW' | 'EDIT' | 'CLOSE' | 'ASSIGN' | 'APPROVE'): boolean => {
    const isAdmin = user.permissions.includes('SYS_ADMIN');
    if (action === 'VIEW') {
        if (isAdmin) return true;
        if (ticket.creatorId === user.id) return true;
        if (ticket.assigneeIds.includes(user.id)) return true;
        if (ticket.followerIds.includes(user.id)) return true;
        if (ticket.approverId === user.id) return true; 
        if (ticket.departmentCode === user.department) return true; 
        return false;
    }
    if (action === 'EDIT' || action === 'CLOSE') {
        if (isAdmin) return true;
        if (ticket.creatorId === user.id) return true;
        if (ticket.assigneeIds.includes(user.id)) return true;
        return false;
    }
    if (action === 'ASSIGN') {
        if (isAdmin) return true;
        if (ticket.departmentCode === user.department && user.roleId.includes('MANAGER')) return true;
        return false;
    }
    if (action === 'APPROVE') {
        if (isAdmin) return true;
        if (ticket.approverId === user.id) return true;
        if (!ticket.approverId && ticket.departmentCode === user.department && user.roleId.includes('MANAGER')) return true;
        if (ticket.assigneeIds.includes(user.id)) return true;
        return false;
    }
    return false;
};

export const getElapsedTime = (ticket: Ticket): string => {
    if (!ticket.createdAt) return '0h';
    const start = new Date(ticket.createdAt).getTime();
    const end = ticket.closedAt ? new Date(ticket.closedAt).getTime() : Date.now();
    const diffMs = end - start;
    const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    if (days > 0) return `${days}d ${hours}h`;
    return `${hours}h`;
};

// --- Thêm vào cuối file ticketService.ts ---

export const getRecurringSuggestions = async (input: string): Promise<string[]> => {
    const common = [
        "Đề nghị thanh toán tiền điện",
        "Đề nghị thanh toán tiền nước",
        "Mua văn phòng phẩm tháng này",
        "Sửa chữa máy in",
        "Tạm ứng công tác phí",
        "Thanh toán cước Internet",
        "Đề xuất mua trang thiết bị bảo hộ",
        "Báo cáo chi phí công tác"
    ];

    if (!input) return common.slice(0, 3);
    
    return common.filter(c => 
        c.toLowerCase().includes(input.toLowerCase())
    );
};

// --- CONFIGURATION COLLECTIONS ---
const COLLECTION_TICKET_TYPES = 'sys_ticket_types';
const COLLECTION_DEPARTMENTS = 'sys_departments';

// --- DATA MẶC ĐỊNH (Bạn cung cấp) ---
const DEFAULT_DEPARTMENTS_DATA = [
    { code: 'SALES', label: 'Kinh doanh (Sales)' },
    { code: 'TECH', label: 'Kỹ thuật / Dự án' },
    { code: 'PURCHASE', label: 'Mua hàng / Cung ứng' },
    { code: 'ACC', label: 'Kế toán - Tài chính' },
    { code: 'HR', label: 'Hành chính - Nhân sự' },
    { code: 'BOD', label: 'Ban Giám đốc' }
];

const DEFAULT_TICKET_TYPES_DATA = [
    // APPROVAL
    { code: 'REQUEST_PAYMENT', label: 'Đề nghị Thanh toán', category: 'APPROVAL', sla: 48 },
    { code: 'REQUEST_PURCHASE_APP', label: 'Phê duyệt Mua sắm (Tài sản/Thiết bị)', category: 'APPROVAL', sla: 24 },
    { code: 'REQUEST_LEAVE', label: 'Xin nghỉ phép / Công tác', category: 'APPROVAL', sla: 8 },
    { code: 'SUGGESTION', label: 'Đề xuất / Góp ý', category: 'APPROVAL', sla: 0 },
    // TASK
    { code: 'TASK_SUPPLY', label: 'Cung ứng vật tư (Giao kho)', category: 'TASK', sla: 24 },
    { code: 'REQUEST_BOQ', label: 'Bóc tách khối lượng / Báo giá', category: 'TASK', sla: 72 },
    { code: 'REQUEST_DOCS', label: 'Soạn thảo Hồ sơ / Hợp đồng', category: 'TASK', sla: 24 },
    { code: 'REQUEST_IT', label: 'Hỗ trợ IT / Sửa chữa', category: 'TASK', sla: 4 },
    { code: 'OTHER', label: 'Giao việc khác', category: 'TASK', sla: 48 }
];

// --- 1. HÀM KHỞI TẠO (SEED DATA) ---
export const initializeTicketConfigs = async () => {
    // Kiểm tra xem đã có Department chưa
    const depts = await api.get<any[]>(`/${COLLECTION_DEPARTMENTS}`);
    if (depts.success && depts.data.length === 0) {
        console.log("Initializing Departments...");
        // Bulk insert departments
        for (const d of DEFAULT_DEPARTMENTS_DATA) {
            await api.post(`/${COLLECTION_DEPARTMENTS}`, { ...d, id: `dept_${d.code}` });
        }
    }

    // Kiểm tra xem đã có Ticket Types chưa
    const types = await api.get<any[]>(`/${COLLECTION_TICKET_TYPES}`);
    if (types.success && types.data.length === 0) {
        console.log("Initializing Ticket Types...");
        // Bulk insert types
        for (const t of DEFAULT_TICKET_TYPES_DATA) {
            await api.post(`/${COLLECTION_TICKET_TYPES}`, { ...t, id: `type_${t.code}` });
        }
    }
};

// --- 2. API CHO DEPARTMENTS ---
export const fetchDepartments = async () => {
    const res = await api.get<any[]>(`/${COLLECTION_DEPARTMENTS}`);
    return res.success ? res.data : [];
};

export const saveDepartment = async (dept: {code: string, label: string}) => {
    const id = `dept_${dept.code}`;
    await api.put(`/${COLLECTION_DEPARTMENTS}/${id}`, { ...dept, id });
};

export const deleteDepartment = async (id: string) => {
    await api.delete(`/${COLLECTION_DEPARTMENTS}/${id}`);
};

// --- 3. API CHO TICKET TYPES ---
export const fetchTicketTypesConfig = async () => {
    const res = await api.get<any[]>(`/${COLLECTION_TICKET_TYPES}`);
    return res.success ? res.data : [];
};

export const saveTicketTypeConfig = async (type: {code: string, label: string, category: string, sla: number, defaultApproverId?: string}) => {
    const id = `type_${type.code}`;
    await api.put(`/${COLLECTION_TICKET_TYPES}/${id}`, { ...type, id });
};

export const deleteTicketTypeConfig = async (id: string) => {
    await api.delete(`/${COLLECTION_TICKET_TYPES}/${id}`);
};