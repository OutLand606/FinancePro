
import { Ticket, TicketComment, TicketStatus, UserContext, Attachment, TicketType, TicketStats, ManualReminder, EmployeeEvaluation, TicketLog } from '../types';
import { INITIAL_TICKETS } from '../constants';
import { api } from './api';
import { sendBrowserNotification } from './notificationService';

const STORAGE_KEYS = {
    TICKETS: 'finance_tickets_v1',
    TICKET_CONFIGS: 'finance_ticket_configs',
    REMINDERS: 'finance_ticket_reminders',
    LAST_AUTO_GEN: 'finance_ticket_last_autogen',
    LAST_AUTOMATION_RUN: 'finance_ticket_last_automation_run'
};

// --- CONFIG: DEFINE APPROVAL vs TASK TYPES ---
export const APPROVAL_TYPES: TicketType[] = ['REQUEST_LEAVE', 'REQUEST_PURCHASE', 'REQUEST_PAYMENT', 'SUGGESTION'];
export const TASK_TYPES: TicketType[] = ['REQUEST_BOQ', 'REQUEST_DOCS', 'REQUEST_IT', 'OTHER'];

// --- PRE-DEFINED TEMPLATES ---
export const TICKET_TEMPLATES: Record<string, string> = {
    'REQUEST_PURCHASE': "1. Tên vật tư/thiết bị cần mua:\n2. Số lượng:\n3. Mục đích sử dụng:\n4. Ngày cần có hàng:\n5. Nhà cung cấp đề xuất (nếu có):",
    'REQUEST_PAYMENT': "1. Nội dung thanh toán:\n2. Số tiền:\n3. Số hóa đơn/Hợp đồng (nếu có):\n4. Thông tin người nhận (Tên, STK):",
    'REQUEST_BOQ': "1. Tên dự án:\n2. Link bản vẽ (Drive):\n3. Hạng mục cần bóc tách:\n4. Ghi chú đặc biệt:",
    'REQUEST_LEAVE': "1. Loại nghỉ (Phép năm/Ốm/Không lương):\n2. Từ ngày - Đến ngày:\n3. Người bàn giao công việc:\n4. Lý do:",
    'REQUEST_IT': "1. Mô tả sự cố/Yêu cầu:\n2. Thiết bị gặp lỗi (Mã tài sản):\n3. Mức độ ảnh hưởng công việc:",
    'OTHER': "Mô tả chi tiết yêu cầu..."
};

// --- WORK TIME CALCULATION LOGIC ---
const WORK_START_HOUR = 8;
const WORK_END_HOUR = 17.5; // 17:30
const WORK_HOURS_PER_DAY = WORK_END_HOUR - WORK_START_HOUR; // 9.5 hours

const isWorkingDay = (date: Date): boolean => {
    const day = date.getDay();
    return day !== 0; // 0 is Sunday. 1-6 is Mon-Sat.
};

const calculateWorkingTime = (startStr: string, endStr: string): number => {
    let start = new Date(startStr);
    let end = new Date(endStr);
    
    if (start > end) return 0;

    let totalHours = 0;
    
    // Normalize start/end to be within next working block if outside
    // This is a simplified simulation. For exact precision, we iterate days.
    
    let current = new Date(start);
    // Reset seconds/ms for cleaner calculation loop
    current.setSeconds(0, 0);

    while (current < end) {
        // If Sunday, skip to Monday
        if (!isWorkingDay(current)) {
            current.setDate(current.getDate() + 1);
            current.setHours(WORK_START_HOUR, 0, 0, 0);
            continue;
        }

        // Define Work Window for Current Day
        const workStart = new Date(current);
        workStart.setHours(WORK_START_HOUR, 0, 0, 0);
        
        const workEnd = new Date(current);
        workEnd.setHours(Math.floor(WORK_END_HOUR), (WORK_END_HOUR % 1) * 60, 0, 0);

        // Calculate overlap between [current, end] and [workStart, workEnd]
        const overlapStart = current > workStart ? current : workStart;
        
        // Determine end of this day's segment
        // If 'end' date is same day and before workEnd, use 'end'. 
        // Else if 'end' is future day, cap at workEnd.
        let segmentEnd = workEnd;
        if (end < workEnd && end.getDate() === current.getDate()) {
            segmentEnd = end;
        }

        if (overlapStart < segmentEnd) {
            const diffMs = segmentEnd.getTime() - overlapStart.getTime();
            totalHours += diffMs / (1000 * 60 * 60);
        }

        // Move to next day start
        current.setDate(current.getDate() + 1);
        current.setHours(WORK_START_HOUR, 0, 0, 0);
    }

    return totalHours;
};

// Extend interface for internal usage
export interface AdvancedEmployeeEvaluation extends EmployeeEvaluation {
    avgCalendarDays: number; // Trung bình số ngày dương lịch
    avgWorkingHours: number; // Trung bình số giờ làm việc thực
}

