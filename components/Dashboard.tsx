
import React, { useMemo } from 'react';
import { 
  ArrowUpCircle, ArrowDownCircle, DollarSign, Briefcase, 
  Building2, Wallet, Users, FileText, ShoppingBag, PieChart, 
  PlayCircle, Contact, Target, Bot, CreditCard, ChevronRight, Activity, CheckCircle, Landmark
} from 'lucide-react';
import { Transaction, Project, CashAccount, TransactionType, TransactionStatus, AccountType } from '../types';
import { ReportService } from '../services/reportService'; 
import AIAssistantWidget from './AIAssistantWidget';

interface DashboardProps {
  currentUser: any;
  transactions: Transaction[];
  projects: Project[];
  accounts: CashAccount[];
  onNavigate?: (tab: string) => void;
}

const Dashboard: React.FC<DashboardProps> = ({ currentUser, transactions, projects, accounts, onNavigate }) => {
  // Use Service for Logic
  const stats = useMemo(() => ReportService.calculateDashboardStats(transactions, projects), [transactions, projects]);
  const recentActivity = useMemo(() => ReportService.getRecentActivity(transactions, 6), [transactions]);

  // Calculate Account Balances (Standard ERP Logic: PAID transactions only + Initial Balance)
  const accountBalances = useMemo(() => {
      // NOTE: accounts prop comes from App.tsx which fetches from API/Storage. 
      // We rely on parent to pass fresh data. 
      return accounts.map(acc => {
          const transBalance = transactions
              .filter(t => t.targetAccountId === acc.id && t.status === TransactionStatus.PAID)
              .reduce((sum, t) => sum + (t.type === TransactionType.INCOME ? t.amount : -t.amount), 0);
          
          // ADD INITIAL BALANCE
          const totalBalance = (acc.initialBalance || 0) + transBalance;
          
          return { ...acc, balance: totalBalance };
      });
  }, [accounts, transactions]);

  const StatCard = ({ title, value, icon: Icon, colorClass, subText }: any) => (
    <div className="bg-white rounded-[24px] border border-slate-100 p-6 flex items-start justify-between shadow-sm hover:shadow-lg transition-all duration-300 group">
      <div>
        <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-2">{title}</p>
        <h3 className="text-2xl font-black text-slate-900 group-hover:scale-105 transition-transform origin-left">{value}</h3>
        {subText && <p className="text-[10px] text-slate-400 mt-1 font-bold">{subText}</p>}
      </div>
      <div className={`p-4 rounded-2xl ${colorClass} group-hover:scale-110 transition-transform shadow-sm`}>
        <Icon size={24} />
      </div>
    </div>
  );

  const ShortcutItem = ({ label, icon: Icon, color, onClick, description }: any) => (
      <button 
        onClick={onClick} 
        className="flex flex-col items-center justify-center p-5 bg-white rounded-[24px] border border-slate-100 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 group relative overflow-hidden"
      >
          <div className={`p-4 rounded-2xl mb-3 transition-colors ${color.bg} ${color.text} group-hover:scale-110 duration-300`}>
              <Icon size={28} />
          </div>
          <span className="text-xs font-black text-slate-700 uppercase tracking-wide group-hover:text-indigo-600 transition-colors">{label}</span>
          <span className="text-[10px] text-slate-400 mt-1 text-center font-medium line-clamp-1">{description}</span>
          <div className={`absolute bottom-0 left-0 w-full h-1 ${color.bar} opacity-0 group-hover:opacity-100 transition-opacity`}></div>
      </button>
  );

  const checkAccess = (moduleName: string): boolean => {
      if (currentUser?.permissions?.includes('SYS_ADMIN') ) return true;
      const perms = currentUser?.permissions || [];

      switch (moduleName) {
          case 'PROJECTS': // Công Trình
              return perms.some(p => ['PROJECT_VIEW_ALL', 'PROJECT_VIEW_OWN'].includes(p));
          case 'FINANCE': // Sổ Thu Chi
              return perms.some(p => ['TRANS_CREATE', 'TRANS_VIEW_ALL', 'TRANS_APPROVE', 'TRANS_PAY'].includes(p));
          case 'CONTRACTS': // Hợp Đồng 
              return true
          case 'CUSTOMERS': // Khách Hàng
              return true
          case 'SUPPLIERS': // Thị Trường
              return true
          case 'OFFICE': // Office & Store
              return perms.some(p => ['OFFICE_VIEW', 'OFFICE_MANAGE'].includes(p));
          case 'HR': // Nhân sự & Lương
              return perms.some(p => ['HR_VIEW_ALL'].includes(p));
          case 'TAX': // Thuế & KPI
              return true
          case 'AI': // AI
              return true
          default:
              return false;
      }
  };

  const perms = currentUser?.permissions || [];
  const canViewMoney = perms.some(p => ['SYS_ADMIN', 'TRANS_VIEW_ALL'].includes(p));
  const formatMoney = (amount: number) => canViewMoney ? amount.toLocaleString() + ' ₫' : '******* ₫';


  const handleClickNhanSu = () => 
  {
    const perms = currentUser?.permissions || [];
    if (perms.includes('SYS_ADMIN')) return true;
    const  check = perms.some(p => ['HR_VIEW_ALL'].includes(p));
        if(check){
            onNavigate?.('hr-group')
        }
  }

  return (
    <div className="space-y-10 animate-in fade-in pb-20 relative">
      {/* 1. HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Tổng Quan Tài Chính</h1>
          <p className="text-sm text-slate-500 font-medium mt-1">Báo cáo hiệu quả kinh doanh & Tình hình sức khỏe doanh nghiệp.</p>
        </div>
        <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-xl border border-slate-200 shadow-sm">
            <Activity size={16} className="text-emerald-500 animate-pulse"/>
            <span className="text-xs font-bold text-slate-600">Hệ thống đang hoạt động ổn định</span>
        </div>
      </div>

      {/* 2. KEY METRICS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard 
            title="Thực thu (Cash-in)" 
            value={canViewMoney ? `${(stats.totalRevenue / 1000000).toLocaleString()} Tr` : '*******'} 
            icon={ArrowDownCircle} 
            colorClass="bg-emerald-50 text-emerald-600" 
            subText="Dòng tiền thực tế"
        />
        <StatCard 
            title="Thực chi (Cash-out)" 
            value={canViewMoney ? `${(stats.totalExpense / 1000000).toLocaleString()} Tr` : '*******'} 
            icon={ArrowUpCircle} 
            colorClass="bg-rose-50 text-rose-600" 
            subText="Chi phí hoạt động"
        />
        <StatCard 
            title="Lợi nhuận ròng" 
            value={canViewMoney ? `${(stats.netProfit / 1000000).toLocaleString()} Tr` : '*******'} 
            icon={DollarSign} 
            colorClass="bg-indigo-50 text-indigo-600" 
            subText="Thu trừ Chi"
        />
        <StatCard 
            title="Dự án Active" 
            value={stats.activeProjectsCount} 
            icon={Briefcase} 
            colorClass="bg-orange-50 text-orange-600" 
            subText="Đang triển khai"
        />
      </div>

      {/* 3. NEW SECTION: FUND BALANCES (Quỹ tiền) */}
      <div className="space-y-4">
          <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest flex items-center">
              <span className="w-2 h-2 rounded-full bg-emerald-500 mr-2"></span>
              Số Dư Các Quỹ Tiền (Real-time)
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {accountBalances.map(acc => (
                  <div key={acc.id} className="bg-white p-5 rounded-[20px] border border-slate-100 shadow-sm flex items-center justify-between group hover:border-indigo-100 transition-colors">
                      <div>
                          <div className="flex items-center gap-2 mb-1">
                              <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded ${acc.type === AccountType.CASH ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'}`}>
                                  {acc.type === AccountType.CASH ? 'Tiền mặt' : 'Ngân hàng'}
                              </span>
                              <p className="text-xs font-bold text-slate-400 uppercase truncate max-w-[120px]" title={acc.bankName}>{acc.bankName}</p>
                          </div>
                          <p className="text-sm font-bold text-slate-700 mb-1 truncate max-w-[150px]" title={acc.accountName}>{acc.accountName}</p>
                          <p className={`text-xl font-black ${acc.balance < 0 ? 'text-rose-600' : 'text-slate-900'}`}>
                            {formatMoney(acc.balance)} {/* Dùng hàm này thay cho toLocaleString() */}
                          </p>
                      </div>
                      <div className={`p-3 rounded-2xl ${acc.type === AccountType.CASH ? 'bg-emerald-50 text-emerald-600' : 'bg-blue-50 text-blue-600'}`}>
                          {acc.type === AccountType.CASH ? <Wallet size={20}/> : <Landmark size={20}/>}
                      </div>
                  </div>
              ))}
              {accountBalances.length === 0 && (
                  <div className="col-span-full p-6 text-center bg-white rounded-[20px] border border-dashed border-slate-200 text-slate-400 italic text-sm">
                      Chưa có quỹ tiền nào được cấu hình. Vui lòng vào Cấu hình Quỹ tiền để tạo.
                  </div>
              )}
          </div>
      </div>

      {/* 4. MODULE NAVIGATION */}
     <div>
          <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest mb-6 flex items-center">
              <span className="w-2 h-2 rounded-full bg-indigo-600 mr-2"></span>
              Truy cập nhanh phân hệ
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-6">
              
              {checkAccess('FINANCE') && (
                 <ShortcutItem label="Sổ Thu Chi" description="Quản lý dòng tiền" icon={Wallet} color={{bg:'bg-blue-50', text:'text-blue-600', bar:'bg-blue-500'}} onClick={() => onNavigate?.('transactions')} />
              )}
              
              {checkAccess('PROJECTS') && (
                 <ShortcutItem label="Công Trình" description="Dự án & Tiến độ" icon={Building2} color={{bg:'bg-orange-50', text:'text-orange-600', bar:'bg-orange-500'}} onClick={() => onNavigate?.('projects')} />
              )}
              
              {checkAccess('CONTRACTS') && (
                 <ShortcutItem label="Hợp Đồng" description="Pháp lý & Thanh toán" icon={FileText} color={{bg:'bg-teal-50', text:'text-teal-600', bar:'bg-teal-500'}} onClick={() => onNavigate?.('contracts')} />
              )}
              
              {checkAccess('CUSTOMERS') && (
                 <ShortcutItem label="Khách Hàng" description="Chủ đầu tư & Công nợ" icon={Contact} color={{bg:'bg-cyan-50', text:'text-cyan-600', bar:'bg-cyan-500'}} onClick={() => onNavigate?.('customers')} />
              )}
              
              {checkAccess('SUPPLIERS') && (
                 <ShortcutItem label="Thị Trường" description="NCC & Giá vật tư" icon={ShoppingBag} color={{bg:'bg-yellow-50', text:'text-yellow-600', bar:'bg-yellow-500'}} onClick={() => onNavigate?.('suppliers')} />
              )}

              {checkAccess('OFFICE') && (
                  <ShortcutItem label="Office & Store" description="Văn phòng & Kho" icon={Briefcase} color={{bg:'bg-purple-50', text:'text-purple-600', bar:'bg-purple-500'}} onClick={() => onNavigate?.('office')} />
              )}

              {checkAccess('HR') && (
                  <ShortcutItem label="Nhân Sự & Lương" description="Chấm công, KPI, Lương" icon={Users} color={{bg:'bg-pink-50', text:'text-pink-600', bar:'bg-pink-500'}} onClick={handleClickNhanSu} />
              )}

              {/* Thuế & KPI, AI Analyst: Chỉ dành cho Admin */}
              {checkAccess('TAX') && (
                      <ShortcutItem label="Thuế & KPI" description="Báo cáo thuế, VAT" icon={PieChart} color={{bg:'bg-red-50', text:'text-red-600', bar:'bg-red-500'}} onClick={() => onNavigate?.('tax-kpi')} />
              )}
              {checkAccess('AI') && (
                  <ShortcutItem label="AI Analyst" description="Trợ lý ảo phân tích" icon={Bot} color={{bg:'bg-indigo-50', text:'text-indigo-600', bar:'bg-indigo-500'}} onClick={() => onNavigate?.('analysis')} />
              )}
          </div>
      </div>


      {/* 5. ACTIVITY & ALERTS */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 bg-white rounded-[32px] border border-slate-200 overflow-hidden shadow-sm flex flex-col">
              <div className="px-8 py-6 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
                  <h3 className="font-black text-slate-800 text-sm uppercase tracking-wider flex items-center">
                      <span className={`w-2 h-2 rounded-full mr-2 ${stats.pendingCount > 0 ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500'}`}></span>
                      {stats.pendingCount > 0 ? `Cần Duyệt Gấp (${stats.pendingCount})` : 'Hoạt động gần đây'}
                  </h3>
                  <button onClick={() => onNavigate?.('transactions')} className="text-[10px] font-black text-indigo-600 hover:underline uppercase tracking-widest flex items-center">Xem tất cả <ChevronRight size={14}/></button>
              </div>
              <div className="divide-y divide-slate-50 flex-1 overflow-y-auto max-h-[400px] custom-scrollbar">
                  {recentActivity.length === 0 ? (
                      <div className="p-12 text-center text-slate-400 text-sm italic font-medium"><CheckCircle size={48} className="mx-auto mb-4 text-emerald-200"/> Chưa có dữ liệu.</div>
                  ) : (
                      recentActivity.map(t => (
                          <div key={t.id} className="p-5 hover:bg-slate-50 flex items-center justify-between group cursor-pointer transition-colors" onClick={() => onNavigate?.('transactions')}>
                              <div className="flex items-center gap-4">
                                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-sm ${t.type === 'INCOME' ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'}`}>
                                      {t.type === 'INCOME' ? <ArrowDownCircle size={24}/> : <ArrowUpCircle size={24}/>}
                                  </div>
                                  <div>
                                      <p className="text-sm font-bold text-slate-900 line-clamp-1">{t.description}</p>
                                      <p className="text-xs text-slate-500 mt-0.5 font-medium">{new Date(t.date).toLocaleDateString('vi-VN')} • <span className="text-indigo-500 font-bold">{t.category}</span></p>
                                  </div>
                              </div>
                              <div className="text-right">
                                  <span className={`block text-sm font-black ${t.type === 'INCOME' ? 'text-emerald-600' : 'text-rose-600'}`}>{t.amount.toLocaleString()} ₫</span>
                                  <span className="px-3 py-1 bg-slate-100 text-slate-600 rounded-lg text-[10px] font-black uppercase inline-block mt-1">{t.status}</span>
                              </div>
                          </div>
                      ))
                  )}
              </div>
          </div>

          <div className="bg-gradient-to-br from-indigo-900 to-slate-900 rounded-[32px] p-8 text-white shadow-xl flex flex-col justify-between relative overflow-hidden h-full min-h-[300px]">
              <div className="relative z-10">
                  <div className="w-14 h-14 bg-white/10 rounded-2xl flex items-center justify-center mb-6 backdrop-blur-md shadow-inner"><PlayCircle size={32} className="text-white"/></div>
                  <h4 className="font-black text-2xl mb-3 tracking-tight">FinancePro v2.0</h4>
                  <p className="text-sm text-indigo-200 mb-8 leading-relaxed font-medium">Phiên bản mới tích hợp AI Advisor và Hệ thống duyệt chi đa cấp.</p>
                  <button className="w-full py-4 bg-white text-indigo-900 rounded-2xl font-black text-xs uppercase hover:bg-indigo-50 transition-all shadow-lg active:scale-95 tracking-widest">Xem Hướng Dẫn</button>
              </div>
              <div className="absolute -bottom-20 -right-20 w-64 h-64 bg-indigo-600 rounded-full blur-[80px] opacity-40"></div>
          </div>
      </div>

      {/* AI WIDGET FOR DIRECTOR */}
      <AIAssistantWidget role="DIRECTOR" transactions={transactions} />
    </div>
  );
};

export default Dashboard;
