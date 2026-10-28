import { test } from 'node:test';
import assert from 'node:assert';
import {
  toCatalogue, entriesOutsideCatalogue, diffCatalogues, staleRepoMappings
} from '../src/lib/catalogue.js';

test('toCatalogue drops the Id -1 overflow placeholders', () => {
  const catalogue = toCatalogue([
    { Id: 3448, Name: 'FP - Canva - Agile', Categories: [
      { Id: 1, Name: 'Meetings' }, { Id: -1, Name: null }, { Id: 2, Name: 'One Drive' }
    ] },
    { Id: -1, Name: null, Categories: [] }
  ]);
  assert.deepStrictEqual(catalogue, { 'FP - Canva - Agile': ['Meetings', 'One Drive'] });
});

test('toCatalogue never yields "Other" as a Category', () => {
  const catalogue = toCatalogue([{ Id: 1, Name: 'P', Categories: [{ Id: 2, Name: 'Other' }] }]);
  assert.deepStrictEqual(catalogue, { P: [] });
});

test('entriesOutsideCatalogue finds unsubmitted Entries with retired pairings', () => {
  const catalogue = { 'FP - Canva - Agile': ['Meetings'] };
  const entries = [
    { project: 'FP - Canva - Agile', category: 'Meetings' },
    { project: 'R - Canva - Agile Team', category: 'BigQuery' },
    { project: 'R - Canva - Agile Team', category: 'BigQuery', submitted: true },
    { project: 'FP - Canva - Agile', category: 'BigQuery' }
  ];
  assert.deepStrictEqual(entriesOutsideCatalogue(entries, catalogue), [1, 3]);
});

test('diffCatalogues reports pairings, not just Projects', () => {
  const before = { A: ['x', 'y'], Gone: ['z'] };
  const after = { A: ['x', 'w'] };
  assert.deepStrictEqual(diffCatalogues(before, after), {
    added: ['A / w'],
    removed: ['A / y', 'Gone / z']
  });
});

test('staleRepoMappings lists repos stranded by a retired pairing', () => {
  const repos = {
    kept: { project: 'A', category: 'x' },
    stranded: { project: 'Gone', category: 'z' }
  };
  assert.deepStrictEqual(staleRepoMappings(repos, { A: ['x'] }), ['stranded → Gone / z']);
});
