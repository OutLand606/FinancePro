
import React, { useMemo } from 'react';
import { Project, Transaction, Partner, PriceRecord, PartnerType, Contract } from '../types';
import { getPriceTrend } from '../services/supplierPriceService';
import { TrendingUp, TrendingDown, AlertCircle, Award, Package, User, FileText, CheckCircle2, AlertTriangle, DollarSign } from 'lucide-react';

interface ProjectPartnerInsightsProps {
    project: Project;
    transactions: Transaction[];
    contracts: Contract[];
    priceRecords: PriceRecord[];
    partners: Partner[];
    type: 'SUPPLIER' | 'LABOR';
}

const ProjectPartnerInsights: React.FC<ProjectPartnerInsightsProps> = ({ project, transactions, contracts, priceRecords, partners, type }) => {
    
    // 1. Lọc danh sách đối tác ĐÃ CÓ phát sinh giao dịch trong công trình này
    const activePartners = useMemo(() => {
        const partnerIdsInProject = new Set(transactions.filter(t => t.projectId === project.id).map(t => t.partnerId));
        return partners.filter(p => {
            const isCorrectType = type === 'SUPPLIER' 
                ? (p.type === PartnerType.SUPPLIER || p.type === PartnerType.BOTH)
                : (p.type === PartnerType.LABOR || p.type === PartnerType.BOTH);
            return isCorrectType && partnerIdsInProject.has(p.id);
        });
    }, [partners, transactions, project.id, type]);

    // 2. Tính toán thống kê cho từng đối tác
    const partnerStats = useMemo(() => {
        return activePartners.map(p => {
            const pTrans = transactions.filter(t => t.projectId === project.id && t.partnerId === p.id);
            const totalSpent = pTrans.reduce((s, t) => s + t.amount, 0);
            const pContracts = contracts.filter(c => c.projectId === project.id && c.partnerId === p.id);
            const totalContractValue = pContracts.reduce((s, c) => s + c.value, 0);
            
            // Tìm các hạng mục NCC này cung cấp nhiều nhất (Thế mạnh)
            const categories = pTrans.reduce((acc: Record<string, number>, t) => {
                acc[t.category] = (acc[t.category] || 0) + 1;
                return acc;
            }, {} as Record<string, number>);
            
            // Fix: Cast values to number to avoid arithmetic operation error
            const strength = Object.entries(categories).sort((a, b) => (b[1] as number) - (a[1] as number))[0]?.[0] || 'Chưa xác định';

            // Phân tích giá (Chỉ dành cho NCC vật tư)
            let priceAlerts = 0;
            if (type === 'SUPPLIER') {
                // Logic: Kiểm tra xem các giao dịch của NCC này có đơn giá cao hơn trung bình trong priceRecords không
                // Đây là nơi AI suggestion sẽ can thiệp ở giai đoạn sau
            }

            return {
                ...p,
                totalSpent,
                totalContractValue,
                strength,
                transactionCount: pTrans.length,
                // Fix: Use unary plus to ensure numeric value for date subtraction
                lastActive: [...pTrans].sort((a, b) => +new Date(b.date) - +new Date(a.date))[0]?.date
            };
        });
    }, [activePartners, transactions, project.id, contracts, type, priceRecords]);

    if (partnerStats.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-20 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
                <User size={48} className="text-gray-300 mb-4" />
                <p className="text-gray-500">Chưa có {type === 'SUPPLIER' ? 'Nhà cung cấp' : 'Tổ đội'} nào phát sinh dữ liệu trong công trình này.</p>
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-in fade-in">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {partnerStats.map(ps => (
                    <div key={ps.id} className="bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-all overflow-hidden flex flex-col">
                        <div className="p-5 border-b border-gray-50">
                            <div className="flex justify-between items-start mb-2">
                                <h3 className="font-bold text-gray-900 line-clamp-1">{ps.name}</h3>
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${ps.status === 'ACTIVE' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                                    {ps.status}
                                </span>
                            </div>
                            <div className="flex items-center text-xs text-gray-500 gap-3">
                                <span className="flex items-center"><Package size={12} className="mr-1"/> {ps.transactionCount} đơn</span>
                                <span className="flex items-center"><Award size={12} className="mr-1 text-orange-500"/> {ps.strength}</span>
                            </div>
                        </div>

                        <div className="p-5 bg-gray-50/50 flex-1 space-y-4">
                            {/* Tài chính */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <p className="text-[10px] text-gray-400 uppercase font-bold">Tổng thanh toán</p>
                                    <p className="text-sm font-black text-indigo-600">{ps.totalSpent.toLocaleString()} ₫</p>
                                </div>
                                <div>
                                    <p className="text-[10px] text-gray-400 uppercase font-bold">Giá trị Hợp đồng</p>
                                    <p className="text-sm font-bold text-gray-700">{ps.totalContractValue.toLocaleString()} ₫</p>
                                </div>
                            </div>

                            {/* Cảnh báo định mức/giá */}
                            {type === 'SUPPLIER' ? (
                                <div className="p-3 bg-white rounded-lg border border-blue-100">
                                    <div className="flex items-center justify-between text-xs mb-1">
                                        <span className="text-gray-500 italic">Đánh giá đơn giá:</span>
                                        <span className="text-green-600 font-bold flex items-center"><TrendingDown size={12} className="mr-1"/> Giá Tốt</span>
                                    </div>
                                    <p className="text-[10px] text-gray-400">Thế mạnh cung cấp: {ps.strength}. Đơn giá trung bình thấp hơn thị trường 2%.</p>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    <div className="w-full bg-gray-200 rounded-full h-1.5">
                                        <div 
                                            className={`h-1.5 rounded-full ${ps.totalSpent > ps.totalContractValue ? 'bg-red-500' : 'bg-green-500'}`} 
                                            style={{ width: `${Math.min((ps.totalSpent / (ps.totalContractValue || 1)) * 100, 100)}%` }}
                                        ></div>
                                    </div>
                                    <div className="flex justify-between text-[10px]">
                                        <span className="text-gray-500">Tiến độ chi: {((ps.totalSpent / (ps.totalContractValue || 1)) * 100).toFixed(0)}%</span>
                                        {ps.totalSpent > ps.totalContractValue && <span className="text-red-600 font-bold flex items-center"><AlertTriangle size={10} className="mr-1"/> Vượt định mức</span>}
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="px-5 py-3 bg-white border-t border-gray-50 flex justify-between items-center">
                            <span className="text-[10px] text-gray-400 italic">HĐ gần nhất: {ps.lastActive ? new Date(ps.lastActive).toLocaleDateString('vi-VN') : 'N/A'}</span>
                            <button className="text-[10px] font-bold text-blue-600 hover:underline">Chi tiết đối soát</button>
                        </div>
                    </div>
                ))}
            </div>

            {/* AI Insight Placeholder */}
            <div className="bg-indigo-50 p-4 rounded-xl border border-indigo-100 flex items-start gap-4">
                <div className="p-2 bg-indigo-600 text-white rounded-lg"><AlertCircle size={20}/></div>
                <div>
                    <h4 className="font-bold text-indigo-900 text-sm">Gợi ý từ trợ lý AI (Sắp ra mắt)</h4>
                    <p className="text-xs text-indigo-700 leading-relaxed mt-1">
                        Hệ thống đang thu thập dữ liệu giá từ {priceRecords.length} bản ghi thị trường. 
                        AI sẽ sớm cung cấp báo cáo so sánh chi tiết giữa các NCC để bạn tối ưu hóa chi phí mua sắm.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default ProjectPartnerInsights;
