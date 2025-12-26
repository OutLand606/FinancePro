
import { TransactionType } from '../types';

interface QuickTokenPayload {
  empId: string;
  type: TransactionType;
  exp: number; // Timestamp
  nonce: string;
}

const SECRET_SALT = "FINANCE_PRO_SECURE_SALT_2024"; // Mock Secret

// Helper để mã hóa Unicode/Tiếng Việt sang Base64 an toàn
const utf8_to_b64 = (str: string) => {
    return window.btoa(unescape(encodeURIComponent(str)));
};

// Helper để giải mã Base64 sang Unicode/Tiếng Việt
const b64_to_utf8 = (str: string) => {
    return decodeURIComponent(escape(window.atob(str)));
};

export const generateQuickToken = (empId: string, type: TransactionType, expiresInDays: number = 7): string => {
  const payload: QuickTokenPayload = {
    empId,
    type,
    exp: Date.now() + (expiresInDays * 24 * 60 * 60 * 1000),
    nonce: Math.random().toString(36).substring(7)
  };

  const json = JSON.stringify(payload);
  
  // Use UTF-8 safe encoding
  const base64 = utf8_to_b64(json);
  
  // Simple signature simulation
  const signature = btoa(unescape(encodeURIComponent(json + SECRET_SALT))).substring(0, 10); 
  
  return `${base64}.${signature}`;
};

export const parseQuickToken = (token: string): QuickTokenPayload | null => {
  try {
    const [base64, signature] = token.split('.');
    if (!base64 || !signature) return null;

    // Use UTF-8 safe decoding
    const json = b64_to_utf8(base64);
    
    const expectedSignature = btoa(unescape(encodeURIComponent(json + SECRET_SALT))).substring(0, 10);

    if (signature !== expectedSignature) {
      console.error("Invalid token signature");
      return null;
    }

    const payload: QuickTokenPayload = JSON.parse(json);
    
    if (Date.now() > payload.exp) {
      console.error("Token expired");
      return null;
    }

    return payload;
  } catch (e) {
    console.error("Error parsing token", e);
    return null;
  }
};
