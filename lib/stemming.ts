/**
 * Minimal, deliberately simple suffix-stripping stemmer (not a full Porter
 * stemmer) used by both the hashing embedder and the extractive answer
 * provider so that "refund"/"refunds", "key"/"keys", "cancel"/"cancelling"
 * etc. are treated as the same token for retrieval and lexical-overlap
 * scoring. Good enough for English support-doc vocabulary; not meant to be
 * linguistically rigorous.
 */
export function stem(word: string): string {
  let w = word;
  if (w.length > 5 && w.endsWith("ing")) w = w.slice(0, -3);
  else if (w.length > 4 && w.endsWith("ies")) w = `${w.slice(0, -3)}y`;
  else if (w.length > 4 && w.endsWith("es")) w = w.slice(0, -2);
  else if (w.length > 4 && w.endsWith("ed")) w = w.slice(0, -2);
  else if (w.length > 3 && w.endsWith("s") && !w.endsWith("ss")) w = w.slice(0, -1);
  return w;
}
