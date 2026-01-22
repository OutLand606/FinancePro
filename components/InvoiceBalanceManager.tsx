import React, { useState, useMemo, useRef, useEffect } from "react";
import {
  Transaction,
  Project,
  Partner,
  Contract,
  CostPlan,
  TransactionType,
  TransactionStatus,
  TransactionScope,
  CostTarget,
} from "../types";
import { getCostPlan, saveCostPlan } from "../services/invoiceBalanceService";
import { uploadFileToDrive } from "../services/googleDriveService";
import { updateTransaction, updateProject } from "../services/sheetService";
import { exportTaxManifestToExcel } from "../services/excelExportService";
import { extractTransactionFromImage } from "../services/aiExtractionService";
import {
  Receipt,
  Scale,
  AlertTriangle,
  CheckCircle2,
  PieChart,
  Filter,
  Calendar,
  X,
  Settings,
  Upload,
  Loader2,
  FileText,
  Search,
  Download,
  AlertCircle,
  Plus,
  Coins,
  Wallet,
  Building2,
  Archive,
  CalendarRange,
  Check,
  Lock,
  ChevronDown,
  Lightbulb,
  ListTodo,
  Sparkles,
  CheckSquare,
  Save,
  Trash2,
  Globe,
  ShieldAlert,
} from "lucide-react";
import TaxKpiDashboard from "./TaxKpiDashboard";
import { api } from "@/services/api";

interface InvoiceBalanceManagerProps {
  transactions: Transaction[];
  projects: Project[];
  partners: Partner[];
  contracts: Contract[];
  onAddTransaction: (t: Transaction) => void;
  onAddPartner: (p: Partner) => void;
}

// Helper to get quarter
const getQuarter = (d: Date) => {
  return Math.floor(d.getMonth() / 3) + 1;
};

// Interface for Local Plan State
interface OutputTaxPlan {
  selectedProjectIds: string[];
  selectedTransactionIds: string[];
  manualItems: { id: string; name: string; value: number }[];

  // Validated Inputs
  confirmedLaborTransIds: string[];
  confirmedInternalTransIds: string[];

  // Manual Allocation
  customAllocations: Record<string, string>;
}

// DEFAULT TARGETS
const DEFAULT_COST_TARGETS: CostTarget[] = [
  {
    id: "t_material",
    label: "Vật tư (Có VAT)",
    percent: 60,
    mappingKey: "MATERIAL",
    description: "Hóa đơn đầu vào NVL",
  },
  {
    id: "t_labor",
    label: "Nhân công",
    percent: 25,
    mappingKey: "LABOR",
    description: "HĐ nhân công, lương",
  },
  {
    id: "t_office",
    label: "Văn phòng / Cố định",
    percent: 5,
    mappingKey: "OFFICE",
    description: "Điện, nước, thuê nhà",
  },
  {
    id: "t_other",
    label: "Khác",
    percent: 5,
    mappingKey: "OTHER",
    description: "Tiếp khách, đi lại",
  },
];

const ACCOUNTING_QUOTES = [
  "Nguyên tắc Thận trọng: Ghi nhận tăng vốn chỉ khi chắc chắn, nhưng ghi nhận giảm vốn ngay khi có khả năng.",
  "Đừng để chứng từ dồn cuối tháng! Xử lý ngay khi phát sinh là chìa khóa của sự chính xác.",
  "Tài sản = Nợ phải trả + Vốn chủ sở hữu. Luôn luôn cân bằng!",
  "Một đồng tiết kiệm được là một đồng lợi nhuận. Hãy kiểm soát chi phí chặt chẽ.",
  "Nguyên tắc Cơ sở dồn tích: Ghi chép nghiệp vụ tại thời điểm phát sinh, không phải lúc thu/chi tiền.",
  "Kế toán không chỉ là những con số, mà là ngôn ngữ của doanh nghiệp.",
  "Kiểm tra đối chiếu công nợ định kỳ để tránh rủi ro mất vốn.",
];

