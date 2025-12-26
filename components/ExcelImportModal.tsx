
import React, { useState } from 'react';
import { Project, Transaction, TransactionType, TransactionScope, TransactionStatus, ProjectType, Partner, PartnerType } from '../types';
import { AlertTriangle, CheckCircle, FileSpreadsheet, X, HelpCircle } from 'lucide-react';

interface ExcelImportModalProps {
  type: 'PROJECT' | 'TRANSACTION' | 'PARTNER' | 'TIMESHEET';
  existingProjects?: Project[];
  onImport: (data: any[]) => void;
  onClose: () => void;
}

const ExcelImportModal: React.FC<ExcelImportModalProps> = ({ type, existingProjects = [], onImport, onClose }) => {
  const [csvContent, setCsvContent] = useState('');
  const [previewData, setPreviewData] = useState<any[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  // Helpers
  const parseCSV = (text: string) => {
      const lines = text.trim().split('\n');
      if (lines.length < 1) return [];
      
      const firstLine = lines[0];
      const separator = firstLine.includes('\t') ? '\t' : ',';
      
      const headers = lines[0].split(separator).map(h => h.trim().toLowerCase());
      const data = [];

      for (let i = 1; i < lines.length; i++) {
          const values = lines[i].split(separator).map(v => v.trim());
          // Need at least 2 columns for general, or many for timesheet
          if (values.length < 2) continue; 
          
          if (type === 'TIMESHEET') {
              data.push(values); // Keep raw array for grid parsing
          } else {
              const row: any = {};
              headers.forEach((h, index) => {
                  let key = h;
                  if (h.includes('công trình') || h.includes('dự án')) key = 'project';
                  if (h.includes('ngày')) key = 'date';
                  if (h.includes('số tiền') || h.includes('giá trị')) key = 'amount';
                  if (h.includes('nội dung') || h.includes('diễn giải')) key = 'description';
                  if (h.includes('loại')) key = 'type';
                  if (h.includes('mã')) key = 'code';
                  if (h.includes('khách hàng')) key = 'customer';
                  // Partner specific
                  if (h.includes('tên')) key = 'name';
                  if (h.includes('điện thoại') || h.includes('sdt')) key = 'phone';
                  
                  row[key] = values[index];
              });
              data.push(row);
          }
      }
      return data;
  };

  const processData = () => {
      setIsProcessing(true);
      setErrors([]);
      const rawData = parseCSV(csvContent);
      const validData: any[] = [];
      const newErrors: string[] = [];

      if (type === 'TIMESHEET') {
          // Special Grid Parsing
          // Assume Col 0 = Name, Cols 1..31 = Days
          rawData.forEach((rowArr: string[], idx) => {
              const name = rowArr[0]; // Name
              if (!name) return;
              
              const dayValues: Record<string, number> = {};
              for (let d = 1; d <= 31; d++) {
                  // If col exists
                  if (rowArr[d]) {
                      const valStr = rowArr[d].toLowerCase();
                      let val = 0;
                      if (valStr === 'x' || valStr === '1' || valStr === 'v') val = 1;
                      if (valStr === '/' || valStr === '0.5' || valStr === 'n') val = 0.5;
                      if (val > 0) dayValues[d.toString()] = val;
                  }
              }
              validData.push({ empName: name, days: dayValues });
          });
      } else {
          rawData.forEach((row, idx) => {
              try {
                  if (type === 'PARTNER') {
                      if (!row['name']) throw new Error("Thiếu Tên đối tác");
                      validData.push({
                          code: row['code'],
                          name: row['name'],
                          phone: row['phone']
                      });
                  } else if (type === 'PROJECT') {
                      // ... existing project logic ...
                      if (!row['project'] && !row['name']) throw new Error("Thiếu Tên công trình");
                      const name = row['project'] || row['name'];
                      const p: Project = {
                          id: `imp_p_${Date.now()}_${idx}`,
                          code: row['code'] || `IMP-${Date.now()}-${idx}`,
                          name: name,
                          type: ProjectType.RETAIL, 
                          customerName: row['customer'] || '',
                          contractTotalValue: Number(row['amount']?.replace(/[^0-9]/g, '')) || 0,
                          status: 'ACTIVE',
                          createdAt: new Date().toISOString()
                      };
                      validData.push(p);
                  } else if (type === 'TRANSACTION') {
                      // ... existing transaction logic ...
                      if (!row['date']) throw new Error("Thiếu Ngày");
                      if (!row['amount']) throw new Error("Thiếu Số tiền");
                      let projectId = '';
                      const projInput = (row['project'] || '').toLowerCase();
                      if (projInput) {
                          const matched = existingProjects.find(p => p.code.toLowerCase() === projInput || p.name.toLowerCase().includes(projInput));
                          if (matched) projectId = matched.id;
                          else throw new Error(`Không tìm thấy công trình khớp: "${row['project']}"`);
                      } else { throw new Error("Thiếu thông tin Công trình."); }

                      const isIncome = (row['type'] || '').toLowerCase().includes('thu');
                      const t: Transaction = {
                          id: `imp_t_${Date.now()}_${idx}`,
                          date: new Date(row['date']).toISOString().split('T')[0],
                          type: isIncome ? TransactionType.INCOME : TransactionType.EXPENSE,
                          amount: Number(row['amount']?.replace(/[^0-9-]/g, '')),
                          projectId: projectId,
                          scope: TransactionScope.PROJECT,
                          partnerId: '',
                          description: row['description'] || 'Import Excel',
                          category: 'Import Excel',
                          status: TransactionStatus.PAID,
                          performedBy: 'IMPORT',
                          attachments: [],
                          targetAccountId: 'acc_import',
                          createdAt: new Date().toISOString()
                      };
                      validData.push(t);
                  }
              } catch (e: any) {
                  newErrors.push(`Dòng ${idx + 1}: ${e.message}`);
              }
          });
      }

      setErrors(newErrors);
      setPreviewData(validData);
      setIsProcessing(false);
  };

  const handleConfirm = () => {
      onImport(previewData);
      onClose();
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4">
        <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl h-[85vh] flex flex-col">
            <div className="px-6 py-4 border-b flex justify-between items-center bg-green-50">
                <h3 className="font-bold text-green-900 flex items-center">
                    <FileSpreadsheet className="mr-2"/> Nhập dữ liệu {type} (Copy-Paste)
                </h3>
                <button onClick={onClose}><X size={20}/></button>
            </div>
            
            <div className="p-6 flex-1 overflow-y-auto space-y-4">
                <div className="bg-blue-50 p-4 rounded-lg text-sm text-blue-800 flex items-start border border-blue-100">
                    <HelpCircle size={18} className="mr-2 mt-0.5 flex-shrink-0" />
                    <div>
                        <b>Hướng dẫn:</b> Copy vùng dữ liệu từ Excel (bao gồm tiêu đề) và dán vào bên dưới.
                        {type === 'PARTNER' && <ul className="list-disc list-inside mt-1"><li>Cột cần thiết: <b>Tên đối tác, Mã (tùy chọn), Điện thoại</b></li></ul>}
                        {type === 'TIMESHEET' && <ul className="list-disc list-inside mt-1"><li>Cột 1: <b>Họ tên nhân viên</b>. Các cột tiếp theo: <b>Ngày 1, 2, 3...</b></li><li>Dữ liệu: <b>X</b> (1 công), <b>/</b> (0.5 công).</li></ul>}
                    </div>
                </div>

                <textarea 
                    className="w-full h-64 border border-gray-300 rounded-lg p-3 font-mono text-xs focus:ring-2 focus:ring-green-500 outline-none shadow-inner"
                    placeholder="Dán dữ liệu từ Excel vào đây..."
                    value={csvContent}
                    onChange={e => setCsvContent(e.target.value)}
                />

                <div className="flex justify-end">
                    <button 
                        onClick={processData}
                        disabled={!csvContent}
                        className="px-6 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-900 disabled:opacity-50 font-medium"
                    >
                        Phân tích Dữ liệu
                    </button>
                </div>

                {/* Validation Results */}
                {(previewData.length > 0 || errors.length > 0) && (
                    <div className="border-t pt-4 animate-in fade-in">
                        <h4 className="font-bold mb-3 text-gray-800">Kết quả kiểm tra:</h4>
                        {errors.length > 0 && (
                            <div className="bg-red-50 p-4 rounded-lg mb-3 border border-red-100 text-sm">
                                <ul className="list-disc list-inside text-red-600 space-y-1 max-h-32 overflow-y-auto">
                                    {errors.map((e, i) => <li key={i}>{e}</li>)}
                                </ul>
                            </div>
                        )}
                        <div className="flex justify-between items-center bg-green-50 p-4 rounded-lg border border-green-100">
                            <span className="text-green-800 font-bold flex items-center text-lg">
                                <CheckCircle size={20} className="mr-2"/> {previewData.length} dòng hợp lệ
                            </span>
                            <button 
                                onClick={handleConfirm}
                                disabled={previewData.length === 0}
                                className="px-8 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 font-bold shadow-lg disabled:opacity-50 transform active:scale-95 transition-all"
                            >
                                Xác nhận Nhập
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    </div>
  );
};

export default ExcelImportModal;
