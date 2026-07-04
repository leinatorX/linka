const MAX_ICON_FILE_SIZE = 512 * 1024;

export function readIconFileAsDataUrl(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) {
    return Promise.reject(new Error("请选择图片文件。"));
  }

  if (file.size > MAX_ICON_FILE_SIZE) {
    return Promise.reject(new Error("图标图片不能超过 512KB。"));
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
      } else {
        reject(new Error("图片读取失败。"));
      }
    };
    reader.onerror = () => reject(new Error("图片读取失败。"));
    reader.readAsDataURL(file);
  });
}
