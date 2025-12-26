
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Project, Transaction, TransactionType, TransactionScope, TransactionStatus, Partner, CashAccount, UserContext, Employee, Attachment, PartnerType, ProjectType, Office } from '../types';
import { X, Check, ChevronDown, Paperclip, Upload, Trash2, Layers, PieChart, CreditCard, User, Building2, Calendar, Receipt, Link as LinkIcon, Info, Cloud, Loader2, FileText, CheckCircle2, Camera, Sparkles, ScanLine, RefreshCw, AlertTriangle } from 'lucide-react';
import { createPartner } from '../services/masterDataService';
import { createProject } from '../services/sheetService';
import { fetchOffices } from '../services/officeService';
import { getEmployees } from '../services/employeeService';
import { uploadFileToDrive } from '../services/googleDriveService';
import { extractTransactionFromImage } from '../services/aiExtractionService';
import { TransactionService } from '../services/transactionService'; // IMPORT SERVICE
import { Combobox } from './ui/Combobox';

interface TransactionFormProps {
  projects: Project[];
  partners: Partner[];
  accounts: CashAccount[];
  onAddTransaction: (t: Transaction) => void;
  onCancel: () => void;
  onAddProject: (p: Project) => void; 
  onAddPartner: (p: Partner) => void; // New Prop
  currentUser: UserContext;
  initialData?: Transaction; 
  initialType?: TransactionType;
}