const getLocalTickets = (): Ticket[] => {
    try {
        const s = localStorage.getItem(STORAGE_KEYS.TICKETS);
        return s ? JSON.parse(s) : INITIAL_TICKETS;
    } catch {
        return INITIAL_TICKETS;
    }
};

const saveLocalTickets = (tickets: Ticket[]) => {
    localStorage.setItem(STORAGE_KEYS.TICKETS, JSON.stringify(tickets));
};

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

// ... (checkTicketPermission, fetchTickets, fetchTicketsWithFilter, calculateSLADeadline, createTicket, sendTicketReminder, updateTicketStatus, updateTicket, addTicketComment, generateTicketCode, getElapsedTime, runTicketAutomation, getTicketStats - Keep as is) ...

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

export const fetchTickets = async (): Promise<Ticket[]> => {
    await new Promise(r => setTimeout(r, 200));
    const tickets = getLocalTickets();
    const now = new Date();
    return tickets.map(t => {
        if (t.status !== 'COMPLETED' && t.status !== 'CANCELLED' && t.slaDeadline) {
             const deadline = new Date(t.slaDeadline);
             if (now > deadline) t.isOverdue = true;
        }
        return t;
    }).sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
};

export const fetchTicketsWithFilter = async (filters: any, userId: string): Promise<Ticket[]> => {
    const all = await fetchTickets();
    return all.filter(t => {
        if (filters.startDate && t.createdAt < filters.startDate) return false;
        if (filters.endDate && t.createdAt > filters.endDate) return false;
        if (filters.type && filters.type !== 'ALL' && t.type !== filters.type) return false;
        if (filters.dept && filters.dept !== 'ALL' && t.departmentCode !== filters.dept) return false;
        if (filters.ownership) {
            const isMe = t.creatorId === userId || (t.assigneeIds && t.assigneeIds.includes(userId)) || (t.followerIds && t.followerIds.includes(userId)) || t.approverId === userId;
            if (filters.ownership === 'MY_TASKS' && !isMe) return false;
            if (filters.ownership === 'ASSIGNED_TO_ME' && !(t.assigneeIds && t.assigneeIds.includes(userId))) return false;
            if (filters.ownership === 'CREATED_BY_ME' && t.creatorId !== userId) return false;
            if (filters.ownership === 'MY_COMPLETED') return t.assigneeIds.includes(userId) && (t.status === 'COMPLETED' || t.status === 'WAITING_REVIEW');
            if (filters.ownership === 'MY_PENDING') return t.assigneeIds.includes(userId) && (t.status !== 'COMPLETED' && t.status !== 'CANCELLED');
        }
        return true;
    });
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

export const createTicket = async (ticket: Ticket): Promise<Ticket> => {
    const tickets = getLocalTickets();
    const slaDeadline = calculateSLADeadline(ticket.priority);
    let description = ticket.description;
    if (!description && TICKET_TEMPLATES[ticket.type]) {
        description = TICKET_TEMPLATES[ticket.type];
    }
    const newTicket: Ticket = { 
        ...ticket, 
        description,
        id: `tic_${Date.now()}`, 
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
    saveLocalTickets([newTicket, ...tickets]);
    sendBrowserNotification("FinancePro: Có yêu cầu mới", `[${newTicket.code}] ${newTicket.title} - ${newTicket.creatorName}`);
    return newTicket;
};

export const sendTicketReminder = async (ticketId: string, sender: UserContext): Promise<void> => {
    const tickets = getLocalTickets();
    const idx = tickets.findIndex(t => t.id === ticketId);
    if (idx === -1) throw new Error("Ticket not found");
    const ticket = tickets[idx];
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
        ticket.history.push({
            id: `log_remind_${Date.now()}`,
            action: 'AUTO_REMINDER',
            actorId: sender.id,
            actorName: sender.name,
            timestamp: now,
            details: `Gửi nhắc nhở thủ công lần ${ticket.reminderHistory.length}`
        });
    }
    saveLocalTickets(tickets);
};

export const updateTicketStatus = async (ticketId: string, status: TicketStatus, user: UserContext, rating?: number, ratingComment?: string): Promise<void> => {
    const tickets = getLocalTickets();
    const idx = tickets.findIndex(t => t.id === ticketId);
    if (idx === -1) throw new Error("Ticket not found");
    const ticket = tickets[idx];
    if (ticket.status === 'NEW' && status === 'IN_PROGRESS' && APPROVAL_TYPES.includes(ticket.type)) {
        if (!checkTicketPermission(ticket, user, 'APPROVE')) {
            throw new Error("Bạn không có quyền Phê duyệt yêu cầu này.");
        }
    } else {
        if (!checkTicketPermission(ticket, user, status === 'COMPLETED' || status === 'CANCELLED' ? 'CLOSE' : 'EDIT')) {
            throw new Error("Bạn không có quyền thực hiện thao tác này.");
        }
    }
    if (status === 'COMPLETED' && ticket.status === 'WAITING_REVIEW') {
         if (ticket.creatorId !== user.id && !user.permissions.includes('SYS_ADMIN') && ticket.approverId !== user.id) {
             throw new Error("Chỉ người tạo phiếu, người phê duyệt hoặc Admin mới có quyền Duyệt hoàn thành.");
         }
    }
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
    if (status === 'IN_PROGRESS' && oldStatus === 'WAITING_REVIEW') {
         ticket.closedAt = undefined;
    }
    if (status === 'COMPLETED' || status === 'CANCELLED') {
        ticket.closedAt = new Date().toISOString();
        if (rating) ticket.rating = rating;
        if (ratingComment) ticket.ratingComment = ratingComment;
    } else {
        ticket.closedAt = undefined;
    }
    let logAction: TicketLog['action'] = 'UPDATE_STATUS';
    if (status === 'COMPLETED') logAction = 'APPROVED';
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
    const comment: TicketComment = {
        id: `cm_sys_${Date.now()}`,
        ticketId,
        userId: 'system',
        userName: 'Hệ thống',
        content: msg,
        attachments: [],
        createdAt: new Date().toISOString(),
        isSystemLog: true
    };
    ticket.comments.push(comment);
    saveLocalTickets(tickets);
};

export const updateTicket = async (ticket: Ticket): Promise<void> => {
    const tickets = getLocalTickets();
    const idx = tickets.findIndex(t => t.id === ticket.id);
    if (idx === -1) throw new Error("Ticket not found");
    const updated = { 
        ...ticket, 
        updatedAt: new Date().toISOString(),
        lastActivityAt: new Date().toISOString()
    };
    if (updated.history?.length === tickets[idx].history?.length) {
        const mockUser: UserContext = { id: 'system', name: 'System', roleId: '', roleName: 'System', permissions: [], managedProjectIds: [], isAuthenticated: true, email: '' };
        const log = createAuditLog('UPDATE_STATUS', mockUser, 'Cập nhật thông tin vé');
        updated.history = [log, ...(updated.history || [])];
    }
    tickets[idx] = updated;
    saveLocalTickets(tickets);
};

export const addTicketComment = async (ticketId: string, content: string, user: UserContext, attachments: Attachment[] = []): Promise<void> => {
    const tickets = getLocalTickets();
    const idx = tickets.findIndex(t => t.id === ticketId);
    if (idx === -1) throw new Error("Ticket not found");
    const ticket = tickets[idx];
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
    saveLocalTickets(tickets);
};

export const generateTicketCode = (): string => {
    const date = new Date();
    const yymm = `${date.getFullYear().toString().slice(-2)}${(date.getMonth() + 1).toString().padStart(2, '0')}`;
    const random = Math.floor(Math.random() * 9000) + 1000;
    return `TK-${yymm}-${random}`;
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

export const runTicketAutomation = async () => {
    const lastRun = localStorage.getItem(STORAGE_KEYS.LAST_AUTOMATION_RUN);
    const now = Date.now();
    if (lastRun && (now - parseInt(lastRun)) < 3600000) return;
    const tickets = getLocalTickets();
    const activeTickets = tickets.filter(t => t.status !== 'COMPLETED' && t.status !== 'CANCELLED');
    let hasUpdates = false;
    activeTickets.forEach(t => {
        const lastAct = new Date(t.lastActivityAt || t.createdAt).getTime();
        const diffHours = (now - lastAct) / (1000 * 3600);
        if (diffHours > 48 && !t.comments.some(c => c.content.includes("Cảnh báo: Ticket không có hoạt động") && new Date(c.createdAt).getTime() > lastAct)) {
            const comment: TicketComment = {
                id: `auto_stag_${Date.now()}`,
                ticketId: t.id,
                userId: 'system',
                userName: 'Hệ thống (Auto)',
                content: `⚠️ Cảnh báo: Ticket không có hoạt động trong 48h qua. Vui lòng cập nhật tiến độ.`,
                attachments: [],
                createdAt: new Date().toISOString(),
                isSystemLog: true
            };
            t.comments.push(comment);
            t.history?.unshift({
                id: `log_auto_${Date.now()}`,
                action: 'AUTO_REMINDER',
                actorId: 'system',
                actorName: 'System Bot',
                timestamp: new Date().toISOString(),
                details: 'Gửi cảnh báo chậm trễ'
            });
            hasUpdates = true;
        }
        if (t.slaDeadline) {
            const deadline = new Date(t.slaDeadline).getTime();
            const hoursLeft = (deadline - now) / (1000 * 3600);
            if (hoursLeft > 0 && hoursLeft < 4 && !t.comments.some(c => c.content.includes("Sắp hết hạn SLA"))) {
                 const comment: TicketComment = {
                    id: `auto_sla_${Date.now()}`,
                    ticketId: t.id,
                    userId: 'system',
                    userName: 'Hệ thống (Auto)',
                    content: `⏰ Nhắc nhở: Sắp hết hạn SLA (còn < ${hoursLeft.toFixed(1)}h). Ưu tiên xử lý ngay!`,
                    attachments: [],
                    createdAt: new Date().toISOString(),
                    isSystemLog: true
                };
                t.comments.push(comment);
                hasUpdates = true;
            }
        }
    });
    if (hasUpdates) {
        saveLocalTickets(tickets);
    }
    localStorage.setItem(STORAGE_KEYS.LAST_AUTOMATION_RUN, now.toString());
};

export const getTicketStats = async (userId: string): Promise<TicketStats> => {
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
    
    // Extended Stats
    const stats: Record<string, { 
        count: number, 
        totalHours: number, 
        totalWorkingHours: number, // New: Working Time
        totalDays: number,         // New: Calendar Days
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
        
        // Calculate strict working hours
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
        // New Metrics
        avgCalendarDays: data.count > 0 ? data.totalDays / data.count : 0,
        avgWorkingHours: data.count > 0 ? data.totalWorkingHours / data.count : 0
    }));
};

