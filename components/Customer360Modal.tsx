
import React, { useState, useMemo, useEffect } from 'react';
import { Partner, Transaction, Project, Contract, TransactionType, TransactionStatus, ContractType, PartnerPerformance } from '../types';
import { analyzePartner } from '../services/partnerAnalysisService';
import { generatePartnerInsight } from '../services/geminiService'; // New real AI service
import { 
    X, Phone, MapPin, Building2, Wallet, FileText, Briefcase, TrendingUp, AlertCircle, ArrowUpRight, ArrowDownLeft, Clock, 
    Activity, ShieldCheck, AlertTriangle, CheckCircle, Mail, User, Plus, Sparkles, Brain, MessagesSquare, Lightbulb, Calculator,
    Send, Zap, Copy, Loader2
} from 'lucide-react';
import { calculateContractStatus } from '../utils/contractUtils';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';

interface Customer360ModalProps {
    customer: Partner;
    projects: Project[];
    transactions: Transaction[];
    contracts: Contract[];
    onClose: () => void;
}

const Customer360Modal: React.FC<Customer360ModalProps> = ({ customer, projects, transactions, contracts, onClose }) => {
    const [activeTab, setActiveTab] = useState<'OVERVIEW' | 'PROJECTS' | 'CONTRACTS' | 'TRANSACTIONS'>('OVERVIEW');
    const [showAiAction, setShowAiAction] = useState(false);
    const [aiActionContent, setAiActionContent] = useState('');
    
    // AI State
    const [aiInsight, setAiInsight] = useState('');
    const [isAiLoading, setIsAiLoading] = useState(false);

    // --- DATA CALCULATION ---
    const stats: PartnerPerformance = useMemo(() => {
        if (!customer) return {} as PartnerPerformance; 
        return analyzePartner(customer, transactions || [], projects || [], contracts || []);
    }, [customer, transactions, projects, contracts]);
    
    const customerTransactions = useMemo(() => (transactions || []).filter(t => t.partnerId === customer.id), [transactions, customer.id]);
    const customerProjects = useMemo(() => (projects || []).filter(p => p.customerId === customer.id), [projects, customer]);
    const customerContracts = useMemo(() => (contracts || []).filter(c => c.partnerId === customer.id && c.type === ContractType.REVENUE), [contracts, customer.id]);

    // Financial Chart Data (Mock prediction for now based on average)
    const financialChartData = useMemo(() => {
        const data = [
            { name: 'Đã thu', value: stats.totalRevenue || 0, fill: '#10b981' },
            { name: 'Công nợ', value: stats.totalDebt || 0, fill: '#f97316' },
            // Forecasting simple: avg contract value
            { name: 'Dự kiến', value: (stats.totalRevenue || 0) + (stats.totalDebt || 0), fill: '#6366f1' }, 
        ];
        return data;
    }, [stats]);

    // REAL AI CALL
    useEffect(() => {
        const fetchAiInsight = async () => {
            setIsAiLoading(true);
            try {
                // Call real Gemini API
                const insight = await generatePartnerInsight(customer, stats);
                setAiInsight(insight);
            } catch (e) {
                console.error(e);
                setAiInsight("Không thể kết nối với AI Analyst. Vui lòng kiểm tra API Key.");
            } finally {
                setIsAiLoading(false);
            }
        };

        if (customer && activeTab === 'OVERVIEW') {
            fetchAiInsight();
        }
    }, [customer, activeTab, stats]);

    const handleGenerateReminder = () => {
        const debt = stats.totalDebt || 0;
        const msg = `Kính gửi Quý khách hàng ${customer.name},\n\nHệ thống ghi nhận khoản công nợ chưa thanh toán là ${debt.toLocaleString()} VNĐ.\nKính mong Quý khách sắp xếp thanh toán trước ngày 30/12.\n\nTrân trọng.`;
        setAiActionContent(msg);
        setShowAiAction(true);
    };

    if (!customer) return null;

    const displayName = customer.name || 'Không tên';
    const avatarChar = displayName.charAt(0)?.toUpperCase() || '?';

    return (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-900/80 backdrop-blur-sm p-4 animate-in zoom-in duration-200">
            <div className="bg-[#fcfdfe] rounded-[40px] shadow-2xl w-full max-w-7xl h-[94vh] flex flex-col overflow-hidden border border-white/20 relative">
                
                {/* 1. HEADER BRANDING */}
                <div className="bg-white px-10 py-8 border-b border-slate-100 flex justify-between items-start shrink-0 z-10 shadow-sm">
                    <div className="flex gap-6">
                        <div className="w-20 h-20 bg-slate-50 rounded-[24px] border-2 border-white shadow-xl flex items-center justify-center text-4xl font-black text-indigo-600 shrink-0 relative overflow-hidden">
                            {avatarChar}
                            <div className="absolute inset-0 bg-gradient-to-tr from-white/0 to-white/40"></div>
                        </div>
                        <div>
                            <div className="flex items-center gap-3 mb-2">
                                <h2 className="text-3xl font-black text-slate-900 tracking-tighter leading-none">{displayName}</h2>
                                <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wide border ${stats.riskLevel === 'HIGH' ? 'bg-rose-50 text-rose-600 border-rose-100' : 'bg-emerald-50 text-emerald-600 border-emerald-100'}`}>
                                    {stats.riskLevel === 'HIGH' ? 'Cảnh báo Rủi ro' : 'Tín nhiệm Tốt'}
                                </span>
                            </div>
                            <div className="flex flex-wrap gap-6 text-xs font-bold text-slate-500 uppercase tracking-widest items-center">
                                <div className="flex items-center"><Building2 size={14} className="mr-1.5 text-indigo-400"/> {customer.taxCode || 'MST: ---'}</div>
                                <div className="flex items-center"><Phone size={14} className="mr-1.5 text-indigo-400"/> {customer.phone || 'N/A'}</div>
                                {customer.email && <div className="flex items-center lowercase font-medium text-slate-400"><Mail size={14} className="mr-1.5 text-indigo-400"/> {customer.email}</div>}
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <button className="flex items-center px-6 py-3 bg-indigo-50 text-indigo-600 rounded-2xl text-[11px] font-black uppercase tracking-widest hover:bg-indigo-100 transition-all"><MessagesSquare size={16} className="mr-2"/> Gửi tin nhắn</button>
                        <button onClick={onClose} className="p-3 hover:bg-slate-100 rounded-full transition-colors"><X size={24} className="text-slate-400"/></button>
                    </div>
                </div>

                {/* 2. NAVIGATION */}
                <div className="px-10 border-b border-slate-100 flex gap-8 shrink-0 bg-white">
                    {[
                        { id: 'OVERVIEW', label: 'Tổng Quan & AI', icon: Activity },
                        { id: 'PROJECTS', label: `Dự Án (${customerProjects.length})`, icon: Briefcase },
                        { id: 'CONTRACTS', label: `Hợp Đồng (${customerContracts.length})`, icon: FileText },
                        { id: 'TRANSACTIONS', label: 'Sổ Giao Dịch', icon: Clock },
                    ].map(tab => (
                        <button 
                            key={tab.id} 
                            onClick={() => setActiveTab(tab.id as any)}
                            className={`py-5 text-xs font-black uppercase tracking-widest flex items-center border-b-4 transition-all ${activeTab === tab.id ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
                        >
                            <tab.icon size={16} className="mr-2"/> {tab.label}
                        </button>
                    ))}
                </div>

                {/* 3. MAIN CONTENT SCROLLABLE AREA */}
                <div className="flex-1 overflow-y-auto p-10 bg-[#f8fafc] custom-scrollbar">
                    
                    {/* OVERVIEW TAB: BENTO GRID */}
                    {activeTab === 'OVERVIEW' && (
                        <div className="grid grid-cols-1 md:grid-cols-4 grid-rows-2 gap-6 h-full min-h-[600px] animate-in fade-in">
                            
                            {/* CARD 1: AI ADVISOR (Large) */}
                            <div className="md:col-span-2 md:row-span-1 bg-gradient-to-br from-indigo-600 to-violet-700 rounded-[32px] p-8 text-white relative overflow-hidden shadow-xl flex flex-col justify-between group">
                                <div className="relative z-10">
                                    <div className="flex items-center gap-3 mb-4">
                                        <div className="p-2 bg-white/10 rounded-xl backdrop-blur-md"><Brain size={24} className="text-white"/></div>
                                        <h3 className="font-black text-lg uppercase tracking-tight">AI Advisor Insight</h3>
                                    </div>
                                    <div className="min-h-[80px]">
                                        {isAiLoading ? (
                                            <div className="flex items-center space-x-2 text-indigo-200 animate-pulse">
                                                <Loader2 size={18} className="animate-spin"/>
                                                <span>Đang phân tích dữ liệu tài chính...</span>
                                            </div>
                                        ) : (
                                            <p className="text-indigo-100 text-lg font-medium leading-relaxed">
                                                "{aiInsight}"
                                            </p>
                                        )}
                                    </div>
                                </div>
                                <div className="relative z-10 flex gap-3 mt-6">
                                    {(stats.totalDebt || 0) > 0 && (
                                        <button onClick={handleGenerateReminder} className="bg-white text-rose-600 px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-rose-50 transition-all shadow-lg flex items-center">
                                            <Zap size={14} className="mr-2"/> Tạo nhắc nợ tự động
                                        </button>
                                    )}
                                    <button className="bg-white/20 text-white px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-white/30 transition-all flex items-center">
                                        <Sparkles size={14} className="mr-2"/> Chiến lược tiếp cận
                                    </button>
                                </div>
                                <div className="absolute -right-10 -bottom-10 opacity-20 rotate-12 group-hover:scale-110 transition-transform duration-700">
                                    <Lightbulb size={200} />
                                </div>
                            </div>

                            {/* CARD 2: FINANCIAL HEALTH (Score) */}
                            <div className="md:col-span-1 md:row-span-1 bg-white rounded-[32px] p-6 border border-slate-100 shadow-sm flex flex-col items-center justify-center relative overflow-hidden">
                                <h3 className="font-black text-slate-400 text-xs uppercase tracking-widest mb-4 absolute top-6 left-6">Sức khỏe tài chính</h3>
                                <div className="relative w-40 h-40 flex items-center justify-center">
                                    <svg className="w-full h-full transform -rotate-90">
                                        <circle cx="80" cy="80" r="70" stroke="currentColor" strokeWidth="15" fill="transparent" className="text-slate-100" />
                                        <circle cx="80" cy="80" r="70" stroke="currentColor" strokeWidth="15" fill="transparent" strokeDasharray={440} strokeDashoffset={440 - (440 * stats.aiScore) / 100} className={`${stats.aiScore >= 80 ? 'text-emerald-500' : stats.aiScore >= 50 ? 'text-blue-500' : 'text-rose-500'} transition-all duration-1000`} strokeLinecap="round" />
                                    </svg>
                                    <div className="absolute flex flex-col items-center">
                                        <span className="text-4xl font-black text-slate-800">{stats.aiScore}</span>
                                        <span className="text-[10px] font-bold text-slate-400 uppercase">/ 100 điểm</span>
                                    </div>
                                </div>
                                <p className="text-xs font-bold text-center mt-2 text-slate-500">{stats.riskLevel === 'HIGH' ? 'Cảnh báo rủi ro' : 'Uy tín tốt'}</p>
                            </div>

                            {/* CARD 3: CASHFLOW METRICS */}
                            <div className="md:col-span-1 md:row-span-2 bg-white rounded-[32px] p-6 border border-slate-100 shadow-sm flex flex-col">
                                <h3 className="font-black text-slate-800 text-sm uppercase tracking-widest mb-6 flex items-center gap-2">
                                    <Wallet size={16} className="text-emerald-500"/> Dòng tiền
                                </h3>
                                <div className="space-y-6 flex-1">
                                    <div>
                                        <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Tổng thực thu</p>
                                        <p className="text-2xl font-black text-emerald-600">{(stats.totalRevenue || 0).toLocaleString()} ₫</p>
                                    </div>
                                    <div className="w-full h-px bg-slate-100"></div>
                                    <div>
                                        <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Công nợ hiện tại</p>
                                        <p className="text-2xl font-black text-orange-600">{(stats.totalDebt || 0).toLocaleString()} ₫</p>
                                        <p className="text-[10px] text-slate-400 mt-1">Chiếm {stats.debtRatio?.toFixed(0)}% tổng giá trị</p>
                                    </div>
                                    <div className="w-full h-px bg-slate-100"></div>
                                    <div>
                                        <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Dự án Active</p>
                                        <p className="text-2xl font-black text-indigo-600">{stats.projectCount}</p>
                                    </div>
                                </div>
                                <button className="mt-4 w-full py-3 bg-slate-50 text-slate-600 rounded-xl text-xs font-black uppercase hover:bg-slate-100 transition-colors">Xem chi tiết nợ</button>
                            </div>

                            {/* CARD 4: FORECAST CHART */}
                            <div className="md:col-span-3 md:row-span-1 bg-white rounded-[32px] p-8 border border-slate-100 shadow-sm flex flex-col">
                                <div className="flex justify-between items-center mb-6">
                                    <h3 className="font-black text-slate-800 text-sm uppercase tracking-widest flex items-center gap-2">
                                        <Calculator size={16} className="text-blue-500"/> Phân tích & Dự báo Tài chính
                                    </h3>
                                </div>
                                <div className="flex-1 min-h-[200px]">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart layout="vertical" data={financialChartData} barSize={20}>
                                            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9"/>
                                            <XAxis type="number" hide />
                                            <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{fontSize: 12, fontWeight: 'bold', fill: '#64748b'}} width={80}/>
                                            <Tooltip 
                                                cursor={{fill: '#f8fafc'}}
                                                contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)'}}
                                                formatter={(value: number) => value.toLocaleString() + ' ₫'}
                                            />
                                            <Bar dataKey="value" radius={[0, 10, 10, 0]} background={{ fill: '#f1f5f9', radius: [0, 10, 10, 0] }} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>

                        </div>
                    )}

                    {/* PROJECTS TAB */}
                    {activeTab === 'PROJECTS' && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in">
                            {customerProjects.map(p => (
                                <div key={p.id} className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm hover:shadow-lg hover:border-indigo-200 transition-all group cursor-pointer">
                                    <div className="flex justify-between items-start mb-4">
                                        <div>
                                            <span className="text-[10px] font-black text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full mb-2 inline-block border border-indigo-100">{p.code}</span>
                                            <h3 className="font-black text-slate-900 text-xl group-hover:text-indigo-600 transition-colors">{p.name}</h3>
                                        </div>
                                        <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase ${p.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                                            {p.status === 'ACTIVE' ? 'Đang chạy' : 'Hoàn thành'}
                                        </span>
                                    </div>
                                    <div className="pt-6 border-t border-slate-50 text-sm flex justify-between items-center">
                                        <div>
                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Giá trị HĐ</p>
                                            <p className="font-black text-slate-900 text-lg">{p.contractTotalValue?.toLocaleString()} ₫</p>
                                        </div>
                                        <button className="p-2 bg-slate-50 hover:bg-indigo-50 text-slate-400 hover:text-indigo-600 rounded-xl transition-colors"><ArrowUpRight size={20}/></button>
                                    </div>
                                </div>
                            ))}
                            {customerProjects.length === 0 && <div className="col-span-2 text-center text-slate-400 py-20 italic">Chưa có dự án nào liên kết.</div>}
                        </div>
                    )}

                    {/* TRANSACTIONS TAB */}
                    {activeTab === 'TRANSACTIONS' && (
                        <div className="bg-white rounded-[32px] border border-slate-100 shadow-sm overflow-hidden animate-in fade-in">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-slate-50 text-slate-400 font-black uppercase text-[10px] tracking-widest border-b border-slate-100">
                                    <tr>
                                        <th className="px-8 py-5">Ngày</th>
                                        <th className="px-8 py-5">Nội dung / Diễn giải</th>
                                        <th className="px-8 py-5">Loại</th>
                                        <th className="px-8 py-5 text-right">Số tiền</th>
                                        <th className="px-8 py-5 text-center">Trạng thái</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {customerTransactions.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map(t => (
                                        <tr key={t.id} className="hover:bg-slate-50/50 transition-colors">
                                            <td className="px-8 py-4 text-slate-500 font-mono text-xs">{new Date(t.date).toLocaleDateString('vi-VN')}</td>
                                            <td className="px-8 py-4 font-bold text-slate-900">{t.description}</td>
                                            <td className="px-8 py-4">
                                                {t.type === TransactionType.INCOME ? 
                                                    <span className="text-emerald-600 font-black text-[10px] uppercase flex items-center bg-emerald-50 px-2 py-1 rounded w-fit"><ArrowDownLeft size={12} className="mr-1"/> THU</span> : 
                                                    <span className="text-rose-600 font-black text-[10px] uppercase flex items-center bg-rose-50 px-2 py-1 rounded w-fit"><ArrowUpRight size={12} className="mr-1"/> HOÀN LẠI</span>
                                                }
                                            </td>
                                            <td className={`px-8 py-4 text-right font-black ${t.type === TransactionType.INCOME ? 'text-emerald-600' : 'text-rose-600'}`}>{t.amount.toLocaleString()} ₫</td>
                                            <td className="px-8 py-4 text-center">
                                                <span className={`px-2 py-1 rounded text-[10px] font-black uppercase ${t.status === 'PAID' ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>{t.status}</span>
                                            </td>
                                        </tr>
                                    ))}
                                    {customerTransactions.length === 0 && <tr><td colSpan={5} className="p-20 text-center text-slate-400 italic">Chưa có giao dịch nào.</td></tr>}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {/* CONTRACTS TAB */}
                    {activeTab === 'CONTRACTS' && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in">
                            {customerContracts.map(c => (
                                <div key={c.id} className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm flex flex-col justify-between hover:border-indigo-200 transition-all">
                                    <div>
                                        <div className="flex justify-between items-start mb-4">
                                            <span className="text-[10px] font-black text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full mb-2 inline-block border border-emerald-100">{c.code}</span>
                                            <span className={`px-2 py-1 rounded-full text-[9px] font-black uppercase ${c.status === 'SIGNED' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                                                {c.status}
                                            </span>
                                        </div>
                                        <h3 className="font-bold text-slate-900 text-lg mb-2">{c.name}</h3>
                                    </div>
                                    <div className="pt-4 border-t border-slate-50 flex justify-between items-end">
                                        <div>
                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Giá trị HĐ</p>
                                            <p className="text-2xl font-black text-slate-800">{c.value.toLocaleString()} ₫</p>
                                        </div>
                                        <button className="text-indigo-600 hover:bg-indigo-50 p-2 rounded-xl transition-colors"><FileText size={20}/></button>
                                    </div>
                                </div>
                            ))}
                            {customerContracts.length === 0 && <div className="col-span-2 text-center text-slate-400 py-20 italic">Chưa có hợp đồng nào.</div>}
                        </div>
                    )}

                </div>
                
                {/* AI ACTION OVERLAY */}
                {showAiAction && (
                    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/50 p-8 animate-in fade-in">
                        <div className="bg-white rounded-[32px] shadow-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in duration-200">
                            <div className="bg-gradient-to-r from-indigo-600 to-violet-700 px-8 py-6 text-white flex justify-between items-center">
                                <h3 className="font-black text-lg flex items-center"><Sparkles className="mr-2"/> AI Action Generator</h3>
                                <button onClick={() => setShowAiAction(false)} className="hover:bg-white/20 p-2 rounded-full"><X size={20}/></button>
                            </div>
                            <div className="p-8 space-y-4">
                                <textarea 
                                    className="w-full h-48 p-4 bg-slate-50 rounded-2xl text-sm font-medium text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500 border-none resize-none"
                                    value={aiActionContent}
                                    onChange={e => setAiActionContent(e.target.value)}
                                />
                                <div className="flex gap-3 justify-end">
                                    <button 
                                        onClick={() => { navigator.clipboard.writeText(aiActionContent); alert("Đã sao chép!"); setShowAiAction(false); }}
                                        className="bg-indigo-50 text-indigo-700 px-6 py-3 rounded-xl font-bold text-xs uppercase flex items-center hover:bg-indigo-100"
                                    >
                                        <Copy size={16} className="mr-2"/> Sao chép
                                    </button>
                                    <button className="bg-indigo-600 text-white px-6 py-3 rounded-xl font-bold text-xs uppercase flex items-center hover:bg-indigo-700 shadow-lg">
                                        <Send size={16} className="mr-2"/> Gửi ngay (Email/Zalo)
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default Customer360Modal;
