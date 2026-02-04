
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
    Ticket, TicketStatus, Project, UserContext, TicketType, TicketPriority, Attachment, Employee, ManualReminder, TicketStats 
} from '../types';
import { 
    fetchTickets, createTicket, updateTicketStatus, addTicketComment, generateTicketCode, updateTicket, getTicketStats,
    getEmployeeEvaluations, getManualReminders, saveManualReminder, toggleReminderStatus, deleteReminder, getRecurringSuggestions,
    runTicketAutomation, checkTicketPermission, TICKET_TEMPLATES, sendTicketReminder, getElapsedTime, APPROVAL_TYPES, TASK_TYPES, AdvancedEmployeeEvaluation,
    initializeTicketConfigs,
    fetchDepartments,
    fetchTicketTypesConfig,
    saveTicketTypeConfig,
    saveDepartment,
    deleteTicketTypeConfig,
    deleteDepartment
} from '../services/ticketService';
import { requestNotificationPermission } from '../services/notificationService';
import { uploadFileToDrive } from '../services/googleDriveService';
import { getEmployees } from '../services/employeeService';
import { 
    Plus, Search, Filter, Inbox, Send, CheckCircle2, Clock, XCircle, 
    MessageSquare, Paperclip, FileText, User, Calendar, Building2, 
    AlertCircle, ChevronRight, Hash, Loader2, ArrowRight, Upload,
    MoreHorizontal, Printer, Star, Zap, Settings, RefreshCw, LayoutGrid, List, MessageCircle, Mail,
    Sparkles, ThumbsUp, Trash2, Save, Edit3, CheckSquare, History, Trophy, Activity, Bell,
    BarChart3, UserCheck, StickyNote, Timer, Flame, X, ShieldAlert, BookOpen, Flag, Check, Undo2, CalendarRange, PieChart, Users, ChevronDown, PlayCircle, FileCheck, Briefcase
} from 'lucide-react';
import { Combobox } from './ui/Combobox';
import { PieChart as RePieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, CartesianGrid } from 'recharts';

interface WorkflowManagerProps {
    projects: Project[];
    currentUser: UserContext;
}

// DEFAULT CONSTANTS
const DEFAULT_DEPARTMENTS = [
    { code: 'SALES', label: 'Kinh doanh (Sales)' },
    { code: 'TECH', label: 'Kỹ thuật / Dự án' },
    { code: 'PURCHASE', label: 'Mua hàng / Cung ứng' },
    { code: 'ACC', label: 'Kế toán - Tài chính' },
    { code: 'HR', label: 'Hành chính - Nhân sự' },
    { code: 'BOD', label: 'Ban Giám đốc' }
];

// RE-ORGANIZED DEFAULT TYPES WITH CATEGORIES
const DEFAULT_TICKET_TYPES = [
    // --- APPROVAL GROUP (Xin Phê Duyệt) ---
    { code: 'REQUEST_PAYMENT', label: 'Đề nghị Thanh toán', category: 'APPROVAL', sla: 48 },
    { code: 'REQUEST_PURCHASE_APP', label: 'Phê duyệt Mua sắm (Tài sản/Thiết bị)', category: 'APPROVAL', sla: 24 },
    { code: 'REQUEST_LEAVE', label: 'Xin nghỉ phép / Công tác', category: 'APPROVAL', sla: 8 },
    { code: 'SUGGESTION', label: 'Đề xuất / Góp ý', category: 'APPROVAL', sla: 0 },
    
    // --- TASK GROUP (Giao Việc) ---
    { code: 'TASK_SUPPLY', label: 'Cung ứng vật tư (Giao kho)', category: 'TASK', sla: 24 },
    { code: 'REQUEST_BOQ', label: 'Bóc tách khối lượng / Báo giá', category: 'TASK', sla: 72 },
    { code: 'REQUEST_DOCS', label: 'Soạn thảo Hồ sơ / Hợp đồng', category: 'TASK', sla: 24 },
    { code: 'REQUEST_IT', label: 'Hỗ trợ IT / Sửa chữa', category: 'TASK', sla: 4 },
    { code: 'OTHER', label: 'Giao việc khác', category: 'TASK', sla: 48 }
];

const PRIORITIES: { code: TicketPriority, label: string, color: string }[] = [
    { code: 'URGENT', label: 'Khẩn cấp', color: 'bg-red-100 text-red-700 border-red-200' },
    { code: 'HIGH', label: 'Cao', color: 'bg-orange-100 text-orange-700 border-orange-200' },
    { code: 'NORMAL', label: 'Bình thường', color: 'bg-blue-50 text-blue-700 border-blue-100' },
    { code: 'LOW', label: 'Thấp', color: 'bg-slate-100 text-slate-700 border-slate-200' }
];

const COLORS = ['#6366f1', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6', '#ec4899'];

// --- SUB-COMPONENT: BIG COUNTDOWN ---
const CountdownTimer = ({ deadline }: { deadline: string }) => {
    const [timeLeft, setTimeLeft] = useState<{h: number, m: number, s: number, expired: boolean}>({ h: 0, m: 0, s: 0, expired: false });

    useEffect(() => {
        const calculate = () => {
            const now = new Date().getTime();
            const end = new Date(deadline).getTime();
            const diff = end - now;

            if (diff < 0) {
                setTimeLeft({ h: 0, m: 0, s: 0, expired: true });
            } else {
                const h = Math.floor(diff / (1000 * 60 * 60));
                const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
                const s = Math.floor((diff % (1000 * 60)) / 1000);
                setTimeLeft({ h, m, s, expired: false });
            }
        };
        calculate();
        const timer = setInterval(calculate, 1000);
        return () => clearInterval(timer);
    }, [deadline]);

    if (timeLeft.expired) {
        return (
            <div className="bg-red-600 text-white rounded-xl p-4 text-center shadow-lg animate-pulse min-w-[140px]">
                <p className="text-xs font-bold uppercase tracking-widest mb-1">Trạng thái SLA</p>
                <div className="text-2xl font-black">QUÁ HẠN</div>
            </div>
        );
    }

    const isUrgent = timeLeft.h < 4;
    
    return (
        <div className={`rounded-2xl p-4 text-center shadow-lg border-2 relative overflow-hidden group min-w-[160px] ${isUrgent ? 'bg-gradient-to-br from-orange-500 to-red-600 border-red-400 text-white' : 'bg-gradient-to-br from-slate-800 to-indigo-900 border-indigo-500 text-white'}`}>
            <div className="relative z-10">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] opacity-80 mb-2 flex items-center justify-center">
                    <Timer size={12} className="mr-1"/> SLA còn lại
                </p>
                <div className="flex justify-center items-baseline gap-1 font-mono">
                    <div className="flex flex-col">
                        <span className="text-4xl font-black leading-none">{timeLeft.h.toString().padStart(2,'0')}</span>
                        <span className="text-[9px] font-bold opacity-60">GIỜ</span>
                    </div>
                    <span className="text-2xl font-black opacity-50">:</span>
                    <div className="flex flex-col">
                        <span className="text-4xl font-black leading-none">{timeLeft.m.toString().padStart(2,'0')}</span>
                        <span className="text-[9px] font-bold opacity-60">PHÚT</span>
                    </div>
                </div>
            </div>
            {/* Background Effect */}
            <div className="absolute -bottom-4 -right-4 opacity-10">
                <Clock size={80}/>
            </div>
        </div>
    );
};

// --- SUB-COMPONENT: PROCESSING TIMER (ELAPSED) ---
const ProcessingTimer = ({ startTime }: { startTime: string }) => {
    const [elapsed, setElapsed] = useState<{d: number, h: number, m: number}>({ d: 0, h: 0, m: 0 });

    useEffect(() => {
        const calculate = () => {
            const start = new Date(startTime).getTime();
            const now = new Date().getTime();
            const diff = now - start;

            const d = Math.floor(diff / (1000 * 60 * 60 * 24));
            const h = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

            setElapsed({ d, h, m });
        };
        calculate();
        const timer = setInterval(calculate, 1000);
        return () => clearInterval(timer);
    }, [startTime]);

    return (
        <div className="rounded-2xl p-4 text-center shadow-lg border-2 border-emerald-500 bg-gradient-to-br from-emerald-600 to-teal-700 text-white relative overflow-hidden group min-w-[160px]">
            <div className="relative z-10">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] opacity-80 mb-2 flex items-center justify-center">
                    <PlayCircle size={12} className="mr-1"/> Thời gian đã xử lý
                </p>
                <div className="flex justify-center items-baseline gap-1 font-mono">
                    {elapsed.d > 0 && (
                        <>
                            <div className="flex flex-col">
                                <span className="text-4xl font-black leading-none">{elapsed.d}</span>
                                <span className="text-[9px] font-bold opacity-60">NGÀY</span>
                            </div>
                            <span className="text-2xl font-black opacity-50">:</span>
                        </>
                    )}
                    <div className="flex flex-col">
                        <span className="text-4xl font-black leading-none">{elapsed.h.toString().padStart(2,'0')}</span>
                        <span className="text-[9px] font-bold opacity-60">GIỜ</span>
                    </div>
                    <span className="text-2xl font-black opacity-50">:</span>
                    <div className="flex flex-col">
                        <span className="text-4xl font-black leading-none text-teal-200">{elapsed.m.toString().padStart(2,'0')}</span>
                        <span className="text-[9px] font-bold opacity-60 text-teal-200">PHÚT</span>
                    </div>
                </div>
            </div>
            <div className="absolute -bottom-4 -left-4 opacity-10">
                <Activity size={80}/>
            </div>
        </div>
    );
};

