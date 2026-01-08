
import React, {useMemo} from 'react';
import { X, Download, FileText, Image as ImageIcon, FileSpreadsheet, File, ExternalLink, Cloud } from 'lucide-react';
import { Attachment } from '../types';

interface AttachmentViewerProps {
  attachment: Attachment;
  onClose: () => void;
}

const AttachmentViewer: React.FC<AttachmentViewerProps> = ({ attachment, onClose }) => {
  const isPdf = attachment.type === 'PDF' || attachment.name.toLowerCase().endsWith('.pdf') || attachment.mimeType === 'application/pdf';
  const isImage = attachment.type === 'IMAGE' || attachment.name.match(/\.(jpeg|jpg|gif|png|webp)$/i) || attachment.mimeType?.startsWith('image/');
  const isDriveLink = attachment.url.includes('drive.google.com') || !!attachment.driveFileId;

  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = attachment.url;
    link.download = attachment.name;
    link.target = "_blank";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const finalUrl = useMemo(() => {
    let url = attachment.url || "";
    if (url.includes('drive.google.com')) return url;
    return url.replace('http://', 'https://').replace(':3001', '');
}, [attachment.url]);

  return (
    <div className="fixed inset-0 z-[250] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="relative w-full max-w-5xl h-[85vh] bg-white rounded-xl flex flex-col overflow-hidden shadow-2xl">
        
        {/* Header */}
        <div className="flex justify-between items-center p-4 border-b border-gray-100 bg-gray-50">
           <div className="flex items-center space-x-3">
             <div className="p-2 bg-blue-100 text-blue-600 rounded-lg">
                {isDriveLink ? <Cloud size={20}/> : (isPdf ? <FileText size={20} /> : <ImageIcon size={20} />)}
             </div>
             <div>
                <h3 className="font-semibold text-gray-900 truncate max-w-md" title={attachment.name}>{attachment.name}</h3>
                <p className="text-xs text-gray-500">{attachment.size ? `${(attachment.size / 1024).toFixed(1)} KB` : 'Unknown size'}</p>
             </div>
           </div>
           
           <div className="flex items-center space-x-2">
              <button onClick={handleDownload} className="flex items-center px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm transition-colors">
                <Download size={16} className="mr-1.5" /> Tải về
              </button>
              <button className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors" onClick={onClose}><X size={24} /></button>
           </div>
        </div>
        
        {/* Content */}
        <div className="flex-1 overflow-auto bg-gray-100 flex items-center justify-center p-4">
           {isDriveLink ? (
               <div className="text-center bg-white p-10 rounded-2xl shadow-lg max-w-md">
                   <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-6 text-blue-600"><Cloud size={40}/></div>
                   <h4 className="text-xl font-bold text-gray-800 mb-2">File lưu trên Google Drive</h4>
                   <p className="text-gray-500 mb-8 text-sm">Tài liệu này được lưu trữ an toàn trên đám mây. Vui lòng mở trong tab mới để xem.</p>
                   <a href={finalUrl} target="_blank" rel="noreferrer" className="inline-flex items-center px-8 py-3 bg-blue-600 text-white rounded-xl font-bold shadow-lg hover:bg-blue-700 transition-all">
                       <ExternalLink size={18} className="mr-2"/> Mở trên Drive
                   </a>
               </div>
           ) : isPdf ? (
               <iframe src={finalUrl} className="w-full h-full border-none rounded shadow-sm bg-white" title="PDF Viewer" />
           ) : isImage ? (
               <img src={finalUrl} alt="Preview" className="max-w-full max-h-full rounded shadow-lg object-contain" onClick={(e) => e.stopPropagation()} />
           ) : (
               <div className="text-center">
                   <div className="w-24 h-24 bg-gray-200 rounded-full flex items-center justify-center mx-auto mb-4 text-gray-400"><FileText size={48} /></div>
                   <h4 className="text-lg font-bold text-gray-700 mb-2">Không hỗ trợ xem trước</h4>
                   <button onClick={handleDownload} className="px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 font-bold shadow-lg flex items-center mx-auto transition-transform active:scale-95">
                       <Download size={18} className="mr-2"/> Tải xuống ngay
                   </button>
               </div>
           )}
        </div>
      </div>
    </div>
  );
};

export default AttachmentViewer;
