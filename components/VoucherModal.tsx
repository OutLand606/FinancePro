
import React from 'react';
import { Transaction, TransactionType } from '../types';
import { X, Printer } from 'lucide-react';

interface VoucherModalProps {
    transaction: Transaction;
    onClose: () => void;
}

// --- THUẬT TOÁN ĐỌC SỐ TIỀN BẰNG CHỮ (TIẾNG VIỆT) ---
const docSo3ChuSo = (baso: number): string => {
    const chuSo = ["không", "một", "hai", "ba", "bốn", "năm", "sáu", "bảy", "tám", "chín"];
    let tram = Math.floor(baso / 100);
    let chuc = Math.floor((baso % 100) / 10);
    let donvi = baso % 10;
    let ketqua = "";

    if (tram === 0 && chuc === 0 && donvi === 0) return "";
    
    ketqua += chuSo[tram] + " trăm";
    
    if (chuc === 0 && donvi !== 0) {
        ketqua += " linh " + chuSo[donvi];
    } else if (chuc !== 0) {
        if (chuc === 1) ketqua += " mười";
        else ketqua += " " + chuSo[chuc] + " mươi";
        
        if (donvi === 1) ketqua += " mốt";
        else if (donvi === 5) ketqua += " lăm";
        else if (donvi !== 0) ketqua += " " + chuSo[donvi];
    }
    return ketqua;
}

const readMoney = (amount: number): string => {
    if (amount === 0) return "Không đồng";
    
    const tien = Math.abs(amount);
    let str = "";
    let billions = Math.floor(tien / 1000000000);
    let millions = Math.floor((tien % 1000000000) / 1000000);
    let thousands = Math.floor((tien % 1000000) / 1000);
    let ones = Math.floor(tien % 1000);

    if (billions > 0) str += docSo3ChuSo(billions) + " tỷ";
    if (millions > 0) str += " " + docSo3ChuSo(millions) + " triệu";
    if (thousands > 0) str += " " + docSo3ChuSo(thousands) + " nghìn";
    if (ones > 0) str += " " + docSo3ChuSo(ones);

    // Chuẩn hóa chuỗi
    str = str.trim().replace(/\s+/g, ' ');
    // Viết hoa chữ cái đầu
    str = str.charAt(0).toUpperCase() + str.slice(1);
    
    return str + " đồng chẵn";
};