const WorkflowManager: React.FC<WorkflowManagerProps> = ({ projects, currentUser }) => {
    const [activeMainTab, setActiveMainTab] = useState<'OPERATIONS' | 'ANALYTICS'>('OPERATIONS');
    
    const [tickets, setTickets] = useState<Ticket[]>([]);
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isProcessingAction, setIsProcessingAction] = useState(false);
    
    // NEW: Analytics Filters
    const [analyticsTimeMode, setAnalyticsTimeMode] = useState<'MONTH' | 'QUARTER' | 'YEAR'>('MONTH');
    const [analyticsDate, setAnalyticsDate] = useState(new Date());
    const [analyticsPersonFilter, setAnalyticsPersonFilter] = useState<string>('ALL');

    const [reminders, setReminders] = useState<ManualReminder[]>([]);
    const [showReminderPanel, setShowReminderPanel] = useState(false);
    const [showRatingModal, setShowRatingModal] = useState(false);
    const [showCompletionModal, setShowCompletionModal] = useState(false);
    
    // Config State
    const [departments, setDepartments] = useState([]);
    const [ticketTypes, setTicketTypes] = useState([]);

    // UI State
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [showConfig, setShowConfig] = useState(false);
    const [configTab, setConfigTab] = useState<'TYPES' | 'DEPTS'>('TYPES');
    const [newConfigItem, setNewConfigItem] = useState({ code: '', label: '', sla: 0 });
    
    // --- OPERATIONS FILTERS ---
    const [filterTimeMode, setFilterTimeMode] = useState<'ALL' | 'MONTH' | 'QUARTER' | 'YEAR'>('MONTH');
    const [filterDate, setFilterDate] = useState(new Date()); // Current selection
    const [filterCategory, setFilterCategory] = useState<'ALL' | 'APPROVAL' | 'TASK'>('ALL');
    const [filterPerson, setFilterPerson] = useState<string>('ALL'); // Employee ID
    const [filterPriority, setFilterPriority] = useState<TicketPriority | 'ALL'>('ALL');
    const [filterStatus, setFilterStatus] = useState<'ALL' | 'ACTIVE' | 'DONE'>('ACTIVE');
    const [searchTerm, setSearchTerm] = useState('');
    
    // Form State
    const [createCategory, setCreateCategory] = useState<'APPROVAL' | 'TASK'>('APPROVAL');
    // Khởi tạo state cho Form
    const [formState, setFormState] = useState<Partial<Ticket>>({
        title: '',
        priority: 'NORMAL',
        type: 'OTHER', // Hoặc giá trị mặc định tùy logic
        departmentCode: '', // Quan trọng: Để lưu phòng ban
        projectId: '',      // Quan trọng: Để lưu dự án
        assigneeIds: [],    // Quan trọng: Mảng người xử lý
        followerIds: [],
        description: '',
        completionCriteria: '' // Quan trọng: Tiêu chí hoàn thành
    });
    const [titleSuggestions, setTitleSuggestions] = useState<string[]>([]);
    
    // Reminder Form
    const [newReminder, setNewReminder] = useState({ targetName: '', content: '' });

    // Comment Input
    const [commentText, setCommentText] = useState('');
    const [commentAttachments, setCommentAttachments] = useState<Attachment[]>([]);
    const [isSendingComment, setIsSendingComment] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Detail Edit State
    const [isEditingTicket, setIsEditingTicket] = useState(false);
    const [editAssigneeIds, setEditAssigneeIds] = useState<string[]>([]);
    const [editDeadline, setEditDeadline] = useState('');

    // Rating State
    const [ratingVal, setRatingVal] = useState(5);
    const [ratingComment, setRatingComment] = useState('');
    
    // Completion Flow State
    const [completionNote, setCompletionNote] = useState('');
    const [completionAttachments, setCompletionAttachments] = useState<Attachment[]>([]);
    const isAdmin = currentUser.permissions.includes('SYS_ADMIN');

    useEffect(() => {
        loadData();
        loadConfig();
        runTicketAutomation().then(loadData);
        requestNotificationPermission();
    }, []);

    // Sync edit state when ticket selected
    useEffect(() => {
        if(selectedTicket) {
            setEditAssigneeIds(selectedTicket.assigneeIds || []);
            setEditDeadline(selectedTicket.slaDeadline ? selectedTicket.slaDeadline.slice(0, 16) : '');
            setIsEditingTicket(false);
        }
    }, [selectedTicket]);

    // Reset Type when changing Category in Create Form
    useEffect(() => {
        // Filter based on 'category' property or fallback for legacy
        const availableTypes: any = ticketTypes.filter((t:any) => 
            (t as any).category ? (t as any).category === createCategory : 
            (createCategory === 'APPROVAL' ? APPROVAL_TYPES.includes(t.code) : TASK_TYPES.includes(t.code))
        );
        if (availableTypes.length > 0) {
             setFormState((prev: any) => ({...prev, type: availableTypes[0].code}));
             // Also trigger template update
             handleFormTypeChange(availableTypes[0].code);
        }
    }, [createCategory, ticketTypes]);

    const loadConfig = async () => {
        try {
            // 1. Chạy khởi tạo (nếu lần đầu chưa có dữ liệu backend)
            await initializeTicketConfigs(); 

            // 2. Lấy dữ liệu mới nhất từ Backend
            const [depts, types] = await Promise.all([
                fetchDepartments(),
                fetchTicketTypesConfig()
            ]);
            
            setDepartments(depts);
            setTicketTypes(types);
        } catch(e) { console.error("Config Load Error", e); }
    };

    // Thay thế hàm saveConfig cũ bằng hàm này:
    const saveConfig = async () => {
        try {
            // Hiển thị loading nhẹ hoặc disable nút nếu cần
            setIsLoading(true); 

            // 1. Tạo danh sách các Promise để lưu Ticket Types
            const typePromises = ticketTypes.map((t: any) => 
                saveTicketTypeConfig({
                    ...t,
                    // Đảm bảo có ID. Nếu chưa có (dữ liệu cũ), tạo ID theo quy tắc
                    id: t.id || `type_${t.code}` 
                })
            );

            // 2. Tạo danh sách các Promise để lưu Departments
            const deptPromises = departments.map((d: any) => 
                saveDepartment({
                    ...d,
                    id: d.id || `dept_${d.code}`
                })
            );

            // 3. Thực thi tất cả cùng lúc (tối ưu tốc độ)
            await Promise.all([...typePromises, ...deptPromises]);

            setShowConfig(false);
            alert("Đã đồng bộ cấu hình lên Server thành công!");
        } catch (error) {
            console.error("Lỗi lưu cấu hình:", error);
            alert("Có lỗi xảy ra khi lưu cấu hình.");
        } 
        finally { setIsLoading(false); }
    };

    const loadData = async () => {
        setIsLoading(true);
        const [tData, empData] = await Promise.all([
            fetchTickets(),
            getEmployees()
        ]);
        setTickets(tData);
        setEmployees(empData);
        
        // Load extras
        setReminders(await getManualReminders());
        
        setIsLoading(false);
    };

    // --- ANALYTICS DATA CALCULATION ---
    // Filter tickets for analytics based on analytics filters
    const filteredAnalyticsTickets = useMemo(() => {
        return tickets.filter(t => {
            const date = new Date(t.createdAt);
            const selYear = analyticsDate.getFullYear();
            if (date.getFullYear() !== selYear) return false;

            if (analyticsTimeMode === 'MONTH') {
                if (date.getMonth() !== analyticsDate.getMonth()) return false;
            } else if (analyticsTimeMode === 'QUARTER') {
                const q = Math.floor(date.getMonth() / 3);
                const selQ = Math.floor(analyticsDate.getMonth() / 3);
                if (q !== selQ) return false;
            }

            if (analyticsPersonFilter !== 'ALL') {
                const isAssignee = t.assigneeIds.includes(analyticsPersonFilter);
                if (!isAssignee) return false;
            }
            return true;
        });
    }, [tickets, analyticsTimeMode, analyticsDate, analyticsPersonFilter]);

    // Calculate dynamic stats based on filtered tickets
    const dynamicStats: TicketStats = useMemo(() => {
        // Simple mock of getTicketStats logic but strictly on filtered list
        const pending = filteredAnalyticsTickets.filter(t => t.status !== 'COMPLETED' && t.status !== 'CANCELLED').length;
        const urgent = filteredAnalyticsTickets.filter(t => (t.priority === 'URGENT' || t.priority === 'HIGH') && t.status !== 'COMPLETED').length;
        const completed = filteredAnalyticsTickets.filter(t => t.status === 'COMPLETED').length;
        
        // SLA
        const overdue = filteredAnalyticsTickets.filter(t => t.status !== 'COMPLETED' && t.status !== 'CANCELLED' && t.slaDeadline && new Date(t.slaDeadline) < new Date()).length;
        
        // Avg Satisfaction
        const rated = filteredAnalyticsTickets.filter(t => t.rating);
        const avgSat = rated.length > 0 ? rated.reduce((s,t) => s + (t.rating || 0), 0) / rated.length : 5;

        // By Dept
        const deptMap: Record<string, number> = {};
        filteredAnalyticsTickets.forEach(t => {
            const d = t.departmentCode || 'OTHER';
            deptMap[d] = (deptMap[d] || 0) + 1;
        });
        const byDept = Object.entries(deptMap).map(([name, value]) => ({ name, value }));

        // By Project
        const projMap: Record<string, number> = {};
        filteredAnalyticsTickets.forEach(t => {
            const p = t.projectName || 'Chung';
            projMap[p] = (projMap[p] || 0) + 1;
        });
        const byProject = Object.entries(projMap).sort((a,b) => b[1] - a[1]).slice(0, 5).map(([name, value]) => ({ name, value }));

        return {
            total: filteredAnalyticsTickets.length,
            pending,
            urgent,
            completedThisMonth: completed, // Label reuse
            avgSatisfaction: avgSat,
            myPendingCount: 0,
            aiInsight: "Dữ liệu được lọc theo tiêu chí.",
            byDept,
            byProject,
            slaStatus: { onTime: pending - overdue, overdue },
            avgResolutionHours: 0, // Calc if needed
            lazyEmployees: [],
            workloadByDept: byDept
        };
    }, [filteredAnalyticsTickets]);

    // Calculate dynamic evaluations based on filtered tickets
    const dynamicEvaluations: AdvancedEmployeeEvaluation[] = useMemo(() => {
        const statsMap: Record<string, { 
            count: number, 
            totalHours: number, 
            totalWorkingHours: number,
            totalDays: number,
            totalRating: number, 
            ratingCount: number, 
            activeCount: number, 
            overdueCount: number 
        }> = {};

        // Active
        const active = filteredAnalyticsTickets.filter(t => t.status !== 'COMPLETED' && t.status !== 'CANCELLED');
        active.forEach(t => {
            const isOverdue = t.slaDeadline && new Date(t.slaDeadline) < new Date();
            t.assigneeIds.forEach(empId => {
                if (!statsMap[empId]) statsMap[empId] = { count: 0, totalHours: 0, totalWorkingHours: 0, totalDays: 0, totalRating: 0, ratingCount: 0, activeCount: 0, overdueCount: 0 };
                statsMap[empId].activeCount++;
                if(isOverdue) statsMap[empId].overdueCount++;
            });
        });

        // Completed
        const completed = filteredAnalyticsTickets.filter(t => t.status === 'COMPLETED');
        completed.forEach(t => {
             // Mock duration calc (simplified)
            t.assigneeIds.forEach(empId => {
                if (!statsMap[empId]) statsMap[empId] = { count: 0, totalHours: 0, totalWorkingHours: 0, totalDays: 0, totalRating: 0, ratingCount: 0, activeCount: 0, overdueCount: 0 };
                statsMap[empId].count++;
                if (t.rating) {
                    statsMap[empId].totalRating += t.rating;
                    statsMap[empId].ratingCount++;
                }
            });
        });

        return Object.entries(statsMap).map(([empId, data]) => ({
            empId,
            totalResolved: data.count,
            activeTasks: data.activeCount,
            overdueCount: data.overdueCount,
            avgResolutionHours: 0, // Simplified
            avgRating: data.ratingCount > 0 ? data.totalRating / data.ratingCount : 0,
            avgCalendarDays: 0,
            avgWorkingHours: 0
        }));
    }, [filteredAnalyticsTickets]);

    // --- OPERATIONS FILTERS LOGIC ---
    const filteredTickets = useMemo(() => {
        // [DATA VISIBILITY] Chuẩn bị dữ liệu quyền hạn
        const isAdmin = currentUser.permissions?.includes('SYS_ADMIN');
        const currentUserId = String(currentUser.id).trim();

        return tickets.filter(t => {
            // ==================================================================================
            // 0. BỘ LỌC BẢO MẬT (VISIBILITY CHECK) - CHẠY ĐẦU TIÊN
            // ==================================================================================
            if (!isAdmin) {
                const isCreator = String(t.creatorId).trim() === currentUserId;
                const isAssignee = t.assigneeIds?.some(id => String(id).trim() === currentUserId);
                
                // Mở rộng: Phải cho phép Approver (người duyệt) và Follower thấy phiếu thì mới làm việc được
                const isApprover = String(t.approverId).trim() === currentUserId;
                const isFollower = t.followerIds?.some(id => String(id).trim() === currentUserId);

                // Nếu KHÔNG PHẢI bất kỳ vai trò nào trong phiếu -> Ẩn ngay lập tức
                if (!isCreator && !isAssignee && !isApprover && !isFollower) {
                    return false;
                }
            }
            // ==================================================================================

            // 1. Core View Filter (Active vs Done)
            const isCompleted = t.status === 'COMPLETED' || t.status === 'CANCELLED';
            if (filterStatus === 'ACTIVE' && isCompleted) return false;
            if (filterStatus === 'DONE' && !isCompleted) return false;

            // 2. Search
            const matchesSearch = t.title.toLowerCase().includes(searchTerm.toLowerCase()) || t.code.toLowerCase().includes(searchTerm.toLowerCase());
            if (!matchesSearch) return false;

            // 3. Priority
            if (filterPriority !== 'ALL' && t.priority !== filterPriority) return false;
            
            // 4. Time Filter
            if (filterTimeMode !== 'ALL') {
                const date = new Date(t.createdAt);
                const selYear = filterDate.getFullYear();
                if (date.getFullYear() !== selYear) return false;
                
                if (filterTimeMode === 'MONTH') {
                    if (date.getMonth() !== filterDate.getMonth()) return false;
                } else if (filterTimeMode === 'QUARTER') {
                    const q = Math.floor(date.getMonth() / 3);
                    const selQ = Math.floor(filterDate.getMonth() / 3);
                    if (q !== selQ) return false;
                }
            }

            // 5. Category (Request vs Approval)
            // Fix logic cũ: Tra cứu category từ config thay vì hardcode
            const foundTypeConfig: any = ticketTypes.find((type: any) => type.code === t.type);
            const isApprovalType = foundTypeConfig 
                ? foundTypeConfig.category === 'APPROVAL' 
                : APPROVAL_TYPES.includes(t.type);

            if (filterCategory !== 'ALL') {
                if (filterCategory === 'APPROVAL' && !isApprovalType) return false;
                if (filterCategory === 'TASK' && isApprovalType) return false;
            }

            // 6. Person Filter (Bộ lọc UI - Lọc thêm trong danh sách đã được phép xem)
            if (filterPerson !== 'ALL') {
                // Nếu chọn "Việc của tôi" hoặc chọn 1 nhân viên cụ thể
                const isCreatorUi = String(t.creatorId).trim() === String(filterPerson).trim();
                const isAssigneeUi = t.assigneeIds.includes(filterPerson);
                if (!isCreatorUi && !isAssigneeUi) return false;
            }

            return true;
        });
    }, [tickets, searchTerm, filterStatus, filterPriority, filterTimeMode, filterDate, filterCategory, filterPerson, currentUser, ticketTypes]);

    // --- HANDLER: ADD NEW TICKET TYPE DYNAMICALLY ---
    const handleAddTicketType = async () => {
        const name = prompt("Nhập tên Loại yêu cầu mới:");
        if (!name) return;
        
        const code = `CUSTOM_${Date.now()}`;
        const newType = { 
            code, 
            label: name, 
            category: createCategory, 
            sla: 24 
        };

        // GỌI API LƯU
        await saveTicketTypeConfig(newType);
        
        // Cập nhật State
        const updatedTypes = await fetchTicketTypesConfig();
        setTicketTypes(updatedTypes);
        
        // Auto select
        setFormState(prev => ({...prev, type: code as any}));
    };

    const handleCreateTicket = async () => {
        // 1. Validate dữ liệu đầu vào
        if (!formState.title || !formState.assigneeIds?.length) {
            alert("Vui lòng nhập tiêu đề và chọn ít nhất một người xử lý.");
            return;
        }

        // 2. Logic tìm người duyệt mặc định (nếu có cấu hình trong ticketTypes)
        // Ví dụ: Loại phiếu Mua sắm (REQUEST_PURCHASE) có thể cấu hình sếp mặc định duyệt
        const typeConfig: any = ticketTypes.find(t => t.code === formState.type);
        const defaultApproverId = typeConfig?.defaultApproverId;
        const defaultApproverName = employees.find(e => e.id === defaultApproverId)?.fullName;

        // 3. Chuẩn bị Object Ticket để gửi xuống Backend
        const ticketPayload: Ticket = {
            id: '', // createTicket trong service sẽ tự sinh ID hoặc Backend sinh ID
            code: '', // createTicket trong service sẽ tự sinh Code
            
            // --- CÁC TRƯỜNG TỪ FORM (Đồng bộ với UI bạn cung cấp) ---
            title: formState.title,
            type: formState.type || 'OTHER',
            priority: formState.priority || 'NORMAL',
            departmentCode: formState.departmentCode || 'OTHER', // Lưu phòng ban
            projectId: formState.projectId || undefined,         // Lưu ID dự án
            projectName: projects.find(p => p.id === formState.projectId)?.name, // Lưu tên dự án (để hiển thị nhanh)
            completionCriteria: formState.completionCriteria || '', // Lưu tiêu chí hoàn thành
            description: formState.description || '',
            assigneeIds: formState.assigneeIds, // Mảng ID người xử lý,
            category: typeConfig?.category || (APPROVAL_TYPES.includes(formState.type || '') ? 'APPROVAL' : 'TASK'),
            // --------------------------------------------------------

            // --- CÁC TRƯỜNG HỆ THỐNG / CONTEXT ---
            creatorId: currentUser.id,
            creatorName: currentUser.name,
            creatorAvatar: currentUser.avatarUrl,
            followerIds: formState.followerIds || [],
            
            status: 'NEW', // Trạng thái mặc định
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            
            // --- LOGIC PHÊ DUYỆT ---
            approverId: defaultApproverId, // Lưu người duyệt nếu có
            approverName: defaultApproverName,
            
            comments: [],
            attachments: [],
            rating: 0,
            history: [],
            reminderHistory: []
        };

        setIsLoading(true); // Hiển thị loading nếu cần
        try {
            // Gọi Service (đã viết lại gọi API backend)
            await createTicket(ticketPayload);
            
            // Reload lại danh sách sau khi tạo xong
            await loadData();
            
            // Đóng modal và Reset form
            setIsCreateModalOpen(false);
            setFormState({ 
                title: '',
                priority: 'NORMAL', 
                type: 'OTHER', 
                assigneeIds: [], 
                followerIds: [],
                departmentCode: '',
                projectId: '',
                description: '',
                completionCriteria: ''
            });
            
            alert("Tạo yêu cầu thành công!");
        } catch (error: any) {
            console.error("Lỗi tạo ticket:", error);
            alert("Lỗi khi tạo yêu cầu: " + error.message);
        } finally {
            setIsLoading(false);
        }
    };

    const handleQuickAction = async (action: 'APPROVE' | 'REJECT' | 'COMPLETE_REPORT' | 'CLOSE' | 'FINALIZE') => {
        if (!selectedTicket) return;

        // ==================================================================================
        // 1. CHUẨN BỊ DỮ LIỆU & SO SÁNH (DATA PREPARATION)
        // ==================================================================================
        
        // Chuẩn hóa ID để so sánh chính xác tuyệt đối
        const currentUserId = String(currentUser.id).trim();
        const isAdmin = currentUser.permissions?.includes('SYS_ADMIN');

        // Lấy cấu hình loại phiếu để tìm defaultApproverId
        const typeConfig: any = ticketTypes.find((t: any) => t.code === selectedTicket.type);
        
        // Xác định ID người duyệt (Ưu tiên Config > Trên phiếu)
        const configApprId = typeConfig?.defaultApproverId ? String(typeConfig.defaultApproverId).trim() : null;
        const ticketApprId = selectedTicket.approverId ? String(selectedTicket.approverId).trim() : null;
        const finalApproverId = configApprId || ticketApprId; 

        // --- CHECK VAI TRÒ (ROLES) ---
        const isCreator = String(selectedTicket.creatorId).trim() === currentUserId;
        
        const isAssignee = selectedTicket.assigneeIds 
            ? selectedTicket.assigneeIds.some(id => String(id).trim() === currentUserId) 
            : false;
            
        const isApprover = (finalApproverId === currentUserId);

        // --- CHECK NHÓM QUYỀN (PERMISSION GROUPS) ---
        
        // Nhóm 1: Quyền LÀM VIỆC (Tiếp nhận, Báo cáo) -> Assignee hoặc Creator
        const canWork = isAssignee || isCreator || isAdmin;

        // Nhóm 2: Quyền QUYẾT ĐỊNH (Duyệt, Không đạt, Hủy) -> Creator hoặc Approver
        const canDecide = isCreator || isApprover || isAdmin;

        // --- LOG DEBUG ---
        console.log(`--- CHECK QUYỀN [${action}] ---`);
        console.log(`User: ${currentUserId} | IsAdmin: ${isAdmin}`);
        console.log(`IsAssignee: ${isAssignee} | IsCreator: ${isCreator} | IsApprover: ${isApprover}`);
        console.log(`=> Can Work: ${canWork} | Can Decide: ${canDecide}`);
        console.log(`------------------------------`);

        // ==================================================================================
        // 2. CỔNG BẢO VỆ (GATEKEEPER)
        // ==================================================================================

        // CỔNG 1: KIỂM TRA QUYỀN LÀM VIỆC
        // Áp dụng cho: APPROVE (khi trạng thái là NEW - tức là nút "Tiếp nhận") và COMPLETE_REPORT
        if (action === 'COMPLETE_REPORT' || (action === 'APPROVE' && selectedTicket.status === 'NEW')) {
            if (!canWork) {
                alert("⛔ QUYỀN HẠN CHẾ: Chỉ người tạo phiếu hoặc người có tên trong danh sách xử lý (Assignee) mới được phép Tiếp nhận/Báo cáo.");
                return;
            }
        }

        // CỔNG 2: KIỂM TRA QUYỀN QUYẾT ĐỊNH
        // Áp dụng cho: FINALIZE (Đạt), REJECT (Không đạt), CLOSE (Hủy bỏ)
        // Lưu ý: Nút APPROVE ở các trạng thái khác (nếu có) cũng có thể coi là quyết định, nhưng ở đây ta bám sát flow.
        if (action === 'FINALIZE' || action === 'REJECT' || action === 'CLOSE') {
            if (!canDecide) {
                // Lấy tên người duyệt để thông báo
                const approverName = employees.find(e => String(e.id) === finalApproverId)?.fullName || "Người được cấu hình duyệt";
                alert(`⛔ QUYỀN HẠN CHẾ: Thao tác Duyệt/Hủy chỉ dành cho Người tạo phiếu hoặc Người duyệt (${approverName}).`);
                return;
            }
        }

        // ==================================================================================
        // 3. THỰC THI LOGIC (EXECUTION)
        // ==================================================================================

        setIsProcessingAction(true);
        try {
            // --- HỦY BỎ (CLOSE) ---
            if (action === 'CLOSE') {
                if (confirm("Bạn có chắc chắn muốn hủy bỏ yêu cầu này không?")) {
                    await updateTicketStatus(selectedTicket.id, 'CANCELLED', currentUser);
                    await addTicketComment(selectedTicket.id, `[ĐÃ HỦY] Yêu cầu đã bị hủy bởi ${currentUser.name}.`, currentUser);
                } else {
                    setIsProcessingAction(false);
                    return;
                }
            }
            
            // --- TỪ CHỐI / KHÔNG ĐẠT (REJECT) ---
            else if (action === 'REJECT') { 
                const reason = prompt("Vui lòng nhập lý do từ chối / Yêu cầu làm lại:");
                if (!reason) { setIsProcessingAction(false); return; }
                
                // Nếu đang Mới (NEW) -> Hủy luôn (Từ chối duyệt)
                if (selectedTicket.status === 'NEW') {
                    await updateTicketStatus(selectedTicket.id, 'CANCELLED', currentUser);
                    await addTicketComment(selectedTicket.id, `[TỪ CHỐI DUYỆT] Lý do: ${reason}`, currentUser);
                } 
                // Nếu đang chờ duyệt (WAITING_REVIEW) -> Quay lại In Progress (Làm lại)
                else {
                    await updateTicketStatus(selectedTicket.id, 'IN_PROGRESS', currentUser); 
                    await addTicketComment(selectedTicket.id, `[KHÔNG ĐẠT / YÊU CẦU LÀM LẠI] ${reason}`, currentUser);
                }
            } 
            
            // --- BÁO CÁO (MỞ MODAL) ---
            else if (action === 'COMPLETE_REPORT') {
                setCompletionNote('');
                setCompletionAttachments([]);
                setShowCompletionModal(true);
                setIsProcessingAction(false);
                return; // Dừng để user nhập liệu
            } 
            
            // --- DUYỆT / ĐẠT (MỞ MODAL ĐÁNH GIÁ) ---
            else if (action === 'FINALIZE') { 
                setRatingVal(5);
                setRatingComment('');
                setShowRatingModal(true);
                setIsProcessingAction(false);
                return; // Dừng để user nhập liệu
            } 
            
            // --- TIẾP NHẬN (APPROVE) ---
            else if (action === 'APPROVE') {
                // Chuyển trạng thái sang Đang xử lý
                await updateTicketStatus(selectedTicket.id, 'IN_PROGRESS', currentUser);
                // Log comment
                await addTicketComment(selectedTicket.id, `[ĐÃ TIẾP NHẬN] ${currentUser.name} bắt đầu xử lý.`, currentUser);
            }

            // Reload dữ liệu sau khi thực hiện xong
            await loadData();
            
            // Cập nhật lại state của ticket đang chọn để UI render đúng
            const updatedList = await fetchTickets();
            const freshItem = updatedList.find(t => t.id === selectedTicket.id);
            if (freshItem) setSelectedTicket(freshItem);

        } catch (error: any) {
            console.error("Action Error:", error);
            alert("Lỗi hệ thống: " + error.message);
        } finally {
            setIsProcessingAction(false);
        }
    };

    const handleUpdateTicketDetails = async () => {
        if (!selectedTicket) return;
        const updated = {
            ...selectedTicket,
            assigneeIds: editAssigneeIds,
            slaDeadline: editDeadline ? new Date(editDeadline).toISOString() : selectedTicket.slaDeadline
        };
        await updateTicket(updated);
        await addTicketComment(selectedTicket.id, "Đã cập nhật thông tin xử lý (Người thực hiện / Hạn chót)", currentUser);
        setSelectedTicket(updated);
        setIsEditingTicket(false);
        loadData();
    };

    const handleSubmitCompletionReport = async () => {
        if (!selectedTicket) return;
        try {
            const comment = `[BÁO CÁO HOÀN THÀNH] ${completionNote}`;
            await addTicketComment(selectedTicket.id, comment, currentUser, completionAttachments);
            await updateTicketStatus(selectedTicket.id, 'WAITING_REVIEW', currentUser);
            
            setShowCompletionModal(false);
            alert("Đã gửi báo cáo hoàn thành. Vui lòng chờ kiểm tra.");
            
            await loadData();
            const updatedList = await fetchTickets();
            const freshItem = updatedList.find(t => t.id === selectedTicket.id);
            if (freshItem) setSelectedTicket(freshItem);
        } catch (error: any) {
            alert(error.message);
        }
    };

    const handleConfirmRating = async () => {
        if (!selectedTicket) return;
        try {
            await updateTicketStatus(selectedTicket.id, 'COMPLETED', currentUser, ratingVal, ratingComment);
            setShowRatingModal(false);
            
            await loadData();
            const updatedList = await fetchTickets();
            const freshItem = updatedList.find(t => t.id === selectedTicket.id);
            if (freshItem) setSelectedTicket(freshItem);
        } catch (error: any) {
            alert(error.message);
        }
    };

    const handleSendReminder = async () => {
        if (!selectedTicket) return;
        try {
            await sendTicketReminder(selectedTicket.id, currentUser);
            alert("Đã gửi nhắc nhở thành công!");
            await loadData();
            const updated = await fetchTickets();
            const fresh = updated.find(t => t.id === selectedTicket.id);
            if(fresh) setSelectedTicket(fresh);
        } catch (e: any) {
            alert(e.message);
        }
    };

    const handleSendComment = async () => {
        if (!selectedTicket || (!commentText && commentAttachments.length === 0)) return;
        setIsSendingComment(true);
        await addTicketComment(selectedTicket.id, commentText, currentUser, commentAttachments);
        setCommentText('');
        setCommentAttachments([]);
        await loadData();
        const freshTickets = await fetchTickets();
        setTickets(freshTickets);
        const freshSelected = freshTickets.find(t => t.id === selectedTicket.id);
        if (freshSelected) setSelectedTicket(freshSelected);
        setIsSendingComment(false);
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !selectedTicket) return;
        const att = await uploadFileToDrive(file);
        await addTicketComment(selectedTicket.id, "Đã tải lên tài liệu minh chứng.", currentUser, [att]);
        await loadData();
        const freshTickets = await fetchTickets();
        const freshSelected = freshTickets.find(t => t.id === selectedTicket.id);
        if (freshSelected) setSelectedTicket(freshSelected);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const handleCompletionFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const att = await uploadFileToDrive(file);
        setCompletionAttachments(prev => [...prev, att]);
        if (e.target) e.target.value = '';
    };

    // --- HELPER RENDERS ---
    const getTicketSLAStatus = (ticket: Ticket) => {
        if (!ticket.slaDeadline) return null;
        const deadline = new Date(ticket.slaDeadline);
        const now = new Date();
        const timeLeft = deadline.getTime() - now.getTime();
        const hoursLeft = timeLeft / (1000 * 3600);
        
        if (timeLeft < 0) return { label: 'Quá hạn', color: 'text-red-600', bg: 'bg-red-50', icon: AlertCircle };
        if (hoursLeft < 4) return { label: 'Sắp hết hạn', color: 'text-orange-600', bg: 'bg-orange-50', icon: Clock };
        return { label: `Còn ${Math.ceil(hoursLeft)}h`, color: 'text-emerald-600', bg: 'bg-emerald-50', icon: CheckCircle2 };
    };

    const getEmpName = (id: string) => employees.find(e => e.id === id)?.fullName || id;

    // Config Helpers
    const addConfigItem = async () => {
        if (!newConfigItem.code || !newConfigItem.label) return alert("Vui lòng nhập Mã và Tên");
        
        try {
            if (configTab === 'TYPES') {
                const newType = { 
                    code: newConfigItem.code.toUpperCase(), 
                    label: newConfigItem.label, 
                    category: createCategory, // Lấy category từ tab hiện tại hoặc logic của bạn
                    sla: Number(newConfigItem.sla) || 0,
                    defaultApproverId: '' 
                };
                
                // GỌI API LƯU
                await saveTicketTypeConfig(newType);
                
                // Refresh list
                setTicketTypes(await fetchTicketTypesConfig());
            } else {
                const newDept = { 
                    code: newConfigItem.code.toUpperCase(), 
                    label: newConfigItem.label 
                };
                
                // GỌI API LƯU
                await saveDepartment(newDept);
                
                // Refresh list
                setDepartments(await fetchDepartments());
            }
            // Reset input
            setNewConfigItem({ code: '', label: '', sla: 0 });
            alert("Đã thêm thành công!");
        } catch (e) {
            alert("Lỗi khi lưu: " + e);
        }
    };

    const changeTypeApprover = (typeCode: string, approverId: string) => {
        const updatedTypes = ticketTypes.map(t => 
            t.code === typeCode ? { ...t, defaultApproverId: approverId } : t
        );
        setTicketTypes(updatedTypes);
    };

    const handleFormTypeChange = (newType: TicketType) => {
        const template = TICKET_TEMPLATES[newType];
        const isDefault = Object.values(TICKET_TEMPLATES).includes(formState.description || '');
        if (!formState.description || isDefault) {
            setFormState(prev => ({ ...prev, type: newType, description: template || '' }));
        } else {
            setFormState(prev => ({ ...prev, type: newType }));
        }
    };
    
    // Reminder Handlers
    const handleAddReminder = async () => {
        if (!newReminder.targetName || !newReminder.content) return;
        const r: ManualReminder = {
            id: `rem_${Date.now()}`,
            targetName: newReminder.targetName,
            content: newReminder.content,
            isDone: false,
            createdAt: new Date().toISOString()
        };
        saveManualReminder(r);
        setReminders(await getManualReminders());
        setNewReminder({ targetName: '', content: '' });
    };

    const handleToggleReminder = async (id: string) => {
        toggleReminderStatus(id);
        setReminders(await getManualReminders());
    };

    const handleDeleteReminder = async (id: string) => {
        deleteReminder(id);
        setReminders(await getManualReminders());
    };

    const handlePrintTicket = () => {
        if (!selectedTicket) return;
        const w = window.open('', '_blank');
        w?.document.write(`<html><head><title>In Phiếu</title></head><body><h2>${selectedTicket.title}</h2><p>${selectedTicket.description}</p></body></html>`);
        w?.print();
        w?.close();
    };

    const handlePrintAnalytics = () => {
        const w = window.open('', '_blank');
        const rows = dynamicEvaluations.map(e => `
            <tr>
                <td style="padding:5px; border:1px solid #ddd;">${getEmpName(e.empId)}</td>
                <td style="padding:5px; border:1px solid #ddd; text-align:center;">${e.activeTasks}</td>
                <td style="padding:5px; border:1px solid #ddd; text-align:center;">${e.totalResolved}</td>
                <td style="padding:5px; border:1px solid #ddd; text-align:center; color:red;">${e.overdueCount}</td>
                <td style="padding:5px; border:1px solid #ddd; text-align:center;">${e.avgRating.toFixed(1)}</td>
            </tr>
        `).join('');

        w?.document.write(`
            <html>
                <head>
                    <title>Báo cáo Hiệu suất</title>
                    <style>
                        body { font-family: sans-serif; padding: 20px; }
                        h1 { text-align: center; margin-bottom: 5px; }
                        p.meta { text-align: center; color: #666; font-size: 14px; margin-bottom: 20px; }
                        .summary-grid { display: flex; gap: 20px; margin-bottom: 30px; }
                        .card { border: 1px solid #ccc; padding: 15px; flex: 1; border-radius: 8px; }
                        table { width: 100%; border-collapse: collapse; }
                        th { background: #f0f0f0; text-align: center; padding: 8px; border: 1px solid #999; }
                        td { border: 1px solid #ccc; }
                    </style>
                </head>
                <body>
                    <h1>BÁO CÁO HIỆU SUẤT VẬN HÀNH</h1>
                    <p class="meta">
                        Thời gian: ${analyticsTimeMode === 'MONTH' ? `Tháng ${analyticsDate.getMonth()+1}/${analyticsDate.getFullYear()}` : `Quý ${Math.floor(analyticsDate.getMonth()/3)+1} / ${analyticsDate.getFullYear()}`} 
                        | Người lập: ${currentUser.name}
                    </p>
                    
                    <div class="summary-grid">
                        <div class="card">
                            <strong>Tổng yêu cầu</strong>
                            <div style="font-size:24px;">${dynamicStats.total}</div>
                        </div>
                        <div class="card">
                            <strong>Đúng hạn SLA</strong>
                            <div style="font-size:24px; color:green;">${dynamicStats.slaStatus.onTime}</div>
                        </div>
                        <div class="card">
                            <strong>Quá hạn</strong>
                            <div style="font-size:24px; color:red;">${dynamicStats.slaStatus.overdue}</div>
                        </div>
                    </div>

                    <h3>Chi tiết nhân sự</h3>
                    <table>
                        <thead>
                            <tr>
                                <th>Nhân viên</th>
                                <th>Đang xử lý</th>
                                <th>Đã hoàn thành</th>
                                <th>Quá hạn</th>
                                <th>Đánh giá (Sao)</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${rows}
                        </tbody>
                    </table>
                </body>
            </html>
        `);
        w?.print();
        w?.close();
    };

    return (
        <div className="h-full flex flex-col bg-[#f8fafc] -m-8 overflow-hidden font-sans relative">
            {/* 1. TOP HEADER & NAVIGATION */}
            <div className="bg-white border-b border-slate-200 px-6 py-4 shrink-0 z-20 shadow-sm flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-black text-slate-900 uppercase tracking-tighter">Trung tâm Điều hành & Xử lý</h1>
                    <p className="text-sm text-slate-500 font-medium">Quản lý toàn bộ yêu cầu, đề xuất và sự vụ trong doanh nghiệp.</p>
                </div>
                
                {/* MAIN TAB SWITCHER */}
                <div className="flex bg-slate-100 p-1 rounded-xl">
                    <button 
                        onClick={() => setActiveMainTab('OPERATIONS')} 
                        className={`flex items-center px-6 py-3 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${activeMainTab === 'OPERATIONS' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        <List size={16} className="mr-2"/> Vận hành
                    </button>
                    <button 
                        onClick={() => setActiveMainTab('ANALYTICS')} 
                        className={`flex items-center px-6 py-3 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${activeMainTab === 'ANALYTICS' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        <PieChart size={16} className="mr-2"/> Báo cáo & Thống kê
                    </button>
                </div>

                <div className="flex gap-2">
                     <button onClick={() => setShowReminderPanel(!showReminderPanel)} className={`p-2.5 rounded-xl transition-all border border-slate-200 shadow-sm ${showReminderPanel ? 'bg-orange-100 text-orange-600' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`} title="Sổ tay nhắc việc"><StickyNote size={18}/></button>
                     <button 
                        onClick={() => setShowConfig(true)} 
                        disabled={!isAdmin} // Ngăn không cho click nếu không phải Admin
                        title={!isAdmin ? "Chỉ Admin mới có quyền truy cập cấu hình" : "Cấu hình hệ thống"} // Tooltip giải thích
                        className={`p-2.5 rounded-xl border border-slate-200 shadow-sm transition-all 
                            ${!isAdmin 
                                ? 'bg-slate-50 text-slate-300 cursor-not-allowed opacity-60' // Style khi bị khóa (mờ, không click được)
                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200' // Style bình thường
                            }`}
                    >
                        <Settings size={18}/>
                    </button>
                     <button onClick={() => setIsCreateModalOpen(true)} className="flex items-center px-6 py-3 bg-indigo-600 text-white rounded-xl font-bold text-xs uppercase tracking-widest shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition-all active:scale-95">
                        <Plus size={18} className="mr-2"/> Tạo yêu cầu mới
                    </button>
                </div>
            </div>

            {/* MAIN CONTENT AREA */}
            <div className="flex-1 overflow-hidden flex relative">
                
                {/* --- TAB: OPERATIONS --- */}
                {activeMainTab === 'OPERATIONS' && (
                    <>
                        {/* LEFT: LIST & FILTERS */}
                        <div className="w-[450px] bg-white border-r border-slate-200 flex flex-col shrink-0 z-10 shadow-[4px_0_24px_rgba(0,0,0,0.02)]">
                            {/* ADVANCED FILTERS */}
                            <div className="p-4 border-b border-slate-100 space-y-4">
                                {/* Status Toggle (RESTORED TABS) */}
                                <div className="bg-slate-100 p-1 rounded-xl flex font-bold text-xs mb-2">
                                    <button onClick={() => setFilterStatus('ALL')} className={`flex-1 py-2 rounded-lg transition-all ${filterStatus === 'ALL' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500'}`}>Tất cả</button>
                                    <button onClick={() => setFilterStatus('ACTIVE')} className={`flex-1 py-2 rounded-lg transition-all ${filterStatus === 'ACTIVE' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500'}`}>Đang xử lý</button>
                                    <button onClick={() => setFilterStatus('DONE')} className={`flex-1 py-2 rounded-lg transition-all ${filterStatus === 'DONE' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500'}`}>Đã xong</button>
                                </div>

                                {/* Filters Grid */}
                                <div className="grid grid-cols-2 gap-2">
                                    <div className="relative">
                                        <select className="w-full bg-slate-50 border-none rounded-xl py-2 pl-3 pr-8 text-xs font-bold text-slate-700 outline-none appearance-none cursor-pointer" value={filterTimeMode} onChange={e => setFilterTimeMode(e.target.value as any)}>
                                            <option value="ALL">Mọi thời điểm</option>
                                            <option value="MONTH">Theo Tháng</option>
                                            <option value="QUARTER">Theo Quý</option>
                                            <option value="YEAR">Theo Năm</option>
                                        </select>
                                        <ChevronDown size={14} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"/>
                                    </div>
                                    
                                    {/* Dynamic Date Input */}
                                    {filterTimeMode !== 'ALL' && (
                                        <div className="relative">
                                            {filterTimeMode === 'MONTH' && <input type="month" className="w-full bg-slate-50 border-none rounded-xl py-2 px-3 text-xs font-bold outline-none" value={filterDate.toISOString().slice(0,7)} onChange={e => setFilterDate(new Date(e.target.value))} />}
                                            {filterTimeMode === 'YEAR' && <select className="w-full bg-slate-50 border-none rounded-xl py-2 px-3 text-xs font-bold outline-none" value={filterDate.getFullYear()} onChange={e => { const d = new Date(filterDate); d.setFullYear(Number(e.target.value)); setFilterDate(d); }}>{[2023,2024,2025,2026].map(y=><option key={y} value={y}>{y}</option>)}</select>}
                                            {filterTimeMode === 'QUARTER' && <select className="w-full bg-slate-50 border-none rounded-xl py-2 px-3 text-xs font-bold outline-none" value={Math.floor(filterDate.getMonth()/3)} onChange={e => { const d = new Date(filterDate); d.setMonth(Number(e.target.value)*3); setFilterDate(d); }}><option value={0}>Quý 1</option><option value={1}>Quý 2</option><option value={2}>Quý 3</option><option value={3}>Quý 4</option></select>}
                                        </div>
                                    )}

                                    <div className="relative col-span-2">
                                        <select className="w-full bg-slate-50 border-none rounded-xl py-2 pl-3 pr-8 text-xs font-bold text-slate-700 outline-none appearance-none cursor-pointer" value={filterCategory} onChange={e => setFilterCategory(e.target.value as any)}>
                                            <option value="ALL">Tất cả loại phiếu</option>
                                            <option value="APPROVAL">Phiếu Phê Duyệt (Nghỉ, Mua sắm, Thanh toán)</option>
                                            <option value="TASK">Phiếu Công Việc (IT, BOQ, Hồ sơ)</option>
                                        </select>
                                        <Filter size={14} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"/>
                                    </div>
                                    
                                    <div className="relative col-span-2">
                                        <select className="w-full bg-slate-50 border-none rounded-xl py-2 pl-3 pr-8 text-xs font-bold text-slate-700 outline-none appearance-none cursor-pointer" value={filterPerson} onChange={e => setFilterPerson(e.target.value)}>
                                            <option value="ALL">Tất cả nhân sự liên quan</option>
                                            <option value={currentUser.id}>Việc của tôi (My Tasks)</option>
                                            <optgroup label="Chọn nhân viên cụ thể">
                                                {employees.map(e => <option key={e.id} value={e.id}>{e.fullName}</option>)}
                                            </optgroup>
                                        </select>
                                        <User size={14} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"/>
                                    </div>
                                </div>

                                <div className="relative group">
                                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500"/>
                                    <input 
                                        className="w-full pl-9 pr-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-indigo-500 transition-all placeholder:text-slate-400"
                                        placeholder="Tìm theo mã, tiêu đề..."
                                        value={searchTerm}
                                        onChange={e => setSearchTerm(e.target.value)}
                                    />
                                </div>
                            </div>

                            <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-3 bg-slate-50/50">
                                {isLoading ? (
                                    <div className="flex flex-col items-center justify-center py-20 text-slate-400"><Loader2 className="animate-spin mb-2" size={24}/><span className="text-xs">Đang tải dữ liệu...</span></div>
                                ) : filteredTickets.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center py-20 text-slate-400 opacity-60">
                                        <Inbox size={48} className="mb-2"/>
                                        <span className="text-xs italic">Không có yêu cầu nào.</span>
                                    </div>
                                ) : (
                                    filteredTickets.map(t => {
                                        const priorityConfig = PRIORITIES.find(p => p.code === t.priority);
                                        const isRecurring = t.isRecurring;
                                        const sla = getTicketSLAStatus(t);
                                        // Dynamic check for Category if available, otherwise fallback to types
                                        const foundTypeConfig: any = ticketTypes.find((type: any) => type.code === t.type);
                                        const isApproval = foundTypeConfig 
                                            ? foundTypeConfig.category === 'APPROVAL' 
                                            : APPROVAL_TYPES.includes(t.type);
                                        return (
                                            <div 
                                                key={t.id} 
                                                onClick={() => setSelectedTicket(t)} 
                                                className={`bg-white p-4 rounded-xl border shadow-sm cursor-pointer hover:shadow-md transition-all group relative ${selectedTicket?.id === t.id ? 'border-indigo-500 ring-1 ring-indigo-100 bg-indigo-50/10' : t.isOverdue ? 'border-red-200 ring-1 ring-red-50' : 'border-slate-200 hover:border-indigo-300'}`}
                                            >
                                                <div className="flex justify-between items-start mb-2">
                                                    <div className="flex gap-2 items-center">
                                                        <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase border ${priorityConfig?.color}`}>{priorityConfig?.label}</span>
                                                        {isApproval && <span className="px-2 py-0.5 rounded text-[9px] font-black uppercase bg-pink-100 text-pink-700 border border-pink-200 flex items-center"><FileCheck size={8} className="mr-1"/> Xin Duyệt</span>}
                                                        {!isApproval && <span className="px-2 py-0.5 rounded text-[9px] font-black uppercase bg-indigo-100 text-indigo-700 border border-indigo-200 flex items-center"><Briefcase size={8} className="mr-1"/> Công việc</span>}
                                                        {isRecurring && <span className="px-2 py-0.5 rounded text-[9px] font-black uppercase bg-purple-100 text-purple-700 flex items-center"><RefreshCw size={8} className="mr-1"/> Auto</span>}
                                                    </div>
                                                    <div className="flex flex-col items-end">
                                                        {sla && (
                                                            <span className={`text-[9px] font-bold px-2 py-0.5 rounded flex items-center mb-1 ${sla.bg} ${sla.color}`}>
                                                                <sla.icon size={8} className="mr-1"/> {sla.label}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                                <h4 className={`font-bold text-sm mb-2 line-clamp-2 ${selectedTicket?.id === t.id ? 'text-indigo-900' : 'text-slate-800'}`}>{t.title}</h4>
                                                <div className="flex justify-between items-center mt-3 pt-3 border-t border-slate-50">
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-5 h-5 rounded-full bg-slate-100 flex items-center justify-center text-[9px] font-bold text-slate-500 border border-white shadow-sm">{t.creatorName.charAt(0)}</div>
                                                        <span className="text-[10px] text-slate-500 font-medium truncate max-w-[100px]">{t.creatorName}</span>
                                                    </div>
                                                    <div className={`px-2 py-1 rounded-lg text-[9px] font-black uppercase ${t.status === 'COMPLETED' ? 'bg-emerald-50 text-emerald-600' : t.status === 'WAITING_REVIEW' ? 'bg-purple-50 text-purple-600' : t.status === 'NEW' ? 'bg-blue-50 text-blue-600' : 'bg-orange-50 text-orange-600'}`}>
                                                        {t.status === 'NEW' ? 'Mới' : t.status === 'IN_PROGRESS' ? 'Đang xử lý' : t.status === 'WAITING_REVIEW' ? 'Chờ kiểm tra' : 'Xong'}
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        </div>

                        {/* RIGHT: DETAIL VIEW */}
                        <div className="flex-1 bg-white flex flex-col h-full overflow-hidden">
                            {selectedTicket ? (
                                <>
                                    <div className="px-8 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                                        <div className="flex items-center gap-3">
                                            <span className="text-xs font-mono font-bold text-slate-500 bg-white px-2 py-1 rounded border border-slate-200">{selectedTicket.code}</span>
                                            <span className="text-xs text-slate-400">|</span>
                                            <div className="text-xs font-bold text-slate-700 flex items-center"><Clock size={14} className="mr-1 text-slate-400"/> {new Date(selectedTicket.createdAt).toLocaleString('vi-VN')}</div>
                                        </div>
                                        <div className="flex gap-2">
                                            {(currentUser.roleId === 'role_admin' || currentUser.roleId === 'role_manager') && selectedTicket.status !== 'COMPLETED' && (
                                                <button 
                                                    onClick={handleSendReminder}
                                                    className="px-3 py-1.5 bg-white border border-red-200 text-red-600 rounded-lg text-[10px] font-bold uppercase hover:bg-red-50 flex items-center shadow-sm"
                                                >
                                                    <Bell size={14} className="mr-1"/> Nhắc nhở
                                                </button>
                                            )}
                                            <button onClick={handlePrintTicket} className="p-2 text-slate-500 hover:text-indigo-600 hover:bg-white rounded-lg transition-all" title="In phiếu"><Printer size={18}/></button>
                                        </div>
                                    </div>

                                    <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                                        <div className="flex justify-between items-start mb-6">
                                            <h2 className="text-2xl font-black text-slate-900 leading-tight max-w-2xl">{selectedTicket.title}</h2>
                                            
                                            <div className="flex gap-2 shrink-0 animate-in slide-in-from-right duration-500">
                                                {/* COUNTDOWN TIMER */}
                                                {selectedTicket.slaDeadline && selectedTicket.status !== 'COMPLETED' && selectedTicket.status !== 'CANCELLED' && (
                                                    <CountdownTimer deadline={selectedTicket.slaDeadline} />
                                                )}
                                                {/* PROCESSING TIMER */}
                                                {selectedTicket.startedAt && selectedTicket.status !== 'COMPLETED' && selectedTicket.status !== 'CANCELLED' && (
                                                    <ProcessingTimer startTime={selectedTicket.startedAt} />
                                                )}
                                            </div>
                                            
                                            {selectedTicket.rating && (
                                                <div className="flex items-center gap-1 bg-yellow-50 text-yellow-600 px-3 py-1 rounded-full text-sm font-black border border-yellow-200">
                                                    {selectedTicket.rating} <Star size={14} fill="currentColor"/>
                                                </div>
                                            )}
                                        </div>

                                        {/* APPROVED INFO */}
                                        {selectedTicket.approvedBy && (
                                            <div className="mb-6 bg-emerald-50 border border-emerald-100 p-3 rounded-xl flex items-center gap-2">
                                                <CheckCircle2 size={16} className="text-emerald-600"/>
                                                <span className="text-xs font-bold text-emerald-800">
                                                    Đã được phê duyệt bởi {selectedTicket.approvedBy} vào {new Date(selectedTicket.approvedAt!).toLocaleString('vi-VN')}
                                                </span>
                                            </div>
                                        )}

                                        <div className="grid grid-cols-2 gap-6 mb-8 bg-slate-50 p-6 rounded-2xl border border-slate-100 relative group/edit">
                                            {/* EDIT BUTTON (Admin/Manager/Creator) */}
                                            {!isEditingTicket && (checkTicketPermission(selectedTicket, currentUser, 'EDIT') || checkTicketPermission(selectedTicket, currentUser, 'ASSIGN')) && (
                                                <button 
                                                    onClick={() => setIsEditingTicket(true)}
                                                    className="absolute top-4 right-4 p-2 bg-white text-indigo-600 rounded-lg shadow-sm border border-slate-200 opacity-0 group-hover/edit:opacity-100 transition-opacity hover:bg-indigo-50"
                                                    title="Chỉnh sửa người xử lý / Hạn chót"
                                                >
                                                    <Edit3 size={16}/>
                                                </button>
                                            )}

                                            <div>
                                                <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Người yêu cầu</p>
                                                <div className="flex items-center gap-2">
                                                    <div className="w-6 h-6 rounded-full bg-white flex items-center justify-center text-xs font-bold border border-slate-200">{selectedTicket.creatorName.charAt(0)}</div>
                                                    <span className="text-sm font-bold text-slate-800">{selectedTicket.creatorName}</span>
                                                </div>
                                            </div>

                                            <div>
                                                <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Người xử lý (Assignee)</p>
                                                {isEditingTicket ? (
                                                    <div className="space-y-2">
                                                        <Combobox<Employee>
                                                            label=""
                                                            placeholder="Chọn người xử lý..."
                                                            items={employees}
                                                            selectedItem={null}
                                                            onSelect={(emp) => !editAssigneeIds.includes(emp.id) && setEditAssigneeIds([...editAssigneeIds, emp.id])}
                                                            displayValue={e => e.fullName}
                                                            renderItem={e => <span>{e.fullName}</span>}
                                                            filterFunction={(e, q) => e.fullName.toLowerCase().includes(q.toLowerCase())}
                                                        />
                                                        <div className="flex flex-wrap gap-1">
                                                            {editAssigneeIds.map(id => (
                                                                <span key={id} className="text-xs bg-white border px-2 py-1 rounded flex items-center gap-1">
                                                                    {getEmpName(id)} <button onClick={() => setEditAssigneeIds(prev => prev.filter(pid => pid !== id))}><X size={12}/></button>
                                                                </span>
                                                            ))}
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div className="flex items-center gap-1 flex-wrap">
                                                        {selectedTicket.assigneeIds && selectedTicket.assigneeIds.length > 0 ? (
                                                            selectedTicket.assigneeIds.map(id => (
                                                                <span key={id} className="text-xs font-bold bg-white px-2 py-1 rounded border border-slate-200 text-slate-700">{getEmpName(id)}</span>
                                                            ))
                                                        ) : <span className="text-xs text-slate-400 italic">Chưa chỉ định</span>}
                                                    </div>
                                                )}
                                            </div>

                                            <div className="col-span-2">
                                                <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Mô tả chi tiết</p>
                                                <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{selectedTicket.description}</p>
                                            </div>

                                            {isEditingTicket && (
                                                <div className="col-span-2 border-t pt-4 mt-2">
                                                     <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Cập nhật hạn xử lý (Deadline)</label>
                                                     <input type="datetime-local" className="border p-2 rounded text-sm font-bold" value={editDeadline} onChange={e => setEditDeadline(e.target.value)} />
                                                     <div className="flex gap-2 mt-4 justify-end">
                                                         <button onClick={() => setIsEditingTicket(false)} className="px-4 py-2 text-xs font-bold text-slate-500 hover:bg-slate-100 rounded-lg">Hủy</button>
                                                         <button onClick={handleUpdateTicketDetails} className="px-4 py-2 text-xs font-bold bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">Lưu thay đổi</button>
                                                     </div>
                                                </div>
                                            )}

                                            {selectedTicket.completionCriteria && (
                                                <div className="col-span-2 pt-4 border-t border-slate-200">
                                                    <p className="text-[10px] font-bold text-indigo-500 uppercase mb-1 flex items-center"><Flag size={12} className="mr-1"/> Tiêu chí hoàn thành / Quy cách</p>
                                                    <div className="text-sm text-indigo-900 bg-indigo-50 p-3 rounded-lg border border-indigo-100">
                                                        {selectedTicket.completionCriteria}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                        
                                        {/* HISTORY LOGS */}
                                        <div className="space-y-6 mb-10">
                                            <h3 className="font-bold text-slate-800 text-sm uppercase tracking-widest border-b border-slate-100 pb-2">Tiến độ & Audit Log</h3>
                                            {(selectedTicket.history || []).map((log: any, idx: number) => (
                                                <div key={log.id || idx} className="flex gap-4">
                                                    <span className="text-[10px] font-bold text-slate-400 min-w-[120px] text-right mt-1">{new Date(log.timestamp).toLocaleString('vi-VN')}</span>
                                                    <div className="flex-1 pb-4 border-l-2 border-slate-100 pl-4 relative">
                                                        <div className="absolute -left-[5px] top-1.5 w-2 h-2 rounded-full bg-slate-200 border-2 border-white"></div>
                                                        <p className="text-xs font-bold text-slate-800"><span className="text-indigo-600">{log.actorName}</span> • {log.action}</p>
                                                        <p className="text-xs text-slate-500 mt-1">{log.details}</p>
                                                    </div>
                                                </div>
                                            ))}
                                            
                                            <h3 className="font-bold text-slate-800 text-sm uppercase tracking-widest border-b border-slate-100 pb-2 mt-6">Thảo luận & Tệp đính kèm</h3>
                                            {selectedTicket.comments.filter(c => !c.isSystemLog).map(c => (
                                                <div key={c.id} className="flex gap-4">
                                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${c.userId === currentUser.id ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-600'}`}>{c.userName.charAt(0)}</div>
                                                    <div className="flex-1">
                                                        <div className="flex items-baseline gap-2 mb-1">
                                                            <span className="font-bold text-xs text-slate-800">{c.userName}</span>
                                                            <span className="text-[10px] text-slate-400">{new Date(c.createdAt).toLocaleString('vi-VN')}</span>
                                                        </div>
                                                        <div className="bg-slate-50 p-3 rounded-tr-2xl rounded-br-2xl rounded-bl-2xl text-sm text-slate-700 inline-block max-w-[90%] border border-slate-100">{c.content}</div>
                                                        
                                                        {/* Attachments inside comments */}
                                                        {c.attachments && c.attachments.length > 0 && (
                                                            <div className="flex gap-2 mt-2">
                                                                {c.attachments.map((att, i) => (
                                                                    <a key={i} href={att.url} target="_blank" className="text-[10px] flex items-center bg-white border px-2 py-1 rounded text-indigo-600 hover:underline">
                                                                        <Paperclip size={10} className="mr-1"/> {att.name}
                                                                    </a>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="p-4 bg-white border-t border-slate-200">
                                        {/* Action Buttons */}
                                        {selectedTicket.status !== 'COMPLETED' && selectedTicket.status !== 'CANCELLED' && (
                                            <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
                                                {/* CASE 1: APPROVAL FLOW (NEW -> IN_PROGRESS) */}
                                                {selectedTicket.status === 'NEW' && APPROVAL_TYPES.includes(selectedTicket.type) && checkTicketPermission(selectedTicket, currentUser, 'APPROVE') && (
                                                    <>
                                                        <button disabled={isProcessingAction} onClick={() => handleQuickAction('APPROVE')} className="flex items-center px-4 py-2 bg-emerald-600 text-white rounded-lg text-xs font-bold hover:bg-emerald-700 transition-all whitespace-nowrap shadow-md disabled:opacity-50">
                                                            {isProcessingAction ? <Loader2 size={14} className="animate-spin mr-2"/> : <Check size={14} className="mr-2"/>} DUYỆT (Approve)
                                                        </button>
                                                        <button disabled={isProcessingAction} onClick={() => handleQuickAction('REJECT')} className="flex items-center px-4 py-2 bg-rose-50 text-rose-700 rounded-lg text-xs font-bold hover:bg-rose-100 transition-all whitespace-nowrap border border-rose-100 disabled:opacity-50">
                                                            <XCircle size={14} className="mr-2"/> KHÔNG DUYỆT
                                                        </button>
                                                    </>
                                                )}

                                                {/* CASE 2: WAITING REVIEW FLOW (WAITING_REVIEW -> FINALIZE) */}
                                                {checkTicketPermission(selectedTicket, currentUser, 'CLOSE') && selectedTicket.status === 'WAITING_REVIEW' && (
                                                    <>
                                                        <button disabled={isProcessingAction} onClick={() => handleQuickAction('FINALIZE')} className="flex items-center px-4 py-2 bg-emerald-600 text-white rounded-lg text-xs font-bold hover:bg-emerald-700 transition-all whitespace-nowrap shadow-md disabled:opacity-50">
                                                            <Check size={14} className="mr-2"/> Đạt (Duyệt xong)
                                                        </button>
                                                        <button disabled={isProcessingAction} onClick={() => handleQuickAction('REJECT')} className="flex items-center px-4 py-2 bg-rose-50 text-rose-700 rounded-lg text-xs font-bold hover:bg-rose-100 transition-all whitespace-nowrap disabled:opacity-50">
                                                            <Undo2 size={14} className="mr-2"/> Không đạt (Làm lại)
                                                        </button>
                                                    </>
                                                )}

                                                {/* CASE 3: TASK FLOW (NEW/IN_PROGRESS -> WORK) */}
                                                {checkTicketPermission(selectedTicket, currentUser, 'EDIT') && selectedTicket.status !== 'WAITING_REVIEW' && !((selectedTicket.status === 'NEW' && APPROVAL_TYPES.includes(selectedTicket.type))) && (
                                                    <>
                                                        {selectedTicket.status === 'NEW' && !APPROVAL_TYPES.includes(selectedTicket.type) && (
                                                            <button disabled={isProcessingAction} onClick={() => handleQuickAction('APPROVE')} className="flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg text-xs font-bold hover:bg-indigo-700 transition-all whitespace-nowrap disabled:opacity-50 shadow-md"><ArrowRight size={14} className="mr-2"/> Tiếp nhận / Xử lý</button>
                                                        )}
                                                        {selectedTicket.status === 'IN_PROGRESS' && (
                                                            <button disabled={isProcessingAction} onClick={() => handleQuickAction('COMPLETE_REPORT')} className="flex items-center px-4 py-2 bg-purple-600 text-white rounded-lg text-xs font-bold hover:bg-purple-700 transition-all whitespace-nowrap shadow-md disabled:opacity-50">
                                                                <CheckCircle2 size={14} className="mr-2"/> Báo cáo Hoàn thành
                                                            </button>
                                                        )}
                                                    </>
                                                )}
                                                
                                                {checkTicketPermission(selectedTicket, currentUser, 'CLOSE') && (
                                                    <button disabled={isProcessingAction} onClick={() => handleQuickAction('CLOSE')} className="flex items-center px-4 py-2 bg-slate-100 text-slate-600 rounded-lg text-xs font-bold hover:bg-slate-200 transition-all whitespace-nowrap disabled:opacity-50"><XCircle size={14} className="mr-2"/> Hủy bỏ</button>
                                                )}
                                            </div>
                                        )}
                                        <div className="flex gap-3 items-end">
                                            <div className="flex-1 relative">
                                                <textarea className="w-full bg-slate-50 border-none rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none resize-none min-h-[50px]" placeholder="Nhập nội dung trao đổi..." value={commentText} onChange={e => setCommentText(e.target.value)} onKeyDown={e => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSendComment())}/>
                                                <button onClick={() => fileInputRef.current?.click()} className="absolute right-3 bottom-3 text-slate-400 hover:text-indigo-600"><Paperclip size={18}/></button>
                                                <input ref={fileInputRef} type="file" className="hidden" multiple onChange={(e) => {
                                                    if (e.target.files?.length) {
                                                        const file = e.target.files[0];
                                                        const att: Attachment = { id: `tmp_${Date.now()}`, name: file.name, type: file.type.includes('image')?'IMAGE':'OTHER', url: URL.createObjectURL(file) };
                                                        setCommentAttachments([att]);
                                                        handleFileUpload(e);
                                                    }
                                                }} />
                                            </div>
                                            <button onClick={handleSendComment} disabled={!commentText} className="bg-indigo-600 text-white p-3 rounded-xl hover:bg-indigo-700 shadow-lg disabled:opacity-50 transition-all mb-1">{isSendingComment ? <Loader2 size={20} className="animate-spin"/> : <Send size={20}/>}</button>
                                        </div>
                                    </div>
                                </>
                            ) : (
                                <div className="flex flex-col items-center justify-center h-full text-slate-300">
                                    <Inbox size={64} className="mb-4 opacity-50"/>
                                    <p className="font-bold text-sm">Chọn một yêu cầu để xem chi tiết</p>
                                </div>
                            )}
                        </div>
                    </>
                )}

                {/* --- TAB: ANALYTICS --- */}
                {activeMainTab === 'ANALYTICS' && dynamicStats && (
                    <div className="flex-1 overflow-y-auto p-10 bg-[#f8fafc] animate-in fade-in">
                        <div className="max-w-6xl mx-auto space-y-8">
                            <div className="flex justify-between items-center mb-2">
                                <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight flex items-center">
                                    <BarChart3 className="mr-2 text-indigo-600"/> Dashboard Thống Kê Hiệu Suất
                                </h2>
                                <button onClick={() => {
                                    const w = window.open('', '_blank');
                                    if(w) {
                                        const rows = dynamicEvaluations.map(e => `
                                            <tr>
                                                <td style="padding:5px; border:1px solid #ddd;">${getEmployees().then(list => list.find(emp => emp.id === e.empId)?.fullName) || e.empId}</td>
                                                <td style="padding:5px; border:1px solid #ddd; text-align:center;">${e.activeTasks}</td>
                                                <td style="padding:5px; border:1px solid #ddd; text-align:center;">${e.totalResolved}</td>
                                                <td style="padding:5px; border:1px solid #ddd; text-align:center; color:red;">${e.overdueCount}</td>
                                                <td style="padding:5px; border:1px solid #ddd; text-align:center;">${e.avgRating.toFixed(1)}</td>
                                            </tr>
                                        `).join('');
                                        
                                        w.document.write(`
                                            <html>
                                                <head><title>Báo cáo Hiệu suất</title></head>
                                                <body>
                                                    <h1>BÁO CÁO HIỆU SUẤT VẬN HÀNH</h1>
                                                    <table style="width:100%; border-collapse:collapse;">
                                                        <thead>
                                                            <tr>
                                                                <th style="border:1px solid #000; padding:5px;">Nhân viên</th>
                                                                <th style="border:1px solid #000; padding:5px;">Đang xử lý</th>
                                                                <th style="border:1px solid #000; padding:5px;">Đã hoàn thành</th>
                                                                <th style="border:1px solid #000; padding:5px;">Quá hạn</th>
                                                                <th style="border:1px solid #000; padding:5px;">Đánh giá</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody>${rows}</tbody>
                                                    </table>
                                                </body>
                                            </html>
                                        `);
                                        w.print();
                                        w.close();
                                    }
                                }} className="flex items-center px-4 py-2 bg-slate-800 text-white rounded-xl font-bold text-[10px] uppercase hover:bg-slate-700 shadow-lg transition-all">
                                    <Printer size={14} className="mr-2"/> In Báo Cáo
                                </button>
                            </div>

                            {/* ANALYTICS FILTERS */}
                            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-4 items-center">
                                <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2">
                                    <Calendar size={16} className="text-slate-400"/>
                                    <select className="bg-transparent text-sm font-bold text-slate-700 outline-none cursor-pointer" value={analyticsTimeMode} onChange={e => setAnalyticsTimeMode(e.target.value as any)}>
                                        <option value="MONTH">Theo Tháng</option>
                                        <option value="QUARTER">Theo Quý</option>
                                        <option value="YEAR">Theo Năm</option>
                                    </select>
                                    <div className="w-px h-4 bg-slate-300 mx-2"></div>
                                    {analyticsTimeMode === 'MONTH' && <input type="month" className="bg-transparent text-sm font-bold outline-none" value={analyticsDate.toISOString().slice(0,7)} onChange={e => setAnalyticsDate(new Date(e.target.value))} />}
                                    {analyticsTimeMode === 'YEAR' && <select className="bg-transparent text-sm font-bold outline-none" value={analyticsDate.getFullYear()} onChange={e => { const d = new Date(analyticsDate); d.setFullYear(Number(e.target.value)); setAnalyticsDate(d); }}>{[2023,2024,2025,2026].map(y=><option key={y} value={y}>{y}</option>)}</select>}
                                    {analyticsTimeMode === 'QUARTER' && <select className="bg-transparent text-sm font-bold outline-none" value={Math.floor(analyticsDate.getMonth()/3)} onChange={e => { const d = new Date(analyticsDate); d.setMonth(Number(e.target.value)*3); setAnalyticsDate(d); }}><option value={0}>Quý 1</option><option value={1}>Quý 2</option><option value={2}>Quý 3</option><option value={3}>Quý 4</option></select>}
                                </div>
                                <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 flex-1">
                                    <User size={16} className="text-slate-400"/>
                                    <select className="w-full bg-transparent text-sm font-bold text-slate-700 outline-none cursor-pointer" value={analyticsPersonFilter} onChange={e => setAnalyticsPersonFilter(e.target.value)}>
                                        <option value="ALL">Tất cả nhân sự</option>
                                        {employees.map(e => <option key={e.id} value={e.id}>{e.fullName}</option>)}
                                    </select>
                                </div>
                            </div>

                            {/* Summary Cards */}
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                                <div className="bg-white p-6 rounded-[24px] border border-slate-100 shadow-sm flex items-center justify-between">
                                    <div>
                                        <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Tổng Yêu Cầu</p>
                                        <h3 className="text-3xl font-black text-slate-900">{dynamicStats.total}</h3>
                                    </div>
                                    <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl"><List size={24}/></div>
                                </div>
                                <div className="bg-white p-6 rounded-[24px] border border-slate-100 shadow-sm flex items-center justify-between">
                                    <div>
                                        <p className="text-[10px] font-black uppercase text-emerald-600 tracking-widest">Đúng hạn SLA</p>
                                        <h3 className="text-3xl font-black text-emerald-600">{dynamicStats.slaStatus.onTime}</h3>
                                    </div>
                                    <div className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl"><CheckCircle2 size={24}/></div>
                                </div>
                                <div className="bg-white p-6 rounded-[24px] border border-slate-100 shadow-sm flex items-center justify-between">
                                    <div>
                                        <p className="text-[10px] font-black uppercase text-rose-600 tracking-widest">Quá hạn</p>
                                        <h3 className="text-3xl font-black text-rose-600">{dynamicStats.slaStatus.overdue}</h3>
                                    </div>
                                    <div className="p-3 bg-rose-50 text-rose-600 rounded-2xl"><AlertCircle size={24}/></div>
                                </div>
                                <div className="bg-white p-6 rounded-[24px] border border-slate-100 shadow-sm flex items-center justify-between">
                                    <div>
                                        <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Hài lòng TB</p>
                                        <h3 className="text-3xl font-black text-yellow-500 flex items-center">{dynamicStats.avgSatisfaction.toFixed(1)} <Star size={18} fill="currentColor" className="ml-1"/></h3>
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                                {/* Chart: Volume by Dept */}
                                <div className="bg-white p-8 rounded-[32px] border border-slate-100 shadow-sm h-[400px] flex flex-col">
                                    <h4 className="font-bold text-slate-800 text-sm uppercase tracking-widest mb-6">Khối lượng theo Phòng ban</h4>
                                    <div className="flex-1">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <RePieChart>
                                                <Pie data={dynamicStats.byDept} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                                                    {dynamicStats.byDept.map((entry: any, index: number) => (
                                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                                    ))}
                                                </Pie>
                                                <Tooltip />
                                                <Legend />
                                            </RePieChart>
                                        </ResponsiveContainer>
                                    </div>
                                </div>

                                {/* Chart: Top Projects */}
                                <div className="bg-white p-8 rounded-[32px] border border-slate-100 shadow-sm h-[400px] flex flex-col">
                                    <h4 className="font-bold text-slate-800 text-sm uppercase tracking-widest mb-6">Top Dự án phát sinh Ticket</h4>
                                    <div className="flex-1">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <BarChart data={dynamicStats.byProject} layout="vertical" margin={{ left: 20 }}>
                                                <CartesianGrid strokeDasharray="3 3" horizontal={false}/>
                                                <XAxis type="number" hide/>
                                                <YAxis dataKey="name" type="category" width={100} tick={{fontSize: 10, fontWeight: 'bold'}}/>
                                                <Tooltip />
                                                <Bar dataKey="value" fill="#6366f1" radius={[0, 10, 10, 0]} barSize={20}/>
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </div>
                                </div>
                            </div>

                            {/* Employee Performance Table */}
                            <div className="bg-white rounded-[32px] border border-slate-100 shadow-sm overflow-hidden">
                                <div className="px-8 py-6 border-b border-slate-50 flex justify-between items-center">
                                    <h4 className="font-bold text-slate-800 text-sm uppercase tracking-widest">Hiệu suất nhân sự</h4>
                                    <div className="text-xs text-slate-400 italic font-medium">Dữ liệu theo bộ lọc hiện tại</div>
                                </div>
                                <table className="w-full text-sm text-left">
                                    <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-xs">
                                        <tr>
                                            <th className="px-6 py-4">Nhân viên</th>
                                            <th className="px-6 py-4 text-center">Đang xử lý</th>
                                            <th className="px-6 py-4 text-center">Đã hoàn thành</th>
                                            <th className="px-6 py-4 text-center text-rose-600">Quá hạn</th>
                                            <th className="px-6 py-4 text-center">Đánh giá (Sao)</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-50">
                                        {dynamicEvaluations.map((e, idx) => (
                                            <tr key={idx} className="hover:bg-slate-50">
                                                <td className="px-6 py-4 font-bold text-slate-800">{getEmpName(e.empId)}</td>
                                                <td className="px-6 py-4 text-center font-bold text-blue-600">{e.activeTasks}</td>
                                                <td className="px-6 py-4 text-center font-bold text-emerald-600">{e.totalResolved}</td>
                                                <td className={`px-6 py-4 text-center font-bold ${e.overdueCount > 0 ? 'text-rose-600' : 'text-slate-300'}`}>{e.overdueCount}</td>
                                                <td className="px-6 py-4 text-center font-bold text-yellow-500">{e.avgRating > 0 ? e.avgRating.toFixed(1) : '-'}</td>
                                            </tr>
                                        ))}
                                        {dynamicEvaluations.length === 0 && (
                                            <tr><td colSpan={5} className="text-center py-10 text-slate-400 italic">Không có dữ liệu phù hợp.</td></tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* REMINDER PANEL (SIDEBAR) */}
            <div className={`fixed inset-y-0 right-0 w-80 bg-white shadow-2xl z-[150] transform transition-transform duration-300 ${showReminderPanel ? 'translate-x-0' : 'translate-x-full'}`}>
                <div className="h-full flex flex-col">
                    <div className="px-6 py-5 border-b flex justify-between items-center bg-slate-50">
                        <h3 className="font-black text-slate-800 uppercase flex items-center"><StickyNote size={18} className="mr-2 text-orange-500"/> Sổ tay nhắc việc</h3>
                        <button onClick={() => setShowReminderPanel(false)} className="text-slate-400 hover:text-slate-600"><X size={20}/></button>
                    </div>
                    <div className="p-4 border-b bg-white">
                        <input className="w-full p-2 border rounded mb-2 text-sm font-bold" placeholder="Việc cần làm..." value={newReminder.content} onChange={e=>setNewReminder({...newReminder, content: e.target.value})} onKeyDown={e=>e.key === 'Enter' && handleAddReminder()}/>
                        <input className="w-full p-2 border rounded mb-2 text-xs" placeholder="Ghi chú người liên quan (VD: Bảo vệ)..." value={newReminder.targetName} onChange={e=>setNewReminder({...newReminder, targetName: e.target.value})}/>
                        <button onClick={handleAddReminder} disabled={!newReminder.content} className="w-full py-2 bg-orange-500 text-white rounded font-bold text-xs uppercase hover:bg-orange-600">Thêm nhắc nhở</button>
                    </div>
                    <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar bg-slate-50/50">
                        {reminders.map(r => (
                            <div key={r.id} className={`p-3 bg-white rounded-xl border shadow-sm group ${r.isDone ? 'opacity-60 bg-slate-100' : 'border-orange-100'}`}>
                                <div className="flex justify-between items-start">
                                    <div className="flex items-start gap-2">
                                        <input type="checkbox" checked={r.isDone} onChange={() => handleToggleReminder(r.id)} className="mt-1 cursor-pointer"/>
                                        <div>
                                            <p className={`text-sm font-bold ${r.isDone ? 'line-through text-slate-500' : 'text-slate-800'}`}>{r.content}</p>
                                            {r.targetName && <span className="text-[10px] bg-slate-100 px-2 py-0.5 rounded text-slate-500 mt-1 inline-block">{r.targetName}</span>}
                                        </div>
                                    </div>
                                    <button onClick={() => handleDeleteReminder(r.id)} className="text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100"><Trash2 size={14}/></button>
                                </div>
                            </div>
                        ))}
                        {reminders.length === 0 && <p className="text-center text-slate-400 text-xs italic mt-10">Chưa có nhắc nhở nào.</p>}
                    </div>
                </div>
            </div>

            {/* COMPLETION REPORT MODAL */}
            {showCompletionModal && (
                <div className="fixed inset-0 z-[250] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm animate-in fade-in">
                     <div className="bg-white rounded-[32px] w-full max-w-lg shadow-2xl p-8 relative flex flex-col">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-black text-slate-900 flex items-center"><CheckCircle2 size={24} className="text-emerald-500 mr-2"/> Báo cáo Hoàn thành</h3>
                            <button onClick={() => setShowCompletionModal(false)} className="text-slate-400 hover:text-slate-600"><X size={24}/></button>
                        </div>
                        
                        <div className="space-y-4">
                            <div className="bg-blue-50 p-4 rounded-xl text-xs text-blue-800 border border-blue-100">
                                <p className="font-bold mb-1">Quy trình:</p>
                                <p>Phiếu sẽ chuyển sang trạng thái <b>"Chờ kiểm tra"</b>. Người yêu cầu sẽ đánh giá kết quả.</p>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Nội dung báo cáo / Ghi chú</label>
                                <textarea 
                                    className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl p-3 text-sm font-medium outline-none focus:border-indigo-500 h-32"
                                    placeholder="Đã hoàn thành theo yêu cầu..."
                                    value={completionNote}
                                    onChange={e => setCompletionNote(e.target.value)}
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Đính kèm minh chứng (Ảnh/File)</label>
                                <div className="border-2 border-dashed border-slate-200 rounded-xl p-4 flex flex-col items-center justify-center cursor-pointer hover:bg-slate-50 transition-colors relative">
                                    <input 
                                        type="file" 
                                        className="absolute inset-0 opacity-0 cursor-pointer"
                                        onChange={(e) => {
                                             if (e.target.files?.[0]) {
                                                 const file = e.target.files[0];
                                                 const att: Attachment = { id: `proof_${Date.now()}`, name: file.name, type: 'IMAGE', url: URL.createObjectURL(file) };
                                                 setCompletionAttachments(prev => [...prev, att]);
                                                 uploadFileToDrive(file).then(realAtt => {
                                                     setCompletionAttachments(prev => prev.map(a => a.id === att.id ? realAtt : a));
                                                 });
                                             }
                                        }}
                                    />
                                    <Upload size={24} className="text-slate-400 mb-2"/>
                                    <p className="text-xs text-slate-400">Nhấn để tải lên</p>
                                </div>
                                {completionAttachments.length > 0 && (
                                    <div className="mt-2 space-y-1">
                                        {completionAttachments.map((att, i) => (
                                            <div key={i} className="flex items-center justify-between text-xs bg-slate-50 p-2 rounded border border-slate-100">
                                                <span className="flex items-center"><Paperclip size={12} className="mr-1"/> {att.name}</span>
                                                <button onClick={() => setCompletionAttachments(prev => prev.filter((_, idx) => idx !== i))} className="text-red-500"><Trash2 size={12}/></button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="mt-6 flex gap-3">
                             <button onClick={() => setShowCompletionModal(false)} className="flex-1 py-3 text-slate-500 font-bold hover:bg-slate-50 rounded-xl">Hủy</button>
                             <button onClick={handleSubmitCompletionReport} className="flex-1 py-3 bg-purple-600 text-white font-bold rounded-xl shadow-lg hover:bg-purple-700">Gửi Báo Cáo</button>
                        </div>
                     </div>
                </div>
            )}

            {/* RATING MODAL */}
            {showRatingModal && (
                <div className="fixed inset-0 z-[250] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm animate-in fade-in">
                     <div className="bg-white rounded-[32px] w-full max-w-md shadow-2xl p-8 text-center relative">
                        <button onClick={() => setShowRatingModal(false)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600"><X size={20}/></button>
                        <h3 className="text-xl font-black text-slate-900 mb-2">Đánh giá kết quả</h3>
                        <p className="text-sm text-slate-500 mb-6">Mức độ hài lòng của bạn về việc xử lý yêu cầu này?</p>
                        
                        <div className="flex justify-center gap-2 mb-6">
                             {[1,2,3,4,5].map(star => (
                                 <button key={star} onClick={() => setRatingVal(star)} className={`hover:scale-110 transition-transform ${ratingVal >= star ? 'text-yellow-400 fill-yellow-400' : 'text-slate-200'}`}>
                                     <Star size={40}/>
                                 </button>
                             ))}
                        </div>
                        
                        <textarea 
                            className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl p-3 text-sm font-medium outline-none focus:border-indigo-500 mb-6"
                            placeholder="Nhận xét thêm (Tùy chọn)..."
                            rows={3}
                            value={ratingComment}
                            onChange={e => setRatingComment(e.target.value)}
                        />
                        
                        <button onClick={handleConfirmRating} className="w-full py-4 bg-emerald-600 text-white rounded-xl font-black uppercase text-xs tracking-widest shadow-lg hover:bg-emerald-700 transition-all">
                            Xác nhận Hoàn thành
                        </button>
                     </div>
                </div>
            )}

            {/* CREATE MODAL */}
            {isCreateModalOpen && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-white rounded-[32px] w-full max-w-2xl shadow-2xl flex flex-col max-h-[90vh]">
                        <div className="px-8 py-6 border-b border-slate-100 flex justify-between items-center">
                            <h3 className="font-black text-xl text-slate-900 uppercase tracking-tight">Tạo Yêu Cầu Mới</h3>
                            <button onClick={() => setIsCreateModalOpen(false)}><XCircle className="text-slate-400 hover:text-slate-600"/></button>
                        </div>
                        <div className="p-8 overflow-y-auto custom-scrollbar space-y-6">
                            
                            {/* CATEGORY TOGGLE */}
                            <div>
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Loại Phiếu</label>
                                <div className="flex bg-slate-100 p-1 rounded-xl">
                                    <button 
                                        onClick={() => setCreateCategory('APPROVAL')}
                                        className={`flex-1 flex items-center justify-center py-3 rounded-lg text-xs font-bold uppercase transition-all ${createCategory === 'APPROVAL' ? 'bg-pink-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-200'}`}
                                    >
                                        <FileCheck size={16} className="mr-2"/> Phiếu Xin Duyệt
                                    </button>
                                    <button 
                                        onClick={() => setCreateCategory('TASK')}
                                        className={`flex-1 flex items-center justify-center py-3 rounded-lg text-xs font-bold uppercase transition-all ${createCategory === 'TASK' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-200'}`}
                                    >
                                        <Briefcase size={16} className="mr-2"/> Phiếu Giao Việc
                                    </button>
                                </div>
                                <p className="text-[10px] text-slate-400 mt-2 italic">
                                    {createCategory === 'APPROVAL' 
                                        ? "Dùng để trình ký các đề xuất cần Sếp phê duyệt (Mua sắm, Nghỉ phép, Thanh toán...)" 
                                        : "Dùng để giao nhiệm vụ cho nhân viên hoặc bộ phận khác xử lý (IT, Hồ sơ, Báo giá...)"}
                                </p>
                            </div>

                            <div>
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Tiêu đề yêu cầu *</label>
                                <input 
                                    className="w-full border-2 border-slate-100 rounded-xl p-3 font-bold text-slate-800 outline-none focus:border-indigo-500" 
                                    autoFocus 
                                    value={formState.title || ''} 
                                    onChange={async (e) => {
                                        // 1. Lưu giá trị mới vào biến tạm
                                        const newVal = e.target.value;

                                        // 2. Cập nhật UI ngay lập tức
                                        setFormState({ ...formState, title: newVal });

                                        // 3. Xử lý await để lấy gợi ý
                                        try {
                                            const suggestions = await getRecurringSuggestions(newVal);
                                            setTitleSuggestions(suggestions);
                                        } catch (err) {
                                            console.error(err);
                                        }
                                    }}
                                    placeholder={createCategory === 'APPROVAL' ? "Ví dụ: Đề xuất mua máy in mới..." : "Ví dụ: Hỗ trợ cài đặt phần mềm..."}
                                />
                                {titleSuggestions.length > 0 && (
                                    <div className="flex flex-wrap gap-2 mt-2 animate-in fade-in">
                                        {titleSuggestions.map((s, i) => (
                                            <button key={i} onClick={() => setFormState({...formState, title: s})} className="bg-indigo-50 text-indigo-700 text-[10px] font-bold px-2 py-1 rounded-lg hover:bg-indigo-100">
                                                {s}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                            <div className="grid grid-cols-2 gap-6">
                                <div>
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Chi tiết loại yêu cầu</label>
                                    <div className="flex gap-2">
                                        <select 
                                            className="w-full border-2 border-slate-100 rounded-xl p-3 font-bold text-slate-800 outline-none focus:border-indigo-500 text-sm bg-white" 
                                            value={formState.type} 
                                            onChange={e => handleFormTypeChange(e.target.value as any)}
                                        >
                                            {ticketTypes
                                                .filter(t => (t as any).category === createCategory)
                                                .map(t => <option key={t.code} value={t.code}>{t.label}</option>)
                                            }
                                        </select>
                                        <button 
                                            onClick={handleAddTicketType}
                                            className="bg-indigo-100 text-indigo-700 p-3 rounded-xl hover:bg-indigo-200 transition-colors"
                                            title="Thêm loại mới"
                                        >
                                            <Plus size={16}/>
                                        </button>
                                    </div>
                                </div>
                                <div>
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Độ ưu tiên</label>
                                    <select className="w-full border-2 border-slate-100 rounded-xl p-3 font-bold text-slate-800 outline-none focus:border-indigo-500 text-sm bg-white" value={formState.priority} onChange={e => setFormState({...formState, priority: e.target.value as any})}>
                                        {PRIORITIES.map(p => <option key={p.code} value={p.code}>{p.label}</option>)}
                                    </select>
                                </div>
                            </div>
                            
                            <div>
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Phòng ban tiếp nhận</label>
                                <select className="w-full border-2 border-slate-100 rounded-xl p-3 font-bold text-slate-800 outline-none focus:border-indigo-500 text-sm bg-white" value={formState.departmentCode || ''} onChange={e => setFormState({...formState, departmentCode: e.target.value})}>
                                    <option value="">-- Chọn phòng ban --</option>
                                    {departments.map(d => <option key={d.code} value={d.code}>{d.label}</option>)}
                                </select>
                            </div>

                            <div>
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Người xử lý chính *</label>
                                <div className="border-2 border-slate-100 rounded-xl p-3 max-h-32 overflow-y-auto">
                                    <div className="grid grid-cols-2 gap-2">
                                        {employees.map(emp => (
                                            <label key={emp.id} className="flex items-center gap-2 cursor-pointer p-2 hover:bg-slate-50 rounded-lg transition-colors">
                                                <input type="checkbox" className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500" checked={formState.assigneeIds?.includes(emp.id)} onChange={(e) => { const current = formState.assigneeIds || []; if (e.target.checked) setFormState({...formState, assigneeIds: [...current, emp.id]}); else setFormState({...formState, assigneeIds: current.filter(id => id !== emp.id)}); }}/>
                                                <span className="text-xs font-bold text-slate-700">{emp.fullName}</span>
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            </div>
                            <div>
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Dự án liên quan (Tùy chọn)</label>
                                <select className="w-full border-2 border-slate-100 rounded-xl p-3 font-bold text-slate-800 outline-none focus:border-indigo-500 text-sm bg-white" value={formState.projectId || ''} onChange={e => setFormState({...formState, projectId: e.target.value})}>
                                    <option value="">-- Không chọn --</option>
                                    {projects.filter(p => p.status === 'ACTIVE').map(p => <option key={p.id} value={p.id}>{p.code} - {p.name}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Tiêu chí hoàn thành / Quy cách</label>
                                <textarea className="w-full border-2 border-slate-100 rounded-xl p-3 font-medium text-slate-700 outline-none focus:border-indigo-500 text-sm whitespace-pre-wrap bg-blue-50/50" rows={2} placeholder="Yêu cầu cụ thể để nghiệm thu..." value={formState.completionCriteria || ''} onChange={e => setFormState({...formState, completionCriteria: e.target.value})}/>
                            </div>
                            <div>
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Chi tiết yêu cầu</label>
                                <textarea className="w-full border-2 border-slate-100 rounded-xl p-3 font-medium text-slate-700 outline-none focus:border-indigo-500 text-sm whitespace-pre-wrap" rows={6} placeholder="Mô tả cụ thể vấn đề..." value={formState.description || ''} onChange={e => setFormState({...formState, description: e.target.value})}/>
                            </div>
                        </div>
                        <div className="p-6 border-t border-slate-100 bg-slate-50 flex justify-end gap-3 rounded-b-[32px]">
                            <button onClick={() => setIsCreateModalOpen(false)} className="px-6 py-3 text-slate-500 font-bold hover:bg-white rounded-xl transition-all">Hủy</button>
                            <button onClick={handleCreateTicket} className={`px-8 py-3 text-white rounded-xl font-black uppercase text-xs tracking-widest shadow-lg transition-all ${createCategory === 'APPROVAL' ? 'bg-pink-600 hover:bg-pink-700' : 'bg-indigo-600 hover:bg-indigo-700'}`}>Tạo Yêu Cầu</button>
                        </div>
                    </div>
                </div>
            )}

            {/* CONFIG MODAL */}
            {showConfig && (
                <div className="fixed inset-0 z-[250] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm animate-in fade-in">
                    {/* ... (Keep existing Config Modal code) ... */}
                    <div className="bg-white rounded-[32px] w-full max-w-5xl shadow-2xl flex flex-col max-h-[85vh]">
                        <div className="px-8 py-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                            <h3 className="font-black text-xl text-slate-900 uppercase">Cấu hình Hệ thống Yêu cầu</h3>
                            <button onClick={() => setShowConfig(false)} className="p-2 hover:bg-white rounded-full text-slate-400"><XCircle size={24}/></button>
                        </div>
                        
                        <div className="flex bg-slate-100 p-2 mx-8 mt-6 rounded-xl shrink-0">
                            <button onClick={() => setConfigTab('TYPES')} className={`flex-1 py-2.5 rounded-lg text-xs font-bold uppercase transition-all ${configTab === 'TYPES' ? 'bg-white text-indigo-700 shadow-md' : 'text-slate-500'}`}>Loại Yêu Cầu (Types)</button>
                            <button onClick={() => setConfigTab('DEPTS')} className={`flex-1 py-2.5 rounded-lg text-xs font-bold uppercase transition-all ${configTab === 'DEPTS' ? 'bg-white text-indigo-700 shadow-md' : 'text-slate-500'}`}>Phòng Ban (Departments)</button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                            {configTab === 'TYPES' && (
                                <div className="space-y-4">
                                    <div className="grid grid-cols-5 gap-4 mb-2 px-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                        <div className="col-span-1">Mã (Code)</div>
                                        <div className="col-span-2">Tên hiển thị</div>
                                        <div className="col-span-1">Người Duyệt Mặc Định</div>
                                        <div className="col-span-1">SLA (Giờ)</div>
                                    </div>
                                    {ticketTypes.map((type: any, idx) => (
                                        <div key={idx} className="grid grid-cols-5 gap-4 items-center bg-slate-50 p-3 rounded-xl border border-slate-100 group">
                                            <div className="col-span-1 font-mono text-xs font-bold text-slate-600">{type.code}</div>
                                            <div className="col-span-2 text-sm font-bold text-slate-800">{type.label}</div>
                                            <div className="col-span-1">
                                                <select 
                                                    className="w-full bg-white border border-slate-200 text-xs rounded p-1"
                                                    value={type.defaultApproverId || ''}
                                                    onChange={(e) => changeTypeApprover(type.code, e.target.value)}
                                                >
                                                    <option value="">-- Tấc Cả --</option>
                                                    {employees.map(e => <option key={e.id} value={e.id}>{e.fullName}</option>)}
                                                </select>
                                            </div>
                                            <div className="col-span-1 flex justify-between items-center">
                                                <span className="text-xs font-mono text-orange-600">{type.sla}h</span>
                                                <button onClick={async () => { 
                                                    if(confirm('Xóa loại yêu cầu này?')) { 
                                                        await deleteTicketTypeConfig(type.id || `type_${type.code}`);
                                                        setTicketTypes(await fetchTicketTypesConfig());
                                                    }
                                                }} className="text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100"><Trash2 size={16}/></button>
                                            </div>
                                        </div>
                                    ))}
                                    
                                    <div className="grid grid-cols-4 gap-4 items-end mt-4 pt-4 border-t border-slate-100">
                                        <div className="col-span-1">
                                            <input className="w-full border-2 border-slate-200 rounded-lg p-2 text-xs font-bold uppercase" placeholder="VD: IT_SUPPORT" value={newConfigItem.code} onChange={e=>setNewConfigItem({...newConfigItem, code: e.target.value})}/>
                                        </div>
                                        <div className="col-span-2">
                                            <input className="w-full border-2 border-slate-200 rounded-lg p-2 text-xs font-bold" placeholder="Tên loại yêu cầu..." value={newConfigItem.label} onChange={e=>setNewConfigItem({...newConfigItem, label: e.target.value})}/>
                                        </div>
                                        <div className="col-span-1 flex gap-2">
                                            <input type="number" className="w-16 border-2 border-slate-200 rounded-lg p-2 text-xs font-bold" placeholder="SLA" value={newConfigItem.sla} onChange={e=>setNewConfigItem({...newConfigItem, sla: Number(e.target.value)})}/>
                                            <button onClick={addConfigItem} className="flex-1 bg-indigo-600 text-white rounded-lg flex items-center justify-center hover:bg-indigo-700"><Plus size={16}/></button>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {configTab === 'DEPTS' && (
                                <div className="space-y-4">
                                     {departments.map((dept: any, idx) => (
                                        <div key={idx} className="flex justify-between items-center bg-slate-50 p-3 rounded-xl border border-slate-100 group">
                                            <div>
                                                <p className="text-sm font-bold text-slate-800">{dept.label}</p>
                                                <p className="text-[10px] font-mono text-slate-400">{dept.code}</p>
                                            </div>
                                            <button onClick={async () => { 
                                                if(confirm('Xóa phòng ban này?')) { 
                                                    await deleteDepartment(dept.id || `dept_${dept.code}`);
                                                    setDepartments(await fetchDepartments());
                                                }
                                            }} className="text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100"><Trash2 size={16}/></button>
                                        </div>
                                    ))}
                                    <div className="flex gap-4 items-end mt-4 pt-4 border-t border-slate-100">
                                        <div className="w-1/3">
                                            <input className="w-full border-2 border-slate-200 rounded-lg p-2 text-xs font-bold uppercase" placeholder="Mã PB (VD: MARKETING)" value={newConfigItem.code} onChange={e=>setNewConfigItem({...newConfigItem, code: e.target.value})}/>
                                        </div>
                                        <div className="flex-1">
                                            <input className="w-full border-2 border-slate-200 rounded-lg p-2 text-xs font-bold" placeholder="Tên phòng ban..." value={newConfigItem.label} onChange={e=>setNewConfigItem({...newConfigItem, label: e.target.value})}/>
                                        </div>
                                        <button onClick={addConfigItem} className="px-4 py-2 bg-indigo-600 text-white rounded-lg flex items-center justify-center hover:bg-indigo-700"><Plus size={16}/></button>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="p-6 border-t border-slate-100 flex justify-end">
                            <button onClick={saveConfig} className="bg-emerald-600 text-white px-8 py-3 rounded-xl font-bold text-xs uppercase shadow-lg hover:bg-emerald-700 flex items-center">
                                <Save size={16} className="mr-2"/> Lưu Cấu Hình
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default WorkflowManager;
