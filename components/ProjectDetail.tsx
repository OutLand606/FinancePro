
import React, { useState } from 'react';
import { Project, Transaction, Contract, TransactionType, TransactionStatus, InvoiceType } from '../types';
import { calculateProjectCostKpi } from '../services/taxKpiService';
import { calculateContractStatus } from '../utils/contractUtils';
import { X, ArrowUpRight, ArrowDownLeft, Wallet, Users, FileText, AlertTriangle, CheckCircle, PieChart as PieIcon, Paperclip, ExternalLink, TrendingUp } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';

interface ProjectDetailProps {
  project: Project;
  transactions: Transaction[];
  contracts: Contract[];
  onClose: () => void;
}

const ProjectDetail: React.FC<ProjectDetailProps> = ({ project, transactions, contracts, onClose }) => {
  const [activeTab, setActiveTab] = useState<'OVERVIEW' | 'COST_KPI' | 'DOCS'>('OVERVIEW');

  // Logic Preparation
  const projTrans = transactions.filter(t => t.projectId === project.id);
  const totalIncome = projTrans.filter(t => t.type === TransactionType.INCOME).reduce((sum, t) => sum + t.amount, 0);
  const totalExpense = projTrans.filter(t => t.type === TransactionType.EXPENSE).reduce((sum, t) => sum + t.amount, 0);
  const kpi = calculateProjectCostKpi(project, transactions, contracts);

  // AR Calculation
  // 1. Receivables from Revenue Contracts
  const revenueContracts = contracts.filter(c => c.projectId === project.id && c.type === 'REVENUE');
  let contractReceivable = 0;
  revenueContracts.forEach(c => {
      const status = calculateContractStatus(c, transactions);
      contractReceivable += status.receivable || 0;
  });

  // 2. If no contracts, check Project Total Value vs Total Income
  // Fallback: If no specific revenue contracts, assume Project Value - Total Income is the AR
  let finalReceivable = contractReceivable;
  if (revenueContracts.length === 0 && project.contractTotalValue) {
      finalReceivable = Math.max(0, project.contractTotalValue - totalIncome);
  }

  const costDistribution = [
    { name: 'Vật tư', value: kpi.materialCost },
    { name: 'Nhân công', value: kpi.laborCost },
    { name: 'Khác', value: totalExpense - kpi.materialCost - kpi.laborCost }
  ];
  const COLORS = ['#3b82f6', '#f59e0b', '#9ca3af'];

  // Render Functions
  const renderOverview = () => (
    <div className="space-y-6 animate-in fade-in">
       {/* Financial Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
                <p className="text-sm text-gray-500 mb-1 flex items-center"><ArrowDownLeft size={16} className="mr-1 text-green-500"/> Thực Thu (PAID)</p>
                <p className="text-2xl font-bold text-green-600">{totalIncome.toLocaleString('vi-VN')} ₫</p>
            </div>
            <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
                <p className="text-sm text-gray-500 mb-1 flex items-center"><ArrowUpRight size={16} className="mr-1 text-red-500"/> Thực Chi (PAID)</p>
                <p className="text-2xl font-bold text-red-600">{totalExpense.toLocaleString('vi-VN')} ₫</p>
            </div>
            <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
                <p className="text-sm text-gray-500 mb-1 flex items-center"><Wallet size={16} className="mr-1 text-blue-500"/> Lợi Nhuận Tạm Tính</p>
                <p className={`text-2xl font-bold ${totalIncome - totalExpense >= 0 ? 'text-blue-600' : 'text-orange-600'}`}>
                    {(totalIncome - totalExpense).toLocaleString('vi-VN')} ₫
                </p>
            </div>
            {/* AR CARD */}
            <div className="bg-orange-50 p-5 rounded-xl border border-orange-200 shadow-sm">
                <p className="text-sm text-orange-800 mb-1 flex items-center"><TrendingUp size={16} className="mr-1 text-orange-600"/> Phải Thu (AR)</p>
                <p className="text-2xl font-bold text-orange-700">{finalReceivable.toLocaleString('vi-VN')} ₫</p>
                {revenueContracts.length === 0 && project.contractTotalValue && (
                    <p className="text-[10px] text-orange-600 mt-1 italic">*Tạm tính theo giá trị công trình</p>
                )}
            </div>
        </div>

        {/* Recent Activity */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100 bg-gray-50 font-bold text-gray-800">
                Giao dịch gần nhất
            </div>
            <table className="w-full text-sm text-left">
                <tbody className="divide-y divide-gray-100">
                    {projTrans.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 5).map(t => (
                        <tr key={t.id} className="hover:bg-gray-50">
                            <td className="px-4 py-3 text-gray-600">{new Date(t.date).toLocaleDateString('vi-VN')}</td>
                            <td className="px-4 py-3 font-medium">{t.description}</td>
                            <td className={`px-4 py-3 text-right font-bold ${t.type === TransactionType.INCOME ? 'text-green-600' : 'text-red-600'}`}>
                                {t.type === TransactionType.INCOME ? '+' : '-'}{t.amount.toLocaleString('vi-VN')}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    </div>
  );

  const renderCostKpi = () => (
    <div className="space-y-6 animate-in fade-in">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* KPI Progress Bars */}
            <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                <h3 className="font-bold text-gray-800 mb-4">Chỉ số Chi phí / Giá trị HĐ</h3>
                
                <div className="mb-6">
                    <div className="flex justify-between text-sm mb-1">
                        <span className="text-gray-600 font-medium">Vật Tư (Materials)</span>
                        <span className="font-bold text-blue-600">{kpi.materialRatio.toFixed(1)}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2.5">
                        <div className="bg-blue-600 h-2.5 rounded-full" style={{width: `${Math.min(kpi.materialRatio, 100)}%`}}></div>
                    </div>
                    <p className="text-xs text-gray-400 mt-1">Chi phí: {kpi.materialCost.toLocaleString('vi-VN')} ₫</p>
                </div>

                <div>
                    <div className="flex justify-between text-sm mb-1">
                        <span className="text-gray-600 font-medium">Nhân Công (Labor)</span>
                        <span className="font-bold text-orange-500">{kpi.laborRatio.toFixed(1)}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2.5">
                        <div className="bg-orange-500 h-2.5 rounded-full" style={{width: `${Math.min(kpi.laborRatio, 100)}%`}}></div>
                    </div>
                    <p className="text-xs text-gray-400 mt-1">Chi phí: {kpi.laborCost.toLocaleString('vi-VN')} ₫</p>
                </div>

                {kpi.warnings.length > 0 && (
                    <div className="mt-6 bg-red-50 p-4 rounded-lg border border-red-100">
                        <h4 className="text-sm font-bold text-red-700 flex items-center mb-2">
                            <AlertTriangle size={16} className="mr-2" /> Cảnh báo vượt định mức
                        </h4>
                        <ul className="list-disc list-inside text-xs text-red-600 space-y-1">
                            {kpi.warnings.map((w, i) => <li key={i}>{w}</li>)}
                        </ul>
                    </div>
                )}
            </div>

            {/* Cost Distribution Chart */}
            <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm flex flex-col items-center">
                <h3 className="font-bold text-gray-800 mb-2 w-full text-left">Phân bổ Chi phí</h3>
                <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <Pie
                                data={costDistribution}
                                cx="50%"
                                cy="50%"
                                innerRadius={60}
                                outerRadius={80}
                                paddingAngle={5}
                                dataKey="value"
                            >
                                {costDistribution.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                ))}
                            </Pie>
                            <Tooltip formatter={(val: number) => val.toLocaleString('vi-VN')} />
                            <Legend />
                        </PieChart>
                    </ResponsiveContainer>
                </div>
            </div>
        </div>
    </div>
  );

  const renderDocs = () => {
      // Filter transactions with attachments
      const docsTrans = projTrans.filter(t => t.attachments && t.attachments.length > 0);
      return (
        <div className="animate-in fade-in">
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <table className="w-full text-sm text-left">
                    <thead className="bg-gray-50 text-gray-600">
                        <tr>
                            <th className="px-6 py-3">Ngày</th>
                            <th className="px-6 py-3">Giao dịch</th>
                            <th className="px-6 py-3">File đính kèm</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {docsTrans.length === 0 ? (
                            <tr><td colSpan={3} className="px-6 py-8 text-center text-gray-500">Chưa có chứng từ nào được upload.</td></tr>
                        ) : (
                            docsTrans.map(t => (
                                <tr key={t.id} className="hover:bg-gray-50">
                                    <td className="px-6 py-4 align-top text-gray-500">{new Date(t.date).toLocaleDateString('vi-VN')}</td>
                                    <td className="px-6 py-4 align-top">
                                        <div className="font-medium text-gray-900">{t.description}</div>
                                        <div className="text-xs text-gray-400 mt-1">{t.amount.toLocaleString('vi-VN')} ₫</div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex flex-wrap gap-2">
                                            {t.attachments.map((att, i) => (
                                                <a 
                                                    key={i} 
                                                    href={att.url} 
                                                    target="_blank" 
                                                    rel="noreferrer"
                                                    className="inline-flex items-center px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-xs hover:bg-blue-100 transition-colors"
                                                >
                                                    <Paperclip size={12} className="mr-1" /> {att.name.slice(0, 15)}...
                                                </a>
                                            ))}
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
      );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in duration-200">
        <div className="bg-white rounded-xl shadow-2xl w-full max-w-6xl h-[90vh] flex flex-col overflow-hidden">
            {/* Header */}
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-slate-50">
                <div>
                    <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-mono font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-100">{project.code}</span>
                        <span className="text-xs font-semibold px-2 py-0.5 rounded bg-gray-200 text-gray-700">{project.projectLevel || 'N/A'}</span>
                    </div>
                    <h2 className="text-xl font-bold text-gray-900">{project.name}</h2>
                </div>
                <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full"><X size={24} className="text-gray-500" /></button>
            </div>

            {/* Tabs */}
            <div className="px-6 border-b border-gray-100 bg-white flex space-x-6">
                <button 
                    onClick={() => setActiveTab('OVERVIEW')}
                    className={`py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'OVERVIEW' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                >
                    Tổng quan
                </button>
                <button 
                    onClick={() => setActiveTab('COST_KPI')}
                    className={`py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'COST_KPI' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                >
                    Chi Phí & KPI
                </button>
                <button 
                    onClick={() => setActiveTab('DOCS')}
                    className={`py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'DOCS' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                >
                    Hồ sơ & Chứng từ
                </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-6 bg-gray-50/50">
                {activeTab === 'OVERVIEW' && renderOverview()}
                {activeTab === 'COST_KPI' && renderCostKpi()}
                {activeTab === 'DOCS' && renderDocs()}
            </div>
        </div>
    </div>
  );
};

export default ProjectDetail;
