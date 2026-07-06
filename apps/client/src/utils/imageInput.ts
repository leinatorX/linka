const MAX_ICON_FILE_SIZE = 512 * 1024;
const MAX_AVATAR_FILE_SIZE = 1024 * 1024;

function readImageFileAsDataUrl(file: File, maxFileSize: number, tooLargeMessage: string): Promise<string> {
  if (!file.type.startsWith("image/")) {
    return Promise.reject(new Error("请选择图片文件。"));
  }

  if (file.size > maxFileSize) {
    return Promise.reject(new Error(tooLargeMessage));
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

export function readIconFileAsDataUrl(file: File): Promise<string> {
  return readImageFileAsDataUrl(file, MAX_ICON_FILE_SIZE, "图标图片不能超过 512KB。");
}

export function readAvatarFileAsDataUrl(file: File): Promise<string> {
  return readImageFileAsDataUrl(file, MAX_AVATAR_FILE_SIZE, "头像图片不能超过 1024KB。");
}
