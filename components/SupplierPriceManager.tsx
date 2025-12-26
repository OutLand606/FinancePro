
import React, { useState, useEffect, useMemo } from 'react';
import { PriceRecord, CategoryMaster, Partner, Transaction, DocumentType, DataSource, MaterialMaster, CategoryType, PartnerType, Project, TransactionType } from '../types';
import { 
    Search, TrendingUp, TrendingDown, Plus, AlertCircle, Tag, Calendar, DollarSign, X, FileText, Upload, 
    CheckCircle, ShieldCheck, Link as LinkIcon, Edit3, BarChart2, Building2, UserPlus, Phone, CreditCard, 
    Banknote, ShoppingBag, MapPin, Mail, User, Info, Briefcase, Zap, ChevronRight, RefreshCw, Loader2, 
    ArrowRightLeft, History, Filter, Star, MoreHorizontal, ExternalLink, Mail as MailIcon, Grid, List, Download, FileSpreadsheet, Eye,
    Database
} from 'lucide-react';
import { fetchPriceRecords, getLatestPrices, syncPricesFromTransactions, getPriceTrend, getPriceHistoryForMaterial, getPendingSyncTransactions } from '../services/supplierPriceService';
import { fetchCategories } from '../services/categoryService';
import { fetchPartners, fetchMaterialMaster, createPartner } from '../services/masterDataService';
import { fetchAllData } from '../services/sheetService'; // Need Projects for 360 view
import { analyzePartner } from '../services/partnerAnalysisService';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as ChartTooltip, ResponsiveContainer } from 'recharts';
import DocumentProcessor from './DocumentProcessor';
import ExcelImportModal from './ExcelImportModal';
import Partner360Modal from './Partner360Modal';