export const getManualReminders = (): ManualReminder[] => {
    try {
        const s = localStorage.getItem(STORAGE_KEYS.REMINDERS);
        return s ? JSON.parse(s) : [];
    } catch { return []; }
};

export const saveManualReminder = (reminder: ManualReminder) => {
    const current = getManualReminders();
    const updated = [reminder, ...current];
    localStorage.setItem(STORAGE_KEYS.REMINDERS, JSON.stringify(updated));
};

export const toggleReminderStatus = (id: string) => {
    const current = getManualReminders();
    const updated = current.map(r => r.id === id ? { ...r, isDone: !r.isDone } : r);
    localStorage.setItem(STORAGE_KEYS.REMINDERS, JSON.stringify(updated));
};

export const deleteReminder = (id: string) => {
    const current = getManualReminders();
    const updated = current.filter(r => r.id !== id);
    localStorage.setItem(STORAGE_KEYS.REMINDERS, JSON.stringify(updated));
};

export const checkAndGenerateRecurringTickets = async (currentUser: UserContext) => {
    const lastGenMonth = localStorage.getItem(STORAGE_KEYS.LAST_AUTO_GEN);
    const currentMonth = new Date().toISOString().slice(0, 7); 
    
    if (lastGenMonth === currentMonth) return;

    const autoTickets: Partial<Ticket>[] = [
        { title: `Chấm công & Tính lương Tháng ${currentMonth.split('-')[1]}`, type: 'REQUEST_DOCS', priority: 'HIGH', description: 'Yêu cầu bộ phận Nhân sự tổng hợp công và gửi bảng lương nháp.' },
        { title: `Kiểm tra chứng từ tồn đọng Tháng ${currentMonth.split('-')[1]}`, type: 'REQUEST_PAYMENT', priority: 'NORMAL', description: 'Yêu cầu Kế toán rà soát các phiếu chi chưa đủ chứng từ.' },
        { title: `Báo cáo tài chính Tháng ${currentMonth.split('-')[1]}`, type: 'REQUEST_DOCS', priority: 'HIGH', description: 'Yêu cầu Kế toán trưởng xuất báo cáo P&L sơ bộ.' }
    ];

    for (const t of autoTickets) {
        const newTicket: Ticket = {
            id: `tic_auto_${Date.now()}_${Math.random()}`,
            code: generateTicketCode(),
            title: t.title!,
            type: t.type!,
            priority: t.priority!,
            description: t.description!,
            creatorId: 'system',
            creatorName: 'Hệ thống (Auto)',
            assigneeIds: [],
            followerIds: [],
            departmentCode: 'ALL',
            status: 'NEW',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            comments: [],
            attachments: [],
            isRecurring: true,
            recurringType: 'MONTHLY',
            history: [],
            reminderHistory: []
        };
        await createTicket(newTicket);
    }

    localStorage.setItem(STORAGE_KEYS.LAST_AUTO_GEN, currentMonth);
    console.log("Auto-generated recurring tickets for", currentMonth);
};

export const getRecurringSuggestions = (input: string): string[] => {
    const common = [
        "Đề nghị thanh toán tiền điện",
        "Đề nghị thanh toán tiền nước",
        "Mua văn phòng phẩm tháng này",
        "Sửa chữa máy in",
        "Tạm ứng công tác phí"
    ];
    if (!input) return common.slice(0, 3);
    return common.filter(c => c.toLowerCase().includes(input.toLowerCase()));
};
