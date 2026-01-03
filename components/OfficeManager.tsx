
import React, { useState, useEffect, useMemo } from 'react';
import { Office, Transaction, TransactionType, TransactionStatus, OfficeType, UserContext, Employee, CashAccount } from '../types';
import { fetchOffices, createOffice, updateOffice } from '../services/officeService';
import { getEmployees } from '../services/employeeService';
import { 
    Building2, Store, Plus, MapPin, User, ArrowUpRight, ArrowDownLeft, 
    Wallet, TrendingUp, Search, Settings, Filter, LayoutGrid, List as ListIcon,
    Briefcase, X, Save, Loader2, Info, CreditCard, Brain, Eye
} from 'lucide-react';
import OfficeDetail360 from './OfficeDetail360'; 

interface OfficeManagerProps {
    transactions: Transaction[];
    currentUser: UserContext;
    accounts: CashAccount[]; 
}

const OfficeManager: React.FC<OfficeManagerProps> = ({ transactions, currentUser, accounts = [] }) => {
    const [offices, setOffices] = useState<Office[]>([]);
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [viewMode, setViewMode] = useState<'GRID' | 'LIST'>('GRID');
    const [filterType, setFilterType] = useState<'ALL' | 'OFFICE' | 'STORE'>('ALL');
    const [searchTerm, setSearchTerm] = useState('');
    
    // Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isSaving, setIsSaving] = useState(false); 
    const [editingOffice, setEditingOffice] = useState<Partial<Office>>({ type: OfficeType.OFFICE, status: 'ACTIVE' });
    
    // 360 View State
    const [viewingOffice, setViewingOffice] = useState<Office | null>(null);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            const [offs, emps] = await Promise.all([fetchOffices(), getEmployees()]);
            setOffices(offs);
            setEmployees(emps);
        } catch (e) {
            console.error("Failed to load office data", e);
        }
    };

    const handleSave = async () => {
        // Validation
        if (!editingOffice.code || !editingOffice.name) {
            alert("Vui lòng nhập đầy đủ Mã đơn vị và Tên hiển thị.");
            return;
        }
        
        setIsSaving(true);
        try {
            const office: Office = {
                id: editingOffice.id || `off_${Date.now()}`,
                code: editingOffice.code.toUpperCase(), // Ensure uppercase code
                name: editingOffice.name,
                type: editingOffice.type || OfficeType.OFFICE,
                address: editingOffice.address || '',
                managerId: editingOffice.managerId || '',
                defaultCashAccountId: editingOffice.defaultCashAccountId || '', // Save default fund
                description: editingOffice.description || '',
                status: editingOffice.status || 'ACTIVE',
                createdAt: editingOffice.createdAt || new Date().toISOString(),
                isCostCenter: true
            };

            if (editingOffice.id) {
                await updateOffice(office);
            } else {
                await createOffice(office);
            }
            
            await loadData(); // Reload list immediately
            setIsModalOpen(false);
        } catch (e: any) {
            alert(e.message || "Có lỗi xảy ra khi lưu. Vui lòng thử lại.");
        } finally {
            setIsSaving(false);
        }
    };

    // --- ANALYTICS ---
    const getOfficeStats = (office: Office) => {
        // 1. Transaction Stats
        const relevantTrans = transactions.filter(t => 
            t.costCenterId === office.id || 
            (t.scope !== 'PROJECT' && t.projectId === office.id) // Legacy fallback check
        );
        
        const income = relevantTrans
            .filter(t => t.type === TransactionType.INCOME && t.status === TransactionStatus.PAID)
            .reduce((s, t) => s + t.amount, 0);
            
        const expense = relevantTrans
            .filter(t => t.type === TransactionType.EXPENSE && t.status === TransactionStatus.PAID)
            .reduce((s, t) => s + t.amount, 0);

        // 2. Fund Balance Logic (Based on Default Account)
        let fundBalance = 0;
        let fundName = 'Chưa gán quỹ';
        if (office.defaultCashAccountId) {
            const acc = accounts.find(a => a.id === office.defaultCashAccountId);
            if (acc) {
                fundName = acc.accountName;
                // Calculate real balance from ALL transactions touching this account
                const accTrans = transactions.filter(t => t.targetAccountId === acc.id && t.status === TransactionStatus.PAID);
                fundBalance = accTrans.reduce((sum, t) => sum + (t.type === TransactionType.INCOME ? t.amount : -t.amount), 0);
            }
        }

        return { income, expense, count: relevantTrans.length, fundBalance, fundName };
    };

    const filteredOffices = useMemo(() => {
        return offices.filter(o => {
            const matchType = filterType === 'ALL' || o.type === filterType;
            const matchSearch = o.name.toLowerCase().includes(searchTerm.toLowerCase()) || o.code.toLowerCase().includes(searchTerm.toLowerCase());
            return matchType && matchSearch;
        });
    }, [offices, filterType, searchTerm]);

    const renderOfficeCard = (office: Office) => {
        const stats = getOfficeStats(office);
        const manager = employees.find(e => e.id === office.managerId);
        const profit = stats.income - stats.expense;

        return (
            <div key={office.id} className="bg-white rounded-[24px] border border-slate-200 shadow-sm hover:shadow-lg transition-all overflow-hidden flex flex-col group cursor-pointer" onClick={() => setViewingOffice(office)}>
                <div className="p-6 border-b border-slate-50 flex justify-between items-start">
                    <div className="flex gap-4">
                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-white shadow-md ${office.type === OfficeType.STORE ? 'bg-orange-500' : 'bg-indigo-600'}`}>
                            {office.type === OfficeType.STORE ? <Store size={24}/> : <Building2 size={24}/>}
                        </div>
                        <div>
                            <h3 className="font-black text-slate-900 text-lg group-hover:text-indigo-600 transition-colors">{office.name}</h3>
                            <div className="flex items-center gap-2 mt-1">
                                <span className="text-[10px] font-black bg-slate-100 px-2 py-0.5 rounded text-slate-500 uppercase">{office.code}</span>
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${office.status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}>
                                    {office.status === 'ACTIVE' ? 'Hoạt động' : 'Đóng cửa'}
                                </span>
                            </div>
                        </div>
                    </div>
                    <button onClick={(e) => { e.stopPropagation(); setEditingOffice(office); setIsModalOpen(true); }} className="p-2 text-slate-300 hover:text-indigo-600 bg-white hover:bg-indigo-50 rounded-xl transition-all">
                        <Settings size={18}/>
                    </button>
                </div>
                
                <div className="p-6 flex-1 space-y-4">
                    {/* Fund Balance Widget */}
                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Wallet size={16} className="text-slate-400"/>
                            <div>
                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Số dư quỹ</p>
                                <p className="text-[10px] font-medium text-slate-500 truncate max-w-[100px]">{stats.fundName}</p>
                            </div>
                        </div>
                        <span className={`text-sm font-black ${stats.fundBalance >= 0 ? 'text-indigo-600' : 'text-rose-600'}`}>{stats.fundBalance.toLocaleString()} ₫</span>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="bg-emerald-50 p-3 rounded-xl border border-emerald-100">
                            <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-1 flex items-center"><ArrowDownLeft size={12} className="mr-1"/> Doanh thu</p>
                            <p className="text-sm font-black text-emerald-700">{stats.income.toLocaleString()} ₫</p>
                        </div>
                        <div className="bg-rose-50 p-3 rounded-xl border border-rose-100">
                            <p className="text-[10px] font-black text-rose-600 uppercase tracking-widest mb-1 flex items-center"><ArrowUpRight size={12} className="mr-1"/> Chi phí</p>
                            <p className="text-sm font-black text-rose-700">{stats.expense.toLocaleString()} ₫</p>
                        </div>
                    </div>
                    
                    <div className="flex items-center justify-between pt-2">
                        <div className="text-xs text-slate-500">
                            <p className="flex items-center gap-1 font-medium"><MapPin size={12}/> {office.address || 'Chưa cập nhật'}</p>
                            <p className="flex items-center gap-1 mt-1 font-medium"><User size={12}/> {manager?.fullName || 'Chưa có quản lý'}</p>
                        </div>
                        <div className="text-right">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Lợi nhuận ròng</p>
                            <p className={`text-lg font-black ${profit >= 0 ? 'text-indigo-600' : 'text-orange-600'}`}>{profit.toLocaleString()} ₫</p>
                        </div>
                    </div>
                </div>
                
                <div className="bg-slate-50 px-6 py-3 border-t border-slate-100 flex justify-between items-center group-hover:bg-indigo-50 transition-colors">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">{stats.count} giao dịch</span>
                    <button className="text-[10px] font-black text-indigo-600 uppercase tracking-widest flex items-center">
                        Xem chi tiết <Eye size={12} className="ml-1"/>
                    </button>
                </div>
            </div>
        );
    };


     const canCreateTransactionCreater = useMemo(() => {
            const perms = currentUser?.permissions || [];
            if (perms.includes('SYS_ADMIN')) return true;
            return perms.some(p => ['OFFICE_MANAGE'].includes(p));
        }, [currentUser]);

    return (
        <div className="space-y-8 animate-in fade-in pb-20">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-[24px] border border-slate-100 shadow-sm">
                <div className="flex items-center gap-4">
                    <div className="bg-gradient-to-br from-indigo-500 to-purple-600 w-12 h-12 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-indigo-100">
                        <Building2 size={24}/>
                    </div>
                    <div>
                        <h1 className="text-xl font-black text-slate-900 tracking-tight uppercase">Office & Store 360°</h1>
                        <p className="text-sm text-slate-500 font-medium">Quản lý Văn phòng, Cửa hàng & Kho bãi</p>
                    </div>
                </div>
                <button 
                    disabled={!canCreateTransactionCreater}
                    onClick={() => { setEditingOffice({type: OfficeType.OFFICE, status: 'ACTIVE'}); setIsModalOpen(true); }}
                    className={`bg-indigo-600 text-white px-8 py-3 rounded-2xl font-black uppercase text-[11px] tracking-widest shadow-xl shadow-indigo-100 hover:bg-indigo-700 active:scale-95 transition-all flex items-center ${canCreateTransactionCreater 
                        ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-200 hover:bg-emerald-700 active:scale-95' 
                        : 'bg-slate-100 text-slate-400 cursor-not-allowed opacity-70 shadow-none'
                    }`}
                >
                    <Plus size={16} className="mr-2"/> Thêm Đơn vị mới
                </button>
            </div>

            {/* Filter Bar */}
            <div className="flex flex-col md:flex-row gap-4 items-center bg-white p-2 rounded-[20px] border border-slate-200 shadow-sm">
                <div className="flex bg-slate-100 p-1 rounded-xl">
                    <button onClick={() => setFilterType('ALL')} className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase transition-all ${filterType === 'ALL' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>Tất cả</button>
                    <button onClick={() => setFilterType('OFFICE')} className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase transition-all ${filterType === 'OFFICE' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>Văn phòng</button>
                    <button onClick={() => setFilterType('STORE')} className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase transition-all ${filterType === 'STORE' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>Cửa hàng</button>
                </div>
                <div className="flex-1 w-full relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16}/>
                    <input 
                        className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border-none rounded-xl text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none"
                        placeholder="Tìm kiếm đơn vị..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                    />
                </div>
                <div className="flex bg-slate-100 p-1 rounded-xl">
                    <button onClick={() => setViewMode('GRID')} className={`p-2 rounded-lg ${viewMode==='GRID'?'bg-white shadow-sm text-indigo-600':'text-slate-400'}`}><LayoutGrid size={18}/></button>
                    <button onClick={() => setViewMode('LIST')} className={`p-2 rounded-lg ${viewMode==='LIST'?'bg-white shadow-sm text-indigo-600':'text-slate-400'}`}><ListIcon size={18}/></button>
                </div>
            </div>

            {/* Content */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredOffices.map(office => renderOfficeCard(office))}
            </div>
            
            {filteredOffices.length === 0 && <div className="text-center py-20 text-slate-400 italic">Chưa có dữ liệu.</div>}

            {/* Modal Edit Office */}
            {isModalOpen && (
                <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in zoom-in duration-200">
                    <div className="bg-white rounded-[32px] w-full max-w-lg shadow-2xl p-8 flex flex-col max-h-[90vh]">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">{editingOffice.id ? 'Cập nhật thông tin' : 'Tạo đơn vị mới'}</h3>
                            <button onClick={()=>setIsModalOpen(false)} className="p-2 hover:bg-slate-100 rounded-full text-slate-400"><X size={24}/></button>
                        </div>
                        <div className="space-y-4 overflow-y-auto flex-1 custom-scrollbar pr-2">
                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Loại hình</label>
                                <div className="grid grid-cols-3 gap-2">
                                    {[OfficeType.OFFICE, OfficeType.STORE, OfficeType.WAREHOUSE].map(t => (
                                        <button 
                                            key={t}
                                            onClick={() => setEditingOffice({...editingOffice, type: t})}
                                            className={`py-3 rounded-xl text-xs font-bold uppercase border-2 transition-all ${editingOffice.type === t ? 'border-indigo-600 bg-indigo-50 text-indigo-700' : 'border-slate-100 text-slate-500 hover:border-slate-300'}`}
                                        >
                                            {t}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div className="grid grid-cols-3 gap-4">
                                <div className="col-span-1">
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Mã đơn vị *</label>
                                    <input 
                                        className="w-full border-2 border-slate-100 rounded-xl p-3 font-mono font-bold uppercase focus:border-indigo-500 outline-none" 
                                        value={editingOffice.code || ''} 
                                        onChange={e=>setEditingOffice({...editingOffice, code: e.target.value.toUpperCase()})} 
                                        placeholder="VP-01" 
                                    />
                                </div>
                                <div className="col-span-2">
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Tên hiển thị *</label>
                                    <input 
                                        className="w-full border-2 border-slate-100 rounded-xl p-3 font-bold focus:border-indigo-500 outline-none" 
                                        value={editingOffice.name || ''} 
                                        onChange={e=>setEditingOffice({...editingOffice, name: e.target.value})} 
                                        placeholder="Văn phòng Hà Nội..." 
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Quỹ tiền mặc định (Để tính số dư)</label>
                                <div className="relative">
                                    <CreditCard size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/>
                                    <select 
                                        className="w-full border-2 border-slate-100 rounded-xl pl-10 pr-3 py-3 font-medium focus:border-indigo-500 outline-none text-sm bg-white"
                                        value={editingOffice.defaultCashAccountId || ''}
                                        onChange={e=>setEditingOffice({...editingOffice, defaultCashAccountId: e.target.value})}
                                    >
                                        <option value="">-- Chọn Quỹ / Tài khoản --</option>
                                        {accounts.map(acc => (
                                            <option key={acc.id} value={acc.id}>{acc.bankName} - {acc.accountName}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Địa chỉ</label>
                                <div className="relative">
                                    <MapPin size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/>
                                    <input className="w-full border-2 border-slate-100 rounded-xl pl-10 pr-3 py-3 font-medium focus:border-indigo-500 outline-none text-sm" value={editingOffice.address || ''} onChange={e=>setEditingOffice({...editingOffice, address: e.target.value})} />
                                </div>
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Quản lý phụ trách</label>
                                <select className="w-full border-2 border-slate-100 rounded-xl p-3 font-bold bg-white focus:border-indigo-500 outline-none text-sm" value={editingOffice.managerId || ''} onChange={e=>setEditingOffice({...editingOffice, managerId: e.target.value})}>
                                    <option value="">-- Chọn nhân sự --</option>
                                    {employees.map(e => <option key={e.id} value={e.id}>{e.fullName} - {e.code}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Trạng thái</label>
                                <select className="w-full border-2 border-slate-100 rounded-xl p-3 font-bold bg-white focus:border-indigo-500 outline-none text-sm" value={editingOffice.status} onChange={e=>setEditingOffice({...editingOffice, status: e.target.value as any})}>
                                    <option value="ACTIVE">Đang hoạt động</option>
                                    <option value="INACTIVE">Ngừng hoạt động</option>
                                </select>
                            </div>
                        </div>
                        <div className="pt-6 mt-2 border-t border-slate-50 flex gap-3">
                            <button onClick={()=>setIsModalOpen(false)} className="flex-1 py-3 text-slate-400 font-bold hover:bg-slate-50 rounded-xl transition-colors">Hủy bỏ</button>
                            <button onClick={handleSave} disabled={isSaving} className="flex-1 py-3 bg-indigo-600 text-white rounded-xl font-bold shadow-lg hover:bg-indigo-700 transition-all flex items-center justify-center disabled:opacity-70">
                                {isSaving ? <Loader2 size={18} className="animate-spin mr-2"/> : <Save size={18} className="mr-2"/>}
                                Lưu lại
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Office 360 Detail View (Replaces old Analytics Modal) */}
            {viewingOffice && (
                <OfficeDetail360 
                    office={viewingOffice} 
                    transactions={transactions} 
                    accounts={accounts}
                    onClose={() => setViewingOffice(null)} 
                />
            )}
        </div>
    );
};

export default OfficeManager;
