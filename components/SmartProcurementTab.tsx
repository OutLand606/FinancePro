
import React, { useState, useEffect, useMemo } from 'react';
import { 
    Project, Partner, UserContext, MaterialEstimation, PurchaseProposal, ProposalStatus, 
    EstimationStatus, Transaction, PurchaseProposalItem, CashAccount, FeedbackStatus, PartnerType, TransactionType, PriceRecord
} from '../types';
import { 
    fetchProjectBOQs, uploadProjectBOQ, fetchProjectEstimations, 
    fetchProjectProposals, createProposal, processQuickPayment, 
    saveEstimations, parsePastedBoqData, updateEstimation, deleteEstimation
} from '../services/procurementService';
import { generateProjectStrategy } from '../services/geminiService';
import { fetchCashAccounts } from '../services/cashAccountService';
import { 
    FileSpreadsheet, Plus, CheckCircle, Clock, ShoppingCart, Layers, 
    Sparkles, X, DollarSign, Loader2, Store, MessageSquare, ShieldCheck, 
    AlertTriangle, ArrowRight, ChevronRight, Check, Printer, FileText, Download,
    ClipboardPaste, Trash2, Edit2, Send, Star, TrendingDown, Users, History, Brain, Lightbulb, MessageCircle, Mail, Copy,
    Box, ChevronLeft, BarChart3, Search
} from 'lucide-react';

interface SmartProcurementTabProps {
    project: Project;
    partners: Partner[];
    currentUser: UserContext;
    onAddTransaction: (t: Transaction) => void;
    priceRecords: PriceRecord[];
    transactions?: Transaction[]; 
}

type WizardStep = 'AI_ADVISOR' | 'BOQ_INPUT' | 'SOURCING';

