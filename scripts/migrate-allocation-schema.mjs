#!/usr/bin/env node
/**
 * Additive, idempotent migration for Cadence resource allocation.
 * Usage: set -a; source .env; set +a; node scripts/migrate-allocation-schema.mjs --apply
 */
const apply = process.argv.includes('--apply');
const baseId = process.env.AIRTABLE_BASE_ID;
const token = process.env.AIRTABLE_API_KEY;
if (!baseId || !token) throw new Error('AIRTABLE_BASE_ID and AIRTABLE_API_KEY are required');

const baseUrl = `https://api.airtable.com/v0/meta/bases/${baseId}`;
const request = async (path, init = {}) => {
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(init.headers ?? {}) },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`${init.method ?? 'GET'} ${path}: ${response.status} ${JSON.stringify(body)}`);
  return body;
};
const listTables = () => request('/tables');
const tableDefinitions = [
  { name: 'Day Capacity', fields: [
    { name: 'Key', type: 'singleLineText' },
    { name: 'Day', type: 'date', options: { dateFormat: { name: 'iso', format: 'YYYY-MM-DD' } } },
    { name: 'Hours', type: 'number', options: { precision: 1 } },
    { name: 'Note', type: 'singleLineText' },
  ] },
  { name: 'Capacity Template', fields: [
    { name: 'Weekday', type: 'singleLineText' },
    { name: 'Index', type: 'number', options: { precision: 0 } },
    { name: 'Hours', type: 'number', options: { precision: 1 } },
  ] },
];
const postCreateFields = [
  { table: 'Day Capacity', field: { name: 'Updated At', type: 'lastModifiedTime', options: {} } },
];
const taskFields = [
  { name: 'Estimated Hours', type: 'number', options: { precision: 2 } },
  { name: 'Pinned Day', type: 'date', options: { dateFormat: { name: 'iso', format: 'YYYY-MM-DD' } } },
  { name: 'Capacity Exempt', type: 'checkbox', options: { color: 'greenBright', icon: 'check' } },
  { name: 'Logged Hours', type: 'rollup', options: {
    recordLinkFieldId: 'fldoZpdyms2kTGXGH',
    fieldIdInLinkedTable: 'fldomzgJlAx7304kn',
    formula: 'SUM(values)',
  } },
];

let schema = await listTables();
for (const definition of tableDefinitions) {
  if (schema.tables.some((table) => table.name === definition.name)) {
    console.log(`exists table ${definition.name}`);
    continue;
  }
  if (!apply) { console.log(`would create table ${definition.name}`); continue; }
  await request('/tables', { method: 'POST', body: JSON.stringify(definition) });
  console.log(`created table ${definition.name}`);
  schema = await listTables();
}
for (const { table: tableName, field } of postCreateFields) {
  const table = schema.tables.find((candidate) => candidate.name === tableName);
  if (!table) throw new Error(`${tableName} table missing`);
  if (table.fields.some((existing) => existing.name === field.name)) {
    console.log(`exists field ${tableName}.${field.name}`);
    continue;
  }
  if (!apply) { console.log(`would create field ${tableName}.${field.name}`); continue; }
  try {
    await request(`/tables/${table.id}/fields`, { method: 'POST', body: JSON.stringify(field) });
    console.log(`created field ${tableName}.${field.name}`);
    schema = await listTables();
  } catch (error) {
    if (field.type === 'lastModifiedTime' && String(error).includes('UNSUPPORTED_FIELD_TYPE_FOR_CREATE')) {
      console.warn(`manual Airtable UI step required: create ${tableName}.${field.name} as Last modified time`);
      continue;
    }
    throw error;
  }
}
const tasks = schema.tables.find((table) => table.name === 'Tasks');
if (!tasks) throw new Error('Tasks table missing');
for (const field of taskFields) {
  if (tasks.fields.some((existing) => existing.name === field.name)) {
    console.log(`exists field Tasks.${field.name}`);
    continue;
  }
  if (!apply) { console.log(`would create field Tasks.${field.name}`); continue; }
  await request(`/tables/${tasks.id}/fields`, { method: 'POST', body: JSON.stringify(field) });
  console.log(`created field Tasks.${field.name}`);
  schema = await listTables();
  const updated = schema.tables.find((table) => table.name === 'Tasks');
  tasks.fields = updated.fields;
}
console.log(apply ? 'allocation schema migration complete' : 'dry run complete; pass --apply to write');
