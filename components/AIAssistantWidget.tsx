
import React, { useState, useEffect } from 'react';
import { Bot, Sparkles, X, ChevronRight, AlertTriangle, CheckCircle, Brain, RefreshCw } from 'lucide-react';
import { generateSmartAssistantInsights } from '../services/geminiService';
import { Transaction } from '../types';

interface AIAssistantWidgetProps {
    role: 'ACCOUNTANT' | 'DIRECTOR';
    transactions: Transaction[];
    className?: string;
}

const AIAssistantWidget: React.FC<AIAssistantWidgetProps> = ({ role, transactions, className }) => {
    const [isOpen, setIsOpen] = useState(false); // Default closed to be "small and cute"
    const [data, setData] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(false);

    const handleAnalyze = async () => {
        setIsLoading(true);
        try {
            const result = await generateSmartAssistantInsights(role, transactions);
            setData(result);
            setIsOpen(true);
        } finally {
            setIsLoading(false);
        }
    };

    // Auto-analyze once on mount if data exists
    useEffect(() => {
        if (transactions.length > 0 && !data) {
            // Delay slightly to not block UI load
            const timer = setTimeout(() => handleAnalyze(), 1000);
            return () => clearTimeout(timer);
        }
    }, [transactions.length]);

    if (!isOpen && !isLoading) {
        return (
            <div className={`fixed bottom-6 right-6 z-50 ${className}`}>
                <button 
                    onClick={() => setIsOpen(true)}
                    className="bg-white p-3 rounded-full shadow-xl border-2 border-indigo-100 text-indigo-600 hover:scale-110 transition-transform flex items-center gap-2 group"
                >
                    <div className="relative">
                        <Bot size={28} />
                        <span className="absolute top-0 right-0 w-3 h-3 bg-emerald-500 rounded-full border-2 border-white animate-pulse"></span>
                    </div>
                    <span className="max-w-0 overflow-hidden group-hover:max-w-xs transition-all duration-500 whitespace-nowrap font-bold text-sm">
                        AI Assistant
                    </span>
                </button>
            </div>
        );
    }

    return (
        <div className={`fixed bottom-6 right-6 z-50 w-80 bg-white rounded-2xl shadow-2xl border border-indigo-100 flex flex-col overflow-hidden transition-all duration-300 ${isOpen ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10 pointer-events-none'}`}>
            {/* Header */}
            <div className="bg-gradient-to-r from-indigo-600 to-violet-600 p-4 flex justify-between items-center text-white">
                <div className="flex items-center gap-2">
                    <Sparkles size={18} className="text-yellow-300"/>
                    <h3 className="font-bold text-sm">{role === 'DIRECTOR' ? 'Giám đốc Ảo (CFO)' : 'Trợ lý Kế toán'}</h3>
                </div>
                <div className="flex gap-2">
                    <button onClick={handleAnalyze} className="p-1 hover:bg-white/20 rounded"><RefreshCw size={14}/></button>
                    <button onClick={() => setIsOpen(false)} className="p-1 hover:bg-white/20 rounded"><X size={14}/></button>
                </div>
            </div>

            {/* Content */}
            <div className="p-4 max-h-[400px] overflow-y-auto custom-scrollbar bg-slate-50/50">
                {isLoading ? (
                    <div className="flex flex-col items-center justify-center py-8 text-indigo-400">
                        <Brain size={32} className="animate-bounce mb-2"/>
                        <p className="text-xs font-bold animate-pulse">Đang suy nghĩ...</p>
                    </div>
                ) : data ? (
                    <div className="space-y-4">
                        {/* Forecast Bubble */}
                        <div className="bg-indigo-50 p-3 rounded-xl border border-indigo-100 text-xs text-indigo-800 italic">
                            "{data.forecast?.message}"
                        </div>

                        {/* Tasks List */}
                        {data.tasks?.length > 0 && (
                            <div>
                                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center">
                                    <CheckCircle size={12} className="mr-1"/> Việc cần làm
                                </h4>
                                <div className="space-y-2">
                                    {data.tasks.map((task: any, idx: number) => (
                                        <div key={idx} className="bg-white p-2.5 rounded-xl border border-slate-100 shadow-sm flex gap-3 items-start">
                                            <div className={`mt-0.5 w-1.5 h-1.5 rounded-full shrink-0 ${task.type === 'WARNING' ? 'bg-red-500' : 'bg-blue-500'}`}></div>
                                            <div>
                                                <p className="text-xs font-bold text-slate-800">{task.title}</p>
                                                <p className="text-[10px] text-slate-500 leading-tight mt-0.5">{task.desc}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Insights List */}
                        {data.insights?.length > 0 && (
                            <div>
                                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center">
                                    <AlertTriangle size={12} className="mr-1"/> Điểm nóng
                                </h4>
                                <div className="space-y-2">
                                    {data.insights.map((insight: any, idx: number) => (
                                        <div key={idx} className="bg-white p-2.5 rounded-xl border border-slate-100 shadow-sm flex justify-between items-center">
                                            <span className="text-xs font-medium text-slate-700">{insight.title}</span>
                                            <span className={`text-xs font-black ${insight.trend === 'UP' ? 'text-emerald-600' : insight.trend === 'DOWN' ? 'text-rose-600' : 'text-slate-600'}`}>
                                                {insight.value}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                ) : (
                    <p className="text-center text-xs text-slate-400 py-4">Chưa có dữ liệu phân tích.</p>
                )}
            </div>
        </div>
    );
};

export default AIAssistantWidget;
