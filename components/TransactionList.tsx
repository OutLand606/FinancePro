
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Transaction, Project, TransactionType, TransactionStatus, UserContext, Partner, Attachment, CashAccount, Employee, TransactionScope, AccountType } from '../types';
import { 
  Search, Download, Plus, Trash2, Eye, X, CheckCircle, Receipt, Building2, 
  Wallet, Filter, Calendar, FileText, Check, Clock, AlertCircle, Image as ImageIcon, 
  ArrowRight, TrendingUp, TrendingDown, DollarSign, CreditCard, User, MoreHorizontal, 
  Paperclip, ArrowUpRight, ArrowDownLeft, ChevronDown, Upload, Printer, FileSpreadsheet, Edit3, Square, CheckSquare, Banknote, PieChart, ExternalLink, RefreshCw, AlertTriangle, Landmark
} from 'lucide-react';
import { hasPermission } from '../services/authService';
import { getEmployees } from '../services/employeeService';
import { exportTransactionsToCSV, exportBatchPayment } from '../services/excelExportService';
import { fetchCashAccounts } from '../services/cashAccountService'; // Import service directly
import { TransactionService } from '../services/transactionService'; 
import TransactionForm from './TransactionForm';
import AttachmentViewer from './AttachmentViewer';
import ExcelImportModal from './ExcelImportModal';
import VoucherModal from './VoucherModal';
import GoogleFormImportModal from './GoogleFormImportModal'; 
import AIAssistantWidget from './AIAssistantWidget'; // NEW IMPORT

interface TransactionListProps {
    currentUser: UserContext;
    transactions: Transaction[];
    projects: Project[];
    partners: Partner[];
    accounts: CashAccount[];
    onAddTransaction: (t: Transaction) => void;
    onUpdateTransaction: (t: Transaction) => void;
    onDeleteTransaction: (id: string) => void;
    onAddProject: (p: Project) => void;
    onAddPartner: (p: Partner) => void;
}

const LIST_CONFIG_KEY = 'finance_transaction_list_config_v2';

