
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { ProjectRoadmap, RoadmapLog, RoadmapStage, StageStatus, UserContext, Project, ProjectNote, ProjectInfoField, ProjectContact } from '../types';
import { addRoadmapLog, addNewStageToRoadmap, saveProjectRoadmap } from '../services/roadmapService';
import { uploadFileToDrive } from '../services/googleDriveService';
import { 
    Clock, CheckCircle2, AlertTriangle, Share2, Printer, 
    MessageSquare, Eye, EyeOff, Check, RefreshCw,
    MapPin, Filter, Sparkles, Loader2, Bell, LayoutGrid, List,
    Camera, Upload, ChevronDown, PlayCircle, StopCircle, PauseCircle,
    Edit3, HardHat, User, Link, Calendar, Info, Settings, Save, X, Truck,
    GripVertical, Plus, MoreHorizontal, FileText, Trash2, Phone, QrCode, ShoppingCart, Briefcase, Hammer, Users
} from 'lucide-react';

interface ManagerViewProps {
    project: Project;
    roadmap: ProjectRoadmap;
    currentUser: UserContext;
    onUpdateRoadmap: (updatedMap: ProjectRoadmap) => void;
    onUpdateProject?: (updatedProject: Project) => void;
    onExportReport: () => void;
    onShare: (role: 'CUSTOMER' | 'WORKER') => void;
}

