export type Sort = [field: string, order: 'asc' | 'desc']
export type Query = { sort?: Sort[]; limit?: number }
export interface Transaction {
  get<T>(collection: string, id: string): Promise<T | undefined>
  list<T>(collection: string, query?: Query): Promise<T[]>
  set<T extends object>(collection: string, id: string, value: T): void
}
export interface Store {
  run<T>(work: (transaction: Transaction) => Promise<T>): Promise<T>
}
