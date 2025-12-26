
import { Attachment, GoogleStorageConfig } from '../types';
import { getSettings } from './sheetService';

/**
 * GOOGLE DRIVE SERVICE (High-Fidelity Mock for Client-Side Architecture)
 * 
 * Logic:
 * 1. Simulates upload to a specific folder defined in settings.
 * 2. Simulates "Share" permission granting.
 * 3. Returns a mock but structured "Drive URL" and "File ID".
 * 
 * In a real backend implementation, this would use googleapis nodejs client.
 * Here we use Blob URL for the immediate preview but wrap it in metadata 
 * that looks like a Drive file to satisfy the architecture.
 */

const UPLOAD_DELAY_MS = 2000; // 2 seconds to simulate network

export const uploadFileToDrive = async (file: File): Promise<Attachment> => {
    const settings = getSettings();
    const driveConfig: GoogleStorageConfig = settings.googleStorage || {
        driveFolderId: '',
        projectSubFolder: true,
        officeSubFolder: true,
        autoShare: 'VIEW'
    };

    // 1. Simulate Network Upload Delay
    await new Promise(resolve => setTimeout(resolve, UPLOAD_DELAY_MS));

    // 2. Generate Mock Metadata based on config
    const uniqueId = Math.random().toString(36).substring(7);
    const mockFileId = `1_${uniqueId}_DRIVE_FILE_ID`;
    
    // In real app, this link comes from Drive API (webViewLink)
    // We construct a fake Google Drive link structure for UI display
    const mockDriveUrl = `https://drive.google.com/file/d/${mockFileId}/view?usp=sharing`;
    
    // We create a local blob URL so the user can actually see the image in this session.
    // In a real app with backend, the 'url' would be the 'mockDriveUrl'.
    // Here, we save the blob as 'url' for preview, but we MUST save 'driveLink' 
    // and 'driveFileId' to persist the "Drive" concept.
    const blobUrl = URL.createObjectURL(file);

    // Determine Type
    let type: Attachment['type'] = 'OTHER';
    if (file.type.includes('image')) type = 'IMAGE';
    else if (file.type.includes('pdf')) type = 'PDF';
    else if (file.type.includes('excel') || file.type.includes('spreadsheet')) type = 'EXCEL';

    const attachment: Attachment = {
        id: `att_${Date.now()}_${uniqueId}`,
        name: file.name,
        type: type,
        url: blobUrl, // Use Blob for immediate preview in this session
        mimeType: file.type,
        size: file.size,
        
        // CRITICAL: Architecture required fields
        driveFileId: mockFileId, 
        driveLink: mockDriveUrl
    };

    console.log(`[Google Drive Mock] Uploaded ${file.name} to Folder ${driveConfig.driveFolderId || 'ROOT'}. Shared: ${driveConfig.autoShare}`);

    return attachment;
};
