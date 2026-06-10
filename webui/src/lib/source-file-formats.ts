/**
 * 资料库上传 — 常见文档 / 媒体格式（与后端 source_formats.py 对齐）
 */

export const SUFFIX_TO_TYPE: Record<string, string> = {
  '.pdf': 'pdf',
  '.doc': 'word',
  '.docx': 'word',
  '.docm': 'word',
  '.odt': 'word',
  '.rtf': 'word',
  '.wps': 'word',
  '.xls': 'excel',
  '.xlsx': 'excel',
  '.xlsm': 'excel',
  '.xlsb': 'excel',
  '.ods': 'excel',
  '.csv': 'excel',
  '.tsv': 'excel',
  '.et': 'excel',
  '.ppt': 'ppt',
  '.pptx': 'ppt',
  '.pptm': 'ppt',
  '.odp': 'ppt',
  '.pot': 'ppt',
  '.potx': 'ppt',
  '.pps': 'ppt',
  '.ppsx': 'ppt',
  '.dps': 'ppt',
  '.txt': 'text',
  '.md': 'text',
  '.markdown': 'text',
  '.json': 'text',
  '.xml': 'text',
  '.yaml': 'text',
  '.yml': 'text',
  '.html': 'text',
  '.htm': 'text',
  '.log': 'text',
  '.png': 'image',
  '.jpg': 'image',
  '.jpeg': 'image',
  '.gif': 'image',
  '.webp': 'image',
  '.svg': 'image',
  '.bmp': 'image',
  '.ico': 'image',
  '.heic': 'image',
  '.heif': 'image',
  '.tif': 'image',
  '.tiff': 'image',
  '.mp4': 'video',
  '.mov': 'video',
  '.webm': 'video',
  '.avi': 'video',
  '.mkv': 'video',
  '.m4v': 'video',
  '.wmv': 'video',
  '.flv': 'video',
  '.mp3': 'audio',
  '.wav': 'audio',
  '.m4a': 'audio',
  '.ogg': 'audio',
  '.flac': 'audio',
  '.aac': 'audio',
  '.wma': 'audio',
};

const OFFICE_MIME_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-word.document.macroEnabled.12',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel.sheet.macroEnabled.12',
  'application/vnd.ms-excel.sheet.binary.macroEnabled.12',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.ms-powerpoint.presentation.macroEnabled.12',
  'application/vnd.oasis.opendocument.text',
  'application/vnd.oasis.opendocument.spreadsheet',
  'application/vnd.oasis.opendocument.presentation',
  'application/rtf',
  'text/plain',
  'text/csv',
  'text/markdown',
  'text/html',
  'text/xml',
  'application/json',
  'application/xml',
  'image/*',
  'video/*',
  'audio/*',
];

/** file input accept：扩展名 + MIME（PPT 等 Office 格式在 macOS 上需要 MIME） */
export const UPLOAD_ACCEPT = [...Object.keys(SUFFIX_TO_TYPE), ...OFFICE_MIME_TYPES].join(',');

export function fileExtension(filename: string): string {
  const i = filename.lastIndexOf('.');
  return i >= 0 ? filename.slice(i).toLowerCase() : '';
}

export function sourceTypeFromFilename(filename: string): string {
  return SUFFIX_TO_TYPE[fileExtension(filename)] ?? 'text';
}

export function isKnownUploadExtension(filename: string): boolean {
  return fileExtension(filename) in SUFFIX_TO_TYPE;
}

export type FileIconKind =
  | 'pdf'
  | 'word'
  | 'sheet'
  | 'ppt'
  | 'image'
  | 'video'
  | 'audio'
  | 'text';

export function fileIconKind(filename: string): FileIconKind {
  const type = sourceTypeFromFilename(filename);
  if (type === 'pdf') return 'pdf';
  if (type === 'word') return 'word';
  if (type === 'excel') return 'sheet';
  if (type === 'ppt') return 'ppt';
  if (type === 'image') return 'image';
  if (type === 'video') return 'video';
  if (type === 'audio') return 'audio';
  return 'text';
}