const VoucherModal: React.FC<VoucherModalProps> = ({ transaction, onClose }) => {
    const isIncome = transaction.type === TransactionType.INCOME;
    const title = isIncome ? 'PHIẾU THU' : 'PHIẾU CHI';
    
    const dateObj = new Date(transaction.date);
    const formattedDate = `Ngày ${dateObj.getDate()} tháng ${dateObj.getMonth() + 1} năm ${dateObj.getFullYear()}`;
    
    const partnerName = transaction.payerName || transaction.partnerId || '...........................................';
    const reason = transaction.description;
    const moneyText = readMoney(transaction.amount);

    const handlePrint = () => {
        const printContent = document.getElementById('voucher-print-area');
        if (!printContent) return;
        
        const win = window.open('', '', 'width=900,height=650');
        if (win) {
            win.document.write(`
                <html>
                    <head>
                        <title>In ${title} - ${transaction.code}</title>
                        <style>
                            @page { size: A5 landscape; margin: 0; }
                            body { font-family: 'Times New Roman', serif; margin: 0; padding: 15mm; color: #000; -webkit-print-color-adjust: exact; }
                            .print-area { width: 100%; height: 100%; position: relative; }
                            .header { display: flex; justify-content: space-between; margin-bottom: 15px; }
                            .company-info { font-size: 11px; line-height: 1.4; }
                            .company-name { font-weight: bold; font-size: 12px; text-transform: uppercase; }
                            .voucher-meta { text-align: center; font-size: 11px; }
                            .title { text-align: center; font-size: 24px; font-weight: 800; margin: 10px 0 5px 0; text-transform: uppercase; letter-spacing: 1px; }
                            .date { text-align: center; font-style: italic; margin-bottom: 15px; font-size: 13px; }
                            .content { font-size: 14px; line-height: 1.6; margin-bottom: 20px; }
                            .row { display: flex; margin-bottom: 5px; }
                            .label { min-width: 140px; white-space: nowrap; }
                            .value { font-weight: 600; flex: 1; border-bottom: 1px dotted #999; padding-left: 5px; }
                            .footer { display: flex; justify-content: space-between; margin-top: 20px; text-align: center; font-size: 13px; }
                            .sig-col { width: 20%; }
                            .sig-title { font-weight: bold; margin-bottom: 5px; }
                            .sig-note { font-style: italic; font-size: 10px; font-weight: normal; }
                            .sig-space { height: 70px; }
                            
                            /* Watermark */
                            .watermark {
                                position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%) rotate(-30deg);
                                font-size: 80px; color: rgba(0,0,0,0.03); font-weight: bold; pointer-events: none; text-transform: uppercase;
                                z-index: -1; white-space: nowrap; border: 5px solid rgba(0,0,0,0.03); padding: 10px 40px; border-radius: 20px;
                            }
                        </style>
                    </head>
                    <body>
                        <div class="print-area">
                            <div class="watermark">${isIncome ? 'ĐÃ THU TIỀN' : 'ĐÃ CHI TIỀN'}</div>
                            ${printContent.innerHTML}
                        </div>
                    </body>
                </html>
            `);
            win.document.close();
            win.focus();
            setTimeout(() => {
                win.print();
                win.close();
            }, 300);
        }
    };

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/80 backdrop-blur-sm p-4 animate-in fade-in">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh]">
                <div className="flex justify-between items-center p-4 border-b bg-slate-50">
                    <div>
                        <h3 className="font-bold text-slate-900">Xem trước bản in (A5)</h3>
                        <p className="text-xs text-slate-500">Hệ thống tự động đọc số tiền bằng chữ.</p>
                    </div>
                    <div className="flex gap-2">
                        <button onClick={handlePrint} className="flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-bold text-sm shadow-sm transition-all active:scale-95">
                            <Printer size={16} className="mr-2"/> In Phiếu
                        </button>
                        <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-lg transition-colors"><X size={20}/></button>
                    </div>
                </div>
                
                <div className="flex-1 overflow-auto bg-slate-100 p-8 flex justify-center">
                    <div id="voucher-print-area" className="bg-white p-10 shadow-lg w-[210mm] text-slate-900 font-serif relative">
                        {/* VOUCHER CONTENT */}
                        <div className="header flex justify-between mb-4">
                            <div className="w-2/3">
                                <div className="font-bold text-sm uppercase mb-1">CÔNG TY TNHH E&C THÁI BÌNH DƯƠNG</div>
                                <div className="text-[11px] italic">Đ/c: Số 6 ngách 28 ngõ 65 Nguyễn Đổng Chi, phường Từ Liêm, thành phố Hà Nội</div>
                                <div className="text-[11px] italic">MST: 0106928341</div>
                            </div>
                            <div className="text-center text-xs w-1/3">
                                <div className="font-bold">Mẫu số 01-TT</div>
                                <div className="italic text-[10px]">(Ban hành theo TT 200/2014/TT-BTC)</div>
                                <div className="mt-2 font-bold text-sm">Số: {transaction.code}</div>
                                {transaction.id && <div className="text-[9px] text-slate-400">Ref: {transaction.id.slice(-6)}</div>}
                            </div>
                        </div>

                        <div className="text-center mb-6">
                            <h1 className="text-3xl font-black uppercase tracking-wide mb-1">{title}</h1>
                            <p className="italic text-sm">{formattedDate}</p>
                        </div>

                        <div className="space-y-3 text-sm px-2">
                            <div className="flex">
                                <span className="min-w-[150px]">Họ và tên người {isIncome ? 'nộp' : 'nhận'}:</span>
                                <span className="font-bold flex-1 border-b border-dotted border-slate-400 pl-2">{partnerName}</span>
                            </div>
                            <div className="flex">
                                <span className="min-w-[150px]">Địa chỉ:</span>
                                <span className="flex-1 border-b border-dotted border-slate-400 pl-2">...</span>
                            </div>
                            <div className="flex">
                                <span className="min-w-[150px]">Lý do {isIncome ? 'nộp' : 'chi'}:</span>
                                <span className="font-bold flex-1 border-b border-dotted border-slate-400 pl-2">{reason}</span>
                            </div>
                            <div className="flex">
                                <span className="min-w-[150px]">Số tiền:</span>
                                <span className="font-bold flex-1 border-b border-dotted border-slate-400 pl-2">{transaction.amount.toLocaleString('vi-VN')} đ</span>
                            </div>
                            <div className="flex">
                                <span className="min-w-[150px]">Viết bằng chữ:</span>
                                <span className="font-bold italic flex-1 border-b border-dotted border-slate-400 pl-2">{moneyText}</span>
                            </div>
                            <div className="flex">
                                <span className="min-w-[150px]">Kèm theo:</span>
                                <span className="flex-1 border-b border-dotted border-slate-400 pl-2">
                                    {transaction.attachments && transaction.attachments.length > 0 
                                        ? `${transaction.attachments.length} chứng từ gốc` 
                                        : "................................................"}
                                </span>
                            </div>
                        </div>

                        <div className="flex justify-between mt-10 text-center text-sm">
                            <div className="w-1/5">
                                <div className="font-bold">Giám đốc</div>
                                <div className="text-[10px] italic font-normal">(Ký, họ tên, đóng dấu)</div>
                                <div className="h-20"></div>
                            </div>
                            <div className="w-1/5">
                                <div className="font-bold">Kế toán trưởng</div>
                                <div className="text-[10px] italic font-normal">(Ký, họ tên)</div>
                                <div className="h-20"></div>
                            </div>
                            <div className="w-1/5">
                                <div className="font-bold">Người lập phiếu</div>
                                <div className="text-[10px] italic font-normal">(Ký, họ tên)</div>
                                <div className="h-20"></div>
                            </div>
                            <div className="w-1/5">
                                <div className="font-bold">Người {isIncome ? 'nộp' : 'nhận'} tiền</div>
                                <div className="text-[10px] italic font-normal">(Ký, họ tên)</div>
                                <div className="h-20"></div>
                            </div>
                            <div className="w-1/5">
                                <div className="font-bold">Thủ quỹ</div>
                                <div className="text-[10px] italic font-normal">(Ký, họ tên)</div>
                                <div className="h-20"></div>
                            </div>
                        </div>
                        
                        <div className="mt-2 text-[11px] text-slate-500 italic text-center">Đã nhận đủ số tiền (viết bằng chữ): ............................................................................................................</div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default VoucherModal;
