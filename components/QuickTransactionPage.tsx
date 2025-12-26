
import React, { useState, useEffect, useRef } from 'react';
import { UserContext, Project, Partner, Transaction, TransactionType, TransactionScope, TransactionStatus, Attachment } from '../types';
import { parseQuickToken } from '../services/tokenService';
import { createTransaction } from '../services/sheetService';
import { logAccess } from '../services/auditService';
import { Combobox } from './ui/Combobox';
import { CheckCircle, AlertTriangle, Upload, X, Paperclip, Trash2, ArrowLeft, LogOut } from 'lucide-react';

interface QuickTransactionPageProps {
  token: string;
  currentUser: UserContext;
  projects: Project[];
  partners: Partner[];
  onSuccess: () => void;
  onLogout: () => void;
}

const QuickTransactionPage: React.FC<QuickTransactionPageProps> = ({ 
  token, currentUser, projects, partners, onSuccess, onLogout 
}) => {
  const [isValidating, setIsValidating] = useState(true);
  const [tokenData, setTokenData] = useState<{ empId: string; type: TransactionType } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  // Form State
  const [amount, setAmount] = useState<number>(0);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [selectedPartner, setSelectedPartner] = useState<Partner | null>(null);
  const [description, setDescription] = useState('');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    validateToken();
  }, [token, currentUser]);

  const validateToken = async () => {
    setIsValidating(true);
    const payload = parseQuickToken(token);

    if (!payload) {
      setError("Liên kết không hợp lệ hoặc đã hết hạn.");
      setIsValidating(false);
      return;
    }

    if (payload.empId !== currentUser.id) {
      setError(`Liên kết này dành cho nhân viên ID: ${payload.empId}. Bạn đang đăng nhập với: ${currentUser.id}`);
      setIsValidating(false);
      return;
    }

    if (!currentUser.permissions.includes('TRANS_CREATE')) {
      setError("Tài khoản của bạn không có quyền tạo giao dịch.");
      setIsValidating(false);
      return;
    }

    setTokenData(payload);
    
    // Audit Log
    logAccess(currentUser, 'VIEW_DETAIL', 'SYSTEM', 'QUICK_LINK_OPEN', `Type: ${payload.type}`);
    
    setIsValidating(false);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      Array.from(files).forEach((file: File) => {
        if (file.size > 10 * 1024 * 1024) return;
        const reader = new FileReader();
        reader.onloadend = () => {
          let type: Attachment['type'] = 'OTHER';
          if (file.type.includes('image')) type = 'IMAGE';
          else if (file.type.includes('pdf')) type = 'PDF';
          
          setAttachments(prev => [...prev, {
            id: Date.now().toString() + Math.random(),
            name: file.name,
            type: type,
            url: reader.result as string,
            mimeType: file.type,
            size: file.size
          }]);
        };
        reader.readAsDataURL(file);
      });
    }
  };

  const handleSubmit = async () => {
    if (!tokenData) return;
    if (!amount || !selectedProject || !description) {
        alert("Vui lòng điền đủ: Số tiền, Công trình, Nội dung.");
        return;
    }
    if (tokenData.type === TransactionType.EXPENSE && !selectedPartner) {
        alert("Phiếu chi cần chọn Người nhận (NCC/Nhân viên).");
        return;
    }

    setIsSubmitting(true);

    try {
        const transaction: Transaction = {
            id: `qt_${Date.now()}`,
            date: new Date().toISOString().split('T')[0],
            type: tokenData.type,
            amount: amount,
            projectId: selectedProject.id,
            scope: TransactionScope.PROJECT,
            partnerId: selectedPartner?.id || '',
            category: tokenData.type === TransactionType.INCOME ? 'Thu nhanh' : 'Chi nhanh', // Generic category for quick add
            description: description,
            status: TransactionStatus.DRAFT, // Quick add goes to Draft/Submitted usually, or Paid if trusted
            performedBy: currentUser.id,
            attachments: attachments,
            createdAt: new Date().toISOString(),
            // Defaults
            targetAccountId: 'acc_cash_office', // Default to Petty Cash or specific logic
            paymentMethod: 'CASH'
        };

        await createTransaction(transaction);
        
        // Log
        logAccess(currentUser, 'CREATE', 'TRANSACTION', transaction.id, 'Via Quick Link');

        setSuccessMsg("Gửi phiếu thành công! Bạn có thể đóng tab này.");
        // Reset form
        setAmount(0);
        setDescription('');
        setAttachments([]);
    } catch (e: any) {
        alert("Lỗi: " + e.message);
    } finally {
        setIsSubmitting(false);
    }
  };

  if (isValidating) {
    return <div className="flex justify-center items-center h-screen bg-gray-50">Đang kiểm tra liên kết...</div>;
  }

  if (error) {
    return (
      <div className="flex flex-col justify-center items-center h-screen bg-gray-50 p-4 text-center">
        <div className="bg-red-100 p-4 rounded-full mb-4 text-red-600"><AlertTriangle size={48}/></div>
        <h3 className="text-xl font-bold text-gray-900 mb-2">Không thể truy cập</h3>
        <p className="text-gray-600 mb-6">{error}</p>
        <button onClick={onLogout} className="text-blue-600 font-medium">Đăng xuất & Thử lại</button>
      </div>
    );
  }

  if (successMsg) {
      return (
        <div className="flex flex-col justify-center items-center h-screen bg-green-50 p-4 text-center">
            <div className="bg-green-100 p-4 rounded-full mb-4 text-green-600"><CheckCircle size={48}/></div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">Thành Công!</h3>
            <p className="text-gray-700 mb-6">{successMsg}</p>
            <button onClick={() => { setSuccessMsg(''); window.location.reload(); }} className="px-6 py-2 bg-green-600 text-white rounded-lg">Tạo tiếp phiếu khác</button>
        </div>
      );
  }

  return (
    <div className="min-h-screen bg-gray-100 p-4 flex justify-center items-start pt-10">
      <div className="bg-white w-full max-w-md rounded-2xl shadow-xl overflow-hidden">
        {/* Header */}
        <div className={`px-6 py-4 ${tokenData?.type === TransactionType.INCOME ? 'bg-green-600' : 'bg-red-600'} text-white flex justify-between items-center`}>
            <div>
                <h2 className="text-lg font-bold flex items-center">
                    {tokenData?.type === TransactionType.INCOME ? 'Nộp Tiền Nhanh' : 'Báo Chi Nhanh'}
                </h2>
                <p className="text-xs opacity-90">Người thực hiện: {currentUser.name}</p>
            </div>
            <button onClick={onLogout} title="Đăng xuất"><LogOut size={18} className="opacity-70 hover:opacity-100" /></button>
        </div>

        <div className="p-6 space-y-5">
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Số tiền (VNĐ)</label>
                <input 
                    type="number" 
                    className="w-full text-2xl font-bold text-gray-900 border-b-2 border-gray-300 focus:border-blue-500 outline-none py-2"
                    placeholder="0"
                    autoFocus
                    value={amount === 0 ? '' : amount}
                    onChange={e => setAmount(Number(e.target.value))}
                />
            </div>

            <Combobox<Project>
                label="Công trình / Dự án"
                placeholder="Chọn công trình..."
                items={projects}
                selectedItem={selectedProject}
                onSelect={setSelectedProject}
                displayValue={p => p.name}
                renderItem={p => <div><div className="font-bold">{p.code}</div><div className="text-xs">{p.name}</div></div>}
                filterFunction={(p, q) => p.name.toLowerCase().includes(q.toLowerCase()) || p.code.toLowerCase().includes(q.toLowerCase())}
            />

            <Combobox<Partner>
                label={tokenData?.type === TransactionType.INCOME ? "Người Nộp (Khách/NV)" : "Người Nhận (NCC/Thợ)"}
                placeholder="Chọn đối tác..."
                items={partners}
                selectedItem={selectedPartner}
                onSelect={setSelectedPartner}
                displayValue={p => p.name}
                renderItem={p => <span>{p.name} ({p.phone})</span>}
                filterFunction={(p, q) => p.name.toLowerCase().includes(q.toLowerCase())}
            />

            <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nội dung</label>
                <textarea 
                    className="w-full border border-gray-300 rounded-lg p-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                    rows={2}
                    placeholder="VD: Mua xi măng, Tạm ứng..."
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                />
            </div>

            {/* Attachments */}
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Ảnh chụp chứng từ</label>
                <div 
                    className="border-2 border-dashed border-gray-300 rounded-lg p-4 flex flex-col items-center justify-center bg-gray-50 cursor-pointer hover:bg-gray-100"
                    onClick={() => fileInputRef.current?.click()}
                >
                    <Upload size={20} className="text-gray-400 mb-2" />
                    <span className="text-xs text-gray-500">Chụp ảnh hoặc chọn file</span>
                    <input ref={fileInputRef} type="file" accept="image/*,.pdf" multiple className="hidden" onChange={handleFileChange} />
                </div>
                {attachments.length > 0 && (
                    <div className="mt-2 space-y-1">
                        {attachments.map(att => (
                            <div key={att.id} className="flex justify-between items-center text-xs bg-gray-50 p-2 rounded border">
                                <span className="flex items-center truncate max-w-[200px]"><Paperclip size={12} className="mr-1"/> {att.name}</span>
                                <button onClick={() => setAttachments(prev => prev.filter(a => a.id !== att.id))} className="text-red-500"><Trash2 size={12}/></button>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <button 
                onClick={handleSubmit}
                disabled={isSubmitting}
                className={`w-full py-3 rounded-xl text-white font-bold shadow-lg transition-all transform active:scale-95 ${tokenData?.type === TransactionType.INCOME ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}`}
            >
                {isSubmitting ? 'Đang gửi...' : 'GỬI PHIẾU NGAY'}
            </button>
            
            <div className="text-center">
                <button onClick={onSuccess} className="text-xs text-gray-400 hover:text-gray-600 underline">Quay về trang chủ</button>
            </div>
        </div>
      </div>
    </div>
  );
};

export default QuickTransactionPage;