const TransactionList: React.FC<TransactionListProps> = ({ 
    currentUser, transactions = [], projects = [], partners = [], accounts: propAccounts = [],
    onAddTransaction, onUpdateTransaction, onDeleteTransaction, onAddProject, onAddPartner 
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'LIST' | 'APPROVAL' | 'UNPAID'>('LIST');
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'INCOME' | 'EXPENSE'>('ALL');
  
  const currentYear = new Date().getFullYear();
  const [timeFilterMode, setTimeFilterMode] = useState<'MONTH' | 'QUARTER' | 'YEAR' | 'ALL'>('ALL');
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedQuarter, setSelectedQuarter] = useState(Math.ceil((new Date().getMonth() + 1) / 3));

  // PERSISTENT FORM CONFIG
  const [formConfig, setFormConfig] = useState<{isOpen: boolean, type: TransactionType, initialData?: Transaction}>(() => {
      try {
          const saved = localStorage.getItem(LIST_CONFIG_KEY);
          return saved ? JSON.parse(saved) : { isOpen: false, type: TransactionType.EXPENSE };
      } catch { return { isOpen: false, type: TransactionType.EXPENSE }; }
  });

  useEffect(() => { localStorage.setItem(LIST_CONFIG_KEY, JSON.stringify(formConfig)); }, [formConfig]);

  const [viewingAttachment, setViewingAttachment] = useState<Attachment | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showImportModal, setShowImportModal] = useState(false);
  const [showGoogleFormImport, setShowGoogleFormImport] = useState(false);
  
  // Voucher Printing State
  const [printingTransaction, setPrintingTransaction] = useState<Transaction | null>(null);
  
  const [rejectModalOpen, setRejectModalOpen] = useState<Transaction | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  
  // Payment / Collection Modals
  const [accountSelectionModal, setAccountSelectionModal] = useState<{ transaction: Transaction, nextStatus: TransactionStatus } | null>(null);
  const [confirmIncomeModal, setConfirmIncomeModal] = useState<Transaction | null>(null);

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [proofFiles, setProofFiles] = useState<File[]>([]);
  const proofInputRef = useRef<HTMLInputElement>(null);
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');

  // Local Accounts State to ensure sync
  const [liveAccounts, setLiveAccounts] = useState<CashAccount[]>(propAccounts);

  // BATCH PAYMENT STATE
  const [selectedTransIds, setSelectedTransIds] = useState<Set<string>>(new Set());
  const [batchSourceAccountId, setBatchSourceAccountId] = useState<string>('');
  const [showBatchModal, setShowBatchModal] = useState(false); 
  
  // Fund visibility toggle
  const [showFundOverview, setShowFundOverview] = useState(true);

  useEffect(() => { getEmployees().then(setEmployees); }, []);

  // Update live accounts when props change, but also allow manual refresh
  // FIX: Fetch fresh accounts on mount to solve sync issue
  useEffect(() => { 
      refreshAccounts(); 
  }, [propAccounts]);

  const refreshAccounts = async () => {
      const latest = await fetchCashAccounts();
      setLiveAccounts(latest);
  };

  const filteredTransactions = useMemo(() => {
    let base = transactions;
    const perms = currentUser?.permissions || [];
    const canViewAll = perms.some(p => ['SYS_ADMIN', 'TRANS_VIEW_ALL'].includes(p));
    
    if (!canViewAll) {
        base = base.filter(t => t.requesterId === currentUser.id);
    }

    if (timeFilterMode !== 'ALL') {
        base = base.filter(t => {
            if (!t.date) return false;
            const d = new Date(t.date);
            const y = d.getFullYear();
            const m = d.getMonth() + 1;
            if (y !== selectedYear) return false;
            if (timeFilterMode === 'MONTH') return m === selectedMonth;
            if (timeFilterMode === 'QUARTER') return Math.ceil(m / 3) === selectedQuarter;
            return true;
        });
    }

    return base.filter(t => {
      const projName = projects.find(p=>p.id===t.projectId)?.name || '';
      const partName = partners.find(p=>p.id===t.partnerId)?.name || '';
      const searchStr = (t.description + ' ' + projName + ' ' + partName + ' ' + (t.code || '')).toLowerCase();
      const matchSearch = searchTerm ? searchStr.includes(searchTerm.toLowerCase()) : true;
      const matchType = typeFilter === 'ALL' || t.type === typeFilter;
      return matchSearch && matchType;
    }).sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [transactions, searchTerm, projects, partners, activeSubTab, typeFilter, timeFilterMode, selectedYear, selectedMonth, selectedQuarter]);



  // --- ACCOUNT BALANCES (Live calculation including INITIAL BALANCE) ---
  const accountBalances = useMemo(() => {
      return liveAccounts.map(acc => {
          const transBalance = transactions
              .filter(t => t.targetAccountId === acc.id && t.status === TransactionStatus.PAID)
              .reduce((sum, t) => sum + (t.type === TransactionType.INCOME ? t.amount : -t.amount), 0);
          
          const totalBalance = (acc.initialBalance || 0) + transBalance;
          
          return { ...acc, balance: totalBalance };
      });
  }, [liveAccounts, transactions]);

  // --- BUSINESS ACTIONS VIA SERVICE ---
  const handleApprove = async (t: Transaction) => {
      if (!hasPermission(currentUser, 'TRANS_APPROVE')) return alert("Bạn không có quyền duyệt phiếu.");
      try {
          const updated = await TransactionService.approve(t, currentUser.id);
          onUpdateTransaction(updated); 
      } catch (e: any) { alert(e.message); }
  };

  const handleReject = async () => {
      if (!rejectModalOpen || !rejectReason) return;
      try {
          const updated = await TransactionService.reject(rejectModalOpen, rejectReason, currentUser.id);
          onUpdateTransaction(updated);
          setRejectModalOpen(null); setRejectReason('');
      } catch (e: any) { alert(e.message); }
  };

  const initiatePayment = async (t: Transaction) => {
      if (!hasPermission(currentUser, 'TRANS_PAY')) return alert("Bạn không có quyền xác nhận chi tiền.");
      await refreshAccounts();
      if (!t.targetAccountId) {
          setProofFiles([]);
          setSelectedAccountId('');
          setAccountSelectionModal({ transaction: t, nextStatus: TransactionStatus.PAID });
      } else {
          setAccountSelectionModal({ transaction: t, nextStatus: TransactionStatus.PAID });
          setSelectedAccountId(t.targetAccountId);
      }
  };

  const initiateCollection = async (t: Transaction) => {
      await refreshAccounts();
      setSelectedAccountId(t.targetAccountId || '');
      setConfirmIncomeModal(t);
  };

  const handleExpensePaymentSubmit = async () => {
      if (!accountSelectionModal) return;
      const { transaction } = accountSelectionModal;
      const finalAcc = selectedAccountId || transaction.targetAccountId;
      if (!finalAcc) return alert("Vui lòng chọn tài khoản.");
      
      try {
          const updated = await TransactionService.pay(transaction, finalAcc, currentUser.id);
          onUpdateTransaction(updated);
          setAccountSelectionModal(null);
          setSelectedAccountId('');
      } catch (e: any) { alert(e.message); }
  };

  const handleIncomeConfirmSubmit = async () => {
      if (!confirmIncomeModal) return;
      const finalAcc = selectedAccountId || confirmIncomeModal.targetAccountId;
      if (!finalAcc) return alert("Vui lòng chọn quỹ nhận tiền.");

      try {
          const updated = await TransactionService.confirmIncome(confirmIncomeModal, finalAcc, currentUser.id);
          onUpdateTransaction(updated);
          setConfirmIncomeModal(null);
          setSelectedAccountId('');
          alert("Đã xác nhận thu tiền và cập nhật số dư quỹ.");
      } catch (e: any) { alert(e.message); }
  };

  // --- BATCH ACTIONS ---
  const toggleSelection = (id: string) => {
      const newSet = new Set(selectedTransIds);
      if (newSet.has(id)) newSet.delete(id); else newSet.add(id);
      setSelectedTransIds(newSet);
  };

  const handleBulkApprove = async () => {
      const toApprove = transactions.filter(t => selectedTransIds.has(t.id) && t.status === TransactionStatus.SUBMITTED);
      if (toApprove.length === 0) return alert("Không có phiếu nào ở trạng thái 'Chờ duyệt'.");
      if (!confirm(`Xác nhận DUYỆT ${toApprove.length} phiếu?`)) return;

      for (const t of toApprove) {
          await handleApprove(t);
      }
      setSelectedTransIds(new Set());
      alert(`Đã duyệt ${toApprove.length} phiếu.`);
  };

  const handleBatchExport = async () => {
      if (selectedTransIds.size === 0) return alert("Chưa chọn phiếu.");
      
      await refreshAccounts(); // Ensure accounts fresh for dropdown if reused
      if (!batchSourceAccountId) return alert("Vui lòng chọn tài khoản trích nợ.");
      
      const selectedTrans = transactions.filter(t => selectedTransIds.has(t.id));
      const sourceAccount = liveAccounts.find(a => a.id === batchSourceAccountId);
      exportBatchPayment(selectedTrans, partners, employees, sourceAccount);
      setShowBatchModal(false);
  };

  const handleGoogleImport = (importedTrans: Transaction[]) => {
      importedTrans.forEach(t => onAddTransaction(t));
      alert(`Đã nhập ${importedTrans.length} giao dịch từ Google Form.`);
  };

  const canCreateTransactionCreater = useMemo(() => {
      const perms = currentUser?.permissions || [];
      if (perms.includes('SYS_ADMIN')) return true;
      return perms.some(p => ['TRANS_CREATE'].includes(p));
  }, [currentUser]);

  const canCreateTransactionApprove = useMemo(() => {
      const perms = currentUser?.permissions || [];
      if (perms.includes('SYS_ADMIN')) return true;
      return perms.some(p => ['TRANS_APPROVE'].includes(p));
  }, [currentUser]);

  const canCreateTransactionPay = useMemo(() => {
      const perms = currentUser?.permissions || [];
      if (perms.includes('SYS_ADMIN')) return true;
      return perms.some(p => ['TRANS_PAY'].includes(p));
  }, [currentUser]);

  const accessibleTransactions = useMemo(() => {
      const perms = currentUser?.permissions || [];
      
      // Check quyền xem tất cả
      const canViewAll = perms.some(p => ['SYS_ADMIN', 'TRANS_VIEW_ALL'].includes(p));

      if (canViewAll) {
          return transactions;
      }
      return transactions.filter(t => t.requesterId === currentUser.id);
  }, [transactions, currentUser]);

    // --- STATS CALCULATION ---
  const stats = useMemo(() => {
      // Stats cần tuân theo bộ lọc thời gian (Tháng/Quý/Năm) để số liệu có ý nghĩa
      let sourceData = accessibleTransactions;

      if (timeFilterMode !== 'ALL') {
          sourceData = sourceData.filter(t => {
              if (!t.date) return false;
              const d = new Date(t.date);
              const y = d.getFullYear();
              const m = d.getMonth() + 1;
              if (y !== selectedYear) return false;
              if (timeFilterMode === 'MONTH') return m === selectedMonth;
              if (timeFilterMode === 'QUARTER') return Math.ceil(m / 3) === selectedQuarter;
              return true;
          });
      }

      const paidIncome = sourceData
          .filter(t => t.type === TransactionType.INCOME && t.status === TransactionStatus.PAID)
          .reduce((s, t) => s + t.amount, 0);

      const paidExpense = sourceData
          .filter(t => t.type === TransactionType.EXPENSE && t.status === TransactionStatus.PAID)
          .reduce((s, t) => s + t.amount, 0);

      const pendingExpense = sourceData
          .filter(t => t.type === TransactionType.EXPENSE && (t.status === TransactionStatus.SUBMITTED || t.status === TransactionStatus.APPROVED))
          .reduce((s, t) => s + t.amount, 0);

      return { paidIncome, paidExpense, pendingExpense };
  }, [accessibleTransactions, timeFilterMode, selectedYear, selectedMonth, selectedQuarter]);

  return (
    <div className="space-y-6 pb-20 animate-in fade-in duration-300 relative">
      
      {/* 1. HEADER & ACTIONS */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm">
          <div className="flex items-center gap-4">
              <div className="bg-indigo-600 w-12 h-12 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-indigo-100"><Wallet size={24}/></div>
              <div>
                  <h1 className="text-xl font-black text-slate-900 tracking-tight uppercase">Sổ Thu Chi</h1>
                  <p className="text-sm text-slate-500 font-medium">Quản lý dòng tiền & Phê duyệt chi</p>
              </div>
          </div>
          <div className="flex gap-2">
              <button onClick={() => setShowGoogleFormImport(true)} className="flex items-center px-4 py-3 bg-green-50 text-green-700 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-green-100 transition-all border border-green-200">
                  <FileSpreadsheet size={16} className="mr-2"/> Nhập từ Google Form
              </button>
              <button 
                disabled={!canCreateTransactionCreater}
                onClick={() => setFormConfig({ isOpen: true, type: TransactionType.INCOME })} 
                className={`flex items-center px-6 py-3 rounded-xl font-black text-[11px] uppercase tracking-widest transition-all 
                    ${canCreateTransactionCreater 
                        ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-200 hover:bg-emerald-700 active:scale-95' 
                        : 'bg-slate-100 text-slate-400 cursor-not-allowed opacity-70 shadow-none'
                    }`}
              >
                  <ArrowDownLeft size={18} className="mr-2" /> Lập Phiếu Thu
              </button>
              
              <button 
                disabled={!canCreateTransactionCreater}
                onClick={() => setFormConfig({ isOpen: true, type: TransactionType.EXPENSE })} 
                className={`flex items-center px-6 py-3 rounded-xl font-black text-[11px] uppercase tracking-widest transition-all 
                    ${canCreateTransactionCreater 
                        ? 'bg-rose-600 text-white shadow-lg shadow-rose-200 hover:bg-rose-700 active:scale-95' 
                        : 'bg-slate-100 text-slate-400 cursor-not-allowed opacity-70 shadow-none'
                    }`}
              >
                  <ArrowUpRight size={18} className="mr-2" /> Lập Phiếu Chi
              </button>
          </div>
      </div>

      {/* 2. FUND VISIBILITY BAR (NEW) */}
      {/* <div className="bg-slate-900 rounded-[24px] p-4 text-white shadow-md relative overflow-hidden">
          <div className="flex justify-between items-center mb-2">
              <h3 className="text-xs font-black uppercase tracking-widest flex items-center text-indigo-200">
                  <Landmark size={14} className="mr-2"/> Tình hình Quỹ Tiền Hiện Tại (Real-time)
              </h3>
              <div className="flex gap-2">
                  <button onClick={refreshAccounts} className="text-[10px] bg-white/10 px-2 py-1 rounded hover:bg-white/20 transition-all flex items-center"><RefreshCw size={10} className="mr-1"/> Sync</button>
                  <button onClick={() => setShowFundOverview(!showFundOverview)} className="text-[10px] bg-white/10 px-2 py-1 rounded hover:bg-white/20 transition-all">
                      {showFundOverview ? 'Thu gọn' : 'Mở rộng'}
                  </button>
              </div>
          </div>
          
          {showFundOverview && (
              <div className="flex gap-4 overflow-x-auto pb-2 custom-scrollbar">
                  {accountBalances.map(acc => (
                      <div key={acc.id} className="min-w-[180px] bg-white/10 rounded-xl p-3 border border-white/10 flex items-center gap-3 hover:bg-white/20 transition-all">
                          <div className={`p-2 rounded-lg ${acc.type === AccountType.CASH ? 'bg-emerald-500/20 text-emerald-300' : 'bg-blue-500/20 text-blue-300'}`}>
                              {acc.type === AccountType.CASH ? <Wallet size={16}/> : <Landmark size={16}/>}
                          </div>
                          <div>
                              <p className="text-[10px] font-bold opacity-70 truncate max-w-[100px]" title={acc.accountName}>{acc.bankName}</p>
                              <p className="text-sm font-black tracking-wide">{acc.balance.toLocaleString()} ₫</p>
                          </div>
                      </div>
                  ))}
                  {accountBalances.length === 0 && <span className="text-xs italic text-slate-400">Chưa cấu hình quỹ tiền.</span>}
              </div>
          )}
      </div> */}

      {/* 3. STATS & FILTERS */}
      <div className="bg-white p-4 rounded-[24px] border border-slate-200 shadow-sm flex flex-col gap-4">
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-2">
              <div className="bg-emerald-50 p-4 rounded-2xl border border-emerald-100 flex items-center justify-between">
                  <div>
                      <p className="text-[10px] font-black uppercase text-emerald-600 tracking-widest">Tổng Thu (Paid)</p>
                      <p className="text-xl font-black text-emerald-700">{stats.paidIncome.toLocaleString()} ₫</p>
                  </div>
                  <div className="p-2 bg-white rounded-xl text-emerald-600"><ArrowDownLeft size={20}/></div>
              </div>
              <div className="bg-rose-50 p-4 rounded-2xl border border-rose-100 flex items-center justify-between">
                  <div>
                      <p className="text-[10px] font-black uppercase text-rose-600 tracking-widest">Tổng Chi (Paid)</p>
                      <p className="text-xl font-black text-rose-700">{stats.paidExpense.toLocaleString()} ₫</p>
                  </div>
                  <div className="p-2 bg-white rounded-xl text-rose-600"><ArrowUpRight size={20}/></div>
              </div>
              <div className="bg-amber-50 p-4 rounded-2xl border border-amber-100 flex items-center justify-between">
                  <div>
                      <p className="text-[10px] font-black uppercase text-amber-600 tracking-widest">Chờ Chi / Duyệt</p>
                      <p className="text-xl font-black text-amber-700">{stats.pendingExpense.toLocaleString()} ₫</p>
                  </div>
                  <div className="p-2 bg-white rounded-xl text-amber-600"><Clock size={20}/></div>
              </div>
          </div>

          <div className="flex flex-wrap gap-2 border-b border-slate-50 pb-4 mb-2">
              {[
                  { id: 'LIST', label: 'Tất cả', icon: FileText },
                  { id: 'APPROVAL', label: 'Cần Duyệt', icon: AlertCircle, count: transactions.filter(t => t.status === TransactionStatus.SUBMITTED).length },
                  { id: 'UNPAID', label: 'Chờ Chi', icon: Clock, count: transactions.filter(t => t.type === TransactionType.EXPENSE && t.status === TransactionStatus.APPROVED).length }
              ].map(tab => (
                  <button key={tab.id} onClick={() => setActiveSubTab(tab.id as any)} className={`flex items-center px-4 py-2 rounded-xl text-xs font-bold transition-all ${activeSubTab === tab.id ? 'bg-indigo-600 text-white shadow-md' : 'bg-slate-50 text-slate-500 hover:bg-slate-100'}`}>
                      <tab.icon size={14} className="mr-2"/> {tab.label}
                      {tab.count !== undefined && tab.count > 0 && <span className="ml-2 bg-white/20 px-1.5 py-0.5 rounded text-[10px]">{tab.count}</span>}
                  </button>
              ))}
              <div className="w-px bg-slate-200 mx-2 h-6 self-center"></div>
              <button onClick={() => setTimeFilterMode('ALL')} className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase ${timeFilterMode === 'ALL' ? 'bg-indigo-100 text-indigo-700' : 'text-slate-400'}`}>Tất cả thời gian</button>
              <button onClick={() => setTimeFilterMode('MONTH')} className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase ${timeFilterMode === 'MONTH' ? 'bg-indigo-100 text-indigo-700' : 'text-slate-400'}`}>Theo Tháng</button>
              {timeFilterMode === 'MONTH' && <input type="month" className="border rounded px-2 py-1 text-xs font-bold" value={`${selectedYear}-${selectedMonth.toString().padStart(2,'0')}`} onChange={e => { const d = new Date(e.target.value); setSelectedYear(d.getFullYear()); setSelectedMonth(d.getMonth() + 1); }} />}
          </div>
          
          <div className="flex gap-4 items-center">
              <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                  <input type="text" placeholder="Tìm kiếm..." className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border-none rounded-xl text-sm font-bold focus:ring-2 focus:ring-indigo-500/20 outline-none" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
              </div>
              <div className="flex gap-2">
                  <button onClick={() => exportTransactionsToCSV(filteredTransactions, projects, partners, employees)} className="p-2.5 bg-slate-100 text-slate-600 rounded-xl hover:bg-white hover:shadow-md transition-all border border-transparent hover:border-slate-200" title="Xuất Excel"><Download size={18}/></button>
              </div>
          </div>
      </div>

      {/* 4. BATCH ACTIONS BAR */}
      {selectedTransIds.size > 0 && (
          <div className="bg-indigo-50 border border-indigo-100 p-3 rounded-xl flex items-center justify-between animate-in slide-in-from-top-2">
              <div className="flex items-center gap-4">
                  <span className="text-xs font-black text-indigo-700 bg-white px-3 py-1 rounded-lg shadow-sm">{selectedTransIds.size} mục đã chọn</span>
                  <button onClick={() => setSelectedTransIds(new Set())} className="text-xs font-bold text-slate-500 hover:text-slate-700">Bỏ chọn</button>
              </div>
              <div className="flex gap-2">
                  {activeSubTab === 'APPROVAL' && <button onClick={handleBulkApprove} className="flex items-center px-4 py-1.5 bg-indigo-600 text-white rounded-lg text-[10px] font-black uppercase hover:bg-indigo-700 shadow-sm"><CheckCircle size={14} className="mr-1"/> Duyệt nhanh</button>}
                  {activeSubTab === 'UNPAID' && <button onClick={async () => { await refreshAccounts(); setShowBatchModal(true); }} className="flex items-center px-4 py-1.5 bg-white border border-indigo-200 text-indigo-700 rounded-lg text-[10px] font-black uppercase hover:bg-indigo-50"><FileText size={14} className="mr-1"/> Xuất lệnh chi (Bank)</button>}
              </div>
          </div>
      )}

      {/* 5. TRANSACTION TABLE */}
      <div className="bg-white rounded-[32px] border border-slate-200 shadow-sm overflow-hidden">
          <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 text-slate-500 font-black uppercase text-[10px] tracking-widest border-b border-slate-200 sticky top-0 z-10">
                  <tr>
                      <th className="px-4 py-4 w-10 text-center"><input type="checkbox" onChange={(e) => { if(e.target.checked) setSelectedTransIds(new Set(filteredTransactions.map(t=>t.id))); else setSelectedTransIds(new Set()); }} checked={selectedTransIds.size === filteredTransactions.length && filteredTransactions.length > 0}/></th>
                      <th className="px-6 py-4">Ngày / Số CT</th>
                      <th className="px-6 py-4">Nội dung</th>
                      <th className="px-6 py-4">Dự án</th>
                      <th className="px-6 py-4 text-right">Số tiền</th>
                      <th className="px-6 py-4 text-center">Trạng thái</th>
                      <th className="px-4 py-4 text-right"></th>
                  </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                  {filteredTransactions.map(t => (
                      <tr key={t.id} className={`group hover:bg-slate-50/80 transition-colors ${selectedTransIds.has(t.id) ? 'bg-indigo-50/30' : ''}`}>
                          <td className="px-4 py-4 text-center"><input type="checkbox" checked={selectedTransIds.has(t.id)} onChange={() => toggleSelection(t.id)}/></td>
                          <td className="px-6 py-4 align-top">
                              <div className="font-mono text-xs font-bold text-slate-500">{new Date(t.date).toLocaleDateString('vi-VN')}</div>
                              <div className="text-[10px] font-black bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded w-fit mt-1">{t.code}</div>
                          </td>
                          <td className="px-6 py-4 align-top max-w-xs">
                              <div className="font-bold text-slate-800 line-clamp-2 cursor-pointer hover:text-indigo-600" onClick={() => { setFormConfig({ isOpen: true, type: t.type, initialData: t }); }}>{t.description}</div>
                              {t.payerName && <div className="text-xs text-slate-400 mt-1 flex items-center gap-1"><User size={10}/> {t.payerName}</div>}
                              {t.attachments && t.attachments.length > 0 && (
                                  <div className="mt-2 flex gap-2">
                                      {t.attachments.map((att, i) => (
                                          <button key={i} onClick={() => setViewingAttachment(att)} className="flex items-center text-[10px] bg-blue-50 text-blue-600 px-2 py-1 rounded hover:bg-blue-100">
                                              <Paperclip size={10} className="mr-1"/> File {i+1}
                                          </button>
                                      ))}
                                  </div>
                              )}
                          </td>
                          <td className="px-6 py-4 align-top"><div className="font-bold text-xs text-slate-700">{projects.find(p=>p.id===t.projectId)?.name || '---'}</div></td>
                          <td className={`px-6 py-4 text-right font-black align-top ${t.type === TransactionType.INCOME ? 'text-emerald-600' : 'text-rose-600'}`}>{t.type === TransactionType.INCOME ? '+' : '-'}{t.amount.toLocaleString()} ₫</td>
                          <td className="px-6 py-4 text-center align-top">
                              <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase border ${t.status === TransactionStatus.PAID ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : t.status === TransactionStatus.APPROVED ? 'bg-indigo-50 text-indigo-700 border-indigo-100' : t.status === TransactionStatus.REJECTED ? 'bg-rose-50 text-rose-700 border-rose-100' : 'bg-amber-50 text-amber-700 border-amber-100'}`}>
                                  {t.status}
                              </span>
                          </td>
                          <td className="px-4 py-4 text-right align-top">
                              <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                  {/* Print Voucher Button */}
                                  <button onClick={() => setPrintingTransaction(t)} className="p-1.5 bg-slate-50 text-slate-600 rounded hover:bg-slate-100 hover:text-indigo-600 transition-colors" title="In phiếu">
                                      <Printer size={16}/>
                                  </button>
                                  
                                 {t.status === TransactionStatus.SUBMITTED && canCreateTransactionApprove && (
                                <>
                                    <button 
                                        onClick={() => handleApprove(t)} 
                                        className="p-1.5 bg-green-50 text-green-600 rounded hover:bg-green-100 transition-colors" 
                                        title="Duyệt"
                                    >
                                        <CheckCircle size={16}/>
                                    </button>
                                    <button 
                                        onClick={() => setRejectModalOpen(t)} 
                                        className="p-1.5 bg-red-50 text-red-600 rounded hover:bg-red-100 transition-colors" 
                                        title="Từ chối"
                                    >
                                        <X size={16}/>
                                    </button>
                                </>
                            )}
                            
                            {/* Nếu là người tạo phiếu nhưng không có quyền duyệt, có thể cho phép xoá/sửa khi đang chờ duyệt (Tuỳ chọn) */}
                            {t.status === TransactionStatus.SUBMITTED && !canCreateTransactionApprove && t.requesterId === currentUser.id && (
                                <span className="text-[10px] text-orange-400 font-bold p-1.5 cursor-default">Đang chờ duyệt...</span>
                            )}
                                  
                                  {/* CONFIRM PAYMENT (EXPENSE) */}
                                  {t.status === TransactionStatus.APPROVED && t.type === TransactionType.EXPENSE && (
                                      <button onClick={() => initiatePayment(t)} className="p-1.5 bg-indigo-50 text-indigo-600 rounded hover:bg-indigo-100 font-bold text-[10px] uppercase w-fit px-2">Chi ngay</button>
                                  )}

                                  {/* CONFIRM INCOME (NEW FEATURE) */}
                                  {t.type === TransactionType.INCOME && t.status !== TransactionStatus.PAID && canCreateTransactionPay &&(
                                      <button onClick={() => initiateCollection(t)} className="p-1.5 bg-emerald-50 text-emerald-600 rounded hover:bg-emerald-100 font-bold text-[10px] uppercase w-fit px-2 flex items-center">
                                          <CheckCircle size={14} className="mr-1"/> Xác nhận Thu
                                      </button>
                                  )}
                                {(canCreateTransactionPay || canCreateTransactionApprove ) && (
                                  <button onClick={() => onDeleteTransaction(t.id)} className="p-1.5 hover:bg-slate-100 rounded text-slate-400 hover:text-rose-500"><Trash2 size={16}/></button>
                                )}
                              </div>
                          </td>
                      </tr>
                  ))}
              </tbody>
          </table>
      </div>

      {/* AI WIDGET */}
      <AIAssistantWidget role="ACCOUNTANT" transactions={transactions} />

      {/* MODALS */}
      {formConfig.isOpen && (
          <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
              <TransactionForm 
                  projects={projects}
                  partners={partners}
                  accounts={liveAccounts}
                  currentUser={currentUser}
                  initialType={formConfig.type} 
                  initialData={formConfig.initialData}
                  onAddTransaction={(t) => {
                      if (formConfig.initialData) onUpdateTransaction(t);
                      else onAddTransaction(t);
                      setFormConfig({ isOpen: false, type: TransactionType.EXPENSE });
                  }}
                  onCancel={() => setFormConfig({ isOpen: false, type: TransactionType.EXPENSE })}
                  onAddProject={onAddProject}
                  onAddPartner={onAddPartner} // Passed Down
              />
          </div>
      )}

      {printingTransaction && (
          <VoucherModal 
            transaction={printingTransaction} 
            onClose={() => setPrintingTransaction(null)} 
          />
      )}

      {showGoogleFormImport && (
          <GoogleFormImportModal 
            partners={partners}
            onImport={handleGoogleImport}
            onClose={() => setShowGoogleFormImport(false)}
          />
      )}

      {rejectModalOpen && (
          <div className="fixed inset-0 z-[160] flex items-center justify-center bg-black/50 p-4">
              <div className="bg-white p-6 rounded-2xl w-full max-w-sm shadow-xl">
                  <h3 className="font-bold text-lg text-rose-600 mb-4">Từ chối duyệt phiếu</h3>
                  <textarea className="w-full border p-3 rounded-lg text-sm mb-4 outline-none focus:border-rose-500" rows={3} placeholder="Lý do..." value={rejectReason} onChange={e => setRejectReason(e.target.value)} autoFocus />
                  <div className="flex gap-3">
                      <button onClick={() => setRejectModalOpen(null)} className="flex-1 py-2 text-slate-500 font-bold hover:bg-slate-100 rounded-lg">Hủy</button>
                      <button onClick={handleReject} disabled={!rejectReason} className="flex-1 py-2 bg-rose-600 text-white font-bold rounded-lg hover:bg-rose-700">Xác nhận</button>
                  </div>
              </div>
          </div>
      )}

      {accountSelectionModal && (
          <div className="fixed inset-0 z-[160] flex items-center justify-center bg-black/50 p-4">
              <div className="bg-white p-6 rounded-2xl w-full max-w-md shadow-xl">
                  <h3 className="font-bold text-lg text-slate-900 mb-4">Xác nhận thanh toán (Chi)</h3>
                  <div className="mb-4">
                      <label className="text-xs font-bold text-slate-500 uppercase">Tài khoản chi *</label>
                      <select className="w-full border-2 border-indigo-50 p-3 rounded-xl mt-1 font-bold text-slate-800 outline-none focus:border-indigo-500" value={selectedAccountId} onChange={e => setSelectedAccountId(e.target.value)}>
                          <option value="">-- Chọn quỹ (Synced) --</option>
                          {liveAccounts.map(acc => <option key={acc.id} value={acc.id}>{acc.bankName} - {acc.accountName}</option>)}
                      </select>
                  </div>
                  <div className="flex gap-3">
                      <button onClick={() => setAccountSelectionModal(null)} className="flex-1 py-2 text-slate-500 font-bold hover:bg-slate-100 rounded-lg">Hủy</button>
                      <button onClick={handleExpensePaymentSubmit} className="flex-1 py-2 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700">Xác nhận Chi</button>
                  </div>
              </div>
          </div>
      )}

      {/* CONFIRM INCOME MODAL (NEW) */}
      {confirmIncomeModal && (
          <div className="fixed inset-0 z-[160] flex items-center justify-center bg-black/50 p-4 animate-in zoom-in duration-200">
              <div className="bg-white p-6 rounded-2xl w-full max-w-md shadow-xl">
                  <h3 className="font-bold text-lg text-emerald-700 mb-4 flex items-center"><CheckCircle size={20} className="mr-2"/> Xác nhận Đã Thu Tiền</h3>
                  <p className="text-sm text-slate-500 mb-4">Hành động này sẽ ghi nhận tiền vào Quỹ và cập nhật số dư.</p>
                  
                  <div className="mb-4">
                      <label className="text-xs font-bold text-slate-500 uppercase">Tiền về Tài khoản / Quỹ nào? *</label>
                      <select className="w-full border-2 border-emerald-50 p-3 rounded-xl mt-1 font-bold text-slate-800 outline-none focus:border-emerald-500" value={selectedAccountId || confirmIncomeModal.targetAccountId || ''} onChange={e => setSelectedAccountId(e.target.value)}>
                          <option value="">-- Chọn quỹ nhận tiền --</option>
                          {liveAccounts.map(acc => <option key={acc.id} value={acc.id}>{acc.bankName} - {acc.accountName}</option>)}
                      </select>
                  </div>
                  
                  <div className="flex gap-3">
                      <button onClick={() => setConfirmIncomeModal(null)} className="flex-1 py-2 text-slate-500 font-bold hover:bg-slate-100 rounded-lg">Hủy</button>
                      <button onClick={handleIncomeConfirmSubmit} className="flex-1 py-2 bg-emerald-600 text-white font-bold rounded-lg hover:bg-emerald-700 shadow-lg">Xác nhận Đã Thu</button>
                  </div>
              </div>
          </div>
      )}

      {/* Batch Payment Modal */}
      {showBatchModal && (
          <div className="fixed inset-0 z-[160] flex items-center justify-center bg-black/50 p-4">
              <div className="bg-white p-6 rounded-2xl w-full max-w-md shadow-xl animate-in zoom-in duration-200">
                  <div className="flex justify-between items-center mb-4">
                      <h3 className="font-bold text-lg text-slate-900">Xuất Lệnh Chi Lô (Bank)</h3>
                      <button onClick={() => setShowBatchModal(false)}><X size={20} className="text-slate-400"/></button>
                  </div>
                  <div className="mb-6">
                      <label className="text-xs font-bold text-slate-500 uppercase mb-2 block">Tài khoản trích nợ (Source) *</label>
                      <select className="w-full border-2 border-indigo-100 bg-indigo-50/50 p-3 rounded-xl font-bold text-indigo-900 outline-none" value={batchSourceAccountId} onChange={e => setBatchSourceAccountId(e.target.value)}>
                          <option value="">-- Chọn quỹ trích nợ (Synced) --</option>
                          {liveAccounts.filter(a => a.type === 'BANK').map(acc => <option key={acc.id} value={acc.id}>{acc.bankName} - {acc.accountName}</option>)}
                      </select>
                      <p className="text-[10px] text-slate-400 mt-2 italic">Hệ thống sẽ dùng thông tin tài khoản này để điền vào cột "Đơn vị trả".</p>
                  </div>
                  <div className="flex gap-3">
                      <button onClick={() => setShowBatchModal(false)} className="flex-1 py-3 text-slate-500 font-bold hover:bg-slate-100 rounded-xl">Hủy</button>
                      <button onClick={handleBatchExport} className="flex-1 py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 shadow-lg">Xuất File</button>
                  </div>
              </div>
          </div>
      )}

      {viewingAttachment && <AttachmentViewer attachment={viewingAttachment} onClose={() => setViewingAttachment(null)} />}
    </div>
  );
};

export default TransactionList;
