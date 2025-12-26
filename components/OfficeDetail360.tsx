
import React, { useState, useEffect } from 'react';
import { Office, Transaction, CashAccount, TransactionType, TransactionStatus } from '../types';
import { generateStoreIntelligence } from '../services/geminiService';
import { 
    X, Brain, AlertTriangle, TrendingUp, Calendar, ShoppingCart, 
    Zap, Loader2, ArrowUpRight, ArrowDownLeft, ShieldAlert, LineChart, Building2, Wallet, Package, List, Bell, CreditCard
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

interface OfficeDetail360Props {
    office: Office;
    transactions: Transaction[];
    accounts: CashAccount[];
    onClose: () => void;
}

const OfficeDetail360: React.FC<OfficeDetail360Props> = ({ office, transactions, accounts, onClose }) => {
    const [activeTab, setActiveTab] = useState<'DASHBOARD' | 'CASHFLOW' | 'ASSETS' | 'AI'>('DASHBOARD');
    const [aiData, setAiData] = useState<any>(null);
    const [isAiLoading, setIsAiLoading] = useState(false);

    // Filter relevant transactions
    const officeTrans = transactions.filter(t => 
        t.costCenterId === office.id || 
        (t.scope !== 'PROJECT' && t.projectId === office.id)
    );

    const loadAiData = async () => {
        setIsAiLoading(true);
        try {
            const result = await generateStoreIntelligence(office, officeTrans);
            setAiData(result);
        } catch (error) {
            console.error(error);
        } finally {
            setIsAiLoading(false);
        }
    };

    // Calculate Financials
    const income = officeTrans.filter(t => t.type === TransactionType.INCOME && t.status === TransactionStatus.PAID).reduce((s,t) => s + t.amount, 0);
    const expense = officeTrans.filter(t => t.type === TransactionType.EXPENSE && t.status === TransactionStatus.PAID).reduce((s,t) => s + t.amount, 0);
    
    // Fund Balance
    let fundBalance = 0;
    let linkedAccountName = 'Chưa gán';
    if (office.defaultCashAccountId) {
        const acc = accounts.find(a => a.id === office.defaultCashAccountId);
        if (acc) {
            linkedAccountName = acc.bankName + ' - ' + acc.accountName;
            const accTrans = transactions.filter(t => t.targetAccountId === acc.id && t.status === TransactionStatus.PAID);
            const flow = accTrans.reduce((sum, t) => sum + (t.type === TransactionType.INCOME ? t.amount : -t.amount), 0);
            
            // INCLUDE INITIAL BALANCE
            fundBalance = (acc.initialBalance || 0) + flow;
        }
    }

    // FIXED EXPENSES CALCULATION
    const fixedExpenseKeywords = ['thuê', 'nhà', 'điện', 'nước', 'internet', 'lương', 'bảo vệ', 'vệ sinh'];
    const fixedExpenses = officeTrans.filter(t => 
        t.type === TransactionType.EXPENSE && 
        fixedExpenseKeywords.some(k => t.category.toLowerCase().includes(k) || t.description.toLowerCase().includes(k))
    );
    const totalFixedCost = fixedExpenses.reduce((s,t) => s + t.amount, 0);

    return (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-900/80 backdrop-blur-sm p-4 animate-in zoom-in duration-300">
            <div className="bg-[#fcfdfe] rounded-[40px] shadow-2xl w-full max-w-7xl h-[94vh] flex flex-col overflow-hidden border border-white/20">
                {/* Header */}
                <div className="px-10 py-8 bg-white border-b border-slate-100 flex justify-between items-center shrink-0">
                    <div className="flex items-center gap-4">
                        <div className="bg-gradient-to-br from-violet-600 to-indigo-600 p-3 rounded-2xl text-white shadow-lg shadow-indigo-200">
                            <Building2 size={32}/>
                        </div>
                        <div>
                            <div className="flex items-center gap-3">
                                <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tighter">{office.name}</h2>
                                <span className="bg-slate-100 text-slate-600 px-2 py-1 rounded text-xs font-bold border border-slate-200">{office.code}</span>
                            </div>
                            <p className="text-sm text-slate-500 font-bold mt-1">Office & Store 360° View</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-3 hover:bg-slate-100 rounded-full transition-colors"><X size={24} className="text-slate-400"/></button>
                </div>

                {/* Tabs */}
                <div className="px-10 border-b border-slate-100 bg-white flex gap-8">
                    {[
                        { id: 'DASHBOARD', label: 'Tổng quan', icon: TrendingUp },
                        { id: 'CASHFLOW', label: 'Sổ Thu Chi', icon: Wallet },
                        { id: 'ASSETS', label: 'Tài sản & Mua sắm', icon: Package },
                        { id: 'AI', label: 'AI Intelligence', icon: Brain },
                    ].map(tab => (
                        <button 
                            key={tab.id}
                            onClick={() => { setActiveTab(tab.id as any); if(tab.id === 'AI' && !aiData) loadAiData(); }}
                            className={`flex items-center py-4 text-xs font-black uppercase tracking-widest border-b-4 transition-all ${activeTab === tab.id ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
                        >
                            <tab.icon size={16} className="mr-2"/> {tab.label}
                        </button>
                    ))}
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto p-10 bg-slate-50/50 custom-scrollbar">
                    
                    {/* DASHBOARD TAB */}
                    {activeTab === 'DASHBOARD' && (
                        <div className="space-y-8 animate-in fade-in">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <div className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm flex flex-col justify-between">
                                    <div>
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 flex items-center">
                                            <CreditCard size={12} className="mr-1"/> Quỹ tiền: {linkedAccountName}
                                        </p>
                                        <h3 className={`text-3xl font-black ${fundBalance >= 0 ? 'text-indigo-600' : 'text-red-600'}`}>{fundBalance.toLocaleString()} ₫</h3>
                                    </div>
                                    <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mt-4"><Wallet size={24}/></div>
                                </div>
                                <div className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm flex flex-col justify-between">
                                    <div>
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Tổng Doanh thu</p>
                                        <h3 className="text-3xl font-black text-emerald-600">{income.toLocaleString()} ₫</h3>
                                    </div>
                                    <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center mt-4"><ArrowDownLeft size={24}/></div>
                                </div>
                                <div className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm flex flex-col justify-between">
                                    <div>
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Tổng Chi phí</p>
                                        <h3 className="text-3xl font-black text-rose-600">{expense.toLocaleString()} ₫</h3>
                                    </div>
                                    <div className="w-12 h-12 bg-rose-50 text-rose-600 rounded-2xl flex items-center justify-center mt-4"><ArrowUpRight size={24}/></div>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                                {/* Fixed Cost Analysis */}
                                <div className="lg:col-span-1 bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm">
                                    <h4 className="font-black text-slate-800 text-sm uppercase tracking-widest mb-4 flex items-center">
                                        <List size={16} className="mr-2 text-indigo-600"/> Chi phí cố định & Định kỳ
                                    </h4>
                                    <div className="mb-6">
                                        <p className="text-xs text-slate-500 mb-1">Tổng chi cố định (Điện, Nước, Lương...)</p>
                                        <p className="text-xl font-black text-slate-800">{totalFixedCost.toLocaleString()} ₫</p>
                                        <div className="w-full bg-slate-100 h-1.5 rounded-full mt-2 overflow-hidden">
                                            <div className="bg-orange-500 h-full" style={{width: `${expense > 0 ? (totalFixedCost/expense)*100 : 0}%`}}></div>
                                        </div>
                                        <p className="text-[9px] text-slate-400 mt-1 text-right">{expense > 0 ? ((totalFixedCost/expense)*100).toFixed(1) : 0}% tổng chi</p>
                                    </div>
                                    
                                    <div className="space-y-3">
                                        <h5 className="text-[10px] font-bold text-slate-400 uppercase border-b border-slate-50 pb-1">Nhắc nhở thanh toán</h5>
                                        <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
                                            <Bell size={16} className="text-indigo-500"/>
                                            <div>
                                                <p className="text-xs font-bold text-slate-700">Tiền nhà / Mặt bằng</p>
                                                <p className="text-[10px] text-slate-400">Định kỳ: Mùng 5 hàng tháng</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
                                            <Bell size={16} className="text-indigo-500"/>
                                            <div>
                                                <p className="text-xs font-bold text-slate-700">Internet / Điện thoại</p>
                                                <p className="text-[10px] text-slate-400">Định kỳ: Ngày 15 hàng tháng</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Recent Transactions Preview */}
                                <div className="lg:col-span-2 bg-white rounded-[32px] border border-slate-100 shadow-sm overflow-hidden flex flex-col">
                                    <div className="px-8 py-5 border-b border-slate-50 font-bold text-slate-800 text-sm">Giao dịch gần nhất</div>
                                    <div className="flex-1 overflow-auto custom-scrollbar">
                                        <table className="w-full text-sm text-left">
                                            <tbody className="divide-y divide-slate-50">
                                                {officeTrans.slice(0, 5).map(t => (
                                                    <tr key={t.id}>
                                                        <td className="px-8 py-4 text-xs text-slate-500">{new Date(t.date).toLocaleDateString('vi-VN')}</td>
                                                        <td className="px-8 py-4 font-bold text-slate-700">{t.description}</td>
                                                        <td className={`px-8 py-4 font-black text-right ${t.type === 'INCOME' ? 'text-emerald-600' : 'text-rose-600'}`}>
                                                            {t.type === 'INCOME' ? '+' : '-'}{t.amount.toLocaleString()} ₫
                                                        </td>
                                                    </tr>
                                                ))}
                                                {officeTrans.length === 0 && <tr><td colSpan={3} className="text-center py-10 text-slate-400 italic">Chưa có giao dịch.</td></tr>}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* CASHFLOW TAB */}
                    {activeTab === 'CASHFLOW' && (
                        <div className="bg-white rounded-[32px] border border-slate-100 shadow-sm overflow-hidden animate-in fade-in">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-slate-50 text-slate-400 font-black uppercase text-[10px] tracking-widest border-b border-slate-100">
                                    <tr>
                                        <th className="px-8 py-5">Ngày</th>
                                        <th className="px-8 py-5">Nội dung / Diễn giải</th>
                                        <th className="px-8 py-5">Hạng mục</th>
                                        <th className="px-8 py-5 text-right">Số tiền</th>
                                        <th className="px-8 py-5 text-center">Trạng thái</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {officeTrans.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map(t => (
                                        <tr key={t.id} className="hover:bg-slate-50 transition-colors">
                                            <td className="px-8 py-4 text-slate-500 font-mono text-xs">{new Date(t.date).toLocaleDateString('vi-VN')}</td>
                                            <td className="px-8 py-4 font-bold text-slate-900">{t.description}</td>
                                            <td className="px-8 py-4 text-xs font-bold text-slate-500 bg-slate-50 px-2 py-1 rounded w-fit">{t.category}</td>
                                            <td className={`px-8 py-4 text-right font-black ${t.type === TransactionType.INCOME ? 'text-emerald-600' : 'text-rose-600'}`}>{t.amount.toLocaleString()} ₫</td>
                                            <td className="px-8 py-4 text-center">
                                                <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase ${t.status === 'PAID' ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>{t.status}</span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {/* AI ANALYTICS TAB */}
                    {activeTab === 'AI' && (
                        <div className="space-y-8 animate-in fade-in">
                            {isAiLoading ? (
                                <div className="text-center py-20">
                                    <Loader2 size={48} className="animate-spin mx-auto text-indigo-600 mb-4"/>
                                    <p className="text-slate-500 font-bold">AI đang phân tích dữ liệu...</p>
                                </div>
                            ) : aiData ? (
                                <>
                                    <div className="bg-gradient-to-r from-indigo-900 to-violet-900 rounded-[32px] p-8 text-white shadow-xl relative overflow-hidden">
                                        <div className="relative z-10 flex gap-6 items-start">
                                            <div className="p-4 bg-white/10 rounded-2xl backdrop-blur-sm"><Zap size={32} className="text-yellow-400"/></div>
                                            <div>
                                                <h3 className="text-lg font-black uppercase tracking-widest text-indigo-300 mb-2">Lời khuyên chiến lược (AI CEO)</h3>
                                                <p className="text-xl font-medium leading-relaxed opacity-95">"{aiData.strategicAdvice}"</p>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                                        <div className="bg-white p-8 rounded-[32px] border border-slate-100 shadow-sm">
                                            <h3 className="font-black text-slate-800 uppercase tracking-tight mb-6 flex items-center gap-2">
                                                <ShoppingCart size={20} className="text-emerald-600"/> Dự báo & Hàng hóa
                                            </h3>
                                            <div className="space-y-4">
                                                {aiData.salesForecast?.map((item: any, idx: number) => (
                                                    <div key={idx} className="flex flex-col p-4 bg-slate-50 rounded-2xl border border-slate-100">
                                                        <div className="flex justify-between font-bold text-slate-800 text-sm mb-1">
                                                            <span>{item.productName}</span>
                                                            <span className="text-indigo-600">Restock: {item.suggestedRestock}</span>
                                                        </div>
                                                        <p className="text-xs text-slate-500 italic">{item.reason}</p>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>

                                        <div className="bg-white p-8 rounded-[32px] border border-slate-100 shadow-sm">
                                            <h3 className="font-black text-slate-800 uppercase tracking-tight mb-6 flex items-center gap-2">
                                                <ShieldAlert size={20} className="text-rose-500"/> Cảnh báo bất thường
                                            </h3>
                                            <div className="space-y-4">
                                                {aiData.anomalies?.map((alert: any, idx: number) => (
                                                    <div key={idx} className="p-4 rounded-2xl border bg-rose-50 border-rose-100">
                                                        <h4 className="font-bold text-sm text-rose-700 mb-1">{alert.title}</h4>
                                                        <p className="text-xs text-slate-600">{alert.description}</p>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                </>
                            ) : (
                                <div className="text-center py-20 text-slate-400 italic">Không thể tải dữ liệu phân tích.</div>
                            )}
                        </div>
                    )}

                    {/* ASSETS TAB (Placeholder for future dev) */}
                    {activeTab === 'ASSETS' && (
                        <div className="text-center py-20 bg-white rounded-[32px] border border-slate-100 border-dashed">
                            <Package size={48} className="mx-auto text-slate-300 mb-4"/>
                            <p className="text-slate-500 font-bold">Chức năng Quản lý Tài sản đang được phát triển.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default OfficeDetail360;
