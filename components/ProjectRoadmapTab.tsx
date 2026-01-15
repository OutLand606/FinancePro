
import React, { useState, useEffect, useRef } from 'react';
import { Project, Partner, ProjectRoadmap, RoadmapStage, StageStatus, RoadmapLog, LogType, Attachment, RoadmapTemplate } from '../types';
import { getRoadmapTemplates, getProjectRoadmap, createRoadmapFromTemplate, addRoadmapLog, generateAccessLink, groupLogsByDate, saveRoadmapTemplate } from '../services/roadmapService';
import { uploadFileToDrive } from '../services/googleDriveService';
import { 
    CheckCircle2, Circle, Clock, Camera, MessageSquare, Share2, 
    Construction, User, ShieldCheck, MapPin, Phone, Send,
    Image as ImageIcon, QrCode, ThumbsUp, AlertCircle, Loader2, PlayCircle, Lock, HardHat,
    Printer, FileText, Calendar, Filter, ChevronRight, X, Copy, Plus, Layout, Sparkles, Brain, Eye, Briefcase
} from 'lucide-react';
import ManagerViewComponent from './ManagerView';
import WorkerView from './WorkerView'; 
import CustomerView from './CustomerView';
import ReportPrintView from './ReportPrintView'; 
import { generateRoadmapTemplateAI } from '@/services/aiRoadmapService';

interface ProjectRoadmapTabProps {
    project: Project;
    partners: Partner[]; 
    currentUser: any;
    onUpdateProject?: (p: Project) => void; 
}

