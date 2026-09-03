import 'reflect-metadata';
import { describe, expect, it } from '@jest/globals';

import { PageRequest } from './pagination.entity';

describe('PageRequest', () => {
  it('passing default number parameters', () => {
    const pageRequest = new PageRequest(0, 20, 'id,ASC');
    expect(pageRequest.page).toBe(0);
    expect(pageRequest.size).toBe(20);
    expect(pageRequest.sort.asOrder()).toMatchObject({ id: 'ASC' });
  });

  it('passing default strings parameters', () => {
    const pageRequest = new PageRequest('0', '20', 'id,ASC');
    expect(pageRequest.page).toBe(0);
    expect(pageRequest.size).toBe(20);
    expect(pageRequest.sort.asOrder()).toMatchObject({ id: 'ASC' });
  });

  it('passing non default strings parameters', () => {
    const pageRequest = new PageRequest('10', '30', 'foo,DESC');
    expect(pageRequest.page).toBe(10);
    expect(pageRequest.size).toBe(30);
    expect(pageRequest.sort.asOrder()).toMatchObject({ foo: 'DESC' });
  });
});
