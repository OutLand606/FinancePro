
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Project, Transaction, Contract, TransactionType, TransactionStatus, Attachment, Partner, UserContext, PriceRecord, ContractType, ProjectNote, PartnerType, ContractStatus, CashAccount } from '../types';
import { fetchPartners, createPartner } from '../services/masterDataService';
import { updateProject, getSettings, createTransaction, updateTransaction } from '../services/sheetService';
import { createContract } from '../services/contractService';
import { fetchProjectBOQs } from '../services/procurementService';
import { 
  X, Wallet, TrendingUp, TrendingDown, FileText, ShoppingCart, Building, CheckCircle2, LayoutDashboard, HardHat, Users, Calendar, MapPin, DollarSign, AlertTriangle, ArrowUpRight, ArrowDownLeft, Info,
  Edit2, Clock, ExternalLink, Activity, Plus, Save, BookOpen, Send, Paperclip, MoreVertical, PauseCircle, StopCircle, PlayCircle, Briefcase, RefreshCw, Tag, Link as LinkIcon, Upload, Loader2, User, UserPlus, FileCheck
} from 'lucide-react';
import AttachmentViewer from './AttachmentViewer';
import SmartProcurementTab from './SmartProcurementTab';
import ProjectPartnerInsights from './ProjectPartnerInsights';
import ProjectHRTab from './ProjectHRTab';
import TransactionForm from './TransactionForm'; // Reused for consistency
import { Combobox } from './ui/Combobox';

interface ProjectDetail360Props {
  project: Project;
  projects: Project[];
  transactions: Transaction[];
  contracts: Contract[];
  partners: Partner[];
  onAddTransaction: (t: Transaction) => void;
  onUpdateProject: (p: Project) => void; 
  currentUser: UserContext;
  onClose: () => void;
  priceRecords: PriceRecord[];
  accounts: CashAccount[]; // Added prop
}

