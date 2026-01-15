
import React from 'react';
import { Project, ProjectRoadmap, RoadmapLog } from '../types';
import { groupLogsByDate } from '../services/roadmapService';
import { X, Printer } from 'lucide-react';

interface ReportPrintViewProps {
    project: Project;
    roadmap: ProjectRoadmap;
    currentUser: any; // UserContext
    onClose?: () => void;
}

const ReportPrintView: React.FC<ReportPrintViewProps> = ({ project, roadmap, currentUser, onClose }) => {
    const groupedLogs = groupLogsByDate(roadmap.logs || []);
    const currentDate = new Date();

    const getStageName = (stageId?: string) => {
        if (!stageId) return '---';
        return roadmap.stages.find(s => s.id === stageId)?.title || 'Khác';
    };

    // Use current URL for QR Code (Assuming user accesses report via a shareable link ideally, but here just page URL)
    const reportUrl = window.location.href;
    console.log('reportUrlreportUrl',reportUrl)
    const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(reportUrl)}`;

    return (
        <div className="relative">
            {/* TOOLBAR FOR MODAL VIEW */}
            <div className="sticky top-0 left-0 right-0 bg-slate-900 text-white p-4 flex justify-between items-center no-print z-50 shadow-md">
                <div className="flex items-center gap-4">
                    <h3 className="font-bold text-lg">Xem trước bản in (A4)</h3>
                    <p className="text-xs text-slate-400">Trang in đã được căn chỉnh tự động.</p>
                </div>
                <div className="flex gap-3">
                    <button onClick={() => window.print()} className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg font-bold text-xs uppercase flex items-center shadow-lg transition-all">
                        <Printer size={16} className="mr-2"/> In Ngay
                    </button>
                    {onClose && (
                        <button onClick={onClose} className="bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 rounded-lg font-bold text-xs uppercase flex items-center transition-all">
                            <X size={16} className="mr-2"/> Đóng
                        </button>
                    )}
                </div>
            </div>

            <style>{`
                /* GLOBAL PAGE RESET */
                body {
                    background-color: #525659;
                    margin: 0;
                    padding: 0;
                }

                /* A4 PAPER STYLES (SCREEN) */
                .print-page {
                    width: 210mm;
                    min-height: 297mm;
                    background: #fff;
                    padding: 20mm;
                    margin: 0 auto;
                    box-sizing: border-box;
                    font-family: 'Times New Roman', serif;
                    font-size: 13px;
                    line-height: 1.5;
                    color: #000;
                    position: relative;
                    box-shadow: 0 0 10px rgba(0,0,0,0.1); 
                }

                /* --- PRINT STYLES (QUAN TRỌNG) --- */
                @media print {
                    body * {
                        visibility: hidden;
                    }
                    .print-page, .print-page * {
                        visibility: visible;
                    }

                    .print-page {
                        position: absolute;
                        left: 0;
                        top: 0;
                        width: 100%;
                        margin: 0;
                        padding: 20mm; 
                        background: white;
                        box-shadow: none; 
                    }

                    .no-print, .sticky {
                        display: none !important;
                    }

                    @page { 
                        size: A4; 
                        margin: 0;
                    }
                    * {
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                    }
                }

                /* PAGE BREAK CONTROLS */
                .print-section {
                    page-break-inside: avoid;
                    margin-bottom: 20px;
                }

                .print-day {
                    page-break-inside: avoid;
                    margin-bottom: 30px;
                    border-bottom: 1px dashed #ccc;
                    padding-bottom: 20px;
                }

                /* TABLE STYLES */
                table { width: 100%; border-collapse: collapse; margin-top: 10px; }
                th, td { border: 1px solid #000; padding: 5px; text-align: left; vertical-align: top; }
                th { font-weight: bold; background-color: #f0f0f0 !important; text-align: center; }
                
                /* IMAGE GRID */
                .photo-grid {
                    display: grid;
                    grid-template-columns: repeat(3, 1fr);
                    gap: 10px;
                    margin-top: 10px;
                }
                .photo-item {
                    width: 100%;
                    aspect-ratio: 1/1;
                    object-fit: cover;
                    border: 1px solid #ccc;
                    border-radius: 4px;
                }
                
                /* UTILS */
                .text-center { text-align: center; }
                .text-right { text-align: right; }
                .font-bold { font-weight: bold; }
                .uppercase { text-transform: uppercase; }
                .italic { font-style: italic; }
            `}</style>

            <div className="print-page">
                {/* --- PAGE 1: COVER & INFO --- */}
                <div className="print-section" style={{ borderBottom: '2px solid black', paddingBottom: '10px', marginBottom: '30px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <div style={{ width: '60%' }}>
                            <h1 className="font-bold uppercase" style={{ fontSize: '14px', marginBottom: '5px' }}>CÔNG TY TNHH E&C THÁI BÌNH DƯƠNG</h1>
                            <p className="italic" style={{ fontSize: '11px' }}>Đ/c: Số 6 ngách 28 ngõ 65 Nguyễn Đổng Chi, Nam Từ Liêm, HN</p>
                            <p className="italic" style={{ fontSize: '11px' }}>Hotline: 091.333.6268</p>
                        </div>
                        <div className="text-right">
                            <p className="italic" style={{ fontSize: '11px' }}>Số: RPT-{project.code}</p>
                            <p className="italic" style={{ fontSize: '11px' }}>Hà Nội, ngày {currentDate.getDate()} tháng {currentDate.getMonth() + 1} năm {currentDate.getFullYear()}</p>
                        </div>
                    </div>
                </div>

                <div className="print-section text-center" style={{ marginBottom: '40px' }}>
                    <h2 className="font-bold uppercase" style={{ fontSize: '24px', marginBottom: '10px' }}>BÁO CÁO NHẬT KÝ THI CÔNG</h2>
                    <p className="font-bold uppercase" style={{ fontSize: '14px' }}>CÔNG TRÌNH: {project.name}</p>
                </div>

                <div className="print-section">
                    <h3 className="font-bold uppercase" style={{ borderBottom: '1px solid black', paddingBottom: '5px', marginBottom: '10px' }}>I. THÔNG TIN CHUNG</h3>
                    <table style={{ border: 'none' }}>
                        <tbody>
                            <tr><td style={{ border: 'none', width: '150px', fontWeight: 'bold' }}>Chủ đầu tư:</td><td style={{ border: 'none' }}>{project.customerName}</td></tr>
                            <tr><td style={{ border: 'none', fontWeight: 'bold' }}>Địa điểm:</td><td style={{ border: 'none' }}>{project.address}</td></tr>
                            <tr><td style={{ border: 'none', fontWeight: 'bold' }}>Đơn vị thi công:</td><td style={{ border: 'none' }}>CÔNG TY TNHH E&C THÁI BÌNH DƯƠNG</td></tr>
                            <tr><td style={{ border: 'none', fontWeight: 'bold' }}>Chỉ huy trưởng:</td><td style={{ border: 'none' }}>{project.managerName || '---'}</td></tr>
                            <tr><td style={{ border: 'none', fontWeight: 'bold' }}>Giai đoạn:</td><td style={{ border: 'none' }}>{project.startDate || '...'} đến {project.endDate || '...'}</td></tr>
                        </tbody>
                    </table>
                </div>

                <div className="print-section" style={{ marginTop: '30px' }}>
                    <h3 className="font-bold uppercase" style={{ borderBottom: '1px solid black', paddingBottom: '5px', marginBottom: '10px' }}>II. NHÂN SỰ PHỤ TRÁCH</h3>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <div style={{ width: '48%' }}>
                            <p className="font-bold">1. Chỉ huy trưởng / Giám sát:</p>
                            <p style={{ paddingLeft: '20px', marginTop: '5px' }}>Ông/Bà: <span className="uppercase">{project.managerName || currentUser.name}</span></p>
                            <p style={{ paddingLeft: '20px' }}>SĐT: {project.managerPhone || '---'}</p>
                        </div>
                        <div style={{ width: '48%' }}>
                            <p className="font-bold">2. Tổ trưởng thi công:</p>
                            <p style={{ paddingLeft: '20px', marginTop: '5px' }}>Ông/Bà: <span className="uppercase">{'...........................'}</span></p>
                        </div>
                    </div>
                </div>

                {/* --- CONTENT START --- */}
                <div style={{ marginTop: '30px' }}>
                    <h3 className="font-bold uppercase" style={{ borderBottom: '1px solid black', paddingBottom: '5px', marginBottom: '20px' }}>III. CHI TIẾT NHẬT KÝ THI CÔNG</h3>
                    
                    {groupedLogs.length === 0 && <p className="italic text-center">Chưa có dữ liệu nhật ký.</p>}

                    {groupedLogs.map(([date, logs]) => (
                        <div key={date} className="print-day">
                            <div className="font-bold uppercase" style={{ backgroundColor: '#f5f5f5', padding: '5px', border: '1px solid #000', borderBottom: 'none' }}>
                                📅 Ngày: {new Date(date).toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' })}
                            </div>
                            <table>
                                <thead>
                                    <tr>
                                        <th style={{ width: '5%' }}>STT</th>
                                        <th style={{ width: '10%' }}>Giờ</th>
                                        <th style={{ width: '20%' }}>Hạng mục</th>
                                        <th style={{ width: '40%' }}>Nội dung & Hình ảnh</th>
                                        <th style={{ width: '25%' }}>Ghi chú</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {logs.map((log, idx) => (
                                        <tr key={log.id}>
                                            <td className="text-center">{idx + 1}</td>
                                            <td className="text-center">{new Date(log.timestamp).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}</td>
                                            <td style={{ fontWeight: 'bold' }}>{getStageName(log.stageId)}</td>
                                            <td>
                                                <div style={{ fontWeight: 'bold', marginBottom: '2px' }}>{log.performerName} ({log.performerRole === 'WORKER' ? 'Thợ' : 'QL'})</div>
                                                <div style={{ whiteSpace: 'pre-wrap' }}>{log.content}</div>
                                                {log.locationTag && <div className="italic" style={{ fontSize: '11px', marginTop: '2px' }}>📍 {log.locationTag}</div>}
                                                
                                                {/* Render Images in Report */}
                                                {log.photos && log.photos.length > 0 && (
                                                    <div className="photo-grid">
                                                        {log.photos.filter(p => p.type === 'IMAGE').map((p, i) => (
                                                            <img key={i} src={p.url} className="photo-item" alt="Site photo"/>
                                                        ))}
                                                    </div>
                                                )}
                                            </td>
                                            <td>
                                                {log.type === 'ACCEPTANCE' && <div style={{fontWeight:'bold'}}>Nghiệm thu</div>}
                                                {log.type === 'ISSUE_REPORT' && <div style={{fontWeight:'bold', color:'red'}}>Sự cố</div>}
                                                {log.type === 'FEEDBACK' && <div style={{fontWeight:'bold', color:'blue'}}>Phản hồi CĐT</div>}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ))}
                </div>

                <div className="print-section" style={{ marginTop: '50px', borderTop: '2px solid black', paddingTop: '20px' }}>
                    <h3 className="font-bold uppercase" style={{ marginBottom: '10px' }}>IV. XÁC NHẬN</h3>
                    <p style={{ marginBottom: '20px' }}>Tổng số ngày làm việc: <b>{groupedLogs.length} ngày</b>. Tiến độ ghi nhận: <b>{roadmap.overallProgress}%</b></p>
                    
                    <div style={{ display: 'flex', justifyContent: 'space-between', textAlign: 'center', marginBottom: '50px' }}>
                        <div style={{ width: '30%' }}>
                            <p className="font-bold uppercase">Người lập báo cáo</p>
                            <p className="italic">(Ký, họ tên)</p>
                            <div style={{ height: '80px' }}></div>
                            <p className="font-bold">{currentUser.name}</p>
                        </div>
                        <div style={{ width: '30%' }}>
                            <p className="font-bold uppercase">Đại diện Đơn vị thi công</p>
                            <p className="italic">(Ký, đóng dấu)</p>
                        </div>
                        <div style={{ width: '30%' }}>
                            <p className="font-bold uppercase">Đại diện Chủ đầu tư</p>
                            <p className="italic">(Ký xác nhận)</p>
                        </div>
                    </div>

                    <div style={{ borderTop: '1px dashed #ccc', paddingTop: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                         <div style={{ marginRight: '20px' }}>
                             <img src={qrCodeUrl} alt="QR Code Report" style={{ width: '80px', height: '80px' }} />
                         </div>
                         <div>
                             <p className="font-bold" style={{ fontSize: '12px' }}>QUÉT MÃ ĐỂ TẢI FILE MỀM</p>
                             <p className="italic" style={{ fontSize: '10px' }}>Hệ thống quản lý FinancePro</p>
                         </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ReportPrintView;
