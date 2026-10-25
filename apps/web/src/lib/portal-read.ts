import { portalRequest } from './portal-request';
export function loadCommunity<T>(url: string, signal?: AbortSignal) {
  return portalRequest<T>(url, { signal });
}
