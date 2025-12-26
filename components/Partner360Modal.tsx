
import React, { useState, useMemo } from 'react';
import { Partner, Transaction, Project, PartnerPerformance, PartnerType } from '../types';
import { analyzePartner } from '../services/partnerAnalysisService';
import { 
    X, Building2, Phone, MapPin, Star, AlertTriangle, ShieldCheck, 
    TrendingUp, History, Briefcase, FileText, CheckCircle, Package, Clock,
    CreditCard, ExternalLink, Activity
} from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

interface Partner360ModalProps {
    partner: Partner;
    transactions: Transaction[];
    projects: Project[];
    onClose: () => void;
    onUpdatePartner: (p: Partner) => void;
}

const Partner360Modal: React.FC<Partner360ModalProps> = ({ partner, transactions, projects, onClose, onUpdatePartner }) => {
    const [activeTab, setActiveTab] = useState<'OVERVIEW' | 'HISTORY' | 'PROJECTS' | 'REVIEWS'>('OVERVIEW');
    
    // Real-time Analysis
    const stats: PartnerPerformance = useMemo(() => analyzePartner(partner, transactions), [partner, transactions]);
    
    // Filtered Data
    const historyTrans = useMemo(() => 
        transactions
            .filter(t => t.partnerId === partner.id)
            .sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    , [transactions, partner.id]);

    const participatedProjects = useMemo(() => {
        const projectIds = new Set(historyTrans.map(t => t.projectId));
        return projects.filter(p => projectIds.has(p.id));
    }, [historyTrans, projects]);

    const handleRating = (stars: number) => {
        const updated = { ...partner, rating: stars };
        onUpdatePartner(updated);
    };

    const renderScoreBadge = (score: number) => {
        let color = 'bg-gray-100 text-gray-600';
        let label = 'Chưa xếp hạng';
        if (score >= 80) { color = 'bg-indigo-100 text-indigo-700'; label = 'Hạng A (Xuất sắc)'; }
        else if (score >= 60) { color = 'bg-blue-100 text-blue-700'; label = 'Hạng B (Tốt)'; }
        else if (score >= 40) { color = 'bg-yellow-100 text-yellow-700'; label = 'Hạng C (Trung bình)'; }
        else if (score > 0) { color = 'bg-red-100 text-red-700'; label = 'Hạng D (Yếu)'; }
        
        return <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide ${color}`}>{label}</span>;
    };

    return (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-900/70 backdrop-blur-sm p-4 animate-in zoom-in duration-200">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-5xl h-[90vh] flex flex-col overflow-hidden">
                
                {/* HEADER */}
                <div className="bg-slate-50 px-8 py-6 border-b border-slate-100 flex justify-between items-start">
                    <div className="flex gap-5">
                        <div className="w-16 h-16 bg-white rounded-2xl border border-slate-200 flex items-center justify-center shadow-sm text-3xl font-black text-indigo-600">
                            {partner.name.charAt(0)}
                        </div>
                        <div>
                            <div className="flex items-center gap-3 mb-1">
                                <h2 className="text-2xl font-black text-slate-900">{partner.name}</h2>
                                {renderScoreBadge(stats.aiScore)}
                                {stats.riskLevel === 'HIGH' && (
                                    <span className="px-3 py-1 rounded-full text-xs font-bold bg-red-600 text-white flex items-center shadow-sm">
                                        <AlertTriangle size={12} className="mr-1"/> CẢNH BÁO RỦI RO
                                    </span>
                                )}
                            </div>
                            <div className="flex flex-wrap gap-4 text-sm text-slate-500">
                                <div className="flex items-center"><Building2 size={14} className="mr-1"/> {partner.type === 'SUPPLIER' ? 'Nhà cung cấp' : 'Tổ đội thi công'}</div>
                                <div className="flex items-center"><Phone size={14} className="mr-1"/> {partner.phone || 'N/A'}</div>
                                <div className="flex items-center"><MapPin size={14} className="mr-1"/> {partner.address || 'N/A'}</div>
                            </div>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors"><X size={24} className="text-slate-400"/></button>
                </div>

                {/* TABS */}
                <div className="px-8 border-b border-slate-100 flex gap-8">
                    {[
                        { id: 'OVERVIEW', label: 'Tổng Quan 360°', icon: Activity },
                        { id: 'HISTORY', label: 'Lịch Sử Giao Dịch', icon: History },
                        { id: 'PROJECTS', label: 'Công Trình Đã Làm', icon: Briefcase },
                        { id: 'REVIEWS', label: 'Đánh Giá & Nhận Xét', icon: Star },
                    ].map(tab => (
                        <button 
                            key={tab.id} 
                            onClick={() => setActiveTab(tab.id as any)}
                            className={`py-4 text-sm font-bold flex items-center border-b-2 transition-all ${activeTab === tab.id ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
                        >
                            <tab.icon size={16} className="mr-2"/> {tab.label}
                        </button>
                    ))}
                </div>

                {/* CONTENT */}
                <div className="flex-1 overflow-y-auto p-8 bg-slate-50/50">
                    
                    {/* OVERVIEW TAB */}
                    {activeTab === 'OVERVIEW' && (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-in fade-in">
                            {/* Left: Key Metrics */}
                            <div className="md:col-span-2 space-y-6">
                                <div className="grid grid-cols-3 gap-4">
                                    <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
                                        <p className="text-xs font-bold text-slate-400 uppercase mb-1">Tổng chi tiêu</p>
                                        <p className="text-2xl font-black text-indigo-600">{(stats.totalSpent || 0).toLocaleString()} ₫</p>
                                    </div>
                                    <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
                                        <p className="text-xs font-bold text-slate-400 uppercase mb-1">Số giao dịch</p>
                                        <p className="text-2xl font-black text-slate-800">{stats.transactionCount}</p>
                                    </div>
                                    <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
                                        <p className="text-xs font-bold text-slate-400 uppercase mb-1">Số công trình</p>
                                        <p className="text-2xl font-black text-slate-800">{stats.projectCount}</p>
                                    </div>
                                </div>

                                <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
                                    <h3 className="font-bold text-slate-800 mb-4 flex items-center"><ShieldCheck size={20} className="mr-2 text-green-600"/> Phân tích Điểm mạnh & Rủi ro (AI)</h3>
                                    <div className="grid grid-cols-2 gap-6">
                                        <div>
                                            <h4 className="text-xs font-bold text-green-700 uppercase mb-3 bg-green-50 px-2 py-1 rounded inline-block">Điểm mạnh</h4>
                                            {stats.strengths.length > 0 ? (
                                                <ul className="space-y-2">
                                                    {stats.strengths.map((s, i) => (
                                                        <li key={i} className="flex items-start text-sm text-slate-700">
                                                            <CheckCircle size={16} className="mr-2 text-green-500 flex-shrink-0 mt-0.5"/> {s}
                                                        </li>
                                                    ))}
                                                </ul>
                                            ) : <p className="text-sm text-slate-400 italic">Chưa đủ dữ liệu phân tích.</p>}
                                        </div>
                                        <div>
                                            <h4 className="text-xs font-bold text-red-700 uppercase mb-3 bg-red-50 px-2 py-1 rounded inline-block">Rủi ro / Cảnh báo</h4>
                                            {stats.weaknesses.length > 0 ? (
                                                <ul className="space-y-2">
                                                    {stats.weaknesses.map((w, i) => (
                                                        <li key={i} className="flex items-start text-sm text-slate-700">
                                                            <AlertTriangle size={16} className="mr-2 text-red-500 flex-shrink-0 mt-0.5"/> {w}
                                                        </li>
                                                    ))}
                                                </ul>
                                            ) : <p className="text-sm text-green-600 italic flex items-center"><CheckCircle size={14} className="mr-1"/> Không phát hiện rủi ro.</p>}
                                        </div>
                                    </div>
                                </div>

                                {/* BANK INFO CARD */}
                                <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
                                    <h3 className="font-bold text-slate-800 mb-4 flex items-center"><CreditCard size={20} className="mr-2 text-indigo-600"/> Thông tin thanh toán</h3>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div>
                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Số tài khoản</p>
                                            <p className="text-lg font-black text-slate-900 font-mono tracking-wider">{partner.bankAccountNumber || '---'}</p>
                                        </div>
                                        <div>
                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Ngân hàng & Chi nhánh</p>
                                            <p className="text-sm font-bold text-slate-700 uppercase">{partner.bankName || '---'}</p>
                                            <p className="text-xs text-slate-500 mt-0.5">{partner.bankBranch || 'Chưa cập nhật chi nhánh'}</p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Right: Insights */}
                            <div className="space-y-6">
                                <div className="bg-indigo-600 text-white p-6 rounded-2xl shadow-lg relative overflow-hidden">
                                    <div className="relative z-10">
                                        <h3 className="font-bold text-lg mb-2">Điểm Tín Nhiệm AI</h3>
                                        <div className="text-5xl font-black mb-2">{stats.aiScore}/100</div>
                                        <p className="text-indigo-200 text-xs">Cập nhật realtime dựa trên tần suất, giá trị và đánh giá.</p>
                                    </div>
                                    <div className="absolute right-0 bottom-0 text-white opacity-10 -mr-6 -mb-6">
                                        <ShieldCheck size={120} />
                                    </div>
                                </div>

                                <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
                                    <h4 className="font-bold text-slate-700 text-sm mb-3">Top Hạng mục cung cấp</h4>
                                    <div className="flex flex-wrap gap-2">
                                        {stats.topCategories && stats.topCategories.length > 0 ? (
                                            stats.topCategories.map((c, i) => (
                                                <span key={i} className="px-3 py-1.5 bg-slate-100 text-slate-600 rounded-lg text-xs font-bold border border-slate-200">
                                                    {c}
                                                </span>
                                            ))
                                        ) : (
                                            <span className="text-xs text-slate-400">Chưa có dữ liệu</span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* HISTORY TAB */}
                    {activeTab === 'HISTORY' && (
                        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden animate-in fade-in">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-xs">
                                    <tr>
                                        <th className="px-6 py-4">Ngày</th>
                                        <th className="px-6 py-4">Nội dung / Mặt hàng</th>
                                        <th className="px-6 py-4">Dự án</th>
                                        <th className="px-6 py-4 text-right">Giá trị</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {historyTrans.map(t => (
                                        <tr key={t.id} className="hover:bg-slate-50">
                                            <td className="px-6 py-4 text-slate-500">{new Date(t.date).toLocaleDateString('vi-VN')}</td>
                                            <td className="px-6 py-4 font-medium text-slate-900">{t.description}</td>
                                            <td className="px-6 py-4">
                                                <span className="bg-indigo-50 text-indigo-700 px-2 py-1 rounded text-xs font-bold">
                                                    {projects.find(p=>p.id===t.projectId)?.code || '---'}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-right font-mono font-bold text-slate-700">{t.amount.toLocaleString()} ₫</td>
                                        </tr>
                                    ))}
                                    {historyTrans.length === 0 && <tr><td colSpan={4} className="p-8 text-center text-slate-400">Chưa có giao dịch.</td></tr>}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {/* PROJECTS TAB */}
                    {activeTab === 'PROJECTS' && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in">
                            {participatedProjects.map(p => (
                                <div key={p.id} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all">
                                    <div className="flex justify-between items-start mb-4">
                                        <div>
                                            <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded mb-2 inline-block">{p.code}</span>
                                            <h3 className="font-bold text-slate-900">{p.name}</h3>
                                        </div>
                                        <span className={`px-2 py-1 rounded-full text-xs font-bold ${p.status === 'ACTIVE' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600'}`}>
                                            {p.status}
                                        </span>
                                    </div>
                                    <div className="pt-4 border-t border-slate-100 text-sm text-slate-500">
                                        Tổng giao dịch tại dự án này: <span className="font-bold text-slate-900">{historyTrans.filter(t=>t.projectId === p.id).length}</span> phiếu
                                    </div>
                                </div>
                            ))}
                            {participatedProjects.length === 0 && <div className="col-span-2 text-center text-slate-400 py-10">Chưa tham gia dự án nào.</div>}
                        </div>
                    )}

                    {/* REVIEWS TAB */}
                    {activeTab === 'REVIEWS' && (
                        <div className="max-w-2xl mx-auto bg-white p-8 rounded-3xl border border-slate-200 shadow-sm animate-in fade-in">
                            <div className="text-center mb-8">
                                <h3 className="font-bold text-slate-900 mb-2">Đánh giá uy tín NCC</h3>
                                <p className="text-slate-500 text-sm mb-6">Đánh giá của bạn giúp AI đề xuất chính xác hơn trong tương lai.</p>
                                
                                <div className="flex justify-center gap-2 mb-4">
                                    {[1, 2, 3, 4, 5].map(star => (
                                        <button 
                                            key={star} 
                                            onClick={() => handleRating(star)}
                                            className={`p-2 transition-transform hover:scale-110 ${star <= (partner.rating || 0) ? 'text-yellow-400 fill-yellow-400' : 'text-slate-200'}`}
                                        >
                                            <Star size={32} fill={star <= (partner.rating || 0) ? "currentColor" : "none"} />
                                        </button>
                                    ))}
                                </div>
                                <p className="text-sm font-bold text-slate-700">
                                    {partner.rating ? `Đã đánh giá: ${partner.rating}/5 sao` : 'Chưa có đánh giá'}
                                </p>
                            </div>

                            <div className="bg-slate-50 p-6 rounded-2xl">
                                <h4 className="font-bold text-slate-800 text-sm mb-3">Lịch sử nhận xét (System)</h4>
                                <div className="space-y-4">
                                    {/* Mock Reviews - In real app, fetch from backend */}
                                    <div className="bg-white p-4 rounded-xl border border-slate-100">
                                        <div className="flex justify-between items-center mb-2">
                                            <span className="font-bold text-xs text-indigo-600">Hệ thống AI</span>
                                            <span className="text-[10px] text-slate-400">{new Date().toLocaleDateString('vi-VN')}</span>
                                        </div>
                                        <p className="text-sm text-slate-600">
                                            Đối tác này có tần suất giao dịch ổn định. Giá trung bình thấp hơn 5% so với thị trường trong 3 tháng qua.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                </div>
            </div>
        </div>
    );
};

export default Partner360Modal;
