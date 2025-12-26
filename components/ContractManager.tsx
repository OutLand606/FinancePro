
import React, { useState, useEffect } from 'react';
import { Contract, Project, Partner, ContractType, ContractStatus, Transaction, TransactionStatus } from '../types';
import { Plus, Search, FileText, CheckCircle, Clock, AlertTriangle, ChevronRight, File, DollarSign, X, ExternalLink, Calendar, Wallet, TrendingUp, TrendingDown, FileCheck } from 'lucide-react';
import { fetchContracts, createContract } from '../services/contractService';
import { calculateContractStatus } from '../utils/contractUtils';
import { Combobox } from './ui/Combobox';

interface ContractManagerProps {
  projects: Project[];
  partners: Partner[];
  transactions: Transaction[];
}

const ContractManager: React.FC<ContractManagerProps> = ({ projects, partners, transactions }) => {
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Detail Modal State
  const [selectedContract, setSelectedContract] = useState<Contract | null>(null);

  // Form State
  const [newContract, setNewContract] = useState<Partial<Contract>>({
    type: ContractType.SUPPLIER_MATERIAL,
    status: ContractStatus.DRAFT,
    value: 0
  });

  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [selectedPartner, setSelectedPartner] = useState<Partner | null>(null);

  useEffect(() => {
    fetchContracts().then(setContracts);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newContract.name || !newContract.value || !selectedProject || !selectedPartner) return;

    // Generate Code
    const count = contracts.length + 1;
    const autoCode = `HD-${count.toString().padStart(3, '0')}/${new Date().getFullYear()}`;

    const contract: Contract = {
      id: Date.now().toString(),
      code: newContract.code || autoCode,
      name: newContract.name,
      type: newContract.type!,
      partnerId: selectedPartner.id,
      projectId: selectedProject.id,
      value: Number(newContract.value),
      signedDate: newContract.signedDate || new Date().toISOString(),
      status: newContract.status || ContractStatus.DRAFT,
      note: newContract.note,
      createdAt: new Date().toISOString()
    };

    await createContract(contract);
    setContracts([contract, ...contracts]);
    setIsModalOpen(false);
    
    // Reset form
    setNewContract({ type: ContractType.SUPPLIER_MATERIAL, status: ContractStatus.DRAFT, value: 0 });
    setSelectedProject(null);
    setSelectedPartner(null);
  };

  const filteredContracts = contracts.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    c.code.toLowerCase().includes(searchTerm.toLowerCase())
  ).sort((a,b) => (a.type === ContractType.REVENUE ? -1 : 1)); // Revenue contracts first

  const getPartnerName = (id: string) => partners.find(p => p.id === id)?.name || '---';
  const getProjectName = (id: string) => projects.find(p => p.id === id)?.name || '---';

  // Helper render Detail Modal
  const renderDetailModal = () => {
    if (!selectedContract) return null;
    const status = calculateContractStatus(selectedContract, transactions);
    const sortedTrans = [...status.relatedTransactions].sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    const isRevenue = status.isRevenue;

    return (
      <div className="fixed inset-0 z-[160] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm animate-in fade-in duration-200">
        <div className="bg-white rounded-[32px] shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
          
          {/* Header */}
          <div className="px-8 py-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
            <div>
              <div className="flex items-center gap-2">
                 <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded border ${isRevenue ? 'text-green-600 bg-green-50 border-green-100' : 'text-blue-600 bg-blue-50 border-blue-100'}`}>
                   {selectedContract.code}
                 </span>
                 <span className={`px-2 py-1 text-[10px] font-black uppercase rounded-full border ${
                    selectedContract.status === ContractStatus.SIGNED ? 'bg-green-100 text-green-700 border-green-200' : 'bg-gray-100 text-gray-700 border-gray-200'
                  }`}>
                    {selectedContract.status === ContractStatus.SIGNED ? 'ĐÃ KÝ' : selectedContract.status}
                 </span>
                 {isRevenue && <span className="bg-green-600 text-white px-2 py-1 text-[10px] font-black uppercase rounded-full">Đầu ra (Thu)</span>}
              </div>
              <h2 className="text-xl font-black text-slate-900 mt-2 uppercase tracking-tight">{selectedContract.name}</h2>
            </div>
            <button onClick={() => setSelectedContract(null)} className="p-3 hover:bg-slate-100 rounded-full transition-colors text-slate-400">
              <X size={28} />
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-8 bg-white custom-scrollbar space-y-8">
            
            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-slate-50 p-6 rounded-[24px] border border-slate-100 shadow-sm">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Tổng giá trị HĐ</p>
                <p className="text-2xl font-black text-slate-900">{selectedContract.value.toLocaleString('vi-VN')} ₫</p>
              </div>
              <div className="bg-slate-50 p-6 rounded-[24px] border border-slate-100 shadow-sm">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{isRevenue ? 'Đã thu (PAID)' : 'Đã thực chi (PAID)'}</p>
                <p className={`text-2xl font-black ${isRevenue ? 'text-green-600' : 'text-blue-600'}`}>
                    {status.totalPaid.toLocaleString('vi-VN')} ₫
                </p>
                <div className="w-full bg-slate-200 rounded-full h-1.5 mt-3">
                  <div className={`h-1.5 rounded-full ${isRevenue ? 'bg-green-500' : 'bg-blue-500'}`} style={{ width: `${Math.min(status.paidPercent, 100)}%` }}></div>
                </div>
              </div>
              <div className="bg-slate-50 p-6 rounded-[24px] border border-slate-100 shadow-sm">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{isRevenue ? 'Còn phải thu' : 'Còn phải trả'}</p>
                <p className={`text-2xl font-black ${status.remaining < 0 ? 'text-rose-600' : (isRevenue ? 'text-orange-600' : 'text-blue-600')}`}>
                   {status.remaining.toLocaleString('vi-VN')} ₫
                </p>
              </div>
            </div>

            {/* Info & Drive Link */}
            <div className="bg-white p-6 rounded-[24px] border border-slate-100 shadow-sm">
               <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-3">
                     <p className="flex items-center text-slate-700 font-bold text-sm">
                       <FileText size={16} className="mr-3 text-slate-400" /> 
                       Đối tác: <span className="ml-1 text-slate-900">{getPartnerName(selectedContract.partnerId)}</span>
                     </p>
                     <p className="flex items-center text-slate-700 font-bold text-sm">
                       <CheckCircle size={16} className="mr-3 text-slate-400" /> 
                       Dự án: <span className="ml-1 text-slate-900">{getProjectName(selectedContract.projectId)}</span>
                     </p>
                     <p className="flex items-center text-slate-700 font-bold text-sm">
                       <Calendar size={16} className="mr-3 text-slate-400" /> 
                       Ngày ký: <span className="ml-1 text-slate-900">{new Date(selectedContract.signedDate).toLocaleDateString('vi-VN')}</span>
                     </p>
                  </div>
                  <div className="flex flex-col items-start justify-center border-l pl-8 border-slate-100">
                     <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Chứng từ gốc (Scan/PDF)</span>
                     {selectedContract.fileLink ? (
                       <a 
                         href={selectedContract.fileLink} 
                         target="_blank" 
                         rel="noopener noreferrer"
                         className="flex items-center px-5 py-2.5 bg-blue-50 text-blue-700 rounded-xl hover:bg-blue-100 transition-colors font-bold text-xs uppercase tracking-wide"
                       >
                         <ExternalLink size={16} className="mr-2" />
                         Mở Google Drive
                       </a>
                     ) : (
                       <span className="text-sm text-slate-400 italic flex items-center font-medium">
                         <AlertTriangle size={14} className="mr-1" /> Chưa có link chứng từ
                       </span>
                     )}
                  </div>
               </div>
            </div>

            {/* Transactions Table */}
            <div>
                <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest mb-4 flex items-center">
                <Wallet className="mr-2 text-indigo-600" size={18} />
                Lịch sử {isRevenue ? 'Thu tiền' : 'Thanh toán'}
                </h3>
                <div className="bg-white rounded-[24px] border border-slate-200 shadow-sm overflow-hidden">
                <table className="w-full text-sm text-left">
                    <thead className="bg-slate-50 text-slate-400 font-black uppercase text-[10px] tracking-widest border-b border-slate-100">
                    <tr>
                        <th className="px-6 py-4">Ngày</th>
                        <th className="px-6 py-4">Nội dung đợt TT</th>
                        <th className="px-6 py-4 text-right">Số tiền</th>
                        <th className="px-6 py-4 text-center">Trạng thái</th>
                    </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                    {sortedTrans.length === 0 ? (
                        <tr><td colSpan={4} className="px-6 py-8 text-center text-slate-400 italic font-medium">Chưa có giao dịch nào phát sinh.</td></tr>
                    ) : (
                        sortedTrans.map(t => (
                        <tr key={t.id} className="hover:bg-slate-50/50">
                            <td className="px-6 py-4 text-slate-500 font-mono text-xs">{new Date(t.date).toLocaleDateString('vi-VN')}</td>
                            <td className="px-6 py-4">
                                <div className="font-bold text-slate-900">{t.description}</div>
                            </td>
                            <td className={`px-6 py-4 text-right font-black ${isRevenue ? 'text-green-600' : 'text-red-600'}`}>
                            {isRevenue ? '+' : '-'}{t.amount.toLocaleString('vi-VN')}
                            </td>
                            <td className="px-6 py-4 text-center">
                                {t.status === TransactionStatus.PAID ? (
                                <span className="inline-flex items-center px-3 py-1 rounded-full text-[9px] font-black uppercase bg-green-100 text-green-700">
                                    {isRevenue ? 'Đã thu' : 'Đã chi'}
                                </span>
                                ) : (
                                <span className="inline-flex items-center px-3 py-1 rounded-full text-[9px] font-black uppercase bg-amber-100 text-amber-700">
                                    {t.status}
                                </span>
                                )}
                            </td>
                        </tr>
                        ))
                    )}
                    </tbody>
                </table>
                </div>
            </div>
            
            {status.isOverBudget && (
               <div className="bg-rose-50 p-4 rounded-xl flex items-center text-rose-700 text-sm font-bold border border-rose-100">
                 <AlertTriangle size={20} className="mr-3" />
                 Cảnh báo: Tổng tiền đã chi vượt quá giá trị hợp đồng!
               </div>
            )}

          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-300 pb-20">
      
      {/* 1. HEADER & ACTIONS */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-[24px] border border-slate-100 shadow-sm">
          <div className="flex items-center gap-4">
              <div className="bg-indigo-600 w-12 h-12 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-indigo-100">
                  <FileCheck size={24}/>
              </div>
              <div>
                  <h1 className="text-xl font-black text-slate-900 tracking-tight uppercase">Quản Lý Hợp Đồng</h1>
                  <p className="text-sm text-slate-500 font-medium">Kiểm soát pháp lý & tiến độ thanh toán</p>
              </div>
          </div>
          <button 
            onClick={() => setIsModalOpen(true)}
            className="flex items-center px-6 py-3 bg-indigo-600 text-white rounded-xl font-black text-[11px] uppercase tracking-widest shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition-all active:scale-95"
          >
            <Plus size={18} className="mr-2" />
            Tạo Hợp Đồng
          </button>
      </div>

      {/* 2. SEARCH BAR */}
      <div className="bg-white p-4 rounded-[24px] border border-slate-200 shadow-sm">
        <div className="relative max-w-md">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
            <input 
                type="text" placeholder="Tìm hợp đồng, gói thầu..." 
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border-none rounded-xl text-sm font-bold focus:ring-2 focus:ring-indigo-500/50 outline-none transition-all"
                value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
            />
        </div>
      </div>

      {/* 3. CONTRACT GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {filteredContracts.map((contract) => {
          const status = calculateContractStatus(contract, transactions);
          const isRevenue = contract.type === ContractType.REVENUE;
          
          return (
            <div 
              key={contract.id} 
              className={`rounded-[24px] border shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 p-6 cursor-pointer group flex flex-col justify-between ${isRevenue ? 'bg-gradient-to-br from-emerald-50/50 to-white border-emerald-100' : 'bg-white border-slate-200'}`}
              onClick={() => setSelectedContract(contract)}
            >
              <div>
                <div className="flex justify-between items-start mb-4">
                    <div>
                        <div className="flex gap-2 mb-2">
                            <span className="inline-block px-3 py-1 rounded-lg text-[10px] font-black uppercase bg-slate-100 text-slate-600 group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-colors tracking-widest border border-slate-200 group-hover:border-indigo-100">
                                {contract.code}
                            </span>
                            {isRevenue && <span className="text-[10px] font-black bg-emerald-100 text-emerald-700 px-2 py-1 rounded-lg flex items-center border border-emerald-200"><TrendingUp size={12} className="mr-1"/> THU</span>}
                            {!isRevenue && <span className="text-[10px] font-black bg-rose-100 text-rose-700 px-2 py-1 rounded-lg flex items-center border border-rose-200"><TrendingDown size={12} className="mr-1"/> CHI</span>}
                        </div>
                        <h3 className="text-lg font-black text-slate-900 line-clamp-1 leading-tight">{contract.name}</h3>
                    </div>
                    <span className={`px-3 py-1 text-[9px] font-black rounded-full uppercase border ${
                        contract.status === ContractStatus.SIGNED ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 
                        contract.status === ContractStatus.COMPLETED ? 'bg-blue-50 text-blue-700 border-blue-200' :
                        'bg-amber-50 text-amber-700 border-amber-200'
                    }`}>
                        {contract.status === ContractStatus.SIGNED ? 'Đã ký' : 
                        contract.status === ContractStatus.COMPLETED ? 'Hoàn thành' : 'Dự thảo'}
                    </span>
                </div>

                <div className="text-xs font-bold text-slate-500 space-y-2 mb-6 pl-1">
                    <p className="flex items-center"><FileText size={14} className="mr-2 opacity-50" /> {getPartnerName(contract.partnerId)}</p>
                    <p className="flex items-center"><CheckCircle size={14} className="mr-2 opacity-50" /> {getProjectName(contract.projectId)}</p>
                </div>

                {/* Progress Bar */}
                <div className="bg-white/60 rounded-2xl p-4 border border-slate-100 group-hover:border-indigo-100 transition-colors backdrop-blur-sm">
                    <div className="flex justify-between text-[10px] font-black uppercase text-slate-400 mb-2 tracking-widest">
                        <span>{isRevenue ? 'Tiến độ thu' : 'Tiến độ chi'}</span>
                        <span className={`${status.isOverBudget ? 'text-rose-600' : (isRevenue ? 'text-emerald-600' : 'text-indigo-600')}`}>
                            {status.paidPercent.toFixed(1)}%
                        </span>
                    </div>
                    <div className="w-full bg-slate-200 rounded-full h-2 mb-3 overflow-hidden">
                        <div 
                            className={`h-2 rounded-full ${status.isOverBudget ? 'bg-rose-500' : (isRevenue ? 'bg-emerald-500' : 'bg-indigo-500')} transition-all duration-500`} 
                            style={{ width: `${Math.min(status.paidPercent, 100)}%` }}
                        ></div>
                    </div>
                    <div className="flex justify-between items-end">
                        <div>
                            <span className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">{isRevenue ? 'Đã thu' : 'Đã chi'}</span>
                            <span className="font-bold text-slate-900">{status.totalPaid.toLocaleString()}</span>
                        </div>
                        <div className="text-right">
                            <span className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">{isRevenue ? 'Còn phải thu' : 'Giá trị HĐ'}</span>
                            <span className={`font-bold ${isRevenue ? 'text-orange-600' : 'text-slate-900'}`}>
                                {isRevenue ? status.remaining.toLocaleString() : contract.value.toLocaleString()}
                            </span>
                        </div>
                    </div>
                </div>
              </div>
              
              <div className="mt-5 pt-4 border-t border-slate-100 flex justify-between items-center">
                 <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    {status.relatedTransactions.length} giao dịch
                 </div>
                 <span className="flex items-center text-[10px] font-black text-indigo-600 uppercase tracking-widest group-hover:translate-x-1 transition-transform">
                    Xem chi tiết <ChevronRight size={14} className="ml-1" />
                 </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* RENDER DETAIL MODAL */}
      {renderDetailModal()}

      {/* Modal Create Contract */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[160] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm animate-in fade-in">
           <div className="bg-white rounded-[32px] shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
             <div className="px-8 py-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <h2 className="text-xl font-black text-slate-900 uppercase tracking-tighter">Tạo Hợp Đồng Mới</h2>
              <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-white rounded-full text-slate-400 transition-colors">
                <X size={24}/>
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-8 space-y-6 custom-scrollbar">
               <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Tên Hợp Đồng / Gói Thầu *</label>
                <input 
                  type="text" 
                  required
                  autoFocus
                  className="w-full px-4 py-3 border-2 border-slate-100 rounded-2xl font-bold text-slate-800 focus:border-indigo-500 outline-none transition-colors"
                  placeholder="VD: Hợp đồng thi công điện nước..."
                  value={newContract.name || ''}
                  onChange={(e) => setNewContract({...newContract, name: e.target.value})}
                />
              </div>

               <div className="grid grid-cols-2 gap-4">
                 <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Loại Hợp Đồng</label>
                    <select 
                      className="w-full px-4 py-3 border-2 border-slate-100 rounded-2xl font-bold text-slate-800 bg-white focus:border-indigo-500 outline-none"
                      value={newContract.type}
                      onChange={(e) => setNewContract({...newContract, type: e.target.value as ContractType})}
                    >
                      <option value={ContractType.REVENUE}>HĐ Đầu Ra (Thu từ CĐT)</option>
                      <option disabled>──────────</option>
                      <option value={ContractType.SUPPLIER_MATERIAL}>Cung cấp vật tư</option>
                      <option value={ContractType.LABOR}>Nhân công / Khoán</option>
                      <option value={ContractType.SUB_CONTRACT}>Thầu phụ trọn gói</option>
                    </select>
                 </div>
                 <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Giá Trị HĐ (VND) *</label>
                    <input 
                      type="number" 
                      required
                      min="0"
                      className="w-full px-4 py-3 border-2 border-slate-100 rounded-2xl font-bold text-slate-800 focus:border-indigo-500 outline-none"
                      value={newContract.value}
                      onChange={(e) => setNewContract({...newContract, value: Number(e.target.value)})}
                    />
                 </div>
               </div>

               {/* Project & Partner Select */}
               <Combobox<Project>
                  label="Thuộc Công Trình *"
                  placeholder="Tìm công trình..."
                  items={projects}
                  selectedItem={selectedProject}
                  onSelect={setSelectedProject}
                  displayValue={(p) => p.name}
                  renderItem={(p) => <span className="font-bold">{p.code} - {p.name}</span>}
                  filterFunction={(p, q) => p.name.toLowerCase().includes(q.toLowerCase()) || p.code.toLowerCase().includes(q.toLowerCase())}
               />

               <Combobox<Partner>
                  label={newContract.type === ContractType.REVENUE ? "Chủ Đầu Tư / Khách Hàng *" : "Đối Tác / Nhà Thầu *"}
                  placeholder="Tìm đối tác..."
                  items={partners}
                  selectedItem={selectedPartner}
                  onSelect={setSelectedPartner}
                  displayValue={(p) => p.name}
                  renderItem={(p) => <span className="font-bold">{p.name} <span className="font-normal text-slate-400">({p.phone})</span></span>}
                  filterFunction={(p, q) => p.name.toLowerCase().includes(q.toLowerCase())}
               />

               <div className="grid grid-cols-2 gap-4">
                 <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Ngày ký</label>
                    <input 
                      type="date"
                      className="w-full px-4 py-3 border-2 border-slate-100 rounded-2xl font-bold text-slate-800 focus:border-indigo-500 outline-none"
                      value={newContract.signedDate ? newContract.signedDate.split('T')[0] : ''}
                      onChange={(e) => setNewContract({...newContract, signedDate: e.target.value})}
                    />
                 </div>
                 <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Trạng thái</label>
                    <select 
                      className="w-full px-4 py-3 border-2 border-slate-100 rounded-2xl font-bold text-slate-800 bg-white focus:border-indigo-500 outline-none"
                      value={newContract.status}
                      onChange={(e) => setNewContract({...newContract, status: e.target.value as ContractStatus})}
                    >
                      <option value={ContractStatus.DRAFT}>Dự thảo</option>
                      <option value={ContractStatus.SIGNED}>Đã ký kết</option>
                      <option value={ContractStatus.COMPLETED}>Đã hoàn thành</option>
                    </select>
                 </div>
               </div>

               <div>
                   <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Link Chứng từ (Google Drive)</label>
                   <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                        <ExternalLink size={16} className="text-slate-400" />
                      </div>
                      <input 
                        type="url" 
                        className="w-full pl-12 pr-4 py-3 border-2 border-slate-100 rounded-2xl font-bold text-indigo-600 focus:border-indigo-500 outline-none text-sm"
                        placeholder="https://drive.google.com/..."
                        value={newContract.fileLink || ''}
                        onChange={(e) => setNewContract({...newContract, fileLink: e.target.value})}
                      />
                   </div>
               </div>
                
               <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Ghi chú (Điều khoản thanh toán)</label>
                  <textarea 
                    className="w-full px-4 py-3 border-2 border-slate-100 rounded-2xl font-medium text-slate-600 focus:border-indigo-500 outline-none h-24 resize-none"
                    placeholder="VD: Tạm ứng 30%, Hoàn thiện 50%..."
                    value={newContract.note || ''}
                    onChange={(e) => setNewContract({...newContract, note: e.target.value})}
                  />
               </div>

               <div className="pt-6 flex space-x-4 border-t border-slate-50">
                  <button 
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="flex-1 py-4 text-slate-400 font-black uppercase text-[11px] tracking-widest hover:text-slate-600 transition-colors"
                  >
                    Hủy bỏ
                  </button>
                  <button 
                    type="submit"
                    className="flex-1 py-4 bg-indigo-600 text-white rounded-2xl font-black uppercase text-[11px] tracking-widest shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all active:scale-95"
                  >
                    Lưu Hợp Đồng
                  </button>
               </div>
            </form>
           </div>
        </div>
      )}
    </div>
  );
};

export default ContractManager;
