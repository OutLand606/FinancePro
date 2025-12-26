import React, { useState, useEffect, useMemo } from "react";
import {
  Employee,
  Project,
  Transaction,
  KpiRecord,
  KpiConfig,
  KpiPeriod,
} from "../types";
import { getEmployees, updateEmployee } from "../services/employeeService";
import {
  getKpiRecords,
  saveKpiRecords,
  syncMonthlyKpi,
  getKpiConfigs,
  saveKpiConfigs,
  recalculateSingleRecord,
  getKpiPeriod,
  calculateCommission,
  lockKpiPeriod,
  unlockKpiPeriod,
  exportKpiToExcel
} from "../services/kpiService";
import {
  Target,
  RefreshCw,
  Save,
  TrendingUp,
  Search,
  Loader2,
  Lock,
  Unlock,
  Calendar,
  Settings,
  AlertCircle,
  DollarSign,
  Plus,
  Trash2,
  UserPlus,
  X,
  Zap,
  Download,
} from "lucide-react";
import { api } from "../services/api";

interface KPIManagerProps {
  transactions: Transaction[];
  projects: Project[];
}

const KPIManager: React.FC<KPIManagerProps> = ({ transactions, projects }) => {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [kpiRecords, setKpiRecords] = useState<KpiRecord[]>([]);
  const [period, setPeriod] = useState<KpiPeriod | undefined>(undefined);
  const [configs, setConfigs] = useState<KpiConfig[]>([]);

  const [selectedMonth, setSelectedMonth] = useState(
    new Date().toISOString().slice(0, 7)
  );
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // UI State
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [showAddEmpModal, setShowAddEmpModal] = useState(false);
  const [selectedEmpToAdd, setSelectedEmpToAdd] = useState<string>("");
  const [searchTerm, setSearchTerm] = useState("");

  // --- LOAD DATA ---
  const loadData = async () => {
    setIsLoading(true);
    try {
      const [emps, recs, prd, cfgs] = await Promise.all([
        getEmployees(),
        getKpiRecords(selectedMonth),
        getKpiPeriod(selectedMonth),
        getKpiConfigs(),
      ]);

      setEmployees(emps);
      setKpiRecords(recs);
      setPeriod(prd);
      setConfigs(cfgs);
      
    } catch (e) {
      console.error("Failed to load KPI data", e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedMonth]);

  // --- CONFIG HANDLERS (KHÔI PHỤC LẠI) ---
  const handleAddConfig = () => {
    const newConfig: KpiConfig = {
      code: `POLICY_${Date.now()}`,
      name: "Chính sách mới",
      standardTarget: 100000000,
      advancedTarget: 200000000,
      level1Percent: 1,
      level2Percent: 1.5,
      level3Percent: 2,
    };
    setConfigs([...configs, newConfig]);
  };

  const handleDeleteConfig = (idx: number) => {
    if (!confirm("Xóa chính sách này?")) return;
    const newConfigs = configs.filter((_, i) => i !== idx);
    setConfigs(newConfigs);
  };

  const handleConfigChange = (
    idx: number,
    field: keyof KpiConfig,
    val: any
  ) => {
    const newConfigs = [...configs];
    newConfigs[idx] = { ...newConfigs[idx], [field]: val };
    setConfigs(newConfigs);
  };

  const handleSaveConfigs = async () => {
    try {
      await saveKpiConfigs(configs);
      setShowConfigModal(false);
      alert("Đã lưu cấu hình KPI thành công.");
      // Reload lại dữ liệu để áp dụng config mới nếu cần
      loadData();
    } catch (e) {
      console.error(e);
      alert("Lỗi khi lưu cấu hình.");
    }
  };

  // --- RECORD HANDLERS ---
  const handleChangeRole = async (empId: string, newRoleCode: string) => {
    // 1. Cập nhật role vào thông tin nhân viên
    const emp = employees.find((e) => e.id === empId);
    if (emp) {
      const updatedEmp = { ...emp, kpiRoleCode: newRoleCode };
      await updateEmployee(updatedEmp); // Gọi API update nhân viên
      setEmployees((prev) =>
        prev.map((e) => (e.id === empId ? updatedEmp : e))
      );

      // 2. Tính lại KPI cho nhân viên này với Role mới
      if (!period || period.status === "DRAFT") {
        try {
          const synced = await syncMonthlyKpi(
            selectedMonth,
            [updatedEmp],
            transactions,
            projects
          );
          const newRecord = synced[0];
          if (newRecord) {
            setKpiRecords((prev) => {
              const idx = prev.findIndex((r) => r.empId === empId);
              if (idx >= 0) {
                const copy = [...prev];
                copy[idx] = newRecord;
                return copy;
              }
              return [...prev, newRecord];
            });
          }
        } catch (e) {
          console.error("Sync error after role change", e);
        }
      }
    }
  };

  const handleAdjustmentChange = async (empId: string, val: string) => {
    const adjustment = parseFloat(val) || 0;
    const record = kpiRecords.find((r) => r.empId === empId);
    if (!record) return;

    // Optimistic update
    const updatedRecord = { ...record, manualRevenueAdjustment: adjustment };
    // Gọi service tính lại hoa hồng
    const recalculated = await recalculateSingleRecord(updatedRecord);

    setKpiRecords((prev) =>
      prev.map((r) => (r.empId === empId ? recalculated : r))
    );
  };

  // Hàm gọi khi blur input để lưu (tránh gọi API quá nhiều khi gõ)
  const handleSaveRecordOnBlur = async (empId: string) => {
    const record = kpiRecords.find((r) => r.empId === empId);
    if (record) await saveKpiRecords([record]);
  };

  const handleAddEmployee = async () => {
    if (!selectedEmpToAdd) return;
    const emp = employees.find((e) => e.id === selectedEmpToAdd);
    if (!emp) return;

    // Tìm config
    const config =
      configs.find((c) => c.code === emp.roleCode) ||
      configs.find((c) => c.code === "SALES_MEMBER") ||
      (configs.length > 0 ? configs[0] : null);

    if (!config) {
      alert("Chưa có cấu hình KPI. Vui lòng tạo cấu hình trước.");
      return;
    }

    const calc = calculateCommission(0, 0, config);
    const newRecord: KpiRecord = {
      id: `kpi_${selectedMonth}_${emp.id}`,
      empId: emp.id,
      month: selectedMonth,
      roleCode: config.code,
      snapStandardTarget: config.standardTarget,
      snapAdvancedTarget: config.advancedTarget,
      snapLevel1Percent: config.level1Percent,
      snapLevel2Percent: config.level2Percent,
      snapLevel3Percent: config.level3Percent,
      actualRevenue: 0,
      manualRevenueAdjustment: 0,
      ...calc,
      isLocked: false,
      updatedAt: new Date().toISOString(),
    } as KpiRecord;

    const updatedRecords = [...kpiRecords, newRecord];
    setKpiRecords(updatedRecords);
    await saveKpiRecords([newRecord]);

    setShowAddEmpModal(false);
    setSelectedEmpToAdd("");
  };

  const handleRemoveRecord = async (id: string) => {
    if (!confirm("Xóa nhân viên khỏi bảng KPI tháng này?")) return;
    setKpiRecords((prev) => prev.filter((r) => r.id !== id));
    try {
      await api.delete(`/kpi-records/${id}`);
    } catch (e) {
      console.error(e);
    }
  };

  const handleSync = async () => {
    if (
      !confirm(
        "Hệ thống sẽ quét lại Sổ Thu Chi để tính doanh số thực tế. Tiếp tục?"
      )
    )
      return;
    setIsLoading(true);
    try {
      const synced = await syncMonthlyKpi(
        selectedMonth,
        employees,
        transactions,
        projects
      );
      setKpiRecords(synced);
    } catch (e: any) {
      alert("Lỗi đồng bộ: " + e.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveAll = async () => {
    setIsSaving(true);
    await saveKpiRecords(kpiRecords);
    setIsSaving(false);
    alert("Đã lưu dữ liệu.");
  };

  // Filter list logic
  const relevantEmployees = useMemo(() => {
    return employees
      .filter((e) => {
        const matchesSearch =
          e.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
          e.code.toLowerCase().includes(searchTerm.toLowerCase());
        // Chỉ hiện nhân viên có trong bảng Record hoặc nhân viên search
        const inRecord = kpiRecords.some((r) => r.empId === e.id);
        return matchesSearch && (inRecord || searchTerm !== "");
      })
      .filter((e) => kpiRecords.some((r) => r.empId === e.id)); // Chỉ render những người ĐÃ CÓ record trong bảng
  }, [employees, kpiRecords, searchTerm]);

  const availableEmployees = employees.filter(
    (e) => !kpiRecords.some((r) => r.empId === e.id)
  );
  const totalRevenue = useMemo(() => {
    return transactions.reduce((sum, t) => {
        // 1. Chỉ lấy Phiếu Thu + Đã Thanh Toán + Trong tháng chọn
        const isValid = t.type === 'INCOME' && t.status === 'PAID' && t.date.startsWith(selectedMonth);
        
        if (isValid) {
            // 2. Tính Net (Chia 1.1)
            const net = t.vatAmount ? (t.amount - t.vatAmount) : Math.round(t.amount / 1.1);
            return sum + net;
        }
        return sum;
    }, 0);
  }, [transactions, selectedMonth]);
  const totalCommission = kpiRecords.reduce((s, r) => s + r.totalCommission, 0);
  const isLocked = period?.status === "LOCKED";

  const handleFinalize = async () => {
    if (
      !confirm(
        "BẠN CÓ CHẮC CHẮN CHỐT SỔ KPI THÁNG NÀY?\n\n- Dữ liệu sẽ được Khóa (Locked).\n- Tiền KPI sẽ được đẩy sang Bảng Lương.\n- Không thể chỉnh sửa sau khi chốt."
      )
    )
      return;
    try {
      await lockKpiPeriod(selectedMonth, "Admin");
      await loadData();
      alert("Đã chốt sổ thành công! Vui lòng sang phân hệ Lương để kiểm tra.");
    } catch (e: any) {
      alert("Lỗi khóa sổ: " + e.message);
    }
  };

  const handleSaveSession = async () => {
    setIsSaving(true);
    try {
      await saveKpiRecords(kpiRecords);
      alert("Đã lưu phiên làm việc KPI thành công!");
    } catch (e) {
      alert("Lỗi lưu trữ.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleUnlock = async () => {
    if (
      !confirm(
        "Cảnh báo: Mở khóa sổ có thể gây sai lệch lương nếu đã chi trả. Tiếp tục?"
      )
    )
      return;
    await unlockKpiPeriod(selectedMonth);
    await loadData();
  };

  return (
    <div className="space-y-6 pb-20">
      {/* HEADER */}
      <div className="bg-white p-6 rounded-[24px] border border-slate-100 shadow-sm flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 shrink-0">
        <div className="flex items-center gap-4">
          <div className="bg-orange-600 w-12 h-12 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-orange-100">
            <Target size={24} />
          </div>
          <div>
            <h1 className="text-xl font-black text-slate-900 uppercase tracking-tight">
              Tính KPI & Hoa Hồng
            </h1>
            <p className="text-slate-500 text-sm font-medium">
              Doanh số 3 tầng • Tự động đẩy sang Lương
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-xl border border-slate-200 shadow-sm">
            <Calendar size={16} className="text-slate-400" />
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="bg-transparent border-none outline-none font-bold text-sm text-slate-700 w-32"
            />
          </div>
          {isLocked && (
            <span className="bg-red-100 text-red-600 px-3 py-2 rounded-xl text-xs font-black uppercase flex items-center">
              <Lock size={12} className="mr-1" /> Đã chốt
            </span>
          )}

          <button
            onClick={() => setShowConfigModal(true)}
            className="flex items-center px-4 py-2.5 bg-slate-100 text-slate-600 rounded-xl font-bold text-[11px] uppercase tracking-widest hover:bg-slate-200 border border-slate-200 transition-all"
          >
            <Settings size={14} className="mr-2" /> Cấu hình Luật
          </button>

          <div className="h-8 w-px bg-slate-200 mx-2"></div>

          <button
            onClick={handleSync}
            disabled={isLoading || isLocked}
            className="flex items-center px-5 py-2.5 bg-blue-50 text-blue-700 rounded-xl font-black text-[11px] uppercase tracking-widest hover:bg-blue-100 border border-blue-100 transition-all disabled:opacity-50"
            title="Lấy dữ liệu mới nhất từ Sổ Thu Chi"
          >
            {isLoading ? (
              <Loader2 size={14} className="animate-spin mr-2" />
            ) : (
              <RefreshCw size={14} className="mr-2" />
            )}
            Đồng bộ
          </button>

          <button
            onClick={handleSaveSession}
            disabled={isSaving || isLocked}
            className="flex items-center px-5 py-2.5 bg-emerald-50 text-emerald-700 rounded-xl font-black text-[11px] uppercase tracking-widest hover:bg-emerald-100 border border-emerald-100 transition-all disabled:opacity-50"
          >
            {isSaving ? (
              <Loader2 size={14} className="animate-spin mr-2" />
            ) : (
              <Save size={14} className="mr-2" />
            )}
            Lưu nháp
          </button>

          {isLocked ? (
            <button
              onClick={handleUnlock}
              className="flex items-center px-6 py-2.5 bg-slate-800 text-white rounded-xl font-black text-[11px] uppercase tracking-widest shadow-xl hover:bg-slate-700 transition-all"
            >
              <Unlock size={14} className="mr-2" /> Mở khóa
            </button>
          ) : (
            <button
              onClick={handleFinalize}
              disabled={kpiRecords.length === 0}
              className="flex items-center px-6 py-2.5 bg-indigo-600 text-white rounded-xl font-black text-[11px] uppercase tracking-widest shadow-xl shadow-indigo-200 hover:bg-indigo-700 active:scale-95 transition-all disabled:opacity-50"
            >
              <Lock size={14} className="mr-2" /> Chốt sổ
            </button>
          )}
        </div>
      </div>

      {/* DASHBOARD SUMMARY */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-[24px] border border-slate-100 shadow-sm flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">
                Tổng Doanh Số
              </p>
            </div>
            <div className="text-3xl font-black text-emerald-700">
              {totalRevenue.toLocaleString()} ₫
            </div>
          </div>
          <div className="p-4 bg-emerald-50 text-emerald-600 rounded-2xl">
            <TrendingUp size={32} />
          </div>
        </div>
        <div className="bg-white p-6 rounded-[24px] border border-slate-100 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[10px] font-black text-indigo-600 uppercase tracking-widest mb-1">
              Tổng Hoa Hồng
            </p>
            <div className="text-3xl font-black text-indigo-700">
              {totalCommission.toLocaleString()} ₫
            </div>
          </div>
          <div className="p-4 bg-indigo-50 text-indigo-600 rounded-2xl">
            <DollarSign size={32} />
          </div>
        </div>
      </div>

      {/* MAIN TABLE */}
      <div className="bg-white border border-slate-200 rounded-[32px] shadow-sm overflow-hidden flex flex-col">
        <div className="p-4 border-b border-slate-100 flex gap-4 bg-slate-50/50 justify-between">
          <div className="relative flex-1 max-w-sm">
            <Search
              className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
              size={16}
            />
            <input
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-bold outline-none"
              placeholder="Tìm nhân viên..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={() =>
                exportKpiToExcel(selectedMonth, kpiRecords, employees)
              }
              className="flex items-center px-4 py-2 bg-white border border-slate-200 text-green-700 rounded-xl font-bold text-[11px] uppercase tracking-widest hover:bg-green-50 transition-all shadow-sm"
            >
              <Download size={16} className="mr-2" /> Excel
            </button>
            {!isLocked && (
              <button
                onClick={() => setShowAddEmpModal(true)}
                className="flex items-center px-4 py-2 bg-white border border-slate-200 text-indigo-600 rounded-xl font-bold text-[11px] uppercase tracking-widest hover:bg-indigo-50 transition-all shadow-sm"
              >
                <UserPlus size={16} className="mr-2" /> Thêm nhân sự
              </button>
            )}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left border-collapse">
            <thead className="bg-slate-50 text-slate-500 font-black uppercase text-[9px] tracking-widest border-b border-slate-200">
              <tr>
                <th className="px-4 py-4 w-[180px] border-r">Nhân viên</th>
                <th className="px-4 py-4 w-[150px] border-r">Chính sách</th>
                <th className="px-4 py-4 text-right border-r">Mục tiêu</th>
                <th className="px-4 py-4 text-right border-r bg-emerald-50/50 text-emerald-700">
                  DS Net (Máy)
                </th>
                <th className="px-4 py-4 text-right border-r w-[120px] bg-amber-50/50">
                  Hiệu chỉnh
                </th>
                <th className="px-4 py-4 text-right border-r font-bold text-slate-700">
                  Tổng DS Tính
                </th>
                <th className="px-4 py-4 text-right border-r bg-indigo-50/50 text-indigo-700 w-[120px]">
                  HOA HỒNG
                </th>
                <th className="px-4 py-4 w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {relevantEmployees.map((emp) => {
                const record = kpiRecords.find((r) => r.empId === emp.id);
                const totalDS =
                  (record?.actualRevenue || 0) +
                  (record?.manualRevenueAdjustment || 0);

                return (
                  <tr key={emp.id} className="hover:bg-slate-50/50 group">
                    <td className="px-4 py-3 border-r font-bold text-slate-700">
                      {emp.fullName}
                    </td>
                    <td className="px-4 py-3 border-r">
                      <select
                        className="w-full bg-slate-100 border border-slate-200 text-slate-700 text-[10px] font-bold rounded py-1 px-2 outline-none focus:border-indigo-500 cursor-pointer disabled:bg-slate-50 disabled:text-slate-400"
                        value={emp.kpiRoleCode || ""}
                        onChange={(e) =>
                          handleChangeRole(emp.id, e.target.value)
                        }
                        disabled={isLocked}
                      >
                        <option value="">-- Chọn --</option>
                        {configs.map((c) => (
                          <option key={c.code} value={c.code}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3 border-r text-right">
                      {record && (
                        <>
                          <div className="text-slate-500">
                            {record.snapStandardTarget.toLocaleString()}
                          </div>
                          <div className="text-slate-400 text-[9px]">
                            {record.snapAdvancedTarget.toLocaleString()}
                          </div>
                        </>
                      )}
                    </td>
                    <td className="px-4 py-3 border-r text-right font-black text-emerald-600 text-sm bg-emerald-50/10">
                      {record?.actualRevenue.toLocaleString() || 0}
                    </td>
                    <td className="px-4 py-3 border-r text-right bg-amber-50/10">
                      <input
                        type="number"
                        className="w-full text-right bg-transparent border-b border-dashed border-amber-300 outline-none focus:border-amber-500 text-amber-700 font-bold disabled:border-transparent"
                        value={record?.manualRevenueAdjustment || 0}
                        onChange={(e) =>
                          handleAdjustmentChange(emp.id, e.target.value)
                        }
                        onBlur={() => handleSaveRecordOnBlur(emp.id)}
                        disabled={isLocked}
                      />
                    </td>
                    <td className="px-4 py-3 border-r text-right font-bold text-slate-700">
                      {totalDS.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 border-r text-right font-black text-indigo-600 bg-indigo-50/10">
                      {record?.totalCommission.toLocaleString() || 0} ₫
                    </td>
                    <td className="px-4 py-3 text-center">
                      {!isLocked && (
                        <button
                          onClick={() => handleRemoveRecord(record?.id || "")}
                          className="p-2 text-slate-300 hover:text-rose-500 transition-colors opacity-0 group-hover:opacity-100"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
              {relevantEmployees.length === 0 && (
                <tr>
                  <td
                    colSpan={8}
                    className="py-8 text-center text-slate-400 italic"
                  >
                    Không tìm thấy dữ liệu. Nhấn "Thêm nhân sự" hoặc "Đồng bộ"
                    để bắt đầu.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL THÊM NHÂN SỰ */}
      {showAddEmpModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-white rounded-[24px] shadow-2xl w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <h3 className="font-bold text-slate-800">Thêm Nhân Sự Vào KPI</h3>
              <button
                onClick={() => setShowAddEmpModal(false)}
                className="p-2 hover:bg-slate-100 rounded-full transition-colors"
              >
                <X size={20} className="text-slate-400 hover:text-slate-600" />
              </button>
            </div>
            <div className="p-6">
              <div className="mb-4">
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                  Chọn Nhân viên
                </label>
                <select
                  className="w-full p-3 border-2 border-slate-100 rounded-xl font-bold text-slate-700 outline-none focus:border-indigo-500 bg-white"
                  value={selectedEmpToAdd}
                  onChange={(e) => setSelectedEmpToAdd(e.target.value)}
                >
                  <option value="">-- Chọn nhân viên --</option>
                  {availableEmployees.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.fullName} ({e.code})
                    </option>
                  ))}
                </select>
                {availableEmployees.length === 0 && (
                  <p className="text-xs text-amber-500 mt-2 font-medium">
                    <AlertCircle size={12} className="inline mr-1" />
                    Tất cả nhân viên đã có trong danh sách tháng này.
                  </p>
                )}
              </div>

              <button
                onClick={handleAddEmployee}
                disabled={!selectedEmpToAdd}
                className="w-full py-3 bg-indigo-600 text-white rounded-xl font-bold uppercase text-[11px] tracking-widest shadow-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                Thêm Vào Bảng KPI
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CONFIG MODAL (ĐÃ KHÔI PHỤC TOÀN BỘ) */}
      {showConfigModal && (
        <div className="fixed inset-0 z-[160] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl w-full max-w-5xl h-[85vh] flex flex-col overflow-hidden shadow-2xl">
            <div className="px-8 py-6 border-b flex justify-between items-center bg-slate-50/50">
              <div>
                <h3 className="font-black text-xl uppercase text-slate-900">
                  Cấu hình Chính sách KPI
                </h3>
                <p className="text-xs text-slate-500 font-medium">
                  Thiết lập các mức doanh số & tỷ lệ hoa hồng
                </p>
              </div>
              <button
                onClick={() => setShowConfigModal(false)}
                className="p-2 hover:bg-slate-200 rounded-full"
              >
                <X size={20} />
              </button>
            </div>
            <div className="flex-1 overflow-auto p-8 custom-scrollbar">
              <button
                onClick={handleAddConfig}
                className="mb-6 flex items-center px-4 py-2 bg-indigo-50 text-indigo-600 rounded-lg text-xs font-bold uppercase hover:bg-indigo-100 transition-all"
              >
                <Plus size={16} className="mr-1" /> Thêm chính sách mới
              </button>
              <div className="space-y-4">
                {configs.map((config, idx) => (
                  <div
                    key={idx}
                    className="border-2 border-slate-100 rounded-2xl p-6 bg-slate-50 relative group"
                  >
                    <button
                      onClick={() => handleDeleteConfig(idx)}
                      className="absolute top-4 right-4 text-slate-300 hover:text-red-500"
                    >
                      <Trash2 size={18} />
                    </button>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-4">
                      <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">
                          Mã chính sách
                        </label>
                        <input
                          className="w-full p-2 rounded-lg border font-mono font-bold text-xs"
                          value={config.code}
                          onChange={(e) =>
                            handleConfigChange(idx, "code", e.target.value)
                          }
                        />
                      </div>
                      <div className="md:col-span-2">
                        <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">
                          Tên hiển thị
                        </label>
                        <input
                          className="w-full p-2 rounded-lg border font-bold text-sm"
                          value={config.name}
                          onChange={(e) =>
                            handleConfigChange(idx, "name", e.target.value)
                          }
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4 items-end">
                      <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">
                          Mục tiêu Chuẩn
                        </label>
                        <input
                          type="number"
                          className="w-full p-2 rounded-lg border font-bold"
                          value={config.standardTarget}
                          onChange={(e) =>
                            handleConfigChange(
                              idx,
                              "standardTarget",
                              Number(e.target.value)
                            )
                          }
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">
                          Mục tiêu Cao cấp
                        </label>
                        <input
                          type="number"
                          className="w-full p-2 rounded-lg border font-bold"
                          value={config.advancedTarget}
                          onChange={(e) =>
                            handleConfigChange(
                              idx,
                              "advancedTarget",
                              Number(e.target.value)
                            )
                          }
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">
                          % Hoa hồng Mức 1
                        </label>
                        <input
                          type="number"
                          step="0.1"
                          className="w-full p-2 rounded-lg border font-bold text-indigo-600"
                          value={config.level1Percent}
                          onChange={(e) =>
                            handleConfigChange(
                              idx,
                              "level1Percent",
                              Number(e.target.value)
                            )
                          }
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">
                          % Hoa hồng Mức 2
                        </label>
                        <input
                          type="number"
                          step="0.1"
                          className="w-full p-2 rounded-lg border font-bold text-indigo-600"
                          value={config.level2Percent}
                          onChange={(e) =>
                            handleConfigChange(
                              idx,
                              "level2Percent",
                              Number(e.target.value)
                            )
                          }
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">
                          % Hoa hồng Mức 3
                        </label>
                        <input
                          type="number"
                          step="0.1"
                          className="w-full p-2 rounded-lg border font-bold text-indigo-600"
                          value={config.level3Percent}
                          onChange={(e) =>
                            handleConfigChange(
                              idx,
                              "level3Percent",
                              Number(e.target.value)
                            )
                          }
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="p-6 border-t bg-white flex justify-end">
              <button
                onClick={handleSaveConfigs}
                className="px-8 py-3 bg-indigo-600 text-white rounded-xl font-bold uppercase text-xs tracking-widest hover:bg-indigo-700 shadow-lg"
              >
                Lưu Cấu Hình
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default KPIManager;