const SupplierPriceManager: React.FC<{ transactions: Transaction[] }> = ({ transactions }) => {
  const [activeTab, setActiveTab] = useState<'PRICES' | 'PARTNER_NETWORK' | 'PARTNER_LIST'>('PRICES');
  const [categories, setCategories] = useState<CategoryMaster[]>([]);
  const [records, setRecords] = useState<PriceRecord[]>([]);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [materialMaster, setMaterialMaster] = useState<MaterialMaster[]>([]);
  const [processedData, setProcessedData] = useState<any[]>([]);
  
  // New Features State
  const [viewMode, setViewMode] = useState<'GRID' | 'LIST'>('GRID');
  const [searchQuery, setSearchQuery] = useState('');
  const [priceSearchQuery, setPriceSearchQuery] = useState('');
  const [filterArea, setFilterArea] = useState<string>('ALL');
  const [pendingSyncTrans, setPendingSyncTrans] = useState<Transaction[]>([]);
  
  // UI States
  const [isProcessorOpen, setIsProcessorOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [showAddPartner, setShowAddPartner] = useState(false);
  const [editingPartner, setEditingPartner] = useState<Partner | null>(null);
  const [selectedHistoryItem, setSelectedHistoryItem] = useState<{name: string, history: PriceRecord[]} | null>(null);
  const [showExcelImport, setShowExcelImport] = useState(false);
  const [viewingPartner360, setViewingPartner360] = useState<Partner | null>(null);
  
  const [newPartner, setNewPartner] = useState<Partial<Partner>>({ 
      type: PartnerType.SUPPLIER, 
      status: 'ACTIVE',
      providedCategoryIds: [] 
  });

  useEffect(() => { loadData(); }, [transactions]);

  const loadData = async () => {
    const [cats, recs, parts, mats, allData] = await Promise.all([
        fetchCategories(),
        fetchPriceRecords(),
        fetchPartners(),
        fetchMaterialMaster(),
        fetchAllData()
    ]);
    setCategories(cats.filter(c => c.type === CategoryType.MATERIAL));
    setRecords(recs);
    setPartners(parts);
    setMaterialMaster(mats);
    setProjects(allData.projects);
    const latest = await getLatestPrices(recs);
    setProcessedData(latest);
    
    // Check pending
    const pending = await getPendingSyncTransactions(transactions);
    setPendingSyncTrans(pending);
  };

  const handleSyncFromLedger = async () => {
      setIsSyncing(true);
      try {
          const count = await syncPricesFromTransactions(transactions);
          await loadData();
          alert(`Thành công! Máy học đã phân tích ${count} giao dịch mới và cập nhật vào cơ sở dữ liệu giá.`);
      } catch (e: any) {
          alert("Lỗi đồng bộ: " + e.message);
      } finally {
          setIsSyncing(false);
      }
  };

  const filteredPrices = useMemo(() => {
      return processedData.filter(r => 
          r.resolvedName.toLowerCase().includes(priceSearchQuery.toLowerCase()) || 
          (partners.find(p=>p.id===r.partnerId)?.name || '').toLowerCase().includes(priceSearchQuery.toLowerCase())
      );
  }, [processedData, priceSearchQuery, partners]);

  const learningStats = useMemo(() => {
      const totalMaterialTrans = transactions.filter(t => t.type === TransactionType.EXPENSE && t.isMaterialCost).length;
      const learnedCount = totalMaterialTrans - pendingSyncTrans.length;
      const progress = totalMaterialTrans > 0 ? (learnedCount / totalMaterialTrans) * 100 : 0;
      return { totalMaterialTrans, learnedCount, progress };
  }, [transactions, pendingSyncTrans]);

  const handleViewHistory = async (record: any) => {
      const history = await getPriceHistoryForMaterial(record.materialId, record.resolvedName);
      setSelectedHistoryItem({ name: record.resolvedName, history });
  };

  const handleSavePartner = async () => {
      if(!newPartner.name) return;
      const partner: Partner = {
          ...newPartner as Partner,
          id: editingPartner?.id || `pt_${Date.now()}`,
          code: editingPartner?.code || `NCC-${Date.now().toString().slice(-4)}`
      };
      
      const updatedPartners = editingPartner 
          ? partners.map(p => p.id === partner.id ? partner : p)
          : [partner, ...partners];
      
      localStorage.setItem('finance_partners', JSON.stringify(updatedPartners));
      setPartners(updatedPartners);
      setShowAddPartner(false);
      setEditingPartner(null);
      setNewPartner({ type: PartnerType.SUPPLIER, status: 'ACTIVE', providedCategoryIds: [] });
  };

  const handleUpdatePartnerFromModal = (updated: Partner) => {
      const updatedList = partners.map(p => p.id === updated.id ? updated : p);
      localStorage.setItem('finance_partners', JSON.stringify(updatedList));
      setPartners(updatedList);
      setViewingPartner360(updated); // Update the modal view
  };

  // Export Logic
  const handleExportPartners = () => {
      const headers = ['Mã NCC', 'Tên NCC', 'Điện thoại', 'Địa chỉ', 'Mã số thuế', 'Loại hình'];
      // STRICT FILTER: Only Suppliers/Labor
      const rows = partners
        .filter(p => p.type !== PartnerType.CUSTOMER)
        .map(p => [p.code, p.name, p.phone || '', p.address || '', p.taxCode || '', p.type]);
      
      const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `Danh_Sach_Doi_Tac_${new Date().toISOString().slice(0,10)}.csv`;
      link.click();
  };

  // Filtering Logic
  const filteredPartners = partners.filter(p => {
      // STRICT FILTER: Exclude Customers from this module
      if (p.type === PartnerType.CUSTOMER) return false;

      const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                            p.phone?.includes(searchQuery) ||
                            p.taxCode?.includes(searchQuery);
      // Mock Area Filter (In real app, Partner needs 'area' field)
      const matchesArea = filterArea === 'ALL' || (p.address && p.address.includes(filterArea));
      return matchesSearch && matchesArea;
  });

  return (
    <div className="space-y-8 animate-in fade-in duration-300 pb-20">
       <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-[24px] border border-slate-100 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="bg-indigo-600 w-12 h-12 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-indigo-100">
              <ShoppingBag size={24}/>
          </div>
          <div>
            <h1 className="text-xl font-black text-slate-900 uppercase tracking-tight">Thị Trường & Cung Ứng</h1>
            <p className="text-slate-500 text-sm font-medium">Trung tâm quyết định mua sắm & Đánh giá năng lực NCC</p>
          </div>
        </div>
        <div className="flex bg-slate-100 p-1 rounded-xl w-fit">
            <button onClick={() => setActiveTab('PRICES')} className={`whitespace-nowrap px-6 py-2.5 rounded-lg text-[11px] font-black uppercase tracking-widest transition-all ${activeTab === 'PRICES' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-400 hover:text-slate-700'}`}>Bảng giá mới nhất</button>
            <button onClick={() => setActiveTab('PARTNER_LIST')} className={`whitespace-nowrap px-6 py-2.5 rounded-lg text-[11px] font-black uppercase tracking-widest transition-all ${activeTab === 'PARTNER_LIST' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-400 hover:text-slate-700'}`}>Hồ sơ NCC / Tổ đội</button>
        </div>
      </div>

      {activeTab === 'PRICES' && (
        <div className="space-y-6 animate-in fade-in">
            {/* SYNC CENTER WIDGET */}
            <div className="bg-gradient-to-r from-indigo-50 to-blue-50 border border-indigo-100 p-8 rounded-[24px] flex flex-col md:flex-row justify-between items-center gap-6 shadow-sm relative overflow-hidden">
                <div className="relative z-10 flex-1">
                    <h3 className="font-black text-indigo-900 text-lg flex items-center uppercase tracking-tight"><Zap className="mr-2 text-yellow-500" size={20}/> Trạng thái Học Máy (AI Learning)</h3>
                    <div className="flex items-center gap-8 mt-4">
                        <div>
                            <p className="text-[10px] font-black uppercase text-indigo-400 tracking-widest">Đã phân tích</p>
                            <p className="text-2xl font-black text-indigo-700">{learningStats.learnedCount} / {learningStats.totalMaterialTrans}</p>
                        </div>
                        <div className="h-8 w-px bg-indigo-200"></div>
                        <div>
                            <p className="text-[10px] font-black uppercase text-orange-500 tracking-widest">Chờ học (Pending)</p>
                            <p className="text-2xl font-black text-orange-600">{pendingSyncTrans.length}</p>
                        </div>
                    </div>
                    <div className="w-full max-w-md bg-white/50 h-1.5 rounded-full mt-3 overflow-hidden">
                        <div className="h-full bg-indigo-500" style={{width: `${learningStats.progress}%`}}></div>
                    </div>
                </div>
                <div className="flex gap-3 relative z-10">
                    <button onClick={handleSyncFromLedger} disabled={isSyncing || pendingSyncTrans.length === 0} className="flex items-center px-6 py-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 font-black text-[11px] uppercase tracking-widest shadow-lg shadow-indigo-200 transition-all active:scale-95 disabled:opacity-50">
                        {isSyncing ? <Loader2 className="animate-spin mr-2" size={16}/> : <RefreshCw size={16} className="mr-2" />}
                        {isSyncing ? 'Đang học dữ liệu...' : 'Kích hoạt AI Học Ngay'}
                    </button>
                    <button onClick={() => setIsProcessorOpen(true)} className="flex items-center px-6 py-3 bg-white border border-indigo-200 text-indigo-700 rounded-xl hover:bg-indigo-50 font-black text-[11px] uppercase tracking-widest shadow-sm">
                        <Upload size={16} className="mr-2"/> Scan Báo Giá (PDF)
                    </button>
                </div>
                <Zap size={200} className="absolute -right-10 -bottom-10 text-white opacity-40 mix-blend-overlay"/>
            </div>

            <div className="bg-white rounded-[32px] border border-slate-200 shadow-sm overflow-hidden">
                <div className="px-8 py-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                    <div className="flex items-center gap-4 flex-1">
                        <h3 className="font-black text-slate-800 uppercase text-xs tracking-widest whitespace-nowrap">Dữ liệu giá thị trường (Real-time)</h3>
                        <div className="relative flex-1 max-w-sm">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" size={14} />
                            <input 
                                className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold focus:ring-2 focus:ring-indigo-500 outline-none"
                                placeholder="Tìm vật tư, nhà cung cấp..."
                                value={priceSearchQuery}
                                onChange={e => setPriceSearchQuery(e.target.value)}
                            />
                        </div>
                    </div>
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Cập nhật: {new Date().toLocaleDateString('vi-VN')}</div>
                </div>
                <table className="w-full text-sm text-left">
                    <thead className="bg-slate-50/80 text-slate-400 font-black uppercase text-[10px] tracking-widest border-b border-slate-100">
                        <tr>
                            <th className="px-8 py-5">Vật tư / Ngày cập nhật</th>
                            <th className="px-6 py-5">Nhà cung cấp</th>
                            <th className="px-6 py-5 text-right">Đơn giá tốt nhất</th>
                            <th className="px-6 py-5 text-center">Biến động</th>
                            <th className="px-6 py-5 text-center">Nguồn gốc</th>
                            <th className="px-8 py-5 text-right"></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {filteredPrices.map(r => {
                            const trend = getPriceTrend(records, r.materialId, r.resolvedName);
                            return (
                                <tr key={r.id} className="hover:bg-slate-50/80 group transition-all">
                                    <td className="px-8 py-5">
                                        <div className="font-black text-slate-900 group-hover:text-indigo-600 uppercase tracking-tight line-clamp-1 text-sm">{r.resolvedName}</div>
                                        <div className="text-[10px] text-slate-400 font-bold uppercase mt-1 flex items-center">
                                            <Calendar size={10} className="mr-1"/> {new Date(r.date).toLocaleDateString('vi-VN')} • ĐVT: {r.unit}
                                        </div>
                                    </td>
                                    <td className="px-6 py-5 font-bold text-slate-600 cursor-pointer hover:text-indigo-600 hover:underline" onClick={() => {
                                        const p = partners.find(p=>p.id===r.partnerId);
                                        if(p) setViewingPartner360(p);
                                    }}>
                                        {partners.find(p=>p.id===r.partnerId)?.name || 'Hợp đồng vãng lai'}
                                    </td>
                                    <td className="px-6 py-5 text-right font-black text-indigo-600 text-base">{r.price.toLocaleString()} ₫</td>
                                    <td className="px-6 py-5 text-center">
                                        {trend.trend === 'UP' && <span className="inline-flex items-center text-rose-600 font-black text-[10px] bg-rose-50 px-2 py-1 rounded-lg uppercase"><TrendingUp size={12} className="mr-1"/> +{trend.percent.toFixed(1)}%</span>}
                                        {trend.trend === 'DOWN' && <span className="inline-flex items-center text-emerald-600 font-black text-[10px] bg-emerald-50 px-2 py-1 rounded-lg uppercase"><TrendingDown size={12} className="mr-1"/> -{trend.percent.toFixed(1)}%</span>}
                                        {trend.trend === 'STABLE' && <span className="text-slate-400 font-black text-[10px] uppercase tracking-widest">Ổn định</span>}
                                        {trend.trend === 'NEW' && <span className="text-indigo-400 font-black text-[10px] italic uppercase">Mới</span>}
                                    </td>
                                    <td className="px-6 py-5 text-center">
                                        <span className={`text-[9px] font-black uppercase px-2 py-1 rounded-lg border ${
                                            r.dataSource === DataSource.FROM_EXPENSE ? 'bg-amber-50 text-amber-600 border-amber-100' : 
                                            r.dataSource === DataSource.FROM_AI ? 'bg-indigo-50 text-indigo-600 border-indigo-100' :
                                            'bg-slate-100 text-slate-500 border-slate-200'
                                        }`}>
                                            {r.dataSource === DataSource.FROM_EXPENSE ? 'Sổ Thu Chi' : r.dataSource === DataSource.FROM_AI ? 'Chứng từ AI' : 'Nhập tay'}
                                        </span>
                                    </td>
                                    <td className="px-8 py-5 text-right">
                                        <button onClick={() => handleViewHistory(r)} className="p-2 text-slate-400 hover:text-indigo-600 bg-slate-50 hover:bg-white rounded-xl transition-all border border-transparent hover:border-slate-200 shadow-sm">
                                            <BarChart2 size={16} />
                                        </button>
                                    </td>
                                </tr>
                            );
                        })}
                        {filteredPrices.length === 0 && (
                            <tr><td colSpan={6} className="px-6 py-20 text-center text-slate-400 font-medium italic">Không tìm thấy dữ liệu giá phù hợp.</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
      )}

      {activeTab === 'PARTNER_LIST' && (
        <div className="space-y-6 animate-in fade-in">
            <div className="bg-white p-4 rounded-[24px] border border-slate-200 shadow-sm flex flex-col md:flex-row justify-between items-center gap-4">
                <div className="relative flex-1 max-w-md ml-2">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
                    <input 
                        className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border-none rounded-xl text-sm font-bold focus:ring-2 focus:ring-indigo-500/50 outline-none transition-all"
                        placeholder="Tìm kiếm NCC, Tổ đội..."
                        value={searchQuery} onChange={e=>setSearchQuery(e.target.value)} 
                    />
                </div>
                
                <div className="flex flex-wrap gap-2 items-center mr-2">
                    <div className="bg-slate-100 p-1 rounded-xl flex border border-slate-200">
                        <button onClick={() => setViewMode('GRID')} className={`p-2 rounded-lg transition-all ${viewMode === 'GRID' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-400'}`}><Grid size={18}/></button>
                        <button onClick={() => setViewMode('LIST')} className={`p-2 rounded-lg transition-all ${viewMode === 'LIST' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-400'}`}><List size={18}/></button>
                    </div>

                    <button onClick={handleExportPartners} className="p-2.5 bg-white border border-green-200 text-green-700 rounded-xl hover:bg-green-50 transition-colors" title="Xuất Excel">
                        <Download size={18}/>
                    </button>
                    <button onClick={() => setShowExcelImport(true)} className="p-2.5 bg-white border border-orange-200 text-orange-700 rounded-xl hover:bg-orange-50 transition-colors" title="Nhập Excel">
                        <FileSpreadsheet size={18}/>
                    </button>

                    <button onClick={() => { setEditingPartner(null); setNewPartner({ type: PartnerType.SUPPLIER, status: 'ACTIVE', providedCategoryIds: [] }); setShowAddPartner(true); }} className="flex items-center px-5 py-2.5 bg-indigo-600 text-white rounded-xl font-black text-[11px] uppercase tracking-widest shadow-lg hover:bg-indigo-700 transition-all active:scale-95">
                        <UserPlus size={16} className="mr-2" /> Thêm Mới
                    </button>
                </div>
            </div>

            {viewMode === 'GRID' ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredPartners.map(p => {
                        const stats = analyzePartner(p, transactions);
                        return (
                            <div key={p.id} onClick={() => setViewingPartner360(p)} className="bg-white p-6 rounded-[24px] border border-slate-200 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all cursor-pointer relative overflow-hidden group flex flex-col">
                                <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity"><Building2 size={80}/></div>
                                <div className="flex justify-between items-start mb-4">
                                    <span className={`text-[9px] font-black uppercase px-2 py-1 bg-indigo-50 text-indigo-600 rounded-lg border border-indigo-100 tracking-widest`}>{p.type}</span>
                                    {stats.riskLevel === 'HIGH' ? (
                                        <div title="Rủi ro cao">
                                            <AlertCircle size={20} className="text-red-500" />
                                        </div>
                                    ) : (
                                        <div title="Uy tín">
                                            <ShieldCheck size={20} className="text-green-500" />
                                        </div>
                                    )}
                                </div>
                                <h4 className="font-black text-slate-900 uppercase tracking-tight text-lg mb-3 line-clamp-1">{p.name}</h4>
                                <div className="space-y-2 mb-6 flex-1">
                                    <div className="flex items-center text-xs font-bold text-slate-500"><Phone size={14} className="mr-2 text-indigo-400"/> {p.phone || '---'}</div>
                                    <div className="flex items-center text-xs font-medium text-slate-400 truncate"><MapPin size={14} className="mr-2 text-indigo-400"/> {p.address || '---'}</div>
                                </div>
                                
                                {/* AI Analytics Badge */}
                                <div className="pt-4 border-t border-slate-50 flex justify-between items-center mt-auto bg-slate-50/50 -mx-6 -mb-6 p-6 group-hover:bg-slate-50 transition-colors">
                                    <div>
                                        <div className="text-[10px] text-slate-400 font-black uppercase tracking-widest">Tổng chi</div>
                                        <div className="text-sm font-black text-indigo-700">{stats.totalSpent && stats.totalSpent > 0 ? (stats.totalSpent/1000000).toFixed(1) + ' Tr' : '---'}</div>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-[10px] text-slate-400 font-black uppercase tracking-widest">Uy tín AI</div>
                                        <div className={`text-sm font-black ${stats.aiScore >= 70 ? 'text-green-600' : stats.aiScore >= 40 ? 'text-yellow-600' : 'text-red-600'}`}>{stats.aiScore}/100</div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            ) : (
                <div className="bg-white rounded-[32px] border border-slate-200 shadow-sm overflow-hidden">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-slate-50/80 text-slate-400 font-black uppercase text-[10px] tracking-widest border-b border-slate-100">
                            <tr>
                                <th className="px-8 py-5">Tên Đối Tác</th>
                                <th className="px-6 py-5">Loại</th>
                                <th className="px-6 py-5 text-right">Tổng chi</th>
                                <th className="px-6 py-5 text-center">Uy tín AI</th>
                                <th className="px-6 py-5 text-center">Rủi ro</th>
                                <th className="px-8 py-5 text-right">Thao tác</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {filteredPartners.map(p => {
                                const stats = analyzePartner(p, transactions);
                                return (
                                    <tr key={p.id} className="hover:bg-slate-50/80 cursor-pointer transition-colors" onClick={() => setViewingPartner360(p)}>
                                        <td className="px-8 py-4">
                                            <div className="font-black text-slate-800 text-sm uppercase tracking-tight">{p.name}</div>
                                            <div className="text-[10px] text-slate-400 font-mono font-bold mt-0.5">{p.code}</div>
                                        </td>
                                        <td className="px-6 py-4"><span className="text-[9px] bg-slate-100 px-2 py-1 rounded-lg font-black uppercase tracking-widest text-slate-500">{p.type}</span></td>
                                        <td className="px-6 py-4 text-right font-black text-slate-700">{stats.totalSpent?.toLocaleString()} ₫</td>
                                        <td className="px-6 py-4 text-center">
                                            <span className={`text-[10px] font-black px-2 py-1 rounded-lg ${stats.aiScore >= 70 ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}`}>{stats.aiScore}/100</span>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            {stats.riskLevel === 'HIGH' ? <span className="text-red-500 font-black text-[10px] uppercase">CAO</span> : <span className="text-green-500 font-black text-[10px] uppercase">THẤP</span>}
                                        </td>
                                        <td className="px-8 py-4 text-right" onClick={e=>e.stopPropagation()}>
                                            <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button onClick={() => setViewingPartner360(p)} className="p-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors"><Eye size={16}/></button>
                                                <button onClick={() => { setEditingPartner(p); setNewPartner(p); setShowAddPartner(true); }} className="p-2 bg-gray-50 text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"><Edit3 size={16}/></button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
      )}

      {/* MODAL: PARTNER 360 */}
      {viewingPartner360 && (
          <Partner360Modal 
            partner={viewingPartner360}
            transactions={transactions}
            projects={projects}
            onClose={() => setViewingPartner360(null)}
            onUpdatePartner={handleUpdatePartnerFromModal}
          />
      )}

      {/* MODAL: PRICE HISTORY CHART */}
      {selectedHistoryItem && (
          <div className="fixed inset-0 z-[100] bg-slate-900/70 backdrop-blur-md flex items-center justify-center p-6 animate-in fade-in">
              <div className="bg-white rounded-[40px] shadow-2xl w-full max-w-4xl overflow-hidden animate-in zoom-in duration-300 border border-slate-100 flex flex-col max-h-[90vh]">
                  <div className="px-10 py-8 bg-slate-50/50 flex justify-between items-center border-b border-slate-100">
                      <div>
                          <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tighter flex items-center"><BarChart2 className="mr-3 text-indigo-600"/> Biến động giá thị trường</h3>
                          <p className="text-slate-500 font-bold uppercase text-xs mt-1 tracking-widest">{selectedHistoryItem.name}</p>
                      </div>
                      <button onClick={() => setSelectedHistoryItem(null)} className="p-3 hover:bg-slate-200 rounded-full transition-colors"><X size={24}/></button>
                  </div>
                  
                  <div className="p-10 flex-1 overflow-y-auto custom-scrollbar">
                      <div className="h-64 mb-10">
                          <ResponsiveContainer width="100%" height="100%">
                              <LineChart data={selectedHistoryItem.history}>
                                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                  <XAxis dataKey="date" hide />
                                  <YAxis hide domain={['auto', 'auto']} />
                                  <ChartTooltip 
                                    formatter={(val: any) => [val.toLocaleString() + ' ₫', 'Đơn giá']}
                                    labelFormatter={(label) => `Ngày: ${new Date(label).toLocaleDateString('vi-VN')}`}
                                    contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontWeight: 'bold' }}
                                  />
                                  <Line type="monotone" dataKey="price" stroke="#4f46e5" strokeWidth={4} dot={{ r: 6, fill: '#4f46e5', strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 8 }} />
                              </LineChart>
                          </ResponsiveContainer>
                      </div>
                  </div>
              </div>
          </div>
      )}

      {/* MODAL: ADD/EDIT PARTNER */}
      {showAddPartner && (
          <div className="fixed inset-0 z-[160] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
              <div className="bg-white rounded-[40px] shadow-2xl w-full max-w-3xl overflow-hidden animate-in zoom-in duration-300">
                  <div className="px-10 py-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                      <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tighter flex items-center">
                          {editingPartner ? <Edit3 className="mr-3 text-indigo-600"/> : <UserPlus className="mr-3 text-indigo-600"/>}
                          {editingPartner ? 'Sửa thông tin đối tác' : 'Thêm Nhà Cung Cấp Mới'}
                      </h3>
                      <button onClick={()=>setShowAddPartner(false)} className="p-3 hover:bg-slate-200 rounded-full transition-colors"><X size={24}/></button>
                  </div>

                  <div className="p-10 max-h-[70vh] overflow-y-auto custom-scrollbar">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                          <div className="space-y-6">
                              <h4 className="text-[10px] font-black text-indigo-600 uppercase tracking-widest border-b border-indigo-100 pb-2 flex items-center"><Info size={14} className="mr-1"/> Thông tin định danh</h4>
                              <div>
                                  <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 tracking-widest">Tên công ty / Nhà cung cấp *</label>
                                  <input className="w-full border-2 border-slate-100 p-4 rounded-2xl focus:border-indigo-500 outline-none font-black text-slate-800 bg-white" value={newPartner.name} onChange={e=>setNewPartner({...newPartner, name: e.target.value})} placeholder="VD: Công ty TNHH ABC" />
                              </div>
                              <div className="grid grid-cols-2 gap-4">
                                  <div>
                                      <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 tracking-widest">Mã số thuế</label>
                                      <input className="w-full border-2 border-slate-100 p-4 rounded-2xl focus:border-indigo-500 outline-none font-mono font-bold" value={newPartner.taxCode} onChange={e=>setNewPartner({...newPartner, taxCode: e.target.value})} placeholder="010xxxxxx" />
                                  </div>
                                  <div>
                                      <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 tracking-widest">Điện thoại</label>
                                      <input className="w-full border-2 border-slate-100 p-4 rounded-2xl focus:border-indigo-500 outline-none font-black" value={newPartner.phone} onChange={e=>setNewPartner({...newPartner, phone: e.target.value})} placeholder="09xxxxxxx" />
                                  </div>
                              </div>
                              <div>
                                  <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 tracking-widest">Địa chỉ trụ sở chính</label>
                                  <div className="relative">
                                      <MapPin size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"/>
                                      <input className="w-full border-2 border-slate-100 pl-12 p-4 rounded-2xl focus:border-indigo-500 outline-none text-sm font-bold text-slate-700" value={newPartner.address} onChange={e=>setNewPartner({...newPartner, address: e.target.value})} />
                                  </div>
                              </div>
                          </div>

                          <div className="space-y-6">
                              <h4 className="text-[10px] font-black text-indigo-600 uppercase tracking-widest border-b border-indigo-100 pb-2 flex items-center"><CreditCard size={14} className="mr-1"/> Tài khoản & Lĩnh vực</h4>
                              <div>
                                  <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 tracking-widest">Số tài khoản ngân hàng</label>
                                  <input className="w-full border-2 border-slate-100 p-4 rounded-2xl focus:border-indigo-500 outline-none font-mono font-black text-lg text-indigo-700" value={newPartner.bankAccountNumber} onChange={e=>setNewPartner({...newPartner, bankAccountNumber: e.target.value})} placeholder="Vàng 24 số..." />
                              </div>
                              <div>
                                  <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 tracking-widest">Tên ngân hàng</label>
                                  <input className="w-full border-2 border-slate-100 p-4 rounded-2xl focus:border-indigo-500 outline-none text-sm uppercase font-black" value={newPartner.bankName} onChange={e=>setNewPartner({...newPartner, bankName: e.target.value})} placeholder="VD: VIETCOMBANK..." />
                              </div>
                              <div>
                                  <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 tracking-widest">Chi nhánh</label>
                                  <input className="w-full border-2 border-slate-100 p-4 rounded-2xl focus:border-indigo-500 outline-none text-sm font-bold" value={newPartner.bankBranch} onChange={e=>setNewPartner({...newPartner, bankBranch: e.target.value})} placeholder="Chi nhánh..." />
                              </div>
                              <div>
                                  <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 tracking-widest">Phân loại</label>
                                  <select className="w-full border-2 border-slate-100 p-4 rounded-2xl focus:border-indigo-500 outline-none bg-white font-bold" value={newPartner.type} onChange={e=>setNewPartner({...newPartner, type: e.target.value as any})}>
                                      <option value="SUPPLIER">Nhà cung cấp Vật tư</option>
                                      <option value="LABOR">Tổ đội Thi công</option>
                                      <option value="BOTH">Cả hai</option>
                                  </select>
                              </div>
                          </div>
                      </div>
                  </div>

                  <div className="px-10 py-8 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
                      <button onClick={()=>setShowAddPartner(false)} className="px-8 py-4 text-slate-400 font-black uppercase text-[11px] tracking-widest hover:text-slate-600 transition-colors">Hủy bỏ</button>
                      <button onClick={handleSavePartner} className="px-12 py-4 bg-indigo-600 text-white rounded-2xl font-black shadow-xl shadow-indigo-200 hover:bg-indigo-700 transition-all active:scale-95 uppercase text-[11px] tracking-widest">
                          {editingPartner ? 'CẬP NHẬT THÔNG TIN' : 'LƯU NHÀ CUNG CẤP'}
                      </button>
                  </div>
              </div>
          </div>
      )}

      {/* EXCEL IMPORT MODAL */}
      {showExcelImport && (
          <ExcelImportModal 
            type="PARTNER"
            onImport={(data) => {
                const newPartners: Partner[] = data.map((d: any) => ({
                    id: `pt_imp_${Date.now()}_${Math.random()}`,
                    code: d.code || `IMP-${Date.now()}`,
                    name: d.name,
                    phone: d.phone,
                    type: PartnerType.SUPPLIER,
                    status: 'ACTIVE' as const
                }));
                // In real app, batch create. Here mimic.
                const updated = [...newPartners, ...partners];
                localStorage.setItem('finance_partners', JSON.stringify(updated));
                setPartners(updated);
                alert(`Đã nhập thành công ${newPartners.length} đối tác.`);
            }}
            onClose={() => setShowExcelImport(false)}
          />
      )}

      {isProcessorOpen && <DocumentProcessor partners={partners} onClose={() => setIsProcessorOpen(false)} onCommitSuccess={() => { loadData(); }} />}
    </div>
  );
};

export default SupplierPriceManager;
