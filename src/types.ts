export interface Tenant {
  id: number;
  name: string;
  description: string;
}

export interface Client {
  id: number;
  tenant_id: number;
  name: string;
  address: string;
}

export interface Guard {
  id: number;
  tenant_id: number;
  name: string;
  phone: string;
  status: 'Available' | 'Busy' | 'Off-duty';
  location_lat?: number;
  location_lng?: number;
}

export interface Incident {
  id: number;
  tenant_id: number;
  client_id: number;
  client_name?: string;
  type: string;
  location: string;
  severity: 'Low' | 'Medium' | 'High' | 'Critical';
  description: string;
  status: 'Open' | 'Dispatched' | 'Resolved' | 'Closed';
  created_at: string;
}

export interface Dispatch {
  id: number;
  incident_id: number;
  guard_id: number;
  priority: number;
  status: string;
  assigned_at: string;
}

export interface Stats {
  activeIncidents: number;
  availableGuards: number;
  todayIncidents: number;
}

export interface AuditLog {
  id: number;
  tenant_id: number;
  action: string;
  details: string;
  timestamp: string;
}
