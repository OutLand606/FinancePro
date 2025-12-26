
import React, { useState, useEffect } from 'react';
import { Office, Transaction } from '../types';
import { generateStoreIntelligence } from '../services/geminiService';
import { 
    X, Brain, AlertTriangle, TrendingUp, Calendar, ShoppingCart, 
    Zap, Loader2, Package, ArrowRight, ShieldAlert, LineChart
} from 'lucide-react';

interface OfficeAnalyticsModalProps {
    office: Office;
    transactions: Transaction[];
    onClose: () => void;
}

const OfficeAnalyticsModal: React.FC<OfficeAnalyticsModalProps> = ({ office, transactions, onClose }) => {
    const [isLoading, setIsLoading] = useState(true);
    const [data, setData] = useState<any>(null);

    useEffect(() => {
        const analyze = async () => {
            try {
                // Filter transactions relevant to this office
                const relevantTrans = transactions.filter(t => 
                    t.costCenterId === office.id || 
                    (t.scope !== 'PROJECT' && t.projectId === office.id)
                );
                
                const result = await generateStoreIntelligence(office, relevantTrans);
                setData(result);
            } catch (error) {
                console.error("Analytics Error", error);
            } finally {
                setIsLoading(false);
            }
        };
        analyze();
    }, [office, transactions]);

    if (isLoading) {
        return (
            <div className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-slate-900/90 backdrop-blur-sm p-4 text-white">
                <div className="bg-white/10 p-6 rounded-full mb-6 relative">
                    <Brain size={64} className="animate-pulse text-indigo-400"/>
                    <div className="absolute inset-0 border-4 border-indigo-500/30 rounded-full animate-spin border-t-indigo-400"></div>
                </div>
                <h2 className="text-2xl font-black mb-2">AI Đang Học Dữ Liệu...</h2>
                <p className="text-indigo-200 text-center max-w-md">
                    Đang phân tích {transactions.length} giao dịch để tìm quy luật kinh doanh, dự báo dòng tiền và phát hiện rủi ro tiềm ẩn.
                </p>
            </div>
        );
    }

    if (!data) return null;

    return (
        <div className="fixed inset-0 z-[150] flex items-center justify-center bg-slate-900/80 backdrop-blur-sm p-4 animate-in zoom-in duration-300">
            <div className="bg-[#fcfdfe] rounded-[40px] shadow-2xl w-full max-w-6xl h-[90vh] flex flex-col overflow-hidden border border-white/20">
                {/* Header */}
                <div className="px-10 py-8 bg-white border-b border-slate-100 flex justify-between items-center shrink-0">
                    <div className="flex items-center gap-4">
                        <div className="bg-gradient-to-br from-violet-600 to-indigo-600 p-3 rounded-2xl text-white shadow-lg shadow-indigo-200">
                            <Brain size={32}/>
                        </div>
                        <div>
                            <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tighter">Office & Store 360° Intelligence</h2>
                            <p className="text-sm text-slate-500 font-bold">Báo cáo quản trị thông minh cho: <span className="text-indigo-600">{office.name}</span></p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-3 hover:bg-slate-100 rounded-full transition-colors"><X size={24} className="text-slate-400"/></button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto p-10 bg-slate-50/50 custom-scrollbar">
                    
                    {/* 1. STRATEGIC ADVICE (HERO SECTION) */}
                    <div className="bg-gradient-to-r from-indigo-900 to-violet-900 rounded-[32px] p-8 text-white shadow-xl mb-8 relative overflow-hidden">
                        <div className="relative z-10 flex gap-6 items-start">
                            <div className="p-4 bg-white/10 rounded-2xl backdrop-blur-sm"><Zap size={32} className="text-yellow-400"/></div>
                            <div>
                                <h3 className="text-lg font-black uppercase tracking-widest text-indigo-300 mb-2">Lời khuyên chiến lược (AI CEO)</h3>
                                <p className="text-xl font-medium leading-relaxed opacity-95">"{data.strategicAdvice}"</p>
                            </div>
                        </div>
                        <div className="absolute right-0 bottom-0 opacity-10 pointer-events-none"><LineChart size={300}/></div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        
                        {/* 2. ANOMALIES & RISKS */}
                        <div className="lg:col-span-1 space-y-6">
                            <div className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm h-full">
                                <h3 className="font-black text-slate-800 uppercase tracking-tight mb-6 flex items-center gap-2">
                                    <ShieldAlert size={20} className="text-rose-500"/> Cảnh báo bất thường
                                </h3>
                                <div className="space-y-4">
                                    {data.anomalies?.length > 0 ? data.anomalies.map((alert: any, idx: number) => (
                                        <div key={idx} className={`p-4 rounded-2xl border ${alert.severity === 'HIGH' ? 'bg-rose-50 border-rose-100' : 'bg-orange-50 border-orange-100'}`}>
                                            <div className="flex justify-between items-start mb-2">
                                                <h4 className={`font-bold text-sm ${alert.severity === 'HIGH' ? 'text-rose-700' : 'text-orange-700'}`}>{alert.title}</h4>
                                                {alert.severity === 'HIGH' && <AlertTriangle size={16} className="text-rose-600"/>}
                                            </div>
                                            <p className="text-xs text-slate-600 leading-relaxed">{alert.description}</p>
                                        </div>
                                    )) : (
                                        <div className="text-center py-10 text-slate-400 italic text-sm">Hệ thống vận hành ổn định. Không phát hiện bất thường lớn.</div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* 3. SALES & INVENTORY INTELLIGENCE */}
                        <div className="lg:col-span-2 space-y-6">
                            <div className="bg-white p-8 rounded-[32px] border border-slate-100 shadow-sm">
                                <div className="flex justify-between items-center mb-6">
                                    <h3 className="font-black text-slate-800 uppercase tracking-tight flex items-center gap-2">
                                        <ShoppingCart size={20} className="text-emerald-600"/> Dự báo Bán hàng & Nhập kho
                                    </h3>
                                    <span className="bg-emerald-100 text-emerald-700 px-3 py-1 rounded-full text-[10px] font-black uppercase">Top Sellers</span>
                                </div>
                                
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                                    {data.topSellingItems?.map((item: string, idx: number) => (
                                        <div key={idx} className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
                                            <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center font-black text-emerald-600 shadow-sm">{idx + 1}</div>
                                            <span className="font-bold text-slate-700 text-sm">{item}</span>
                                        </div>
                                    ))}
                                </div>

                                <div className="border-t border-slate-100 pt-6">
                                    <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">Gợi ý nhập hàng (Restock)</h4>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        {data.salesForecast?.map((item: any, idx: number) => (
                                            <div key={idx} className="flex flex-col p-4 bg-indigo-50/50 rounded-2xl border border-indigo-100 hover:border-indigo-300 transition-colors">
                                                <div className="flex justify-between items-start mb-2">
                                                    <span className="font-bold text-indigo-900 text-sm line-clamp-1">{item.productName}</span>
                                                    {item.trend === 'UP' && <TrendingUp size={16} className="text-emerald-500"/>}
                                                </div>
                                                <div className="flex items-end justify-between mt-auto">
                                                    <div>
                                                        <p className="text-[10px] text-slate-500">Nên nhập thêm</p>
                                                        <p className="text-xl font-black text-indigo-600">{item.suggestedRestock || '---'}</p>
                                                    </div>
                                                    <div className="text-right max-w-[120px]">
                                                        <p className="text-[9px] text-slate-400 leading-tight italic text-right">{item.reason}</p>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* 4. CASH FLOW FORECAST */}
                            <div className="bg-white p-8 rounded-[32px] border border-slate-100 shadow-sm">
                                <h3 className="font-black text-slate-800 uppercase tracking-tight mb-6 flex items-center gap-2">
                                    <Calendar size={20} className="text-blue-600"/> Dự báo Chu kỳ Chi tiền
                                </h3>
                                <div className="space-y-3">
                                    {data.cashFlowForecast?.map((item: any, idx: number) => (
                                        <div key={idx} className="flex items-center justify-between p-4 hover:bg-slate-50 rounded-2xl border border-transparent hover:border-slate-100 transition-all group">
                                            <div className="flex items-center gap-4">
                                                <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-xl flex flex-col items-center justify-center font-bold shadow-sm">
                                                    <span className="text-[10px] uppercase">{new Date(item.date).toLocaleString('en-US', {month: 'short'})}</span>
                                                    <span className="text-lg leading-none">{new Date(item.date).getDate()}</span>
                                                </div>
                                                <div>
                                                    <p className="font-bold text-slate-800">{item.description}</p>
                                                    <p className="text-xs text-slate-400 font-medium">Dự báo độ tin cậy: <span className="text-emerald-600">{item.confidence}</span></p>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-sm font-black text-slate-700">~ {item.amount.toLocaleString()} ₫</p>
                                                <p className="text-[10px] text-blue-500 font-bold uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity">Chuẩn bị tiền</p>
                                            </div>
                                        </div>
                                    ))}
                                    {(!data.cashFlowForecast || data.cashFlowForecast.length === 0) && (
                                        <p className="text-center text-slate-400 italic text-sm">Chưa đủ dữ liệu chu kỳ để dự báo.</p>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default OfficeAnalyticsModal;
