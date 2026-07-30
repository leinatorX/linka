export function generateEmbedding(text: string): number[] {
  const DIMENSIONS = 64;
  const vector = new Array(DIMENSIONS).fill(0);
  
  if (!text) {
    return vector;
  }

  const normalizedText = text.toLowerCase().trim();
  for (let i = 0; i < normalizedText.length; i++) {
    const charCode = normalizedText.charCodeAt(i);
    const dimIndex = charCode % DIMENSIONS;
    vector[dimIndex] += 1;
  }

  let sumSquares = 0;
  for (let i = 0; i < DIMENSIONS; i++) {
    sumSquares += vector[i] * vector[i];
  }
  
  if (sumSquares > 0) {
    const magnitude = Math.sqrt(sumSquares);
    for (let i = 0; i < DIMENSIONS; i++) {
      vector[i] /= magnitude;
    }
  }

  return vector;
}

export function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (vecA.length !== vecB.length || vecA.length === 0) return 0;
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

export function calculateHybridScore(
  vectorScore: number, 
  keywordScore: number, 
  vectorWeight: number = 0.7
): number {
  const keywordWeight = 1.0 - vectorWeight;
  return (vectorScore * vectorWeight) + (keywordScore * keywordWeight);
}

export function calculateKeywordScore(text: string, query: string): number {
  if (!query) return 0;
  const t = text.toLowerCase();
  const q = query.toLowerCase();
  if (t === q) return 1.0;
  if (t.includes(q)) return 0.8;
  
  const words = q.split(/\s+/).filter(Boolean);
  if (words.length === 0) return 0;
  
  let matchCount = 0;
  for (const word of words) {
    if (t.includes(word)) matchCount++;
  }
  return (matchCount / words.length) * 0.5;
}
