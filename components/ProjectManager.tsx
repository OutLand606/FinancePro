
import React, { useState, useMemo, useEffect } from 'react';
import { Project, ProjectType, Transaction, TransactionType, Contract, PriceRecord, UserContext, Partner, PartnerType, TransactionStatus, Employee, CashAccount } from '../types';
import { fetchAllData, createProject, updateProject } from '../services/sheetService';
import { calculateProjectFinancials } from '../services/projectService';
import { fetchContracts } from '../services/contractService';
import { canAccessProject } from '../services/authService';
import { getEmployees } from '../services/employeeService';
import { fetchPartners, createPartner } from '../services/masterDataService';
import ProjectDetail360 from './ProjectDetail360';
import { Combobox } from './ui/Combobox';
import { 
  Briefcase, Plus, Activity, TrendingUp, Wallet, AlertTriangle, StopCircle, 
  Grid, CheckCircle2, PauseCircle, Search, ListIcon, Building2, Home, Users, 
  ChevronRight, X, HardHat, UserPlus 
} from 'lucide-react';

interface ProjectManagerProps {
  projects: Project[];
  priceRecords: PriceRecord[];
  partners: Partner[];
  transactions: Transaction[];
  onAddProject: (project: Project) => void;
  onUpdateProject: (project: Project) => void;
  onAddTransaction: (t: Transaction) => void;
  currentUser: UserContext;
  accounts: CashAccount[]; // Added accounts to props
}

