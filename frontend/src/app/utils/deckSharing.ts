import pako from 'pako';

export type PortableCard = {
  n: string; // name
  q: number; // quantity
  i?: string | null; // custom_image (optional)
};

export type PortableDeck = {
  n: string; // project name
  c: PortableCard[]; // cards
};

/**
 * Compresses a deck object into a URL-safe Base64 string.
 */
export function compressDeck(deck: PortableDeck): string {
  const json = JSON.stringify(deck);
  const compressed = pako.deflate(json);
  
  // Convert Uint8Array to Base64
  let binary = '';
  const len = compressed.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(compressed[i]);
  }
  
  // Use URL-safe mapping: + -> -, / -> _, remove padding =
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/**
 * Decompresses a URL-safe Base64 string back into a deck object.
 */
export function decompressDeck(str: string): PortableDeck | null {
  try {
    // Restore standard Base64 characters
    let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4) {
      base64 += '=';
    }
    
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    
    const decompressed = pako.inflate(bytes, { to: 'string' });
    return JSON.parse(decompressed) as PortableDeck;
  } catch (err) {
    console.error('Failed to decompress deck:', err);
    return null;
  }
}
