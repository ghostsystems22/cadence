export type ApiRecord<T extends Record<string, unknown> = Record<string, unknown>> = { id: string; createdTime?: string; fields: T };
export type TaskFields = { name?: string; status?: string; priority?: string; estimatedHours?: number; legacyEstimateHours?: number; loggedHours?: number; dueDate?: string; pinnedDay?: string; capacityExempt?: boolean; phase?: string[]; project?: string[]; children?: string[]; displayOrder?: number; type?: string; notes?: string; completedAt?: string };
export type Bootstrap = { Projects: ApiRecord[]; Phases: ApiRecord[]; Tasks: ApiRecord<TaskFields>[]; Milestones: ApiRecord[]; 'Day Capacity': ApiRecord[]; 'Capacity Template': ApiRecord[]; Settings: ApiRecord[] };
const tokenKey = 'cadence.app-token';
export const getAppToken = () => localStorage.getItem(tokenKey) ?? '';
export const setAppToken = (token: string) => localStorage.setItem(tokenKey, token.trim());
export const clearAppToken = () => localStorage.removeItem(tokenKey);

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`/api${path}`, { headers: { 'Content-Type': 'application/json', 'X-App-Token': getAppToken(), ...(init.headers ?? {}) }, ...init });
  if (!response.ok) throw new Error((await response.json().catch(() => ({})) as { error?: string }).error ?? `API ${response.status}`);
  return response.json() as Promise<T>;
}
export const api = {
  health: () => request<{ ok: boolean; source: string; auth: boolean }>('/health'),
  bootstrap: () => request<Bootstrap>('/bootstrap'),
  create: (table: string, fields: Record<string, unknown>) => request<{ records: ApiRecord[] }>(`/${encodeURIComponent(table)}`, { method: 'POST', body: JSON.stringify({ fields }) }),
  update: (table: string, id: string, fields: Record<string, unknown>) => request<ApiRecord>(`/${encodeURIComponent(table)}/${id}`, { method: 'PATCH', body: JSON.stringify({ fields }) }),
  upsert: (table: string, records: { id?: string; fields: Record<string, unknown> }[], fieldsToMergeOn?: string[]) => request<{ records: ApiRecord[] }>(`/${encodeURIComponent(table)}`, { method: 'PATCH', body: JSON.stringify({ records, ...(fieldsToMergeOn ? { performUpsert: { fieldsToMergeOn } } : {}) }) }),
  remove: (table: string, id: string) => request<{ id: string; deleted: boolean }>(`/${encodeURIComponent(table)}/${id}`, { method: 'DELETE' }),
};
