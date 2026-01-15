
import React, { useState, useMemo, useEffect } from 'react';
import { Partner, PartnerType, Project, Transaction, Contract, PartnerPerformance, UserContext } from '../types';
import { createPartner, updatePartner, fetchPartners } from '../services/masterDataService';
import { analyzePartner } from '../services/partnerAnalysisService';
import { 
    Users, Plus, Search, MapPin, Phone, Edit, Building2, 
    ArrowUpRight, ArrowDownLeft, FileText, CheckCircle, Wallet, X,
    Briefcase, Eye, ShieldCheck, AlertTriangle, UserCircle, ChevronRight, MoreHorizontal,
    Mail, CreditCard, User, Save, Loader2, Filter, Star, TrendingUp, LayoutGrid, List as ListIcon,
    RefreshCw, Sparkles, Brain
} from 'lucide-react';
import Customer360Modal from './Customer360Modal';

interface CustomerManagerProps {
    partners: Partner[];
    projects: Project[];
    transactions: Transaction[];
    contracts: Contract[];
    currentUser: UserContext;
}

const DRAFT_KEY = 'finance_customer_form_draft';

const CustomerManager: React.FC<CustomerManagerProps> = ({ partners, projects, transactions, contracts, currentUser }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [viewingCustomer, setViewingCustomer] = useState<Partner | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    
    // Filters & View Mode
    const [filterRisk, setFilterRisk] = useState<'ALL' | 'HIGH' | 'MEDIUM' | 'LOW'>('ALL');
    const [viewMode, setViewMode] = useState<'LIST' | 'GRID'>('GRID');
    
    // Local state to ensure real-time updates from "Database"
    const [localPartners, setLocalPartners] = useState<Partner[]>([]);

    // Initial Load & Sync
    useEffect(() => {
        refreshData();
    }, [partners]); // Sync when props change, but also fetch fresh from storage

    const { canViewAll, myCustomerIds } = useMemo(() => {
        const perms = currentUser?.permissions || [];
        // Admin hoặc có quyền xem tất cả khách hàng/dự án
        const isSysAdmin = perms.includes('SYS_ADMIN');
        const canViewAll = isSysAdmin || perms.includes('CUSTOMER_VIEW_ALL') || perms.includes('PROJECT_VIEW_ALL');

        if (canViewAll) return { canViewAll: true, myCustomerIds: [] };

        // Nếu chỉ xem của mình: Lọc các dự án mình làm PM hoặc Sales
        const myProjects = projects.filter(p => 
            p.managerEmpId === currentUser.id || 
            (p.salesEmpIds || []).includes(currentUser.id)
        );

        // Lấy danh sách ID khách hàng từ các dự án đó
        const customerIds = myProjects.map(p => p.customerId).filter((id): id is string => !!id);
        return { canViewAll: false, myCustomerIds: customerIds };
    }, [currentUser, projects]);

    const refreshData = async () => {
        setIsLoading(true);
        try {
            // Force fetch fresh data from storage to avoid stale props
            const freshData = await fetchPartners();
            // Filter strictly for Customers (or Both)
            const customersOnly = freshData.filter(p => p.type === PartnerType.CUSTOMER || p.type === PartnerType.BOTH);
            setLocalPartners(customersOnly);
        } catch (e) {
            console.error("Failed to refresh customer list", e);
        } finally {
            setIsLoading(false);
        }
    };
    
    // Persistent State for Modal & Form
    const [isModalOpen, setIsModalOpen] = useState(() => {
        try {
            const saved = localStorage.getItem(DRAFT_KEY);
            return saved ? JSON.parse(saved).isModalOpen : false;
        } catch { return false; }
    });

    const [formData, setFormData] = useState<Partial<Partner>>(() => {
        try {
            const saved = localStorage.getItem(DRAFT_KEY);
            return saved ? JSON.parse(saved).formData : { type: PartnerType.CUSTOMER, status: 'ACTIVE' };
        } catch { return { type: PartnerType.CUSTOMER, status: 'ACTIVE' }; }
    });

    // Save draft
    useEffect(() => {
        localStorage.setItem(DRAFT_KEY, JSON.stringify({ isModalOpen, formData }));
    }, [isModalOpen, formData]);

    // Analytics Calculation
    const { dashboardStats, analyzedCustomers } = useMemo(() => {
        let totalRevenue = 0;
        let totalDebt = 0;
        let activeCustomers = 0;
        let highRiskCount = 0;

        const analyzed = localPartners.map(c => {
            const stats = analyzePartner(c, transactions || [], projects || [], contracts || []);
            totalRevenue += stats.totalRevenue || 0;
            totalDebt += stats.totalDebt || 0;
            if ((stats.projectCount || 0) > 0) activeCustomers++;
            if (stats.riskLevel === 'HIGH') highRiskCount++;
            return { ...c, stats };
        });

        return { 
            dashboardStats: { totalRevenue, totalDebt, activeCustomers, totalCount: localPartners.length, highRiskCount },
            analyzedCustomers: analyzed
        };
    }, [localPartners, transactions, projects, contracts]);

    const filteredCustomers = useMemo(() => {
        return analyzedCustomers.filter(item => {
            // --- BỔ SUNG KIỂM TRA QUYỀN ---
            // Nếu không có quyền xem tất cả VÀ Khách này không nằm trong danh sách dự án của tôi -> Ẩn luôn
            if (!canViewAll && !myCustomerIds.includes(item.id)) {
                return false;
            }
            // -----------------------------

            const matchesSearch = (item.name || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
                                  (item.phone && item.phone.includes(searchTerm)) || 
                                  (item.code || '').toLowerCase().includes(searchTerm.toLowerCase());
            
            const matchesRisk = filterRisk === 'ALL' || item.stats.riskLevel === filterRisk;
            return matchesSearch && matchesRisk;
        });
    }, [analyzedCustomers, searchTerm, filterRisk, canViewAll, myCustomerIds]); // <--- Thêm dependency

    const handleSave = async () => {
        if (!formData.name) {
            alert("Vui lòng nhập tên Khách hàng / Công ty");
            return;
        }
        
        setIsSaving(true);
        try {
            const partner: Partner = {
                id: formData.id || `pt_${Date.now()}`,
                code: formData.code || `KH-${Date.now().toString().slice(-4)}`,
                name: formData.name,
                phone: formData.phone || '',
                email: formData.email || '',
                address: formData.address || '',
                taxCode: formData.taxCode || '',
                representative: formData.representative || '',
                position: formData.position || '',
                bankAccountNumber: formData.bankAccountNumber || '',
                bankName: formData.bankName || '',
                bankBranch: formData.bankBranch || '',
                type: PartnerType.CUSTOMER, // Force type Customer
                status: formData.status || 'ACTIVE'
            } as Partner;

            if (formData.id) {
                await updatePartner(partner);
            } else {
                await createPartner(partner);
            }
            
            // Critical: Refresh data immediately from storage to show the new item
            await refreshData();
            
            setIsModalOpen(false);
            setFormData({ type: PartnerType.CUSTOMER, status: 'ACTIVE' });
        } catch (error: any) {
            alert("Có lỗi xảy ra: " + error.message);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="space-y-8 animate-in fade-in pb-20 -m-8 h-screen flex flex-col bg-[#fcfdfe]">
            {/* Header Bar */}
            <div className="bg-white border-b border-slate-100 px-10 py-6 flex items-center justify-between shrink-0 shadow-sm z-30">
                <div className="flex items-center gap-5">
                    <div className="bg-gradient-to-br from-emerald-500 to-teal-600 p-3.5 rounded-[20px] text-white shadow-lg shadow-emerald-200">
                        <UserCircle size={28}/>
                    </div>
                    <div>
                        <h1 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Khách hàng & CĐT</h1>
                        <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mt-1 flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                            Quản trị quan hệ & Dòng tiền 360°
                        </p>
                    </div>
                </div>
                
                <button 
                    onClick={() => { setFormData({type: PartnerType.CUSTOMER, status: 'ACTIVE'}); setIsModalOpen(true); }}
                    className="bg-slate-900 text-white px-8 py-4 rounded-2xl font-black uppercase text-[11px] tracking-widest shadow-xl hover:bg-slate-800 active:scale-95 transition-all flex items-center group"
                >
                    <Plus size={18} className="mr-2 group-hover:rotate-90 transition-transform"/> Thêm khách hàng mới
                </button>
            </div>

            {/* AI Insights & Stats */}
            <div className="px-10 pt-4 grid grid-cols-1 md:grid-cols-4 gap-6 shrink-0">
                <div className="bg-white p-6 rounded-[28px] border border-slate-100 shadow-sm hover:shadow-md transition-all">
                    <div className="flex justify-between items-start mb-4">
                        <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl"><Users size={24}/></div>
                        <span className="text-[10px] font-black bg-blue-100 text-blue-700 px-2 py-1 rounded-lg uppercase">Tổng</span>
                    </div>
                    <p className="text-3xl font-black text-slate-900">{dashboardStats.totalCount}</p>
                    <p className="text-xs font-bold text-slate-400 mt-1">Khách hàng trong hệ thống</p>
                </div>
                
                <div className="bg-white p-6 rounded-[28px] border border-slate-100 shadow-sm hover:shadow-md transition-all">
                    <div className="flex justify-between items-start mb-4">
                        <div className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl"><TrendingUp size={24}/></div>
                        <span className="text-[10px] font-black bg-emerald-100 text-emerald-700 px-2 py-1 rounded-lg uppercase">Doanh thu</span>
                    </div>
                    <p className="text-3xl font-black text-emerald-600">{(dashboardStats.totalRevenue/1000000).toLocaleString()} <span className="text-sm text-emerald-400 font-bold">Tr</span></p>
                    <p className="text-xs font-bold text-slate-400 mt-1">Tổng thực thu từ khách</p>
                </div>

                <div className="bg-white p-6 rounded-[28px] border border-slate-100 shadow-sm hover:shadow-md transition-all relative overflow-hidden">
                    <div className="flex justify-between items-start mb-4">
                        <div className="p-3 bg-orange-50 text-orange-600 rounded-2xl"><AlertTriangle size={24}/></div>
                        <span className="text-[10px] font-black bg-orange-100 text-orange-700 px-2 py-1 rounded-lg uppercase">Công nợ</span>
                    </div>
                    <p className="text-3xl font-black text-orange-600">{(dashboardStats.totalDebt/1000000).toLocaleString()} <span className="text-sm text-orange-400 font-bold">Tr</span></p>
                    <p className="text-xs font-bold text-slate-400 mt-1">Cần thu hồi gấp</p>
                    {dashboardStats.totalDebt > 0 && <div className="absolute bottom-0 left-0 w-full h-1 bg-orange-500 animate-pulse"></div>}
                </div>

                <div className="bg-gradient-to-br from-indigo-600 to-violet-700 p-6 rounded-[28px] shadow-lg text-white flex flex-col justify-between relative overflow-hidden">
                    <div className="relative z-10">
                        <div className="flex justify-between items-start mb-2">
                            <p className="text-xs font-black uppercase tracking-widest opacity-70">Rủi ro cao</p>
                            <ShieldCheck size={20} className="opacity-50"/>
                        </div>
                        <p className="text-4xl font-black">{dashboardStats.highRiskCount}</p>
                        <p className="text-[10px] opacity-70 mt-2 font-medium">Khách hàng cần theo dõi đặc biệt</p>
                    </div>
                    <div className="absolute -right-4 -bottom-4 opacity-10 rotate-12">
                        <AlertTriangle size={100}/>
                    </div>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar p-10 space-y-6">
                {/* Search & Tool */}
                <div className="bg-white p-2 rounded-[24px] border border-slate-200 shadow-sm flex items-center gap-2">
                    <div className="relative flex-1 group">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-indigo-500 transition-colors" size={18} />
                        <input 
                            className="w-full pl-12 pr-4 py-3.5 bg-white border-none rounded-2xl outline-none text-sm font-bold placeholder:text-slate-300"
                            placeholder="Tìm kiếm khách hàng, SĐT, mã số..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <div className="h-8 w-px bg-slate-100 mx-2"></div>
                    <div className="flex gap-2 mr-2 items-center">
                        <button onClick={() => setViewMode('LIST')} className={`p-2 rounded-xl transition-all ${viewMode === 'LIST' ? 'bg-indigo-50 text-indigo-600' : 'text-slate-400 hover:bg-slate-50'}`}><ListIcon size={20}/></button>
                        <button onClick={() => setViewMode('GRID')} className={`p-2 rounded-xl transition-all ${viewMode === 'GRID' ? 'bg-indigo-50 text-indigo-600' : 'text-slate-400 hover:bg-slate-50'}`}><LayoutGrid size={20}/></button>
                        <div className="h-6 w-px bg-slate-100 mx-1"></div>
                        <button onClick={refreshData} className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all" title="Làm mới"><RefreshCw size={18}/></button>
                    </div>
                </div>

                {/* VIEW: GRID MODE (CARD) */}
                {viewMode === 'GRID' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {filteredCustomers.map(item => {
                            const { stats, ...c } = item;
                            const avatarChar = (c.name || '?').charAt(0).toUpperCase();
                            return (
                                <div key={c.id} onClick={() => setViewingCustomer(c)} className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all cursor-pointer group flex flex-col justify-between relative overflow-hidden">
                                    <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-10 transition-opacity"><Building2 size={100}/></div>
                                    
                                    <div>
                                        <div className="flex justify-between items-start mb-4">
                                            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center font-black text-2xl shadow-sm ${stats.riskLevel === 'HIGH' ? 'bg-rose-50 text-rose-600' : 'bg-slate-50 text-indigo-600'}`}>
                                                {avatarChar}
                                            </div>
                                            {stats.riskLevel === 'HIGH' && <span className="bg-rose-100 text-rose-600 px-3 py-1 rounded-full text-[9px] font-black uppercase">Rủi ro cao</span>}
                                        </div>
                                        
                                        <h3 className="font-black text-slate-900 text-lg line-clamp-2 mb-1 group-hover:text-indigo-600 transition-colors">{c.name}</h3>
                                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{c.code} • {c.phone}</p>
                                        
                                        <div className="mt-6 space-y-3">
                                            <div className="flex justify-between items-center text-sm">
                                                <span className="text-slate-500 font-medium">Tổng thực thu</span>
                                                <span className="font-black text-emerald-600">{(stats.totalRevenue || 0).toLocaleString()} ₫</span>
                                            </div>
                                            <div className="flex justify-between items-center text-sm">
                                                <span className="text-slate-500 font-medium">Công nợ hiện tại</span>
                                                <span className={`font-black ${(stats.totalDebt || 0) > 0 ? 'text-orange-600' : 'text-slate-300'}`}>
                                                    {(stats.totalDebt || 0) > 0 ? (stats.totalDebt || 0).toLocaleString() + ' ₫' : '---'}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="mt-6 pt-4 border-t border-slate-50 flex justify-between items-center">
                                        <div className="flex items-center gap-1 text-xs font-bold text-slate-400">
                                            <Briefcase size={14}/> {stats.projectCount} dự án
                                        </div>
                                        <div className="flex items-center gap-1 text-indigo-600 text-xs font-black uppercase tracking-widest group-hover:gap-2 transition-all">
                                            Xem chi tiết <ChevronRight size={14}/>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* VIEW: LIST MODE (TABLE) */}
                {viewMode === 'LIST' && (
                    <div className="bg-white rounded-[32px] border border-slate-200 shadow-sm overflow-hidden">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-slate-50/80 text-slate-400 font-black uppercase text-[10px] tracking-widest border-b border-slate-100">
                                <tr>
                                    <th className="px-8 py-5">Đối tác / Chủ đầu tư</th>
                                    <th className="px-6 py-5">Liên hệ</th>
                                    <th className="px-6 py-5 text-center">Dự án</th>
                                    <th className="px-6 py-5 text-center">AI Scoring</th>
                                    <th className="px-6 py-5 text-right">Tổng thực thu</th>
                                    <th className="px-6 py-5 text-right">Công nợ</th>
                                    <th className="px-8 py-5 text-right"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {filteredCustomers.map(item => {
                                    const { stats, ...c } = item;
                                    return (
                                        <tr key={c.id} className="hover:bg-indigo-50/30 transition-all group cursor-pointer" onClick={() => setViewingCustomer(c)}>
                                            <td className="px-8 py-5">
                                                <div className="flex items-center gap-4">
                                                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm shadow-sm border ${stats.riskLevel === 'HIGH' ? 'bg-rose-50 text-rose-600 border-rose-100' : 'bg-white text-slate-600 border-slate-200'}`}>
                                                        {c.name?.charAt(0)}
                                                    </div>
                                                    <div>
                                                        <div className="font-black text-slate-800 text-sm group-hover:text-indigo-600 transition-colors line-clamp-1">{c.name}</div>
                                                        <div className="text-[10px] font-bold text-slate-400 uppercase font-mono mt-0.5">{c.code}</div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-5">
                                                <div className="flex flex-col gap-1">
                                                    <div className="flex items-center text-[11px] font-bold text-slate-700">{c.representative || '---'}</div>
                                                    <div className="flex items-center text-[11px] font-medium text-slate-500">{c.phone || '---'}</div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-5 text-center">
                                                <span className="inline-flex items-center justify-center px-3 py-1 bg-slate-100 rounded-lg text-slate-600 text-xs font-black">{stats.projectCount}</span>
                                            </td>
                                            <td className="px-6 py-5 text-center">
                                                <div className="flex flex-col items-center gap-1">
                                                    <div className="flex items-center gap-1">
                                                        <Star size={12} className={stats.aiScore >= 80 ? "text-yellow-400 fill-yellow-400" : "text-slate-300"} />
                                                        <span className={`text-sm font-black ${stats.aiScore >= 80 ? 'text-emerald-600' : stats.aiScore >= 50 ? 'text-blue-600' : 'text-rose-500'}`}>{stats.aiScore}</span>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-5 text-right font-black text-emerald-600 text-sm">
                                                {(stats.totalRevenue || 0).toLocaleString()} ₫
                                            </td>
                                            <td className="px-6 py-5 text-right">
                                                {(stats.totalDebt || 0) > 0 ? 
                                                    <span className="text-orange-600 font-black text-sm">{(stats.totalDebt || 0).toLocaleString()} ₫</span> : 
                                                    <span className="text-slate-300 font-bold text-xs">-</span>
                                                }
                                            </td>
                                            <td className="px-8 py-5 text-right">
                                                <button onClick={(ev) => { ev.stopPropagation(); setFormData(c); setIsModalOpen(true); }} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-white hover:shadow-md rounded-xl transition-all"><Edit size={16}/></button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
                
                {filteredCustomers.length === 0 && !isLoading && (
                    <div className="text-center py-20 text-slate-400 italic font-medium bg-white rounded-[32px] border border-dashed border-slate-200">
                        Không tìm thấy dữ liệu phù hợp.
                    </div>
                )}
            </div>

            {/* Customer 360 Modal */}
            {viewingCustomer && (
                <Customer360Modal 
                    customer={viewingCustomer}
                    projects={projects}
                    transactions={transactions}
                    contracts={contracts}
                    onClose={() => setViewingCustomer(null)}
                />
            )}

            {/* Add/Edit Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-[150] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
                    <div className="bg-white rounded-[40px] w-full max-w-4xl shadow-2xl animate-in zoom-in duration-300 overflow-hidden flex flex-col max-h-[90vh]">
                        <div className="px-10 py-8 border-b bg-slate-50/50 flex justify-between items-center shrink-0">
                            <div>
                                <h3 className="font-black text-2xl uppercase tracking-tighter text-slate-900">{formData.id ? 'Cập nhật thông tin' : 'Thêm khách hàng mới'}</h3>
                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Dữ liệu sẽ được đồng bộ sang Module Công trình & Hợp đồng</p>
                            </div>
                            <button onClick={()=>setIsModalOpen(false)} className="p-3 hover:bg-white rounded-full text-slate-400"><X size={28}/></button>
                        </div>
                        <div className="p-10 space-y-8 overflow-y-auto custom-scrollbar">
                            {/* SECTION 1: BASIC INFO */}
                            <div>
                                <h4 className="text-[10px] font-black text-indigo-600 uppercase tracking-widest border-b border-indigo-100 pb-2 mb-4 flex items-center"><Building2 size={14} className="mr-1"/> Thông tin tổ chức / Cá nhân</h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div>
                                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Tên Khách hàng / CĐT *</label>
                                        <input className="w-full border-2 border-slate-100 rounded-2xl p-4 font-bold text-slate-800 outline-none focus:border-indigo-500" value={formData.name || ''} onChange={e=>setFormData({...formData, name: e.target.value})} placeholder="Công ty CP Đầu tư..." />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Mã định danh (Code)</label>
                                        <input className="w-full border-2 border-slate-100 rounded-2xl p-4 font-mono font-bold uppercase" value={formData.code || ''} onChange={e=>setFormData({...formData, code: e.target.value})} placeholder="KH-001" disabled={!!formData.id} />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Mã số thuế</label>
                                        <input className="w-full border-2 border-slate-100 rounded-2xl p-4 font-mono font-bold" value={formData.taxCode || ''} onChange={e=>setFormData({...formData, taxCode: e.target.value})} />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Địa chỉ trụ sở</label>
                                        <input className="w-full border-2 border-slate-100 rounded-2xl p-4 font-bold" value={formData.address || ''} onChange={e=>setFormData({...formData, address: e.target.value})} />
                                    </div>
                                </div>
                            </div>

                            {/* SECTION 2: CONTACT INFO */}
                            <div>
                                <h4 className="text-[10px] font-black text-emerald-600 uppercase tracking-widest border-b border-emerald-100 pb-2 mb-4 flex items-center"><User size={14} className="mr-1"/> Người liên hệ & Đại diện</h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div>
                                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Người đại diện / Liên hệ</label>
                                        <input className="w-full border-2 border-slate-100 rounded-2xl p-4 font-bold" value={formData.representative || ''} onChange={e=>setFormData({...formData, representative: e.target.value})} placeholder="Mr. Nam" />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Chức vụ</label>
                                        <input className="w-full border-2 border-slate-100 rounded-2xl p-4 font-bold" value={formData.position || ''} onChange={e=>setFormData({...formData, position: e.target.value})} placeholder="Giám đốc dự án" />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Số điện thoại *</label>
                                        <input className="w-full border-2 border-slate-100 rounded-2xl p-4 font-bold" value={formData.phone || ''} onChange={e=>setFormData({...formData, phone: e.target.value})} />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Email</label>
                                        <input className="w-full border-2 border-slate-100 rounded-2xl p-4 font-bold" value={formData.email || ''} onChange={e=>setFormData({...formData, email: e.target.value})} placeholder="contact@company.com" />
                                    </div>
                                </div>
                            </div>

                            {/* SECTION 3: BANKING INFO */}
                            <div>
                                <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest border-b border-slate-100 pb-2 mb-4 flex items-center"><CreditCard size={14} className="mr-1"/> Thông tin thanh toán (Tùy chọn)</h4>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                    <div>
                                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Số tài khoản</label>
                                        <input className="w-full border-2 border-slate-100 rounded-2xl p-4 font-mono font-bold" value={formData.bankAccountNumber || ''} onChange={e=>setFormData({...formData, bankAccountNumber: e.target.value})} />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Ngân hàng</label>
                                        <input className="w-full border-2 border-slate-100 rounded-2xl p-4 font-bold uppercase" value={formData.bankName || ''} onChange={e=>setFormData({...formData, bankName: e.target.value})} />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Chi nhánh</label>
                                        <input className="w-full border-2 border-slate-100 rounded-2xl p-4 font-bold" value={formData.bankBranch || ''} onChange={e=>setFormData({...formData, bankBranch: e.target.value})} />
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="px-10 py-8 bg-slate-50 border-t flex justify-end gap-4 shrink-0 shadow-inner">
                            <button onClick={()=>setIsModalOpen(false)} className="px-8 py-4 text-slate-400 font-black uppercase text-[11px] tracking-widest hover:text-slate-600 transition-colors">Hủy bỏ</button>
                            <button onClick={handleSave} disabled={isSaving} className="px-12 py-4 bg-emerald-600 text-white rounded-2xl font-black uppercase text-[11px] tracking-widest shadow-xl shadow-emerald-100 hover:bg-emerald-700 active:scale-95 transition-all flex items-center disabled:opacity-70">
                                {isSaving ? <Loader2 className="animate-spin mr-2"/> : <Save size={18} className="mr-2"/>}
                                {isSaving ? 'Đang lưu...' : 'Lưu hồ sơ khách hàng'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CustomerManager;