const ManagerView: React.FC<ManagerViewProps> = ({ project, roadmap, currentUser, onUpdateRoadmap, onUpdateProject, onExportReport, onShare }) => {
    // --- STATE ---
    const [uploadingStageId, setUploadingStageId] = useState<string | null>(null);
    const [editingStageId, setEditingStageId] = useState<string | null>(null);
    const [editStageData, setEditStageData] = useState<{
        title?: string;
        description: string;
        expectedMaterialDate?: string;
        startDate?: string;
        endDate?: string;
    }>({description: ''});
    
    const [isAddingStage, setIsAddingStage] = useState(false);
    const [newStageTitle, setNewStageTitle] = useState('');

    // Drag & Drop State
    const dragItem = useRef<number | null>(null);
    const dragOverItem = useRef<number | null>(null);

    // Project Info Modal
    const [showProjectInfoModal, setShowProjectInfoModal] = useState(false);
    const [projectForm, setProjectForm] = useState<Partial<Project>>({});
    
    // New Info Field State (in Modal)
    const [newFieldName, setNewFieldName] = useState('');
    const [newFieldType, setNewFieldType] = useState<'TEXT' | 'FILE'>('TEXT');
    const [isUploadingInfoFile, setIsUploadingInfoFile] = useState(false);
    const [isUploadingQR, setIsUploadingQR] = useState(false);
    const [isSavingInfo, setIsSavingInfo] = useState(false);

    // --- SORTED STAGES (By Order) ---
    // Note: We use local state for immediate drag feedback, sync with prop on load
    const [localStages, setLocalStages] = useState<RoadmapStage[]>([]);

    useEffect(() => {
        setLocalStages([...roadmap.stages].sort((a,b) => a.order - b.order));
    }, [roadmap.stages]);

    // Update form when project prop changes
    useEffect(() => {
        setProjectForm(project);
    }, [project]);

    // --- ACTIONS ---

    const handleDragStart = (e: React.DragEvent<HTMLDivElement>, position: number) => {
        dragItem.current = position;
    };

    const handleDragEnter = (e: React.DragEvent<HTMLDivElement>, position: number) => {
        dragOverItem.current = position;
    };

    const handleDragEnd = async () => {
        if (dragItem.current === null || dragOverItem.current === null) {
            dragItem.current = null;
            dragOverItem.current = null;
            return;
        }

        const copyListItems = [...localStages];
        const dragItemContent = copyListItems[dragItem.current];
        
        // Remove item from old pos and insert at new pos
        copyListItems.splice(dragItem.current, 1);
        copyListItems.splice(dragOverItem.current, 0, dragItemContent);
        
        dragItem.current = null;
        dragOverItem.current = null;
        
        // Update Order property
        const updatedOrderedStages = copyListItems.map((item, index) => ({
            ...item,
            order: index
        }));

        setLocalStages(updatedOrderedStages);
        
        // Save to DB
        const updatedRoadmap = { ...roadmap, stages: updatedOrderedStages };
        await saveProjectRoadmap(updatedRoadmap);
        onUpdateRoadmap(updatedRoadmap);
    };

    const handleAddStage = async () => {
        if (!newStageTitle.trim()) return;
        
        try {
            const updatedRoadmap = await addNewStageToRoadmap(roadmap, newStageTitle);
            onUpdateRoadmap(updatedRoadmap);
            setNewStageTitle('');
            setIsAddingStage(false);
        } catch (e: any) {
            alert(e.message);
        }
    };

    const handleStageStatusChange = (stageId: string, newStatus: StageStatus) => {
        const updatedStages = roadmap.stages.map(s => {
            if (s.id !== stageId) return s;
            return { ...s, status: newStatus };
        });
        
        // Auto update overall progress logic
        const totalWeight = updatedStages.reduce((s, st) => s + (st.weightPercent || 0), 0);
        const doneWeight = updatedStages.filter(s => s.status === 'COMPLETED').reduce((s, st) => s + (st.weightPercent || 0), 0);
        const progressWeight = updatedStages.filter(s => s.status === 'IN_PROGRESS').reduce((s, st) => s + ((st.weightPercent || 0) * 0.5), 0);
        
        const newProgress = totalWeight > 0 ? Math.round(((doneWeight + progressWeight) / totalWeight) * 100) : 0;

        const newRoadmap = { ...roadmap, stages: updatedStages, overallProgress: newProgress };
        saveProjectRoadmap(newRoadmap);
        onUpdateRoadmap(newRoadmap);
    };

    const handleStageFileUpload = async (stageId: string, e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setUploadingStageId(stageId);
        try {
            const attachment = await uploadFileToDrive(file);
            const stage = roadmap.stages.find(s => s.id === stageId);
            
            // Log automatically attached to stage
            const logContent = `Cập nhật tài liệu/hình ảnh: ${stage?.title}`;

            const updatedMap = await addRoadmapLog(
                roadmap.projectId,
                logContent,
                [attachment],
                { id: currentUser.id, name: currentUser.name, role: 'MANAGER' },
                'Tại văn phòng',
                stageId
            );
            onUpdateRoadmap(updatedMap);
        } catch (err: any) {
            alert("Lỗi upload: " + err.message);
        } finally {
            setUploadingStageId(null);
            e.target.value = '';
        }
    };

    const handleSaveStageInfo = async (stageId: string) => {
        const updatedStages = roadmap.stages.map(s => {
            if (s.id !== stageId) return s;
            return { 
                ...s, 
                title: editStageData.title || s.title,
                description: editStageData.description,
                expectedMaterialDate: editStageData.expectedMaterialDate,
                startDate: editStageData.startDate,
                endDate: editStageData.endDate
            };
        });
        
        const newRoadmap = { ...roadmap, stages: updatedStages };
        await saveProjectRoadmap(newRoadmap);
        onUpdateRoadmap(newRoadmap);
        setEditingStageId(null);
    };

    const handleSaveProjectInfo = async () => {
        if (!onUpdateProject) return;
        setIsSavingInfo(true);
        
        // Ensure ID and other critical fields are kept
        const updated: Project = { 
            ...project, 
            ...projectForm,
            // Ensure type safety and required fields are preserved from original
            id: project.id,
            status: projectForm.status || project.status,
            type: projectForm.type || project.type
        };
        
        try {
            await onUpdateProject(updated);
            alert("Cập nhật thông tin thành công!");
            setShowProjectInfoModal(false);
        } catch (error) {
            console.error("Save error:", error);
            alert("Lỗi khi lưu thông tin dự án. Vui lòng thử lại.");
        } finally {
            setIsSavingInfo(false);
        }
    };
    
    // --- DYNAMIC CONTACT HANDLERS ---
    const handleAddContact = () => {
        const newContact: ProjectContact = {
            id: `ct_${Date.now()}`,
            role: '',
            name: '',
            phone: '',
            isWorkerLogin: false
        };
        setProjectForm(prev => ({
            ...prev,
            contacts: [...(prev.contacts || []), newContact]
        }));
    };

    const handleRemoveContact = (id: string) => {
        setProjectForm(prev => ({
            ...prev,
            contacts: prev.contacts?.filter(c => c.id !== id) || []
        }));
    };

    const handleChangeContact = (id: string, field: keyof ProjectContact, value: any) => {
        setProjectForm(prev => ({
            ...prev,
            contacts: prev.contacts?.map(c => c.id === id ? { ...c, [field]: value } : c) || []
        }));
    };

    // --- DYNAMIC PROJECT INFO HANDLERS ---
    const handleAddInfoField = () => {
        if (!newFieldName.trim()) return;
        
        const newField: ProjectInfoField = {
            id: `info_${Date.now()}`,
            label: newFieldName,
            value: '',
            type: newFieldType
        };
        
        setProjectForm(prev => ({
            ...prev,
            infoFields: [...(prev.infoFields || []), newField]
        }));
        
        setNewFieldName('');
        setNewFieldType('TEXT');
    };

    const handleRemoveInfoField = (fieldId: string) => {
        setProjectForm(prev => ({
            ...prev,
            infoFields: prev.infoFields?.filter(f => f.id !== fieldId) || []
        }));
    };

    const handleUpdateInfoField = (fieldId: string, value: string) => {
        setProjectForm(prev => ({
            ...prev,
            infoFields: prev.infoFields?.map(f => f.id === fieldId ? { ...f, value } : f)
        }));
    };
    
    const handleUploadInfoField = async (fieldId: string, e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        
        setIsUploadingInfoFile(true);
        try {
            const attachment = await uploadFileToDrive(file);
            setProjectForm(prev => ({
                ...prev,
                infoFields: prev.infoFields?.map(f => f.id === fieldId ? { 
                    ...f, 
                    value: attachment.name, // Display name
                    attachment: attachment 
                } : f)
            }));
        } catch (err) {
            alert("Upload thất bại!");
        } finally {
            setIsUploadingInfoFile(false);
        }
    };

    const handleUploadQR = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setIsUploadingQR(true);
        try {
            const attachment = await uploadFileToDrive(file);
            setProjectForm(prev => ({ ...prev, tipQrUrl: attachment.url }));
        } catch (err) {
            alert("Upload QR thất bại.");
        } finally {
            setIsUploadingQR(false);
        }
    };

    const handleDeleteStage = async (stageId: string) => {
        if (!confirm("Xóa giai đoạn này? Dữ liệu nhật ký liên quan vẫn sẽ được giữ.")) return;
        const remainingStages = roadmap.stages.filter(s => s.id !== stageId);
        const updatedRoadmap = { ...roadmap, stages: remainingStages };
        await saveProjectRoadmap(updatedRoadmap);
        onUpdateRoadmap(updatedRoadmap);
    };

    // --- HELPER COMPONENTS ---
    const StageLogs = ({ stageId }: { stageId: string }) => {
        const logs = roadmap.logs.filter(l => l.stageId === stageId).sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        if (logs.length === 0) return <div className="text-[10px] text-slate-400 italic pl-4 py-2">Chưa có nhật ký nào.</div>;

        return (
            <div className="space-y-3 mt-3 pl-4 border-l-2 border-slate-100 ml-2">
                {logs.map(log => (
                    <div key={log.id} className={`p-3 rounded-xl border flex gap-3 group relative ${log.type === 'FEEDBACK' ? 'bg-orange-50 border-orange-100' : 'bg-slate-50 border-slate-100'}`}>
                        {/* Avatar */}
                        <div className={`w-6 h-6 rounded flex items-center justify-center text-[10px] font-bold shrink-0 ${log.performerRole === 'WORKER' ? 'bg-orange-100 text-orange-700' : log.performerRole === 'CUSTOMER' ? 'bg-purple-100 text-purple-700' : 'bg-indigo-100 text-indigo-700'}`}>
                            {log.performerName.charAt(0)}
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="flex justify-between items-start">
                                <p className="text-xs font-bold text-slate-800 flex items-center">
                                    {log.performerName}
                                    {log.type === 'FEEDBACK' && <span className="ml-2 text-[9px] bg-orange-200 text-orange-800 px-1.5 rounded">PHẢN HỒI</span>}
                                </p>
                                <span className="text-[9px] text-slate-400">{new Date(log.timestamp).toLocaleString('vi-VN')}</span>
                            </div>
                            <p className="text-xs text-slate-600 mt-0.5 break-words">{log.content}</p>
                            {log.photos && log.photos.length > 0 && (
                                <div className="flex gap-2 mt-2 overflow-x-auto pb-1">
                                    {log.photos.map((p, idx) => (
                                        p.type === 'IMAGE' ? (
                                            <img key={idx} src={p.url} className="h-12 w-auto rounded border border-slate-200 cursor-pointer hover:opacity-80" onClick={() => window.open(p.url, '_blank')}/>
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
        );
    };

    return (
        <div className="flex flex-col h-full bg-slate-50 overflow-hidden relative">
            
            {/* 1. TOP BAR TOOLBOX */}
            <div className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 shrink-0 z-20 shadow-sm">
                <div className="flex items-center gap-2">
                    <button 
                        onClick={() => { setProjectForm(project); setShowProjectInfoModal(true); }}
                        className="flex items-center px-4 py-2 bg-slate-100 text-slate-700 rounded-lg text-xs font-bold hover:bg-slate-200 transition-all border border-slate-200"
                    >
                        <Settings size={14} className="mr-2"/> Cập nhật Thông tin Dự án
                    </button>
                    <span className="text-[10px] text-slate-400 italic hidden md:inline">
                        (Địa chỉ, Liên hệ, Bản vẽ...)
                    </span>
                </div>
                
                <div className="flex gap-2">
                    <button onClick={onExportReport} className="flex items-center px-3 py-2 bg-indigo-50 text-indigo-700 border border-indigo-100 rounded-lg text-xs font-bold hover:bg-indigo-100 transition-all">
                        <Printer size={14} className="mr-2"/> Xuất báo cáo
                    </button>
                    <div className="w-px h-6 bg-slate-200 self-center mx-1"></div>
                    <button onClick={() => onShare('CUSTOMER')} className="flex items-center px-3 py-2 bg-white border border-slate-200 text-slate-600 rounded-lg text-xs font-bold hover:bg-slate-50 transition-all">
                        <Link size={14} className="mr-2"/> Link CĐT
                    </button>
                    <button onClick={() => onShare('WORKER')} className="flex items-center px-3 py-2 bg-white border border-slate-200 text-slate-600 rounded-lg text-xs font-bold hover:bg-slate-50 transition-all">
                        <Link size={14} className="mr-2"/> Link Thợ
                    </button>
                </div>
            </div>

            {/* 2. MAIN TIMELINE CONTENT */}
            <div className="flex-1 overflow-y-auto p-8 custom-scrollbar bg-slate-100">
                <div className="max-w-4xl mx-auto space-y-8 pb-20">
                    
                    {/* Project Header Summary */}
                    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm mb-8">
                        <div className="flex justify-between items-start">
                            <div>
                                <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight mb-2">{project.name}</h2>
                                <div className="flex flex-wrap gap-4 text-xs font-medium text-slate-500">
                                    <div className="flex items-center"><MapPin size={14} className="mr-1 text-indigo-500"/> {project.address || 'Chưa có địa chỉ'}</div>
                                    <div className="flex items-center"><Calendar size={14} className="mr-1 text-indigo-500"/> Khởi công: {project.startDate || '---'}</div>
                                </div>
                            </div>
                            <div className="text-right">
                                <div className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1">Tiến độ chung</div>
                                <div className="text-3xl font-black text-indigo-600">{roadmap.overallProgress}%</div>
                            </div>
                        </div>
                    </div>

                    {/* Timeline Stages */}
                    <div className="relative pl-6 border-l-2 border-slate-200 space-y-4">
                        {localStages.map((stage, idx) => {
                            const isEditing = editingStageId === stage.id;
                            const isActive = stage.status === 'IN_PROGRESS';
                            const isCompleted = stage.status === 'COMPLETED';

                            return (
                                <div 
                                    key={stage.id} 
                                    className="relative transition-transform duration-200 ease-out"
                                    draggable={!isEditing}
                                    onDragStart={(e) => handleDragStart(e, idx)}
                                    onDragEnter={(e) => handleDragEnter(e, idx)}
                                    onDragEnd={handleDragEnd}
                                    onDragOver={(e) => e.preventDefault()}
                                >
                                    {/* Timeline Node */}
                                    <div className={`absolute -left-[33px] top-4 w-8 h-8 rounded-full border-4 border-slate-100 flex items-center justify-center font-bold text-xs shadow-sm z-10 ${isCompleted ? 'bg-emerald-500 text-white' : isActive ? 'bg-indigo-600 text-white animate-pulse' : 'bg-white text-slate-400'}`}>
                                        {idx + 1}
                                    </div>

                                    <div className={`bg-white rounded-[20px] border shadow-sm transition-all duration-300 ${isActive ? 'border-indigo-200 shadow-indigo-100 ring-1 ring-indigo-50' : 'border-slate-200'} group`}>
                                        
                                        {/* Stage Header */}
                                        <div className="p-4 border-b border-slate-50 flex justify-between items-start bg-slate-50/30 rounded-t-[20px]">
                                            {/* Drag Handle */}
                                            <div className="absolute left-2 top-1/2 -translate-y-1/2 p-2 cursor-move text-slate-300 hover:text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity hidden md:block">
                                                <GripVertical size={16}/>
                                            </div>

                                            <div className="flex-1 ml-4">
                                                {isEditing ? (
                                                    <div className="space-y-3 bg-white p-4 rounded-xl border border-indigo-100 shadow-sm animate-in fade-in">
                                                        <div>
                                                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Tên giai đoạn</label>
                                                            <input 
                                                                className="w-full p-2 border border-slate-200 rounded-lg text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none"
                                                                value={editStageData.title}
                                                                onChange={e => setEditStageData({...editStageData, title: e.target.value})}
                                                            />
                                                        </div>
                                                        <div>
                                                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Mô tả công việc</label>
                                                            <textarea 
                                                                className="w-full p-2 border border-slate-200 rounded-lg text-xs font-medium focus:ring-2 focus:ring-indigo-500 outline-none"
                                                                value={editStageData.description}
                                                                onChange={e => setEditStageData({...editStageData, description: e.target.value})}
                                                                rows={2}
                                                                placeholder="Nhập ghi chú chi tiết..."
                                                            />
                                                        </div>
                                                        
                                                        <div className="grid grid-cols-3 gap-3">
                                                            <div>
                                                                <label className="text-[10px] font-bold text-indigo-500 uppercase tracking-widest block mb-1">Ngày cấp VT (Dự kiến)</label>
                                                                <input type="date" className="w-full p-2 border border-slate-200 rounded-lg text-xs font-bold" value={editStageData.expectedMaterialDate || ''} onChange={e=>setEditStageData({...editStageData, expectedMaterialDate: e.target.value})}/>
                                                            </div>
                                                            <div>
                                                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1">Ngày bắt đầu (DK)</label>
                                                                <input type="date" className="w-full p-2 border border-slate-200 rounded-lg text-xs font-bold" value={editStageData.startDate || ''} onChange={e=>setEditStageData({...editStageData, startDate: e.target.value})}/>
                                                            </div>
                                                            <div>
                                                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1">Ngày kết thúc (DK)</label>
                                                                <input type="date" className="w-full p-2 border border-slate-200 rounded-lg text-xs font-bold" value={editStageData.endDate || ''} onChange={e=>setEditStageData({...editStageData, endDate: e.target.value})}/>
                                                            </div>
                                                        </div>

                                                        <div className="flex gap-2 pt-2 justify-between">
                                                            <button onClick={() => handleDeleteStage(stage.id)} className="px-3 py-1.5 text-rose-500 hover:bg-rose-50 rounded-lg text-[10px] font-bold">Xóa giai đoạn</button>
                                                            <div className="flex gap-2">
                                                                <button onClick={() => setEditingStageId(null)} className="px-3 py-1.5 bg-white border border-slate-200 text-slate-500 rounded-lg text-[10px] font-bold hover:bg-slate-50">Hủy</button>
                                                                <button onClick={() => handleSaveStageInfo(stage.id)} className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-[10px] font-bold hover:bg-indigo-700">Lưu thông tin</button>
                                                            </div>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div className="cursor-pointer" onClick={() => { 
                                                        setEditingStageId(stage.id); 
                                                        setEditStageData({
                                                            title: stage.title,
                                                            description: stage.description,
                                                            expectedMaterialDate: stage.expectedMaterialDate,
                                                            startDate: stage.startDate,
                                                            endDate: stage.endDate
                                                        }); 
                                                    }}>
                                                        <h3 className={`text-base font-black uppercase tracking-tight mb-1 ${isCompleted ? 'text-emerald-700' : isActive ? 'text-indigo-700' : 'text-slate-700'} hover:text-indigo-600 transition-colors`}>
                                                            {stage.title}
                                                        </h3>
                                                        <p className="text-xs text-slate-500 font-medium leading-relaxed">
                                                            {stage.description || <span className="italic text-slate-300">Chưa có mô tả chi tiết.</span>}
                                                        </p>
                                                        
                                                        {(stage.expectedMaterialDate || stage.startDate || stage.endDate) && (
                                                            <div className="flex flex-wrap gap-2 mt-2">
                                                                {stage.expectedMaterialDate && (
                                                                    <div className="flex items-center text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded" title="Ngày cấp vật tư dự kiến">
                                                                        <Truck size={10} className="mr-1"/> {new Date(stage.expectedMaterialDate).toLocaleDateString('vi-VN')}
                                                                    </div>
                                                                )}
                                                                {stage.startDate && (
                                                                    <div className="flex items-center text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-1 rounded" title="Ngày bắt đầu dự kiến">
                                                                        <PlayCircle size={10} className="mr-1"/> {new Date(stage.startDate).toLocaleDateString('vi-VN')}
                                                                    </div>
                                                                )}
                                                                {stage.endDate && (
                                                                    <div className="flex items-center text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-1 rounded" title="Ngày kết thúc dự kiến">
                                                                        <StopCircle size={10} className="mr-1"/> {new Date(stage.endDate).toLocaleDateString('vi-VN')}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>

                                            <div className="flex flex-col items-end gap-2 ml-4">
                                                {/* Status Switcher */}
                                                <div className="relative group/status">
                                                    <button className={`flex items-center px-3 py-1 rounded-full text-[10px] font-black uppercase border ${
                                                        stage.status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-700 border-emerald-200' :
                                                        stage.status === 'IN_PROGRESS' ? 'bg-indigo-100 text-indigo-700 border-indigo-200' :
                                                        stage.status === 'BLOCKED' ? 'bg-rose-100 text-rose-700 border-rose-200' :
                                                        'bg-slate-100 text-slate-500 border-slate-200'
                                                    }`}>
                                                        {stage.status === 'COMPLETED' ? 'Đã xong' : stage.status === 'IN_PROGRESS' ? 'Đang làm' : stage.status === 'BLOCKED' ? 'Vướng mắc' : 'Chưa làm'}
                                                        <ChevronDown size={12} className="ml-1"/>
                                                    </button>
                                                    <div className="absolute right-0 mt-1 w-32 bg-white rounded-xl shadow-xl border border-slate-100 overflow-hidden hidden group-hover/status:block z-20 animate-in fade-in zoom-in-95">
                                                        {[
                                                            { s: 'PENDING', l: 'Chưa làm', c: 'text-slate-600' },
                                                            { s: 'IN_PROGRESS', l: 'Đang làm', c: 'text-indigo-600' },
                                                            { s: 'COMPLETED', l: 'Đã xong', c: 'text-emerald-600' },
                                                            { s: 'BLOCKED', l: 'Vướng mắc', c: 'text-rose-600' }
                                                        ].map(opt => (
                                                            <button 
                                                                key={opt.s}
                                                                onClick={() => handleStageStatusChange(stage.id, opt.s as any)}
                                                                className={`w-full text-left px-4 py-2 text-xs font-bold hover:bg-slate-50 ${opt.c}`}
                                                            >
                                                                {opt.l}
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>

                                                {/* Quick Actions */}
                                                <div className="flex gap-1">
                                                    <button 
                                                        onClick={() => { 
                                                            setEditingStageId(stage.id); 
                                                            setEditStageData({
                                                                title: stage.title,
                                                                description: stage.description,
                                                                expectedMaterialDate: stage.expectedMaterialDate,
                                                                startDate: stage.startDate,
                                                                endDate: stage.endDate
                                                            }); 
                                                        }}
                                                        className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors" 
                                                        title="Sửa kế hoạch"
                                                    >
                                                        <Edit3 size={14}/>
                                                    </button>
                                                    
                                                    {/* Document Upload Button */}
                                                    <label className="p-1.5 text-slate-400 hover:text-green-600 hover:bg-green-50 rounded transition-colors cursor-pointer" title="Up tài liệu/Ảnh">
                                                        {uploadingStageId === stage.id ? <Loader2 size={14} className="animate-spin"/> : <FileText size={14}/>}
                                                        <input type="file" className="hidden" accept="image/*,.pdf,.doc,.docx,.xls,.xlsx" onChange={(e) => handleStageFileUpload(stage.id, e)} disabled={!!uploadingStageId}/>
                                                    </label>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Logs Content */}
                                        <div className="p-4 pt-2">
                                            <StageLogs stageId={stage.id} />
                                        </div>
                                    </div>
                                </div>
                            );
                        })}

                        {/* Add New Stage Button */}
                        <div className="relative pl-0 mt-8">
                            {isAddingStage ? (
                                <div className="bg-white rounded-[20px] border-2 border-indigo-200 shadow-sm p-4 animate-in fade-in">
                                    <label className="text-[10px] font-bold text-indigo-500 uppercase tracking-widest block mb-2">Tên giai đoạn mới</label>
                                    <input 
                                        className="w-full p-3 border border-slate-200 rounded-xl font-bold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500 mb-3"
                                        placeholder="Ví dụ: Lắp đặt thiết bị chiếu sáng..."
                                        autoFocus
                                        value={newStageTitle}
                                        onChange={e => setNewStageTitle(e.target.value)}
                                        onKeyDown={e => e.key === 'Enter' && handleAddStage()}
                                    />
                                    <div className="flex justify-end gap-2">
                                        <button onClick={() => setIsAddingStage(false)} className="px-4 py-2 text-slate-500 hover:bg-slate-100 rounded-xl text-xs font-bold">Hủy</button>
                                        <button onClick={handleAddStage} className="px-6 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 shadow-md">Thêm Giai Đoạn</button>
                                    </div>
                                </div>
                            ) : (
                                <button 
                                    onClick={() => setIsAddingStage(true)}
                                    className="w-full py-4 border-2 border-dashed border-slate-300 rounded-[20px] text-slate-400 font-bold uppercase text-xs tracking-widest hover:border-indigo-400 hover:text-indigo-600 hover:bg-indigo-50 transition-all flex items-center justify-center gap-2 group"
                                >
                                    <div className="w-8 h-8 rounded-full bg-slate-100 group-hover:bg-indigo-200 flex items-center justify-center transition-colors">
                                        <Plus size={16} className="text-slate-400 group-hover:text-indigo-700"/>
                                    </div>
                                    Thêm giai đoạn mới
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* MODAL: PROJECT INFO UPDATE & DYNAMIC FIELDS */}
            {showProjectInfoModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-white rounded-[32px] shadow-2xl w-full max-w-2xl p-8 flex flex-col max-h-[90vh]">
                        <div className="flex justify-between items-center mb-6 shrink-0">
                            <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Thông tin dự án & Tài liệu</h3>
                            <button onClick={() => setShowProjectInfoModal(false)}><X className="text-slate-400 hover:text-slate-600"/></button>
                        </div>
                        
                        <div className="space-y-6 overflow-y-auto flex-1 custom-scrollbar pr-2">
                            {/* Static Info Section */}
                            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 space-y-4">
                                <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">Thông tin cơ bản</h4>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Tên dự án</label>
                                    <input className="w-full border-2 border-slate-200 rounded-xl p-3 font-bold text-slate-800 focus:border-indigo-500 outline-none" value={projectForm.name || ''} onChange={e => setProjectForm({...projectForm, name: e.target.value})} />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Địa chỉ thi công</label>
                                    <input className="w-full border-2 border-slate-200 rounded-xl p-3 font-bold text-slate-800 focus:border-indigo-500 outline-none" value={projectForm.address || ''} onChange={e => setProjectForm({...projectForm, address: e.target.value})} />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Ngày khởi công</label>
                                        <input type="date" className="w-full border-2 border-slate-200 rounded-xl p-3 font-bold text-slate-800 focus:border-indigo-500 outline-none" value={projectForm.startDate || ''} onChange={e => setProjectForm({...projectForm, startDate: e.target.value})} />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Dự kiến xong</label>
                                        <input type="date" className="w-full border-2 border-slate-200 rounded-xl p-3 font-bold text-slate-800 focus:border-indigo-500 outline-none" value={projectForm.endDate || ''} onChange={e => setProjectForm({...projectForm, endDate: e.target.value})} />
                                    </div>
                                </div>
                            </div>

                            {/* DYNAMIC CONTACTS SECTION */}
                            <div className="bg-indigo-50 p-4 rounded-xl border border-indigo-100 space-y-4">
                                <div className="flex justify-between items-center">
                                    <h4 className="text-xs font-black text-indigo-500 uppercase tracking-widest flex items-center">
                                        <Users size={14} className="mr-1"/> Liên hệ dự án (Tùy chọn)
                                    </h4>
                                    <button onClick={handleAddContact} className="flex items-center text-[10px] font-bold bg-white text-indigo-600 px-2 py-1 rounded border border-indigo-200 hover:bg-indigo-50">
                                        <Plus size={12} className="mr-1"/> Thêm người
                                    </button>
                                </div>
                                
                                {projectForm.contacts && projectForm.contacts.length > 0 ? (
                                    <div className="space-y-3">
                                        {projectForm.contacts.map((contact, idx) => (
                                            <div key={contact.id} className="bg-white p-3 rounded-xl border border-indigo-100 relative group">
                                                <button onClick={() => handleRemoveContact(contact.id)} className="absolute top-2 right-2 text-slate-300 hover:text-red-500 p-1">
                                                    <Trash2 size={14}/>
                                                </button>
                                                <div className="grid grid-cols-2 gap-2 mb-2 pr-6">
                                                    <div>
                                                        <label className="text-[9px] font-bold text-slate-400 uppercase block mb-1">Vai trò / Chức danh</label>
                                                        <input 
                                                            className="w-full border border-slate-200 rounded p-1.5 text-xs font-bold" 
                                                            placeholder="VD: Chỉ huy trưởng"
                                                            value={contact.role}
                                                            onChange={(e) => handleChangeContact(contact.id, 'role', e.target.value)}
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="text-[9px] font-bold text-slate-400 uppercase block mb-1">Họ tên</label>
                                                        <input 
                                                            className="w-full border border-slate-200 rounded p-1.5 text-xs font-bold" 
                                                            placeholder="Nguyễn Văn A"
                                                            value={contact.name}
                                                            onChange={(e) => handleChangeContact(contact.id, 'name', e.target.value)}
                                                        />
                                                    </div>
                                                </div>
                                                <div className="flex gap-2 items-end">
                                                    <div className="flex-1">
                                                        <label className="text-[9px] font-bold text-slate-400 uppercase block mb-1">Số điện thoại</label>
                                                        <input 
                                                            className="w-full border border-slate-200 rounded p-1.5 text-xs font-bold" 
                                                            placeholder="0912..."
                                                            value={contact.phone}
                                                            onChange={(e) => handleChangeContact(contact.id, 'phone', e.target.value)}
                                                        />
                                                    </div>
                                                    <label className="flex items-center gap-2 cursor-pointer bg-slate-50 px-2 py-1.5 rounded border border-slate-200">
                                                        <input 
                                                            type="checkbox" 
                                                            checked={contact.isWorkerLogin} 
                                                            onChange={(e) => handleChangeContact(contact.id, 'isWorkerLogin', e.target.checked)}
                                                            className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500"
                                                        />
                                                        <span className="text-[10px] font-bold text-slate-600">Cho phép đăng nhập (Thợ)</span>
                                                    </label>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-xs text-indigo-400 italic text-center py-2">Chưa có thông tin liên hệ. Nhấn "Thêm người" để bắt đầu.</p>
                                )}
                            </div>

                            {/* Contact Info (Quick Edit for Customer Login) */}
                             <div className="bg-orange-50 p-4 rounded-xl border border-orange-100 space-y-4">
                                <h4 className="text-xs font-black text-orange-500 uppercase tracking-widest flex items-center"><Phone size={14} className="mr-1"/> Tài khoản CĐT (Khách hàng)</h4>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">SĐT Đăng nhập (View CĐT)</label>
                                    <input className="w-full border-2 border-slate-200 rounded-xl p-3 font-bold text-slate-800 focus:border-indigo-500 outline-none" value={projectForm.customerPhone || ''} onChange={e => setProjectForm({...projectForm, customerPhone: e.target.value})} placeholder="09xxxx" />
                                </div>
                            </div>

                            {/* QR CODE FOR TIPS */}
                            <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 space-y-3">
                                <h4 className="text-xs font-black text-blue-600 uppercase tracking-widest flex items-center"><QrCode size={14} className="mr-1"/> Mã QR nhận tiền Tip</h4>
                                <div className="flex gap-4 items-center">
                                    <div className="w-20 h-20 bg-white border-2 border-dashed border-blue-200 rounded-xl flex items-center justify-center relative overflow-hidden">
                                        {projectForm.tipQrUrl ? (
                                            <img src={projectForm.tipQrUrl} className="w-full h-full object-cover" />
                                        ) : (
                                            <QrCode size={24} className="text-blue-300"/>
                                        )}
                                        {isUploadingQR && <div className="absolute inset-0 bg-white/80 flex items-center justify-center"><Loader2 className="animate-spin text-blue-500"/></div>}
                                    </div>
                                    <div className="flex-1">
                                        <label className="flex items-center px-4 py-2 bg-white text-blue-600 rounded-xl text-xs font-bold border border-blue-200 cursor-pointer hover:bg-blue-50 w-fit">
                                            <Upload size={14} className="mr-2"/> Tải ảnh QR (Bank/Momo)
                                            <input type="file" className="hidden" accept="image/*" onChange={handleUploadQR} />
                                        </label>
                                        <p className="text-[10px] text-blue-400 mt-2 italic">Hiển thị trong phần "Mời Cafe" của khách hàng.</p>
                                    </div>
                                </div>
                            </div>

                            {/* Dynamic Info Fields Section */}
                            <div className="space-y-4">
                                <h4 className="text-xs font-black text-indigo-600 uppercase tracking-widest border-b border-indigo-50 pb-2">Thông tin mở rộng & Tài liệu</h4>
                                
                                {projectForm.infoFields && projectForm.infoFields.length > 0 ? (
                                    <div className="space-y-3">
                                        {projectForm.infoFields.map((field) => (
                                            <div key={field.id} className="flex gap-3 items-start group">
                                                <div className="flex-1">
                                                    <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">{field.label}</label>
                                                    {field.type === 'TEXT' ? (
                                                        <input 
                                                            className="w-full border border-slate-200 rounded-lg p-2 text-sm font-medium focus:border-indigo-500 outline-none"
                                                            value={field.value}
                                                            onChange={e => handleUpdateInfoField(field.id, e.target.value)}
                                                            placeholder="Nhập thông tin..."
                                                        />
                                                    ) : (
                                                        <div className="flex items-center gap-2">
                                                            {field.attachment ? (
                                                                <a 
                                                                    href={field.attachment.url} 
                                                                    target="_blank" 
                                                                    className="flex-1 flex items-center px-3 py-2 bg-indigo-50 text-indigo-700 rounded-lg text-sm font-bold border border-indigo-100 hover:bg-indigo-100 truncate"
                                                                >
                                                                    <FileText size={16} className="mr-2"/> {field.attachment.name}
                                                                </a>
                                                            ) : (
                                                                <div className="flex-1 p-2 border border-dashed border-slate-300 rounded-lg text-xs text-slate-400 text-center italic">
                                                                    Chưa có file
                                                                </div>
                                                            )}
                                                            <label className="p-2 bg-slate-100 text-slate-500 rounded-lg hover:bg-indigo-50 hover:text-indigo-600 cursor-pointer">
                                                                {isUploadingInfoFile ? <Loader2 size={16} className="animate-spin"/> : <Upload size={16}/>}
                                                                <input type="file" className="hidden" onChange={(e) => handleUploadInfoField(field.id, e)} disabled={isUploadingInfoFile}/>
                                                            </label>
                                                        </div>
                                                    )}
                                                </div>
                                                <button onClick={() => handleRemoveInfoField(field.id)} className="mt-6 p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                                                    <Trash2 size={16}/>
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="text-center py-6 border-2 border-dashed border-slate-200 rounded-xl text-slate-400 text-xs italic">
                                        Chưa có thông tin bổ sung. Thêm trường bên dưới.
                                    </div>
                                )}

                                {/* Add New Field Control */}
                                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 flex gap-3 items-end">
                                    <div className="flex-1">
                                        <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">Tên trường mới</label>
                                        <input 
                                            className="w-full border border-slate-200 rounded-lg p-2 text-xs font-bold" 
                                            placeholder="VD: Bản vẽ thi công, Mật khẩu WiFi..." 
                                            value={newFieldName}
                                            onChange={e => setNewFieldName(e.target.value)}
                                        />
                                    </div>
                                    <div className="w-24">
                                        <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">Loại</label>
                                        <select 
                                            className="w-full border border-slate-200 rounded-lg p-2 text-xs font-bold"
                                            value={newFieldType}
                                            onChange={e => setNewFieldType(e.target.value as any)}
                                        >
                                            <option value="TEXT">Văn bản</option>
                                            <option value="FILE">File/Ảnh</option>
                                        </select>
                                    </div>
                                    <button 
                                        onClick={handleAddInfoField} 
                                        disabled={!newFieldName}
                                        className="h-[34px] px-4 bg-indigo-600 text-white rounded-lg text-xs font-bold uppercase hover:bg-indigo-700 disabled:opacity-50"
                                    >
                                        THÊM
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div className="mt-8 flex gap-3 pt-4 border-t border-slate-100">
                            <button onClick={() => setShowProjectInfoModal(false)} className="flex-1 py-3 bg-white border border-slate-200 text-slate-500 rounded-xl font-bold hover:bg-slate-50">Hủy</button>
                            <button onClick={handleSaveProjectInfo} disabled={isSavingInfo} className="flex-1 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 shadow-lg flex items-center justify-center disabled:opacity-70">
                                {isSavingInfo ? <Loader2 size={18} className="animate-spin mr-2"/> : <Save size={18} className="mr-2"/>}
                                Lưu Thay Đổi
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ManagerView;
