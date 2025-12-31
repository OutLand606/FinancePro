import { Attachment } from "../types";
import { api } from "./api";

const UPLOAD_ENDPOINT = "/api/upload";

export const uploadFileToDrive = async (file: File): Promise<Attachment> => {
  const formData = new FormData();
  formData.append("file", file);

  try {
    const response = await api.post(UPLOAD_ENDPOINT, formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    });

    const result: any = response.data;

    if (!result && !result.data) {
      throw new Error("Upload thất bại: Không có dữ liệu trả về");
    }

    const backendData = result.data || result;

    console.log("📥 Backend Response:", backendData);

    let type: Attachment["type"] = "OTHER";
    if (file.type.includes("image")) type = "IMAGE";
    else if (file.type.includes("pdf")) type = "PDF";
    else if (file.type.includes("excel") || file.type.includes("spreadsheet"))
      type = "EXCEL";

    const attachment: Attachment = {
      id: `att_${Date.now()}`,
      name: backendData.name || file.name,
      type: type,
      mimeType: file.type,
      size: file.size,
      url: backendData.url,
      driveFileId: backendData.driveFileId,
      driveLink: backendData.driveLink,
      syncStatus: "SYNCED",
    };

    console.log(
      `[Upload Success] Server: ${attachment.url} | Drive: ${attachment.driveLink}`
    );
    return attachment;
  } catch (error) {
    console.error("Upload Error:", error);

    throw error;
  }
};
