import {
  Transaction,
  Project,
  Partner,
  TransactionType,
  Employee,
  CashAccount,
} from "../types";

// Helper to escape CSV values correctly for Excel
const escapeCsv = (val: any) => {
  if (val === null || val === undefined) return "";
  let str = String(val);
  if (
    str.includes(",") ||
    str.includes(";") ||
    str.includes("\n") ||
    str.includes('"')
  ) {
    str = str.replace(/"/g, '""');
    return `"${str}"`;
  }
  return str;
};

const downloadFile = (content: string, fileName: string) => {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

export const exportTransactionsToCSV = (
  transactions: Transaction[],
  projects: Project[],
  partners: Partner[],
  employees: Employee[],
) => {
  const headers = [
    "Ngày",
    "Mã CT",
    "Nội dung",
    "Loại",
    "Số tiền",
    "Dự án",
    "Đối tác/NV",
    "Hạng mục",
    "Trạng thái",
  ];

  const rows = transactions.map((t) => {
    let partnerName = "";
    if (t.partnerId) {
      partnerName = partners.find((p) => p.id === t.partnerId)?.name || "---";
    } else if (t.employeeId) {
      partnerName =
        employees.find((e) => e.id === t.employeeId)?.fullName || "---";
    }
    const projectCode =
      projects.find((p) => p.id === t.projectId)?.code || "---";
    return [
      t.date,
      t.code,
      t.description,
      t.type === "INCOME" ? "Thu" : "Chi",
      t.amount,
      projectCode,
      partnerName,
      t.category,
      t.status,
    ];
  });

  const csvContent =
    "\uFEFF" +
    [headers.join(","), ...rows.map((r) => r.map(escapeCsv).join(","))].join(
      "\n",
    );

  downloadFile(
    csvContent,
    `Transactions_${new Date().toISOString().slice(0, 10)}.csv`,
  );
};

export const exportTaxManifestToExcel = (
  transactions: Transaction[],
  partners: Partner[],
  periodLabel: string,
  type: "INPUT" | "OUTPUT",
) => {
  const headers = [
    "STT",
    "Ký hiệu mẫu hóa đơn",
    "Ký hiệu hóa đơn",
    "Số hóa đơn",
    "Ngày, tháng, năm phát hành",
    type === "INPUT" ? "Tên người bán" : "Tên người mua",
    "Mã số thuế",
    "Mặt hàng",
    "Doanh số mua chưa có thuế",
    "Thuế suất",
    "Thuế GTGT",
    "Tổng cộng thanh toán",
    "Ghi chú / Trạng thái",
    "Link file gốc",
  ];

  const targetType = type === "INPUT" ? "EXPENSE" : "INCOME";
  const relevantTrans = transactions.filter(
    (t) => t.type === targetType && t.hasVATInvoice,
  );

  const rows = relevantTrans.map((t, idx) => {
    const partner = partners.find((p) => p.id === t.partnerId);
    const invoiceNo = t.code || "---";
    const d = new Date(t.date);
    const dateStr = `${d.getDate().toString().padStart(2, "0")}/${(d.getMonth() + 1).toString().padStart(2, "0")}/${d.getFullYear()}`;

    let taxAmount = t.vatAmount || 0;
    let baseAmount = t.amount;
    if (t.vatAmount) {
      baseAmount = t.amount - t.vatAmount;
    } else {
      baseAmount = Math.round(t.amount / 1.1);
      taxAmount = t.amount - baseAmount;
    }

    const fileLink =
      t.attachments && t.attachments.length > 0 ? t.attachments[0].url : "";

    return [
      idx + 1,
      "1/001",
      "C24T",
      invoiceNo,
      dateStr,
      partner?.name || t.payerName || "Khách lẻ",
      partner?.taxCode || "",
      t.description,
      baseAmount,
      "10%",
      taxAmount,
      t.amount,
      "Đủ điều kiện khấu trừ",
      fileLink,
    ];
  });

  const totalBase = rows.reduce((sum, r) => sum + (r[8] as number), 0);
  const totalTax = rows.reduce((sum, r) => sum + (r[10] as number), 0);
  const totalGross = rows.reduce((sum, r) => sum + (r[11] as number), 0);

  rows.push([
    "",
    "",
    "",
    "",
    "",
    "TỔNG CỘNG",
    "",
    "",
    totalBase,
    "",
    totalTax,
    totalGross,
    "",
    "",
  ]);

  const csvContent =
    "\uFEFF" +
    [headers.join(","), ...rows.map((r) => r.map(escapeCsv).join(","))].join(
      "\n",
    );

  downloadFile(
    csvContent,
    `Bang_Ke_${type === "INPUT" ? "Mua_Vao" : "Ban_Ra"}_${periodLabel}.csv`,
  );
};

export const exportBatchPayment = (
  transactions: Transaction[],
  partners: Partner[],
  employees: Employee[],
  sourceAccount?: CashAccount,
) => {
  const headers = [
    "Mã GD",
    "Ngày",
    "Đơn vị thụ hưởng",
    "Số tài khoản",
    "Ngân hàng",
    "Số tiền",
    "Nội dung",
  ];
  const rows = transactions.map((t) => {
    let beneficiaryName = t.payerName || "";
    let bankAcc = "";
    let bankName = "";
    if (t.partnerId) {
      const p = partners.find((x) => x.id === t.partnerId);
      if (p) {
        beneficiaryName = p.name;
        bankAcc = p.bankAccountNumber || "";
        bankName = p.bankName || "";
      }
    } else if (t.employeeId) {
      const e = employees.find((x) => x.id === t.employeeId);
      if (e) {
        beneficiaryName = e.fullName;
        bankAcc = e.bankAccount || "";
        bankName = e.bankName || "";
      }
    }
    return [
      t.code,
      t.date,
      beneficiaryName,
      bankAcc,
      bankName,
      t.amount,
      t.description,
    ];
  });
  const csvContent =
    "\uFEFF" +
    [headers.join(","), ...rows.map((r) => r.map(escapeCsv).join(","))].join(
      "\n",
    );
  const bankLabel = sourceAccount?.bankName || "Bank";
  downloadFile(
    csvContent,
    `Lenh_Chi_Lo_${bankLabel}_${new Date().toISOString().slice(0, 10)}.csv`,
  );
};
