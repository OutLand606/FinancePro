
import React, { useState, useMemo } from 'react';
import { Transaction, Project, Partner, CashAccount, TransactionStatus, Contract } from '../types';
import { calculateTaxKpi } from '../services/taxKpiService';
import { DEFAULT_KPI_TARGETS } from '../constants';
import { AlertTriangle, TrendingUp, TrendingDown, FileWarning, DollarSign, Filter, Receipt, FileText, Calendar, Search, ArrowRight, Briefcase, X } from 'lucide-react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend } from 'recharts';

interface TaxKpiDashboardProps {
  transactions: Transaction[];
  projects: Project[];
  partners: Partner[];
  accounts: CashAccount[];
  contracts?: Contract[]; // Make optional or required
}

const TaxKpiDashboard: React.FC<TaxKpiDashboardProps> = ({ transactions, projects, partners, accounts, contracts = [] }) => {
  // Filters
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  const [detailTransaction, setDetailTransaction] = useState<any>(null);
  const [projectId, setProjectId] = useState('');
  const [partnerId, setPartnerId] = useState('');
  const [accountId, setAccountId] = useState('');
  const [onlyPaid, setOnlyPaid] = useState(true);
  const [searchText, setSearchText] = useState('');

  // Auto-calculate dates based on Year selection
  const startDate = `${selectedYear}-01-01`;
  const endDate = `${selectedYear}-12-31`;

  const stats = useMemo(() => {
    const rawStats = calculateTaxKpi(transactions, projects, contracts, {
      projectId,
      partnerId,
      accountId,
      onlyPaid,
      startDate,
      endDate
    });

    // Apply text filter to details list
    if (searchText) {
        const lower = searchText.toLowerCase();
        const filterFn = (t: Transaction) => t.description.toLowerCase().includes(lower) || (t.code || '').toLowerCase().includes(lower);
        rawStats.details.missingVatTransactions = rawStats.details.missingVatTransactions.filter(filterFn);
        rawStats.details.missingLaborTransactions = rawStats.details.missingLaborTransactions.filter(filterFn);
    }

    return rawStats;
  }, [transactions, projects, contracts, projectId, partnerId, accountId, onlyPaid, startDate, endDate, searchText]);

  const COLORS = ['#10b981', '#ef4444', '#f59e0b', '#3b82f6'];

  const vatChartData = [
    { name: 'Có VAT', value: stats.expenseWithVat },
    { name: 'Không VAT', value: stats.totalExpense - stats.expenseWithVat }
  ];

  return (
    <div className="h-full overflow-y-auto custom-scrollbar space-y-6 pr-2">
      {/* Header & Filters */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Kiểm Soát Thuế & KPI</h1>
          <p className="text-gray-500">Theo dõi tỷ lệ VAT đầu vào và cảnh báo rủi ro chứng từ.</p>
        </div>
        
        {/* YEAR SELECTOR */}
        <div className="flex items-center bg-white border border-gray-300 rounded-lg p-1 shadow-sm">
            <span className="px-3 text-sm text-gray-500 font-medium flex items-center"><Calendar size={16} className="mr-2"/> Năm Tài Chính:</span>
            {[currentYear - 1, currentYear, currentYear + 1].map(y => (
                <button
                    key={y}
                    onClick={() => setSelectedYear(y)}
                    className={`px-4 py-1.5 text-sm rounded-md transition-colors font-bold ${selectedYear === y ? 'bg-indigo-600 text-white shadow-sm' : 'text-gray-600 hover:bg-gray-100'}`}
                >
                    {y}
                </button>
            ))}
        </div>
      </div>

      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 grid grid-cols-1 md:grid-cols-4 gap-4">
         <select className="border rounded p-2 text-sm" value={projectId} onChange={e => setProjectId(e.target.value)}>
            <option value="">-- Tất cả dự án --</option>
            {projects.map(p => <option key={p.id} value={p.id}>{p.code} - {p.name}</option>)}
         </select>
         <select className="border rounded p-2 text-sm" value={accountId} onChange={e => setAccountId(e.target.value)}>
            <option value="">-- Tài khoản --</option>
            {accounts.map(a => <option key={a.id} value={a.id}>{a.bankName} - {a.accountName}</option>)}
         </select>
         <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded border border-gray-200 text-sm text-gray-600">
            <span>Kỳ: 01/01 - 31/12/{selectedYear}</span>
         </div>
         <div className="flex items-center">
            <label className="flex items-center cursor-pointer">
               <input type="checkbox" className="mr-2" checked={onlyPaid} onChange={e => setOnlyPaid(e.target.checked)} />
               <span className="text-sm text-gray-700">Chỉ tính Đã Chi (PAID)</span>
            </label>
         </div>
      </div>

      {/* KPI Widgets */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
         {/* VAT Input Ratio (Updated Context) */}
         <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm relative overflow-hidden">
            <h3 className="text-sm font-medium text-gray-500 mb-2">VAT Đầu Vào / Giá Trị Hợp Đồng</h3>
            <div className="flex items-end">
               <span className={`text-3xl font-bold ${stats.vatInputRatio < DEFAULT_KPI_TARGETS.targetVatInputRatio ? 'text-red-600' : 'text-green-600'}`}>
                  {stats.vatInputRatio.toFixed(1)}%
               </span>
               <span className="text-xs text-gray-400 mb-1 ml-2">/ Mục tiêu {DEFAULT_KPI_TARGETS.targetVatInputRatio}%</span>
            </div>
            <div className="mt-2 w-full bg-gray-200 rounded-full h-1.5">
               <div className={`h-1.5 rounded-full ${stats.vatInputRatio < DEFAULT_KPI_TARGETS.targetVatInputRatio ? 'bg-red-500' : 'bg-green-500'}`} style={{width: `${Math.min(stats.vatInputRatio, 100)}%`}}></div>
            </div>
            <div className="mt-2 text-[10px] text-gray-400 flex justify-between">
                <span>Chi có VAT: {(stats.expenseWithVat/1000000).toFixed(0)}Tr</span>
                <span>HĐ: {(stats.totalContractValue/1000000).toFixed(0)}Tr</span>
            </div>
         </div>

         {/* Missing VAT Warning */}
         <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
            <h3 className="text-sm font-medium text-gray-500 mb-2">Thiếu Hóa Đơn VAT</h3>
            <div className="flex items-center justify-between">
               <div>
                   <span className="text-3xl font-bold text-orange-600">{stats.alerts.missingVatCount}</span>
                   <p className="text-xs font-bold text-orange-500 mt-1">~ {(stats.alerts.missingVatAmount/1000000).toFixed(1)} Tr</p>
               </div>
               <div className="p-2 bg-orange-100 rounded-lg text-orange-600"><Receipt size={24} /></div>
            </div>
            <p className="text-xs text-gray-400 mt-2">Tổng giá trị chưa có hóa đơn</p>
         </div>

         {/* Missing Contract Warning */}
         <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
            <h3 className="text-sm font-medium text-gray-500 mb-2">Thiếu HĐ Nhân Công</h3>
            <div className="flex items-center justify-between">
               <div>
                   <span className="text-3xl font-bold text-red-600">{stats.alerts.missingLaborContractCount}</span>
                   <p className="text-xs font-bold text-red-500 mt-1">~ {(stats.alerts.missingLaborContractAmount/1000000).toFixed(1)} Tr</p>
               </div>
               <div className="p-2 bg-red-100 rounded-lg text-red-600"><FileWarning size={24} /></div>
            </div>
            <p className="text-xs text-gray-400 mt-2">Chi lương/nhân công thiếu HĐ</p>
         </div>

         {/* Missing Files */}
         <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
            <h3 className="text-sm font-medium text-gray-500 mb-2">Thiếu Chứng Từ Gốc</h3>
            <div className="flex items-center justify-between">
               <span className="text-3xl font-bold text-gray-800">{stats.alerts.missingFilesCount}</span>
               <div className="p-2 bg-gray-100 rounded-lg text-gray-600"><FileText size={24} /></div>
            </div>
            <p className="text-xs text-gray-400 mt-2">Giao dịch chưa upload file</p>
         </div>
      </div>

      {/* Charts & Details */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
         {/* VAT Breakdown Chart */}
         <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
            <h3 className="font-bold text-gray-800 mb-4">Cơ cấu Chi phí (VAT)</h3>
            <div className="h-64">
               <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                     <Pie
                        data={vatChartData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="value"
                     >
                        <Cell fill="#10b981" />
                        <Cell fill="#ef4444" />
                     </Pie>
                     <Tooltip formatter={(val: number) => val.toLocaleString('vi-VN')} />
                     <Legend />
                  </PieChart>
               </ResponsiveContainer>
            </div>
         </div>

         {/* Alert Drilldown List */}
         <div className="lg:col-span-2 bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-gray-100 bg-red-50 flex justify-between items-center">
               <h3 className="font-bold text-red-800 flex items-center">
                  <AlertTriangle size={18} className="mr-2" />
                  Giao dịch cần bổ sung hồ sơ ({stats.details.missingVatTransactions.length + stats.details.missingLaborTransactions.length})
               </h3>
               <div className="relative">
                   <input 
                    className="pl-8 pr-3 py-1.5 text-xs rounded border border-red-200 outline-none focus:border-red-400" 
                    placeholder="Tìm theo nội dung..." 
                    value={searchText}
                    onChange={e => setSearchText(e.target.value)}
                   />
                   <Search size={12} className="absolute left-2.5 top-2 text-red-400"/>
               </div>
            </div>
            <div className="overflow-x-auto flex-1 custom-scrollbar max-h-80">
               <table className="w-full text-sm text-left">
                  <thead className="bg-gray-50 text-gray-600 sticky top-0">
                     <tr>
                        <th className="px-6 py-3">Ngày</th>
                        <th className="px-6 py-3">Nội dung</th>
                        <th className="px-6 py-3">Số tiền</th>
                        <th className="px-6 py-3">Vấn đề</th>
                        <th className="px-6 py-3"></th>
                     </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                     {/* Combine lists for display */}
                     {[
                        ...stats.details.missingVatTransactions.map(t => ({...t, issue: 'Thiếu VAT'})),
                        ...stats.details.missingLaborTransactions.map(t => ({...t, issue: 'Thiếu HĐ Nhân công'}))
                     ].map(t => (
                        <tr key={t.id} className="hover:bg-gray-50 group">
                           <td className="px-6 py-3 text-gray-500 text-xs">{new Date(t.date).toLocaleDateString('vi-VN')}</td>
                           <td className="px-6 py-3 font-medium text-gray-900 text-xs">{t.description}</td>
                           <td className="px-6 py-3 text-red-600 font-bold">{t.amount.toLocaleString('vi-VN')}</td>
                           <td className="px-6 py-3">
                              <span className="px-2 py-1 rounded text-[10px] font-bold bg-red-100 text-red-700 uppercase">
                                 {t.issue}
                              </span>
                           </td>
                           <td className="px-6 py-3 text-right">
                               <button 
                               onClick={() => setDetailTransaction(t)}
                               className="text-xs font-bold text-indigo-600 hover:underline flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
                                   Chi tiết <ArrowRight size={12} className="ml-1"/>
                               </button>
                           </td>
                        </tr>
                     ))}
                     {stats.details.missingVatTransactions.length === 0 && stats.details.missingLaborTransactions.length === 0 && (
                        <tr><td colSpan={5} className="px-6 py-12 text-center text-gray-500">Tuyệt vời! Không có cảnh báo nào.</td></tr>
                     )}
                  </tbody>
               </table>
            </div>
         </div>
      </div>

      {/* MODAL CHI TIẾT GIAO DỊCH */}
      {detailTransaction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="font-bold text-slate-800 text-lg">Chi tiết cảnh báo</h3>
              <button 
                onClick={() => setDetailTransaction(null)} 
                className="text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X size={20}/>
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4">
              <div className="p-3 bg-red-50 border border-red-100 rounded-xl flex items-start gap-3">
                 <div className="p-2 bg-white rounded-lg text-red-500 shadow-sm"><AlertTriangle size={20}/></div>
                 <div>
                    <p className="text-[10px] font-bold text-red-400 uppercase tracking-wider">Vấn đề phát hiện</p>
                    <p className="font-bold text-red-700">{detailTransaction.issue}</p>
                 </div>
              </div>

              <div className="space-y-3">
                 <div className="flex justify-between border-b border-slate-50 pb-2">
                    <span className="text-sm text-slate-500">Ngày giao dịch</span>
                    <span className="text-sm font-bold text-slate-700">{new Date(detailTransaction.date).toLocaleDateString('vi-VN')}</span>
                 </div>
                 <div className="flex justify-between border-b border-slate-50 pb-2">
                    <span className="text-sm text-slate-500">Số tiền</span>
                    <span className="text-sm font-bold text-slate-700">{detailTransaction.amount.toLocaleString()} ₫</span>
                 </div>
                 <div>
                    <span className="text-sm text-slate-500 block mb-1">Nội dung</span>
                    <p className="text-sm font-medium text-slate-800 bg-slate-50 p-2 rounded-lg">{detailTransaction.description}</p>
                 </div>
                 
                 <div className="grid grid-cols-2 gap-4 pt-2">
                    <div>
                        <span className="text-[10px] text-slate-400 font-bold uppercase">Dự án</span>
                        <p className="text-xs font-bold text-slate-600 truncate">
                            {projects.find(p => p.id === detailTransaction.projectId)?.name || '---'}
                        </p>
                    </div>
                    <div>
                        <span className="text-[10px] text-slate-400 font-bold uppercase">Đối tác</span>
                        <p className="text-xs font-bold text-slate-600 truncate">
                            {partners.find(p => p.id === detailTransaction.partnerId)?.name || '---'}
                        </p>
                    </div>
                 </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end">
               <button 
                  onClick={() => setDetailTransaction(null)}
                  className="px-4 py-2 bg-white border border-slate-300 rounded-lg text-sm font-bold text-slate-600 hover:bg-slate-100 transition-colors"
               >
                  Đóng
               </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TaxKpiDashboard;
