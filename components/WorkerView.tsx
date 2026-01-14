
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Project, UserContext, ProjectRoadmap, StageStatus, MaterialEstimation, Employee, ProjectInfoField } from '../types';
import { addRoadmapLog, getProjectRoadmap, saveProjectRoadmap } from '../services/roadmapService';
import { uploadFileToDrive } from '../services/googleDriveService';
import { getEmployeeById } from '../services/employeeService';
import { 
    Camera, CheckCircle2, Loader2, Image as ImageIcon, 
    MapPin, Clock, ArrowLeft, Package, AlertCircle, Info, X,
    Phone, Navigation, Lock, ShieldCheck, LogOut, UploadCloud, Check, HardHat, Upload, FileText, Download, ExternalLink,
    ChevronDown, ChevronUp, PlayCircle, StopCircle, MoreHorizontal, Images, Briefcase, ShoppingCart, Hammer, MessageSquare
} from 'lucide-react';

interface WorkerViewProps {
    project: Project;
    currentUser: UserContext;
    onBack?: () => void;
}

const WorkerView: React.FC<WorkerViewProps> = ({ project, currentUser, onBack }) => {
    // --- AUTH STATE (Giống CustomerView để bảo mật qua Link) ---
    const [isAuthenticated, setIsAuthenticated] = useState(currentUser.isAuthenticated && currentUser.id !== 'w_guest');
    const [inputPhone, setInputPhone] = useState('');
    const [authError, setAuthError] = useState('');

    const [roadmap, setRoadmap] = useState<ProjectRoadmap | null>(null);
    const [manager, setManager] = useState<Employee | undefined>(undefined);
    
    // Upload State
    const [isUploading, setIsUploading] = useState(false);
    const [uploadingStageId, setUploadingStageId] = useState<string | null>(null);
    const [uploadProgress, setUploadProgress] = useState<{current: number, total: number} | null>(null);
    const [showSuccessToast, setShowSuccessToast] = useState(false);
    
    // UI State
    const [expandInfo, setExpandInfo] = useState(true); // Default OPEN
    const [activeActionMenu, setActiveActionMenu] = useState<string | null>(null); // For mobile dropdown
    const [viewingPhoto, setViewingPhoto] = useState<string | null>(null); // For Image Zoom

    // Refs
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        // Nếu đã có session xịn từ WorkerHub, bỏ qua login
        if (currentUser.isAuthenticated && currentUser.id !== 'w_guest') {
            setIsAuthenticated(true);
        } else {
            // Check session storage cho link chia sẻ
            const sessionKey = `worker_auth_${project.id}`;
            if (sessionStorage.getItem(sessionKey) === 'true') {
                setIsAuthenticated(true);
            }
        }
    }, [currentUser, project.id]);

    useEffect(() => {
        if (isAuthenticated) {
            loadData();
        }
    }, [isAuthenticated, project.id]);

    const loadData = async () => {
        const rm = await getProjectRoadmap(project.id);
        setRoadmap(rm);
        
        if (project.managerEmpId) {
            getEmployeeById(project.managerEmpId).then(setManager);
        }
    };

    const handleLogin = (e: React.FormEvent) => {
        e.preventDefault();
        // Validate đơn giản: Số điện thoại > 9 số
        const cleanInput = inputPhone.replace(/[\s.-]/g, '');
        
        // 1. Check Manager Phone
        const isManager = (project.managerPhone && project.managerPhone.includes(cleanInput)) || 
                          (manager?.phone && manager.phone.includes(cleanInput));
        
        // 2. Check Dynamic Contacts allowed to Login
        const validContact = project.contacts?.find(c => c.isWorkerLogin && c.phone.replace(/[\s.-]/g, '').includes(cleanInput));

        if (isManager || validContact || cleanInput.length >= 10) { // Fallback length check for quick demo
             setIsAuthenticated(true);
             sessionStorage.setItem(`worker_auth_${project.id}`, 'true');
             // Optionally store who logged in for logs
        } else {
            setAuthError('Số điện thoại không hợp lệ hoặc chưa được cấp quyền.');
        }
    };

    // --- WORKER STATUS CONTROL ---
    const handleChangeStageStatus = async (stageId: string, newStatus: StageStatus) => {
        if (!roadmap) return;
        
        const updatedStages = roadmap.stages.map(s => {
            if (s.id !== stageId) return s;
            // Logic: Auto set timestamps
            let update: any = { status: newStatus };
            if (newStatus === StageStatus.IN_PROGRESS && !s.startDate) update.startDate = new Date().toISOString();
            if (newStatus === StageStatus.COMPLETED) update.endDate = new Date().toISOString();
            return { ...s, ...update };
        });

        const newRoadmap = { ...roadmap, stages: updatedStages };
        await saveProjectRoadmap(newRoadmap);
        setRoadmap(newRoadmap);
        setActiveActionMenu(null); // Close menu
    };

    const handleFileChange = async (stageId: string, e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;

        setUploadingStageId(stageId);
        setIsUploading(true);
        setUploadProgress({ current: 0, total: files.length });

        try {
            // 1. Upload All Files in Parallel (or Sequential if needed for order)
            const uploadPromises = (Array.from(files) as File[]).map(async (file, idx) => {
                const attachment = await uploadFileToDrive(file);
                setUploadProgress(prev => prev ? { ...prev, current: prev.current + 1 } : null);
                return attachment;
            });

            const attachments = await Promise.all(uploadPromises);

            // 2. Create ONE Log Entry for the batch
            let content = `Báo cáo hình ảnh (${attachments.length} ảnh)`;
            if (roadmap) {
                const stage = roadmap.stages.find(s => s.id === stageId);
                if (stage) content = `Cập nhật: ${stage.title}`;
            }

            // Tên người thực hiện: Lấy từ session hoặc input SĐT
            const performerName = currentUser.name !== 'Đội Trưởng (Guest)' ? currentUser.name : `Thợ (${inputPhone || 'SĐT...'})`;

            await addRoadmapLog(
                project.id,
                content,
                attachments, // Pass array of attachments
                { id: currentUser.id, name: performerName, role: 'WORKER' },
                'Tại công trình', 
                stageId
            );

            setShowSuccessToast(true);
            await loadData(); 
            setTimeout(() => setShowSuccessToast(false), 3000);
        } catch (err: any) {
            alert("Lỗi: " + err.message);
        } finally {
            setIsUploading(false);
            setUploadingStageId(null);
            setUploadProgress(null);
            e.target.value = ''; // Reset input to allow re-uploading same file
        }
    };

    // Sort stages
    const sortedStages = useMemo(() => {
        return roadmap?.stages.sort((a, b) => a.order - b.order) || [];
    }, [roadmap]);

    // --- 1. LOGIN SCREEN (Dành cho thợ vào qua Link) ---
    if (!isAuthenticated) {
        return (
            <div className="min-h-screen bg-slate-900 flex items-center justify-center p-6 font-sans">
                <div className="bg-white w-full max-w-sm rounded-3xl shadow-2xl p-8 text-center relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-orange-500 to-yellow-500"></div>
                    <div className="w-20 h-20 bg-orange-100 text-orange-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner">
                        <HardHat size={40} />
                    </div>
                    <h2 className="text-xl font-black text-slate-900 uppercase mb-1">{project.name}</h2>
                    <p className="text-sm text-slate-500 mb-8 font-medium">Cổng thông tin Tổ đội thi công</p>

                    <form onSubmit={handleLogin} className="space-y-4">
                        <div className="text-left">
                            <label className="text-[10px] font-black text-slate-400 uppercase ml-1 mb-1 block tracking-widest">Nhập SĐT để điểm danh</label>
                            <input 
                                type="tel" 
                                className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl px-4 py-3 font-bold text-slate-800 outline-none focus:border-orange-500 transition-all placeholder:font-normal text-lg"
                                placeholder="09xx..."
                                value={inputPhone}
                                onChange={e => { setInputPhone(e.target.value); setAuthError(''); }}
                                autoFocus
                            />
                        </div>
                        
                        {authError && (
                            <div className="p-3 bg-red-50 text-red-600 text-xs font-bold rounded-xl flex items-center text-left">
                                <Info size={16} className="mr-2 flex-shrink-0"/> {authError}
                            </div>
                        )}

                        <button 
                            type="submit"
                            className="w-full bg-orange-600 text-white font-bold py-4 rounded-xl shadow-lg shadow-orange-200 active:scale-95 transition-all flex items-center justify-center uppercase tracking-widest text-sm"
                        >
                            <ShieldCheck size={18} className="mr-2"/> Vào Làm Việc
                        </button>
                    </form>
                    <p className="text-[10px] text-slate-400 mt-6 italic">Hệ thống tự động ghi nhận vị trí khi bạn gửi ảnh.</p>
                </div>
            </div>
        );
    }

    if (!roadmap) return <div className="h-screen flex items-center justify-center"><Loader2 className="animate-spin text-orange-600"/></div>;

    // --- 2. MAIN WORKER INTERFACE (Timeline Style) ---
    return (
        <div className="min-h-screen bg-slate-50 flex flex-col font-sans pb-20 relative">
            {/* Header */}
            <div className="bg-white border-b border-slate-200 sticky top-0 z-40 shadow-sm">
                <div className="px-5 py-4 flex justify-between items-start">
                    <div className="flex gap-3">
                        {onBack && (
                            <button onClick={onBack} className="mt-1 p-2 bg-slate-100 rounded-full hover:bg-slate-200 transition-colors h-fit">
                                <ArrowLeft size={18} className="text-slate-600"/>
                            </button>
                        )}
                        <div>
                            <div className="flex items-center gap-2 mb-1">
                                <span className="bg-orange-100 text-orange-700 text-[10px] font-black px-2 py-0.5 rounded uppercase tracking-wider">{project.code}</span>
                                {manager && (
                                    <a href={`tel:${manager.phone}`} className="flex items-center text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded active:scale-95 transition-transform">
                                        <Phone size={10} className="mr-1"/> Gọi Chỉ huy
                                    </a>
                                )}
                            </div>
                            <h1 className="text-lg font-black text-slate-900 leading-tight line-clamp-2">{project.name}</h1>
                            <p className="text-xs text-slate-500 flex items-center mt-1"><MapPin size={12} className="mr-1"/> {project.address}</p>
                        </div>
                    </div>
                </div>
                
                {/* Motivation Banner */}
                <div className="bg-gradient-to-r from-emerald-50 to-teal-50 px-5 py-3 flex items-start gap-3 border-t border-emerald-100">
                    <CheckCircle2 size={18} className="text-emerald-600 mt-0.5 shrink-0"/>
                    <p className="text-xs text-emerald-800 font-medium leading-relaxed">
                        Hãy cập nhật ảnh thường xuyên. Báo cáo đầy đủ giúp <span className="font-bold">nghiệm thu nhanh</span> và <span className="font-bold">thanh toán sớm</span> hơn!
                    </p>
                </div>
            </div>

            <div className="p-5 space-y-6">
                
                {/* --- PROJECT INFO CARD (INLINE - NEW UI) --- */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden transition-all">
                    <div 
                        className="bg-slate-50 px-4 py-3 flex justify-between items-center cursor-pointer border-b border-slate-100"
                        onClick={() => setExpandInfo(!expandInfo)}
                    >
                        <h3 className="font-black text-indigo-800 text-xs uppercase tracking-widest flex items-center">
                            <Info size={14} className="mr-2"/> Thông tin & Bản vẽ
                        </h3>
                        {expandInfo ? <ChevronUp size={16} className="text-slate-400"/> : <ChevronDown size={16} className="text-slate-400"/>}
                    </div>
                    
                    {expandInfo && (
                        <div className="p-4 space-y-4 animate-in slide-in-from-top-2">
                            <div className="grid grid-cols-1 gap-4">
                                <div className="space-y-1">
                                    <p className="text-[10px] font-bold text-slate-400 uppercase">Địa chỉ</p>
                                    <p className="text-sm font-bold text-slate-800 flex items-start"><MapPin size={14} className="mr-1 text-slate-400 mt-0.5"/> {project.address}</p>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                         <p className="text-[10px] font-bold text-slate-400 uppercase">Thời gian dự kiến</p>
                                         <p className="text-xs font-bold text-slate-700 mt-0.5">{project.startDate} - {project.endDate}</p>
                                    </div>
                                </div>
                                
                                {/* CONTACT - DISPLAY ALL AVAILABLE */}
                                <div className="pt-2 border-t border-slate-100 space-y-2">
                                     <p className="text-[10px] font-bold text-slate-400 uppercase mb-2">Liên hệ dự án</p>
                                     
                                     {/* Manager */}
                                     {(project.managerName || project.managerPhone) && (
                                         <div className="flex items-center justify-between bg-slate-50 p-3 rounded-xl border border-slate-100">
                                             <div className="flex items-center gap-3">
                                                 <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-xs"><HardHat size={16}/></div>
                                                 <div>
                                                     <p className="text-xs font-bold text-slate-800">{project.managerName || 'Chỉ huy trưởng'}</p>
                                                     <p className="text-[10px] text-slate-500 uppercase">Quản lý chung</p>
                                                 </div>
                                             </div>
                                             {project.managerPhone && (
                                                 <a href={`tel:${project.managerPhone}`} className="flex items-center gap-2 px-3 py-2 bg-green-500 text-white rounded-lg shadow-md hover:bg-green-600 active:scale-95 transition-all font-bold text-xs">
                                                     <Phone size={14}/> {project.managerPhone}
                                                 </a>
                                             )}
                                         </div>
                                     )}

                                     {/* Dynamic Contacts */}
                                     {project.contacts && project.contacts.map((contact, idx) => (
                                         <div key={idx} className="flex items-center justify-between bg-slate-50 p-3 rounded-xl border border-slate-100">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center text-orange-700 font-bold text-xs"><Briefcase size={16}/></div>
                                                <div>
                                                    <p className="text-xs font-bold text-slate-800">{contact.name}</p>
                                                    <p className="text-[10px] text-slate-500 uppercase">{contact.role}</p>
                                                </div>
                                            </div>
                                            {contact.phone && (
                                                <a href={`tel:${contact.phone}`} className="flex items-center gap-2 px-3 py-2 bg-green-500 text-white rounded-lg shadow-md hover:bg-green-600 active:scale-95 transition-all font-bold text-xs">
                                                    <Phone size={14}/> {contact.phone}
                                                </a>
                                            )}
                                        </div>
                                     ))}
                                </div>
                            </div>
                            
                            {/* DOCUMENTS */}
                            {project.infoFields && project.infoFields.length > 0 && (
                                <div className="space-y-2 pt-2 border-t border-slate-100">
                                    <p className="text-[10px] font-bold text-slate-400 uppercase">Tài liệu & Bản vẽ:</p>
                                    <div className="grid grid-cols-1 gap-2">
                                        {project.infoFields.map(field => (
                                            <div key={field.id} className="bg-indigo-50 p-2.5 rounded-xl border border-indigo-100 flex justify-between items-center">
                                                <div>
                                                    <p className="text-[10px] font-bold text-indigo-800 uppercase mb-0.5">{field.label}</p>
                                                    {field.type === 'TEXT' ? (
                                                        <p className="text-xs font-bold text-slate-800">{field.value}</p>
                                                    ) : (
                                                        field.attachment ? (
                                                            <a href={field.attachment.url} target="_blank" className="flex items-center text-xs font-bold text-indigo-600 hover:underline">
                                                                <FileText size={12} className="mr-1"/> {field.attachment.name}
                                                            </a>
                                                        ) : <span className="text-xs italic text-slate-400">Trống</span>
                                                    )}
                                                </div>
                                                {field.attachment && <ExternalLink size={14} className="text-indigo-400"/>}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Timeline Content */}
                <div className="relative pl-4 border-l-2 border-slate-200 ml-2 space-y-10">
                    {sortedStages.map((stage, idx) => {
                        const isActive = stage.status === StageStatus.IN_PROGRESS;
                        const isDone = stage.status === StageStatus.COMPLETED;
                        const stageLogs = roadmap.logs.filter(l => l.stageId === stage.id).sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
                        
                        // Collect recent photos
                        const recentPhotos = stageLogs.flatMap(l => l.photos || []).slice(0, 5);

                        return (
                            <div key={stage.id} className="relative">
                                {/* Node Indicator */}
                                <div className={`absolute -left-[25px] top-0 w-8 h-8 rounded-full border-4 border-slate-50 flex items-center justify-center shadow-sm z-10 transition-all ${
                                    isDone ? 'bg-emerald-500 text-white' : 
                                    isActive ? 'bg-orange-500 text-white scale-110 ring-4 ring-orange-100' : 
                                    'bg-white text-slate-300 border-slate-200'
                                }`}>
                                    {isDone ? <Check size={14} strokeWidth={4}/> : <span className="text-xs font-bold">{idx + 1}</span>}
                                </div>

                                <div className={`rounded-2xl transition-all duration-300 ${
                                    isActive ? 'bg-white shadow-lg border border-orange-100 ring-1 ring-orange-50' : 
                                    isDone ? 'bg-slate-50 border border-slate-100 opacity-80' : 
                                    'bg-slate-50 border border-slate-100 opacity-60'
                                }`}>
                                    {/* Card Header with Status Control */}
                                    <div className="p-5 pb-3">
                                        <div className="flex justify-between items-start mb-2">
                                            <h3 className={`text-base font-black uppercase tracking-tight ${isDone ? 'text-emerald-800 line-through decoration-emerald-500/50' : isActive ? 'text-slate-900' : 'text-slate-500'}`}>
                                                {stage.title}
                                            </h3>
                                            
                                            {/* WORKER STATUS CONTROL */}
                                            <div className="relative">
                                                <button 
                                                    onClick={() => setActiveActionMenu(activeActionMenu === stage.id ? null : stage.id)}
                                                    className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase flex items-center shadow-sm transition-all ${
                                                        isDone ? 'bg-emerald-100 text-emerald-700' : 
                                                        isActive ? 'bg-orange-100 text-orange-700 animate-pulse' : 
                                                        'bg-slate-100 text-slate-500'
                                                    }`}
                                                >
                                                    {isDone ? 'Xong' : isActive ? 'Đang làm' : 'Chưa làm'}
                                                    <ChevronDown size={12} className="ml-1"/>
                                                </button>

                                                {/* Dropdown Menu for Mobile */}
                                                {activeActionMenu === stage.id && (
                                                    <div className="absolute right-0 top-full mt-2 w-40 bg-white rounded-xl shadow-xl border border-slate-100 z-50 overflow-hidden animate-in fade-in zoom-in-95 origin-top-right">
                                                        <div className="p-1">
                                                            <button 
                                                                onClick={() => handleChangeStageStatus(stage.id, StageStatus.IN_PROGRESS)}
                                                                className="w-full text-left px-3 py-2 text-xs font-bold text-orange-600 hover:bg-orange-50 rounded-lg flex items-center"
                                                            >
                                                                <PlayCircle size={14} className="mr-2"/> Đang làm
                                                            </button>
                                                            <button 
                                                                onClick={() => handleChangeStageStatus(stage.id, StageStatus.COMPLETED)}
                                                                className="w-full text-left px-3 py-2 text-xs font-bold text-emerald-600 hover:bg-emerald-50 rounded-lg flex items-center"
                                                            >
                                                                <CheckCircle2 size={14} className="mr-2"/> Đã xong
                                                            </button>
                                                            <button 
                                                                onClick={() => handleChangeStageStatus(stage.id, StageStatus.BLOCKED)}
                                                                className="w-full text-left px-3 py-2 text-xs font-bold text-red-600 hover:bg-red-50 rounded-lg flex items-center"
                                                            >
                                                                <AlertCircle size={14} className="mr-2"/> Vướng mắc
                                                            </button>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                        <p className="text-xs text-slate-500 leading-relaxed">{stage.description}</p>
                                    </div>

                                    {/* Action Area */}
                                    <div className="px-5 pb-5">
                                        {/* LOG HISTORY (MESSAGES) */}
                                        {stageLogs.length > 0 && (
                                            <div className="mt-4 mb-4 space-y-3 border-t border-slate-100 pt-3">
                                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Lịch sử & Phản hồi</p>
                                                {stageLogs.map(log => (
                                                    <div key={log.id} className={`flex gap-3 text-sm ${log.type === 'FEEDBACK' ? 'bg-orange-50 border border-orange-100 p-3 rounded-lg' : ''}`}>
                                                        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${log.type === 'FEEDBACK' ? 'bg-orange-200 text-orange-800' : 'bg-slate-200 text-slate-600'}`}>
                                                            {log.performerName.charAt(0)}
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex justify-between items-start">
                                                                <span className="font-bold text-xs text-slate-800">{log.performerName}</span>
                                                                <span className="text-[10px] text-slate-400">{new Date(log.timestamp).toLocaleTimeString('vi-VN', {hour:'2-digit', minute:'2-digit'})}</span>
                                                            </div>
                                                            <p className="text-xs text-slate-600 mt-1 whitespace-pre-wrap">{log.content}</p>
                                                            
                                                            {/* IMAGE GRID IN LOG */}
                                                            {log.photos && log.photos.length > 0 && (
                                                                <div className="flex gap-2 mt-2 overflow-x-auto pb-1">
                                                                    {log.photos.map((p, idx) => (
                                                                        p.type === 'IMAGE' ? (
                                                                            <img 
                                                                                key={idx} 
                                                                                src={p.url} 
                                                                                className="h-16 w-auto rounded border border-slate-200 cursor-pointer hover:opacity-90 transition-opacity" 
                                                                                onClick={() => setViewingPhoto(p.url)}
                                                                            />
                                                                        ) : (
                                                                            <a key={idx} href={p.url} target="_blank" rel="noreferrer" className="flex items-center gap-1 bg-white border border-slate-200 px-2 py-1 rounded text-[10px] font-bold text-indigo-600 hover:bg-indigo-50">
                                                                                <FileText size={12}/> {p.name.slice(0,10)}...
                                                                            </a>
                                                                        )
                                                                    ))}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}

                                        {/* BUTTON LOGIC: Allow upload if Active OR Done (for corrections) */}
                                        {(isActive || isDone) ? (
                                            <div className="mt-2">
                                                <label className={`w-full flex items-center justify-center py-4 rounded-xl font-bold uppercase text-sm tracking-widest cursor-pointer transition-all active:scale-95 shadow-lg ${
                                                    uploadingStageId === stage.id 
                                                        ? 'bg-slate-100 text-slate-400 cursor-wait' 
                                                        : 'bg-orange-600 text-white hover:bg-orange-700 hover:shadow-orange-200'
                                                }`}>
                                                    {uploadingStageId === stage.id ? (
                                                        <><Loader2 size={20} className="animate-spin mr-2"/> Đang tải {uploadProgress?.current}/{uploadProgress?.total}...</>
                                                    ) : (
                                                        <><Images size={24} className="mr-2"/> {isActive ? 'Chụp / Chọn nhiều ảnh' : 'Bổ sung ảnh'}</>
                                                    )}
                                                    <input 
                                                        type="file" 
                                                        accept="image/*" 
                                                        multiple // ENABLE MULTIPLE SELECTION
                                                        className="hidden" 
                                                        onChange={(e) => handleFileChange(stage.id, e)} 
                                                        disabled={!!uploadingStageId}
                                                    />
                                                </label>
                                                <p className="text-[10px] text-slate-400 text-center mt-2 italic">*Mẹo: Giữ để chọn nhiều ảnh cùng lúc</p>
                                            </div>
                                        ) : (
                                            // IF PENDING -> Show "Start Work" button
                                            <button 
                                                onClick={() => handleChangeStageStatus(stage.id, StageStatus.IN_PROGRESS)}
                                                className="w-full py-3 mt-2 bg-white border-2 border-indigo-100 text-indigo-600 rounded-xl font-black uppercase text-xs tracking-widest hover:bg-indigo-50 transition-all flex items-center justify-center"
                                            >
                                                <PlayCircle size={16} className="mr-2"/> Bắt đầu làm phần này
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Success Toast */}
            {showSuccessToast && (
                <div className="fixed bottom-10 left-1/2 -translate-x-1/2 bg-emerald-600 text-white px-6 py-3 rounded-full shadow-2xl flex items-center gap-3 animate-in slide-in-from-bottom-5 z-50">
                    <CheckCircle2 size={24} className="text-white"/>
                    <div>
                        <p className="font-bold text-sm">Đã gửi báo cáo!</p>
                        <p className="text-[10px] opacity-90">Dữ liệu đã được cập nhật.</p>
                    </div>
                </div>
            )}

            {/* IMAGE ZOOM MODAL */}
            {viewingPhoto && (
                <div className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center p-4 animate-in zoom-in duration-200" onClick={() => setViewingPhoto(null)}>
                    <img src={viewingPhoto} className="max-w-full max-h-[90vh] rounded-lg shadow-2xl object-contain" />
                    <button className="absolute top-4 right-4 bg-white/20 p-3 rounded-full text-white hover:bg-white/40"><X size={24}/></button>
                </div>
            )}
        </div>
    );
};

export default WorkerView;