const ProjectManager: React.FC<ProjectManagerProps> = ({ projects, priceRecords, partners, transactions, onAddProject, onUpdateProject, onAddTransaction, currentUser, accounts }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [employees, setEmployees] = useState<Employee[]>([]);
  console.log('employees',employees)
  const [localPartners, setLocalPartners] = useState<Partner[]>(partners);
  
  // UI State
  const [viewMode, setViewMode] = useState<'GRID' | 'LIST'>('GRID');
  const [activeLabel, setActiveLabel] = useState<'ALL' | 'ACTIVE' | 'COMPLETED' | 'SUSPENDED' | 'CANCELLED' | 'DEBT'>('ACTIVE');
  const [filterType, setFilterType] = useState<ProjectType | 'ALL'>('ALL');
  const [filterManager, setFilterManager] = useState<string>('ALL');

  // Detail View State
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [projectTransactions, setProjectTransactions] = useState<Transaction[]>([]);
  const [projectContracts, setProjectContracts] = useState<Contract[]>([]);
  
  // Form State
  const [newProject, setNewProject] = useState<Partial<Project>>({
    type: ProjectType.RETAIL,
    status: 'ACTIVE',
    salesEmpIds: [],
    laborEmpIds: []
  });
  const [selectedCustomer, setSelectedCustomer] = useState<Partner | null>(null);

  // Quick Customer Add State
  const [showQuickAddCustomer, setShowQuickAddCustomer] = useState(false);
  const [newCustomerName, setNewCustomerName] = useState('');
  const [newCustomerPhone, setNewCustomerPhone] = useState('');

  useEffect(() => {
      getEmployees().then(setEmployees);
  }, []);

  useEffect(() => {
      setLocalPartners(partners);
  }, [partners]);

  useEffect(() => {
      if (isModalOpen) {
          fetchPartners().then(setLocalPartners);
      }
  }, [isModalOpen]);

  // 1. Calculate Financials using SERVICE LAYER
  const projectStats = useMemo(() => {
      const perms = currentUser?.permissions || [];
      const isSysAdmin = perms.includes('SYS_ADMIN');
      const canViewAll = perms.includes('PROJECT_VIEW_ALL');
      const canViewOwn = perms.includes('PROJECT_VIEW_OWN');

      let accessibleProjects = [];
      if (isSysAdmin || canViewAll) {
          accessibleProjects = projects;
      } else if (canViewOwn) {
          accessibleProjects = projects.filter(p => {
              const isManager = p.managerEmpId === currentUser.id;
              const isSales = (p.salesEmpIds || []).includes(currentUser.id);
              return isManager || isSales;
          });
      } else {
          accessibleProjects = [];
      }
      return accessibleProjects.map(p => {
          const financials = calculateProjectFinancials(p, transactions);
          return { ...p, financials };
      });
  }, [projects, transactions, currentUser]);

  // 2. Filter logic based on Tabs & Dropdowns
  const filteredProjects = useMemo(() => {
      let filtered = projectStats;

      if (searchTerm) {
          const lower = searchTerm.toLowerCase();
          filtered = filtered.filter(p => p.name.toLowerCase().includes(lower) || p.code.toLowerCase().includes(lower));
      }
      
      switch (activeLabel) {
          case 'ACTIVE': filtered = filtered.filter(p => p.status === 'ACTIVE'); break;
          case 'COMPLETED': filtered = filtered.filter(p => p.status === 'COMPLETED'); break;
          case 'SUSPENDED': filtered = filtered.filter(p => p.status === 'SUSPENDED'); break;
          case 'CANCELLED': filtered = filtered.filter(p => p.status === 'CANCELLED'); break;
          case 'DEBT': filtered = filtered.filter(p => p.financials.receivable > 0); break;
          default: break;
      }

      if (filterType !== 'ALL') filtered = filtered.filter(p => p.type === filterType);
      if (filterManager !== 'ALL') filtered = filtered.filter(p => p.managerEmpId === filterManager);

      return filtered.sort((a,b) => {
          if (activeLabel === 'DEBT') return b.financials.receivable - a.financials.receivable;
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
  }, [projectStats, searchTerm, activeLabel, filterType, filterManager]);

  // Dashboard Metrics
  const dashboard360 = useMemo(() => {
      const active = projectStats.filter(p => p.status === 'ACTIVE');
      const totalContractValue = active.reduce((s, p) => s + (p.contractTotalValue || 0), 0);
      const totalCollected = active.reduce((s, p) => s + p.financials.income, 0);
      const totalReceivable = active.reduce((s, p) => s + p.financials.receivable, 0);
      
      const collectionRate = totalContractValue > 0 ? (totalCollected / totalContractValue) * 100 : 0;

      return {
          totalProjects: projectStats.length,
          activeCount: active.length,
          activePercent: projectStats.length > 0 ? (active.length / projectStats.length) * 100 : 0,
          totalContractValue,
          totalCollected,
          collectionRate,
          totalReceivable,
          receivableCount: active.filter(p => p.financials.receivable > 0).length,
          issueCount: projectStats.filter(p => p.status === 'SUSPENDED' || p.status === 'CANCELLED').length
      };
  }, [projectStats]);

  const handleOpenDetail = async (project: Project) => {
      setSelectedProject(project);
      setProjectTransactions(transactions); 
      const contracts = await fetchContracts();
      setProjectContracts(contracts.filter(c => c.projectId === project.id));
  };

  const handleSelectCustomer = async (partner: Partner) => {
      setSelectedCustomer(partner);
      setNewProject({ ...newProject, customerName: partner.name, customerId: partner.id });
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
      setLocalPartners(prev => [newPartner, ...prev]);
      
      // Auto Select
      setSelectedCustomer(newPartner);
      setNewProject({ ...newProject, customerName: newPartner.name, customerId: newPartner.id });
      
      setShowQuickAddCustomer(false);
      setNewCustomerName('');
      setNewCustomerPhone('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProject.name) return;

    const year = new Date().getFullYear();
    const prefix = newProject.type === ProjectType.PROJECT ? 'DA' : 'ND';
    const count = projects.filter(p => p.type === newProject.type).length + 1;
    const autoGenCode = `${prefix}-${year}-${count.toString().padStart(3, '0')}`;

    // Fix spread type issue by ensuring object type
    const projectData = newProject as Project;
    
    const project: Project = {
      ...projectData,
      id: Date.now().toString(),
      code: autoGenCode,
      name: newProject.name,
      type: newProject.type || ProjectType.RETAIL,
      customerName: selectedCustomer?.name || newProject.customerName || '',
      customerId: selectedCustomer?.id,
      contractTotalValue: Number(newProject.contractTotalValue) || 0,
      status: 'ACTIVE',
      createdAt: new Date().toISOString(),
      managerEmpId: newProject.managerEmpId || currentUser.id,
      salesEmpIds: newProject.salesEmpIds || [],
      laborEmpIds: newProject.laborEmpIds || []
    };

    onAddProject(project);
    setIsModalOpen(false);
    setNewProject({ type: ProjectType.RETAIL, status: 'ACTIVE', salesEmpIds: [], laborEmpIds: [] });
    setSelectedCustomer(null);
  };

  const toggleEmployeeInList = (listKey: 'salesEmpIds' | 'laborEmpIds', empId: string) => {
      const current = newProject[listKey] || [];
      const updated = current.includes(empId) ? current.filter(id => id !== empId) : [...current, empId];
      setNewProject({ ...newProject, [listKey]: updated });
  };

  const FilterTab = ({ id, label, icon: Icon, count }: any) => {
      const isActive = activeLabel === id;
      return (
        <button 
            onClick={() => setActiveLabel(id)}
            className={`flex items-center px-5 py-2.5 rounded-xl transition-all duration-200 border ${
                isActive 
                ? 'bg-white border-slate-200 shadow-sm text-indigo-700 font-bold scale-105' 
                : 'bg-transparent border-transparent text-slate-500 hover:bg-white/50 hover:text-slate-700 font-medium'
            }`}
        >
            <Icon size={16} className={`mr-2 ${isActive ? 'text-indigo-600' : 'text-slate-400'}`} />
            <span className="text-xs uppercase tracking-wider mr-2">{label}</span>
            <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-md ${isActive ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-200 text-slate-500'}`}>
                {count}
            </span>
        </button>
      );
  };

  const canModifyProjectsCreater = useMemo(() => {
      const perms = currentUser?.permissions || [];
      if (perms.includes('SYS_ADMIN')) return true
      return perms.some(p => ['PROJECT_CREATE'].includes(p));
  }, [currentUser]);

  const canModifyProjectsEdit = useMemo(() => {
      const perms = currentUser?.permissions || [];
      if (perms.includes('SYS_ADMIN')) return true
      return perms.some(p => ['PROJECT_EDIT'].includes(p));
  }, [currentUser]);



  return (
    <div className="space-y-8 animate-in fade-in duration-300 pb-20">
      
      {/* 1. HEADER & ACTIONS */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm">
          <div className="flex items-center gap-5">
              <div className="bg-gradient-to-br from-indigo-600 to-violet-600 w-14 h-14 rounded-[20px] flex items-center justify-center text-white shadow-lg shadow-indigo-200">
                  <Briefcase size={28}/>
              </div>
              <div>
                  <h1 className="text-2xl font-black text-slate-900 tracking-tight uppercase">Quản Lý Dự Án</h1>
                  <p className="text-sm text-slate-500 font-bold mt-1 flex items-center">
                      <span className="bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded text-[10px] uppercase mr-2 border border-emerald-100">Live Status</span>
                      Theo dõi tiến độ & tài chính 360°
                  </p>
              </div>
          </div>
         <button 
            disabled={!canModifyProjectsCreater} // Disable nếu không có quyền
            onClick={() => setIsModalOpen(true)}
            className={`flex items-center px-8 py-3.5 rounded-2xl font-black text-[11px] uppercase tracking-widest shadow-xl transition-all group
                ${canModifyProjectsCreater 
                    ? 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-indigo-200 active:scale-95 cursor-pointer' 
                    : 'bg-slate-100 text-slate-400 cursor-not-allowed opacity-70 shadow-none'
                }
            `}
          >
              <Plus size={18} className={`mr-2 ${canModifyProjectsCreater ? 'group-hover:rotate-90' : ''} transition-transform`}/> Tạo Dự Án Mới
          </button>
      </div>

      {/* 2. DASHBOARD 360 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-white p-6 rounded-[28px] border border-slate-100 shadow-sm flex flex-col justify-between relative overflow-hidden group">
              <div className="relative z-10">
                  <div className="flex justify-between items-start mb-4">
                      <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl"><Activity size={24}/></div>
                      <span className="text-[10px] font-black bg-blue-100 text-blue-700 px-2 py-1 rounded-lg uppercase">Active</span>
                  </div>
                  <p className="text-sm font-bold text-slate-400">Tổng số dự án</p>
                  <div className="flex items-baseline gap-1 mt-1">
                      <h3 className="text-3xl font-black text-slate-900">{dashboard360.totalProjects}</h3>
                      <span className="text-sm font-bold text-blue-600">({dashboard360.activePercent.toFixed(0)}% chạy)</span>
                  </div>
                  <div className="w-full bg-slate-100 h-1.5 rounded-full mt-4 overflow-hidden">
                      <div className="h-full bg-blue-500 rounded-full" style={{width: `${dashboard360.activePercent}%`}}></div>
                  </div>
              </div>
          </div>

          <div className="bg-white p-6 rounded-[28px] border border-slate-100 shadow-sm flex flex-col justify-between relative overflow-hidden group">
              <div className="relative z-10">
                  <div className="flex justify-between items-start mb-4">
                      <div className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl"><TrendingUp size={24}/></div>
                      <span className="text-[10px] font-black bg-emerald-100 text-emerald-700 px-2 py-1 rounded-lg uppercase">Thu tiền</span>
                  </div>
                  <p className="text-sm font-bold text-slate-400">Đã thực thu (Cash-in)</p>
                  <h3 className="text-2xl font-black text-emerald-700 mt-1">{(dashboard360.totalCollected / 1000000).toLocaleString()} Tr</h3>
                  <div className="mt-3 flex justify-between items-center text-[10px] font-bold text-slate-400 uppercase tracking-wide">
                      <span>Tiến độ thu</span>
                      <span className="text-emerald-600">{dashboard360.collectionRate.toFixed(1)}%</span>
                  </div>
                  <div className="w-full bg-slate-100 h-1.5 rounded-full mt-1 overflow-hidden">
                      <div className="h-full bg-emerald-500 rounded-full" style={{width: `${Math.min(dashboard360.collectionRate, 100)}%`}}></div>
                  </div>
              </div>
          </div>

          <div className="bg-white p-6 rounded-[28px] border border-slate-100 shadow-sm flex flex-col justify-between relative overflow-hidden group">
              <div className="relative z-10">
                  <div className="flex justify-between items-start mb-4">
                      <div className="p-3 bg-orange-50 text-orange-600 rounded-2xl"><Wallet size={24}/></div>
                      <span className="text-[10px] font-black bg-orange-100 text-orange-700 px-2 py-1 rounded-lg uppercase">Công nợ</span>
                  </div>
                  <p className="text-sm font-bold text-slate-400">Cần thu về (Receivable)</p>
                  <h3 className="text-2xl font-black text-orange-700 mt-1">{(dashboard360.totalReceivable / 1000000).toLocaleString()} Tr</h3>
                  <p className="text-xs font-bold text-slate-400 mt-2">Từ <span className="text-slate-800">{dashboard360.receivableCount}</span> dự án còn nợ</p>
              </div>
          </div>

          <div className="bg-slate-900 p-6 rounded-[28px] shadow-xl flex flex-col justify-between relative overflow-hidden text-white">
              <div className="relative z-10">
                  <div className="flex justify-between items-start mb-4">
                      <div className="p-3 bg-white/10 text-white rounded-2xl"><AlertTriangle size={24}/></div>
                      <span className="text-[10px] font-black bg-white/20 text-white px-2 py-1 rounded-lg uppercase">Cảnh báo</span>
                  </div>
                  <p className="text-sm font-bold text-slate-400">Dự án dừng / Huỷ</p>
                  <h3 className="text-3xl font-black text-white mt-1">{dashboard360.issueCount}</h3>
                  <p className="text-xs font-bold text-slate-400 mt-2">Cần kiểm tra xử lý ngay</p>
              </div>
              <div className="absolute right-[-20px] bottom-[-20px] opacity-10">
                  <StopCircle size={120} />
              </div>
          </div>
      </div>

      {/* 3. FILTER BAR */}
      <div className="flex flex-col lg:flex-row gap-6 items-center">
          <div className="flex-1 w-full lg:w-auto bg-slate-100 p-1.5 rounded-[20px] flex items-center overflow-x-auto scrollbar-hide shadow-inner">
              <FilterTab id="ALL" label="Tất cả" icon={Grid} count={projectStats.length} />
              <FilterTab id="ACTIVE" label="Đang chạy" icon={Activity} count={dashboard360.activeCount} />
              <FilterTab id="DEBT" label="Công nợ" icon={Wallet} count={dashboard360.receivableCount} />
              <FilterTab id="COMPLETED" label="Hoàn thành" icon={CheckCircle2} count={projectStats.filter(p=>p.status==='COMPLETED').length} />
              <FilterTab id="SUSPENDED" label="Tạm dừng" icon={PauseCircle} count={projectStats.filter(p=>p.status==='SUSPENDED').length} />
          </div>

          <div className="flex gap-3 w-full lg:w-auto">
              <div className="relative flex-1 group">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors" size={18} />
                  <input 
                    type="text" placeholder="Tìm tên dự án, mã số..." 
                    className="w-full pl-12 pr-4 py-3.5 bg-white border border-slate-200 rounded-2xl text-sm font-bold focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all shadow-sm"
                    value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                  />
              </div>
              <div className="flex bg-white p-1 rounded-2xl border border-slate-200 shadow-sm">
                  <button onClick={() => setViewMode('GRID')} className={`p-3 rounded-xl transition-all ${viewMode === 'GRID' ? 'bg-indigo-50 text-indigo-600' : 'text-slate-400'}`}><Grid size={20}/></button>
                  <button onClick={() => setViewMode('LIST')} className={`p-3 rounded-xl transition-all ${viewMode === 'LIST' ? 'bg-indigo-50 text-indigo-600' : 'text-slate-400'}`}><ListIcon size={20}/></button>
              </div>
          </div>
      </div>

      {/* 4. CONTENT AREA */}
      {viewMode === 'GRID' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {filteredProjects.map((p) => (
                  <div 
                      key={p.id} 
                     onClick={() => {
                          if (canModifyProjectsEdit) handleOpenDetail(p);
                      }}
                      className={`bg-white rounded-[32px] border shadow-sm p-6 flex flex-col relative overflow-hidden transition-all duration-300
                          ${canModifyProjectsEdit 
                              ? 'cursor-pointer hover:shadow-xl hover:-translate-y-1 group' 
                              : 'cursor-default opacity-90' // Không cho click
                          }
                          ${
                              p.status === 'COMPLETED' ? 'border-emerald-100 bg-emerald-50/10' : 
                              p.status === 'SUSPENDED' ? 'border-amber-200 bg-amber-50/10' : 
                              p.status === 'CANCELLED' ? 'border-slate-200 bg-slate-50 opacity-70' :
                              'border-indigo-100'
                          }`}
                  >
                      {/* Status Tag Badge */}
                      <div className="absolute top-0 right-0">
                          <div className={`px-4 py-2 rounded-bl-2xl text-[9px] font-black uppercase tracking-widest ${
                              p.status === 'ACTIVE' ? 'bg-blue-100 text-blue-700' :
                              p.status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-700' :
                              p.status === 'SUSPENDED' ? 'bg-amber-100 text-amber-700' :
                              'bg-rose-100 text-rose-700'
                          }`}>
                              {p.status === 'ACTIVE' ? 'Đang chạy' : p.status === 'COMPLETED' ? 'Đã xong' : p.status === 'SUSPENDED' ? 'Tạm dừng' : 'Hủy bỏ'}
                          </div>
                      </div>

                      <div className="flex justify-between items-start mb-4">
                          <div className={`p-3 rounded-2xl ${p.type === ProjectType.PROJECT ? 'bg-purple-50 text-purple-600' : 'bg-blue-50 text-blue-600'}`}>
                              {p.type === ProjectType.PROJECT ? <Building2 size={24} /> : <Home size={24} />}
                          </div>
                      </div>
                      
                      <div className="mb-4">
                          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">{p.code}</span>
                          <h3 className="text-lg font-black text-slate-900 line-clamp-2 group-hover:text-indigo-600 transition-colors leading-snug">{p.name}</h3>
                          <p className="text-xs font-bold text-slate-500 mt-1 flex items-center"><Users size={12} className="mr-1.5"/> {p.customerName || 'Khách lẻ'}</p>
                      </div>
                      
                      <div className="mt-auto bg-white/60 p-4 rounded-2xl border border-slate-100 backdrop-blur-sm">
                          <div className="flex justify-between text-[10px] font-black uppercase text-slate-400 mb-2 tracking-widest">
                              <span>Tiến độ thu</span>
                              <span className="text-slate-800">{p.financials.progress.toFixed(0)}%</span>
                          </div>
                          <div className="w-full bg-slate-200 rounded-full h-1.5 mb-3 overflow-hidden">
                              <div className={`h-full rounded-full ${p.financials.progress >= 100 ? 'bg-emerald-500' : 'bg-indigo-500'} transition-all duration-500`} style={{width: `${Math.min(p.financials.progress, 100)}%`}}></div>
                          </div>
                          <div className="flex justify-between items-end">
                              <div>
                                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Đã thu</p>
                                  <p className="text-xs font-black text-emerald-600">{p.financials.income.toLocaleString()} ₫</p>
                              </div>
                              <div className="text-right">
                                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Công nợ</p>
                                  <p className={`text-sm font-black ${p.financials.receivable > 0 ? 'text-orange-600' : 'text-slate-300'}`}>
                                      {p.financials.receivable > 0 ? p.financials.receivable.toLocaleString() : '-'}
                                  </p>
                              </div>
                          </div>
                      </div>
                  </div>
              ))}
          </div>
      ) : (
          <div className="bg-white rounded-[32px] border border-slate-100 shadow-sm overflow-hidden">
              <table className="w-full text-left">
                  <thead className="bg-slate-50 text-slate-400 font-black uppercase text-[10px] tracking-widest border-b border-slate-100 sticky top-0">
                      <tr>
                          <th className="px-6 py-4">Nhãn / Tên công trình</th>
                          <th className="px-6 py-4">Khách hàng</th>
                          <th className="px-6 py-4 text-center">Tiến độ thu</th>
                          <th className="px-6 py-4 text-right">Tổng HĐ</th>
                          <th className="px-6 py-4 text-right">Còn nợ</th>
                          <th className="px-6 py-4 text-center">Trạng thái</th>
                          <th className="px-6 py-4"></th>
                      </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                      {filteredProjects.map(p => (
                          <tr key={p.id} className="hover:bg-slate-50/80 transition-colors group cursor-pointer"  onClick={() => {
                          if (canModifyProjectsEdit) handleOpenDetail(p);
                      }}>
                              <td className="px-6 py-4">
                                  <div className="flex items-center gap-3">
                                      <div className={`w-2 h-10 rounded-full ${p.status === 'ACTIVE' ? 'bg-blue-500' : p.status === 'COMPLETED' ? 'bg-emerald-500' : 'bg-slate-300'}`}></div>
                                      <div>
                                          <div className="font-bold text-slate-800 text-sm mb-0.5">{p.name}</div>
                                          <span className="text-[10px] font-mono font-bold text-slate-400">{p.code}</span>
                                      </div>
                                  </div>
                              </td>
                              <td className="px-6 py-4 font-medium text-slate-600">{p.customerName}</td>
                              <td className="px-6 py-4 w-[150px]">
                                  <div className="flex items-center gap-2">
                                      <div className="flex-1 bg-slate-200 h-1.5 rounded-full overflow-hidden">
                                          <div className={`h-full ${p.financials.progress >= 100 ? 'bg-emerald-500' : 'bg-indigo-500'}`} style={{width: `${Math.min(p.financials.progress, 100)}%`}}></div>
                                      </div>
                                      <span className="text-[10px] font-bold text-slate-600">{p.financials.progress.toFixed(0)}%</span>
                                  </div>
                              </td>
                              <td className="px-6 py-4 text-right font-bold text-slate-700">{(p.contractTotalValue || 0).toLocaleString()} ₫</td>
                              <td className={`px-6 py-4 text-right font-black ${p.financials.receivable > 0 ? 'text-orange-600' : 'text-slate-300'}`}>
                                  {p.financials.receivable > 0 ? p.financials.receivable.toLocaleString() : '-'}
                              </td>
                              <td className="px-6 py-4 text-center">
                                  <span className={`px-2 py-1 rounded text-[9px] font-black uppercase ${p.status === 'ACTIVE' ? 'bg-blue-50 text-blue-600' : p.status === 'COMPLETED' ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-500'}`}>
                                      {p.status}
                                  </span>
                              </td>
                              <td className="px-6 py-4 text-right">
                                  <button className="p-2 bg-white border border-slate-200 rounded-lg text-slate-400 hover:text-indigo-600 hover:border-indigo-200 opacity-0 group-hover:opacity-100 transition-all shadow-sm">
                                      <ChevronRight size={14}/>
                                  </button>
                              </td>
                          </tr>
                      ))}
                  </tbody>
              </table>
          </div>
      )}

      {filteredProjects.length === 0 && <div className="py-20 text-center text-slate-400 italic">Không tìm thấy dự án phù hợp với bộ lọc.</div>}

      {selectedProject && (
          <ProjectDetail360 
            project={selectedProject}
            projects={projects}
            transactions={projectTransactions}
            contracts={projectContracts}
            priceRecords={priceRecords}
            partners={partners}
            currentUser={currentUser}
            onAddTransaction={onAddTransaction}
            onUpdateProject={(updated) => {
                onUpdateProject(updated);
                setSelectedProject(updated);
            }}
            onClose={() => setSelectedProject(null)}
            accounts={accounts} // Passed to detail
          />
      )}

      {/* CREATE MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[160] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-[32px] shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-10 py-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <div>
                <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tighter">Thêm Công Trình Mới</h2>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Dữ liệu sẽ được đồng bộ toàn hệ thống</p>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="p-3 hover:bg-white rounded-full text-slate-400 transition-colors">
                <X size={28} />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-10 space-y-8 custom-scrollbar">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                  <div className="space-y-6">
                      <h4 className="text-[10px] font-black text-indigo-600 uppercase tracking-widest border-b border-indigo-50 pb-2">Thông tin định danh</h4>
                      <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Tên Công Trình *</label>
                        <input type="text" required autoFocus className="w-full px-4 py-3 border-2 border-slate-100 rounded-2xl font-bold text-slate-800 focus:border-indigo-500 outline-none transition-colors" placeholder="Nhà phố 3 tầng - Anh Hải" value={newProject.name || ''} onChange={(e) => setNewProject({...newProject, name: e.target.value})} />
                      </div>
                      <Combobox<Partner>
                          label="Khách Hàng / CĐT *" 
                          items={localPartners.filter(p => p.type === PartnerType.CUSTOMER || p.type === PartnerType.BOTH || !p.type)}
                          selectedItem={selectedCustomer} 
                          onSelect={handleSelectCustomer} 
                          displayValue={(p) => p.name}
                          renderItem={(p) => <div><div className="font-bold">{p.name}</div><div className="text-xs text-gray-500">{p.phone}</div></div>}
                          filterFunction={(p, q) => p.name.toLowerCase().includes(q.toLowerCase()) || (p.phone || '').includes(q)}
                          onAddNew={() => setShowQuickAddCustomer(true)}
                      />
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Loại Hình *</label>
                            <select className="w-full px-4 py-3 border-2 border-slate-100 rounded-2xl font-bold bg-white outline-none focus:border-indigo-500" value={newProject.type} onChange={(e) => setNewProject({...newProject, type: e.target.value as ProjectType})} >
                                <option value={ProjectType.RETAIL}>Nhà lẻ (ND)</option>
                                <option value={ProjectType.PROJECT}>Dự án lớn (DA)</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Giá Trị HĐ (Dự kiến)</label>
                            <input type="number" className="w-full px-4 py-3 border-2 border-slate-100 rounded-2xl font-bold outline-none focus:border-indigo-500" placeholder="0" value={newProject.contractTotalValue || ''} onChange={(e) => setNewProject({...newProject, contractTotalValue: Number(e.target.value)})} />
                        </div>
                      </div>
                  </div>

                  <div className="space-y-6">
                      <h4 className="text-[10px] font-black text-emerald-600 uppercase tracking-widest border-b border-emerald-50 pb-2">Nhân sự phụ trách</h4>
                      <div>
                          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center"><HardHat size={12} className="mr-1"/> Quản lý dự án (PM)</label>
                          <select className="w-full px-4 py-3 border-2 border-slate-100 rounded-2xl font-bold bg-white outline-none focus:border-emerald-500" value={newProject.managerEmpId || ''} onChange={e=>setNewProject({...newProject, managerEmpId: e.target.value})}>
                              <option value="">-- Chọn PM --</option>
                              {employees.map(e => <option key={e.id} value={e.id}>{e.fullName}</option>)}
                          </select>
                      </div>

                      <div>
                          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center"><Briefcase size={12} className="mr-1"/> Phụ trách Kinh doanh (Sales)</label>
                          <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto p-3 bg-slate-50 rounded-2xl border border-slate-100 custom-scrollbar">
                              {employees.map(e => (
                                  <button type="button" key={e.id} onClick={() => toggleEmployeeInList('salesEmpIds', e.id)} className={`flex items-center gap-2 p-2 rounded-xl text-left transition-all ${newProject.salesEmpIds?.includes(e.id) ? 'bg-indigo-600 text-white shadow-md' : 'bg-white text-slate-600 hover:bg-indigo-50'}`}>
                                      <div className={`w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-black ${newProject.salesEmpIds?.includes(e.id) ? 'bg-white/20' : 'bg-indigo-50'}`}>{e.fullName.charAt(0)}</div>
                                      <span className="text-[11px] font-bold truncate">{e.fullName}</span>
                                  </button>
                              ))}
                          </div>
                      </div>
                  </div>
              </div>

              <div className="pt-8 border-t flex gap-4">
                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-4 text-slate-400 font-black uppercase text-[11px] tracking-widest hover:text-slate-600 transition-colors">Hủy bỏ</button>
                <button type="submit" className="flex-1 py-4 bg-indigo-600 text-white rounded-2xl font-black uppercase text-[11px] tracking-widest shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all active:scale-95">Tạo Công Trình & Đồng Bộ Dữ Liệu</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* QUICK ADD CUSTOMER MODAL */}
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
};

export default ProjectManager;
