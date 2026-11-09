import { describe, expect, it } from 'vitest';
import { ankamaInput, ankamaOperationInput, characterInput, entityFilters, entityStatus } from '../src/main/validation';
const id = '54b780d0-a45d-4b23-830c-ad273a74a865';
describe('account and character IPC boundary', () => {
  it('rejects forged email links on characters and arbitrary fields', () => {
    expect(() => characterInput({ ankamaId: id, name: 'Ryu', breedId: 1, serverId: 20, emailId: id })).toThrow();
    expect(characterInput({ ankamaId: id, name: 'Ryu', breedId: 1, serverId: 20 })).toEqual({ ankamaId: id, name: 'Ryu', breedId: 1, serverId: 20 });
  });
  it('permits all character statuses but restricts account statuses', () => {
    for (const status of ['C', 'E', 'F', 'B']) expect(entityStatus(status, true)).toBe(status);
    expect(() => entityStatus('E')).toThrow();
    expect(() => entityStatus('X', true)).toThrow();
  });
  it('validates identifiers, pagination and game options before HTTP', () => {
    expect(() => ankamaInput({ login: 'ryu', password: 'secret', emailId: '../etc' })).toThrow();
    expect(() => characterInput({ ankamaId: id, name: 'Ryu', breedId: 0, serverId: 20 })).toThrow();
    expect(() => entityFilters({ pageSize: 101 })).toThrow();
    expect(entityFilters({ search: 'a&b', page: 2, pageSize: 25 })).toBe('search=a%26b&page=2&pageSize=25');
  });
  it('requires stable UUID idempotency keys and rejects names on generated character operations', () => {
    expect(ankamaOperationInput({ emailId: id, idempotencyKey: id })).toEqual({ emailId: id, idempotencyKey: id });
    expect(() => ankamaOperationInput({ emailId: id, idempotencyKey: 'random' })).toThrow();
    expect(() => characterInput({ ankamaId: id, name: 'fixed', breedId: 1, serverId: 20, idempotencyKey: id }, true)).toThrow();
  });
});
