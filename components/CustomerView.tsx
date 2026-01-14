
import React, { useState, useMemo, useEffect } from 'react';
import { Project, ProjectRoadmap, RoadmapLog, StageStatus, Attachment, LogType } from '../types';
import { generateProgressSummaryAI } from '../services/aiRoadmapService';
import { uploadFileToDrive } from '../services/googleDriveService';
import { addRoadmapLog } from '../services/roadmapService';
import { 
    CheckCircle2, Clock, MapPin, MessageSquare, Send, 
    Star, Heart, Info, ChevronDown, Phone, ShieldCheck, Lock, Eye, Check, Circle, Image as ImageIcon, ThumbsUp,
    Share2, Download, Printer, Coffee, Sparkles, MessageCircle, ExternalLink, Calendar, HelpCircle, FileText, X, Paperclip, Loader2,
    HardHat, User, ShoppingCart, Briefcase, Hammer
} from 'lucide-react';

interface CustomerViewProps {
    project: Project;
    roadmap: ProjectRoadmap;
    validPhone?: string; 
    previewMode?: boolean; 
    onSendFeedback: (content: string) => void;
    onRating: (stars: number, type: 'TEAM' | 'SALES') => void;
}

const CustomerView: React.FC<CustomerViewProps> = ({ project, roadmap, validPhone, previewMode = false, onSendFeedback, onRating }) => {
    // --- AUTHENTICATION STATE ---
    const [isAuthenticated, setIsAuthenticated] = useState(previewMode); 
    const [inputPhone, setInputPhone] = useState('');
    const [authError, setAuthError] = useState('');

    // --- MAIN VIEW STATE ---
    const [aiSummary, setAiSummary] = useState("Hệ thống đang tổng hợp dữ liệu tiến độ...");
    const [feedbackText, setFeedbackText] = useState("");
    const [feedbackCategory, setFeedbackCategory] = useState<'GENERAL' | 'ADJUSTMENT' | 'COMPLAINT'>('GENERAL');
    const [viewingPhoto, setViewingPhoto] = useState<string | null>(null);
    const [showTipModal, setShowTipModal] = useState(false);
    
    // Feedback Attachment State
    const [feedbackImages, setFeedbackImages] = useState<Attachment[]>([]);
    const [isUploadingFeedback, setIsUploadingFeedback] = useState(false);
    
    // 1. CHECK SESSION ON MOUNT
    useEffect(() => {
        if (previewMode) {
            setIsAuthenticated(true);
            return;
        }
        const sessionKey = `customer_auth_${project.id}`;
        if (sessionStorage.getItem(sessionKey) === 'true') {
            setIsAuthenticated(true);
        }
    }, [project.id, previewMode]);

    // 2. FETCH SUMMARY ONCE AUTHENTICATED
    const approvedLogs = useMemo(() => {
        return (roadmap.logs || []).filter(l => l.status === 'APPROVED');
    }, [roadmap.logs]);

    // Sort stages by order
    const sortedStages = useMemo(() => {
        return [...roadmap.stages].sort((a,b) => a.order - b.order);
    }, [roadmap.stages]);

    useEffect(() => {
        if (isAuthenticated) {
            const fetchSummary = async () => {
                const summary = await generateProgressSummaryAI(approvedLogs, roadmap.stages);
                setAiSummary(summary);
            };
            fetchSummary();
        }
    }, [isAuthenticated, approvedLogs.length]);

    // --- LOGIN HANDLER ---
    const handleLogin = (e: React.FormEvent) => {
        e.preventDefault();
        const cleanInput = inputPhone.replace(/[\s.-]/g, '');
        const cleanValid = (validPhone || '').replace(/[\s.-]/g, '');
        
        // Simple logic: If validPhone exists, match it. Else any >8 digit for demo.
        const isValid = cleanValid 
            ? cleanInput === cleanValid 
            : cleanInput.length > 8; 

        if (isValid) {
            setIsAuthenticated(true);
            sessionStorage.setItem(`customer_auth_${project.id}`, 'true');
        } else {
            setAuthError('Số điện thoại không khớp với hồ sơ đăng ký.');
        }
    };

    const handleFeedbackImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        
        setIsUploadingFeedback(true);
        try {
            const att = await uploadFileToDrive(file);
            setFeedbackImages(prev => [...prev, att]);
        } catch (e) {
            alert("Lỗi tải ảnh. Vui lòng thử lại.");
        } finally {
            setIsUploadingFeedback(false);
            e.target.value = '';
        }
    };

    const submitFeedback = async () => {
        if (!feedbackText.trim() && feedbackImages.length === 0) return;
        
        let prefix = '[Góp ý chung]';
        if (feedbackCategory === 'ADJUSTMENT') prefix = '[Yêu cầu điều chỉnh/Thay đổi]';
        if (feedbackCategory === 'COMPLAINT') prefix = '[Khiếu nại/Phản ánh]';

        const finalContent = `${prefix} ${feedbackText}`;

        // 1. Send Callback (Prop) - Optional
        onSendFeedback(finalContent);

        // 2. Add to Roadmap Log (So Manager & Worker can see)
        try {
            await addRoadmapLog(
                project.id,
                finalContent,
                feedbackImages,
                { id: 'customer', name: project.customerName || 'Khách hàng', role: 'CUSTOMER' },
                'Phản hồi từ App',
                undefined,
                LogType.FEEDBACK
            );
            alert("Cảm ơn Quý khách! Yêu cầu đã được chuyển tới Ban quản lý và Tổ đội thi công.");
        } catch (e) {
            console.error("Failed to sync feedback to roadmap", e);
            alert("Đã gửi phản hồi nhưng lỗi đồng bộ nhật ký.");
        }

        setFeedbackText("");
        setFeedbackImages([]);
    };

    const handlePrint = () => {
        window.print();
    };
    
    const handleShare = async () => {
        if (navigator.share) {
            try {
                await navigator.share({
                    title: `Hồ sơ: ${project.name}`,
                    text: 'Theo dõi tiến độ thi công công trình.',
                    url: window.location.href,
                });
            } catch (err) {
                console.log('Error sharing', err);
            }
        } else {
            navigator.clipboard.writeText(window.location.href);
            alert("Đã sao chép liên kết vào bộ nhớ tạm!");
        }
    };

    const handleSave = () => {
        // Trigger print for PDF save in most browsers as a simple "Save Report" action
        alert("Để lưu hồ sơ, vui lòng chọn 'Lưu dưới dạng PDF' trong cửa sổ in.");
        window.print();
    };

    const handleStarRating = async (stars: number, type: 'TEAM' | 'SALES') => {
        // Call prop callback
        onRating(stars, type);
        
        // Log to Roadmap to notify manager
        const message = `Đánh giá ${type === 'TEAM' ? 'Đội ngũ thi công' : 'Dịch vụ'}: ${stars} sao.`;
        try {
            await addRoadmapLog(
                project.id,
                message,
                [],
                { id: 'customer', name: project.customerName || 'Khách hàng', role: 'CUSTOMER' },
                'Đánh giá sao',
                undefined,
                LogType.FEEDBACK
            );
            alert(`Cảm ơn đánh giá ${stars} sao của Quý khách!`);
        } catch (e) {
            console.error("Rating error", e);
        }
    };

    const downloadQRCode = () => {
        if (!project.tipQrUrl) return;
        const link = document.createElement('a');
        link.href = project.tipQrUrl;
        link.download = `Mã_QR_Thanh_Toan_${project.code}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    // --- RENDER LOGIN SCREEN ---
    if (!isAuthenticated) {
        return (
            <div className="min-h-screen bg-slate-900 flex items-center justify-center p-6 font-sans">
                <div className="bg-white w-full max-w-sm rounded-3xl shadow-2xl p-8 text-center">
                    <div className="w-16 h-16 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center mx-auto mb-6">
                        <Lock size={32} />
                    </div>
                    <h2 className="text-xl font-black text-slate-800 uppercase mb-2">{project.name}</h2>
                    <p className="text-sm text-slate-500 mb-8">Khu vực dành riêng cho Chủ đầu tư</p>

                    <form onSubmit={handleLogin} className="space-y-4">
                        <div className="text-left">
                            <label className="text-xs font-bold text-slate-400 uppercase ml-1 mb-1 block">Xác thực bằng Số điện thoại</label>
                            <input 
                                type="tel" 
                                className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl px-4 py-3 font-bold text-slate-800 outline-none focus:border-indigo-500 transition-all placeholder:font-normal"
                                placeholder="09xx xxx xxx"
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
                            className="w-full bg-indigo-600 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-indigo-200 active:scale-95 transition-all flex items-center justify-center"
                        >
                            <ShieldCheck size={18} className="mr-2"/> Truy cập Hồ sơ
                        </button>
                    </form>
                </div>
            </div>
        );
    }

    // --- RENDER MAIN DASHBOARD ---
    return (
        <div className="h-[100%] bg-[#f8fafc] font-sans text-slate-900 flex flex-col overflow-hidden">
            {previewMode && (
                <div className="bg-indigo-600 text-white text-center py-2 text-xs font-bold uppercase sticky top-0 shadow-md no-print">
                    <Eye size={12} className="inline mr-1"/> Chế độ Xem trước (Khách hàng)
                </div>
            )}

            {/* A. HEADER BAR */}
            <header className="bg-white border-b border-slate-200 sticky top-0 z-40 px-6 py-4 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4 no-print">
                <div>
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white font-black shadow-lg shadow-indigo-200">
                            {project.name.charAt(0)}
                        </div>
                        <div>
                            <h1 className="text-lg font-black uppercase tracking-tight leading-none text-slate-900">{project.name}</h1>
                            <p className="text-xs text-slate-500 font-bold mt-1 flex items-center">
                                <span className={`w-2 h-2 rounded-full mr-1.5 ${project.status === 'ACTIVE' ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`}></span>
                                {project.status === 'ACTIVE' ? 'Đang thi công' : 'Đã hoàn thành'} • {roadmap.overallProgress}%
                            </p>
                        </div>
                    </div>
                </div>
                
                <div className="flex items-center gap-2">
                    <button onClick={handlePrint} className="flex items-center px-4 py-2 bg-slate-100 text-slate-600 rounded-xl text-xs font-bold uppercase hover:bg-slate-200 transition-all">
                        <Printer size={16} className="mr-2"/> In
                    </button>
                    <button onClick={handleShare} className="flex items-center px-4 py-2 bg-indigo-50 text-indigo-600 rounded-xl text-xs font-bold uppercase hover:bg-indigo-100 transition-all border border-indigo-100">
                        <Share2 size={16} className="mr-2"/> Chia sẻ
                    </button>
                    <button onClick={handleSave} className="flex items-center px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold uppercase hover:bg-emerald-700 shadow-lg shadow-emerald-200 transition-all active:scale-95">
                        <Download size={16} className="mr-2"/> Lưu hồ sơ
                    </button>
                </div>
            </header>

            {/* B. MAIN CONTENT GRID */}
            <div className="flex-1 overflow-y-auto p-4 md:p-8 custom-scrollbar">
                <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">
                    
                    {/* LEFT COLUMN (2/3): TIMELINE & PROGRESS */}
                    <div className="lg:col-span-2 space-y-8">
                        
                        {/* AI Summary Card */}
                        <div className="bg-gradient-to-r from-indigo-50 to-blue-50 p-6 rounded-[24px] border border-indigo-100 relative overflow-hidden">
                            <div className="flex items-start gap-4 relative z-10">
                                <div className="p-3 bg-white rounded-2xl shadow-sm text-indigo-600">
                                    <Sparkles size={24}/>
                                </div>
                                <div>
                                    <h3 className="font-black text-indigo-900 text-sm uppercase tracking-widest mb-1">Cập nhật tiến độ</h3>
                                    <p className="text-sm text-indigo-800 leading-relaxed font-medium">"{aiSummary}"</p>
                                </div>
                            </div>
                            <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
                                <MessageCircle size={120}/>
                            </div>
                        </div>

                        {/* Visual Timeline */}
                        <div className="bg-white rounded-[32px] border border-slate-200 shadow-sm p-8">
                            <h3 className="font-black text-slate-900 text-lg mb-8 flex items-center">
                                <Clock className="mr-2 text-indigo-600" size={20}/> Nhật Ký Thi Công
                            </h3>
                            
                            <div className="relative pl-4 border-l-2 border-slate-100 space-y-12">
                                {sortedStages.map((stage, idx) => {
                                    const stageLogs = approvedLogs.filter(l => l.stageId === stage.id).sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
                                    const isCompleted = stage.status === StageStatus.COMPLETED;
                                    const isActive = stage.status === StageStatus.IN_PROGRESS;
                                    const stagePhotos = stageLogs.flatMap(l => l.photos || []);

                                    return (
                                        <div key={stage.id} className="relative pl-8">
                                            {/* Node */}
                                            <div className={`absolute -left-[9px] top-0 w-4 h-4 rounded-full border-2 border-white shadow-sm z-10 ${isCompleted ? 'bg-emerald-500' : isActive ? 'bg-indigo-600 animate-pulse' : 'bg-slate-300'}`}></div>
                                            
                                            <div className={`transition-all duration-300 ${isActive ? 'opacity-100' : 'opacity-80 hover:opacity-100'}`}>
                                                <div className="flex justify-between items-start mb-2">
                                                    <h4 className={`text-base font-bold ${isCompleted ? 'text-emerald-800' : isActive ? 'text-indigo-700' : 'text-slate-500'}`}>{stage.title}</h4>
                                                    <span className={`text-[10px] font-black uppercase px-2 py-1 rounded-lg ${isCompleted ? 'bg-emerald-100 text-emerald-700' : isActive ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-400'}`}>
                                                        {isCompleted ? 'Hoàn thành' : isActive ? 'Đang thực hiện' : 'Chờ thi công'}
                                                    </span>
                                                </div>
                                                <p className="text-xs text-slate-500 mb-4 leading-relaxed">{stage.description}</p>

                                                {/* Photos Grid */}
                                                {stagePhotos.length > 0 ? (
                                                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
                                                        {stagePhotos.map((p, i) => (
                                                            <div key={i} className="aspect-square rounded-xl overflow-hidden border border-slate-100 cursor-pointer hover:opacity-90 transition-opacity" onClick={() => setViewingPhoto(p.url)}>
                                                                <img src={p.url} className="w-full h-full object-cover"/>
                                                            </div>
                                                        ))}
                                                    </div>
                                                ) : isActive && (
                                                    <div className="bg-slate-50 border border-dashed border-slate-200 rounded-xl p-4 text-center">
                                                        <p className="text-xs text-slate-400 italic">Chưa có hình ảnh cập nhật.</p>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>

                    {/* RIGHT COLUMN (1/3): INTERACTIONS & INFO */}
                    <div className="space-y-6">
                        
                        {/* 1. Project Info Card */}
                        <div className="bg-white p-6 rounded-[24px] border border-slate-200 shadow-sm">
                            <h3 className="font-bold text-slate-900 text-sm uppercase tracking-widest mb-4 flex items-center">
                                <Info size={16} className="mr-2 text-indigo-500"/> Thông tin dự án
                            </h3>
                            <div className="space-y-4">
                                <div>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase">Địa chỉ</p>
                                    <p className="text-sm font-medium text-slate-800 flex items-start gap-2 mt-1">
                                        <MapPin size={14} className="mt-0.5 text-slate-400 shrink-0"/> {project.address}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase">Thời gian dự kiến</p>
                                    <p className="text-sm font-medium text-slate-800 flex items-center gap-2 mt-1">
                                        <Calendar size={14} className="text-slate-400"/> {project.startDate} - {project.endDate}
                                    </p>
                                </div>

                                {/* CONTACTS DISPLAY */}
                                <div className="pt-4 border-t border-slate-50 space-y-3">
                                    <p className="text-[10px] font-bold text-slate-400 uppercase">Liên hệ dự án</p>
                                    
                                    {/* Manager */}
                                    {(project.managerName || project.managerPhone) && (
                                        <div className="flex items-center justify-between bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-xs"><HardHat size={16}/></div>
                                                <div>
                                                    <p className="text-xs font-bold text-slate-800">{project.managerName || 'Chỉ huy trưởng'}</p>
                                                    <p className="text-[10px] text-slate-500 uppercase">Quản lý chung</p>
                                                </div>
                                            </div>
                                            {project.managerPhone && <a href={`tel:${project.managerPhone}`} className="p-2 bg-green-500 text-white rounded-lg shadow-md hover:bg-green-600 active:scale-95 transition-all"><Phone size={14}/></a>}
                                        </div>
                                    )}

                                     {/* Dynamic Contacts */}
                                     {project.contacts && project.contacts.map((contact, idx) => (
                                         <div key={idx} className="flex items-center justify-between bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center text-orange-700 font-bold text-xs"><Briefcase size={16}/></div>
                                                <div>
                                                    <p className="text-xs font-bold text-slate-800">{contact.name}</p>
                                                    <p className="text-[10px] text-slate-500 uppercase">{contact.role}</p>
                                                </div>
                                            </div>
                                            {contact.phone && (
                                                <a href={`tel:${contact.phone}`} className="p-2 bg-green-500 text-white rounded-lg shadow-md hover:bg-green-600 active:scale-95 transition-all">
                                                    <Phone size={14}/>
                                                </a>
                                            )}
                                        </div>
                                     ))}
                                </div>
                                
                                {/* DYNAMIC FIELDS */}
                                {project.infoFields && project.infoFields.length > 0 && (
                                    <>
                                        <div className="border-t border-slate-50 pt-4"></div>
                                        {project.infoFields.map(field => (
                                            <div key={field.id}>
                                                <p className="text-[10px] font-bold text-slate-400 uppercase">{field.label}</p>
                                                {field.type === 'TEXT' ? (
                                                    <p className="text-sm font-medium text-slate-800 mt-1">{field.value}</p>
                                                ) : (
                                                    field.attachment ? (
                                                        <a href={field.attachment.url} target="_blank" className="flex items-center text-xs font-bold text-indigo-600 bg-indigo-50 px-3 py-2 rounded-lg mt-1 hover:bg-indigo-100 transition-colors">
                                                            <FileText size={14} className="mr-2"/> {field.attachment.name}
                                                        </a>
                                                    ) : <span className="text-xs text-slate-400 italic">Chưa có file</span>
                                                )}
                                            </div>
                                        ))}
                                    </>
                                )}
                            </div>
                        </div>

                        {/* 2. Feedback Portal */}
                        <div className="bg-white p-6 rounded-[24px] border border-slate-200 shadow-sm relative overflow-hidden">
                            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-indigo-500"></div>
                            <h3 className="font-bold text-slate-900 text-sm uppercase tracking-widest mb-4 flex items-center">
                                <MessageSquare size={16} className="mr-2 text-blue-500"/> Gửi yêu cầu / Phản hồi
                            </h3>
                            <div className="space-y-3">
                                <div className="flex gap-2">
                                    <button 
                                        onClick={() => setFeedbackCategory('GENERAL')}
                                        className={`flex-1 py-2 text-[10px] font-bold uppercase rounded-lg border ${feedbackCategory === 'GENERAL' ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-500 border-slate-200'}`}
                                    >
                                        Góp ý
                                    </button>
                                    <button 
                                        onClick={() => setFeedbackCategory('ADJUSTMENT')}
                                        className={`flex-1 py-2 text-[10px] font-bold uppercase rounded-lg border ${feedbackCategory === 'ADJUSTMENT' ? 'bg-orange-600 text-white border-orange-600' : 'bg-white text-slate-500 border-slate-200'}`}
                                    >
                                        Điều chỉnh
                                    </button>
                                    <button 
                                        onClick={() => setFeedbackCategory('COMPLAINT')}
                                        className={`flex-1 py-2 text-[10px] font-bold uppercase rounded-lg border ${feedbackCategory === 'COMPLAINT' ? 'bg-red-600 text-white border-red-600' : 'bg-white text-slate-500 border-slate-200'}`}
                                    >
                                        Khiếu nại
                                    </button>
                                </div>
                                <textarea 
                                    className="w-full border-2 border-slate-100 bg-slate-50 rounded-xl p-3 text-sm focus:bg-white focus:border-indigo-500 outline-none transition-all resize-none"
                                    rows={4}
                                    placeholder={feedbackCategory === 'ADJUSTMENT' ? "Nhập nội dung cần thay đổi thiết kế/thi công..." : "Nhập nội dung..."}
                                    value={feedbackText}
                                    onChange={e => setFeedbackText(e.target.value)}
                                />
                                
                                <div className="flex items-center justify-between">
                                    <label className="flex items-center gap-2 cursor-pointer text-slate-500 hover:text-indigo-600 transition-colors">
                                        <div className="p-2 bg-slate-100 rounded-lg">
                                            {isUploadingFeedback ? <Loader2 size={16} className="animate-spin"/> : <Paperclip size={16}/>}
                                        </div>
                                        <span className="text-xs font-bold">Đính kèm ảnh</span>
                                        <input type="file" accept="image/*" className="hidden" onChange={handleFeedbackImageUpload} disabled={isUploadingFeedback}/>
                                    </label>
                                    <span className="text-[10px] text-slate-400">{feedbackImages.length} ảnh</span>
                                </div>
                                
                                {feedbackImages.length > 0 && (
                                    <div className="flex gap-2 overflow-x-auto pb-2">
                                        {feedbackImages.map((img, i) => (
                                            <div key={i} className="relative shrink-0">
                                                <img src={img.url} className="w-16 h-16 rounded-lg object-cover border border-slate-200"/>
                                                <button onClick={() => setFeedbackImages(prev => prev.filter((_, idx) => idx !== i))} className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-0.5"><X size={10}/></button>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                <button 
                                    onClick={submitFeedback}
                                    disabled={!feedbackText && feedbackImages.length === 0}
                                    className="w-full py-3 bg-indigo-600 text-white rounded-xl font-bold text-xs uppercase tracking-widest shadow-lg hover:bg-indigo-700 active:scale-95 transition-all disabled:opacity-50"
                                >
                                    Gửi yêu cầu ngay
                                </button>
                                <p className="text-[10px] text-center text-slate-400 italic">Yêu cầu sẽ được gửi trực tiếp đến PM & Ban giám đốc.</p>
                            </div>
                        </div>

                        {/* 3. Experience Hub (Rating & Tips) */}
                        <div className="bg-gradient-to-br from-slate-800 to-slate-900 text-white p-6 rounded-[24px] shadow-xl relative overflow-hidden">
                            <div className="relative z-10">
                                <h3 className="font-bold text-sm uppercase tracking-widest mb-6 flex items-center">
                                    <Heart size={16} className="mr-2 text-rose-500"/> Trải nghiệm khách hàng
                                </h3>
                                
                                <div className="space-y-6">
                                    <div>
                                        <p className="text-[10px] font-bold text-slate-400 uppercase mb-2">Đánh giá đội ngũ</p>
                                        <div className="flex gap-2 justify-center bg-white/10 p-3 rounded-xl">
                                            {[1, 2, 3, 4, 5].map(star => (
                                                <button key={star} onClick={() => handleStarRating(star, 'TEAM')} className="hover:scale-110 transition-transform">
                                                    <Star size={24} className="text-yellow-400 fill-yellow-400 opacity-80 hover:opacity-100"/>
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="pt-4 border-t border-white/10">
                                        <p className="text-[10px] font-bold text-slate-400 uppercase mb-3 text-center">Hài lòng với tiến độ?</p>
                                        <button 
                                            onClick={() => setShowTipModal(true)}
                                            className="w-full py-4 bg-gradient-to-r from-amber-500 to-orange-600 rounded-xl font-black text-xs uppercase tracking-widest shadow-lg hover:shadow-orange-500/50 transition-all flex items-center justify-center group"
                                        >
                                            <Coffee size={18} className="mr-2 group-hover:-rotate-12 transition-transform"/> Mời team ly Cafe (Tip)
                                        </button>
                                        <p className="text-[9px] text-center text-slate-500 mt-2 italic">Quét mã QR Momo/Bank để gửi tip nhanh cho anh em thợ.</p>
                                    </div>
                                </div>
                            </div>
                            <div className="absolute -right-6 -bottom-6 opacity-5 pointer-events-none">
                                <ThumbsUp size={150}/>
                            </div>
                        </div>

                    </div>
                </div>
            </div>

            {/* MODALS */}
            
            {/* Image Preview */}
            {viewingPhoto && (
                <div className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center p-4 animate-in zoom-in duration-200" onClick={() => setViewingPhoto(null)}>
                    <img src={viewingPhoto} className="max-w-full max-h-[90vh] rounded-lg shadow-2xl" />
                    <button className="absolute top-4 right-4 bg-white/20 p-3 rounded-full text-white hover:bg-white/40"><X size={24}/></button>
                </div>
            )}

            {/* Tip Modal */}
            {showTipModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in">
                    <div className="bg-white rounded-3xl w-full max-w-sm p-8 text-center relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-amber-400 to-orange-600"></div>
                        <button onClick={() => setShowTipModal(false)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600"><X size={24}/></button>
                        
                        <div className="w-16 h-16 bg-orange-100 text-orange-600 rounded-full flex items-center justify-center mx-auto mb-4">
                            <Coffee size={32}/>
                        </div>
                        <h3 className="text-xl font-black text-slate-900 mb-2">Mời Cafe Anh Em</h3>
                        <p className="text-sm text-slate-500 mb-6">Cảm ơn sự động viên của Quý khách! Tiền tip sẽ được chuyển trực tiếp cho đội thi công tại công trình.</p>
                        
                        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 mb-4 inline-block">
                            {/* Placeholder QR or Real Image */}
                            <div className="w-40 h-40 bg-white border-2 border-slate-800 flex items-center justify-center mx-auto overflow-hidden">
                                {project.tipQrUrl ? (
                                    <img src={project.tipQrUrl} className="w-full h-full object-cover"/>
                                ) : (
                                    <p className="text-xs font-bold uppercase tracking-widest text-center px-2">CHƯA CÓ MÃ QR</p>
                                )}
                            </div>
                        </div>
                        <p className="text-xs font-bold text-slate-800 mb-4">Nội dung CK: Tip {project.code}</p>
                        
                        <button onClick={downloadQRCode} disabled={!project.tipQrUrl} className="w-full py-3 bg-indigo-600 text-white rounded-xl font-bold shadow-lg hover:bg-indigo-700 disabled:opacity-50">
                            Tải Ảnh QR về máy
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CustomerView;
