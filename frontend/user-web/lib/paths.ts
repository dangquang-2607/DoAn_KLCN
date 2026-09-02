//Mục đích: Định nghĩa một lần duy nhất nơi lưu file. Mọi module khác đều import từ đây, không hardcode string path.
import path from "path";

// process.cwd() = thư mục root của project (nơi chạy `npm run dev`)
export const DATA_DIR = path.join(process.cwd(), "data");
export const UPLOADS_DIR = path.join(DATA_DIR, "uploads");
export const CSV_PATH = path.join(DATA_DIR, "results.csv");

// Định dạng file chấp nhận (kiểm tra ở cả upload lẫn OCR)
export const ALLOWED_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp", ".pdf"];
