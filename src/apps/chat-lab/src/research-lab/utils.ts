import { constants, createTranslator } from 'short-uuid';

const urlIdTranslator = createTranslator(constants.flickrBase58);

export function formatDate(date: string): string {
  return new Date(date).toLocaleDateString('en-GB', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export function toUrlId(uuid: string): string {
  return urlIdTranslator.fromUUID(uuid);
}

export function fromUrlId(urlId: string): string {
  if (!urlIdTranslator.validate(urlId, true)) {
    throw new Error('Invalid short-uuid');
  }
  return urlIdTranslator.toUUID(urlId);
}