const ProjectRoadmapTab: React.FC<ProjectRoadmapTabProps> = ({ project, partners, currentUser, onUpdateProject }) => {
    // VIEW MODES: MANAGER (Admin/Sales), WORKER (Thợ), CUSTOMER (Khách - Preview)
    const [viewMode, setViewMode] = useState<'MANAGER' | 'WORKER'>('MANAGER');
    const [roadmap, setRoadmap] = useState<ProjectRoadmap | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    
    // Setup State
    const [templates, setTemplates] = useState<RoadmapTemplate[]>([]);
    const [selectedTemplate, setSelectedTemplate] = useState('')

    useEffect(() => {
        const fetchTemplates = async () => {
            const tpls = await getRoadmapTemplates();
            if (Array.isArray(tpls)) {
                setTemplates(tpls);
                if (tpls.length > 0) setSelectedTemplate(tpls[0].id);
            } else {
                setTemplates([]);
            }
        };
        fetchTemplates();
    }, []);
    
    // AI Gen State
    const [showAiGen, setShowAiGen] = useState(false);
    const [aiParams, setAiParams] = useState({ buildingType: 'Nhà phố', floors: 3, area: '100m2', systems: ['Báo cháy', 'Chữa cháy'] });
    const [isGenerating, setIsGenerating] = useState(false);

    // Create Template State
    const [showCreateTemplate, setShowCreateTemplate] = useState(false);
    const [newTemplateName, setNewTemplateName] = useState('');
    const [newTemplateStages, setNewTemplateStages] = useState<{title:string, desc:string}[]>([{title:'', desc:''}]);

    // Customer Preview State
    const [showCustomerPreview, setShowCustomerPreview] = useState(false);
    
    // REPORT PREVIEW STATE
    const [showReportPreview, setShowReportPreview] = useState(false);

    // Worker/Manager Input State
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [newLogContent, setNewLogContent] = useState('');
    const [newLogLocation, setNewLogLocation] = useState('');
    const [newLogStageId, setNewLogStageId] = useState<string>('');
    const [isUploading, setIsUploading] = useState(false);

    // Share Modal
    const [showShareModal, setShowShareModal] = useState(false);
    const [shareRole, setShareRole] = useState<'CUSTOMER' | 'WORKER'>('CUSTOMER');
    const [generatedLink, setGeneratedLink] = useState('');

    useEffect(() => {
        loadRoadmap();
    }, [project.id]);

    const loadRoadmap = async () => {
        setIsLoading(true);
        try {
            const data = await getProjectRoadmap(project.id);
            setRoadmap(data);
        } finally {
            setIsLoading(false);
        }
    };

    const handleCreateRoadmap = async () => {
        setIsLoading(true);
        try {
            const newMap = await createRoadmapFromTemplate(project.id, selectedTemplate);
            setRoadmap(newMap);
        } finally {
            setIsLoading(false);
        }
    };

    const handleAiGenerate = async () => {
        setIsGenerating(true);
        try {
            const tpl = await generateRoadmapTemplateAI(aiParams);
            if (tpl) {
                // Lưu template AI vào DB luôn để dùng lại sau này (Tuỳ chọn)
                await saveRoadmapTemplate(tpl);
                
                setTemplates(prev => [tpl, ...prev]);
                setSelectedTemplate(tpl.id);
                setShowAiGen(false);
                alert("Đã tạo lộ trình thành công! Bạn có thể chọn và khởi tạo ngay.");
            } else {
                alert("AI không thể tạo lộ trình lúc này. Vui lòng thử lại.");
            }
        } finally {
            setIsGenerating(false);
        }
    };

    const handleSaveNewTemplate = async () => {
        if (!newTemplateName) return alert("Vui lòng nhập tên mẫu");
        const validStages = newTemplateStages.filter(s => s.title.trim() !== '');
        if (validStages.length === 0) return alert("Vui lòng nhập ít nhất 1 giai đoạn");

        const tpl: RoadmapTemplate = {
            id: `tpl_custom_${Date.now()}`,
            name: newTemplateName,
            stages: validStages.map(s => ({
                title: s.title,
                description: s.desc,
                weightPercent: 100 / validStages.length
            }))
        };
        saveRoadmapTemplate(tpl);
        setTemplates( await getRoadmapTemplates());
        setSelectedTemplate(tpl.id);
        setShowCreateTemplate(false);
        setNewTemplateName('');
        setNewTemplateStages([{title:'', desc:''}]);
    };

    const handleOpenShare = (role: 'CUSTOMER' | 'WORKER') => {
        setShareRole(role);
        setGeneratedLink(''); // Reset previous link
        setShowShareModal(true);
        // Auto generate
        handleGenerateLink(role);
    };

    const handleGenerateLink = async (role: 'CUSTOMER' | 'WORKER') => {
        const link = await generateAccessLink(project.id, role);
        setGeneratedLink(link);
    };

    const handleQuickUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !roadmap) return;

        setIsUploading(true);
        try {
            const att = await uploadFileToDrive(file);
            const stageId = newLogStageId || roadmap.stages.find(s => s.status === 'IN_PROGRESS')?.id || roadmap.stages[0].id;
            
            await addRoadmapLog(
                project.id,
                newLogContent || 'Cập nhật hình ảnh hiện trường (Sales Check-in)',
                [att],
                { id: currentUser.id, name: currentUser.name, role: viewMode === 'WORKER' ? 'WORKER' : 'MANAGER' },
                newLogLocation || 'Tại công trình',
                stageId
            );
            
            setNewLogContent('');
            setNewLogLocation('');
            setNewLogStageId('');
            await loadRoadmap();
            alert("Đã đăng ảnh thành công lên Nhật Ký!");
        } catch (err: any) {
            alert("Lỗi: " + err.message);
        } finally {
            setIsUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const handleOpenPrintView = () => {
        setShowReportPreview(true);
    };

    const renderWorkerView = () => {
        if (!roadmap) return null;
        return <WorkerView project={project} currentUser={currentUser} />;
    };

    if (!roadmap) {
        return (
            <div className="flex flex-col items-center justify-center h-full p-10 text-center animate-in fade-in relative">
                <div className="bg-indigo-50 p-6 rounded-full mb-6">
                    <Construction size={48} className="text-indigo-600"/>
                </div>
                <h3 className="text-xl font-black text-slate-900 mb-2">Chưa khởi tạo Nhật Ký Thi Công</h3>
                <p className="text-slate-500 mb-8 max-w-md">Chọn mẫu lộ trình phù hợp để bắt đầu theo dõi tiến độ và chia sẻ nhật ký công trình.</p>
                
                <div className="flex flex-col gap-4 w-full max-w-sm">
                    <div className="flex gap-2">
                        <select className="flex-1 p-4 border-2 border-slate-200 rounded-xl font-bold text-sm bg-white outline-none focus:border-indigo-500" value={selectedTemplate} onChange={e => setSelectedTemplate(e.target.value)}>
                            {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                        </select>
                        <button onClick={() => setShowCreateTemplate(true)} className="px-4 bg-slate-100 text-slate-600 rounded-xl hover:bg-slate-200" title="Tạo Mẫu Mới"><Plus size={20}/></button>
                        <button onClick={() => setShowAiGen(true)} className="px-4 bg-purple-100 text-purple-700 rounded-xl hover:bg-purple-200 transition-colors" title="AI Tạo Lộ Trình">
                            <Sparkles size={20}/>
                        </button>
                    </div>
                    
                    <button onClick={handleCreateRoadmap} disabled={isLoading} className="bg-indigo-600 text-white p-4 rounded-xl font-black uppercase text-sm tracking-widest hover:bg-indigo-700 shadow-lg flex justify-center items-center">
                        {isLoading ? <Loader2 className="animate-spin mr-2"/> : <PlayCircle className="mr-2"/>} Khởi tạo Nhật Ký
                    </button>
                </div>

                {/* AI GENERATOR MODAL */}
                {showAiGen && (
                    <div className="absolute inset-0 bg-white/90 backdrop-blur-sm z-50 flex items-center justify-center p-6 animate-in zoom-in-95">
                        <div className="bg-white rounded-3xl shadow-2xl p-8 w-full max-w-md border border-slate-100">
                            <div className="flex justify-between items-center mb-6">
                                <h3 className="font-black text-lg flex items-center"><Brain className="mr-2 text-purple-600"/> AI Lập Lộ Trình</h3>
                                <button onClick={() => setShowAiGen(false)}><X className="text-slate-400 hover:text-slate-600"/></button>
                            </div>
                            <div className="space-y-4">
                                <div><label className="text-xs font-bold text-slate-500 uppercase">Loại công trình</label><input className="w-full border-2 p-3 rounded-xl font-bold mt-1" value={aiParams.buildingType} onChange={e=>setAiParams({...aiParams, buildingType: e.target.value})}/></div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div><label className="text-xs font-bold text-slate-500 uppercase">Số tầng</label><input type="number" className="w-full border-2 p-3 rounded-xl font-bold mt-1" value={aiParams.floors} onChange={e=>setAiParams({...aiParams, floors: Number(e.target.value)})}/></div>
                                    <div><label className="text-xs font-bold text-slate-500 uppercase">Diện tích</label><input className="w-full border-2 p-3 rounded-xl font-bold mt-1" value={aiParams.area} onChange={e=>setAiParams({...aiParams, area: e.target.value})}/></div>
                                </div>
                                <div className="bg-purple-50 p-3 rounded-xl text-xs text-purple-800 italic">
                                    AI sẽ tự động phân tích quy chuẩn PCCC để đề xuất các giai đoạn thi công phù hợp nhất.
                                </div>
                                <button onClick={handleAiGenerate} disabled={isGenerating} className="w-full py-3 bg-purple-600 text-white rounded-xl font-black uppercase text-xs tracking-widest shadow-lg hover:bg-purple-700 flex justify-center items-center">
                                    {isGenerating ? <Loader2 className="animate-spin mr-2"/> : <Sparkles className="mr-2"/>} {isGenerating ? 'Đang suy nghĩ...' : 'Tạo Lộ Trình'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* CREATE TEMPLATE MODAL */}
                {showCreateTemplate && (
                    <div className="absolute inset-0 bg-white/90 backdrop-blur-sm z-50 flex items-center justify-center p-6 animate-in zoom-in-95">
                        <div className="bg-white rounded-3xl shadow-2xl p-8 w-full max-w-lg border border-slate-100 flex flex-col max-h-[80vh]">
                            <div className="flex justify-between items-center mb-6 shrink-0">
                                <h3 className="font-black text-lg flex items-center"><Layout className="mr-2 text-indigo-600"/> Tạo Mẫu Mới</h3>
                                <button onClick={() => setShowCreateTemplate(false)}><X className="text-slate-400 hover:text-slate-600"/></button>
                            </div>
                            <div className="flex-1 overflow-y-auto custom-scrollbar pr-2">
                                <div className="space-y-4">
                                    <div>
                                        <label className="text-xs font-bold text-slate-500 uppercase">Tên lộ trình</label>
                                        <input className="w-full border-2 p-3 rounded-xl font-bold mt-1" placeholder="VD: Lắp đặt điện năng lượng mặt trời..." value={newTemplateName} onChange={e => setNewTemplateName(e.target.value)}/>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold text-slate-500 uppercase">Các giai đoạn triển khai</label>
                                        {newTemplateStages.map((stage, idx) => (
                                            <div key={idx} className="flex gap-2">
                                                <div className="flex-1 space-y-1">
                                                    <input className="w-full border p-2 rounded-lg font-bold text-sm" placeholder={`Giai đoạn ${idx+1}`} value={stage.title} onChange={e => { const copy = [...newTemplateStages]; copy[idx].title = e.target.value; setNewTemplateStages(copy); }}/>
                                                    <input className="w-full border p-2 rounded-lg text-xs" placeholder="Mô tả công việc..." value={stage.desc} onChange={e => { const copy = [...newTemplateStages]; copy[idx].desc = e.target.value; setNewTemplateStages(copy); }}/>
                                                </div>
                                                <button onClick={() => { const copy = [...newTemplateStages]; copy.splice(idx, 1); setNewTemplateStages(copy); }} className="p-2 text-red-400 hover:bg-red-50 rounded"><X size={16}/></button>
                                            </div>
                                        ))}
                                        <button onClick={() => setNewTemplateStages([...newTemplateStages, {title:'', desc:''}])} className="w-full py-2 border-2 border-dashed border-slate-200 rounded-xl text-slate-400 font-bold text-xs hover:border-indigo-300 hover:text-indigo-600">+ Thêm giai đoạn</button>
                                    </div>
                                </div>
                            </div>
                            <button onClick={handleSaveNewTemplate} className="mt-6 w-full py-3 bg-indigo-600 text-white rounded-xl font-black uppercase text-xs tracking-widest shadow-lg hover:bg-indigo-700 shrink-0">Lưu Mẫu</button>
                        </div>
                    </div>
                )}
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col relative">
            <input ref={fileInputRef} type="file" className="hidden" accept="image/*" onChange={handleQuickUpload} />
            
            {/* --- SWITCH MODE BAR (TOP RIGHT) --- */}
            <div className=" top-[-50px] right-0 flex gap-2 bg-white/50 p-1 rounded-lg border border-slate-200/50 backdrop-blur-sm z-50">
                <button onClick={() => setViewMode('MANAGER')} className={`px-3 py-1 rounded text-[10px] font-bold uppercase ${viewMode === 'MANAGER' ? 'bg-indigo-600 text-white' : 'text-slate-500'}`}>Giao diện Quản Lý</button>
                <button onClick={() => setViewMode('WORKER')} className={`px-3 py-1 rounded text-[10px] font-bold uppercase ${viewMode === 'WORKER' ? 'bg-orange-500 text-white' : 'text-slate-500'}`}>Giao diện Thợ</button>
                {roadmap && (
                    <>
                        <div className="w-px bg-slate-300 mx-1 h-4 self-center"></div>
                        <button onClick={() => setShowCustomerPreview(true)} className="px-3 py-1 rounded text-[10px] font-bold uppercase bg-white border border-indigo-200 text-indigo-700 hover:bg-indigo-50 flex items-center">
                            <Eye size={12} className="mr-1"/> Giao diện CĐT
                        </button>
                    </>
                )}
            </div>

            {/* Quick Upload Bar Removed here */}

            {viewMode === 'MANAGER' && (
                <ManagerViewComponent 
                    project={project} // Pass project
                    roadmap={roadmap} 
                    currentUser={currentUser}
                    onUpdateRoadmap={(updated) => setRoadmap(updated)} 
                    onUpdateProject={onUpdateProject} // Pass handler
                    onExportReport={handleOpenPrintView}
                    onShare={handleOpenShare} // Passing Share Handler
                />
            )}
            
            {viewMode === 'WORKER' && renderWorkerView()}

            {/* CUSTOMER PREVIEW MODAL */}
            {showCustomerPreview && roadmap && (
                <div className="fixed inset-0 z-[250] bg-black flex flex-col items-center justify-center p-4">
                    <div className="bg-white w-full max-w-7xl h-[95vh] rounded-[32px] overflow-hidden relative shadow-2xl">
                        <CustomerView 
                            project={project} 
                            roadmap={roadmap} 
                            previewMode={true}
                            onSendFeedback={() => {}} 
                            onRating={() => {}}
                        />
                        <button onClick={() => setShowCustomerPreview(false)} className="absolute top-0 right-0 z-50 text-black p-2 hover:bg-white/40">
                            <X size={26}/>
                        </button>
                    </div>
                </div>
            )}

            {/* REPORT PRINT VIEW MODAL */}
            {showReportPreview && roadmap && (
                <div className="fixed inset-0 z-[300] bg-slate-900/90 flex flex-col items-center justify-start p-0 md:p-8 animate-in fade-in overflow-y-auto">
                    <div className="bg-white w-full max-w-[210mm] min-h-screen md:min-h-[297mm] shadow-2xl relative">
                        <ReportPrintView 
                            project={project} 
                            roadmap={roadmap} 
                            currentUser={currentUser} 
                            onClose={() => setShowReportPreview(false)}
                        />
                    </div>
                </div>
            )}

            {/* SHARE LINK MODAL */}
            {showShareModal && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
                    <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl p-8">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="font-bold text-lg text-slate-900 flex items-center">
                                <Share2 size={18} className="mr-2 text-indigo-600"/> Chia sẻ Nhật ký
                            </h3>
                            <button onClick={() => setShowShareModal(false)}><X className="text-slate-400 hover:text-slate-600"/></button>
                        </div>
                        
                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 mb-6">
                            <p className="text-xs font-bold text-slate-500 uppercase mb-2">Đang tạo link cho:</p>
                            <div className="flex items-center gap-2">
                                <div className={`p-2 rounded-lg text-white ${shareRole === 'CUSTOMER' ? 'bg-indigo-600' : 'bg-orange-500'}`}>
                                    {shareRole === 'CUSTOMER' ? <User size={20}/> : <HardHat size={20}/>}
                                </div>
                                <div>
                                    <p className="font-black text-slate-900">{shareRole === 'CUSTOMER' ? 'Chủ Đầu Tư' : 'Tổ Đội Thi Công'}</p>
                                    <p className="text-xs text-slate-400">{shareRole === 'CUSTOMER' ? 'Xem tiến độ, ảnh & gửi phản hồi' : 'Chụp ảnh & Báo cáo nhanh'}</p>
                                </div>
                            </div>
                        </div>

                        {generatedLink && (
                            <div className="space-y-4">
                                <div>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Liên kết truy cập (Hết hạn sau 30 ngày)</p>
                                    <div className="flex items-center gap-2">
                                        <input className="flex-1 bg-white border-2 border-indigo-100 rounded-xl px-3 py-3 text-xs font-mono text-indigo-700 outline-none font-bold" value={generatedLink} readOnly />
                                        <button onClick={() => { navigator.clipboard.writeText(generatedLink); alert("Đã sao chép!"); }} className="p-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 shadow-md transition-all active:scale-95"><Copy size={16}/></button>
                                    </div>
                                </div>
                                <div className="flex justify-center">
                                    <div className="bg-white p-2 rounded-xl border border-slate-100 shadow-sm">
                                        <QrCode size={120} className="text-slate-900"/>
                                    </div>
                                </div>
                                <p className="text-center text-xs text-slate-400 italic">Quét mã QR để mở trên điện thoại</p>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default ProjectRoadmapTab;
