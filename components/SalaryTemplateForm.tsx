
import React, { useState, useEffect } from 'react';
import { SalaryTemplate, SalaryComponent, Employee } from '../types';
import { 
  X, Save, Plus, Trash2, ArrowLeft, Info, Sparkles, 
  LayoutDashboard, Wand2, PlayCircle, HelpCircle
} from 'lucide-react';
import { getSalaryComponents } from '../services/payrollService';

interface SalaryTemplateFormProps {
    initialData: SalaryTemplate | null;
    onSave: (tpl: SalaryTemplate) => void;
    onCancel: () => void;
}

const SalaryTemplateForm: React.FC<SalaryTemplateFormProps> = ({ initialData, onSave, onCancel }) => {
    const [formData, setFormData] = useState<Partial<SalaryTemplate>>(
        initialData || {
            id: `tpl_${Date.now()}`,
            name: '',
            appliedPositions: [],
            components: [],
            status: 'ACTIVE'
        }
    );
    const [allComponents, setAllComponents] = useState<SalaryComponent[]>([]);
    
    // Test Mode State
    const [testVariables, setTestVariables] = useState<Record<string, number>>({
        base_salary: 10000000,
        actual_work_days: 26,
        kpi_money: 5000000,
        dependents: 0
    });
    const [testResults, setTestResults] = useState<Record<string, number>>({});

    useEffect(() => {
        const loadComponents = async () => {
            try {
                const components = await getSalaryComponents(); // Chờ API trả về dữ liệu
                setAllComponents(components);
            } catch (error) {
                console.error("Lỗi tải thành phần lương:", error);
            }
        };

        loadComponents();
    }, []);

    const handleAddComponent = (comp: SalaryComponent) => {
        if (formData.components?.find(c => c.id === comp.id)) return;
        setFormData({ ...formData, components: [...(formData.components || []), comp] });
    };

    const handleRemoveComponent = (id: string) => {
        setFormData({ ...formData, components: formData.components?.filter(c => c.id !== id) });
    };

    // Safe Eval Logic
    const evaluateFormula = (formula: string, vars: Record<string, number>): number => {
        if (!formula || formula === '0' || formula === '') return 0;
        let expression = formula.startsWith('=') ? formula.substring(1) : formula;
        try {
            expression = expression.replace(/\{(\w+)\}/g, (match, key) => (vars[key] !== undefined ? vars[key] : 0).toString());
            const sortedKeys = Object.keys(vars).sort((a, b) => b.length - a.length);
            sortedKeys.forEach(key => {
                const regex = new RegExp(`\\b${key}\\b`, 'g');
                if (expression.includes(key)) expression = expression.replace(regex, (vars[key] || 0).toString());
            });
            // eslint-disable-next-line no-eval
            const result = eval(expression);
            return typeof result === 'number' && !isNaN(result) ? result : 0;
        } catch (e) { return 0; }
    };

    const runTest = () => {
        const results: Record<string, number> = {};
        let tongThuNhap = 0, tongKhauTru = 0;
        
        formData.components?.forEach(comp => {
            let formula = comp.formula || comp.value?.toString() || '0';
            const val = evaluateFormula(formula, { ...testVariables, ...results });
            results[comp.code] = val;
            if (comp.nature === 'THU_NHAP') tongThuNhap += val;
            if (comp.nature === 'KHAU_TRU') tongKhauTru += val;
            results['TONG_THU_NHAP'] = tongThuNhap;
            results['TONG_KHAU_TRU'] = tongKhauTru;
        });
        setTestResults(results);
    };

    return (
        <div className="fixed inset-0 z-[150] flex flex-col bg-[#fcfdfe] animate-in slide-in-from-right duration-300 overflow-hidden">
            <div className="bg-white border-b border-slate-100 px-10 py-5 flex items-center justify-between shadow-sm z-30">
                <div className="flex items-center gap-6">
                    <button onClick={onCancel} className="p-2 hover:bg-slate-50 rounded-xl text-slate-400 transition-colors"><ArrowLeft size={24}/></button>
                    <div>
                        <h1 className="text-xl font-black text-slate-900 uppercase tracking-tighter">{initialData ? 'Sửa mẫu bảng lương' : 'Thiết lập mẫu bảng lương mới'}</h1>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Quy định cấu trúc thu nhập</p>
                    </div>
                </div>
                <button onClick={() => onSave(formData as SalaryTemplate)} className="bg-emerald-600 text-white px-10 py-3 rounded-2xl font-black uppercase text-[11px] tracking-widest shadow-xl shadow-emerald-100 hover:bg-emerald-700 transition-all flex items-center">
                    <Save size={18} className="mr-2"/> Lưu mẫu
                </button>
            </div>

            <div className="flex-1 flex overflow-hidden">
                <div className="w-1/3 border-r bg-white p-10 overflow-y-auto custom-scrollbar space-y-10">
                    <section className="space-y-6">
                        <h3 className="text-[10px] font-black text-indigo-600 uppercase tracking-widest border-b border-indigo-50 pb-3 flex items-center"><Info size={16} className="mr-2"/> 1. THÔNG TIN CHUNG</h3>
                        <div>
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Tên mẫu bảng lương *</label>
                            <input className="w-full border-2 border-slate-100 rounded-2xl p-4 font-black text-slate-800 focus:border-indigo-500 outline-none shadow-sm" placeholder="VD: Lương Sales..." value={formData.name || ''} onChange={e => setFormData({...formData, name: e.target.value})} />
                        </div>
                    </section>

                    <section className="space-y-6">
                        <h3 className="text-[10px] font-black text-indigo-600 uppercase tracking-widest border-b border-indigo-50 pb-3 flex items-center"><Sparkles size={16} className="mr-2"/> 2. CHỌN THÀNH PHẦN</h3>
                        <div className="grid grid-cols-1 gap-2">
                            {allComponents.map(c => (
                                <button key={c.id} onClick={() => handleAddComponent(c)} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100 hover:border-indigo-300 hover:bg-white transition-all group">
                                    <div className="text-left">
                                        <p className="text-sm font-black text-slate-700">{c.name}</p>
                                        <p className="text-[10px] font-mono text-indigo-500 uppercase font-bold">{c.code}</p>
                                    </div>
                                    <Plus size={16} className="text-slate-300 group-hover:text-indigo-600"/>
                                </button>
                            ))}
                        </div>
                    </section>
                </div>

                <div className="flex-1 bg-slate-50/50 p-10 overflow-y-auto custom-scrollbar flex flex-col gap-6">
                    <div className="bg-white rounded-[40px] border border-slate-100 shadow-sm p-10">
                        <h3 className="text-[11px] font-black text-emerald-600 uppercase tracking-widest mb-8 flex items-center"><LayoutDashboard size={18} className="mr-2"/> CẤU TRÚC BẢNG LƯƠNG</h3>
                        <div className="space-y-4">
                            {formData.components?.map((comp, idx) => (
                                <div key={comp.id} className="grid grid-cols-12 px-6 py-4 border border-slate-100 rounded-2xl items-center bg-white hover:shadow-md transition-all group">
                                    <div className="col-span-1 font-black text-slate-300">{idx + 1}</div>
                                    <div className="col-span-3">
                                        <p className="font-black text-slate-800 text-sm">{comp.name}</p>
                                        <span className={`text-[9px] font-black uppercase ${comp.nature === 'THU_NHAP' ? 'text-emerald-500' : 'text-rose-500'}`}>{comp.nature}</span>
                                    </div>
                                    <div className="col-span-2 font-mono text-[11px] font-bold text-indigo-500">{comp.code}</div>
                                    <div className="col-span-5 relative"><input className="w-full bg-slate-50 border-2 border-slate-50 px-4 py-2 rounded-xl font-mono text-[11px] font-bold text-slate-600 outline-none" value={comp.formula || comp.value?.toLocaleString() || ''} readOnly /></div>
                                    <div className="col-span-1 text-right"><button onClick={() => handleRemoveComponent(comp.id)} className="p-2 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg"><Trash2 size={16}/></button></div>
                                </div>
                            ))}
                            {(!formData.components || formData.components.length === 0) && <div className="py-10 text-center text-slate-400 italic">Chưa chọn thành phần nào.</div>}
                        </div>
                    </div>

                    {/* TESTER WIDGET */}
                    <div className="bg-slate-900 rounded-[32px] p-8 text-white shadow-xl">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="font-bold flex items-center"><Wand2 className="mr-2"/> Kiểm tra Công thức (Simulator)</h3>
                            <button onClick={runTest} className="bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded-xl font-bold text-xs uppercase flex items-center"><PlayCircle size={14} className="mr-2"/> Chạy thử</button>
                        </div>
                        <div className="grid grid-cols-2 gap-8">
                            <div className="space-y-3">
                                <p className="text-[10px] font-black uppercase opacity-50 tracking-widest">Giả lập đầu vào</p>
                                {Object.entries(testVariables).map(([k, v]) => (
                                    <div key={k} className="flex justify-between items-center bg-white/10 p-2 rounded-lg">
                                        <span className="text-xs font-mono">{k}</span>
                                        <input className="w-24 bg-transparent text-right outline-none font-bold text-emerald-400" type="number" value={v} onChange={e => setTestVariables({...testVariables, [k]: Number(e.target.value)})}/>
                                    </div>
                                ))}
                            </div>
                            <div className="space-y-3">
                                <p className="text-[10px] font-black uppercase opacity-50 tracking-widest">Kết quả tính toán</p>
                                {Object.entries(testResults).map(([k, v]) => (
                                    <div key={k} className="flex justify-between items-center border-b border-white/10 pb-1">
                                        <span className="text-xs font-mono opacity-80">{k}</span>
                                        <span className="font-bold text-indigo-300">{v.toLocaleString()}</span>
                                    </div>
                                ))}
                                {Object.keys(testResults).length === 0 && <p className="text-xs italic opacity-50">Nhấn chạy thử để xem kết quả.</p>}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SalaryTemplateForm;