const TransactionForm: React.FC<TransactionFormProps> = ({ projects, partners, accounts, onAddTransaction, onCancel, onAddProject, onAddPartner, currentUser, initialData, initialType }) => {
  const [formData, setFormData] = useState<Partial<Transaction>>({
    type: initialData?.type || initialType || TransactionType.EXPENSE,
    date: new Date().toISOString().split('T')[0],
    amount: 0,
    scope: TransactionScope.PROJECT,
    category: '',
    costGroup: 'OTHER',
    description: '',
    status: initialData?.status || TransactionStatus.SUBMITTED, 
    code: initialData?.code || '',
    hasVATInvoice: false,
    requesterId: currentUser.id,
    targetAccountId: '',
    ...initialData
  });

  const [selectedProject, setSelectedProject] = useState<Project | null>(initialData ? projects.find(p => p.id === initialData.projectId) || null : null);
  const [selectedEntity, setSelectedEntity] = useState<any>(null);
  const [selectedRequester, setSelectedRequester] = useState<Employee | null>(null);
  
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [attachments, setAttachments] = useState<Attachment[]>(initialData?.attachments || []);
  const [offices, setOffices] = useState<Office[]>([]);
  const [selectedOffice, setSelectedOffice] = useState<Office | null>(null);
  
  // Upload & AI States
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Camera States
  const [showCamera, setShowCamera] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);

  const [showQuickAddPartner, setShowQuickAddPartner] = useState(false);
  const [newPartnerName, setNewPartnerName] = useState('');
  const [newPartnerPhone, setNewPartnerPhone] = useState('');

  const [showQuickAddProject, setShowQuickAddProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');

  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    getEmployees().then(em => {
        setEmployees(em);
        const reqId = initialData?.requesterId || currentUser.id;
        const req = em.find(e => e.id === reqId);
        if (req) setSelectedRequester(req);
    });
    
    fetchOffices().then(offs => {
        setOffices(offs);
        if (initialData && (initialData.costCenterType === 'OFFICE' || initialData.costCenterType === 'STORE')) {
            const found = offs.find(o => o.id === initialData.costCenterId);
            if (found) setSelectedOffice(found);
        }
    });

    if (!initialData && !formData.targetAccountId && accounts.length > 0) {
        setFormData(prev => ({...prev, targetAccountId: accounts[0].id}));
    }
    
    // Use Service to generate code if needed
    if (!initialData?.id && !formData.code) {
        const code = TransactionService.generateCode(formData.type || TransactionType.EXPENSE);
        setFormData(prev => ({ ...prev, code }));
    }
  }, [accounts, currentUser.id, initialData]);

  useEffect(() => {
      if (initialData) {
          if (initialData.partnerId) {
              const p = partners.find(pt => pt.id === initialData.partnerId);
              if (p) setSelectedEntity({ ...p, entityType: 'PARTNER' });
          } else if (initialData.employeeId) {
              const e = employees.find(emp => emp.id === initialData.employeeId);
              if (e) setSelectedEntity({ ...e, entityType: 'EMPLOYEE', name: e.fullName });
          }
      }
  }, [initialData, partners, employees]);

  useEffect(() => {
      return () => {
          if (cameraStream) {
              cameraStream.getTracks().forEach(track => track.stop());
          }
      };
  }, [cameraStream]);

  const allEntities = useMemo(() => {
    let displayPartners = partners;
    // Note: Always show all partners but filter visually or logic if needed. 
    // Usually expense can be to anyone, income from anyone.
    // For Income, usually Customer. For Expense, usually Supplier/Labor.
    // But allowing all for flexibility.
    return [
        ...displayPartners.map(p => ({ ...p, entityType: 'PARTNER' })),
        ...employees.map(e => ({ ...e, id: e.id, name: e.fullName, entityType: 'EMPLOYEE', code: e.code }))
    ];
  }, [partners, employees]);

  const startCamera = async () => {
      try {
          const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
          setCameraStream(stream);
          setShowCamera(true);
          setTimeout(() => { if (videoRef.current) videoRef.current.srcObject = stream; }, 100);
      } catch (err) {
          alert("Không thể truy cập camera.");
      }
  };

  const stopCamera = () => {
      if (cameraStream) {
          cameraStream.getTracks().forEach(track => track.stop());
          setCameraStream(null);
      }
      setShowCamera(false);
  };

  const capturePhoto = () => {
      if (videoRef.current && canvasRef.current) {
          const video = videoRef.current;
          const canvas = canvasRef.current;
          const context = canvas.getContext('2d');
          if (context) {
              canvas.width = video.videoWidth;
              canvas.height = video.videoHeight;
              context.drawImage(video, 0, 0, canvas.width, canvas.height);
              canvas.toBlob(async (blob) => {
                  if (blob) {
                      const file = new File([blob], `capture_${Date.now()}.jpg`, { type: 'image/jpeg' });
                      stopCamera();
                      await processFile(file);
                  }
              }, 'image/jpeg', 0.9);
          }
      }
  };

  const processFile = async (file: File) => {
      const blobUrl = URL.createObjectURL(file);
      const tempId = `att_temp_${Date.now()}`;
      
      let type: Attachment['type'] = 'OTHER';
      if (file.type.includes('image')) type = 'IMAGE';
      else if (file.type.includes('pdf')) type = 'PDF';
      else if (file.type.includes('excel')) type = 'EXCEL';

      const localAttachment: Attachment = {
          id: tempId, name: file.name, type, url: blobUrl, mimeType: file.type, size: file.size, syncStatus: 'PENDING'
      };

      setAttachments(prev => [...prev, localAttachment]);

      if (file.type.includes('image')) {
          setIsAnalyzing(true);
          extractTransactionFromImage(file).then((aiResult) => {
              if (aiResult) {
                  setFormData(prev => ({
                      ...prev,
                      amount: aiResult.amount || prev.amount,
                      description: aiResult.description || prev.description,
                      date: aiResult.date || prev.date,
                      type: aiResult.type || prev.type,
                      category: aiResult.type === 'INCOME' ? 'Thu tiền' : (prev.category || 'Chi phí')
                  }));
                  if (aiResult.partnerName) {
                      const matchedPartner = partners.find(p => p.name.toLowerCase().includes(aiResult.partnerName.toLowerCase()));
                      if (matchedPartner) setSelectedEntity({ ...matchedPartner, entityType: 'PARTNER' });
                  }
                  setErrorMessage("✨ AI đã tự động điền thông tin!");
              }
          }).finally(() => setIsAnalyzing(false));
      }

      uploadFileToDrive(file).then((driveMeta) => {
          setAttachments(prev => prev.map(a => a.id === tempId ? { ...a, ...driveMeta, syncStatus: 'SYNCED' } : a));
      });
      if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files?.[0]) processFile(e.target.files[0]);
  };

  const handleQuickAddPartner = async () => {
      if (!newPartnerName) return;
      const isIncome = formData.type === TransactionType.INCOME;
      
      // LOGIC: If Income -> Customer, If Expense -> Supplier (usually)
      const partnerType = isIncome ? PartnerType.CUSTOMER : PartnerType.SUPPLIER;
      const codePrefix = isIncome ? 'KH' : 'NCC';
      
      const newPartner: Partner = {
          id: `pt_${Date.now()}`,
          code: `${codePrefix}-${Date.now().toString().slice(-4)}`,
          name: newPartnerName,
          phone: newPartnerPhone,
          type: partnerType,
          status: 'ACTIVE'
      };
      
      // Update global state via Prop
      onAddPartner(newPartner);
      
      // Set local selection
      setSelectedEntity({ ...newPartner, entityType: 'PARTNER' });
      setShowQuickAddPartner(false);
      setNewPartnerName('');
      setNewPartnerPhone('');
  };

  const handleQuickAddProject = async () => {
      if (!newProjectName) return;
      
      // Use "Retail" logic for quick projects from transaction screen
      const newProject: Project = {
          id: `p_quick_${Date.now()}`,
          code: `ND-Q-${Date.now().toString().slice(-4)}`,
          name: newProjectName,
          type: ProjectType.RETAIL,
          status: 'ACTIVE',
          contractTotalValue: 0,
          customerName: 'Khách vãng lai',
          createdAt: new Date().toISOString()
      };
      
      // Update global state via Prop
      onAddProject(newProject);
      
      // Set local selection
      setSelectedProject(newProject);
      setShowQuickAddProject(false);
      setNewProjectName('');
  };

  const requiresOffice = [TransactionScope.COMPANY_FIXED, TransactionScope.COMMERCIAL, TransactionScope.MARKETING].includes(formData.scope!);

  const handleSave = () => {
    setErrorMessage('');
    
    // Prepare Data Object for Validation
    const transactionData: Partial<Transaction> = {
        ...formData,
        projectId: formData.scope === TransactionScope.PROJECT ? selectedProject?.id : undefined,
        costCenterId: requiresOffice ? selectedOffice?.id : undefined
    };

    // 1. Call Service Validation
    const validationError = TransactionService.validate(transactionData);
    if (validationError) {
        setErrorMessage(validationError);
        return;
    }

    // 2. Prepare Final Object
    let isMaterial = false;
    let isLabor = false;
    if (formData.scope === TransactionScope.PROJECT && formData.type === TransactionType.EXPENSE) {
        if (formData.costGroup === 'MATERIAL') isMaterial = true;
        if (formData.costGroup === 'LABOR') isLabor = true;
    }

    let finalCostCenterId = '';
    let finalCostCenterType: 'PROJECT' | 'OFFICE' | 'STORE' = 'PROJECT';
    
    if (formData.scope === TransactionScope.PROJECT) {
        finalCostCenterId = selectedProject?.id || '';
        finalCostCenterType = 'PROJECT';
    } else if (requiresOffice) {
        finalCostCenterId = selectedOffice?.id || '';
        finalCostCenterType = selectedOffice?.type === 'STORE' ? 'STORE' : 'OFFICE';
    }

    const transaction: Transaction = {
        id: initialData?.id || `t_${Date.now()}`,
        code: formData.code,
        date: formData.date!,
        type: formData.type!,
        amount: Number(formData.amount),
        scope: formData.scope || TransactionScope.PROJECT,
        projectId: formData.scope === TransactionScope.PROJECT ? (selectedProject?.id || '') : '',
        costCenterId: finalCostCenterId,
        costCenterType: finalCostCenterType,
        partnerId: selectedEntity?.entityType === 'PARTNER' ? selectedEntity.id : undefined,
        employeeId: selectedEntity?.entityType === 'EMPLOYEE' ? selectedEntity.id : undefined,
        payerName: selectedEntity ? selectedEntity.name : undefined, 
        performedBy: initialData ? initialData.performedBy : currentUser.id,
        requesterId: selectedRequester?.id || currentUser.id,
        category: formData.category || (formData.type === TransactionType.INCOME ? 'Thu tiền' : 'Chi phí'),
        costGroup: formData.costGroup,
        description: formData.description!,
        status: formData.status || TransactionStatus.SUBMITTED,
        targetAccountId: formData.targetAccountId,
        attachments: attachments,
        hasVATInvoice: formData.hasVATInvoice || false, 
        isMaterialCost: isMaterial,
        isLaborCost: isLabor,
        createdAt: new Date().toISOString()
    };

    try {
        onAddTransaction(transaction);
        onCancel();
    } catch (err: any) {
        setErrorMessage("Lỗi: " + err.message);
    }
  };

  const isIncome = formData.type === TransactionType.INCOME;
  const formattedAmount = formData.amount ? formData.amount.toLocaleString('vi-VN') : '';

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const raw = e.target.value.replace(/[^0-9]/g, '');
      setFormData({ ...formData, amount: Number(raw) });
  };

  const handleTypeChange = (type: TransactionType) => {
      setFormData({ 
          ...formData, 
          type, 
          category: type === TransactionType.INCOME ? 'Thu tiền' : 'Chi phí',
          code: TransactionService.generateCode(type)
      });
  };

  return (
    <div className="bg-white rounded-[32px] shadow-2xl w-full max-w-2xl mx-auto overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200 relative z-[9999]">
        {/* HEADER */}
        <div className={`px-8 py-6 transition-colors duration-300 ${isIncome ? 'bg-emerald-600' : 'bg-rose-600'} text-white flex justify-between items-start shrink-0`}>
            <div>
                <div className="flex gap-2 bg-black/20 p-1 rounded-xl w-fit mb-3">
                    <button onClick={() => handleTypeChange(TransactionType.INCOME)} className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${isIncome ? 'bg-white text-emerald-700 shadow-sm' : 'text-white/60 hover:bg-white/10'}`}>Phiếu Thu</button>
                    <button onClick={() => handleTypeChange(TransactionType.EXPENSE)} className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${!isIncome ? 'bg-white text-rose-700 shadow-sm' : 'text-white/60 hover:bg-white/10'}`}>Phiếu Chi</button>
                </div>
                <div className="flex items-center gap-3">
                    <h2 className="text-2xl font-black tracking-tight">{isIncome ? 'Lập Phiếu Thu' : 'Lập Phiếu Chi'}</h2>
                    <div className="bg-white/20 px-3 py-1 rounded-lg text-xs font-mono font-bold flex items-center">#{formData.code}</div>
                </div>
            </div>
            <button onClick={onCancel} className="p-2 hover:bg-white/20 rounded-full transition-colors"><X size={24}/></button>
        </div>

        {/* BODY */}
        <div className="flex-1 overflow-y-auto p-8 space-y-8 bg-slate-50/50 custom-scrollbar">
            
            {/* ALERT BOX */}
            {isAnalyzing && <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-3 flex items-center justify-center text-indigo-700 animate-pulse"><Sparkles size={18} className="mr-2"/> AI đang đọc hóa đơn...</div>}
            {errorMessage && <div className="bg-red-50 border border-red-100 rounded-xl p-3 flex items-center justify-center text-red-700 font-bold text-xs">{errorMessage}</div>}
            
            {/* AMOUNT INPUT */}
            <div className="text-center space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Số tiền giao dịch (VND)</label>
                <input 
                    type="text" autoFocus
                    className={`text-5xl font-black bg-transparent text-center outline-none w-full placeholder-slate-300 ${isIncome ? 'text-emerald-600 caret-emerald-500' : 'text-rose-600 caret-rose-500'}`}
                    placeholder="0" value={formattedAmount} onChange={handleAmountChange}
                />
            </div>

            <div className="bg-white p-6 rounded-[24px] border border-slate-100 shadow-sm space-y-6">
                {/* VAT TOGGLE */}
                <div className="flex items-center gap-3 bg-slate-50 p-3 rounded-xl border border-slate-100 cursor-pointer" onClick={() => setFormData({...formData, hasVATInvoice: !formData.hasVATInvoice})}>
                    <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${formData.hasVATInvoice ? 'bg-indigo-600 border-indigo-600' : 'bg-white border-slate-300'}`}>
                        {formData.hasVATInvoice && <Check size={14} className="text-white"/>}
                    </div>
                    <label className="text-xs font-bold text-slate-700 select-none flex items-center cursor-pointer">
                        <Receipt size={16} className="mr-2 text-slate-400"/> {isIncome ? 'Có Xuất Hóa đơn VAT' : 'Có Lấy Hóa đơn VAT'}
                    </label>
                </div>

                {/* DATE & REQUESTER */}
                <div className="grid grid-cols-2 gap-6">
                    <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 pl-1">Ngày chứng từ</label>
                        <div className="flex items-center bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5">
                            <Calendar size={18} className="text-slate-400 mr-2"/>
                            <input type="date" className="font-bold text-slate-900 bg-transparent text-sm outline-none w-full" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} />
                        </div>
                    </div>
                    <div>
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1 mb-2 block">Người đề nghị</label>
                        <Combobox<Employee> label="" placeholder="Chọn nhân viên..." items={employees} selectedItem={selectedRequester} onSelect={(emp) => { setSelectedRequester(emp); setFormData(prev => ({ ...prev, requesterId: emp.id })); }} displayValue={e => e.fullName} renderItem={e => <div className="py-1"><div className="font-bold text-slate-800 text-sm">{e.fullName}</div></div>} filterFunction={(e, q) => e.fullName.toLowerCase().includes(q.toLowerCase())} />
                    </div>
                </div>

                {/* SCOPE */}
                <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 pl-1">Mục đích hạch toán</label>
                    <div className="relative">
                        <Layers size={18} className="absolute left-3 top-3 text-slate-400"/>
                        <select className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none appearance-none" value={formData.scope} onChange={e => { setFormData({...formData, scope: e.target.value as TransactionScope}); setSelectedProject(null); setSelectedOffice(null); }}>
                            <option value={TransactionScope.PROJECT}>Công trình / Dự án</option>
                            <option value={TransactionScope.COMPANY_FIXED}>Văn phòng / Hành chính</option>
                            <option value={TransactionScope.COMMERCIAL}>Thương mại / Cửa hàng</option>
                            <option value={TransactionScope.MARKETING}>Marketing & Sales</option>
                            <option value={TransactionScope.OTHER}>Khác</option>
                        </select>
                        <ChevronDown size={14} className="absolute right-3 top-3.5 text-slate-400 pointer-events-none"/>
                    </div>
                </div>

                {/* CONDITIONAL INPUTS */}
                {formData.scope === TransactionScope.PROJECT && (
                    <div className="animate-in fade-in space-y-6">
                        <Combobox<Project> 
                            label="Thuộc Công trình *" 
                            placeholder="Chọn công trình..." 
                            items={projects} 
                            selectedItem={selectedProject} 
                            onSelect={setSelectedProject} 
                            displayValue={p => p.name} 
                            renderItem={p => <div className="py-1"><div className="font-bold text-slate-800 text-sm">{p.name}</div><div className="text-[10px] text-indigo-500 font-mono font-bold bg-indigo-50 px-1.5 rounded w-fit mt-0.5">{p.code}</div></div>} 
                            filterFunction={(p, q) => p.name.toLowerCase().includes(q.toLowerCase()) || p.code.toLowerCase().includes(q.toLowerCase())} 
                            onAddNew={() => setShowQuickAddProject(true)} 
                        />
                        {!isIncome && (
                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 pl-1">Nhóm Chi Phí *</label>
                                <div className="relative">
                                    <PieChart size={18} className="absolute left-3 top-3 text-slate-400"/>
                                    <select className="w-full pl-10 pr-4 py-2.5 bg-indigo-50/50 border border-indigo-200 rounded-xl text-sm font-bold text-indigo-900 outline-none appearance-none" value={formData.costGroup} onChange={e => setFormData({...formData, costGroup: e.target.value as any})}>
                                        <option value="MATERIAL">Vật tư & Hàng hóa</option>
                                        <option value="LABOR">Nhân công</option>
                                        <option value="OTHER">Khác</option>
                                    </select>
                                    <ChevronDown size={14} className="absolute right-3 top-3.5 text-slate-400 pointer-events-none"/>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {requiresOffice && (
                    <div className="animate-in fade-in">
                        <Combobox<Office> 
                            label={formData.scope === TransactionScope.COMMERCIAL ? 'Cửa Hàng / Kho *' : 'Văn Phòng / Chi Nhánh *'}
                            placeholder="Chọn đơn vị..."
                            items={offices}
                            selectedItem={selectedOffice}
                            onSelect={setSelectedOffice}
                            displayValue={o => o.name}
                            renderItem={o => <div className="py-1"><div className="font-bold text-slate-800 text-sm">{o.name}</div><div className="text-[10px] text-slate-400 font-mono font-bold bg-slate-50 px-1.5 rounded w-fit mt-0.5">{o.code}</div></div>}
                            filterFunction={(o, q) => o.name.toLowerCase().includes(q.toLowerCase()) || o.code.toLowerCase().includes(q.toLowerCase())}
                        />
                    </div>
                )}

                {/* ENTITY & ACCOUNT */}
                <Combobox<any> 
                    label={isIncome ? 'Người nộp tiền (Khách / NV)' : 'Người thụ hưởng'} 
                    placeholder="Tìm nhân viên, đối tác..." 
                    items={allEntities} 
                    selectedItem={selectedEntity} 
                    onSelect={setSelectedEntity} 
                    displayValue={p => p.name} 
                    renderItem={p => <div className="flex justify-between items-center py-1"><div className="font-bold text-sm">{p.name}</div><span className="text-[9px] font-black bg-slate-100 px-2 py-0.5 rounded">{p.entityType === 'EMPLOYEE' ? 'NV' : 'KH/NCC'}</span></div>} 
                    filterFunction={(p, q) => p.name.toLowerCase().includes(q.toLowerCase())} 
                    onAddNew={() => setShowQuickAddPartner(true)} 
                />
                
                <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1 mb-2 block">Tài khoản / Quỹ tiền *</label>
                    <div className="relative">
                        <CreditCard size={18} className="absolute left-3 top-3 text-slate-400"/>
                        <select className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none" value={formData.targetAccountId || ''} onChange={e => setFormData({...formData, targetAccountId: e.target.value})}>
                            <option value="">-- Chọn quỹ --</option>
                            {accounts.map(acc => <option key={acc.id} value={acc.id}>{acc.bankName} - {acc.accountName}</option>)}
                        </select>
                    </div>
                </div>

                {/* DESCRIPTION */}
                <textarea className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium outline-none min-h-[80px] resize-none" placeholder="Nội dung chi tiết..." value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} />

                {/* ATTACHMENTS & CAMERA */}
                <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 border-dashed">
                    <div className="flex justify-between items-center mb-3">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center"><Cloud size={14} className="mr-1.5"/> Chứng từ đính kèm</label>
                    </div>
                    <div className="grid grid-cols-1 gap-2">
                        {attachments.map((att, idx) => (
                            <div key={idx} className="flex items-center justify-between bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
                                <div className="flex items-center gap-3 overflow-hidden">
                                    <div className={`p-2 rounded-lg ${att.type === 'IMAGE' ? 'bg-blue-50 text-blue-600' : 'bg-red-50 text-red-600'}`}>{att.type === 'IMAGE' ? <Cloud size={16}/> : <FileText size={16}/>}</div>
                                    <span className="text-xs font-bold text-slate-700 truncate">{att.name}</span>
                                </div>
                                <button onClick={() => setAttachments(prev => prev.filter((_,i) => i !== idx))} className="p-2 text-slate-300 hover:text-red-500 rounded-lg"><Trash2 size={16}/></button>
                            </div>
                        ))}
                        <div className="flex gap-2">
                            <div onClick={() => startCamera()} className="flex-1 flex flex-col items-center justify-center p-4 rounded-xl border-2 border-dashed border-indigo-200 bg-indigo-50 hover:bg-indigo-100 cursor-pointer transition-all">
                                <Camera size={20} className="text-indigo-500 mb-1"/>
                                <span className="text-[10px] font-bold text-indigo-700 uppercase">Chụp ảnh (Auto-Fill)</span>
                            </div>
                            <div onClick={() => fileInputRef.current?.click()} className="flex-1 flex flex-col items-center justify-center p-4 rounded-xl border-2 border-dashed border-slate-200 bg-white hover:bg-slate-50 cursor-pointer transition-all">
                                <Upload size={20} className="text-slate-400 mb-1"/>
                                <span className="text-[10px] font-bold text-slate-500 uppercase">Tải lên file</span>
                                <input ref={fileInputRef} type="file" className="hidden" accept="image/*,.pdf,.xls,.xlsx" onChange={handleFileSelect} />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        {/* FOOTER */}
        <div className="px-8 py-5 border-t border-slate-100 bg-white flex justify-end gap-4 shrink-0">
            <button onClick={onCancel} className="px-6 py-3 text-slate-400 font-black uppercase text-[11px] tracking-widest hover:text-slate-600">Hủy bỏ</button>
            <button onClick={handleSave} disabled={isAnalyzing} className={`px-10 py-3 rounded-2xl font-black text-[11px] uppercase tracking-widest shadow-xl text-white flex items-center ${isIncome ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-rose-600 hover:bg-rose-700'} disabled:opacity-70`}>
                {isAnalyzing ? <Loader2 size={18} className="animate-spin mr-2"/> : <Check size={18} className="mr-2"/>}
                {isAnalyzing ? 'Đang phân tích...' : 'Lưu Phiếu'}
            </button>
        </div>

        {/* MODAL: QUICK ADD PROJECT */}
        {showQuickAddProject && (
            <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/50 p-4">
                <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl animate-in zoom-in duration-200">
                    <h3 className="font-bold text-lg mb-4">Thêm nhanh công trình</h3>
                    <input 
                        className="w-full border-2 border-slate-100 rounded-xl p-3 font-bold mb-4 outline-none focus:border-indigo-500"
                        placeholder="Tên công trình (VD: Nhà anh A...)"
                        value={newProjectName}
                        onChange={e => setNewProjectName(e.target.value)}
                        autoFocus
                    />
                    <div className="flex gap-2">
                        <button onClick={() => setShowQuickAddProject(false)} className="flex-1 py-2 text-slate-500 font-bold hover:bg-slate-50 rounded-lg">Hủy</button>
                        <button onClick={handleQuickAddProject} disabled={!newProjectName} className="flex-1 py-2 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700">Lưu</button>
                    </div>
                </div>
            </div>
        )}

        {/* MODAL: QUICK ADD PARTNER */}
        {showQuickAddPartner && (
            <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/50 p-4">
                <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl animate-in zoom-in duration-200">
                    <h3 className="font-bold text-lg mb-4">{isIncome ? 'Thêm Khách Hàng Mới' : 'Thêm Đối Tác / NCC Mới'}</h3>
                    <div className="space-y-3">
                        <input 
                            className="w-full border-2 border-slate-100 rounded-xl p-3 font-bold outline-none focus:border-indigo-500"
                            placeholder="Tên (VD: Công ty A, Anh B...)"
                            value={newPartnerName}
                            onChange={e => setNewPartnerName(e.target.value)}
                            autoFocus
                        />
                        <input 
                            className="w-full border-2 border-slate-100 rounded-xl p-3 font-bold outline-none focus:border-indigo-500"
                            placeholder="Số điện thoại (Tùy chọn)"
                            value={newPartnerPhone}
                            onChange={e => setNewPartnerPhone(e.target.value)}
                        />
                    </div>
                    <div className="flex gap-2 mt-4">
                        <button onClick={() => setShowQuickAddPartner(false)} className="flex-1 py-2 text-slate-500 font-bold hover:bg-slate-50 rounded-lg">Hủy</button>
                        <button onClick={handleQuickAddPartner} disabled={!newPartnerName} className="flex-1 py-2 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700">Lưu & Chọn</button>
                    </div>
                </div>
            </div>
        )}

        {showCamera && (
            <div className="fixed inset-0 z-[10000] bg-black flex flex-col items-center justify-center">
                <div className="relative w-full h-full max-w-lg bg-black flex flex-col">
                    <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
                    <canvas ref={canvasRef} className="hidden" />
                    <div className="absolute top-4 right-4 z-10"><button onClick={stopCamera} className="p-3 bg-black/50 text-white rounded-full"><X size={24}/></button></div>
                    <div className="absolute bottom-0 left-0 right-0 p-8 flex justify-center bg-gradient-to-t from-black/80 to-transparent">
                        <button onClick={capturePhoto} className="w-20 h-20 bg-white rounded-full border-4 border-slate-300 shadow-xl flex items-center justify-center hover:scale-105 active:scale-95 transition-transform"><div className="w-16 h-16 bg-white rounded-full border-2 border-slate-900"></div></button>
                    </div>
                </div>
            </div>
        )}
    </div>
  );
};

export default TransactionForm;
