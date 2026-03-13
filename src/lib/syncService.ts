import { offlineDb, PendingAction } from '../lib/offlineDb';

export const queueAction = async (type: PendingAction['type'], data: any) => {
  await offlineDb.pendingActions.add({
    type,
    data,
    timestamp: Date.now()
  });
  
  // Try to sync immediately if online
  if (navigator.onLine) {
    syncPendingActions();
  }
};

export const syncPendingActions = async () => {
  const actions = await offlineDb.pendingActions.toArray();
  if (actions.length === 0) return;

  try {
    const response = await fetch('/api/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ actions })
    });

    if (response.ok) {
      const { results } = await response.json();
      const successfulIds = results
        .filter((r: any) => r.status === 'success')
        .map((r: any) => r.id);
      
      if (successfulIds.length > 0) {
        await offlineDb.pendingActions.bulkDelete(successfulIds);
        console.log(`Successfully synced ${successfulIds.length} actions`);
      }
    }
  } catch (error) {
    console.error('Sync failed:', error);
  }
};

// Listen for online event
window.addEventListener('online', () => {
  console.log('Back online, starting sync...');
  syncPendingActions();
});
