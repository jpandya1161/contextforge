/**
 * Small English stopword list. Filtering these out before hashing/scoring
 * matters a lot for a bag-of-words retrieval method: without it, every
 * question ("how", "what", "does", "the", "is") contributes noise that's
 * present in literally every document, diluting the signal from the
 * content words that actually distinguish one topic from another.
 */
export const STOPWORDS = new Set([
  "a", "an", "the", "and", "or", "but", "if", "then", "than", "so",
  "is", "are", "was", "were", "be", "been", "being", "am",
  "do", "does", "did", "doing",
  "have", "has", "had", "having",
  "i", "you", "he", "she", "it", "we", "they", "me", "him", "her", "us", "them",
  "my", "your", "his", "its", "our", "their",
  "this", "that", "these", "those",
  "what", "which", "who", "whom", "how", "when", "where", "why",
  "can", "could", "will", "would", "should", "may", "might", "must", "shall",
  "to", "of", "in", "on", "at", "by", "for", "with", "about", "against",
  "between", "into", "through", "during", "before", "after", "above", "below",
  "from", "up", "down", "out", "off", "over", "under", "again", "further",
  "not", "no", "nor", "only", "own", "same", "just", "also",
  "get", "got", "getting", "one", "any", "all", "there",
]);
