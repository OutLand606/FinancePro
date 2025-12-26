
import React, { useState, useEffect } from 'react';
import { Document, ExtractedItem, MaterialMaster, Partner, ProcessingStatus, DocumentType, MaterialCategory, PartnerType, DocumentValidation } from '../types';
import { Upload, FileText, CheckCircle, AlertTriangle, ArrowRight, Loader2, Save, X, Plus, Search, Eye, Edit2, ShieldAlert, Check } from 'lucide-react';
import { uploadDocument, fetchDocuments, fetchDocLineItems, commitDocument } from '../services/documentService';
import { fetchMaterialMaster, createMaterialMaster, createPartner } from '../services/masterDataService';
import { fetchMaterialCategories } from '../services/supplierPriceService';
import { Combobox } from './ui/Combobox';

interface DocumentProcessorProps {
  partners: Partner[];
  onClose: () => void;
  onCommitSuccess: () => void;
}

const DocumentProcessor: React.FC<DocumentProcessorProps> = ({ partners, onClose, onCommitSuccess }) => {
  const [localPartners, setLocalPartners] = useState<Partner[]>(partners);
  const [step, setStep] = useState<'UPLOAD' | 'REVIEW'>('UPLOAD');
  const [activeDoc, setActiveDoc] = useState<Document | null>(null);
  
  // Data State
  const [documents, setDocuments] = useState<Document[]>([]);
  const [lineItems, setLineItems] = useState<ExtractedItem[]>([]);
  const [materialMaster, setMaterialMaster] = useState<MaterialMaster[]>([]);
  const [categories, setCategories] = useState<MaterialCategory[]>([]);

  // Upload State
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [selectedPartner, setSelectedPartner] = useState<Partner | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  // Quick Create States
  const [showCreateMaterial, setShowCreateMaterial] = useState(false);
  const [showCreatePartner, setShowCreatePartner] = useState(false);
  
  // New Partner Form
  const [newPartnerName, setNewPartnerName] = useState('');
  const [newPartnerPhone, setNewPartnerPhone] = useState('');

  // New Material Form
  const [newMaterialName, setNewMaterialName] = useState('');
  const [newMaterialUnit, setNewMaterialUnit] = useState('');
  const [newMaterialCat, setNewMaterialCat] = useState<string>('');
  const [targetLineIdForCreate, setTargetLineIdForCreate] = useState<string | null>(null);

  useEffect(() => {
    setLocalPartners(partners); // Sync prop to local state
    fetchDocuments().then(setDocuments);
    fetchMaterialMaster().then(setMaterialMaster);
    fetchMaterialCategories().then(setCategories);
  }, [partners]);

  const handleUpload = async () => {
    if (!uploadFile || !selectedPartner) return;
    setIsUploading(true);
    try {
      const doc = await uploadDocument(uploadFile, selectedPartner.id);
      setDocuments(prev => [doc, ...prev]);
      await handleStartReview(doc);
    } catch (e: any) {
      alert("Lỗi upload: " + e.message);
    } finally {
      setIsUploading(false);
    }
  };

  const handleCreatePartner = async () => {
      if (!newPartnerName) return;
      // Fix: Added missing 'code' property to satisfy Partner interface
      const newP: Partner = {
          id: `pt_quick_${Date.now()}`,
          code: `PT-Q-${Date.now().toString().slice(-4)}`,
          name: newPartnerName,
          type: PartnerType.SUPPLIER,
          phone: newPartnerPhone,
          status: 'ACTIVE'
      };
      await createPartner(newP);
      setLocalPartners(prev => [newP, ...prev]);
      setSelectedPartner(newP);
      setShowCreatePartner(false);
      setNewPartnerName('');
      setNewPartnerPhone('');
  };

  const handleStartReview = async (doc: Document) => {
    const lines = await fetchDocLineItems(doc.id);
    setActiveDoc(doc);
    setLineItems(lines);
    setStep('REVIEW');
  };

  const handleMapMaterial = (lineId: string, materialId: string) => {
    setLineItems(prev => prev.map(line => 
      line.id === lineId ? { ...line, mappedMaterialId: materialId, isIgnored: false } : line
    ));
  };

  const handleIgnoreLine = (lineId: string) => {
    setLineItems(prev => prev.map(line => 
      line.id === lineId ? { ...line, isIgnored: !line.isIgnored, mappedMaterialId: undefined } : line
    ));
  };

  const handleUpdateLine = (lineId: string, field: keyof ExtractedItem, value: any) => {
    setLineItems(prev => prev.map(line => 
      line.id === lineId ? { ...line, [field]: value } : line
    ));
  };

  const handleCreateMaterial = async () => {
     if(!newMaterialName || !newMaterialCat) return;
     const newMat: MaterialMaster = {
         id: `mm_${Date.now()}`,
         code: `MAT-${Date.now().toString().slice(-4)}`,
         name: newMaterialName,
         unit: newMaterialUnit || 'Cái',
         categoryId: newMaterialCat
     };
     await createMaterialMaster(newMat);
     setMaterialMaster(prev => [newMat, ...prev]);
     if (targetLineIdForCreate) {
         handleMapMaterial(targetLineIdForCreate, newMat.id);
     }
     setShowCreateMaterial(false);
     setNewMaterialName('');
  };

  const handleCommit = async () => {
    if (!activeDoc) return;
    const hasValidLines = lineItems.some(l => !l.isIgnored && l.mappedMaterialId);
    if (!hasValidLines) {
        alert("Lỗi: Bạn chưa map (gán) bất kỳ vật tư nào. Vui lòng xử lý ít nhất 1 dòng.");
        return;
    }
    try {
        await commitDocument(activeDoc.id, lineItems);
        onCommitSuccess();
        onClose();
    } catch (e: any) {
        alert("Lỗi khi lưu: " + e.message);
    }
  };

  const renderRiskAnalysis = (val: DocumentValidation) => {
      const colorClass = val.riskLevel === 'HIGH' ? 'bg-red-50 text-red-800 border-red-200' :
                         val.riskLevel === 'MEDIUM' ? 'bg-orange-50 text-orange-800 border-orange-200' :
                         'bg-green-50 text-green-800 border-green-200';
      return (
          <div className={`p-4 rounded-lg border mb-4 ${colorClass}`}>
              <div className="flex items-center font-bold mb-2">
                  <ShieldAlert className="mr-2" size={20}/>
                  AI Phân Tích Rủi Ro: {val.riskLevel === 'HIGH' ? 'CAO' : val.riskLevel === 'MEDIUM' ? 'TRUNG BÌNH' : 'THẤP'}
              </div>
              <div className="text-sm space-y-1 ml-7">
                  <p>Loại tài liệu: <b>{val.detectedType}</b></p>
                  {val.issues.length > 0 ? (
                      <ul className="list-disc list-inside">
                          {val.issues.map((issue, idx) => <li key={idx}>{issue}</li>)}
                      </ul>
                  ) : (
                      <p className="flex items-center"><Check size={14} className="mr-1"/> Không phát hiện vấn đề bất thường.</p>
                  )}
              </div>
          </div>
      );
  };

  if (step === 'UPLOAD') {
    return (
      <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl h-[80vh] flex flex-col overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
             <h2 className="text-xl font-bold text-gray-900 flex items-center">
               <Upload className="mr-2 text-blue-600" />
               Xử Lý Chứng Từ Đầu Vào (Gemini AI)
             </h2>
             <button onClick={onClose}><X className="text-gray-400 hover:text-gray-600" /></button>
          </div>

          <div className="flex-1 flex overflow-hidden">
             <div className="w-1/3 border-r border-gray-100 p-6 bg-white overflow-y-auto">
                <h3 className="font-semibold text-gray-800 mb-4">Upload Mới</h3>
                <div className="space-y-4">
                    <Combobox<Partner>
                      label="Nhà Cung Cấp *"
                      placeholder="Chọn NCC hoặc thêm mới..."
                      items={localPartners}
                      selectedItem={selectedPartner}
                      onSelect={setSelectedPartner}
                      displayValue={(p) => p.name}
                      renderItem={(p) => <span>{p.name}</span>}
                      filterFunction={(p, q) => p.name.toLowerCase().includes(q.toLowerCase())}
                      onAddNew={() => setShowCreatePartner(true)}
                    />

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">File (Ảnh/PDF)</label>
                        <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 flex flex-col items-center justify-center bg-gray-50 hover:bg-blue-50 cursor-pointer transition-colors relative">
                            <input 
                                type="file" 
                                accept=".pdf,.jpg,.png,.jpeg,.webp"
                                className="absolute inset-0 opacity-0 cursor-pointer"
                                onChange={(e) => e.target.files && setUploadFile(e.target.files[0])}
                            />
                            <Upload size={24} className="text-gray-400 mb-2" />
                            <p className="text-sm text-gray-600 text-center">
                                {uploadFile ? uploadFile.name : "Kéo thả hoặc chọn file"}
                            </p>
                        </div>
                        <p className="text-xs text-gray-400 mt-2 text-center">Hỗ trợ: PDF, Ảnh chụp hóa đơn, Phiếu viết tay</p>
                    </div>

                    <button 
                        onClick={handleUpload}
                        disabled={!uploadFile || !selectedPartner || isUploading}
                        className="w-full py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center font-bold"
                    >
                        {isUploading ? <Loader2 className="animate-spin mr-2" /> : <ArrowRight className="mr-2" />}
                        {isUploading ? "AI Đang Phân Tích..." : "Xử Lý Ngay"}
                    </button>
                </div>
             </div>

             <div className="flex-1 p-6 bg-gray-50 overflow-y-auto">
                <h3 className="font-semibold text-gray-800 mb-4">Lịch Sử Chứng Từ</h3>
                <div className="space-y-3">
                   {documents.map(doc => (
                       <div key={doc.id} className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm flex justify-between items-center">
                           <div>
                               <p className="font-medium text-gray-900">{doc.name}</p>
                               <p className="text-xs text-gray-500">{new Date(doc.createdAt).toLocaleDateString('vi-VN')} • {localPartners.find(p=>p.id===doc.partnerId)?.name}</p>
                           </div>
                           {doc.status === ProcessingStatus.REVIEW_NEEDED && (
                               <button onClick={() => handleStartReview(doc)} className="text-xs font-bold text-white bg-blue-600 px-3 py-1.5 rounded">Duyệt</button>
                           )}
                           {doc.status === ProcessingStatus.COMPLETED && (
                               <span className="text-xs font-bold text-green-600 bg-green-100 px-2 py-1 rounded">Đã xong</span>
                           )}
                       </div>
                   ))}
                </div>
             </div>
          </div>
        </div>

        {/* Modal Create Partner */}
        {showCreatePartner && (
            <div className="absolute inset-0 z-[60] flex items-center justify-center bg-black/30 p-4">
               <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-sm">
                   <h3 className="text-lg font-bold mb-3">Thêm Nhà Cung Cấp Mới</h3>
                   <div className="space-y-3">
                       <input className="w-full border p-2 rounded" placeholder="Tên NCC (VD: Cửa hàng A)..." value={newPartnerName} onChange={(e) => setNewPartnerName(e.target.value)} autoFocus />
                       <input className="w-full border p-2 rounded" placeholder="Số điện thoại / MST" value={newPartnerPhone} onChange={(e) => setNewPartnerPhone(e.target.value)} />
                   </div>
                   <div className="flex justify-end gap-2 mt-4">
                       <button onClick={() => setShowCreatePartner(false)} className="px-4 py-2 text-gray-600">Hủy</button>
                       <button onClick={handleCreatePartner} className="px-4 py-2 bg-blue-600 text-white rounded">Lưu & Chọn</button>
                   </div>
               </div>
            </div>
        )}
      </div>
    );
  }

  // REVIEW STEP
  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-xl w-full max-w-6xl h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200">
            {/* Header */}
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                 <div>
                    <h2 className="text-lg font-bold text-gray-900 flex items-center">
                        <CheckCircle className="mr-2 text-green-600" />
                        Duyệt & Map Dữ Liệu
                    </h2>
                    <p className="text-xs text-gray-500">Chứng từ: {activeDoc?.name}</p>
                 </div>
                 <div className="flex space-x-2">
                     <button onClick={() => setStep('UPLOAD')} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg text-sm">Quay lại</button>
                     <button 
                        onClick={handleCommit}
                        className="px-4 py-2 bg-green-600 text-white hover:bg-green-700 rounded-lg text-sm font-medium flex items-center"
                     >
                         <Save size={16} className="mr-2" /> Lưu & Cập nhật Giá
                     </button>
                 </div>
            </div>

            {/* Split View */}
            <div className="flex-1 flex overflow-hidden">
                {/* Left: Original File Preview */}
                <div className="w-1/3 bg-gray-100 p-4 flex flex-col items-center justify-center relative border-r">
                    {activeDoc?.fileUrl && (activeDoc.name.toLowerCase().endsWith('.pdf') || activeDoc.fileUrl.startsWith('data:application/pdf')) ? (
                        <iframe src={activeDoc.fileUrl} className="w-full h-full border-none shadow-lg" title="PDF Viewer"></iframe>
                    ) : activeDoc?.fileUrl ? (
                        <img src={activeDoc.fileUrl} className="max-w-full max-h-full object-contain shadow-lg border" />
                    ) : (
                        <div className="text-gray-400 text-center">
                            <FileText size={48} className="mx-auto mb-2 opacity-50" />
                            <p>Không thể xem trước file này</p>
                        </div>
                    )}
                </div>

                {/* Right: Mapping Table & Risk Analysis */}
                <div className="flex-1 overflow-y-auto p-4 bg-gray-50">
                    
                    {/* RISK ANALYSIS WIDGET */}
                    {activeDoc?.aiValidation && renderRiskAnalysis(activeDoc.aiValidation)}

                    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-gray-100 text-gray-700 font-semibold border-b border-gray-200">
                                <tr>
                                    <th className="px-4 py-3 w-1/3">Tên & ĐVT (AI Đọc)</th>
                                    <th className="px-4 py-3 w-16">SL</th>
                                    <th className="px-4 py-3 w-28 text-right">Đơn giá</th>
                                    <th className="px-4 py-3 w-1/3">Map vào Vật tư chuẩn</th>
                                    <th className="px-4 py-3 w-10"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {lineItems.map(line => (
                                    <tr key={line.id} className={`${line.isIgnored ? 'bg-gray-50 opacity-50' : 'hover:bg-blue-50'} transition-colors`}>
                                        <td className="px-4 py-3 relative group">
                                            <input className="font-medium text-gray-900 w-full border-b border-transparent hover:border-gray-300 outline-none bg-transparent" value={line.rawName} onChange={(e) => handleUpdateLine(line.id, 'rawName', e.target.value)} disabled={line.isIgnored}/>
                                            <input className="text-xs text-gray-500 w-full border-b border-transparent hover:border-gray-300 outline-none bg-transparent mt-1" value={line.rawUnit} onChange={(e) => handleUpdateLine(line.id, 'rawUnit', e.target.value)} disabled={line.isIgnored}/>
                                        </td>
                                        <td className="px-4 py-3"><input type="number" className="w-16 text-center bg-transparent" value={line.rawQty} onChange={(e) => handleUpdateLine(line.id, 'rawQty', parseFloat(e.target.value))} disabled={line.isIgnored}/></td>
                                        <td className="px-4 py-3 text-right font-mono text-blue-600"><input type="number" className="w-24 text-right bg-transparent font-bold" value={line.rawPrice} onChange={(e) => handleUpdateLine(line.id, 'rawPrice', parseFloat(e.target.value))} disabled={line.isIgnored}/></td>
                                        <td className="px-4 py-3">
                                            {!line.isIgnored && (
                                                <Combobox<MaterialMaster>
                                                    label=""
                                                    placeholder="Tìm vật tư chuẩn..."
                                                    items={materialMaster}
                                                    selectedItem={materialMaster.find(m => m.id === line.mappedMaterialId) || null}
                                                    onSelect={(m) => handleMapMaterial(line.id, m.id)}
                                                    displayValue={(m) => m.name}
                                                    renderItem={(m) => <div><div className="font-medium">{m.name}</div><div className="text-xs text-gray-500">{m.code}</div></div>}
                                                    filterFunction={(m, q) => m.name.toLowerCase().includes(q.toLowerCase())}
                                                    onAddNew={() => {
                                                        setNewMaterialName(line.rawName);
                                                        setNewMaterialUnit(line.rawUnit);
                                                        setTargetLineIdForCreate(line.id);
                                                        setShowCreateMaterial(true);
                                                    }}
                                                />
                                            )}
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            <button onClick={() => handleIgnoreLine(line.id)} className={`p-1.5 rounded hover:bg-gray-200 ${line.isIgnored ? 'text-gray-400' : 'text-red-400'}`}>
                                                {line.isIgnored ? <Plus size={16} /> : <X size={16} />}
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* Modal Quick Create Material */}
            {showCreateMaterial && (
                <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-lg shadow-2xl w-full max-w-md p-6 border border-gray-200">
                        <h3 className="text-lg font-bold mb-4">Tạo Vật Tư Mới</h3>
                        <div className="space-y-3">
                            <input className="w-full border p-2 rounded" value={newMaterialName} onChange={e => setNewMaterialName(e.target.value)} placeholder="Tên vật tư" autoFocus/>
                            <input className="w-full border p-2 rounded" value={newMaterialUnit} onChange={e => setNewMaterialUnit(e.target.value)} placeholder="ĐVT"/>
                            <select className="w-full border p-2 rounded" value={newMaterialCat} onChange={e => setNewMaterialCat(e.target.value)}>
                                <option value="">-- Chọn nhóm --</option>
                                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                            <div className="flex justify-end gap-2 mt-4">
                                <button onClick={() => setShowCreateMaterial(false)} className="px-4 py-2 text-gray-600">Hủy</button>
                                <button onClick={handleCreateMaterial} className="px-4 py-2 bg-blue-600 text-white rounded">Tạo & Chọn</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    </div>
  );
};

export default DocumentProcessor;
