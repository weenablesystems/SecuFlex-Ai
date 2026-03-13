import Dexie, { Table } from 'dexie';

export interface PendingAction {
  id?: number;
  type: 'INCIDENT' | 'PATROL' | 'STATUS_UPDATE';
  data: any;
  timestamp: number;
}

export class OfflineDB extends Dexie {
  pendingActions!: Table<PendingAction>;

  constructor() {
    super('SecurityOpsOfflineDB');
    this.version(1).stores({
      pendingActions: '++id, type, timestamp'
    });
  }
}

export const offlineDb = new OfflineDB();
