
import React, { useState, useEffect } from 'react';
import { Payslip, PayrollRun, CashAccount, Employee, SalaryTemplate, SalaryComponent } from '../types';
import { getPayrollRun, createOrUpdateDraft, lockPayrollRun, payPayrollRun, getSalaryComponents, saveSalaryComponent, deleteSalaryComponent, getMonthlyInputs, saveMonthlyInputs, getPayrollRuns, exportPayrollToExcel } from '../services/payrollService';
import { getEmployees, getSalaryTemplates, saveSalaryTemplate } from '../services/employeeService';
import { fetchCashAccounts } from '../services/cashAccountService';
import { generateSalaryFormula } from '../services/geminiService';
import { 
  Calculator, DollarSign, Plus, TableProperties, Settings, RefreshCcw, 
  Wallet, CheckCircle2, ChevronRight, Loader2, X, Edit, Trash2,
  Lock, Copy, Folder, ChevronLeft, Calendar, AlertTriangle, Download, Sparkles, Wand2
} from 'lucide-react';
import SalaryTemplateForm from './SalaryTemplateForm';

const PayrollManager: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'RUNS' | 'TEMPLATES' | 'COMPONENTS'>('RUNS');
  const [viewMode, setViewMode] = useState<'LIST' | 'DETAIL'>('LIST');
  const [selectedMonth, setSelectedMonth] = useState('');
  
  // Data for Detail View
  const [templates, setTemplates] = useState<SalaryTemplate[]>([]);
  const [components, setComponents] = useState<SalaryComponent[]>([]);
  const [accounts, setAccounts] = useState<CashAccount[]>([]);
  
  const [runs, setRuns] = useState<PayrollRun[]>([]);
  const [currentRun, setCurrentRun] = useState<PayrollRun | undefined>(undefined);
  const [currentSlips, setCurrentSlips] = useState<Payslip[]>([]);
  
  const [isCalculating, setIsCalculating] = useState(false);
  const [showPayModal, setShowPayModal] = useState(false);
  const [selectedAccountId, setSelectedAccountId] = useState('');
  
  // Create Run Modal State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newRunMonth, setNewRunMonth] = useState(new Date().toISOString().slice(0, 7));

  const [showTemplateForm, setShowTemplateForm] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<SalaryTemplate | null>(null);
  const [showComponentModal, setShowComponentModal] = useState(false);
  const [editingComponent, setEditingComponent] = useState<Partial<SalaryComponent>>({});

  // AI Formula State
  const [aiPromptOpen, setAiPromptOpen] = useState(false);
  const [aiPromptText, setAiPromptText] = useState('');
  const [isGeneratingFormula, setIsGeneratingFormula] = useState(false);

 useEffect(() => {
      const loadTabData = async () => {
          // 1. Load Sổ lương (Runs)
          if (activeTab === 'RUNS') {
              await loadRuns();
          } 
          
          // 2. Load Tham số lương (Components) - FIX ASYNC
          else if (activeTab === 'COMPONENTS') {
              try {
                  const data = await getSalaryComponents(); // Phải có await
                  setComponents(data);
              } catch (e) {
                  console.error("Lỗi tải tham số lương:", e);
              }
          }

          // 3. Bổ sung: Load Mẫu lương (Templates) để tránh lỗi không hiện card
          else if (activeTab === 'TEMPLATES') {
              try {
                  const tpls = await getSalaryTemplates();
                  setTemplates(tpls);
              } catch (e) {
                  console.error("Lỗi tải mẫu lương:", e);
              }
          }
      };

      loadTabData();
  }, [activeTab]);

  useEffect(() => {
      if (viewMode === 'DETAIL' && selectedMonth) {
          loadMonthDetail(selectedMonth);
      }
  }, [viewMode, selectedMonth]);

  const loadRuns = async () => {
      try {
          const fetchedRuns = await getPayrollRuns();
          const allRuns = fetchedRuns.sort((a,b) => b.id.localeCompare(a.id));
          setRuns(allRuns);
      } catch (e) {
          console.error("Failed to load runs", e);
      }
  };

  const loadMonthDetail = async (month: string) => {
      const [tpls, accs] = await Promise.all([getSalaryTemplates(), fetchCashAccounts()]);
      setTemplates(tpls);
      setAccounts(accs);
      
      try {
          const run = await getPayrollRun(month);
          setCurrentRun(run);
          if (run) {
              setCurrentSlips(run.slips);
          } else {
              setCurrentSlips([]);
          }
      } catch (e) { console.error(e); }
  };

  const handleCreateRunSubmit = async () => {
      if (!newRunMonth) {
          alert("Vui lòng chọn tháng.");
          return;
      }
      
      setIsCalculating(true);
      try {
          await createOrUpdateDraft(newRunMonth);
          await loadRuns();
          setSelectedMonth(newRunMonth);
          setViewMode('DETAIL');
          setShowCreateModal(false);
      } catch (e: any) {
          alert("Không thể tạo kỳ lương: " + e.message);
      } finally {
          setIsCalculating(false);
      }
  };

  const handleRecalculate = async () => {
      if (!selectedMonth) return;
      if (!confirm("Hệ thống sẽ tính toán lại toàn bộ lương dựa trên dữ liệu Chấm công & KPI mới nhất. Tiếp tục?")) return;
      
      setIsCalculating(true);
      try {
          await createOrUpdateDraft(selectedMonth);
          await loadMonthDetail(selectedMonth);
          await loadRuns(); // Refresh status if changed
      } catch (e: any) {
          alert("Lỗi tính lương: " + e.message);
      } finally {
          setIsCalculating(false);
      }
  };

  const handleLock = async () => {
      if (!confirm("CHỐT SỔ LƯƠNG?\n\n- Dữ liệu sẽ bị khóa.\n- Không thể tính lại.\n- Có thể tiến hành chi trả.")) return;
      try {
          await lockPayrollRun(selectedMonth, 'Admin');
          await loadMonthDetail(selectedMonth);
          await loadRuns();
      } catch (e: any) { alert(e.message); }
  };

  const handlePay = async () => {
      if (!selectedAccountId) return;
      setIsCalculating(true);
      try {
          await payPayrollRun(selectedMonth, selectedAccountId, 'Admin');
          setShowPayModal(false);
          await loadMonthDetail(selectedMonth);
          await loadRuns();
          alert("Đã xác nhận chi trả lương thành công!");
      } catch(e: any) {
          alert("Lỗi chi lương: " + e.message);
      } finally {
          setIsCalculating(false);
      }
  };

  const handleSaveComp = async () => {
      const newComp: SalaryComponent = {
          id: editingComponent.id || `comp_${Date.now()}`,
          code: editingComponent.code!.toUpperCase(),
          name: editingComponent.name!,
          type: editingComponent.type || 'LUONG',
          nature: editingComponent.nature || 'THU_NHAP',
          isTaxable: editingComponent.isTaxable || false,
          formula: editingComponent.formula || '',
          value: editingComponent.value || 0,
          status: 'ACTIVE'
      };
      
      try {
          await saveSalaryComponent(newComp); // Gọi API lưu
          setShowComponentModal(false);
          
          // Reload lại danh sách hiển thị
          const comps = await getSalaryComponents();
          setComponents(comps);
      } catch (e: any) {
          alert("Lỗi lưu tham số: " + e.message);
      }
  };

  const handleGenerateFormula = async () => {
      if (!aiPromptText) return;
      setIsGeneratingFormula(true);
      try {
          const availableVars = [
              { code: 'base_salary', label: 'Lương cơ bản' },
              { code: 'actual_work_days', label: 'Ngày công thực tế' },
              { code: 'ot_hours', label: 'Giờ làm thêm' },
              { code: 'kpi_money', label: 'Tiền thưởng KPI' },
              { code: 'fixed_allowance', label: 'Phụ cấp cố định' },
              { code: 'insurance_salary', label: 'Lương đóng BH' },
              { code: 'std_days', label: 'Công chuẩn tháng (26)' },
              // Add other existing components as variables
              ...components.map(c => ({ code: c.code, label: c.name }))
          ];

          const formula = await generateSalaryFormula(aiPromptText, availableVars);
          setEditingComponent(prev => ({ ...prev, formula }));
          setAiPromptOpen(false);
          setAiPromptText('');
      } catch (e) {
          alert("Lỗi AI: " + e);
      } finally {
          setIsGeneratingFormula(false);
      }
  };


  useEffect(() => {
      const loadTabData = async () => {
          if (activeTab === 'RUNS') {
              await loadRuns();
          } else if (activeTab === 'TEMPLATES') {
              // Khi vào tab Mẫu Lương -> Gọi API lấy Template ngay
              try {
                  const tpls = await getSalaryTemplates();
                  setTemplates(tpls);
              } catch (e) { console.error("Lỗi tải mẫu lương", e); }
          } else if (activeTab === 'COMPONENTS') {
              // Khi vào tab Tham số -> Gọi API lấy Component ngay
              try {
                  const comps = await getSalaryComponents();
                  setComponents(comps);
              } catch (e) { console.error("Lỗi tải tham số lương", e); }
          }
      };

      loadTabData();
  }, [activeTab]);

  const renderRunList = () => (
      <div className="space-y-6 animate-in fade-in">
          <div className="flex justify-between items-center bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm">
              <div>
                  <h3 className="font-black text-slate-900 uppercase tracking-tighter text-lg">Quản lý các kỳ lương</h3>
                  <p className="text-xs text-slate-400 font-medium">Lưu trữ hồ sơ lương theo tháng</p>
              </div>
              <button onClick={() => setShowCreateModal(true)} className="bg-indigo-600 text-white px-6 py-3 rounded-xl font-black uppercase text-[10px] tracking-widest shadow-lg flex items-center hover:bg-indigo-700 transition-all">
                  <Plus size={16} className="mr-2"/> Tạo kỳ lương mới
              </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {runs.map(run => (
                  <div key={run.id} onClick={() => { setSelectedMonth(run.month); setViewMode('DETAIL'); }} className="bg-white p-6 rounded-[24px] border border-slate-100 shadow-sm hover:shadow-lg transition-all cursor-pointer group relative overflow-hidden">
                      <div className="flex justify-between items-start mb-4">
                          <div className="flex items-center gap-3">
                              <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600 group-hover:scale-110 transition-transform"><Folder size={24}/></div>
                              <div>
                                  <h4 className="font-black text-slate-800 text-lg">Tháng {run.month.split('-')[1]}</h4>
                                  <p className="text-[10px] text-slate-400 font-mono">{run.month}</p>
                              </div>
                          </div>
                          <span className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase ${
                              run.status === 'PAID' ? 'bg-emerald-100 text-emerald-700' : 
                              run.status === 'LOCKED' ? 'bg-slate-800 text-white' : 'bg-amber-100 text-amber-700'
                          }`}>
                              {run.status === 'PAID' ? 'ĐÃ CHI' : run.status === 'LOCKED' ? 'ĐÃ CHỐT' : 'BẢN NHÁP'}
                          </span>
                      </div>
                      <div className="space-y-2 mt-4 pt-4 border-t border-slate-50">
                          <div className="flex justify-between text-sm">
                              <span className="text-slate-500 font-medium">Nhân sự:</span>
                              <span className="font-bold text-slate-800">{run.employeeCount}</span>
                          </div>
                          <div className="flex justify-between text-sm">
                              <span className="text-slate-500 font-medium">Tổng thực lĩnh:</span>
                              <span className="font-black text-indigo-600">{run.totalAmount.toLocaleString()} ₫</span>
                          </div>
                      </div>
                  </div>
              ))}
              {runs.length === 0 && <div className="col-span-full py-20 text-center text-slate-400 italic">Chưa có kỳ lương nào được tạo.</div>}
          </div>
      </div>
  );

  const renderRunDetail = () => (
      <div className="h-full flex flex-col animate-in slide-in-from-right duration-300">
          <div className="flex items-center justify-between mb-4 shrink-0">
              <div className="flex items-center gap-4">
                  <button onClick={() => setViewMode('LIST')} className="p-2 hover:bg-slate-100 rounded-xl text-slate-500"><ChevronLeft/></button>
                  <div>
                      <h2 className="text-2xl font-black text-slate-900">Tháng {selectedMonth}</h2>
                      <div className="flex items-center gap-2 mt-1">
                          <span className={`w-2 h-2 rounded-full ${currentRun?.status === 'PAID' ? 'bg-emerald-500' : currentRun?.status === 'LOCKED' ? 'bg-slate-800' : 'bg-amber-500'}`}></span>
                          <span className="text-xs font-bold text-slate-500 uppercase">{currentRun?.status === 'PAID' ? 'Đã thanh toán' : currentRun?.status === 'LOCKED' ? 'Đã khóa sổ' : 'Bản nháp (Đang tính)'}</span>
                      </div>
                  </div>
              </div>
              <div className="flex gap-2">
                  <button onClick={() => currentRun && exportPayrollToExcel(currentRun)} className="px-4 py-2 bg-white border border-slate-200 text-green-700 rounded-xl font-bold text-xs uppercase flex items-center hover:bg-green-50 shadow-sm">
                      <Download size={16} className="mr-2"/> Xuất Excel
                  </button>
                  
                  {(!currentRun || currentRun.status === 'DRAFT') && (
                      <>
                        <button onClick={handleRecalculate} disabled={isCalculating} className="px-4 py-2 bg-indigo-50 text-indigo-700 rounded-xl font-bold text-xs uppercase flex items-center hover:bg-indigo-100">
                            {isCalculating ? <Loader2 size={16} className="animate-spin mr-2"/> : <RefreshCcw size={16} className="mr-2"/>} 
                            Tính Lại Lương
                        </button>
                        <button onClick={handleLock} className="px-4 py-2 bg-slate-800 text-white rounded-xl font-bold text-xs uppercase flex items-center hover:bg-slate-700 shadow-lg">
                            <Lock size={16} className="mr-2"/> Chốt Sổ
                        </button>
                      </>
                  )}
                  {currentRun?.status === 'LOCKED' && (
                      <button onClick={() => setShowPayModal(true)} className="px-6 py-2 bg-emerald-600 text-white rounded-xl font-bold text-xs uppercase flex items-center hover:bg-emerald-700 shadow-lg shadow-emerald-200">
                          <Wallet size={16} className="mr-2"/> Chi Trả Lương
                      </button>
                  )}
              </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-[24px] shadow-sm flex-1 overflow-hidden flex flex-col">
              <div className="overflow-auto custom-scrollbar flex-1">
                  <table className="w-full text-xs text-left">
                      <thead className="bg-slate-50 text-slate-500 font-bold uppercase sticky top-0 z-10">
                          <tr>
                              <th className="px-4 py-3 border-b">Nhân viên</th>
                              <th className="px-4 py-3 border-b text-center">Công</th>
                              <th className="px-4 py-3 border-b text-right text-indigo-600">Lương CB</th>
                              <th className="px-4 py-3 border-b text-right text-amber-600">KPI</th>
                              <th className="px-4 py-3 border-b text-right">Tổng thu nhập</th>
                              <th className="px-4 py-3 border-b text-right text-rose-600">Khấu trừ</th>
                              <th className="px-6 py-3 border-b text-right font-black text-slate-800 bg-slate-100/50 w-[150px]">Thực Lĩnh</th>
                          </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                          {currentSlips.map(slip => (
                              <tr key={slip.id} className="hover:bg-slate-50">
                                  <td className="px-4 py-3 font-bold text-slate-700">
                                      {slip.empName}
                                      <div className="text-[10px] text-slate-400 font-normal">{slip.roleName}</div>
                                      <div className="text-[10px] text-indigo-500 font-medium flex items-center mt-1">
                                        <TableProperties size={10} className="mr-1"/>
                                        {slip.templateSnapshot?.name || 'Chưa gán mẫu'}
                                      </div>
                                  </td>
                                  <td className="px-4 py-3 text-center">{slip.actualWorkDays}</td>
                                  <td className="px-4 py-3 text-right">{slip.baseSalary.toLocaleString()}</td>
                                  <td className="px-4 py-3 text-right font-bold text-amber-600">{slip.kpiMoney.toLocaleString()}</td>
                                  <td className="px-4 py-3 text-right">{slip.grossIncome.toLocaleString()}</td>
                                  <td className="px-4 py-3 text-right text-rose-500">{slip.totalDeduction.toLocaleString()}</td>
                                  <td className="px-6 py-3 text-right font-black text-sm bg-slate-50/30">
                                      {slip.netSalary.toLocaleString()} ₫
                                  </td>
                              </tr>
                          ))}
                          {currentSlips.length === 0 && <tr><td colSpan={7} className="p-10 text-center text-slate-400 italic">Chưa có dữ liệu tính lương. Nhấn 'Tính Lương' để bắt đầu.</td></tr>}
                      </tbody>
                  </table>
              </div>
          </div>
          
          {showPayModal && (
              <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
                  <div className="bg-white rounded-3xl p-8 w-full max-w-md shadow-2xl">
                      <h3 className="text-xl font-black text-slate-900 mb-4">Xác nhận Chi Lương</h3>
                      <p className="text-sm text-slate-500 mb-6">Hành động này sẽ tạo phiếu chi và cập nhật trạng thái "Đã chi" cho kỳ lương này.</p>
                      <select className="w-full border p-3 rounded-xl font-bold mb-6 outline-none" value={selectedAccountId} onChange={e => setSelectedAccountId(e.target.value)}>
                          <option value="">-- Chọn nguồn tiền --</option>
                          {accounts.map(acc => <option key={acc.id} value={acc.id}>{acc.bankName} - {acc.accountName}</option>)}
                      </select>
                      <div className="flex gap-3">
                          <button onClick={() => setShowPayModal(false)} className="flex-1 py-3 text-slate-500 font-bold hover:bg-slate-100 rounded-xl">Hủy</button>
                          <button onClick={handlePay} className="flex-1 py-3 bg-emerald-600 text-white font-bold rounded-xl shadow-lg">Xác nhận Chi</button>
                      </div>
                  </div>
              </div>
          )}
      </div>
  );

  const renderComponentsTab = () => (
      <div className="space-y-4 animate-in fade-in">
          <div className="flex justify-between items-center bg-white p-6 rounded-[24px] border border-slate-100 shadow-sm">
              <h3 className="font-black text-slate-900 uppercase">Thành phần lương</h3>
              <button onClick={() => { setEditingComponent({}); setShowComponentModal(true); }} className="bg-indigo-600 text-white px-4 py-2 rounded-xl text-xs font-bold uppercase"><Plus size={16} className="inline mr-1"/> Thêm mới</button>
          </div>
          <div className="bg-white rounded-[24px] border border-slate-100 overflow-hidden">
              <table className="w-full text-sm text-left">
                  <thead className="bg-slate-50 text-slate-500 font-bold text-xs uppercase">
                      <tr><th className="px-6 py-4">Mã</th><th className="px-6 py-4">Tên</th><th className="px-6 py-4">Công thức</th><th className="px-6 py-4 text-right"></th></tr>
                  </thead>
                  <tbody>
                      {components.map(c => (
                          <tr key={c.id} className="border-t border-slate-100 hover:bg-slate-50">
                              <td className="px-6 py-4 font-mono text-indigo-600 font-bold">{c.code}</td>
                              <td className="px-6 py-4 font-bold">{c.name}</td>
                              <td className="px-6 py-4 font-mono text-xs text-slate-500">{c.formula}</td>
                              <td className="px-6 py-4 text-right">
                                  {!c.isSystem && <button onClick={ async () => { if(confirm("Xóa?")) deleteSalaryComponent(c.id); setComponents( await getSalaryComponents()); }} className="text-red-500"><Trash2 size={16}/></button>}
                              </td>
                          </tr>
                      ))}
                  </tbody>
              </table>
          </div>
          {showComponentModal && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                  <div className="bg-white rounded-2xl p-6 w-full max-w-lg shadow-2xl relative">
                      <h3 className="font-bold text-lg mb-4">Cấu hình thành phần</h3>
                      <div className="space-y-4">
                          <input className="w-full border p-2 rounded" placeholder="Mã (VD: PHU_CAP)" value={editingComponent.code || ''} onChange={e=>setEditingComponent({...editingComponent, code: e.target.value})}/>
                          <input className="w-full border p-2 rounded" placeholder="Tên hiển thị" value={editingComponent.name || ''} onChange={e=>setEditingComponent({...editingComponent, name: e.target.value})}/>
                          
                          <div className="relative">
                              <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Công thức (Excel/JS)</label>
                              <div className="flex gap-2">
                                  <input 
                                    className="w-full border p-2 rounded font-mono text-sm" 
                                    placeholder="VD: {base_salary} / 26" 
                                    value={editingComponent.formula || ''} 
                                    onChange={e=>setEditingComponent({...editingComponent, formula: e.target.value})}
                                  />
                                  <button 
                                    onClick={() => setAiPromptOpen(!aiPromptOpen)} 
                                    className="p-2 bg-gradient-to-r from-purple-500 to-indigo-600 text-white rounded hover:shadow-lg transition-all"
                                    title="AI Hỗ trợ viết công thức"
                                  >
                                      <Sparkles size={18}/>
                                  </button>
                              </div>
                              
                              {/* AI PROMPT POPUP */}
                              {aiPromptOpen && (
                                  <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-indigo-100 shadow-xl rounded-xl p-4 z-10 animate-in fade-in zoom-in-95">
                                      <div className="flex items-center gap-2 mb-2">
                                          <Wand2 size={14} className="text-indigo-600"/>
                                          <span className="text-xs font-bold text-indigo-900">Mô tả cách tính (Tiếng Việt)</span>
                                      </div>
                                      <textarea 
                                        className="w-full border border-indigo-200 rounded-lg p-2 text-xs mb-2 focus:ring-2 focus:ring-indigo-500 outline-none" 
                                        rows={2}
                                        placeholder="Ví dụ: Lương cơ bản chia 26 ngày rồi nhân với ngày công thực tế..."
                                        value={aiPromptText}
                                        onChange={e => setAiPromptText(e.target.value)}
                                        autoFocus
                                      />
                                      <div className="flex justify-end gap-2">
                                          <button onClick={() => setAiPromptOpen(false)} className="text-xs text-slate-400 hover:text-slate-600 px-2">Đóng</button>
                                          <button 
                                            onClick={handleGenerateFormula} 
                                            disabled={isGeneratingFormula || !aiPromptText}
                                            className="bg-indigo-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold flex items-center hover:bg-indigo-700 disabled:opacity-50"
                                          >
                                              {isGeneratingFormula ? <Loader2 size={12} className="animate-spin mr-1"/> : 'Tạo công thức'}
                                          </button>
                                      </div>
                                  </div>
                              )}
                          </div>

                          <select className="w-full border p-2 rounded" value={editingComponent.nature || 'THU_NHAP'} onChange={e=>setEditingComponent({...editingComponent, nature: e.target.value as any})}>
                              <option value="THU_NHAP">Thu nhập (+)</option>
                              <option value="KHAU_TRU">Khấu trừ (-)</option>
                          </select>
                      </div>
                      <div className="flex justify-end gap-2 mt-6">
                          <button onClick={()=>setShowComponentModal(false)} className="px-4 py-2 text-gray-500">Hủy</button>
                          <button onClick={handleSaveComp} className="px-4 py-2 bg-indigo-600 text-white rounded">Lưu</button>
                      </div>
                  </div>
              </div>
          )}
      </div>
  );

  return (
    <div className="h-full flex flex-col bg-[#fcfdfe] -m-8 overflow-hidden">
        <div className="bg-white border-b border-slate-100 px-10 py-4 flex items-center justify-between shadow-sm z-30">
            <div className="flex items-center gap-4">
                <div className="bg-indigo-600 p-2.5 rounded-xl text-white shadow-lg shadow-indigo-100"><DollarSign size={20}/></div>
                <div>
                    <h1 className="text-lg font-black text-slate-900 uppercase tracking-tighter">Quản lý Lương</h1>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Hệ thống tính lương & Công nợ nhân sự</p>
                </div>
            </div>
            <div className="flex bg-slate-100 p-1 rounded-2xl border border-slate-200">
                {[
                    { id: 'RUNS', label: 'Sổ Lương (Runs)', icon: Wallet },
                    { id: 'TEMPLATES', label: 'Mẫu Lương', icon: TableProperties },
                    { id: 'COMPONENTS', label: 'Tham số', icon: Settings }
                ].map(tab => (
                    <button 
                        key={tab.id} onClick={() => { setActiveTab(tab.id as any); setViewMode('LIST'); }}
                        className={`flex items-center px-6 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all ${activeTab === tab.id ? 'bg-white text-indigo-700 shadow-md border border-slate-100' : 'text-slate-400 hover:text-slate-600'}`}
                    >
                        <tab.icon size={14} className="mr-2"/> {tab.label}
                    </button>
                ))}
            </div>
        </div>

        <div className="flex-1 overflow-hidden p-10">
            {activeTab === 'RUNS' && (viewMode === 'LIST' ? renderRunList() : renderRunDetail())}
            {activeTab === 'COMPONENTS' && renderComponentsTab()}
            {activeTab === 'TEMPLATES' && (
                <div className="space-y-6 animate-in fade-in h-full flex flex-col">
                    <div className="flex justify-between items-center shrink-0">
                        <h3 className="text-xl font-black text-slate-900 uppercase tracking-tighter">Thư viện Mẫu tính lương</h3>
                        <button onClick={() => { setEditingTemplate(null); setShowTemplateForm(true); }} className="bg-indigo-600 text-white px-6 py-2.5 rounded-xl font-black uppercase text-[10px] tracking-widest shadow-lg flex items-center hover:bg-indigo-700 transition-all">
                            <Plus size={16} className="mr-2"/> Tạo mẫu mới
                        </button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 overflow-y-auto custom-scrollbar pb-20">
                        {templates.map(tpl => (
                            <div key={tpl.id} className="bg-white p-8 rounded-[40px] border border-slate-100 shadow-sm hover:shadow-xl transition-all group relative overflow-hidden flex flex-col justify-between">
                                <div className="absolute top-0 right-0 p-6 opacity-0 group-hover:opacity-100 transition-all flex gap-1">
                                    <button onClick={() => { setEditingTemplate(tpl); setShowTemplateForm(true); }} className="p-2.5 bg-slate-50 text-slate-600 rounded-xl hover:bg-white hover:shadow-md"><Edit size={14}/></button>
                                </div>
                                <div>
                                    <div className="p-4 bg-indigo-50 text-indigo-600 rounded-3xl w-fit mb-6 shadow-inner"><TableProperties size={28}/></div>
                                    <h4 className="font-black text-slate-900 uppercase tracking-tight text-lg group-hover:text-indigo-600 transition-colors">{tpl.name}</h4>
                                    <p className="text-xs text-slate-400 mt-2 line-clamp-2 italic font-medium">"{tpl.description || 'Chưa có mô tả chi tiết'}"</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>

        {showTemplateForm && (
            <SalaryTemplateForm 
                initialData={editingTemplate}
                onSave={async (tpl) => { 
                    await saveSalaryTemplate(tpl);
                    setShowTemplateForm(false); 
                    const t = await getSalaryTemplates();
                    setTemplates(t);
                }}
                onCancel={() => setShowTemplateForm(false)}
            />
        )}

        {/* Create Run Modal */}
        {showCreateModal && (
            <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
                <div className="bg-white rounded-3xl p-8 w-full max-w-md shadow-2xl animate-in zoom-in duration-200">
                    <h3 className="text-xl font-black text-slate-900 mb-4 flex items-center">
                        <Calendar className="mr-2 text-indigo-600"/> Tạo Kỳ Lương Mới
                    </h3>
                    <p className="text-sm text-slate-500 mb-6">
                        Hệ thống sẽ tổng hợp dữ liệu chấm công và KPI tháng này để tính lương nháp.
                    </p>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 mb-1 uppercase tracking-widest">Chọn tháng</label>
                            <input 
                                type="month" 
                                className="w-full border-2 border-slate-200 rounded-xl p-3 font-bold text-slate-800 outline-none focus:border-indigo-500" 
                                value={newRunMonth}
                                onChange={e => setNewRunMonth(e.target.value)}
                            />
                        </div>
                        <div className="bg-amber-50 p-3 rounded-xl border border-amber-100 text-xs text-amber-800 flex items-start">
                            <AlertTriangle size={16} className="mr-2 shrink-0 mt-0.5"/>
                            <div>Nếu chưa có dữ liệu chấm công hoặc KPI, lương sẽ được tính theo mức cơ bản hoặc bằng 0.</div>
                        </div>
                    </div>
                    <div className="flex gap-3 mt-8">
                        <button onClick={() => setShowCreateModal(false)} className="flex-1 py-3 text-slate-500 font-bold hover:bg-slate-100 rounded-xl transition-colors">Hủy</button>
                        <button onClick={handleCreateRunSubmit} disabled={isCalculating} className="flex-1 py-3 bg-indigo-600 text-white font-bold rounded-xl shadow-lg hover:bg-indigo-700 transition-all flex justify-center items-center">
                            {isCalculating ? <Loader2 size={18} className="animate-spin mr-2"/> : <Plus size={18} className="mr-2"/>}
                            Tạo Ngay
                        </button>
                    </div>
                </div>
            </div>
        )}
    </div>
  );
};

export default PayrollManager;
