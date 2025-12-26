
import { Transaction, Project, TransactionType } from '../types';

export const exportToMisaCSV = (transactions: Transaction[], projects: Project[]) => {
  // Tiêu chuẩn MISA: Ngày CT, Số CT, Diễn giải, TK Nợ, TK Có, Số tiền, Đối tượng, Khoản mục CP, Công trình
  const headers = [
    'Ngày chứng từ',
    'Số chứng từ',
    'Diễn giải',
    'Tài khoản Nợ',
    'Tài khoản Có',
    'Số tiền',
    'Mã đối tác',
    'Mã vật tư',
    'Mã công trình',
    'Loại tiền'
  ];

  const rows = transactions.map(t => {
    const project = projects.find(p => p.id === t.projectId);
    
    // Logic ánh xạ tài khoản kế toán (Demo)
    const tkNo = t.type === TransactionType.EXPENSE ? (t.isMaterialCost ? '152' : '622') : '1111';
    const tkCo = t.type === TransactionType.EXPENSE ? '1111' : (t.projectId ? '131' : '511');

    return [
      t.date,
      t.misaVoucherNo || `CT-${t.id.slice(-5)}`,
      `"${t.description.replace(/"/g, '""')}"`,
      tkNo,
      tkCo,
      t.amount,
      t.partnerId || '', // MISA Partner Code
      t.isMaterialCost ? 'VT_CONG_TRINH' : '', // MISA Material Code
      `"${project?.code || ''}"`,
      'VND'
    ];
  });

  const csvContent = [
    '\uFEFF' + headers.join(','),
    ...rows.map(r => r.join(','))
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  
  link.setAttribute('href', url);
  link.setAttribute('download', `MISA_Export_${new Date().toISOString().slice(0,10)}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};
