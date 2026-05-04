import type { Attachment, Message } from '../types';

export type ConversationExportFormat = 'markdown' | 'txt';

export interface ConversationExportOptions {
  format: ConversationExportFormat;
  title?: string;
  startIndex?: number;
  includeTimestamps?: boolean;
}

export interface ExportImageItem {
  url: string;
  fileName: string;
  messageId: string;
}

function formatRole(role: Message['role']): string {
  if (role === 'assistant') return 'Assistant';
  if (role === 'user') return 'User';
  return 'System';
}

function sanitizeFilenamePart(input: string): string {
  const base = input.trim().toLowerCase().replace(/\s+/g, '-');
  const sanitized = base.replace(/[^a-z0-9._-]/g, '');
  return sanitized || 'conversation';
}

function getAttachmentLabel(
  attachment: Attachment,
  index: number,
  messageRole: Message['role']
): string {
  if (attachment.name?.trim()) {
    return attachment.name.trim();
  }
  if (attachment.type === 'image') {
    return `${formatRole(messageRole)}-image-${index + 1}`;
  }
  return `${formatRole(messageRole)}-attachment-${index + 1}`;
}

function buildAttachmentLines(
  attachments: Attachment[] | undefined,
  messageRole: Message['role'],
  isMarkdown: boolean
): string[] {
  if (!attachments || attachments.length === 0) {
    return [];
  }

  const imageAttachments = attachments.filter(att => att.type === 'image');
  if (imageAttachments.length === 0) {
    return [];
  }

  const header = isMarkdown ? '### Images' : 'Images:';
  const lines = [header];

  imageAttachments.forEach((att, index) => {
    const label = getAttachmentLabel(att, index, messageRole);
    const availabilitySuffix =
      att.status === 'missing' || !att.url ? ' (unavailable)' : '';
    lines.push(`- ${label}${availabilitySuffix}`);
  });

  return lines;
}

export function buildConversationExportText(
  messages: Message[],
  options: ConversationExportOptions
): string {
  const {
    format,
    title = 'Conversation',
    startIndex = 0,
    includeTimestamps = false,
  } = options;
  const targetMessages = messages.slice(startIndex);
  const isMarkdown = format === 'markdown';
  const lines: string[] = [];

  if (isMarkdown) {
    lines.push(`# ${title}`);
    lines.push('');
    lines.push(`Exported: ${new Date().toISOString()}`);
    lines.push('');
    lines.push('---');
    lines.push('');
  }

  targetMessages.forEach(message => {
    const roleLabel = formatRole(message.role);
    if (isMarkdown) {
      lines.push(`## ${roleLabel}`);
    } else {
      lines.push(`[${roleLabel}]`);
    }
    if (includeTimestamps) {
      lines.push(`Timestamp: ${message.timestamp}`);
    }
    lines.push(message.content || '');
    const attachmentLines = buildAttachmentLines(
      message.attachments,
      message.role,
      isMarkdown
    );
    if (attachmentLines.length > 0) {
      lines.push('');
      lines.push(...attachmentLines);
    }
    lines.push('');
  });

  return lines.join('\n').trim();
}

export function buildConversationExportFilename(
  title: string | undefined,
  format: ConversationExportFormat
): string {
  const safeTitle = sanitizeFilenamePart(title || 'conversation');
  const datePart = new Date().toISOString().replace(/[:.]/g, '-');
  const ext = format === 'markdown' ? 'md' : 'txt';
  return `${safeTitle}-${datePart}.${ext}`;
}

export async function copyTextToClipboard(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    document.body.appendChild(textArea);
    textArea.select();
    document.execCommand('copy');
    document.body.removeChild(textArea);
  }
}

export function downloadTextFile(
  content: string,
  filename: string,
  format: ConversationExportFormat
): void {
  const mimeType = format === 'markdown' ? 'text/markdown' : 'text/plain';
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function collectImageAttachments(
  messages: Message[],
  startIndex: number = 0
): ExportImageItem[] {
  const collected: ExportImageItem[] = [];
  const seen = new Set<string>();

  messages.slice(startIndex).forEach(message => {
    (message.attachments || [])
      .filter(att => att.type === 'image' && typeof att.url === 'string')
      .forEach((att, index) => {
        const url = att.url!;
        if (seen.has(url)) {
          return;
        }
        seen.add(url);
        collected.push({
          url,
          fileName: getAttachmentLabel(att, index, message.role),
          messageId: message.id,
        });
      });
  });

  return collected;
}

export async function downloadImageByUrl(
  url: string,
  filename: string
): Promise<void> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download image: ${response.status}`);
  }
  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(objectUrl);
}
