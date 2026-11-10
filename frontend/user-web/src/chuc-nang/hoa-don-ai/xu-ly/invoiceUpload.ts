const MAX_INVOICE_IMAGES = 3;
const MAX_INVOICE_IMAGE_BYTES = 2 * 1024 * 1024;
const MAX_SOURCE_IMAGE_BYTES = 20 * 1024 * 1024;
const preparedImages = new WeakMap<File, Promise<File>>();
export const INVOICE_IMAGE_ACCEPT = ".jpg,.jpeg,.png,.webp";

export function invoiceUploadError(files: File[]): string {
  if (files.length > MAX_INVOICE_IMAGES) return "Mỗi lượt chỉ được tải tối đa 3 ảnh. Hãy chọn lại tối đa 3 ảnh.";
  const errors = files.flatMap(file => {
    if (!/\.(jpe?g|png|webp)$/i.test(file.name)) return [`“${file.name}” không phải định dạng ảnh được hỗ trợ.`];
    if (!file.size) return [`“${file.name}” là tệp rỗng.`];
    if (file.size > MAX_SOURCE_IMAGE_BYTES) return [`“${file.name}” vượt quá 20 MB.`];
    return [];
  });
  return errors.length ? `${errors.join(" ")} Chỉ nhận JPG, JPEG, PNG, WEBP tối đa 20 MB/ảnh. Lượt này chưa được tải lên.` : "";
}

/** Reuse the exact encoded bytes on retries, including duplicate-review tickets. */
export function prepareInvoiceImage(file: File): Promise<File> {
  const error = invoiceUploadError([file]);
  if (error) return Promise.reject(new Error(error));
  if (file.size <= MAX_INVOICE_IMAGE_BYTES) return Promise.resolve(file);
  const existing = preparedImages.get(file);
  if (existing) return existing;
  const prepared = compressInvoiceImage(file).catch(error => {
    preparedImages.delete(file);
    throw error;
  });
  preparedImages.set(file, prepared);
  return prepared;
}

async function compressInvoiceImage(file: File): Promise<File> {
  const url = URL.createObjectURL(file);
  const image = new Image();
  const canvas = document.createElement("canvas");
  try {
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error(`Không đọc được ảnh “${file.name}”. Hãy lưu lại ảnh dưới dạng JPG hoặc chọn ảnh khác.`));
      image.src = url;
    });
    const context = canvas.getContext("2d");
    if (!context || !image.naturalWidth || !image.naturalHeight) throw new Error("Thiết bị không xử lý được ảnh. Hãy chọn ảnh nhỏ hơn.");
    // Preserve aspect ratio and orientation; never crop receipt content. Avoid
    // overly small/low-quality output that would make invoice text unreadable.
    for (const maxEdge of [3200, 2560, 2048]) {
      const scale = Math.min(1, maxEdge / Math.max(image.naturalWidth, image.naturalHeight));
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
      context.fillStyle = "#fff";
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      for (const quality of [0.92, 0.85, 0.78]) {
        const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, "image/jpeg", quality));
        if (!blob) throw new Error("Không thể giảm dung lượng ảnh trên thiết bị này. Hãy chọn ảnh nhỏ hơn.");
        if (blob.size > 0 && blob.size <= MAX_INVOICE_IMAGE_BYTES) {
          return new File([blob], file.name.replace(/\.[^.]+$/, ".jpg"), { type: "image/jpeg", lastModified: file.lastModified });
        }
      }
    }
    throw new Error(`Ảnh “${file.name}” vẫn quá lớn sau khi tối ưu. Hãy cắt bớt phần nền quanh hóa đơn rồi thử lại.`);
  } finally {
    image.onload = null;
    image.onerror = null;
    image.src = "";
    URL.revokeObjectURL(url);
    canvas.width = canvas.height = 0;
  }
}
