const maps = {
  Projects: { name: 'Name', notes: 'Notes', assignee: 'Assignee', status: 'Status', color: 'Color', client: 'Client', startDate: 'Start Date', targetEnd: 'Target End', order: 'Order', phases: 'Phases', tasks: 'Tasks' },
  Phases: { name: 'Name', project: 'Project', startDate: 'Start Date', endDate: 'End Date', order: 'Order', notes: 'Notes', tasks: 'Tasks' },
  Milestones: { name: 'Name', kind: 'Kind', status: 'Status', notes: 'Notes', date: 'Date', project: 'Project', tasks: 'Tasks' },
  Tasks: {
    name: 'Name', type: 'Type', status: 'Status', priority: 'Priority', deadlineMode: 'Deadline Mode', notes: 'Notes',
    estimatedHours: 'Estimated Hours', legacyEstimateHours: 'Estimate Hours', loggedHours: 'Logged Hours', dueDate: 'Due Date',
    startNotBefore: 'Start Not Before', completedAt: 'Completed At', displayOrder: 'Order', tags: 'Tags', project: 'Project',
    parent: 'Parent', children: 'Children', blockedBy: 'Blocked By', blocks: 'Blocks', milestone: 'Milestone', timeLogs: 'Time Logs',
    phase: 'Phase', pinnedDay: 'Pinned Day', capacityExempt: 'Capacity Exempt',
  },
  'Time Logs': { logId: 'Log ID', note: 'Note', date: 'Date', hours: 'Hours', task: 'Task' },
  'Day Capacity': { key: 'Key', day: 'Day', hours: 'Hours', note: 'Note', updatedAt: 'Updated At' },
  'Capacity Template': { weekday: 'Weekday', index: 'Index', hours: 'Hours' },
  Settings: { key: 'Key', value: 'Value' },
  'Activity Log': { eventId: 'Event ID', type: 'Type', label: 'Label', payload: 'Payload', task: 'Task', project: 'Project' },
};

export const tables = Object.freeze(Object.keys(maps));
export const toClient = (table, fields = {}) => {
  const map = maps[table];
  if (!map) throw new Error(`Unsupported table: ${table}`);
  return Object.fromEntries(Object.entries(map).flatMap(([client, airtable]) => Object.prototype.hasOwnProperty.call(fields, airtable) ? [[client, fields[airtable]]] : []));
};
export const toAirtable = (table, fields = {}) => {
  const map = maps[table];
  if (!map) throw new Error(`Unsupported table: ${table}`);
  return Object.fromEntries(Object.entries(fields).flatMap(([client, value]) => map[client] && value !== undefined ? [[map[client], value]] : []));
};
export const recordToClient = (table, record) => ({ id: record.id, createdTime: record.createdTime, fields: toClient(table, record.fields) });
export const recordToAirtable = (table, record) => ({ ...record, fields: toAirtable(table, record.fields ?? {}) });