const ProjectDetail360: React.FC<ProjectDetail360Props> = ({ 
    project: initialProject, projects, transactions, contracts, partners: initialPartners, onAddTransaction, onUpdateProject, currentUser, onClose, priceRecords, accounts 
}) => {
  const [project, setProject] = useState<Project>(initialProject);
  const [activeTab, setActiveTab] = useState<'OVERVIEW' | 'CASHFLOW' | 'HR' | 'PROCUREMENT' | 'CONTRACTS' | 'DOCS'>('OVERVIEW');
  const [partners, setPartners] = useState<Partner[]>(initialPartners);
  const [selectedAttachment, setSelectedAttachment] = useState<Attachment | null>(null);
  const [projectSheetUrl, setProjectSheetUrl] = useState('');
  
  // Transaction Modal State
  const [showTransModal, setShowTransModal] = useState(false);
  const [transModalType, setTransModalType] = useState<TransactionType>(TransactionType.EXPENSE);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | undefined>(undefined);

  // Contract Modal State
  const [showContractModal, setShowContractModal] = useState(false);
  const [newContractName, setNewContractName] = useState('');
  const [newContractValue, setNewContractValue] = useState<number>(0);
  const [selectedContractPartner, setSelectedContractPartner] = useState<Partner | null>(null);

  // States for Editing Value & Notes
  const [isEditingValue, setIsEditingValue] = useState(false);
  const [editValue, setEditValue] = useState<number>(project.contractTotalValue || 0);
  const [newNote, setNewNote] = useState('');

  // States for Editing Info (Customer, Address, etc.)
  const [isEditingInfo, setIsEditingInfo] = useState(false);
  const [infoForm, setInfoForm] = useState<Partial<Project>>({});
  
  // Quick Add Customer State
  const [showQuickAddCustomer, setShowQuickAddCustomer] = useState(false);
  const [newCustomerName, setNewCustomerName] = useState('');
  const [newCustomerPhone, setNewCustomerPhone] = useState('');
  
  // Docs aggregation
  const [aggregatedDocs, setAggregatedDocs] = useState<any[]>([]);
  
  // Doc Upload State
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isAddingLink, setIsAddingLink] = useState(false);
  const [newLinkUrl, setNewLinkUrl] = useState('');
  const [newLinkName, setNewLinkName] = useState('');
  const [isUploading, setIsUploading] = useState(false);

  // --- FIX: INITIAL LOAD EFFECT ---
  useEffect(() => {
    // Tạo một hàm async riêng biệt bên trong effect
    const loadInitData = async () => {
      try {
        // 1. Load Partners nếu chưa có (dữ liệu rỗng)
        if (initialPartners.length === 0) {
          const fetchedPartners = await fetchPartners();
          setPartners(fetchedPartners);
        }

        // 2. Load Settings từ Backend (Async)
        const settings = await getSettings();
        if (settings.googleSheets?.projectUrl) {
          setProjectSheetUrl(settings.googleSheets.projectUrl);
        }
      } catch (error) {
        console.error("Error loading project details dependencies:", error);
      }
    };

    // Gọi hàm async ngay lập tức
    loadInitData();
  }, [initialPartners]);

  // --- DỮ LIỆU TÀI CHÍNH 360 ---
  const projectTrans = useMemo(() => transactions.filter(t => t.projectId === project.id), [transactions, project.id]);
  const projectContracts = useMemo(() => contracts.filter(c => c.projectId === project.id), [contracts, project.id]);
  
  const totalIncome = projectTrans.filter(t => t.type === TransactionType.INCOME && t.status === TransactionStatus.PAID).reduce((sum, t) => sum + t.amount, 0);
  const totalExpense = projectTrans.filter(t => t.type === TransactionType.EXPENSE && t.status === TransactionStatus.PAID).reduce((sum, t) => sum + t.amount, 0);
  
  // Cost Breakdown
  const materialCost = projectTrans.filter(t => t.type === TransactionType.EXPENSE && t.status === TransactionStatus.PAID && t.isMaterialCost).reduce((sum, t) => sum + t.amount, 0);
  const laborCost = projectTrans.filter(t => t.type === TransactionType.EXPENSE && t.status === TransactionStatus.PAID && t.isLaborCost).reduce((sum, t) => sum + t.amount, 0);
  const otherCost = totalExpense - materialCost - laborCost;

  // Doanh thu kỳ vọng từ Hợp đồng đầu ra
  const revenueFromContracts = projectContracts.filter(c => c.type === ContractType.REVENUE).reduce((sum, c) => sum + c.value, 0);
  const expectedRevenue = project.contractTotalValue || revenueFromContracts || 0; // Ưu tiên giá trị set trên project
  
  // Công nợ CĐT (Phải thu)
  const arDebt = Math.max(0, expectedRevenue - totalIncome);
  // Tiến độ dòng tiền thu
  const collectionProgress = expectedRevenue > 0 ? (totalIncome / expectedRevenue) * 100 : 0;

  // AGGREGATE DOCUMENTS
  useEffect(() => {
      const loadDocs = async () => {
          const docs: any[] = [];
          
          // 1. From Transactions
          projectTrans.forEach(t => {
              if (t.attachments && t.attachments.length > 0) {
                  t.attachments.forEach(att => {
                      docs.push({ 
                          id: att.id, 
                          name: att.name, 
                          type: 'TRANSACTION', 
                          date: t.date, 
                          sourceId: t.id, 
                          sourceName: t.description, 
                          url: att.url, 
                          icon: <FileText size={16}/>
                      });
                  });
              }
          });

          // 2. From Contracts
          projectContracts.forEach(c => {
              if (c.fileLink) {
                  docs.push({
                      id: `c_doc_${c.id}`,
                      name: `Hợp đồng: ${c.name}`,
                      type: 'CONTRACT',
                      date: c.signedDate,
                      sourceId: c.id,
                      sourceName: c.code,
                      url: c.fileLink,
                      isLink: true,
                      icon: <Briefcase size={16}/>
                  });
              }
          });

          // 3. From Procurement (BOQ)
          const boqs = await fetchProjectBOQs(project.id);
          boqs.forEach(b => {
              docs.push({
                  id: b.id,
                  name: `BOQ: ${b.name}`,
                  type: 'BOQ',
                  date: b.createdAt,
                  sourceId: b.id,
                  sourceName: 'Cung ứng',
                  url: b.fileUrl,
                  icon: <ShoppingCart size={16}/>
              });
          });

          // 4. Project Direct Documents
          if (project.documents && project.documents.length > 0) {
              project.documents.forEach((doc, idx) => {
                  docs.push({
                      id: doc.id || `p_doc_${idx}`,
                      name: doc.name,
                      type: 'PROJECT_FILE',
                      date: project.createdAt, 
                      sourceId: project.id,
                      sourceName: 'Hồ sơ dự án',
                      url: doc.url,
                      isLink: doc.type === 'OTHER' && doc.mimeType === 'application/link',
                      icon: <FolderOpenIcon />
                  });
              });
          }

          setAggregatedDocs(docs.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
      };
      if (activeTab === 'DOCS') loadDocs();
  }, [activeTab, projectTrans, projectContracts, project.id, project.documents]);

  const handleUpdateStatus = async (newStatus: 'ACTIVE' | 'COMPLETED' | 'SUSPENDED' | 'CANCELLED') => {
      const updated = { ...project, status: newStatus };
      await updateProject(updated); 
      if (onUpdateProject) {
          onUpdateProject(updated); 
      }
      setProject(updated); 
  };

  const handleSaveContractValue = async () => {
      const updated = { ...project, contractTotalValue: editValue };
      await updateProject(updated);
      if (onUpdateProject) onUpdateProject(updated);
      setProject(updated);
      setIsEditingValue(false);
  };

  const handleAddNote = async () => {
      if (!newNote.trim()) return;
      const note: ProjectNote = {
          id: `note_${Date.now()}`,
          content: newNote,
          author: currentUser.name,
          date: new Date().toISOString()
      };
      const updatedNotes = [note, ...(project.operationalNotes || [])];
      const updatedProject = { ...project, operationalNotes: updatedNotes };
      
      await updateProject(updatedProject);
      if (onUpdateProject) onUpdateProject(updatedProject);
      setProject(updatedProject);
      setNewNote('');
  };

  // --- INFO EDIT HANDLERS ---
  const handleOpenEditInfo = () => {
      setInfoForm(project);
      setIsEditingInfo(true);
  };

  const handleSaveInfo = async () => {
      const updatedProject = { ...project, ...infoForm };
      await updateProject(updatedProject);
      if (onUpdateProject) onUpdateProject(updatedProject);
      setProject(updatedProject);
      setIsEditingInfo(false);
  };

  const handleQuickAddCustomer = async () => {
      if (!newCustomerName) return;
      const newPartner: Partner = {
          id: `pt_${Date.now()}`,
          code: `KH-${Date.now().toString().slice(-4)}`,
          name: newCustomerName,
          phone: newCustomerPhone,
          type: PartnerType.CUSTOMER,
          status: 'ACTIVE'
      };
      
      await createPartner(newPartner);
      setPartners(prev => [newPartner, ...prev]);
      
      setInfoForm(prev => ({
          ...prev, 
          customerId: newPartner.id, 
          customerName: newPartner.name
      }));
      
      setShowQuickAddCustomer(false);
      setNewCustomerName('');
      setNewCustomerPhone('');
  };

  // --- QUICK CONTRACT HANDLER ---
  const handleQuickCreateContract = async () => {
      if(!newContractName || !selectedContractPartner) return;
      
      const newContract: Contract = {
          id: `c_${Date.now()}`,
          code: `HD-${Date.now().toString().slice(-6)}`,
          name: newContractName,
          type: ContractType.SUPPLIER_MATERIAL, // Default generic
          projectId: project.id,
          partnerId: selectedContractPartner.id,
          value: newContractValue,
          signedDate: new Date().toISOString(),
          status: ContractStatus.DRAFT,
          createdAt: new Date().toISOString()
      };

      await createContract(newContract);
      // Force refresh contracts in parent is tricky without callback, 
      // but we update local display via re-render prop if possible or just rely on global sync
      // For now, simple alert and close. In real app, use Context or Prop callback for contracts.
      alert("Đã tạo hợp đồng thành công! Dữ liệu đã đồng bộ về hệ thống.");
      setShowContractModal(false);
      setNewContractName('');
      setNewContractValue(0);
      setSelectedContractPartner(null);
  };

  // --- TRANSACTION HANDLERS ---
  const handleTransactionSave = async (t: Transaction) => {
      // If editing existing
      if (editingTransaction) {
          await updateTransaction(t);
          // Manually update local list for immediate feedback if needed, 
          // but better to rely on parent passing updated transactions or trigger a reload
          // Here we just call onAddTransaction which might be a misnomer if it handles update in parent
          // Assuming parent handles add, we might need onUpdateTransaction prop. 
          // For now, treat as Add for UI simplicity in this scope or reload.
      } else {
          await createTransaction(t);
          onAddTransaction(t);
      }
      setShowTransModal(false);
      setEditingTransaction(undefined);
  };

  // --- DOCUMENT HANDLERS ---
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files.length > 0) {
          setIsUploading(true);
          const file = e.target.files[0];
          if (file.size > 5 * 1024 * 1024) {
              alert("File quá lớn (>5MB). Vui lòng dùng tính năng dán Link để tối ưu bộ nhớ.");
              setIsUploading(false);
              return;
          }

          const reader = new FileReader();
          reader.onloadend = async () => {
              const newDoc: Attachment = {
                  id: `doc_${Date.now()}`,
                  name: file.name,
                  type: file.type.includes('image') ? 'IMAGE' : 'PDF',
                  url: reader.result as string,
                  mimeType: file.type,
                  size: file.size
              };
              
              const updatedDocs = [newDoc, ...(project.documents || [])];
              const updatedProject = { ...project, documents: updatedDocs };
              await updateProject(updatedProject);
              if (onUpdateProject) onUpdateProject(updatedProject);
              setProject(updatedProject);
              setIsUploading(false);
          };
          reader.readAsDataURL(file);
      }
  };

  const handleSaveLink = async () => {
      if (!newLinkUrl || !newLinkName) return;
      const newDoc: Attachment = {
          id: `link_${Date.now()}`,
          name: newLinkName,
          type: 'OTHER',
          url: newLinkUrl,
          mimeType: 'application/link'
      };
      
      const updatedDocs = [newDoc, ...(project.documents || [])];
      const updatedProject = { ...project, documents: updatedDocs };
      await updateProject(updatedProject);
      if (onUpdateProject) onUpdateProject(updatedProject);
      setProject(updatedProject);
      
      setIsAddingLink(false);
      setNewLinkName('');
      setNewLinkUrl('');
  };

  const CostControlBar = ({ label, value, total, minGood, maxGood, color }: any) => {
      const percentage = total > 0 ? (value / total) * 100 : 0;
      let statusColor = 'bg-gray-200';
      let statusText = 'Chưa có dữ liệu';

      if (total > 0) {
          if (percentage >= minGood && percentage <= maxGood) {
              statusColor = 'bg-emerald-500';
              statusText = 'Tốt (Trong định mức)';
          } else if (percentage > maxGood) {
              statusColor = 'bg-rose-500';
              statusText = 'Cảnh báo (Vượt định mức)';
          } else {
              statusColor = 'bg-amber-500';
              statusText = 'Thấp (Cần xem xét)';
          }
      }

      return (
          <div className="mb-4">
              <div className="flex justify-between items-end mb-1">
                  <span className="text-[10px] font-black uppercase text-slate-500 tracking-widest">{label}</span>
                  <span className="text-xs font-bold text-slate-700">{percentage.toFixed(1)}% <span className="text-[10px] text-slate-400 font-normal">({value.toLocaleString()} ₫)</span></span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden mb-1">
                  <div className={`h-full rounded-full transition-all duration-500 ${statusColor}`} style={{width: `${Math.min(percentage, 100)}%`}}></div>
              </div>
              <div className="flex justify-between text-[9px]">
                  <span className="text-slate-400">Mục tiêu: {minGood}% - {maxGood}%</span>
                  <span className={`font-bold ${statusColor.replace('bg-', 'text-')}`}>{statusText}</span>
              </div>
          </div>
      );
  };

  const FolderOpenIcon = () => <Briefcase size={16} className="text-indigo-500"/>;

  const renderOverview = () => (
    <div className="space-y-6 animate-in fade-in">
        {/* Hàng 1: Tài chính tổng quát */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-[24px] border border-slate-100 shadow-sm">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 flex items-center"><ArrowDownLeft size={14} className="mr-1 text-emerald-500"/> Đã Thu (Real)</p>
                <p className="text-2xl font-black text-emerald-600">{totalIncome.toLocaleString()} ₫</p>
                <div className="w-full bg-slate-100 h-1 rounded-full mt-3 overflow-hidden">
                    <div className="bg-emerald-500 h-full" style={{width: `${Math.min(collectionProgress, 100)}%`}}></div>
                </div>
            </div>
            <div className="bg-white p-5 rounded-[24px] border border-slate-100 shadow-sm">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 flex items-center"><ArrowUpRight size={14} className="mr-1 text-rose-500"/> Đã Chi (Real)</p>
                <p className="text-2xl font-black text-rose-600">{totalExpense.toLocaleString()} ₫</p>
            </div>
            <div className="bg-white p-5 rounded-[24px] border border-slate-100 shadow-sm">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 flex items-center"><TrendingUp size={14} className="mr-1 text-indigo-500"/> Lãi Tạm Tính</p>
                <p className="text-2xl font-black text-indigo-600">{(totalIncome - totalExpense).toLocaleString()} ₫</p>
            </div>
            <div className="bg-orange-50 p-5 rounded-[24px] border border-orange-100 shadow-sm">
                <p className="text-[10px] font-black text-orange-500 uppercase tracking-widest mb-1 flex items-center"><DollarSign size={14} className="mr-1"/> Công nợ CĐT</p>
                <p className="text-2xl font-black text-orange-700">{arDebt.toLocaleString()} ₫</p>
            </div>
        </div>

        {/* Hàng 2: Thông tin, Chi phí & Nhật ký */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
                <div className="bg-white p-8 rounded-[32px] border border-slate-100 shadow-sm relative group">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="font-black text-slate-900 uppercase tracking-tight flex items-center gap-2">
                            <Info size={18} className="text-indigo-600"/> Thông tin hành chính
                        </h3>
                        <button onClick={handleOpenEditInfo} className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-slate-50 rounded-xl transition-all opacity-0 group-hover:opacity-100">
                            <Edit2 size={18}/>
                        </button>
                    </div>
                    <div className="grid grid-cols-2 gap-y-6 gap-x-12">
                        <div>
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Khách hàng / CĐT</label>
                            <p className="font-bold text-slate-900 text-lg mt-1 flex items-center">
                                <User size={16} className="text-slate-400 mr-2"/>
                                {project.customerName || 'Khách vãng lai'}
                            </p>
                        </div>
                        <div>
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Địa điểm thi công</label>
                            <p className="font-bold text-slate-900 mt-1 flex items-center gap-1"><MapPin size={14} className="text-slate-400"/> {project.address || 'Chưa cập nhật'}</p>
                        </div>
                        <div>
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Ngày khởi công</label>
                            <p className="font-bold text-slate-900 mt-1 flex items-center gap-1"><Calendar size={14} className="text-slate-400"/> {project.startDate || '---'}</p>
                        </div>
                        <div>
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Ngày hoàn thành (Dự kiến)</label>
                            <p className="font-bold text-slate-900 mt-1 flex items-center gap-1"><CheckCircle2 size={14} className="text-slate-400"/> {project.endDate || '---'}</p>
                        </div>
                    </div>
                </div>

                {/* COST CONTROL WIDGET */}
                <div className="bg-white p-8 rounded-[32px] border border-slate-100 shadow-sm">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="font-black text-slate-900 uppercase tracking-tight flex items-center gap-2">
                            <Activity size={18} className="text-rose-600"/> Kiểm soát Chi Phí (Cost Control)
                        </h3>
                        {projectSheetUrl && (
                            <a href={projectSheetUrl} target="_blank" rel="noreferrer" className="flex items-center text-[10px] font-bold uppercase text-green-700 bg-green-50 px-3 py-1.5 rounded-lg hover:bg-green-100">
                                <ExternalLink size={12} className="mr-1"/> Xem Sổ Chi Phí Online
                            </a>
                        )}
                    </div>
                    <div className="space-y-6">
                        <CostControlBar label="Chi phí Vật Tư & Hàng Hóa" value={materialCost} total={expectedRevenue} minGood={35} maxGood={50} />
                        <CostControlBar label="Chi phí Nhân Công" value={laborCost} total={expectedRevenue} minGood={10} maxGood={12} />
                        <CostControlBar label="Chi phí Khác (Hoa hồng / Đối ngoại)" value={otherCost} total={expectedRevenue} minGood={0} maxGood={5} />
                    </div>
                </div>
            </div>

            <div className="flex flex-col gap-6">
                {/* Contract Value Card */}
                <div className="bg-indigo-900 p-8 rounded-[32px] text-white shadow-xl flex flex-col justify-between">
                    <div>
                        <h3 className="font-black uppercase tracking-tight text-indigo-300 text-sm mb-4">Giá trị Hợp Đồng</h3>
                        {isEditingValue ? (
                            <div className="flex items-center gap-2">
                                <input 
                                    type="number" 
                                    className="bg-indigo-800 text-white font-black text-xl p-2 rounded-lg w-full outline-none border border-indigo-600 focus:border-indigo-400"
                                    value={editValue}
                                    onChange={e => setEditValue(Number(e.target.value))}
                                    autoFocus
                                />
                                <button onClick={handleSaveContractValue} className="p-2 bg-emerald-500 rounded-lg hover:bg-emerald-600"><CheckCircle2 size={20}/></button>
                            </div>
                        ) : (
                            <div className="flex justify-between items-center">
                                <p className="text-3xl font-black text-white">{expectedRevenue.toLocaleString()} ₫</p>
                                <button onClick={() => setIsEditingValue(true)} className="p-2 bg-white/10 rounded-xl hover:bg-white/20 transition-colors">
                                    <Edit2 size={18} />
                                </button>
                            </div>
                        )}
                        <p className="text-[10px] opacity-60 mt-2">Dùng làm căn cứ tính % chi phí.</p>
                    </div>
                </div>

                {/* Operational Notes / Diary */}
                <div className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm flex-1 flex flex-col">
                    <h3 className="font-black text-slate-900 uppercase tracking-tight mb-4 flex items-center gap-2 text-sm">
                        <BookOpen size={16} className="text-blue-600"/> Nhật ký công trình
                    </h3>
                    <div className="flex-1 overflow-y-auto max-h-[300px] space-y-3 pr-2 custom-scrollbar mb-4">
                        {project.operationalNotes && project.operationalNotes.length > 0 ? (
                            project.operationalNotes.map((note) => (
                                <div key={note.id} className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                                    <p className="text-xs font-medium text-slate-700 leading-relaxed whitespace-pre-wrap">{note.content}</p>
                                    <div className="flex justify-between mt-2 pt-2 border-t border-slate-200">
                                        <span className="text-[9px] font-bold text-slate-400 uppercase">{note.author}</span>
                                        <span className="text-[9px] text-slate-400">{new Date(note.date).toLocaleDateString('vi-VN')}</span>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <p className="text-xs text-slate-400 italic text-center py-10">Chưa có ghi chú nào.</p>
                        )}
                    </div>
                    <div className="relative">
                        <input 
                            className="w-full bg-slate-50 border-none rounded-xl py-3 pl-4 pr-10 text-xs font-bold focus:ring-2 focus:ring-indigo-500"
                            placeholder="Thêm ghi chú nhanh..."
                            value={newNote}
                            onChange={e => setNewNote(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handleAddNote()}
                        />
                        <button onClick={handleAddNote} className="absolute right-2 top-1/2 -translate-y-1/2 text-indigo-600 p-1 hover:bg-indigo-50 rounded-lg">
                            <Send size={16}/>
                        </button>
                    </div>
                </div>
            </div>
        </div>

        {/* MODAL: EDIT INFO */}
        {isEditingInfo && (
            <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-slate-900/60 p-4 animate-in fade-in backdrop-blur-sm">
                <div className="bg-white rounded-[32px] w-full max-w-lg shadow-2xl p-8 space-y-6">
                    <div className="flex justify-between items-center border-b border-slate-100 pb-4">
                        <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Cập nhật thông tin</h3>
                        <button onClick={() => setIsEditingInfo(false)} className="p-2 hover:bg-slate-50 rounded-full text-slate-400"><X size={20}/></button>
                    </div>
                    
                    <div className="space-y-4">
                        <div>
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Tên công trình</label>
                            <input 
                                className="w-full border-2 border-slate-100 rounded-xl p-3 font-bold text-slate-800 outline-none focus:border-indigo-500"
                                value={infoForm.name}
                                onChange={e => setInfoForm({...infoForm, name: e.target.value})}
                            />
                        </div>
                        <div>
                            <Combobox<Partner>
                                label="Khách hàng / CĐT"
                                items={partners.filter(p => p.type === PartnerType.CUSTOMER || p.type === PartnerType.BOTH)}
                                selectedItem={partners.find(p => p.id === infoForm.customerId) || null}
                                onSelect={(p) => setInfoForm({...infoForm, customerId: p.id, customerName: p.name})}
                                displayValue={p => p.name}
                                renderItem={p => <div className="font-bold text-sm">{p.name} <span className="font-normal text-slate-400">({p.phone})</span></div>}
                                filterFunction={(p, q) => p.name.toLowerCase().includes(q.toLowerCase())}
                                onAddNew={() => setShowQuickAddCustomer(true)}
                            />
                        </div>
                        <div>
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Địa điểm thi công</label>
                            <input 
                                className="w-full border-2 border-slate-100 rounded-xl p-3 font-bold text-slate-800 outline-none focus:border-indigo-500"
                                value={infoForm.address || ''}
                                onChange={e => setInfoForm({...infoForm, address: e.target.value})}
                                placeholder="Số nhà, đường, quận/huyện..."
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Ngày khởi công</label>
                                <input 
                                    type="date"
                                    className="w-full border-2 border-slate-100 rounded-xl p-3 font-bold text-slate-800 outline-none focus:border-indigo-500"
                                    value={infoForm.startDate || ''}
                                    onChange={e => setInfoForm({...infoForm, startDate: e.target.value})}
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Ngày hoàn thành (Dự kiến)</label>
                                <input 
                                    type="date"
                                    className="w-full border-2 border-slate-100 rounded-xl p-3 font-bold text-slate-800 outline-none focus:border-indigo-500"
                                    value={infoForm.endDate || ''}
                                    onChange={e => setInfoForm({...infoForm, endDate: e.target.value})}
                                />
                            </div>
                        </div>
                    </div>

                    <div className="flex gap-3 pt-2">
                        <button onClick={() => setIsEditingInfo(false)} className="flex-1 py-3 text-slate-500 font-bold hover:bg-slate-50 rounded-xl">Hủy bỏ</button>
                        <button onClick={handleSaveInfo} className="flex-1 py-3 bg-indigo-600 text-white font-bold rounded-xl shadow-lg hover:bg-indigo-700">Lưu thay đổi</button>
                    </div>
                </div>
            </div>
        )}

        {/* MODAL: QUICK ADD CUSTOMER */}
        {showQuickAddCustomer && (
            <div className="fixed inset-0 z-[1100] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-in fade-in">
                <div className="bg-white rounded-[24px] w-full max-w-sm shadow-2xl p-6 space-y-4">
                    <div className="flex items-center gap-2 mb-2">
                        <div className="p-2 bg-emerald-100 text-emerald-600 rounded-lg"><UserPlus size={20}/></div>
                        <h3 className="font-black text-lg text-slate-900">Thêm Khách Hàng Nhanh</h3>
                    </div>
                    <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Tên Khách hàng / CĐT</label>
                        <input className="w-full border-2 border-slate-100 rounded-xl p-3 font-bold outline-none focus:border-emerald-500" value={newCustomerName} onChange={e=>setNewCustomerName(e.target.value)} autoFocus placeholder="Anh A / Chị B..."/>
                    </div>
                    <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Số điện thoại</label>
                        <input className="w-full border-2 border-slate-100 rounded-xl p-3 font-bold outline-none focus:border-emerald-500" value={newCustomerPhone} onChange={e=>setNewCustomerPhone(e.target.value)} placeholder="09xxxx"/>
                    </div>
                    <div className="flex gap-2 pt-2">
                        <button onClick={() => setShowQuickAddCustomer(false)} className="flex-1 py-2.5 text-slate-500 font-bold hover:bg-slate-50 rounded-xl">Hủy</button>
                        <button onClick={handleQuickAddCustomer} className="flex-1 py-2.5 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 shadow-lg shadow-emerald-200">Lưu & Chọn</button>
                    </div>
                </div>
            </div>
        )}
    </div>
  );

  const renderCashflow = () => (
      <div className="bg-white rounded-[32px] border border-slate-100 shadow-sm overflow-hidden animate-in slide-in-from-bottom-4 duration-300">
          <div className="px-8 py-6 border-b border-slate-50 flex justify-between items-center bg-slate-50/50">
              <div>
                  <h3 className="font-black text-slate-900 uppercase tracking-tight">Dòng tiền chi tiết</h3>
                  <p className="text-[10px] text-slate-400 font-bold mt-1">Lịch sử thu chi của dự án</p>
              </div>
              <div className="flex gap-2">
                  <button onClick={() => { setTransModalType(TransactionType.INCOME); setEditingTransaction(undefined); setShowTransModal(true); }} className="flex items-center px-4 py-2 bg-emerald-600 text-white rounded-xl font-bold text-[10px] uppercase hover:bg-emerald-700 shadow-sm transition-all">
                      <ArrowDownLeft size={14} className="mr-1"/> Tạo Phiếu Thu
                  </button>
                  <button onClick={() => { setTransModalType(TransactionType.EXPENSE); setEditingTransaction(undefined); setShowTransModal(true); }} className="flex items-center px-4 py-2 bg-rose-600 text-white rounded-xl font-bold text-[10px] uppercase hover:bg-rose-700 shadow-sm transition-all">
                      <ArrowUpRight size={14} className="mr-1"/> Tạo Phiếu Chi
                  </button>
              </div>
          </div>
          <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 text-slate-400 font-bold uppercase text-[10px] border-b border-slate-100">
                  <tr>
                      <th className="px-8 py-4">Ngày</th>
                      <th className="px-8 py-4">Nội dung / Chứng từ</th>
                      <th className="px-8 py-4">Hạng mục</th>
                      <th className="px-8 py-4 text-right">Số tiền</th>
                  </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                  {projectTrans.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map(t => (
                      <tr 
                        key={t.id} 
                        className="hover:bg-indigo-50/30 transition-colors group cursor-pointer"
                        onClick={() => { setEditingTransaction(t); setTransModalType(t.type); setShowTransModal(true); }}
                      >
                          <td className="px-8 py-4 font-mono text-xs text-slate-500">{new Date(t.date).toLocaleDateString('vi-VN')}</td>
                          <td className="px-8 py-4">
                              <div className="font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">{t.description}</div>
                              <div className="text-[10px] text-slate-400 font-mono mt-0.5 flex items-center">
                                  #{t.code || t.id.slice(-6)} 
                                  {t.attachments && t.attachments.length > 0 && <Paperclip size={10} className="ml-2 text-blue-500"/>}
                              </div>
                          </td>
                          <td className="px-8 py-4">
                              <span className="px-2 py-0.5 bg-slate-100 text-slate-500 rounded text-[10px] font-black uppercase tracking-widest">{t.category}</span>
                          </td>
                          <td className={`px-8 py-4 text-right font-black ${t.type === TransactionType.INCOME ? 'text-emerald-600' : 'text-rose-600'}`}>
                              {t.type === TransactionType.INCOME ? '+' : '-'}{t.amount.toLocaleString()} ₫
                          </td>
                      </tr>
                  ))}
                  {projectTrans.length === 0 && <tr><td colSpan={4} className="p-20 text-center text-slate-400 italic">Chưa có giao dịch phát sinh.</td></tr>}
              </tbody>
          </table>
      </div>
  );

  const renderDocs = () => (
      <div className="space-y-6 animate-in fade-in">
          <div className="flex justify-between items-center bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm">
              <div>
                  <h3 className="font-black text-slate-900 uppercase tracking-tight">Kho Lưu Trữ Tập Trung</h3>
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Tự động đồng bộ từ Sổ Thu Chi, Hợp Đồng & Cung Ứng</div>
              </div>
              <div className="flex gap-2 items-center">
                  {isAddingLink ? (
                      <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-xl animate-in slide-in-from-right-2">
                          <input className="px-3 py-1.5 text-xs bg-white rounded-lg border-none outline-none w-32" placeholder="Tên file..." value={newLinkName} onChange={e=>setNewLinkName(e.target.value)} autoFocus />
                          <input className="px-3 py-1.5 text-xs bg-white rounded-lg border-none outline-none w-48" placeholder="https://drive..." value={newLinkUrl} onChange={e=>setNewLinkUrl(e.target.value)} />
                          <button onClick={handleSaveLink} className="p-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"><CheckCircle2 size={14}/></button>
                          <button onClick={() => setIsAddingLink(false)} className="p-1.5 text-slate-400 hover:text-rose-500"><X size={14}/></button>
                      </div>
                  ) : (
                      <>
                        <button onClick={() => setIsAddingLink(true)} className="flex items-center px-4 py-2 bg-indigo-50 text-indigo-600 rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-indigo-100 transition-all border border-indigo-100">
                            <LinkIcon size={14} className="mr-2"/> Dán Link
                        </button>
                        <button onClick={() => fileInputRef.current?.click()} className="flex items-center px-4 py-2 bg-slate-800 text-white rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-slate-700 transition-all shadow-lg">
                            {isUploading ? <Loader2 size={14} className="animate-spin mr-2"/> : <Upload size={14} className="mr-2"/>}
                            {isUploading ? 'Đang tải...' : 'Tải lên'}
                        </button>
                        <input type="file" ref={fileInputRef} className="hidden" accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.png" onChange={handleFileSelect} />
                      </>
                  )}
              </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {aggregatedDocs.map((doc, idx) => (
                  <div key={`${doc.id}_${idx}`} className="bg-white p-5 rounded-[24px] border border-slate-100 shadow-sm hover:shadow-md transition-all group relative">
                      <div className="flex items-start gap-4">
                          <div className={`p-3 rounded-2xl ${doc.type === 'TRANSACTION' ? 'bg-blue-50 text-blue-600' : doc.type === 'CONTRACT' ? 'bg-purple-50 text-purple-600' : doc.type === 'PROJECT_FILE' ? 'bg-emerald-50 text-emerald-600' : 'bg-orange-50 text-orange-600'}`}>
                              {doc.icon || (doc.type === 'PROJECT_FILE' ? <Briefcase size={16}/> : <FileText size={16}/>)}
                          </div>
                          <div className="flex-1 min-w-0">
                              <h4 className="font-bold text-slate-800 text-sm truncate" title={doc.name}>{doc.name}</h4>
                              <p className="text-[10px] text-slate-400 mt-1 uppercase font-bold tracking-widest">{new Date(doc.date).toLocaleDateString('vi-VN')} • {doc.type}</p>
                              <p className="text-[10px] text-slate-500 mt-2 truncate bg-slate-50 px-2 py-1 rounded w-fit">{doc.sourceName}</p>
                          </div>
                      </div>
                      <div className="mt-4 pt-4 border-t border-slate-50 flex justify-between items-center">
                          {doc.isLink || doc.driveLink ? (
                              <a href={doc.driveLink || doc.url} target="_blank" rel="noreferrer" className="flex items-center text-[10px] font-black text-indigo-600 uppercase tracking-widest hover:underline">
                                  <ExternalLink size={14} className="mr-1"/> Mở Link Drive
                              </a>
                          ) : (
                              <button 
                                onClick={() => setSelectedAttachment({ id: doc.id, name: doc.name, url: doc.url, type: 'OTHER' })} 
                                className="flex items-center text-[10px] font-black text-indigo-600 uppercase tracking-widest hover:underline"
                              >
                                  <Paperclip size={14} className="mr-1"/> Xem File
                              </button>
                          )}
                          <span className={`text-[9px] font-bold px-2 py-0.5 rounded ${doc.type === 'TRANSACTION' ? 'bg-blue-100 text-blue-700' : doc.type === 'CONTRACT' ? 'bg-purple-100 text-purple-700' : doc.type === 'PROJECT_FILE' ? 'bg-emerald-100 text-emerald-700' : 'bg-orange-100 text-orange-700'}`}>
                              {doc.type === 'PROJECT_FILE' ? 'HỒ SƠ' : doc.type}
                          </span>
                      </div>
                  </div>
              ))}
              {aggregatedDocs.length === 0 && (
                  <div className="col-span-full p-20 text-center text-slate-400 italic bg-white rounded-[32px] border border-dashed border-slate-200">
                      Chưa có tài liệu nào được tải lên trong dự án này.
                  </div>
              )}
          </div>
      </div>
  );

  const tabs = [
      { id: 'OVERVIEW', label: 'Tổng Quan 360', icon: LayoutDashboard },
      { id: 'CASHFLOW', label: 'Sổ Thu Chi', icon: Wallet },
      { id: 'HR', label: 'Nhân Sự', icon: Users },
      { id: 'PROCUREMENT', label: 'Cung ứng (BOQ)', icon: ShoppingCart },
      { id: 'CONTRACTS', label: 'Hợp Đồng', icon: FileText },
      { id: 'DOCS', label: 'Hồ sơ & Chứng từ', icon: Paperclip },
  ];

  const getStatusBadge = (status: string) => {
      switch(status) {
          case 'COMPLETED': return <span className="text-[10px] font-black px-3 py-1 rounded-full bg-emerald-100 text-emerald-700 flex items-center shadow-inner"><CheckCircle2 size={12} className="mr-1"/> HOÀN THÀNH</span>;
          case 'SUSPENDED': return <span className="text-[10px] font-black px-3 py-1 rounded-full bg-amber-100 text-amber-700 flex items-center shadow-inner"><PauseCircle size={12} className="mr-1"/> TẠM HOÃN</span>;
          case 'CANCELLED': return <span className="text-[10px] font-black px-3 py-1 rounded-full bg-rose-100 text-rose-700 flex items-center shadow-inner"><StopCircle size={12} className="mr-1"/> ĐÃ HỦY</span>;
          default: return <span className="text-[10px] font-black px-3 py-1 rounded-full bg-blue-100 text-blue-700 flex items-center shadow-inner"><Clock size={12} className="mr-1"/> ĐANG THI CÔNG</span>;
      }
  };

  const renderStatusActions = () => {
        return (
            <div className="flex gap-2 bg-slate-100/50 p-1 rounded-xl">
                <button type="button" onClick={() => handleUpdateStatus('ACTIVE')} className={`px-4 py-2 rounded-lg font-bold text-[10px] uppercase transition-all flex items-center ${project.status === 'ACTIVE' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-500 hover:bg-white'}`}>
                    <PlayCircle size={14} className="mr-1"/> Đang chạy
                </button>
                <button type="button" onClick={() => handleUpdateStatus('SUSPENDED')} className={`px-4 py-2 rounded-lg font-bold text-[10px] uppercase transition-all flex items-center ${project.status === 'SUSPENDED' ? 'bg-amber-500 text-white shadow-md' : 'text-slate-500 hover:bg-white'}`}>
                    <PauseCircle size={14} className="mr-1"/> Tạm hoãn
                </button>
                <button type="button" onClick={() => handleUpdateStatus('COMPLETED')} className={`px-4 py-2 rounded-lg font-bold text-[10px] uppercase transition-all flex items-center ${project.status === 'COMPLETED' ? 'bg-emerald-600 text-white shadow-md' : 'text-slate-500 hover:bg-white'}`}>
                    <CheckCircle2 size={14} className="mr-1"/> Hoàn thành
                </button>
                <button type="button" onClick={() => handleUpdateStatus('CANCELLED')} className={`px-4 py-2 rounded-lg font-bold text-[10px] uppercase transition-all flex items-center ${project.status === 'CANCELLED' ? 'bg-rose-600 text-white shadow-md' : 'text-slate-500 hover:bg-white'}`}>
                    <StopCircle size={14} className="mr-1"/> Hủy
                </button>
            </div>
        );
  }

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm animate-in fade-in duration-200">
        <div className="bg-[#fcfdfe] rounded-[40px] shadow-2xl w-full max-w-7xl h-[92vh] flex flex-col overflow-hidden border border-white/20">
            {/* Header */}
            <div className="px-10 py-8 border-b border-slate-100 flex justify-between items-center bg-white shadow-sm z-10">
                <div className="flex items-center gap-6">
                    <div className="w-16 h-16 bg-indigo-600 rounded-[22px] flex items-center justify-center text-white shadow-xl shadow-indigo-100">
                        <Building size={32} />
                    </div>
                    <div>
                        <div className="flex items-center gap-3 mb-1">
                            <span className="text-[10px] font-black text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full uppercase border border-indigo-100 tracking-widest">{project.code}</span>
                            {getStatusBadge(project.status)}
                        </div>
                        <h2 className="text-3xl font-black text-slate-900 tracking-tight leading-none">{project.name}</h2>
                    </div>
                </div>
                <div className="flex flex-col items-end gap-2">
                    <div className="flex gap-3 relative items-center">
                        {renderStatusActions()}
                        <div className="h-8 w-px bg-slate-100 mx-2"></div>
                        <button onClick={onClose} className="p-3 hover:bg-slate-100 rounded-2xl text-slate-400 transition-colors border border-slate-100"><X size={28} /></button>
                    </div>
                    <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest flex items-center">
                        <Tag size={12} className="mr-1"/> Chọn thẻ trạng thái để cập nhật
                    </div>
                </div>
            </div>

            {/* Navigation Tabs */}
            <div className="px-10 border-b border-slate-100 bg-white flex space-x-1 overflow-x-auto scrollbar-hide shrink-0">
                {tabs.map(tab => (
                    <button 
                        key={tab.id} 
                        onClick={() => setActiveTab(tab.id as any)} 
                        className={`flex items-center px-6 py-5 text-[11px] font-black uppercase tracking-widest border-b-4 transition-all whitespace-nowrap ${activeTab === tab.id ? 'border-indigo-600 text-indigo-600 bg-indigo-50/30' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
                    >
                        <tab.icon size={16} className="mr-2" /> {tab.label}
                    </button>
                ))}
            </div>

            {/* Scrollable Content Area */}
            <div className="flex-1 overflow-y-auto p-10 custom-scrollbar">
                {activeTab === 'OVERVIEW' && renderOverview()}
                {activeTab === 'CASHFLOW' && renderCashflow()}
                {activeTab === 'HR' && <ProjectHRTab project={project} transactions={transactions} />}
                {activeTab === 'PROCUREMENT' && <SmartProcurementTab project={project} partners={partners} currentUser={currentUser} onAddTransaction={onAddTransaction} priceRecords={priceRecords} transactions={transactions} />}
                {activeTab === 'DOCS' && renderDocs()}
                {activeTab === 'CONTRACTS' && (
                    <div className="space-y-6 animate-in fade-in">
                        <div className="flex justify-between items-center bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm">
                            <div>
                                <h3 className="font-black text-slate-900 uppercase tracking-tight">Hợp Đồng Liên Quan</h3>
                                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Quản lý các gói thầu & Hợp đồng đầu ra</div>
                            </div>
                            <button 
                                onClick={() => { 
                                    setNewContractName(''); 
                                    setNewContractValue(0); 
                                    setSelectedContractPartner(null); 
                                    setShowContractModal(true); 
                                }}
                                className="bg-indigo-600 text-white px-6 py-3 rounded-xl font-black uppercase text-[10px] tracking-widest shadow-lg hover:bg-indigo-700 active:scale-95 transition-all flex items-center"
                            >
                                <Plus size={16} className="mr-2"/> Tạo Hợp Đồng Mới
                            </button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {projectContracts.map(c => (
                                <div key={c.id} className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm hover:border-indigo-200 transition-all flex flex-col justify-between group">
                                    <div>
                                        <div className="flex justify-between items-start mb-4">
                                            <span className={`text-[10px] font-black px-2 py-1 rounded-lg border ${c.type === ContractType.REVENUE ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-blue-50 text-blue-600 border-blue-100'}`}>
                                                {c.code}
                                            </span>
                                            <span className="text-[10px] font-bold text-slate-400">{c.status}</span>
                                        </div>
                                        <h4 className="font-black text-slate-900 text-lg group-hover:text-indigo-600 transition-colors mb-2">{c.name}</h4>
                                        <p className="text-xs text-slate-500 flex items-center gap-1 mb-4"><Users size={12}/> {partners.find(p=>p.id===c.partnerId)?.name}</p>
                                    </div>
                                    <div className="pt-4 border-t border-slate-50 flex justify-between items-end">
                                        <div>
                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Giá trị</p>
                                            <p className="text-xl font-black text-indigo-600">{c.value.toLocaleString()} ₫</p>
                                        </div>
                                        <button className="p-2 bg-slate-50 text-slate-400 rounded-xl hover:bg-indigo-50 hover:text-indigo-600 transition-all"><ExternalLink size={18}/></button>
                                    </div>
                                </div>
                            ))}
                            {projectContracts.length === 0 && <div className="col-span-2 text-center py-20 text-slate-400 italic">Chưa gán hợp đồng nào cho dự án này.</div>}
                        </div>
                    </div>
                )}
            </div>
        </div>
        {selectedAttachment && <AttachmentViewer attachment={selectedAttachment} onClose={() => setSelectedAttachment(null)} />}
        
        {/* Transaction Form Modal (In-context) */}
        {showTransModal && (
            <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/50 p-4">
                <TransactionForm 
                    projects={projects}
                    partners={partners}
                    accounts={accounts} // Passed accounts here
                    onAddTransaction={(t) => handleTransactionSave(t)}
                    onCancel={() => setShowTransModal(false)}
                    onAddProject={() => {}} // Not needed in this context
                    onAddPartner={() => {}}
                    currentUser={currentUser}
                    initialType={transModalType}
                    initialData={{ 
                        ...editingTransaction, 
                        projectId: project.id, 
                        scope: 'PROJECT' 
                    } as Transaction}
                />
            </div>
        )}

        {/* Quick Contract Modal */}
        {showContractModal && (
            <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/50 p-4 animate-in fade-in">
                <div className="bg-white rounded-[32px] w-full max-w-md shadow-2xl p-8 space-y-6">
                    <div className="flex justify-between items-center border-b border-slate-100 pb-4">
                        <h3 className="font-black text-xl text-slate-900 uppercase tracking-tight">Tạo Hợp Đồng Nhanh</h3>
                        <button onClick={()=>setShowContractModal(false)}><X className="text-slate-400 hover:text-slate-600"/></button>
                    </div>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Tên Hợp đồng / Gói thầu</label>
                            <input className="w-full border-2 border-slate-100 rounded-xl p-3 font-bold focus:border-indigo-500 outline-none" value={newContractName} onChange={e=>setNewContractName(e.target.value)} placeholder="Hợp đồng thi công..." autoFocus/>
                        </div>
                        <div>
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Giá trị (VND)</label>
                            <input type="number" className="w-full border-2 border-slate-100 rounded-xl p-3 font-bold focus:border-indigo-500 outline-none" value={newContractValue} onChange={e=>setNewContractValue(Number(e.target.value))}/>
                        </div>
                        <Combobox<Partner>
                            label="Đối tác / Nhà thầu"
                            items={partners}
                            selectedItem={selectedContractPartner}
                            onSelect={setSelectedContractPartner}
                            displayValue={p => p.name}
                            renderItem={p => <div className="font-bold text-sm">{p.name}</div>}
                            filterFunction={(p, q) => p.name.toLowerCase().includes(q.toLowerCase())}
                        />
                    </div>
                    <div className="flex gap-3 pt-2">
                        <button onClick={()=>setShowContractModal(false)} className="flex-1 py-3 text-slate-500 font-bold hover:bg-slate-50 rounded-xl">Hủy</button>
                        <button onClick={handleQuickCreateContract} className="flex-1 py-3 bg-indigo-600 text-white font-bold rounded-xl shadow-lg hover:bg-indigo-700">Tạo & Đồng bộ</button>
                    </div>
                </div>
            </div>
        )}
    </div>
  );
};

export default ProjectDetail360;