const SmartProcurementTab: React.FC<SmartProcurementTabProps> = ({ project, partners, currentUser, onAddTransaction, priceRecords, transactions = [] }) => {
    const [currentStep, setCurrentStep] = useState<WizardStep>('SOURCING'); // Default to Sourcing Dashboard
    const [estimations, setEstimations] = useState<MaterialEstimation[]>([]);
    const [proposals, setProposals] = useState<PurchaseProposal[]>([]);
    const [accounts, setAccounts] = useState<CashAccount[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [boqPasteText, setBoqPasteText] = useState('');
    const [sourcingSelection, setSourcingSelection] = useState<Record<string, string>>({});
    
    // Sourcing Dashboard State
    const [selectedGroup, setSelectedGroup] = useState<string | null>(null);
    const [activeProposal, setActiveProposal] = useState<PurchaseProposal | null>(null);
    
    // AI Strategy State
    const [aiStrategy, setAiStrategy] = useState<any>(null);
    const [isThinking, setIsThinking] = useState(false);
    
    // Quick Add Modal
    const [showQuickAdd, setShowQuickAdd] = useState(false);
    const [quickItemName, setQuickItemName] = useState('');
    const [quickItemQty, setQuickItemQty] = useState(1);
    const [quickItemUnit, setQuickItemUnit] = useState('');
    
    // Communication Modal
    const [commsModal, setCommsModal] = useState<{ item: MaterialEstimation, supplier: Partner } | null>(null);

    useEffect(() => {
        loadData();
        fetchCashAccounts().then(setAccounts);
    }, [project.id]);

    useEffect(() => {
        if (estimations.length > 0) {
            // Auto select first group if none selected
            if (!selectedGroup) {
                const groups = Array.from(new Set(estimations.map(e => e.categoryGroup || 'Khác')));
                if (groups.length > 0) setSelectedGroup(groups[0]);
            }

            // Auto-fill sourcing selection based on history
            const autoSelections: Record<string, string> = {};
            estimations.forEach(item => {
                const history = priceRecords
                    .filter(r => r.resolvedName?.toLowerCase().includes(item.rawName.toLowerCase()))
                    .sort((a,b) => a.price - b.price);
                if (history.length > 0 && history[0].partnerId !== 'UNKNOWN') {
                    if (partners.some(p => p.id === history[0].partnerId)) {
                        autoSelections[item.id] = history[0].partnerId;
                    }
                }
            });
            setSourcingSelection(prev => ({ ...autoSelections, ...prev }));
        }
    }, [estimations, priceRecords, partners]);

    const loadData = async () => {
        const [e, p] = await Promise.all([
            fetchProjectEstimations(project.id),
            fetchProjectProposals(project.id)
        ]);
        setEstimations(e);
        setProposals(p);
    };

    const getPurchasedQty = (itemName: string) => {
        return transactions
            .filter(t => 
                t.projectId === project.id && 
                t.type === TransactionType.EXPENSE && 
                t.isMaterialCost && 
                t.description.toLowerCase().includes(itemName.toLowerCase())
            )
            .length; // Simplified logic, ideally sum parsed qty
    };

    const handleFileUpload = async (file: File) => {
        setIsLoading(true);
        try {
            await uploadProjectBOQ(file, project.id, currentUser.name);
            await loadData();
            setCurrentStep('SOURCING');
        } finally {
            setIsLoading(false);
        }
    };

    const handlePasteProcess = async () => {
        if (!boqPasteText.trim()) return;
        setIsLoading(true);
        try {
            const data = parsePastedBoqData(boqPasteText, project.id);
            if (data.length === 0) {
                alert("Không nhận diện được dữ liệu. Vui lòng kiểm tra định dạng (Tên | ĐVT | Số lượng).");
                return;
            }
            await saveEstimations(data);
            await loadData();
            setBoqPasteText('');
            setCurrentStep('SOURCING');
        } finally {
            setIsLoading(false);
        }
    };

    const handleQuickAddItem = async () => {
        if (!quickItemName) return;
        const newItem: MaterialEstimation = {
            id: `est_quick_${Date.now()}`,
            projectId: project.id,
            rawName: quickItemName,
            unit: quickItemUnit || 'Cái',
            estimatedQty: Number(quickItemQty) || 1,
            usedQty: 0,
            categoryGroup: selectedGroup || 'Vật tư mua nhanh',
            status: EstimationStatus.PLANNED,
            source: 'MANUAL',
            createdAt: new Date().toISOString()
        };
        await saveEstimations([newItem]);
        await loadData();
        setShowQuickAdd(false);
        setQuickItemName('');
        setQuickItemQty(1);
        setQuickItemUnit('');
    };

    const handleCreateProposal = async (groupName: string, items: MaterialEstimation[]) => {
        const itemsBySupplier: Record<string, MaterialEstimation[]> = {};
        items.forEach(item => {
            const supId = sourcingSelection[item.id];
            if (supId) {
                if (!itemsBySupplier[supId]) itemsBySupplier[supId] = [];
                itemsBySupplier[supId].push(item);
            }
        });

        if (Object.keys(itemsBySupplier).length === 0) {
            alert("Vui lòng chọn Nhà cung cấp cho ít nhất 1 vật tư trong nhóm này.");
            return;
        }

        setIsLoading(true);
        try {
            for (const [supId, supItems] of Object.entries(itemsBySupplier)) {
                const propItems = supItems.map(e => {
                    const history = priceRecords
                        .filter(r => r.resolvedName?.toLowerCase().includes(e.rawName.toLowerCase()) && r.partnerId === supId)
                        .sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
                    const price = history[0]?.price || 0; 
                    return {
                        id: `pi_${e.id}`, estimationId: e.id, materialCode: 'MAT-GEN',
                        rawName: e.rawName, unit: e.unit, qty: e.estimatedQty - e.usedQty,
                        price: price, total: (e.estimatedQty - e.usedQty) * price
                    };
                });
                const totalAmt = propItems.reduce((s, i) => s + i.total, 0);
                const supplier = partners.find(p => p.id === supId);
                const prop: PurchaseProposal = {
                    id: `prop_${Date.now()}_${supId}`, projectId: project.id, supplierId: supId,
                    code: `PO-${Date.now().toString().slice(-4)}`, title: `Đơn mua ${groupName} - ${supplier?.name}`,
                    items: propItems, totalAmount: totalAmt, status: ProposalStatus.PENDING,
                    createdBy: currentUser.name, createdAt: new Date().toISOString()
                };
                await createProposal(prop);
                setActiveProposal(prop);
            }
            await loadData();
            // Just notify, stay on dashboard
            alert("Đã tạo đơn hàng thành công!");
        } finally {
            setIsLoading(false);
        }
    };

    const handleGenerateStrategy = async () => {
        if (estimations.length === 0) {
            alert("Vui lòng nhập BOQ (Danh mục vật tư) trước để AI có dữ liệu phân tích.");
            return;
        }
        setIsThinking(true);
        try {
            const report = await generateProjectStrategy(project, estimations, priceRecords);
            setAiStrategy(report);
        } finally {
            setIsThinking(false);
        }
    };

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        alert("Đã sao chép nội dung!");
        setCommsModal(null);
    };

    // --- RENDER SECTIONS ---

    const renderInputStep = () => (
        <div className="space-y-6 animate-in fade-in">
            <div className="flex justify-between items-center">
                <h3 className="text-xl font-bold text-gray-800">Nhập Liệu BOQ</h3>
                <button onClick={() => setCurrentStep('SOURCING')} className="px-4 py-2 text-gray-500 font-bold border rounded-lg hover:bg-gray-50">Quay lại Dashboard</button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm flex flex-col items-center justify-center text-center">
                    <FileSpreadsheet size={32} className="mb-4 text-blue-500"/>
                    <h3 className="font-bold mb-2">Tải file Excel / PDF</h3>
                    <label className="bg-blue-600 text-white px-6 py-3 rounded-xl font-bold cursor-pointer hover:bg-blue-700 transition-colors">
                        CHỌN FILE
                        <input type="file" className="hidden" onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0])} />
                    </label>
                </div>
                <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm flex flex-col">
                    <h3 className="font-bold mb-4">Hoặc dán trực tiếp từ Excel</h3>
                    <textarea className="flex-1 border rounded-xl p-4 bg-gray-50 mb-4 focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="Tên | ĐVT | SL" value={boqPasteText} onChange={e => setBoqPasteText(e.target.value)} />
                    <button onClick={handlePasteProcess} disabled={!boqPasteText} className="bg-orange-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-orange-700 disabled:opacity-50">XỬ LÝ DỮ LIỆU</button>
                </div>
            </div>
        </div>
    );

    const renderSourcingDashboard = () => {
        // Group Logic
        const grouped = estimations.reduce((acc, est) => {
            const g = est.categoryGroup || 'Khác';
            if (!acc[g]) acc[g] = [];
            acc[g].push(est);
            return acc;
        }, {} as Record<string, MaterialEstimation[]>);
        
        const groups = Object.keys(grouped).sort();
        const activeItems = selectedGroup ? grouped[selectedGroup] : [];

        // Supplier Comparison Logic for Active Group
        // Find top 3 suppliers who have price history for items in this group
        const groupSupplierStats: Record<string, { id: string, name: string, coveredItems: number, totalPrice: number }> = {};
        
        if (activeItems) {
            activeItems.forEach(item => {
                const itemHistory = priceRecords.filter(r => r.resolvedName === item.rawName && r.partnerId !== 'UNKNOWN');
                // Get unique suppliers for this item
                const uniqueSuppliers = Array.from(new Set(itemHistory.map(r => r.partnerId)));
                
                uniqueSuppliers.forEach(supId => {
                    const latestPrice = itemHistory.filter(r => r.partnerId === supId).sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
                    if (!latestPrice) return;
                    
                    if (!groupSupplierStats[supId]) {
                        const p = partners.find(px => px.id === supId);
                        groupSupplierStats[supId] = { id: supId, name: p?.name || 'Unknown', coveredItems: 0, totalPrice: 0 };
                    }
                    
                    groupSupplierStats[supId].coveredItems += 1;
                    groupSupplierStats[supId].totalPrice += (latestPrice.price * item.estimatedQty);
                });
            });
        }
        
        const bestSuppliers = Object.values(groupSupplierStats)
            .filter(s => s.coveredItems > 0)
            .sort((a,b) => b.coveredItems - a.coveredItems || a.totalPrice - b.totalPrice) // Prioritize coverage then price
            .slice(0, 3);

        return (
            <div className="h-full flex gap-6 animate-in fade-in">
                {/* LEFT: GROUPS NAVIGATION */}
                <div className="w-64 bg-white rounded-[32px] border border-slate-100 shadow-sm flex flex-col overflow-hidden shrink-0">
                    <div className="p-6 border-b border-slate-100 bg-slate-50">
                        <h3 className="font-black text-slate-800 uppercase text-xs tracking-widest mb-4">Danh mục vật tư</h3>
                        <button onClick={() => setCurrentStep('BOQ_INPUT')} className="w-full flex items-center justify-center gap-2 bg-indigo-600 text-white px-4 py-3 rounded-xl text-xs font-bold uppercase hover:bg-indigo-700 transition-all shadow-md">
                            <Plus size={16}/> Nhập thêm BOQ
                        </button>
                    </div>
                    <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar">
                        {groups.map(g => (
                            <button 
                                key={g}
                                onClick={() => setSelectedGroup(g)}
                                className={`w-full text-left px-4 py-3 rounded-xl text-xs font-bold uppercase tracking-wide transition-all flex justify-between items-center ${selectedGroup === g ? 'bg-indigo-50 text-indigo-700 shadow-sm border border-indigo-100' : 'text-slate-500 hover:bg-slate-50'}`}
                            >
                                <span className="truncate">{g}</span>
                                <span className="bg-white px-2 py-0.5 rounded text-[10px] border border-slate-100 shadow-sm">{grouped[g].length}</span>
                            </button>
                        ))}
                        {groups.length === 0 && <div className="text-center py-10 text-slate-400 italic text-xs">Chưa có dữ liệu BOQ.</div>}
                    </div>
                </div>

                {/* RIGHT: MAIN DASHBOARD */}
                <div className="flex-1 flex flex-col gap-6 overflow-hidden">
                    {/* Header */}
                    <div className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm flex justify-between items-center shrink-0">
                        <div>
                            <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight">{selectedGroup || 'Tổng quan'}</h2>
                            <p className="text-xs text-slate-500 font-bold mt-1">Quản lý cung ứng & So sánh giá</p>
                        </div>
                        <div className="flex gap-2">
                            <button onClick={() => setShowQuickAdd(true)} className="flex items-center px-4 py-2 bg-slate-100 text-slate-600 rounded-xl text-xs font-bold uppercase hover:bg-slate-200">
                                <Plus size={14} className="mr-2"/> Thêm lẻ
                            </button>
                            <button onClick={handleGenerateStrategy} className="flex items-center px-4 py-2 bg-gradient-to-r from-violet-600 to-indigo-600 text-white rounded-xl text-xs font-bold uppercase hover:shadow-lg transition-all">
                                {isThinking ? <Loader2 size={14} className="animate-spin mr-2"/> : <Brain size={14} className="mr-2"/>} 
                                AI Tư Vấn
                            </button>
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto custom-scrollbar space-y-6">
                        {/* AI Comparison Widget (Only if Group Selected & Data Exists) */}
                        {selectedGroup && activeItems.length > 0 && (
                            <div className="bg-indigo-900 rounded-[32px] p-6 text-white shadow-xl relative overflow-hidden">
                                <div className="relative z-10">
                                    <h3 className="font-bold mb-4 flex items-center text-sm uppercase tracking-widest"><BarChart3 size={16} className="mr-2 text-emerald-400"/> AI Gợi Ý Nhà Cung Cấp</h3>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        {bestSuppliers.map((sup, idx) => (
                                            <div key={sup.id} className="bg-white/10 p-4 rounded-2xl border border-white/10 hover:bg-white/20 transition-all cursor-pointer group" onClick={() => {
                                                // Batch Select Supplier
                                                if (confirm(`Chọn ${sup.name} cho toàn bộ nhóm ${selectedGroup}?`)) {
                                                    const newSel = {...sourcingSelection};
                                                    activeItems.forEach(i => newSel[i.id] = sup.id);
                                                    setSourcingSelection(newSel);
                                                }
                                            }}>
                                                <div className="flex justify-between items-start mb-2">
                                                    <span className={`text-[10px] font-black px-2 py-0.5 rounded ${idx === 0 ? 'bg-emerald-500 text-white' : 'bg-slate-700 text-slate-300'}`}>#{idx+1}</span>
                                                    {idx === 0 && <Star size={14} className="text-yellow-400 fill-yellow-400"/>}
                                                </div>
                                                <h4 className="font-bold text-sm truncate">{sup.name}</h4>
                                                <div className="mt-2 text-xs opacity-80 space-y-1">
                                                    <p>Cung cấp: {sup.coveredItems}/{activeItems.length} mục</p>
                                                    <p>Tổng giá: {(sup.totalPrice/1000000).toFixed(1)} Tr</p>
                                                </div>
                                                <div className="mt-3 pt-3 border-t border-white/10 text-[10px] font-bold text-emerald-300 uppercase opacity-0 group-hover:opacity-100 transition-opacity">Click để chọn</div>
                                            </div>
                                        ))}
                                        {bestSuppliers.length === 0 && (
                                            <div className="col-span-3 text-center py-6 text-indigo-300 italic text-sm">Chưa có đủ dữ liệu lịch sử giá để so sánh cho nhóm này.</div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Items Table */}
                        {selectedGroup ? (
                            <div className="bg-white rounded-[32px] border border-slate-200 shadow-sm overflow-hidden">
                                <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
                                    <h4 className="font-bold text-slate-700 text-sm">Danh sách vật tư</h4>
                                    <button onClick={() => handleCreateProposal(selectedGroup, activeItems)} className="bg-emerald-600 text-white px-4 py-2 rounded-lg text-xs font-bold shadow-md hover:bg-emerald-700 transition-all">
                                        Tạo Đơn Hàng ({activeItems.length})
                                    </button>
                                </div>
                                <table className="w-full text-sm text-left">
                                    <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-[10px]">
                                        <tr>
                                            <th className="px-6 py-3">Tên vật tư</th>
                                            <th className="px-6 py-3 text-center">ĐVT</th>
                                            <th className="px-6 py-3 text-center">SL</th>
                                            <th className="px-6 py-3">NCC Được Chọn</th>
                                            <th className="px-6 py-3 text-right"></th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {activeItems.map(item => {
                                            const selectedSupId = sourcingSelection[item.id];
                                            const supplierName = partners.find(p=>p.id===selectedSupId)?.name;
                                            return (
                                                <tr key={item.id} className="hover:bg-slate-50 group">
                                                    <td className="px-6 py-4 font-bold text-slate-800">{item.rawName}</td>
                                                    <td className="px-6 py-4 text-center text-slate-500 text-xs">{item.unit}</td>
                                                    <td className="px-6 py-4 text-center font-mono font-bold">{item.estimatedQty}</td>
                                                    <td className="px-6 py-4">
                                                        <select 
                                                            className={`w-full border rounded-lg px-2 py-1.5 text-xs font-bold outline-none ${selectedSupId ? 'border-indigo-200 bg-indigo-50 text-indigo-700' : 'border-slate-200 text-slate-500'}`}
                                                            value={selectedSupId || ''} 
                                                            onChange={(e) => setSourcingSelection(prev => ({ ...prev, [item.id]: e.target.value }))}
                                                        >
                                                            <option value="">-- Chọn NCC --</option>
                                                            {partners.filter(p=>p.type===PartnerType.SUPPLIER || p.type===PartnerType.BOTH).map(p => (
                                                                <option key={p.id} value={p.id}>{p.name}</option>
                                                            ))}
                                                        </select>
                                                    </td>
                                                    <td className="px-6 py-4 text-right">
                                                        <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                            {selectedSupId && (
                                                                <button 
                                                                    onClick={() => {
                                                                        const sup = partners.find(p => p.id === selectedSupId);
                                                                        if (sup) setCommsModal({ item, supplier: sup });
                                                                    }}
                                                                    className="p-2 text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
                                                                    title="Hỏi giá nhanh"
                                                                >
                                                                    <MessageCircle size={16}/>
                                                                </button>
                                                            )}
                                                            <button onClick={() => deleteEstimation(item.id).then(loadData)} className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg">
                                                                <Trash2 size={16}/>
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center h-64 text-slate-400">
                                <Box size={48} className="mb-4 opacity-50"/>
                                <p>Chọn một nhóm vật tư bên trái để bắt đầu mua sắm.</p>
                            </div>
                        )}
                        
                        {/* AI Strategy Display (If generated) */}
                        {aiStrategy && (
                            <div className="bg-white p-6 rounded-[32px] border border-slate-200 shadow-sm">
                                <h3 className="font-bold text-slate-800 mb-4 flex items-center"><Brain className="mr-2 text-indigo-600"/> Phân Tích Chiến Lược (AI)</h3>
                                <div className="bg-indigo-50 p-4 rounded-2xl text-sm text-indigo-900 leading-relaxed italic">
                                    "{aiStrategy.strategy?.explanation}"
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        );
    };

    // Communication Modal Content
    const renderCommsModal = () => {
        if (!commsModal) return null;
        const { item, supplier } = commsModal;
        const zaloText = `Chào ${supplier.name}, bên mình đang cần mua [${item.estimatedQty} ${item.unit}] mặt hàng [${item.rawName}] cho công trình [${project.name}]. Báo giá tốt giúp mình nhé!`;
        const emailSubject = `Hỏi giá vật tư ${item.rawName} - Dự án ${project.code}`;
        
        return (
            <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 animate-in fade-in">
                <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
                    <div className="bg-indigo-600 p-4 text-white flex justify-between items-center">
                        <h3 className="font-bold flex items-center"><MessageCircle className="mr-2"/> Liên hệ NCC nhanh</h3>
                        <button onClick={() => setCommsModal(null)} className="hover:bg-indigo-700 p-1 rounded"><X size={18}/></button>
                    </div>
                    <div className="p-6 space-y-4">
                        <div className="p-4 bg-blue-50 border border-blue-100 rounded-xl relative group cursor-pointer" onClick={() => copyToClipboard(zaloText)}>
                            <div className="flex justify-between mb-2">
                                <span className="font-bold text-blue-800 text-xs uppercase flex items-center"><MessageCircle size={14} className="mr-1"/> Mẫu tin nhắn Zalo</span>
                                <span className="text-xs text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity flex items-center"><Copy size={12} className="mr-1"/> Nhấn để sao chép</span>
                            </div>
                            <p className="text-sm text-gray-700 italic">"{zaloText}"</p>
                        </div>

                        <div className="p-4 bg-orange-50 border border-orange-100 rounded-xl relative group cursor-pointer" onClick={() => copyToClipboard(emailSubject + "\n\n" + zaloText)}>
                            <div className="flex justify-between mb-2">
                                <span className="font-bold text-orange-800 text-xs uppercase flex items-center"><Mail size={14} className="mr-1"/> Mẫu Email</span>
                                <span className="text-xs text-orange-600 opacity-0 group-hover:opacity-100 transition-opacity flex items-center"><Copy size={12} className="mr-1"/> Nhấn để sao chép</span>
                            </div>
                            <p className="text-sm text-gray-700 font-bold mb-1">Subject: {emailSubject}</p>
                            <p className="text-xs text-gray-500">Body: {zaloText}</p>
                        </div>
                        
                        {supplier.phone && (
                            <a href={`tel:${supplier.phone}`} className="block w-full py-3 bg-gray-100 text-gray-700 font-bold text-center rounded-xl hover:bg-gray-200">
                                Gọi điện ngay: {supplier.phone}
                            </a>
                        )}
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="space-y-6 h-full flex flex-col pb-10">
            {isLoading && <div className="text-center py-20"><Loader2 className="animate-spin mx-auto"/> Đang xử lý...</div>}
            {!isLoading && (
                <>
                    {currentStep === 'BOQ_INPUT' && renderInputStep()}
                    {currentStep === 'SOURCING' && renderSourcingDashboard()}
                </>
            )}
            
            {/* Quick Add Modal */}
            {showQuickAdd && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-4 animate-in zoom-in duration-200">
                        <h3 className="font-bold text-lg text-slate-900">Thêm vật tư nhanh</h3>
                        <div className="space-y-3">
                            <div>
                                <label className="text-xs font-bold text-slate-500">Tên vật tư</label>
                                <input className="w-full border p-2 rounded-lg font-bold" value={quickItemName} onChange={e=>setQuickItemName(e.target.value)} autoFocus placeholder="VD: Xi măng PCB30"/>
                            </div>
                            <div className="flex gap-4">
                                <div className="w-1/2">
                                    <label className="text-xs font-bold text-slate-500">Số lượng</label>
                                    <input type="number" className="w-full border p-2 rounded-lg font-bold" value={quickItemQty} onChange={e=>setQuickItemQty(Number(e.target.value))}/>
                                </div>
                                <div className="w-1/2">
                                    <label className="text-xs font-bold text-slate-500">Đơn vị</label>
                                    <input className="w-full border p-2 rounded-lg font-bold" value={quickItemUnit} onChange={e=>setQuickItemUnit(e.target.value)} placeholder="Bao"/>
                                </div>
                            </div>
                        </div>
                        <div className="flex gap-3 pt-2">
                            <button onClick={() => setShowQuickAdd(false)} className="flex-1 py-2 text-slate-500 font-bold">Hủy</button>
                            <button onClick={handleQuickAddItem} disabled={!quickItemName} className="flex-1 py-2 bg-indigo-600 text-white rounded-lg font-bold hover:bg-indigo-700 disabled:opacity-50">Lưu</button>
                        </div>
                    </div>
                </div>
            )}
            
            {renderCommsModal()}
        </div>
    );
};

export default SmartProcurementTab;