const InvoiceBalanceManager: React.FC<InvoiceBalanceManagerProps> = ({
  transactions,
  projects,
  partners,
  contracts,
  onAddTransaction,
  onAddPartner,
  accounts,
}) => {
  const [activeTab, setActiveTab] = useState<
    "DASHBOARD" | "INVOICE" | "TAX" | "LABOR"
  >("INVOICE");

  // --- STATE: TIME FILTER ---
  const [timeViewMode, setTimeViewMode] = useState<"QUARTER" | "MONTH">(
    "QUARTER",
  );
  const [currentQuarter, setCurrentQuarter] = useState(getQuarter(new Date()));
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth() + 1);
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());

  // --- STATE: REVENUE SOURCE FILTERS (New) ---
  const [revenueSearch, setRevenueSearch] = useState("");
  const [revenueTimeScope, setRevenueTimeScope] = useState<"ALL" | "IN_PERIOD">(
    "ALL",
  );

  // --- STATE: OUTPUT PLANNING ---
  const getPlanKey = () => {
    const periodSuffix =
      timeViewMode === "QUARTER" ? `Q${currentQuarter}` : `M${currentMonth}`;
    return `tax_plan_session_${currentYear}_${periodSuffix}`;
  };

  // --- LOAD Effect (Gọi API lấy dữ liệu khi đổi thời gian) ---
  const DEFAULT_PLAN = {
    selectedProjectIds: [],
    selectedTransactionIds: [],
    manualItems: [],
    confirmedLaborTransIds: [],
    confirmedInternalTransIds: [],
    customAllocations: {},
  };
  const [outputPlan, setOutputPlan] = useState<OutputTaxPlan>(DEFAULT_PLAN);
  const [isPlanLoading, setIsPlanLoading] = useState(false);
  const isPlanExistingRef = useRef(false);

  useEffect(() => {
    const loadOutputPlan = async () => {
      setIsPlanLoading(true);
      const currentKey = getPlanKey();

      try {
        const res: any = await api.get("/finance-output-plan", {
          id: currentKey,
        });

        if (res.success && res.data) {
          const parsed = res.data;
          setOutputPlan({
            ...DEFAULT_PLAN,
            ...parsed,
            customAllocations: parsed.customAllocations || {},
          });
          isPlanExistingRef.current = true;
        } else {
          setOutputPlan(DEFAULT_PLAN);
          isPlanExistingRef.current = false;
        }
      } catch (error) {
        console.error("Lỗi tải Output Plan:", error);
        setOutputPlan(DEFAULT_PLAN);
        isPlanExistingRef.current = false;
      } finally {
        setIsPlanLoading(false);
      }
    };

    loadOutputPlan();
  }, [currentYear, currentQuarter, currentMonth, timeViewMode]);

  useEffect(() => {
    if (isPlanLoading || !outputPlan) return;

    const currentKey = getPlanKey();

    const timer = setTimeout(async () => {
      try {
        const payload = {
          id: currentKey,
          ...outputPlan,

          year: currentYear,
          viewMode: timeViewMode,
          month: timeViewMode === "MONTH" ? currentMonth : null,
          quarter: timeViewMode === "QUARTER" ? currentQuarter : null,
        };

        if (isPlanExistingRef.current) {
          console.log("Auto-saving (UPDATE)...", currentKey);
          await api.put(`/finance-output-plan/${currentKey}`, payload);
        } else {
          console.log("Auto-saving (CREATE)...", currentKey);
          const res: any = await api.post("/finance-output-plan", payload);

          if (res.success) {
            isPlanExistingRef.current = true;
          }
        }
      } catch (error) {
        console.error("Auto-save failed:", error);
      }
    }, 1500);

    return () => clearTimeout(timer);
  }, [
    outputPlan,
    currentYear,
    currentQuarter,
    currentMonth,
    timeViewMode,
    isPlanLoading,
  ]);

  // --- STATE: UI & BULK ACTIONS ---
  const [sourceTab, setSourceTab] = useState<"REVENUE" | "EXPENSE">("REVENUE");
  const [filterStatus, setFilterStatus] = useState<
    "ALL" | "MISSING" | "COMPLETED"
  >("ALL");
  const [viewInvoiceType, setViewInvoiceType] = useState<"INPUT" | "OUTPUT">(
    "INPUT",
  );
  const [textSearch, setTextSearch] = useState("");

  const [selectedInvoiceIds, setSelectedInvoiceIds] = useState<Set<string>>(
    new Set(),
  );

  const [isUploading, setIsUploading] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadTargetId, setUploadTargetId] = useState<string | null>(null);

  // --- STATE: STANDALONE MODAL ---
  const [showStandaloneModal, setShowStandaloneModal] = useState(false);
  const [scannedTransaction, setScannedTransaction] = useState<
    Partial<Transaction>
  >({});
  const [isScanning, setIsScanning] = useState(false);

  // --- STATE: CONFIG ---
  const [showConfigModal, setShowConfigModal] = useState(false);

  const [localCostPlan, setLocalCostPlan] = useState<CostPlan>(async () => {
    const plan = await getCostPlan();
    if (!plan.targets || plan.targets.length === 0) {
      return { ...plan, targets: DEFAULT_COST_TARGETS };
    }
    return plan;
  });

  const [newTargetName, setNewTargetName] = useState("");
  const [newTargetPercent, setNewTargetPercent] = useState(0);
  const [newTargetKey, setNewTargetKey] =
    useState<CostTarget["mappingKey"]>("OTHER");

  // --- STATE: MANUAL FORECAST & AI ASSISTANT ---
  const [newManualItemName, setNewManualItemName] = useState("");
  const [newManualItemValue, setNewManualItemValue] = useState(0);
  const [dailyTip, setDailyTip] = useState<string>("");
  const [aiTasks, setAiTasks] = useState<
    { id: string; text: string; type: "URGENT" | "NORMAL"; done: boolean }[]
  >([]);

  // --- STATE: EDIT PROJECT VALUE ---
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [editProjectValue, setEditProjectValue] = useState<number>(0);

  // --- HELPERS: DATE RANGES ---
  const getDateRange = () => {
    let qStartStr, qEndStr;
    if (timeViewMode === "QUARTER") {
      const startMonth = (currentQuarter - 1) * 3 + 1;
      const endMonth = currentQuarter * 3;
      qStartStr = `${currentYear}-${startMonth.toString().padStart(2, "0")}-01`;
      const lastDay = new Date(currentYear, endMonth, 0).getDate();
      qEndStr = `${currentYear}-${endMonth.toString().padStart(2, "0")}-${lastDay}`;
    } else {
      const lastDay = new Date(currentYear, currentMonth, 0).getDate();
      qStartStr = `${currentYear}-${currentMonth.toString().padStart(2, "0")}-01`;
      qEndStr = `${currentYear}-${currentMonth.toString().padStart(2, "0")}-${lastDay}`;
    }
    return { start: qStartStr, end: qEndStr };
  };

  useEffect(() => {
    setDailyTip(
      ACCOUNTING_QUOTES[Math.floor(Math.random() * ACCOUNTING_QUOTES.length)],
    );
  }, []);

  // --- DATA PROCESSING ---
  const invoiceControlData = useMemo(() => {
    const { start, end } = getDateRange();
    const targetType =
      viewInvoiceType === "INPUT"
        ? TransactionType.EXPENSE
        : TransactionType.INCOME;

    let list = transactions.filter(
      (t) =>
        t.type === targetType &&
        t.date >= start &&
        t.date <= end &&
        (t.status === TransactionStatus.PAID || t.hasVATInvoice),
    );

    const mappedList = list.map((t) => {
      const hasFile = t.attachments && t.attachments.length > 0;
      const status = hasFile && t.hasVATInvoice ? "COMPLETED" : "MISSING";
      const vatVal =
        t.vatAmount ||
        (t.hasVATInvoice ? Math.round(t.amount - t.amount / 1.1) : 0);
      return { ...t, invoiceStatus: status, estimatedVAT: vatVal };
    });

    return mappedList
      .filter((t) => {
        const matchStatus =
          filterStatus === "ALL" || t.invoiceStatus === filterStatus;
        const matchText =
          textSearch === "" ||
          t.description.toLowerCase().includes(textSearch.toLowerCase()) ||
          (t.code && t.code.toLowerCase().includes(textSearch.toLowerCase()));
        return matchStatus && matchText;
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [
    transactions,
    currentYear,
    currentQuarter,
    currentMonth,
    timeViewMode,
    viewInvoiceType,
    filterStatus,
    textSearch,
  ]);

  const invoiceStats = useMemo(() => {
    const totalValue = invoiceControlData.reduce((s, t) => s + t.amount, 0);
    const totalVAT = invoiceControlData.reduce(
      (s, t) => s + (t.estimatedVAT || 0),
      0,
    );
    const missingCount = invoiceControlData.filter(
      (t) => t.invoiceStatus === "MISSING",
    ).length;
    const missingValue = invoiceControlData
      .filter((t) => t.invoiceStatus === "MISSING")
      .reduce((s, t) => s + t.amount, 0);
    return { totalValue, totalVAT, missingCount, missingValue };
  }, [invoiceControlData]);

  // --- PROJECTS LIST LOGIC (UPDATED WITH SEARCH & FILTER) ---
  const filteredProjects = useMemo(() => {
    const { start, end } = getDateRange();

    let list = projects.filter(
      (p) => p.status === "ACTIVE" || p.status === "COMPLETED",
    );

    // 1. Time Scope Filter
    if (revenueTimeScope === "IN_PERIOD") {
      // Find projects that have Revenue Transactions in this period
      const activeIds = new Set(
        transactions
          .filter(
            (t) =>
              t.projectId &&
              t.type === TransactionType.INCOME &&
              t.date >= start &&
              t.date <= end,
          )
          .map((t) => t.projectId),
      );

      list = list.filter((p) => activeIds.has(p.id));
    }

    // 2. Search Filter
    if (revenueSearch) {
      const lowerQ = revenueSearch.toLowerCase();
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(lowerQ) ||
          p.code.toLowerCase().includes(lowerQ),
      );
    }

    return list.map((p) => {
      const hasValue = p.contractTotalValue && p.contractTotalValue > 0;
      return { ...p, hasValue, isWarning: !hasValue };
    });
  }, [
    projects,
    transactions,
    revenueTimeScope,
    revenueSearch,
    currentYear,
    currentQuarter,
    currentMonth,
    timeViewMode,
  ]);

  const adhocReceipts = useMemo(() => {
    const { start, end } = getDateRange();
    let list = transactions.filter(
      (t) =>
        t.type === TransactionType.INCOME &&
        t.status === TransactionStatus.PAID &&
        t.date >= start &&
        t.date <= end &&
        t.scope !== TransactionScope.PROJECT &&
        t.amount > 0,
    );

    if (revenueSearch) {
      const lowerQ = revenueSearch.toLowerCase();
      list = list.filter((t) => t.description.toLowerCase().includes(lowerQ));
    }

    return list.sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
    );
  }, [
    transactions,
    currentYear,
    currentQuarter,
    currentMonth,
    timeViewMode,
    revenueSearch,
  ]);

  const expenseCandidates = useMemo(() => {
    const { start, end } = getDateRange();
    return transactions
      .filter(
        (t) =>
          t.type === TransactionType.EXPENSE &&
          t.date >= start &&
          t.date <= end,
      )
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [transactions, currentYear, currentQuarter, currentMonth, timeViewMode]);

  const getAutoMapping = (t: Transaction): string => {
    if (outputPlan.customAllocations[t.id])
      return outputPlan.customAllocations[t.id];
    if (t.isMaterialCost) return "MATERIAL";
    if (t.isLaborCost || t.category?.toLowerCase().includes("lương"))
      return "LABOR";
    if (
      t.category?.toLowerCase().includes("marketing") ||
      t.description.toLowerCase().includes("marketing")
    )
      return "MARKETING";
    if (t.scope === "COMPANY_FIXED" || t.costCenterType === "OFFICE")
      return "OFFICE";
    return "OTHER";
  };

  const balancingStats = useMemo(() => {
    // A. REVENUE (PLAN)
    // Note: filteredProjects is for UI filtering, but we must use selected IDs to sum revenue
    // However, we still need to find the full project objects for the selected IDs
    const selectedProjectsList = projects.filter((p) =>
      outputPlan.selectedProjectIds.includes(p.id),
    );

    const projectRevenue = selectedProjectsList.reduce(
      (sum, p) => sum + (p.contractTotalValue || 0),
      0,
    );

    // Receipts need full list logic? No, just selected IDs from available ones?
    // Actually adhocReceipts are period-bound, so we just filter from them.
    // Wait, if user selected an adhoc receipt, we assume it exists in transactions.
    const receiptRevenue = transactions
      .filter((t) => outputPlan.selectedTransactionIds.includes(t.id))
      .reduce((sum, t) => sum + t.amount, 0);

    const manualRevenue = outputPlan.manualItems.reduce(
      (sum, i) => sum + i.value,
      0,
    );
    const totalPlannedRevenue = projectRevenue + receiptRevenue + manualRevenue;

    const targets = localCostPlan.targets || DEFAULT_COST_TARGETS;

    const breakdown = targets.map((target) => {
      const targetAmount = totalPlannedRevenue * (target.percent / 100);
      const matchedTransactions = expenseCandidates.filter((t) => {
        const allocatedKey = getAutoMapping(t);
        const isConfirmed =
          t.hasVATInvoice ||
          (t.isLaborCost && outputPlan.confirmedLaborTransIds.includes(t.id)) ||
          (!t.isLaborCost &&
            outputPlan.confirmedInternalTransIds.includes(t.id));
        return isConfirmed && allocatedKey === target.mappingKey;
      });
      const actualAmount = matchedTransactions.reduce(
        (sum, t) => sum + t.amount,
        0,
      );
      return {
        ...target,
        targetAmount,
        actualAmount,
        missingAmount: Math.max(0, targetAmount - actualAmount),
        achievedPercent:
          targetAmount > 0 ? (actualAmount / targetAmount) * 100 : 0,
      };
    });

    const totalValidExpense = breakdown.reduce(
      (sum, b) => sum + b.actualAmount,
      0,
    );
    const totalTargetExpense =
      totalPlannedRevenue * (targets.reduce((s, t) => s + t.percent, 0) / 100);
    const totalMissing = Math.max(0, totalTargetExpense - totalValidExpense);

    return {
      totalPlannedRevenue,
      totalValidExpense,
      totalTargetExpense,
      totalMissing,
      breakdown,
    };
  }, [projects, transactions, outputPlan, expenseCandidates, localCostPlan]);

  // --- EFFECT: SMART TASKS ---
  useEffect(() => {
    const tasks: any[] = [];
    const today = new Date();
    const currentDay = today.getDate();
    const currentMonthIdx = today.getMonth() + 1;
    const currentDayOfWeek = today.getDay();

    if (invoiceStats.missingCount > 0) {
      tasks.push({
        id: "t_inv",
        text: `Bạn còn ${invoiceStats.missingCount} chứng từ cần tải hóa đơn gốc (XML/PDF) lên để tránh bị nhắc nhở.`,
        type: "URGENT",
        done: false,
      });
    }

    if (currentDay >= 1 && currentDay <= 5) {
      tasks.push({
        id: "t_utility",
        text: "Đầu tháng: Kiểm tra và thanh toán tiền Điện, Nước, Internet cho Cửa hàng/Văn phòng.",
        type: "NORMAL",
        done: false,
      });
    }

    if (currentDay >= 12 && currentDay <= 15) {
      tasks.push({
        id: "t_ins",
        text: `Ngày ${currentDay}: Cần thanh toán Chi phí Bảo hiểm xã hội tháng ${currentMonthIdx}.`,
        type: "URGENT",
        done: false,
      });
    }

    if (currentDayOfWeek === 5 || currentDayOfWeek === 6) {
      tasks.push({
        id: "t_weekly",
        text: "Cuối tuần: Bạn cần tổng hợp sổ Bán hàng và gửi báo cáo tuần cho Sếp.",
        type: "NORMAL",
        done: false,
      });
    }

    const missingMat =
      balancingStats.breakdown.find((b) => b.mappingKey === "MATERIAL")
        ?.missingAmount || 0;
    if (missingMat > 0) {
      tasks.push({
        id: "t_mat_tax",
        text: `Cân đối thuế: Đang thiếu ${(missingMat / 1000000).toFixed(0)}Tr hóa đơn Vật tư. Cần lấy thêm.`,
        type: "NORMAL",
        done: false,
      });
    }

    setAiTasks(tasks);
  }, [balancingStats, invoiceStats]);

  // --- HANDLERS ---
  const toggleInvoiceSelect = (id: string) => {
    const newSet = new Set(selectedInvoiceIds);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedInvoiceIds(newSet);
  };

  const handleBulkDownload = () => {
    const count = selectedInvoiceIds.size;
    if (count === 0) return alert("Vui lòng chọn ít nhất 1 hóa đơn để tải.");

    const selectedTrans = transactions.filter((t) =>
      selectedInvoiceIds.has(t.id),
    );
    let downloadCount = 0;

    selectedTrans.forEach((t) => {
      if (t.attachments && t.attachments.length > 0) {
        t.attachments.forEach((att) => {
          const link = document.createElement("a");
          link.href = att.url;
          link.target = "_blank";
          link.download = att.name;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          downloadCount++;
        });
      }
    });

    if (downloadCount > 0) {
      setSelectedInvoiceIds(new Set());
    } else {
      alert("Các giao dịch đã chọn không có file đính kèm nào.");
    }
  };

  const handleQuickUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !uploadTargetId) return;

    setIsUploading(uploadTargetId);
    try {
      const attachment = await uploadFileToDrive(file);
      let aiWarning = null;
      const targetTrans = transactions.find((t) => t.id === uploadTargetId);
      if (!targetTrans) throw new Error("Giao dịch không tồn tại");

      if (file.type.includes("image")) {
        try {
          const aiResult = await extractTransactionFromImage(file);
          if (aiResult && aiResult.amount > 0) {
            const diff = Math.abs(aiResult.amount - targetTrans.amount);
            if (diff > 5000) {
              aiWarning = `⚠️ CẢNH BÁO AI: Số tiền trên hóa đơn (${aiResult.amount.toLocaleString()}) KHÁC với số tiền đã chi (${targetTrans.amount.toLocaleString()}).`;
            }
          }
        } catch (e) {
          console.warn("AI Scan warning:", e);
        }
      }

      if (aiWarning) {
        if (
          !confirm(
            `${aiWarning}\n\nBạn có chắc chắn muốn cập nhật hóa đơn này không?`,
          )
        ) {
          setIsUploading(null);
          return;
        }
      }

      const currentVat =
        targetTrans.vatAmount ||
        Math.round(targetTrans.amount - targetTrans.amount / 1.1);

      await updateTransaction({
        ...targetTrans,
        attachments: [...(targetTrans.attachments || []), attachment],
        hasVATInvoice: true,
        vatAmount: currentVat,
      });

      alert(`Đã cập nhật hóa đơn thành công!`);
      window.location.reload();
    } catch (err: any) {
      alert("Lỗi: " + err.message);
    } finally {
      setIsUploading(null);
      setUploadTargetId(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleExportBatch = () => {
    const type = viewInvoiceType === "INPUT" ? "INPUT" : "OUTPUT";
    const label =
      timeViewMode === "QUARTER"
        ? `Q${currentQuarter}_${currentYear}`
        : `M${currentMonth}_${currentYear}`;
    const { start, end } = getDateRange();

    const targetType =
      viewInvoiceType === "INPUT"
        ? TransactionType.EXPENSE
        : TransactionType.INCOME;

    const periodTrans = transactions.filter(
      (t) =>
        t.type === targetType &&
        t.date >= start &&
        t.date <= end &&
        (t.status === TransactionStatus.PAID || t.hasVATInvoice),
    );

    exportTaxManifestToExcel(periodTrans, partners, label, type);
  };

  const toggleProjectSelect = (id: string) => {
    setOutputPlan((prev) => ({
      ...prev,
      selectedProjectIds: prev.selectedProjectIds.includes(id)
        ? prev.selectedProjectIds.filter((pid) => pid !== id)
        : [...prev.selectedProjectIds, id],
    }));
  };
  const toggleTransactionSelect = (id: string) => {
    setOutputPlan((prev) => ({
      ...prev,
      selectedTransactionIds: prev.selectedTransactionIds.includes(id)
        ? prev.selectedTransactionIds.filter((tid) => tid !== id)
        : [...prev.selectedTransactionIds, id],
    }));
  };
  const toggleLaborConfirm = (id: string) => {
    setOutputPlan((prev) => ({
      ...prev,
      confirmedLaborTransIds: prev.confirmedLaborTransIds.includes(id)
        ? prev.confirmedLaborTransIds.filter((tid) => tid !== id)
        : [...prev.confirmedLaborTransIds, id],
    }));
  };
  const toggleInternalConfirm = (id: string) => {
    setOutputPlan((prev) => ({
      ...prev,
      confirmedInternalTransIds: prev.confirmedInternalTransIds.includes(id)
        ? prev.confirmedInternalTransIds.filter((tid) => tid !== id)
        : [...prev.confirmedInternalTransIds, id],
    }));
  };
  const handleAllocationChange = (transId: string, mappingKey: string) => {
    setOutputPlan((prev) => ({
      ...prev,
      customAllocations: { ...prev.customAllocations, [transId]: mappingKey },
    }));
  };
  const addManualItem = () => {
    if (!newManualItemName || !newManualItemValue) return;
    setOutputPlan((prev) => ({
      ...prev,
      manualItems: [
        ...prev.manualItems,
        {
          id: `m_${Date.now()}`,
          name: newManualItemName,
          value: newManualItemValue,
        },
      ],
    }));
    setNewManualItemName("");
    setNewManualItemValue(0);
  };
  const removeManualItem = (id: string) => {
    setOutputPlan((prev) => ({
      ...prev,
      manualItems: prev.manualItems.filter((i) => i.id !== id),
    }));
  };
  const handleSaveProjectValue = async (project: Project) => {
    if (editProjectValue < 0) return;
    const updated = { ...project, contractTotalValue: editProjectValue };
    await updateProject(updated);
    setEditingProjectId(null);
    window.location.reload();
  };
  const handleSavePlan = () => {
    saveCostPlan(localCostPlan);
    setShowConfigModal(false);
  };

  const handleRemoveTarget = (id: string) => {
    setLocalCostPlan((prev) => ({
      ...prev,
      targets: prev.targets?.filter((t) => t.id !== id),
    }));
  };
  const handleAddTarget = () => {
    if (!newTargetName || !newTargetPercent) return;
    const newTarget: CostTarget = {
      id: `ct_${Date.now()}`,
      label: newTargetName,
      percent: Number(newTargetPercent),
      mappingKey: newTargetKey,
    };
    setLocalCostPlan((prev) => ({
      ...prev,
      targets: [...(prev.targets || []), newTarget],
    }));
    setNewTargetName("");
    setNewTargetPercent(0);
  };

  return (
    <div className="flex flex-col h-screen -m-8 bg-[#fcfdfe] pb-20 relative">
      {/* HEADER */}
      <div className="bg-white border-b border-slate-100 px-10 py-6 flex justify-between items-center shrink-0 z-30 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="bg-indigo-600 p-3 rounded-2xl text-white shadow-lg shadow-indigo-100">
            <Scale size={24} />
          </div>
          <div>
            <h1 className="text-xl font-black text-slate-900 uppercase tracking-tighter">
              CFO Center
            </h1>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
              Trung tâm Kiểm soát Tài chính & Thuế
            </p>
          </div>
        </div>

        <div className="flex bg-slate-100 p-1 rounded-xl">
          <button
            onClick={() => setActiveTab("INVOICE")}
            className={`flex items-center px-5 py-2.5 rounded-lg text-[11px] font-black uppercase tracking-widest transition-all ${activeTab === "INVOICE" ? "bg-white text-indigo-700 shadow-md" : "text-slate-400 hover:text-slate-600"}`}
          >
            <Receipt size={16} className="mr-2" /> Kiểm soát Hóa đơn
          </button>
          <button
            onClick={() => setActiveTab("DASHBOARD")}
            className={`flex items-center px-5 py-2.5 rounded-lg text-[11px] font-black uppercase tracking-widest transition-all ${activeTab === "DASHBOARD" ? "bg-white text-indigo-700 shadow-md" : "text-slate-400 hover:text-slate-600"}`}
          >
            <PieChart size={16} className="mr-2" /> Cân đối Thuế
          </button>
          <button
            onClick={() => setActiveTab("TAX")}
            className={`flex items-center px-5 py-2.5 rounded-lg text-[11px] font-black uppercase tracking-widest transition-all ${activeTab === "TAX" ? "bg-white text-indigo-700 shadow-md" : "text-slate-400 hover:text-slate-600"}`}
          >
            <ShieldAlert size={16} className="mr-2" /> KPI & Rủi ro
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-hidden p-4 flex flex-col">
        {/* GLOBAL TIME FILTER CONTROL */}
        <div className="flex items-center gap-4 bg-white p-2 rounded-2xl border border-slate-200 shadow-sm w-fit animate-in slide-in-from-top-2">
          <div className="flex bg-slate-100 p-1 rounded-xl">
            <button
              onClick={() => setTimeViewMode("MONTH")}
              className={`px-4 py-1.5 rounded-lg text-[10px] font-bold uppercase transition-all ${timeViewMode === "MONTH" ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500"}`}
            >
              Tháng
            </button>
            <button
              onClick={() => setTimeViewMode("QUARTER")}
              className={`px-4 py-1.5 rounded-lg text-[10px] font-bold uppercase transition-all ${timeViewMode === "QUARTER" ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500"}`}
            >
              Quý
            </button>
          </div>

          <div className="h-6 w-px bg-slate-200"></div>

          <div className="flex items-center gap-2">
            {timeViewMode === "QUARTER" ? (
              <div className="flex items-center bg-slate-50 border border-slate-200 rounded-xl px-3 py-2">
                <CalendarRange size={16} className="text-slate-400 mr-2" />
                <select
                  className="bg-transparent text-sm font-bold text-slate-700 outline-none cursor-pointer"
                  value={currentQuarter}
                  onChange={(e) => setCurrentQuarter(Number(e.target.value))}
                >
                  <option value={1}>Quý 1</option>
                  <option value={2}>Quý 2</option>
                  <option value={3}>Quý 3</option>
                  <option value={4}>Quý 4</option>
                </select>
              </div>
            ) : (
              <div className="flex items-center bg-slate-50 border border-slate-200 rounded-xl px-3 py-2">
                <Calendar size={16} className="text-slate-400 mr-2" />
                <select
                  className="bg-transparent text-sm font-bold text-slate-700 outline-none cursor-pointer"
                  value={currentMonth}
                  onChange={(e) => setCurrentMonth(Number(e.target.value))}
                >
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                    <option key={m} value={m}>
                      Tháng {m}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="flex items-center bg-slate-50 border border-slate-200 rounded-xl px-3 py-2">
              <input
                type="number"
                className="bg-transparent text-sm font-bold text-slate-700 outline-none w-16 text-center"
                value={currentYear}
                onChange={(e) => setCurrentYear(Number(e.target.value))}
                min="2020"
                max="2030"
              />
            </div>
          </div>
        </div>

        {/* TAB: INVOICE CONTROL */}
        {activeTab === "INVOICE" && (
          <div className="flex-1 min-h-0 flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-4">
            {/* 1. FILTERS & BULK ACTIONS */}
            <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white p-4 rounded-[24px] border border-slate-200 shadow-sm shrink-0">
              <div className="flex items-center gap-4">
                <div className="flex bg-slate-100 p-1 rounded-xl">
                  <button
                    onClick={() => setViewInvoiceType("INPUT")}
                    className={`px-6 py-2.5 rounded-lg text-xs font-black uppercase transition-all ${viewInvoiceType === "INPUT" ? "bg-rose-500 text-white shadow-md" : "text-slate-500 hover:bg-white"}`}
                  >
                    Đầu vào (Mua)
                  </button>
                  <button
                    onClick={() => setViewInvoiceType("OUTPUT")}
                    className={`px-6 py-2.5 rounded-lg text-xs font-black uppercase transition-all ${viewInvoiceType === "OUTPUT" ? "bg-emerald-500 text-white shadow-md" : "text-slate-500 hover:bg-white"}`}
                  >
                    Đầu ra (Bán)
                  </button>
                </div>
                {selectedInvoiceIds.size > 0 && (
                  <button
                    onClick={handleBulkDownload}
                    className="flex items-center px-4 py-2.5 bg-blue-600 text-white rounded-xl font-bold text-[10px] uppercase hover:bg-blue-700 transition-all animate-in slide-in-from-left-2 shadow-lg"
                  >
                    <Download size={14} className="mr-2" /> Tải{" "}
                    {selectedInvoiceIds.size} file đã chọn
                  </button>
                )}
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => setShowStandaloneModal(true)}
                  className="px-5 py-2.5 bg-white border-2 border-indigo-100 text-indigo-600 rounded-xl font-black text-[10px] uppercase hover:bg-indigo-50 transition-all flex items-center"
                >
                  <Upload size={14} className="mr-2" /> Up Hóa đơn lẻ
                </button>
                <button
                  onClick={handleExportBatch}
                  className="px-5 py-2.5 bg-indigo-600 text-white rounded-xl font-black text-[10px] uppercase hover:bg-indigo-700 transition-all flex items-center shadow-lg shadow-indigo-200"
                >
                  <Archive size={14} className="mr-2" /> Tải Bảng kê & File
                  (ZIP)
                </button>
              </div>
            </div>

            {/* 2. SUMMARY CARDS */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 shrink-0">
              <div className="bg-white p-5 rounded-[24px] border border-slate-100 shadow-sm flex flex-col justify-between">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  Tổng Giá Trị (Chưa VAT)
                </p>
                <p className="text-2xl font-black text-slate-800">
                  {invoiceStats.totalValue.toLocaleString()} ₫
                </p>
              </div>
              <div className="bg-white p-5 rounded-[24px] border border-slate-100 shadow-sm flex flex-col justify-between">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  Tổng Tiền Thuế GTGT
                </p>
                <p className="text-2xl font-black text-indigo-600">
                  {invoiceStats.totalVAT.toLocaleString()} ₫
                </p>
              </div>
              <div className="bg-rose-50 p-5 rounded-[24px] border border-rose-100 shadow-sm flex flex-col justify-between relative overflow-hidden group">
                <div>
                  <p className="text-[10px] font-black text-rose-500 uppercase tracking-widest flex items-center">
                    <AlertTriangle size={12} className="mr-1" /> Thiếu Hóa Đơn
                  </p>
                  <p className="text-2xl font-black text-rose-600">
                    {invoiceStats.missingCount}{" "}
                    <span className="text-sm font-bold text-rose-400">
                      giao dịch
                    </span>
                  </p>
                </div>
              </div>
              <div className="bg-white p-5 rounded-[24px] border border-slate-100 shadow-sm flex flex-col justify-between">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  Giá trị cần thu thập
                </p>
                <p className="text-2xl font-black text-slate-800">
                  {invoiceStats.missingValue.toLocaleString()} ₫
                </p>
              </div>
            </div>

            {/* 3. TABLE AREA */}
            <div className="flex-1 bg-white rounded-[32px] border border-slate-200 shadow-sm overflow-hidden flex flex-col">
              {/* Table Filters */}
              <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
                <div className="flex bg-white p-1 rounded-xl border border-slate-200">
                  <button
                    onClick={() => setFilterStatus("ALL")}
                    className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase ${filterStatus === "ALL" ? "bg-slate-800 text-white" : "text-slate-500 hover:bg-slate-50"}`}
                  >
                    Tất cả
                  </button>
                  <button
                    onClick={() => setFilterStatus("MISSING")}
                    className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase ${filterStatus === "MISSING" ? "bg-rose-500 text-white" : "text-slate-500 hover:bg-slate-50"}`}
                  >
                    Thiếu HĐ
                  </button>
                  <button
                    onClick={() => setFilterStatus("COMPLETED")}
                    className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase ${filterStatus === "COMPLETED" ? "bg-emerald-500 text-white" : "text-slate-500 hover:bg-slate-50"}`}
                  >
                    Đủ HĐ
                  </button>
                </div>
                <div className="relative w-64">
                  <Search
                    size={14}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                  />
                  <input
                    className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-indigo-500"
                    placeholder="Tìm theo nội dung, đối tác..."
                    value={textSearch}
                    onChange={(e) => setTextSearch(e.target.value)}
                  />
                </div>
              </div>

              <div className="flex-1 overflow-y-auto custom-scrollbar">
                <table className="w-full text-sm text-left">
                  <thead className="bg-slate-50 text-slate-500 font-black uppercase text-[10px] tracking-widest sticky top-0 z-10 border-b border-slate-200">
                    <tr>
                      <th className="px-4 py-4 w-10 text-center">
                        <input
                          type="checkbox"
                          className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                          onChange={(e) => {
                            if (e.target.checked)
                              setSelectedInvoiceIds(
                                new Set(invoiceControlData.map((t) => t.id)),
                              );
                            else setSelectedInvoiceIds(new Set());
                          }}
                          checked={
                            selectedInvoiceIds.size ===
                              invoiceControlData.length &&
                            invoiceControlData.length > 0
                          }
                        />
                      </th>
                      <th className="px-6 py-4">Ngày / Số CT</th>
                      <th className="px-6 py-4">Nội dung</th>
                      <th className="px-6 py-4">Đối tác / MST</th>
                      <th className="px-6 py-4 text-right">
                        Giá trị (Chưa VAT)
                      </th>
                      <th className="px-6 py-4 text-right">Tiền thuế</th>
                      <th className="px-6 py-4 text-center">Trạng thái</th>
                      <th className="px-6 py-4 text-right">File</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {invoiceControlData.map((t) => (
                      <tr
                        key={t.id}
                        className={`hover:bg-slate-50 transition-colors group ${selectedInvoiceIds.has(t.id) ? "bg-indigo-50/50" : ""}`}
                      >
                        <td className="px-4 py-4 text-center align-top">
                          <input
                            type="checkbox"
                            className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                            checked={selectedInvoiceIds.has(t.id)}
                            onChange={() => toggleInvoiceSelect(t.id)}
                          />
                        </td>
                        <td className="px-6 py-4 align-top">
                          <div className="font-mono text-xs font-bold text-slate-600">
                            {new Date(t.date).toLocaleDateString("vi-VN")}
                          </div>
                          <div className="text-[9px] text-slate-400 mt-1">
                            {t.code}
                          </div>
                        </td>
                        <td className="px-6 py-4 align-top max-w-xs">
                          <div
                            className="font-bold text-slate-800 line-clamp-2"
                            title={t.description}
                          >
                            {t.description}
                          </div>
                          <div className="text-[10px] text-slate-500 mt-1 italic">
                            {projects.find((p) => p.id === t.projectId)?.name ||
                              "Chi phí chung"}
                          </div>
                        </td>
                        <td className="px-6 py-4 align-top">
                          <div className="font-bold text-xs text-slate-700">
                            {partners.find((p) => p.id === t.partnerId)?.name ||
                              t.payerName ||
                              "Vãng lai"}
                          </div>
                          <div className="text-[9px] text-slate-400 font-mono mt-0.5">
                            {partners.find((p) => p.id === t.partnerId)
                              ?.taxCode || "---"}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right font-bold text-slate-700 align-top">
                          {t.amount.toLocaleString()} ₫
                        </td>
                        <td className="px-6 py-4 text-right font-mono text-indigo-600 align-top">
                          {t.estimatedVAT
                            ? t.estimatedVAT.toLocaleString()
                            : "-"}
                        </td>
                        <td className="px-6 py-4 text-center align-top">
                          {t.invoiceStatus === "MISSING" ? (
                            <span className="inline-flex items-center px-2 py-1 rounded bg-rose-50 text-rose-600 text-[9px] font-black uppercase border border-rose-100">
                              <AlertCircle size={10} className="mr-1" /> Thiếu
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-1 rounded bg-emerald-50 text-emerald-600 text-[9px] font-black uppercase border border-emerald-100">
                              <CheckCircle2 size={10} className="mr-1" /> Đủ
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-right align-top">
                          {t.invoiceStatus === "MISSING" ? (
                            <button
                              onClick={() => {
                                setUploadTargetId(t.id);
                                fileInputRef.current?.click();
                              }}
                              className="text-[10px] font-bold text-white bg-indigo-600 px-3 py-1.5 rounded-lg hover:bg-indigo-700 transition-all shadow-md flex items-center ml-auto disabled:opacity-70"
                              disabled={!!isUploading}
                            >
                              {isUploading === t.id ? (
                                <Loader2
                                  size={12}
                                  className="animate-spin mr-1"
                                />
                              ) : (
                                <Upload size={12} className="mr-1" />
                              )}
                              Up HĐ
                            </button>
                          ) : (
                            <div className="flex gap-1 justify-end">
                              {t.attachments?.map((att, i) => (
                                <a
                                  key={i}
                                  href={att.url}
                                  target="_blank"
                                  className="p-1.5 bg-slate-100 text-slate-500 rounded hover:bg-white hover:text-indigo-600 hover:shadow-sm border border-transparent hover:border-slate-200"
                                  title={att.name}
                                >
                                  <FileText size={14} />
                                </a>
                              ))}
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                    {invoiceControlData.length === 0 && (
                      <tr>
                        <td
                          colSpan={8}
                          className="text-center py-20 text-slate-400 italic"
                        >
                          Không có dữ liệu hóa đơn phù hợp.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: DASHBOARD (Tax Balance) */}
        {activeTab === "DASHBOARD" && (
          <div className="flex-1 min-h-0 flex gap-6 animate-in fade-in slide-in-from-bottom-4 overflow-hidden">
            {/* LEFT COLUMN: SOURCE SELECTION */}
            <div className="w-[480px] bg-white rounded-[32px] border border-slate-200 shadow-sm flex flex-col overflow-hidden shrink-0">
              {/* Session Indicator */}
              <div className="px-6 py-4 bg-indigo-50 border-b border-indigo-100 flex items-center justify-between">
                <div className="flex items-center gap-2 text-indigo-700 font-bold text-xs uppercase">
                  <Lock size={12} />
                  <span>
                    Phiên:{" "}
                    {timeViewMode === "QUARTER"
                      ? `Quý ${currentQuarter}`
                      : `Tháng ${currentMonth}`}{" "}
                    / {currentYear}
                  </span>
                </div>
              </div>

              {/* Tabs Switcher */}
              <div className="flex border-b border-slate-100">
                <button
                  onClick={() => setSourceTab("REVENUE")}
                  className={`flex-1 py-4 text-xs font-black uppercase tracking-widest flex items-center justify-center ${sourceTab === "REVENUE" ? "bg-indigo-50 text-indigo-700 border-b-2 border-indigo-600" : "text-slate-400 hover:text-slate-600"}`}
                >
                  <Coins size={14} className="mr-2" /> Nguồn Thu (Output)
                </button>
                <button
                  onClick={() => setSourceTab("EXPENSE")}
                  className={`flex-1 py-4 text-xs font-black uppercase tracking-widest flex items-center justify-center ${sourceTab === "EXPENSE" ? "bg-orange-50 text-orange-700 border-b-2 border-orange-600" : "text-slate-400 hover:text-slate-600"}`}
                >
                  <Wallet size={14} className="mr-2" /> Nguồn Chi (Input)
                </button>
              </div>

              <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-6">
                {sourceTab === "REVENUE" ? (
                  <>
                    {/* NEW: REVENUE FILTERS & SEARCH */}
                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-3">
                      <div className="relative">
                        <Search
                          size={14}
                          className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                        />
                        <input
                          className="w-full pl-9 pr-3 py-2 text-xs font-bold rounded-lg border border-slate-200 focus:border-indigo-500 outline-none"
                          placeholder="Tìm dự án, mã, nội dung thu..."
                          value={revenueSearch}
                          onChange={(e) => setRevenueSearch(e.target.value)}
                        />
                      </div>
                      <div className="flex justify-between items-center">
                        <label className="flex items-center gap-2 cursor-pointer text-[10px] font-bold text-slate-600">
                          <Globe
                            size={12}
                            className={
                              revenueTimeScope === "ALL"
                                ? "text-indigo-600"
                                : "text-slate-400"
                            }
                          />
                          <select
                            className="bg-transparent outline-none cursor-pointer hover:text-indigo-700"
                            value={revenueTimeScope}
                            onChange={(e) =>
                              setRevenueTimeScope(e.target.value as any)
                            }
                          >
                            <option value="ALL">Hiển thị: Tất cả dự án</option>
                            <option value="IN_PERIOD">
                              Hiển thị: Có phát sinh trong kỳ
                            </option>
                          </select>
                        </label>
                      </div>
                    </div>

                    {/* NEW: MANUAL REVENUE INPUT (QUICK ADD) */}
                    <div className="bg-white border-2 border-dashed border-indigo-100 p-3 rounded-xl">
                      <p className="text-[9px] font-black text-indigo-400 uppercase tracking-widest mb-2 flex items-center">
                        <Plus size={10} className="mr-1" /> Thêm nguồn thu thủ
                        công (Ngoài dự án)
                      </p>
                      <div className="flex gap-2 mb-2">
                        <input
                          className="flex-1 p-2 border border-slate-200 rounded-lg text-xs font-bold"
                          placeholder="Tên nguồn thu (VD: Xử lý ngoài...)"
                          value={newManualItemName}
                          onChange={(e) => setNewManualItemName(e.target.value)}
                        />
                        <input
                          type="number"
                          className="w-24 p-2 border border-slate-200 rounded-lg text-xs font-bold text-right"
                          placeholder="Số tiền"
                          value={newManualItemValue || ""}
                          onChange={(e) =>
                            setNewManualItemValue(Number(e.target.value))
                          }
                        />
                      </div>
                      <button
                        onClick={addManualItem}
                        disabled={!newManualItemName || !newManualItemValue}
                        className="w-full py-1.5 bg-indigo-50 text-indigo-700 rounded-lg text-[10px] font-black uppercase hover:bg-indigo-100 disabled:opacity-50"
                      >
                        Thêm vào cân đối
                      </button>
                    </div>

                    {/* Manual Items List */}
                    {outputPlan.manualItems.length > 0 && (
                      <div className="space-y-2">
                        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">
                          Nguồn thu thủ công
                        </h4>
                        {outputPlan.manualItems.map((item) => (
                          <div
                            key={item.id}
                            className="flex justify-between items-center p-2 bg-indigo-50/50 rounded-lg border border-indigo-100"
                          >
                            <span className="text-xs font-bold text-slate-700">
                              {item.name}
                            </span>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-indigo-700">
                                {item.value.toLocaleString()}
                              </span>
                              <button
                                onClick={() => removeManualItem(item.id)}
                                className="text-slate-400 hover:text-red-500"
                              >
                                <X size={12} />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Projects List */}
                    <div>
                      <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center ml-2">
                        <Building2 size={12} className="mr-1" /> Công trình / Dự
                        án ({filteredProjects.length})
                      </h4>
                      <div className="space-y-2">
                        {filteredProjects.map((p) => {
                          const isSelected =
                            outputPlan.selectedProjectIds.includes(p.id);
                          return (
                            <div
                              key={p.id}
                              onClick={() => toggleProjectSelect(p.id)}
                              className={`flex items-center justify-between p-3 rounded-xl border-2 cursor-pointer transition-all duration-200 ${isSelected ? "border-indigo-600 bg-indigo-50 shadow-sm" : "border-slate-100 bg-white hover:border-indigo-200"}`}
                            >
                              <div className="flex items-center gap-3 flex-1 min-w-0">
                                <div
                                  className={`w-5 h-5 rounded flex items-center justify-center transition-colors ${isSelected ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-300"}`}
                                >
                                  {isSelected && <CheckSquare size={12} />}
                                </div>
                                <div className="truncate">
                                  <p
                                    className={`text-xs font-bold truncate ${isSelected ? "text-indigo-900" : "text-slate-700"}`}
                                    title={p.name}
                                  >
                                    {p.name}
                                  </p>
                                  <p className="text-[9px] text-slate-400">
                                    {p.code}
                                  </p>
                                </div>
                              </div>
                              <div className="text-right">
                                {editingProjectId === p.id ? (
                                  <div
                                    className="flex items-center gap-1"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <input
                                      type="number"
                                      className="w-24 text-right text-xs font-bold border border-indigo-300 rounded px-1 py-1 outline-none"
                                      value={editProjectValue}
                                      onChange={(e) =>
                                        setEditProjectValue(
                                          Number(e.target.value),
                                        )
                                      }
                                      autoFocus
                                    />
                                    <button
                                      onClick={() => handleSaveProjectValue(p)}
                                      className="p-1 bg-indigo-600 text-white rounded"
                                    >
                                      <Save size={12} />
                                    </button>
                                  </div>
                                ) : (
                                  <div
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setEditingProjectId(p.id);
                                      setEditProjectValue(
                                        p.contractTotalValue || 0,
                                      );
                                    }}
                                  >
                                    {p.isWarning ? (
                                      <div
                                        className="flex items-center text-rose-500 cursor-pointer"
                                        title="Chưa có giá trị HĐ. Bấm để nhập."
                                      >
                                        <AlertTriangle
                                          size={14}
                                          className="mr-1"
                                        />{" "}
                                        <span className="text-[10px] font-bold underline">
                                          Nhập
                                        </span>
                                      </div>
                                    ) : (
                                      <p
                                        className={`text-xs font-black cursor-pointer hover:underline ${isSelected ? "text-indigo-700" : "text-slate-700"}`}
                                        title="Bấm để sửa"
                                      >
                                        {(
                                          p.contractTotalValue || 0
                                        ).toLocaleString()}{" "}
                                        ₫
                                      </p>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                        {filteredProjects.length === 0 && (
                          <div className="text-center text-xs text-slate-400 italic py-4">
                            Không tìm thấy dự án phù hợp.
                          </div>
                        )}
                      </div>
                    </div>

                    {/* ADHOC RECEIPTS */}
                    {adhocReceipts.length > 0 && (
                      <div>
                        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center ml-2 mt-4">
                          <Receipt size={12} className="mr-1" /> Thu vãng lai
                          khác (Trong kỳ)
                        </h4>
                        <div className="space-y-2">
                          {adhocReceipts.map((t) => {
                            const isSelected =
                              outputPlan.selectedTransactionIds.includes(t.id);
                            return (
                              <div
                                key={t.id}
                                onClick={() => toggleTransactionSelect(t.id)}
                                className={`flex items-center justify-between p-3 rounded-xl border-2 cursor-pointer transition-all duration-200 ${isSelected ? "border-emerald-500 bg-emerald-50 shadow-sm" : "border-slate-100 bg-white hover:border-emerald-200"}`}
                              >
                                <div className="flex items-center gap-3 flex-1 min-w-0">
                                  <div
                                    className={`w-5 h-5 rounded flex items-center justify-center transition-colors ${isSelected ? "bg-emerald-600 text-white" : "bg-slate-100 text-slate-300"}`}
                                  >
                                    {isSelected && <CheckSquare size={12} />}
                                  </div>
                                  <div className="truncate">
                                    <p
                                      className={`text-xs font-bold truncate ${isSelected ? "text-emerald-900" : "text-slate-700"}`}
                                      title={t.description}
                                    >
                                      {t.description}
                                    </p>
                                    <p className="text-[9px] text-slate-400">
                                      {new Date(t.date).toLocaleDateString(
                                        "vi-VN",
                                      )}
                                    </p>
                                  </div>
                                </div>
                                <div className="text-right">
                                  <p
                                    className={`text-xs font-black ${isSelected ? "text-emerald-700" : "text-slate-700"}`}
                                  >
                                    {t.amount.toLocaleString()} ₫
                                  </p>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    {/* EXPENSE TAB CONTENT */}
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center ml-2">
                          <Filter size={12} className="mr-1" /> Tất cả khoản chi
                          ({expenseCandidates.length})
                        </h4>
                        <span className="text-[9px] text-slate-400 bg-slate-100 px-2 py-1 rounded">
                          Tự động map theo danh mục
                        </span>
                      </div>

                      <div className="space-y-2">
                        {expenseCandidates.map((t) => {
                          const isConfirmed =
                            t.hasVATInvoice ||
                            (t.isLaborCost &&
                              outputPlan.confirmedLaborTransIds.includes(
                                t.id,
                              )) ||
                            (!t.isLaborCost &&
                              outputPlan.confirmedInternalTransIds.includes(
                                t.id,
                              ));

                          const currentMapping = getAutoMapping(t);
                          const isValid = t.hasVATInvoice || isConfirmed;

                          return (
                            <div
                              key={t.id}
                              className={`p-3 rounded-xl border-2 transition-all ${isValid ? "border-indigo-100 bg-white" : "border-slate-100 bg-slate-50 opacity-80"}`}
                            >
                              <div className="flex justify-between items-start mb-2">
                                <div
                                  className="flex items-center gap-2 cursor-pointer"
                                  onClick={() =>
                                    !t.hasVATInvoice &&
                                    (t.isLaborCost
                                      ? toggleLaborConfirm(t.id)
                                      : toggleInternalConfirm(t.id))
                                  }
                                >
                                  <div
                                    className={`w-4 h-4 rounded flex items-center justify-center border ${isValid ? "bg-indigo-600 border-indigo-600 text-white" : "bg-white border-slate-300"}`}
                                  >
                                    {isValid && <Check size={10} />}
                                  </div>
                                  <span
                                    className={`text-[10px] font-bold ${isValid ? "text-indigo-700" : "text-slate-400"}`}
                                  >
                                    {t.hasVATInvoice ? "Có VAT" : "Hợp lệ"}
                                  </span>
                                </div>
                                <span className="text-xs font-black text-slate-800">
                                  {t.amount.toLocaleString()} ₫
                                </span>
                              </div>

                              <div className="mb-2">
                                <p
                                  className="text-xs font-medium text-slate-600 line-clamp-1"
                                  title={t.description}
                                >
                                  {t.description}
                                </p>
                                <p className="text-[9px] text-slate-400">
                                  {new Date(t.date).toLocaleDateString("vi-VN")}{" "}
                                  • {t.payerName || "---"}
                                </p>
                              </div>

                              <div className="relative">
                                <select
                                  className={`w-full text-[10px] font-bold uppercase py-1.5 pl-2 pr-6 rounded border appearance-none outline-none cursor-pointer ${
                                    currentMapping === "MATERIAL"
                                      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                      : currentMapping === "LABOR"
                                        ? "bg-orange-50 text-orange-700 border-orange-200"
                                        : currentMapping === "MARKETING"
                                          ? "bg-purple-50 text-purple-700 border-purple-200"
                                          : currentMapping === "OFFICE"
                                            ? "bg-blue-50 text-blue-700 border-blue-200"
                                            : "bg-slate-100 text-slate-600 border-slate-200"
                                  }`}
                                  value={currentMapping}
                                  onChange={(e) =>
                                    handleAllocationChange(t.id, e.target.value)
                                  }
                                >
                                  {(
                                    localCostPlan.targets ||
                                    DEFAULT_COST_TARGETS
                                  ).map((tgt) => (
                                    <option key={tgt.id} value={tgt.mappingKey}>
                                      {tgt.label}
                                    </option>
                                  ))}
                                </select>
                                <ChevronDown
                                  size={12}
                                  className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none opacity-50"
                                />
                              </div>
                            </div>
                          );
                        })}
                        {expenseCandidates.length === 0 && (
                          <p className="text-xs text-slate-400 italic text-center py-10">
                            Không có khoản chi nào trong kỳ này.
                          </p>
                        )}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* RIGHT COLUMN: THE TAX SHIELD & GAP ANALYSIS + AI ASSISTANT */}
            <div className="flex-1 flex flex-col gap-6 overflow-y-auto custom-scrollbar pr-2">
              {/* 1. TARGET REVENUE CARD */}
              <div className="bg-gradient-to-br from-indigo-600 to-blue-700 rounded-[32px] p-8 text-white shadow-xl relative overflow-hidden shrink-0">
                <div className="relative z-10 flex justify-between items-end">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <p className="text-[10px] font-black uppercase tracking-widest opacity-60">
                        Mục tiêu Doanh thu (Output)
                      </p>
                      <button
                        onClick={() => setShowConfigModal(true)}
                        className="bg-white/20 p-1.5 rounded-lg hover:bg-white/30 transition-colors"
                        title="Cấu hình tỷ lệ chi phí"
                      >
                        <Settings size={14} />
                      </button>
                    </div>
                    <h2 className="text-4xl font-black">
                      {balancingStats.totalPlannedRevenue.toLocaleString()} ₫
                    </h2>
                    <p className="text-xs text-indigo-100 mt-2 font-medium">
                      Dựa trên các nguồn thu đã chọn trong kỳ
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="bg-white/10 px-4 py-2 rounded-xl backdrop-blur-sm border border-white/10">
                      <p className="text-[10px] uppercase font-bold opacity-80">
                        Chi phí mục tiêu
                      </p>
                      <p className="text-xl font-bold text-emerald-300">
                        ~ {balancingStats.totalTargetExpense.toLocaleString()} ₫
                      </p>
                    </div>
                  </div>
                </div>
                <div className="absolute right-0 bottom-0 opacity-10">
                  <Coins size={150} />
                </div>
              </div>

              {/* 2. AI ASSISTANT & DAILY WISDOM */}
              <div className="bg-white rounded-[32px] border border-slate-200 shadow-sm p-6 space-y-6">
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 bg-indigo-50 rounded-xl text-indigo-600">
                    <Sparkles size={20} />
                  </div>
                  <h3 className="font-black text-slate-900 text-sm uppercase tracking-widest">
                    Góc Trợ Lý AI & Công Việc
                  </h3>
                </div>

                {/* A. Daily Tip */}
                <div className="bg-gradient-to-br from-yellow-50 to-orange-50 p-4 rounded-2xl border border-yellow-100 relative overflow-hidden group">
                  <div className="flex items-start gap-3 relative z-10">
                    <Lightbulb
                      size={24}
                      className="text-yellow-500 flex-shrink-0 mt-0.5"
                    />
                    <div>
                      <p className="text-[10px] font-black text-yellow-700 uppercase tracking-widest mb-1">
                        Mỗi ngày một lời khuyên
                      </p>
                      <p className="text-xs font-medium text-yellow-800 italic leading-relaxed">
                        "{dailyTip}"
                      </p>
                    </div>
                  </div>
                </div>

                {/* B. Smart To-Do List */}
                <div>
                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center">
                    <ListTodo size={12} className="mr-1" /> Việc cần làm ngay
                  </h4>
                  <div className="space-y-2">
                    {aiTasks.length > 0 ? (
                      aiTasks.map((task) => (
                        <div
                          key={task.id}
                          className={`flex items-start gap-3 p-3 rounded-xl border ${task.type === "URGENT" ? "bg-rose-50 border-rose-100" : "bg-slate-50 border-slate-100"}`}
                        >
                          <div
                            className={`mt-0.5 w-4 h-4 rounded border-2 flex items-center justify-center ${task.type === "URGENT" ? "border-rose-300" : "border-slate-300"}`}
                          >
                            {task.done && <Check size={10} />}
                          </div>
                          <div>
                            <p
                              className={`text-xs font-bold ${task.type === "URGENT" ? "text-rose-700" : "text-slate-700"}`}
                            >
                              {task.text}
                            </p>
                            {task.type === "URGENT" && (
                              <span className="text-[9px] font-black bg-white px-1.5 py-0.5 rounded text-rose-500 mt-1 inline-block border border-rose-100">
                                GẤP
                              </span>
                            )}
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-4 text-xs text-slate-400 italic">
                        Mọi việc đã ổn định.
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* 3. BREAKDOWN & GAP ANALYSIS */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {balancingStats.breakdown.map((item, idx) => (
                  <div
                    key={item.id}
                    className="bg-white p-5 rounded-[24px] border border-slate-200 shadow-sm flex flex-col justify-between hover:shadow-md transition-all"
                  >
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <h4 className="font-black text-slate-800 text-sm uppercase">
                          {item.label}
                        </h4>
                        <p className="text-[10px] text-slate-400 font-bold">
                          Mục tiêu: {item.percent}% (
                          {item.targetAmount.toLocaleString()})
                        </p>
                      </div>
                      <div
                        className={`p-2 rounded-xl ${item.missingAmount > 0 ? "bg-rose-50 text-rose-600" : "bg-emerald-50 text-emerald-600"}`}
                      >
                        {item.missingAmount > 0 ? (
                          <AlertTriangle size={18} />
                        ) : (
                          <CheckCircle2 size={18} />
                        )}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex justify-between items-end">
                        <span className="text-xs font-bold text-slate-500">
                          Đã có (Hợp lệ)
                        </span>
                        <span
                          className={`text-lg font-black ${item.missingAmount > 0 ? "text-orange-600" : "text-emerald-600"}`}
                        >
                          {item.actualAmount.toLocaleString()} ₫
                        </span>
                      </div>
                      <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${item.achievedPercent >= 100 ? "bg-emerald-500" : "bg-indigo-500"}`}
                          style={{
                            width: `${Math.min(item.achievedPercent, 100)}%`,
                          }}
                        ></div>
                      </div>
                      {item.missingAmount > 0 ? (
                        <div className="flex justify-between items-center bg-rose-50 p-2 rounded-lg border border-rose-100 mt-2">
                          <span className="text-[10px] font-bold text-rose-700 uppercase">
                            Cần thêm
                          </span>
                          <span className="text-xs font-black text-rose-700">
                            {item.missingAmount.toLocaleString()} ₫
                          </span>
                        </div>
                      ) : (
                        <p className="text-[10px] text-emerald-600 font-bold text-right mt-1 flex items-center justify-end">
                          <Check size={10} className="mr-1" /> Đã đủ chỉ tiêu
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === "TAX" && (
          <TaxKpiDashboard
            transactions={transactions}
            projects={projects}
            partners={partners}
            accounts={accounts}
            contracts={contracts}
          />
        )}
        {activeTab === "LABOR" && (
          <div className="p-20 text-center text-slate-400 italic">
            Tính năng Quản lý Thuế Nhân công.
          </div>
        )}
      </div>

      {/* Hidden Input for Upload */}
      <input
        type="file"
        ref={fileInputRef}
        className="hidden"
        accept="image/*,.pdf,.xml"
        onChange={handleQuickUpload}
      />

      {/* CONFIG MODAL */}
      {showConfigModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-[32px] w-full max-w-lg shadow-2xl p-8 flex flex-col max-h-[90vh]">
            <div className="flex justify-between items-center border-b border-slate-100 pb-4 shrink-0">
              <div>
                <h3 className="font-black text-xl text-slate-900 uppercase tracking-tight">
                  Cấu hình Mục Tiêu Chi Phí
                </h3>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">
                  Thiết lập tỷ lệ % chi phí hợp lệ trên doanh thu
                </p>
              </div>
              <button onClick={() => setShowConfigModal(false)}>
                <X className="text-slate-400 hover:text-slate-600" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 py-4 space-y-6">
              {localCostPlan.targets?.map((target, idx) => (
                <div
                  key={target.id}
                  className="bg-slate-50 p-4 rounded-xl border border-slate-100 relative group"
                >
                  <button
                    onClick={() => handleRemoveTarget(target.id)}
                    className="absolute top-2 right-2 text-slate-300 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X size={14} />
                  </button>
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-bold text-slate-800 text-sm">
                      {target.label}
                    </span>
                    <span className="text-[10px] font-black bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded">
                      {target.mappingKey}
                    </span>
                  </div>
                  <div>
                    <label className="flex justify-between text-[10px] font-bold text-slate-400 uppercase mb-1">
                      <span>Tỷ lệ mục tiêu (%)</span>
                      <span className="text-indigo-600">{target.percent}%</span>
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      className="w-full accent-indigo-600"
                      value={target.percent}
                      onChange={(e) => {
                        const newTargets = [...(localCostPlan.targets || [])];
                        newTargets[idx].percent = Number(e.target.value);
                        setLocalCostPlan({
                          ...localCostPlan,
                          targets: newTargets,
                        });
                      }}
                    />
                  </div>
                </div>
              ))}

              {/* Add New Target Form */}
              <div className="border-t border-slate-100 pt-4 mt-4">
                <h4 className="text-xs font-bold text-slate-500 uppercase mb-3">
                  Thêm mục tiêu mới
                </h4>
                <div className="space-y-3">
                  <input
                    className="w-full p-2 border rounded-lg text-xs font-bold"
                    placeholder="Tên mục tiêu (VD: Marketing...)"
                    value={newTargetName}
                    onChange={(e) => setNewTargetName(e.target.value)}
                  />
                  <div className="flex gap-2">
                    <input
                      type="number"
                      className="w-20 p-2 border rounded-lg text-xs font-bold"
                      placeholder="%"
                      value={newTargetPercent || ""}
                      onChange={(e) =>
                        setNewTargetPercent(Number(e.target.value))
                      }
                    />
                    <select
                      className="flex-1 p-2 border rounded-lg text-xs font-bold"
                      value={newTargetKey}
                      onChange={(e) => setNewTargetKey(e.target.value as any)}
                    >
                      <option value="OTHER">Chi phí Khác (Có VAT)</option>
                      <option value="MARKETING">Marketing (Có VAT)</option>
                      <option value="OFFICE">Văn phòng (Có VAT)</option>
                      <option value="MATERIAL">Vật tư</option>
                      <option value="LABOR">Nhân công</option>
                    </select>
                    <button
                      onClick={handleAddTarget}
                      className="bg-indigo-600 text-white px-3 rounded-lg"
                    >
                      <Plus size={16} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
            <div className="flex gap-3 pt-4 border-t border-slate-100 shrink-0">
              <button
                onClick={() => setShowConfigModal(false)}
                className="flex-1 py-3 text-slate-500 font-bold hover:bg-slate-50 rounded-xl"
              >
                Hủy
              </button>
              <button
                onClick={handleSavePlan}
                className="flex-1 py-3 bg-indigo-600 text-white font-bold rounded-xl shadow-lg hover:bg-indigo-700"
              >
                Lưu Cấu Hình
              </button>
            </div>
          </div>
        </div>
      )}

      {/* STANDALONE INVOICE UPLOAD MODAL */}
      {showStandaloneModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl w-full max-w-lg p-6 shadow-2xl space-y-4">
            <div className="flex justify-between items-center border-b pb-4">
              <h3 className="font-bold text-lg text-slate-800">
                Upload Hóa Đơn Lẻ
              </h3>
              <button onClick={() => setShowStandaloneModal(false)}>
                <X size={20} className="text-slate-400" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="border-2 border-dashed border-slate-200 rounded-xl p-6 text-center hover:bg-slate-50 transition-colors cursor-pointer relative">
                {isScanning ? (
                  <div className="flex flex-col items-center text-indigo-600">
                    <Loader2 size={24} className="animate-spin mb-2" />
                    <span className="text-xs font-bold">
                      AI đang đọc hóa đơn...
                    </span>
                  </div>
                ) : (
                  <>
                    <Upload size={32} className="mx-auto text-slate-300 mb-2" />
                    <p className="text-sm font-bold text-slate-600">
                      Chọn file ảnh/PDF hóa đơn
                    </p>
                    <input
                      type="file"
                      className="absolute inset-0 opacity-0 cursor-pointer"
                      accept="image/*,.pdf"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        setIsScanning(true);
                        try {
                          const [aiResult, att] = await Promise.all([
                            extractTransactionFromImage(file),
                            uploadFileToDrive(file),
                          ]);
                          setScannedTransaction({
                            date:
                              aiResult.date ||
                              new Date().toISOString().split("T")[0],
                            amount: aiResult.amount || 0,
                            description: aiResult.description || file.name,
                            partnerId: "",
                            attachments: [att],
                            hasVATInvoice: true,
                            status: TransactionStatus.PAID,
                            type: TransactionType.EXPENSE,
                          });
                        } catch (err) {
                          alert("Lỗi: " + err);
                        } finally {
                          setIsScanning(false);
                        }
                      }}
                    />
                  </>
                )}
              </div>

              {scannedTransaction.attachments && (
                <div className="space-y-3 bg-slate-50 p-4 rounded-xl border border-slate-100">
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">
                      Ngày chứng từ
                    </label>
                    <input
                      type="date"
                      className="w-full p-2 rounded border border-slate-200 font-bold text-sm"
                      value={scannedTransaction.date || ""}
                      onChange={(e) =>
                        setScannedTransaction({
                          ...scannedTransaction,
                          date: e.target.value,
                        })
                      }
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">
                      Số tiền (VNĐ)
                    </label>
                    <input
                      type="number"
                      className="w-full p-2 rounded border border-slate-200 font-bold text-sm"
                      value={scannedTransaction.amount || 0}
                      onChange={(e) =>
                        setScannedTransaction({
                          ...scannedTransaction,
                          amount: Number(e.target.value),
                        })
                      }
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">
                      Diễn giải
                    </label>
                    <input
                      className="w-full p-2 rounded border border-slate-200 font-bold text-sm"
                      value={scannedTransaction.description || ""}
                      onChange={(e) =>
                        setScannedTransaction({
                          ...scannedTransaction,
                          description: e.target.value,
                        })
                      }
                    />
                  </div>

                  <button
                    onClick={() => {
                      if (!scannedTransaction.amount) return;
                      onAddTransaction({
                        id: `t_scan_${Date.now()}`,
                        code: `INV-${Date.now().toString().slice(-6)}`,
                        date: scannedTransaction.date!,
                        amount: scannedTransaction.amount!,
                        description: scannedTransaction.description!,
                        type: TransactionType.EXPENSE,
                        scope: TransactionScope.PROJECT,
                        category: "Chi phí HĐ",
                        projectId: "",
                        partnerId: "",
                        status: TransactionStatus.PAID,
                        targetAccountId: "acc_default",
                        attachments: scannedTransaction.attachments,
                        hasVATInvoice: true,
                        createdAt: new Date().toISOString(),
                      } as Transaction);
                      setShowStandaloneModal(false);
                      setScannedTransaction({});
                      //   window.location.reload();
                      alert("Đã lưu hóa đơn!");
                    }}
                    className="w-full py-3 bg-indigo-600 text-white rounded-xl font-bold uppercase text-xs hover:bg-indigo-700 shadow-lg"
                  >
                    Lưu Giao Dịch
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default InvoiceBalanceManager;
