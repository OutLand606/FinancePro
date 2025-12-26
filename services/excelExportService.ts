
import { Transaction, Project, Partner, TransactionType, Employee, TransactionScope, CashAccount } from '../types';

// Helper to escape CSV values correctly for Excel
const escapeCsv = (val: any) => {
    if (val === null || val === undefined) return '';
    let str = String(val);
    
    // Check if the value contains separators or newlines or quotes
    if (str.includes(',') || str.includes(';') || str.includes('\n') || str.includes('"')) {
        // Escape double quotes by doubling them
        str = str.replace(/"/g, '""');
        // Wrap the whole string in double quotes
        return `"${str}"`;
    }
    return str;
};

export const exportTransactionsToCSV = (
    transactions: Transaction[], 
    projects: Project[], 
    partners: Partner[] = [], 
    employees: Employee[] = []
) => {
  // Required Columns Mapping - Standard Accounting Format
  const headers = [
    'Ngày chứng từ',
    'Số chứng từ',
    'Loại phiếu',
    'Nội dung',
    'SL Chứng từ', 
    'Link Chứng từ', 
    'Số tiền',
    'Tên Đối tượng',
    'Mã Đối tượng',
    'Hạng mục/Hạch toán',
    'Tên Công trình',
    'Mã Công trình',
    'Tài khoản/Quỹ',
    'Người lập phiếu'
  ];

  const rows = transactions.map(t => {
    const project = projects.find(p => p.id === t.projectId);
    
    // Resolve Performer
    let performerName = t.performedBy;
    const performer = employees.find(e => e.id === t.performedBy);
    if (performer) performerName = performer.fullName;

    // Resolve Partner/Beneficiary
    const partner = partners.find(p => p.id === t.partnerId);
    const employee = employees.find(e => e.id === t.employeeId || e.id === t.partnerId);
    
    let objName = t.payerName || '';
    let objCode = '';
    
    if (partner) {
        objName = partner.name;
        objCode = partner.code;
    } else if (employee) {
        objName = employee.fullName;
        objCode = employee.code;
    }

    const dateParts = t.date.split('-');
    const formattedDate = dateParts.length === 3 ? `${dateParts[2]}/${dateParts[1]}/${dateParts[0]}` : t.date;
    
    // Attachments Links
    const attachmentLinks = t.attachments?.map(a => a.url.startsWith('data:') ? '(Base64 Data)' : a.url).join('; ') || '';

    return [
      formattedDate,
      t.code || `ID-${t.id.slice(-4)}`,
      t.type === TransactionType.INCOME ? 'Thu' : 'Chi',
      t.description, 
      t.attachments ? t.attachments.length : 0, 
      attachmentLinks,
      t.amount,
      objName,
      objCode,
      t.category,
      project?.name || '',
      project?.code || '',
      t.targetAccountId || '',
      performerName
    ];
  });

  // Use \uFEFF for BOM (Byte Order Mark) to ensure Excel opens with UTF-8
  const csvContent = '\uFEFF' + [
      headers.join(','), 
      ...rows.map(r => r.map(escapeCsv).join(','))
  ].join('\n');
  
  downloadFile(csvContent, `So_Thu_Chi_FinancePro_${new Date().toISOString().slice(0,10)}.csv`);
};

// NEW: Export Batch Payment for Banking with strict formatting
export const exportBatchPayment = (
    transactions: Transaction[], 
    partners: Partner[], 
    employees: Employee[],
    sourceAccount: CashAccount | undefined
) => {
  const headers = [
    'STT',
    'Mã Đơn vị trả (Source)',
    'Tài khoản trích nợ (Source Acc)', 
    'Tên người thụ hưởng (Beneficiary)',
    'Số tài khoản thụ hưởng',
    'Tại Ngân hàng',
    'Chi nhánh (Nếu có)',
    'Số tiền',
    'Nội dung chuyển khoản (Remark)',
    'Mã tham chiếu nội bộ'
  ];

  const rows = transactions.map((t, idx) => {
    let benName = '';
    let benAcc = '';
    let benBank = '';
    let benBranch = '';

    // 1. Try to find Partner
    const partner = partners.find(p => p.id === t.partnerId);
    if (partner) {
        benName = partner.name;
        benAcc = partner.bankAccountNumber || '';
        benBank = partner.bankName || '';
        benBranch = partner.bankBranch || '';
    } 
    // 2. Try to find Employee
    else {
        const emp = employees.find(e => e.id === t.employeeId || e.id === t.partnerId);
        if (emp) {
            benName = emp.fullName;
            benAcc = emp.bankAccount || '';
            benBank = emp.bankName || '';
            benBranch = emp.bankBranch || '';
        } else {
            // 3. Fallback to free text payerName if available
            benName = t.payerName || 'Không xác định';
        }
    }

    // Format account number as text for Excel (prepend ')
    const formattedBenAcc = benAcc ? `=""${benAcc}""` : ''; 

    return [
      idx + 1,
      'FINANCE_PRO', 
      sourceAccount?.accountNumber || sourceAccount?.bankName || 'CASH', // Source
      benName,
      formattedBenAcc, // Force text format for excel
      benBank,
      benBranch,
      t.amount,
      t.description,
      t.code || t.id
    ];
  });

  const csvContent = '\uFEFF' + [
      headers.join(','),
      ...rows.map(r => r.map(escapeCsv).join(','))
  ].join('\n');
  
  const bankName = sourceAccount?.bankName || 'UnknownBank';
  downloadFile(csvContent, `Lenh_Chi_Lo_${bankName}_${new Date().toISOString().slice(0,10)}.csv`);
};

export const exportForBankTransfer = (transactions: Transaction[], partners: Partner[]) => {
  // Kept for backward compatibility
  const expenseTrans = transactions.filter(t => t.type === TransactionType.EXPENSE);
  const headers = ['STT', 'TK Thu Huong', 'Ten Thu Huong', 'So Tien', 'Noi Dung', 'Ngan Hang', 'Chi Nhanh'];

  const rows = expenseTrans.map((t, idx) => {
    const partner = partners.find(p => p.id === t.partnerId);
    return [
      idx + 1,
      partner?.bankAccountNumber ? `=""${partner.bankAccountNumber}""` : '', 
      partner?.name || '',
      t.amount,
      t.transferRemark || t.description || '',
      partner?.bankName || '',
      partner?.bankBranch || ''
    ];
  });

  const csvContent = '\uFEFF' + [
      headers.join(','),
      ...rows.map(r => r.map(escapeCsv).join(','))
  ].join('\n');
  
  downloadFile(csvContent, `Lenh_Chi_Ngan_Hang_${new Date().toISOString().slice(0,10)}.csv`);
};

const downloadFile = (content: string, fileName: string) => {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};
