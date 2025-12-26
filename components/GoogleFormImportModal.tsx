
import React, { useState } from 'react';
import { Transaction, TransactionType, TransactionScope, TransactionStatus, Partner } from '../types';
import { X, FileSpreadsheet, ArrowRight, CheckCircle, AlertTriangle } from 'lucide-react';

interface GoogleFormImportModalProps {
    partners: Partner[];
    onImport: (transactions: Transaction[]) => void;
    onClose: () => void;
}

const GoogleFormImportModal: React.FC<GoogleFormImportModalProps> = ({ partners, onImport, onClose }) => {
    const [pastedText, setPastedText] = useState('');
    const [parsedData, setParsedData] = useState<Transaction[]>([]);
    const [errors, setErrors] = useState<string[]>([]);
    const [step, setStep] = useState<'INPUT' | 'PREVIEW'>('INPUT');

    const parseGoogleFormData = () => {
        const lines = pastedText.trim().split('\n');
        if (lines.length < 1) {
            setErrors(['Không có dữ liệu. Vui lòng copy từ Google Sheet (bao gồm cả tiêu đề nếu có).']);
            return;
        }

        const newTransactions: Transaction[] = [];
        const parseErrors: string[] = [];

        // Simple heuristic parser: Detect columns based on typical Google Form export
        // Expected columns often: Timestamp, Description, Amount, Category, Partner/Payer
        
        lines.forEach((line, idx) => {
            // Skip header if it contains "Timestamp" or "Dấu thời gian"
            if (idx === 0 && (line.includes('Timestamp') || line.includes('thời gian') || line.includes('Ngày'))) return;

            const cols = line.split('\t');
            if (cols.length < 3) return; // Need at least Date, Content, Amount

            try {
                // Heuristic Mapping (Adjust based on user's real form)
                // Col 0: Date (often DD/MM/YYYY HH:mm:ss)
                // Col 1: Description / Content
                // Col 2: Amount (might have 'đ', ',', '.')
                // Col 3: Type/Category (Optional)
                // Col 4: Partner/Payer (Optional)

                // 1. Date Parsing
                const rawDate = cols[0];
                let dateStr = new Date().toISOString().split('T')[0];
                if (rawDate) {
                    // Try parsing DD/MM/YYYY
                    const parts = rawDate.split(' ')[0].split('/');
                    if (parts.length === 3) dateStr = `${parts[2]}-${parts[1]}-${parts[0]}`;
                    else {
                        const d = new Date(rawDate);
                        if (!isNaN(d.getTime())) dateStr = d.toISOString().split('T')[0];
                    }
                }

                // 2. Amount Parsing
                const rawAmount = cols[2] || cols[3]; // Try col 2 or 3
                const amount = Number(rawAmount?.replace(/[^0-9]/g, ''));
                if (!amount) throw new Error("Không tìm thấy số tiền hợp lệ");

                // 3. Description
                const description = cols[1] || 'Nhập từ Google Form';

                // 4. Partner Matching (Fuzzy)
                const rawPartner = cols[4] || '';
                let partnerId = '';
                if (rawPartner) {
                    const match = partners.find(p => p.name.toLowerCase().includes(rawPartner.toLowerCase()) || (p.phone && rawPartner.includes(p.phone)));
                    if (match) partnerId = match.id;
                }

                newTransactions.push({
                    id: `gf_import_${Date.now()}_${idx}`,
                    date: dateStr,
                    amount: amount,
                    description: description,
                    type: TransactionType.INCOME, // Default to INCOME for "Phiếu thu form"
                    scope: TransactionScope.PROJECT, // Default
                    category: 'Thu tiền Google Form',
                    projectId: '', // User needs to select later or map
                    partnerId: partnerId,
                    payerName: rawPartner,
                    status: TransactionStatus.PAID, // Usually forms mean money collected
                    performedBy: 'GOOGLE_FORM',
                    createdAt: new Date().toISOString()
                } as Transaction);

            } catch (e: any) {
                parseErrors.push(`Dòng ${idx + 1}: ${e.message}`);
            }
        });

        if (newTransactions.length > 0) {
            setParsedData(newTransactions);
            setStep('PREVIEW');
        } else {
            setErrors(parseErrors.length > 0 ? parseErrors : ['Không tìm thấy dữ liệu hợp lệ.']);
        }
    };

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/80 backdrop-blur-sm p-4 animate-in fade-in">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl h-[80vh] flex flex-col overflow-hidden">
                <div className="px-6 py-4 border-b bg-green-50 flex justify-between items-center">
                    <h3 className="font-black text-green-800 flex items-center gap-2">
                        <FileSpreadsheet size={20}/> Nhập dữ liệu từ Google Form (Phiếu Thu)
                    </h3>
                    <button onClick={onClose}><X size={20} className="text-green-800"/></button>
                </div>

                <div className="flex-1 overflow-y-auto p-6">
                    {step === 'INPUT' ? (
                        <div className="space-y-4 h-full flex flex-col">
                            <div className="bg-blue-50 p-4 rounded-xl text-sm text-blue-800 border border-blue-100">
                                <p className="font-bold mb-1">Hướng dẫn:</p>
                                <ul className="list-disc list-inside space-y-1">
                                    <li>Mở Google Sheet kết nối với Google Form của bạn.</li>
                                    <li>Copy vùng dữ liệu (bao gồm cả cột Thời gian, Nội dung, Số tiền...).</li>
                                    <li>Dán vào ô bên dưới và nhấn "Phân tích".</li>
                                </ul>
                            </div>
                            <textarea 
                                className="flex-1 w-full border-2 border-slate-200 rounded-xl p-4 font-mono text-xs focus:border-green-500 outline-none"
                                placeholder="Dán dữ liệu tại đây (Ctrl+V)..."
                                value={pastedText}
                                onChange={e => setPastedText(e.target.value)}
                            />
                            {errors.length > 0 && (
                                <div className="bg-red-50 p-3 rounded-lg text-red-600 text-xs">
                                    {errors.map((e, i) => <div key={i}>{e}</div>)}
                                </div>
                            )}
                            <div className="flex justify-end">
                                <button onClick={parseGoogleFormData} disabled={!pastedText} className="px-6 py-3 bg-green-600 text-white rounded-xl font-bold shadow-lg hover:bg-green-700 disabled:opacity-50">
                                    Phân tích dữ liệu <ArrowRight className="inline ml-2" size={16}/>
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <h4 className="font-bold text-slate-700">Kết quả phân tích ({parsedData.length} phiếu)</h4>
                                <button onClick={() => setStep('INPUT')} className="text-sm text-slate-500 hover:underline">Quay lại</button>
                            </div>
                            <div className="border rounded-xl overflow-hidden">
                                <table className="w-full text-sm text-left">
                                    <thead className="bg-slate-50 font-bold text-slate-500 text-xs uppercase">
                                        <tr>
                                            <th className="px-4 py-3">Ngày</th>
                                            <th className="px-4 py-3">Nội dung</th>
                                            <th className="px-4 py-3">Người nộp (Map)</th>
                                            <th className="px-4 py-3 text-right">Số tiền</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {parsedData.map((t, idx) => (
                                            <tr key={idx}>
                                                <td className="px-4 py-2">{t.date}</td>
                                                <td className="px-4 py-2">{t.description}</td>
                                                <td className="px-4 py-2">
                                                    {t.partnerId ? (
                                                        <span className="text-green-600 font-bold flex items-center"><CheckCircle size={12} className="mr-1"/> {partners.find(p=>p.id===t.partnerId)?.name}</span>
                                                    ) : (
                                                        <span className="text-orange-500 flex items-center"><AlertTriangle size={12} className="mr-1"/> {t.payerName || 'Không rõ'}</span>
                                                    )}
                                                </td>
                                                <td className="px-4 py-2 text-right font-mono font-bold">{t.amount.toLocaleString()}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            <div className="flex justify-end pt-4">
                                <button onClick={() => { onImport(parsedData); onClose(); }} className="px-8 py-3 bg-green-600 text-white rounded-xl font-bold shadow-lg hover:bg-green-700">
                                    Xác nhận Nhập {parsedData.length} Phiếu
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default GoogleFormImportModal;
