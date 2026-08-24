
referencia para o recall

async function recall(userId: string, query: string, k = 3): Promise<Memory[]>{
  cosnt q = await embed(query)
  return this._all(userId).map(mappedUser => ({ ...mappedUser, score: dot(q, mappedUser.embedding) })).sort((a, b) => b.score - a.score).slice(0, k).filter(mappedUser.score > 0.3) //relevancia minima
}