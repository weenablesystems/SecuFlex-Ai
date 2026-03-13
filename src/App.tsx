import React, { useState, useEffect, Component } from 'react';
import { 
  LayoutDashboard, 
  ShieldAlert, 
  Users, 
  FileText, 
  Settings, 
  Bell, 
  Search,
  Plus,
  MapPin,
  Clock,
  CheckCircle2,
  AlertTriangle,
  ChevronRight,
  LogOut,
  Menu,
  X,
  Zap,
  FileSearch,
  ClipboardList,
  Wifi,
  WifiOff,
  Loader2,
  Activity,
  History,
  Download,
  ShieldCheck,
  Lock
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Stats, Incident, Guard, Client, AuditLog } from './types';
import { triageIncident, generateIncidentReport, generateHandoverSummary } from './services/geminiService';

// --- Components ---

class ErrorBoundary extends Component<any, any> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: any, errorInfo: any) {
    console.error("Uncaught error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-zinc-900 text-white p-8">
          <div className="text-center space-y-4">
            <AlertTriangle size={48} className="mx-auto text-red-500" />
            <h2 className="text-2xl font-bold tracking-tight">System Error</h2>
            <p className="text-zinc-400 text-sm">The command center encountered an unexpected error.</p>
            <button onClick={() => window.location.reload()} className="px-8 py-3 bg-emerald-500 text-zinc-900 rounded-2xl font-bold shadow-lg shadow-emerald-500/20">Restart System</button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

const Sidebar = ({ activeView, setActiveView, onLogout, user }: { activeView: string, setActiveView: (v: string) => void, onLogout: () => void, user: any }) => {
  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'incidents', label: 'Occurrence Book', icon: ClipboardList },
    { id: 'dispatch', label: 'Dispatch Center', icon: Zap },
    { id: 'guards', label: 'Guard Force', icon: Users },
    { id: 'reports', label: 'Evidence & Reports', icon: FileSearch },
    { id: 'audit', label: 'Audit Logs', icon: ShieldCheck },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  return (
    <div className="w-64 h-screen bg-white border-r border-zinc-200 flex flex-col fixed left-0 top-0 z-50">
      <div className="p-6 flex items-center gap-3">
        <div className="w-10 h-10 bg-zinc-900 rounded-xl flex items-center justify-center">
          <ShieldAlert className="text-white w-6 h-6" />
        </div>
        <div>
          <h1 className="font-bold text-lg leading-tight">SA-iLabs™</h1>
          <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-semibold">Emma-Ai™ Ops</p>
        </div>
      </div>

      <nav className="flex-1 px-4 py-4 space-y-1">
        {menuItems.map((item) => (
          <button
            key={item.id}
            onClick={() => setActiveView(item.id)}
            className={`sidebar-item w-full ${activeView === item.id ? 'active' : ''}`}
          >
            <item.icon size={20} />
            <span>{item.label}</span>
          </button>
        ))}
      </nav>

      <div className="p-4 border-t border-zinc-100">
        <div className="flex items-center gap-3 px-4 py-3 mb-2 bg-zinc-50 rounded-xl">
          <div className="w-8 h-8 bg-zinc-900 rounded-lg flex items-center justify-center text-white text-[10px] font-bold">
            {user?.name?.split(' ').map((n: string) => n[0]).join('')}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-zinc-900 truncate">{user?.name}</p>
            <p className="text-[10px] text-zinc-500 truncate">{user?.role}</p>
          </div>
        </div>
        <button 
          onClick={onLogout}
          className="sidebar-item w-full text-zinc-400 hover:text-red-600 hover:bg-red-50"
        >
          <LogOut size={20} />
          <span>Sign Out</span>
        </button>
      </div>
    </div>
  );
};

const Toast = ({ message, type, onClose }: { message: string, type: 'success' | 'error' | 'info', onClose: () => void }) => (
  <motion.div
    initial={{ opacity: 0, y: 50, x: '-50%' }}
    animate={{ opacity: 1, y: 0, x: '-50%' }}
    exit={{ opacity: 0, y: 20, x: '-50%' }}
    className={`fixed bottom-8 left-1/2 z-[200] px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-3 border ${
      type === 'success' ? 'bg-emerald-900 border-emerald-800 text-emerald-50' :
      type === 'error' ? 'bg-red-900 border-red-800 text-red-50' :
      'bg-zinc-900 border-zinc-800 text-zinc-50'
    }`}
  >
    {type === 'success' && <CheckCircle2 size={18} className="text-emerald-400" />}
    {type === 'error' && <AlertTriangle size={18} className="text-red-400" />}
    {type === 'info' && <Loader2 size={18} className="text-zinc-400 animate-spin" />}
    <span className="text-sm font-bold tracking-tight">{message}</span>
    <button onClick={onClose} className="ml-2 hover:opacity-70"><X size={14} /></button>
  </motion.div>
);

const SystemHealth = ({ isOnline }: { isOnline: boolean }) => (
  <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border ${
    isOnline ? 'bg-emerald-50 border-emerald-100 text-emerald-600' : 'bg-red-50 border-red-100 text-red-600'
  }`}>
    {isOnline ? <Wifi size={14} /> : <WifiOff size={14} />}
    <span className="text-[10px] font-bold uppercase tracking-wider">{isOnline ? 'System Online' : 'Connection Lost'}</span>
  </div>
);

const Header = ({ title, isOnline, user }: { title: string, isOnline: boolean, user: any }) => (
  <header className="h-16 bg-white/80 backdrop-blur-md border-b border-zinc-200 flex items-center justify-between px-8 sticky top-0 z-40">
    <div className="flex items-center gap-6">
      <h2 className="text-xl font-bold text-zinc-900 tracking-tight">{title}</h2>
      <SystemHealth isOnline={isOnline} />
    </div>
    <div className="flex items-center gap-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
        <input 
          type="text" 
          placeholder="Search command center..." 
          className="pl-10 pr-4 py-2 bg-zinc-100 border-none rounded-full text-sm w-64 focus:ring-2 focus:ring-zinc-200 outline-none transition-all focus:w-80"
        />
      </div>
      <button className="p-2 text-zinc-500 hover:bg-zinc-100 rounded-full relative transition-colors">
        <Bell size={20} />
        <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border-2 border-white"></span>
      </button>
      <div className="flex items-center gap-3 pl-4 border-l border-zinc-200">
        <div className="text-right">
          <p className="text-xs font-bold text-zinc-900">{user?.name || 'Ops Supervisor'}</p>
          <p className="text-[10px] text-zinc-500 font-medium">{user?.role || 'Shift A'}</p>
        </div>
        <div className="w-9 h-9 bg-zinc-900 rounded-xl flex items-center justify-center text-white font-bold text-xs">
          {user?.name?.split(' ').map((n: string) => n[0]).join('') || 'OS'}
        </div>
      </div>
    </div>
  </header>
);

const StatCard = ({ label, value, icon: Icon, color, loading }: any) => (
  <div className="glass-panel p-6 flex items-center justify-between relative overflow-hidden">
    {loading && (
      <div className="absolute inset-0 bg-zinc-50 animate-pulse" />
    )}
    <div className="relative z-10">
      <p className="text-sm text-zinc-500 font-medium mb-1">{label}</p>
      <h3 className="text-3xl font-bold text-zinc-900">{value}</h3>
    </div>
    <div className={`p-3 rounded-2xl ${color} relative z-10`}>
      <Icon size={24} className="text-white" />
    </div>
  </div>
);

// --- Views ---

const AuditLogsView = ({ logs }: { logs: AuditLog[] }) => (
  <div className="glass-panel p-8">
    <div className="flex items-center justify-between mb-8">
      <div>
        <h3 className="text-xl font-bold">System Audit Logs</h3>
        <p className="text-xs text-zinc-500">Immutable record of all command center actions.</p>
      </div>
      <div className="flex items-center gap-2">
        <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
        <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Live Logging</span>
      </div>
    </div>
    <div className="space-y-1">
      {logs.map(log => (
        <div key={log.id} className="flex items-center justify-between p-4 hover:bg-zinc-50 rounded-xl transition-colors group">
          <div className="flex items-center gap-4">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
              log.action.includes('CREATED') ? 'bg-emerald-50 text-emerald-600' :
              log.action.includes('DISPATCHED') ? 'bg-blue-50 text-blue-600' : 'bg-zinc-100 text-zinc-500'
            }`}>
              <Activity size={16} />
            </div>
            <div>
              <p className="text-sm font-bold text-zinc-900">{log.action.replace('_', ' ')}</p>
              <p className="text-xs text-zinc-500">{log.details}</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-[10px] font-mono text-zinc-400">{new Date(log.timestamp).toLocaleTimeString()}</p>
            <p className="text-[10px] font-mono text-zinc-300">{new Date(log.timestamp).toLocaleDateString()}</p>
          </div>
        </div>
      ))}
    </div>
  </div>
);

const DashboardView = ({ stats, incidents, onGenerateHandover }: { stats: Stats | null, incidents: Incident[], onGenerateHandover: () => void }) => (
  <div className="space-y-8">
    <div className="flex items-center justify-between mb-2">
      <div className="flex items-center gap-2">
        <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
        <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Live Feed Active</span>
      </div>
      <p className="text-[10px] font-mono text-zinc-400 uppercase">Last Sync: {new Date().toLocaleTimeString()}</p>
    </div>
    <div className="flex items-center justify-between gap-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 flex-1">
        <StatCard label="Active Incidents" value={stats?.activeIncidents || 0} icon={ShieldAlert} color="bg-red-500" loading={!stats} />
        <StatCard label="Available Guards" value={stats?.availableGuards || 0} icon={Users} color="bg-emerald-500" loading={!stats} />
        <StatCard label="Today's Total" value={stats?.todayIncidents || 0} icon={Clock} color="bg-zinc-900" loading={!stats} />
      </div>
      <button 
        onClick={onGenerateHandover}
        className="glass-panel p-6 flex flex-col items-center gap-2 hover:bg-zinc-100 transition-colors shrink-0"
      >
        <div className="w-10 h-10 bg-zinc-900 rounded-xl flex items-center justify-center text-white">
          <FileText size={20} />
        </div>
        <span className="text-[10px] font-bold uppercase tracking-wider">Shift Handover</span>
      </button>
    </div>

    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      <div className="glass-panel p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="font-bold text-lg">Recent Alerts</h3>
          <button className="text-sm font-medium text-emerald-600 hover:underline">View All</button>
        </div>
        <div className="space-y-4">
          {incidents.slice(0, 5).map((incident) => (
            <div key={incident.id} className="flex items-start gap-4 p-4 rounded-xl hover:bg-zinc-50 transition-colors border border-transparent hover:border-zinc-100">
              <div className={`mt-1 w-2 h-2 rounded-full shrink-0 ${
                incident.severity === 'High' ? 'bg-red-500' : 
                incident.severity === 'Medium' ? 'bg-amber-500' : 'bg-blue-500'
              }`} />
              <div className="flex-1">
                <div className="flex items-center justify-between mb-1">
                  <h4 className="font-semibold text-sm">{incident.type}</h4>
                  <span className="text-[10px] text-zinc-400 font-mono">{new Date(incident.created_at).toLocaleTimeString()}</span>
                </div>
                <p className="text-xs text-zinc-500 line-clamp-1">{incident.location} • {incident.client_name}</p>
              </div>
              <ChevronRight size={16} className="text-zinc-300" />
            </div>
          ))}
        </div>
      </div>

      <div className="glass-panel p-6">
        <h3 className="font-bold text-lg mb-6">Operational Status</h3>
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center text-emerald-600">
                <CheckCircle2 size={20} />
              </div>
              <div>
                <p className="text-sm font-semibold">System Health</p>
                <p className="text-xs text-zinc-500">All nodes operational</p>
              </div>
            </div>
            <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-md">ONLINE</span>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center text-blue-600">
                <Zap size={20} />
              </div>
              <div>
                <p className="text-sm font-semibold">AI Copilot</p>
                <p className="text-xs text-zinc-500">Emma-Ai™ active</p>
              </div>
            </div>
            <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded-md">READY</span>
          </div>
        </div>
      </div>
    </div>
  </div>
);

const OccurrenceBookView = ({ incidents, onNewIncident, onSelectIncident }: { incidents: Incident[], onNewIncident: () => void, onSelectIncident: (i: Incident) => void }) => (
  <div className="glass-panel overflow-hidden">
    <div className="p-6 border-b border-zinc-100 flex items-center justify-between">
      <div>
        <h3 className="font-bold text-lg">Digital Occurrence Book</h3>
        <p className="text-xs text-zinc-500">Official log of all security events</p>
      </div>
      <button 
        onClick={onNewIncident}
        className="flex items-center gap-2 bg-zinc-900 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-zinc-800 transition-colors"
      >
        <Plus size={18} />
        Log Incident
      </button>
    </div>
    <div className="overflow-x-auto">
      <table className="w-full text-left">
        <thead className="bg-zinc-50 text-[10px] uppercase tracking-wider font-bold text-zinc-500">
          <tr>
            <th className="px-6 py-4">ID</th>
            <th className="px-6 py-4">Timestamp</th>
            <th className="px-6 py-4">Type</th>
            <th className="px-6 py-4">Client / Site</th>
            <th className="px-6 py-4">Severity</th>
            <th className="px-6 py-4">Status</th>
            <th className="px-6 py-4"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100">
          {incidents.map((incident) => (
            <tr 
              key={incident.id} 
              onClick={() => onSelectIncident(incident)}
              className="hover:bg-zinc-50 transition-colors group cursor-pointer"
            >
              <td className="px-6 py-4 text-xs font-mono text-zinc-400">#{incident.id.toString().padStart(5, '0')}</td>
              <td className="px-6 py-4 text-xs text-zinc-600">{new Date(incident.created_at).toLocaleString()}</td>
              <td className="px-6 py-4 text-sm font-semibold">{incident.type}</td>
              <td className="px-6 py-4 text-xs text-zinc-500">{incident.client_name}</td>
              <td className="px-6 py-4">
                <span className={`text-[10px] font-bold px-2 py-1 rounded-md ${
                  incident.severity === 'High' ? 'bg-red-50 text-red-600' : 
                  incident.severity === 'Medium' ? 'bg-amber-50 text-amber-600' : 'bg-blue-50 text-blue-600'
                }`}>
                  {incident.severity.toUpperCase()}
                </span>
              </td>
              <td className="px-6 py-4">
                <span className={`flex items-center gap-1.5 text-xs font-medium ${
                  incident.status === 'Open' ? 'text-red-500' : 
                  incident.status === 'Dispatched' ? 'text-blue-500' : 'text-emerald-500'
                }`}>
                  <div className={`w-1.5 h-1.5 rounded-full ${
                    incident.status === 'Open' ? 'bg-red-500' : 
                    incident.status === 'Dispatched' ? 'bg-blue-500' : 'bg-emerald-500'
                  }`} />
                  {incident.status}
                </span>
              </td>
              <td className="px-6 py-4 text-right">
                <button className="p-2 text-zinc-400 hover:text-zinc-900 opacity-0 group-hover:opacity-100 transition-opacity">
                  <ChevronRight size={18} />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>
);

const NewIncidentModal = ({ isOpen, onClose, clients, onSuccess }: any) => {
  const [loading, setLoading] = useState(false);
  const [rawInput, setRawInput] = useState('');
  const [formData, setFormData] = useState({
    client_id: '',
    type: '',
    severity: 'Medium',
    location: '',
    description: ''
  });

  const handleTriage = async () => {
    if (!rawInput) return;
    setLoading(true);
    try {
      const result = await triageIncident(rawInput);
      setFormData({
        ...formData,
        type: result.type || '',
        severity: result.severity || 'Medium',
        location: result.location || '',
        description: result.description || rawInput
      });
    } catch (error) {
      console.error("Triage failed", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch('/api/incidents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formData, tenant_id: 1 })
      });
      if (res.ok) {
        onSuccess('Incident logged successfully', 'success');
        onClose();
      }
    } catch (error) {
      console.error("Submit failed", error);
      onSuccess('Failed to log incident', 'error');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-zinc-900/40 backdrop-blur-sm"
      />
      <motion.div 
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="relative bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden"
      >
        <div className="p-6 border-b border-zinc-100 flex items-center justify-between">
          <h3 className="font-bold text-xl">Log New Incident</h3>
          <button onClick={onClose} className="p-2 hover:bg-zinc-100 rounded-full"><X size={20} /></button>
        </div>

        <div className="p-8 space-y-8">
          <div className="space-y-3">
            <label className="text-xs font-bold uppercase tracking-wider text-zinc-500">Emma-Ai™ Smart Intake</label>
            <div className="relative">
              <textarea 
                value={rawInput}
                onChange={(e) => setRawInput(e.target.value)}
                placeholder="Describe the incident in plain language (e.g., 'Panic alarm triggered at Sunset Estate Main Gate, guard reports suspicious vehicle...')"
                className="w-full h-24 p-4 bg-zinc-50 border border-zinc-200 rounded-2xl text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all"
              />
              <button 
                onClick={handleTriage}
                disabled={loading || !rawInput}
                className="absolute bottom-3 right-3 flex items-center gap-2 bg-emerald-500 text-white px-3 py-1.5 rounded-xl text-xs font-bold hover:bg-emerald-600 disabled:opacity-50"
              >
                <Zap size={14} />
                {loading ? 'Analyzing...' : 'Auto-Triage'}
              </button>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-xs font-bold text-zinc-500">Client / Site</label>
              <select 
                required
                value={formData.client_id}
                onChange={(e) => setFormData({...formData, client_id: e.target.value})}
                className="w-full p-3 bg-zinc-50 border border-zinc-200 rounded-xl text-sm outline-none"
              >
                <option value="">Select Site</option>
                {clients.map((c: Client) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-zinc-500">Incident Type</label>
              <input 
                required
                value={formData.type}
                onChange={(e) => setFormData({...formData, type: e.target.value})}
                className="w-full p-3 bg-zinc-50 border border-zinc-200 rounded-xl text-sm outline-none"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-zinc-500">Severity</label>
              <select 
                value={formData.severity}
                onChange={(e) => setFormData({...formData, severity: e.target.value})}
                className="w-full p-3 bg-zinc-50 border border-zinc-200 rounded-xl text-sm outline-none"
              >
                <option value="Low">Low</option>
                <option value="Medium">Medium</option>
                <option value="High">High</option>
                <option value="Critical">Critical</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-zinc-500">Specific Location</label>
              <input 
                value={formData.location}
                onChange={(e) => setFormData({...formData, location: e.target.value})}
                className="w-full p-3 bg-zinc-50 border border-zinc-200 rounded-xl text-sm outline-none"
              />
            </div>
            <div className="col-span-2 space-y-2">
              <label className="text-xs font-bold text-zinc-500">Description</label>
              <textarea 
                required
                value={formData.description}
                onChange={(e) => setFormData({...formData, description: e.target.value})}
                className="w-full h-24 p-3 bg-zinc-50 border border-zinc-200 rounded-xl text-sm outline-none"
              />
            </div>
            <div className="col-span-2 pt-4">
              <button 
                type="submit"
                disabled={loading}
                className="w-full bg-zinc-900 text-white py-4 rounded-2xl font-bold hover:bg-zinc-800 transition-colors"
              >
                {loading ? 'Processing...' : 'Confirm & Log Incident'}
              </button>
            </div>
          </form>
        </div>
      </motion.div>
    </div>
  );
};

// --- Views ---

const GuardsView = ({ guards }: { guards: Guard[] }) => (
  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
    {guards.map((guard) => (
      <div key={guard.id} className="glass-panel p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="w-12 h-12 bg-zinc-100 rounded-2xl flex items-center justify-center text-zinc-400">
            <Users size={24} />
          </div>
          <span className={`text-[10px] font-bold px-2 py-1 rounded-md ${
            guard.status === 'Available' ? 'bg-emerald-50 text-emerald-600' : 
            guard.status === 'Busy' ? 'bg-amber-50 text-amber-600' : 'bg-zinc-100 text-zinc-500'
          }`}>
            {guard.status.toUpperCase()}
          </span>
        </div>
        <div>
          <h4 className="font-bold text-zinc-900">{guard.name}</h4>
          <p className="text-xs text-zinc-500">{guard.phone}</p>
        </div>
        <div className="pt-4 border-t border-zinc-100 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-zinc-400">
            <MapPin size={14} />
            <span>Last seen: 5m ago</span>
          </div>
          <button className="text-xs font-bold text-zinc-900 hover:underline">View History</button>
        </div>
      </div>
    ))}
  </div>
);

const DispatchView = ({ incidents, guards, onDispatch }: { incidents: Incident[], guards: Guard[], onDispatch: (iId: number, gId: number) => void }) => {
  const openIncidents = incidents.filter(i => i.status === 'Open');
  const availableGuards = guards.filter(g => g.status === 'Available');

  return (
    <div className="space-y-8">
      <div className="glass-panel h-96 relative overflow-hidden bg-zinc-100 border-zinc-200">
        <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(#000 1px, transparent 1px)', backgroundSize: '20px 20px' }} />
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="relative w-full h-full">
            {/* Simulated Map Markers */}
            {incidents.filter(i => i.status !== 'Resolved').map((incident, idx) => (
              <motion.div 
                key={incident.id}
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="absolute cursor-pointer group"
                style={{ top: `${20 + (idx * 15) % 60}%`, left: `${15 + (idx * 25) % 70}%` }}
              >
                <div className={`w-4 h-4 rounded-full ${incident.severity === 'High' ? 'bg-red-500 animate-pulse' : 'bg-amber-500'} border-2 border-white shadow-lg`} />
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block bg-zinc-900 text-white text-[10px] px-2 py-1 rounded whitespace-nowrap z-20">
                  {incident.type}
                </div>
              </motion.div>
            ))}
            {guards.map((guard, idx) => (
              <motion.div 
                key={guard.id}
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="absolute cursor-pointer group"
                style={{ top: `${30 + (idx * 20) % 50}%`, left: `${20 + (idx * 30) % 60}%` }}
              >
                <div className={`w-3 h-3 rounded-full ${guard.status === 'Available' ? 'bg-emerald-500' : 'bg-zinc-400'} border-2 border-white shadow-lg`} />
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block bg-zinc-900 text-white text-[10px] px-2 py-1 rounded whitespace-nowrap z-20">
                  {guard.name}
                </div>
              </motion.div>
            ))}
          </div>
        </div>
        <div className="absolute bottom-4 left-4 flex gap-4">
          <div className="flex items-center gap-2 bg-white/90 backdrop-blur px-3 py-1.5 rounded-full border border-zinc-200 shadow-sm">
            <div className="w-2 h-2 rounded-full bg-red-500" />
            <span className="text-[10px] font-bold">Incidents</span>
          </div>
          <div className="flex items-center gap-2 bg-white/90 backdrop-blur px-3 py-1.5 rounded-full border border-zinc-200 shadow-sm">
            <div className="w-2 h-2 rounded-full bg-emerald-500" />
            <span className="text-[10px] font-bold">Units</span>
          </div>
        </div>
        <div className="absolute top-4 right-4 bg-white/90 backdrop-blur p-2 rounded-xl border border-zinc-200 shadow-sm flex flex-col gap-2">
          <button className="p-1.5 hover:bg-zinc-100 rounded-lg"><Plus size={16} /></button>
          <div className="h-px bg-zinc-200" />
          <button className="p-1.5 hover:bg-zinc-100 rounded-lg"><Menu size={16} /></button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 h-[calc(100vh-550px)]">
        <div className="glass-panel flex flex-col overflow-hidden">
          <div className="p-6 border-b border-zinc-100">
            <h3 className="font-bold text-lg">Pending Incidents</h3>
            <p className="text-xs text-zinc-500">{openIncidents.length} requiring attention</p>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {openIncidents.map(incident => (
              <div key={incident.id} className="p-4 border border-zinc-200 rounded-2xl hover:border-zinc-300 transition-colors bg-white shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <span className={`text-[10px] font-bold px-2 py-1 rounded-md ${
                    incident.severity === 'High' ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-600'
                  }`}>
                    {incident.severity.toUpperCase()}
                  </span>
                  <span className="text-[10px] font-mono text-zinc-400">#{incident.id}</span>
                </div>
                <h4 className="font-bold text-sm mb-1">{incident.type}</h4>
                <p className="text-xs text-zinc-500 mb-4">{incident.location}</p>
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-1 bg-zinc-100 rounded-full overflow-hidden">
                    <div className="h-full bg-red-500 w-3/4" />
                  </div>
                  <span className="text-[10px] font-bold text-red-500">SLA CRITICAL</span>
                </div>
              </div>
            ))}
            {openIncidents.length === 0 && (
              <div className="h-full flex flex-col items-center justify-center text-zinc-300 space-y-2">
                <CheckCircle2 size={48} />
                <p className="text-sm font-medium">All clear</p>
              </div>
            )}
          </div>
        </div>

        <div className="glass-panel flex flex-col overflow-hidden">
          <div className="p-6 border-b border-zinc-100">
            <h3 className="font-bold text-lg">Available Units</h3>
            <p className="text-xs text-zinc-500">{availableGuards.length} ready for dispatch</p>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {availableGuards.map(guard => (
              <div key={guard.id} className="p-4 border border-zinc-200 rounded-2xl hover:border-emerald-200 transition-colors bg-white shadow-sm flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center text-emerald-600">
                    <Users size={20} />
                  </div>
                  <div>
                    <h4 className="font-bold text-sm">{guard.name}</h4>
                    <p className="text-[10px] text-zinc-500">Response Unit • Near Site A</p>
                  </div>
                </div>
                <button 
                  onClick={() => {
                    const firstOpen = openIncidents[0];
                    if (firstOpen) onDispatch(firstOpen.id, guard.id);
                  }}
                  className="bg-zinc-900 text-white px-4 py-2 rounded-xl text-xs font-bold hover:bg-zinc-800"
                >
                  Assign
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="glass-panel p-6">
        <div className="flex items-center gap-2 mb-6">
          <History size={18} className="text-zinc-400" />
          <h3 className="font-bold text-lg">Recent Dispatch Activity</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest border-b border-zinc-100">
                <th className="pb-3">Time</th>
                <th className="pb-3">Incident</th>
                <th className="pb-3">Unit Assigned</th>
                <th className="pb-3">Status</th>
                <th className="pb-3">SLA</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-50">
              {incidents.filter(i => i.status === 'Dispatched').slice(0, 5).map((incident) => (
                <tr key={incident.id} className="text-xs">
                  <td className="py-4 font-mono text-zinc-400">{new Date(incident.created_at).toLocaleTimeString()}</td>
                  <td className="py-4 font-bold">{incident.type}</td>
                  <td className="py-4">Unit 0{incident.id % 5 + 1}</td>
                  <td className="py-4">
                    <span className="px-2 py-1 bg-blue-50 text-blue-600 rounded-md font-bold">EN ROUTE</span>
                  </td>
                  <td className="py-4 text-emerald-600 font-bold">4.2m</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

const ReportsView = ({ incidents, onExport }: { incidents: Incident[], onExport: (data: any[], format: 'csv' | 'json') => void }) => {
  const [generating, setGenerating] = useState(false);
  const [report, setReport] = useState<string | null>(null);

  const handleGenerate = async (incident: Incident) => {
    setGenerating(true);
    try {
      const text = await generateIncidentReport(incident);
      setReport(text || 'Failed to generate report');
    } catch (error) {
      console.error(error);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileSearch size={20} className="text-zinc-400" />
          <h3 className="font-bold text-lg">Evidence & Reporting</h3>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={() => onExport(incidents, 'json')}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-zinc-200 rounded-xl text-xs font-bold hover:bg-zinc-50 transition-colors"
          >
            <Download size={14} />
            Export JSON
          </button>
          <button 
            onClick={() => onExport(incidents, 'csv')}
            className="flex items-center gap-2 px-4 py-2 bg-zinc-900 text-white rounded-xl text-xs font-bold hover:bg-zinc-800 transition-colors"
          >
            <Download size={14} />
            Export CSV
          </button>
        </div>
      </div>

      <div className="glass-panel p-8 flex items-center justify-between bg-zinc-900 text-white border-none">
        <div>
          <h3 className="text-2xl font-bold mb-2">Evidence Pack Generator</h3>
          <p className="text-zinc-400 text-sm max-w-md">Create POPIA-compliant, audit-ready evidence bundles for any incident with one click.</p>
        </div>
        <div className="w-24 h-24 bg-white/10 rounded-3xl flex items-center justify-center">
          <FileSearch size={40} className="text-white/20" />
        </div>
      </div>

      {report ? (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-panel p-8 relative"
        >
          <button onClick={() => setReport(null)} className="absolute top-6 right-6 p-2 hover:bg-zinc-100 rounded-full"><X size={20} /></button>
          <div className="prose prose-sm max-w-none">
            <h3 className="text-xl font-bold mb-6">Generated Evidence Pack</h3>
            <div className="whitespace-pre-wrap font-sans text-zinc-700 leading-relaxed">
              {report}
            </div>
          </div>
          <div className="mt-8 pt-8 border-t border-zinc-100 flex justify-end gap-4">
            <button className="px-6 py-2 border border-zinc-200 rounded-xl text-sm font-bold hover:bg-zinc-50">Download PDF</button>
            <button className="px-6 py-2 bg-zinc-900 text-white rounded-xl text-sm font-bold hover:bg-zinc-800">Share with Client</button>
          </div>
        </motion.div>
      ) : (
        <div className="glass-panel overflow-hidden">
          <div className="p-6 border-b border-zinc-100">
            <h3 className="font-bold text-lg">Recent Incidents Ready for Reporting</h3>
          </div>
          <div className="divide-y divide-zinc-100">
            {incidents.filter(i => i.status === 'Resolved' || i.status === 'Closed').map(incident => (
              <div key={incident.id} className="p-6 flex items-center justify-between hover:bg-zinc-50 transition-colors">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-zinc-100 rounded-xl flex items-center justify-center text-zinc-400">
                    <FileText size={20} />
                  </div>
                  <div>
                    <h4 className="font-bold text-sm">{incident.type}</h4>
                    <p className="text-xs text-zinc-500">{incident.client_name} • {new Date(incident.created_at).toLocaleDateString()}</p>
                  </div>
                </div>
                <button 
                  onClick={() => handleGenerate(incident)}
                  disabled={generating}
                  className="text-sm font-bold text-emerald-600 hover:underline disabled:opacity-50"
                >
                  {generating ? 'Generating...' : 'Generate Pack'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

const IncidentDetailModal = ({ incident, isOpen, onClose, guards, onDispatch }: any) => {
  if (!isOpen || !incident) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-zinc-900/40 backdrop-blur-sm"
      />
      <motion.div 
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="relative bg-white rounded-3xl shadow-2xl w-full max-w-4xl overflow-hidden flex h-[80vh]"
      >
        <div className="flex-1 overflow-y-auto p-8 border-r border-zinc-100">
          <div className="flex items-center justify-between mb-8">
            <span className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest">Incident Record #{incident.id}</span>
            <button onClick={onClose} className="p-2 hover:bg-zinc-100 rounded-full"><X size={20} /></button>
          </div>

          <div className="space-y-8">
            <div>
              <h2 className="text-3xl font-bold text-zinc-900 mb-2">{incident.type}</h2>
              <div className="flex items-center gap-4 text-sm text-zinc-500">
                <div className="flex items-center gap-1.5">
                  <MapPin size={16} />
                  <span>{incident.location}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Clock size={16} />
                  <span>{new Date(incident.created_at).toLocaleString()}</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="p-4 bg-zinc-50 rounded-2xl">
                <p className="text-[10px] font-bold text-zinc-400 uppercase mb-1">Severity</p>
                <p className={`font-bold ${incident.severity === 'High' ? 'text-red-600' : 'text-amber-600'}`}>{incident.severity}</p>
              </div>
              <div className="p-4 bg-zinc-50 rounded-2xl">
                <p className="text-[10px] font-bold text-zinc-400 uppercase mb-1">Status</p>
                <p className="font-bold text-zinc-900">{incident.status}</p>
              </div>
              <div className="p-4 bg-zinc-50 rounded-2xl">
                <p className="text-[10px] font-bold text-zinc-400 uppercase mb-1">Client</p>
                <p className="font-bold text-zinc-900">{incident.client_name}</p>
              </div>
            </div>

            <div className="space-y-3">
              <h4 className="font-bold text-sm">Description</h4>
              <p className="text-sm text-zinc-600 leading-relaxed bg-zinc-50 p-6 rounded-2xl border border-zinc-100">
                {incident.description}
              </p>
            </div>

            <div className="space-y-3">
              <h4 className="font-bold text-sm">Timeline</h4>
              <div className="space-y-4 relative before:absolute before:left-[7px] before:top-2 before:bottom-2 before:w-0.5 before:bg-zinc-100">
                <div className="flex gap-4 relative">
                  <div className="w-4 h-4 rounded-full bg-zinc-900 border-4 border-white shrink-0 z-10" />
                  <div>
                    <p className="text-xs font-bold">Incident Reported</p>
                    <p className="text-[10px] text-zinc-400">{new Date(incident.created_at).toLocaleTimeString()}</p>
                  </div>
                </div>
                {incident.status !== 'Open' && (
                  <div className="flex gap-4 relative">
                    <div className="w-4 h-4 rounded-full bg-blue-500 border-4 border-white shrink-0 z-10" />
                    <div>
                      <p className="text-xs font-bold">Guard Dispatched</p>
                      <p className="text-[10px] text-zinc-400">Processing...</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="w-80 bg-zinc-50 p-8 flex flex-col">
          <div className="mb-8">
            <div className="flex items-center gap-2 text-blue-600 mb-4">
              <Zap size={18} />
              <h4 className="font-bold text-sm uppercase tracking-wider">Emma-Ai™ Copilot</h4>
            </div>
            <div className="bg-white p-4 rounded-2xl border border-blue-100 shadow-sm space-y-3">
              <p className="text-xs text-zinc-600 leading-tight italic">"Based on site history and severity, I recommend immediate dispatch of the nearest armed response unit and notifying the site manager."</p>
              <button className="w-full py-2 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700">Apply Recommendation</button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto space-y-4">
            <h4 className="font-bold text-xs uppercase tracking-wider text-zinc-400">Available Units</h4>
            {guards.filter((g: Guard) => g.status === 'Available').map((guard: Guard) => (
              <div key={guard.id} className="bg-white p-4 rounded-2xl border border-zinc-200 flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold">{guard.name}</p>
                  <p className="text-[10px] text-zinc-500">2.4km away</p>
                </div>
                <button 
                  onClick={() => onDispatch(incident.id, guard.id)}
                  className="p-2 bg-zinc-900 text-white rounded-lg hover:bg-zinc-800"
                >
                  <Zap size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>
      </motion.div>
    </div>
  );
};

const SettingsView = ({ stats }: { stats: Stats | null }) => (
  <div className="max-w-4xl space-y-8 pb-12">
    <div className="glass-panel p-8">
      <div className="flex items-center gap-3 mb-8">
        <div className="p-2 bg-zinc-100 rounded-xl">
          <Users size={20} className="text-zinc-900" />
        </div>
        <div>
          <h3 className="text-xl font-bold tracking-tight">Company Profile</h3>
          <p className="text-xs text-zinc-500">Manage your organization's operational identity</p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-8">
        <div className="space-y-6">
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Company Name</label>
            <input type="text" defaultValue="🌐SA-iLabs™ Security" className="w-full p-4 bg-zinc-50 border border-zinc-200 rounded-2xl text-sm outline-none focus:ring-2 focus:ring-zinc-900/5 transition-all" />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Operational License #</label>
            <input type="text" defaultValue="PSIRA-99283-X" className="w-full p-4 bg-zinc-50 border border-zinc-200 rounded-2xl text-sm outline-none focus:ring-2 focus:ring-zinc-900/5 transition-all" />
          </div>
        </div>
        <div className="flex flex-col items-center justify-center border-2 border-dashed border-zinc-200 rounded-3xl p-8 bg-zinc-50/50 group hover:border-zinc-300 transition-all cursor-pointer">
          <div className="w-20 h-20 bg-zinc-900 rounded-2xl flex items-center justify-center text-white mb-4 shadow-xl group-hover:scale-105 transition-transform">
            <ShieldAlert size={40} />
          </div>
          <p className="text-xs font-bold text-zinc-900">Upload Logo</p>
          <p className="text-[10px] text-zinc-400 mt-1">PNG, JPG up to 5MB</p>
        </div>
      </div>
    </div>

    <div className="glass-panel p-8">
      <div className="flex items-center gap-3 mb-8">
        <div className="p-2 bg-blue-50 rounded-xl">
          <Zap size={20} className="text-blue-600" />
        </div>
        <div>
          <h3 className="text-xl font-bold tracking-tight">Emma-Ai™ Configuration</h3>
          <p className="text-xs text-zinc-500">Fine-tune your AI operational assistant</p>
        </div>
      </div>
      <div className="space-y-8">
        <div className="flex items-center justify-between p-4 bg-zinc-50 rounded-2xl border border-zinc-100">
          <div>
            <p className="font-bold text-sm">Auto-Triage Sensitivity</p>
            <p className="text-xs text-zinc-500">Adjust how aggressively the AI flags critical incidents.</p>
          </div>
          <div className="flex bg-zinc-200 p-1 rounded-xl">
            <button className="px-4 py-2 text-xs font-bold rounded-lg hover:bg-white/50 transition-colors">Relaxed</button>
            <button className="px-4 py-2 text-xs font-bold rounded-lg bg-white shadow-sm">Standard</button>
            <button className="px-4 py-2 text-xs font-bold rounded-lg hover:bg-white/50 transition-colors">Aggressive</button>
          </div>
        </div>

        <div className="flex items-center justify-between p-4 bg-zinc-50 rounded-2xl border border-zinc-100">
          <div>
            <p className="font-bold text-sm">Evidence Pack Detail</p>
            <p className="text-xs text-zinc-500">Complexity level of AI-generated incident reports.</p>
          </div>
          <div className="flex bg-zinc-200 p-1 rounded-xl">
            <button className="px-4 py-2 text-xs font-bold rounded-lg bg-white shadow-sm">Executive</button>
            <button className="px-4 py-2 text-xs font-bold rounded-lg hover:bg-white/50 transition-colors">Detailed</button>
            <button className="px-4 py-2 text-xs font-bold rounded-lg hover:bg-white/50 transition-colors">Technical</button>
          </div>
        </div>
      </div>
    </div>

    <div className="glass-panel p-8 border-red-100 bg-red-50/10">
      <div className="flex items-center gap-3 mb-8">
        <div className="p-2 bg-red-50 rounded-xl">
          <AlertTriangle size={20} className="text-red-600" />
        </div>
        <div>
          <h3 className="text-xl font-bold tracking-tight text-red-900">Danger Zone</h3>
          <p className="text-xs text-red-600/60">Destructive actions for your organization</p>
        </div>
      </div>
      <div className="flex items-center justify-between p-6 border border-red-200 rounded-3xl bg-white">
        <div>
          <p className="font-bold text-sm text-zinc-900">Purge Audit Logs</p>
          <p className="text-xs text-zinc-500">Permanently delete all system history older than 1 year.</p>
        </div>
        <button className="px-6 py-3 bg-red-600 text-white rounded-2xl text-xs font-bold hover:bg-red-700 transition-colors shadow-lg shadow-red-600/20">Purge Logs</button>
      </div>
    </div>
  </div>
);

const LoginView = ({ onLogin }: { onLogin: (user: any) => void }) => {
  const [email, setEmail] = useState('ops-center@sa-ilabs.com');
  const [password, setPassword] = useState('password123');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();
      if (data.success) {
        onLogin(data.user);
      } else {
        setError(data.message || 'Login failed');
      }
    } catch (err) {
      setError('Connection error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-900 flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md space-y-8"
      >
        <div className="text-center space-y-4">
          <div className="w-20 h-20 bg-white rounded-3xl flex items-center justify-center mx-auto shadow-2xl">
            <ShieldAlert size={40} className="text-zinc-900" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-white tracking-tight">SA-iLabs™</h1>
            <p className="text-zinc-400 text-sm font-medium uppercase tracking-widest">Emma-Ai™ Security Ops</p>
          </div>
        </div>

        <div className="glass-panel p-8 bg-white/5 border-white/10 backdrop-blur-xl">
          <form className="space-y-6" onSubmit={handleSubmit}>
            {error && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-xs font-bold text-center">
                {error}
              </div>
            )}
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Control Room ID</label>
              <input 
                type="email" 
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="ops-center@sa-ilabs.com"
                className="w-full p-4 bg-white/5 border border-white/10 rounded-2xl text-white text-sm outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Access Token</label>
              <input 
                type="password" 
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full p-4 bg-white/5 border border-white/10 rounded-2xl text-white text-sm outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all"
              />
            </div>
            <button 
              type="submit"
              disabled={loading}
              className="w-full bg-emerald-500 text-zinc-900 py-4 rounded-2xl font-bold hover:bg-emerald-400 transition-all shadow-lg shadow-emerald-500/20 disabled:opacity-50"
            >
              {loading ? 'Authenticating...' : 'Enter Command Center'}
            </button>
          </form>
        </div>

        <p className="text-center text-zinc-500 text-xs">
          Authorized Personnel Only • POPIA & GDPR Compliant Environment
        </p>
      </motion.div>
    </div>
  );
};

// --- Main App ---

export default function App() {
  const [activeView, setActiveView] = useState('dashboard');
  const [stats, setStats] = useState<Stats | null>(null);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [guards, setGuards] = useState<Guard[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null);
  const [handoverSummary, setHandoverSummary] = useState<string | null>(null);
  const [loadingHandover, setLoadingHandover] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [toast, setToast] = useState<{ message: string, type: 'success' | 'error' | 'info' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToast({ message, type });
    if (type !== 'info') {
      setTimeout(() => setToast(null), 5000);
    }
  };

  const fetchData = async () => {
    try {
      const [sRes, iRes, gRes, cRes, aRes] = await Promise.all([
        fetch('/api/stats'),
        fetch('/api/incidents'),
        fetch('/api/guards'),
        fetch('/api/clients'),
        fetch('/api/audit-logs')
      ]);
      setStats(await sRes.json());
      setIncidents(await iRes.json());
      setGuards(await gRes.json());
      setClients(await cRes.json());
      setAuditLogs(await aRes.json());
      setIsOnline(true);
    } catch (error) {
      console.error("Fetch failed", error);
      setIsOnline(false);
    }
  };

  const handleLogin = (userData: any) => {
    setUser(userData);
    setIsLoggedIn(true);
    showToast(`Welcome back, ${userData.name}`, 'success');
  };

  const handleGenerateHandover = async () => {
    setLoadingHandover(true);
    showToast('Emma-Ai™ analyzing shift data...', 'info');
    try {
      const summary = await generateHandoverSummary(incidents);
      setHandoverSummary(summary || 'Failed to generate summary');
      showToast('Handover summary generated successfully', 'success');
    } catch (error) {
      console.error(error);
      showToast('Failed to generate summary', 'error');
    } finally {
      setLoadingHandover(false);
      setToast(null);
    }
  };

  const handleDispatch = async (incidentId: number, guardId: number) => {
    showToast('Dispatching unit...', 'info');
    try {
      const res = await fetch('/api/dispatch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ incident_id: incidentId, guard_id: guardId, tenant_id: 1 })
      });
      if (res.ok) {
        fetchData();
        setSelectedIncident(null);
        showToast('Unit dispatched successfully', 'success');
      } else {
        showToast('Dispatch failed', 'error');
      }
    } catch (error) {
      console.error(error);
      showToast('Dispatch error', 'error');
    }
  };

  const handleExport = (data: any[], filename: string) => {
    if (!data || data.length === 0) {
      showToast('No data to export', 'error');
      return;
    }
    const headers = Object.keys(data[0]).join(',');
    const rows = data.map(row => 
      Object.values(row).map(val => `"${val}"`).join(',')
    ).join('\n');
    const csv = `${headers}\n${rows}`;
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.setAttribute('hidden', '');
    a.setAttribute('href', url);
    a.setAttribute('download', `${filename}.csv`);
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    showToast(`Exported ${filename}.csv`, 'success');
  };

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    if (isLoggedIn) {
      fetchData();
      
      // WebSocket setup
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const ws = new WebSocket(`${protocol}//${window.location.host}`);
      
      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.type === 'INCIDENT_CREATED' || data.type === 'GUARD_DISPATCHED') {
          fetchData();
          showToast(`System Update: ${data.type.replace('_', ' ')}`, 'info');
        }
      };

      return () => ws.close();
    }
  }, [isLoggedIn]);

  const renderView = () => {
    switch (activeView) {
      case 'dashboard': return (
        <>
          <DashboardView 
            stats={stats} 
            incidents={incidents} 
            onGenerateHandover={handleGenerateHandover}
          />
          {handoverSummary && (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="glass-panel mt-8 overflow-hidden border-zinc-900/10"
            >
              <div className="bg-zinc-900 p-6 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white/10 rounded-lg">
                    <FileText size={20} className="text-white" />
                  </div>
                  <div>
                    <h3 className="text-white font-bold tracking-tight">Shift Handover Summary</h3>
                    <p className="text-[10px] text-zinc-400 uppercase tracking-widest font-bold">Generated by Emma-Ai™ • {new Date().toLocaleString()}</p>
                  </div>
                </div>
                <button onClick={() => setHandoverSummary(null)} className="p-2 hover:bg-white/10 rounded-full text-white transition-colors"><X size={20} /></button>
              </div>
              <div className="p-8 bg-white">
                <div className="max-w-3xl mx-auto whitespace-pre-wrap font-sans text-zinc-700 leading-relaxed text-sm">
                  {handoverSummary}
                </div>
                <div className="mt-8 pt-8 border-t border-zinc-100 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <button className="px-4 py-2 bg-zinc-900 text-white rounded-xl text-xs font-bold hover:bg-zinc-800 transition-colors">Download PDF</button>
                    <button className="px-4 py-2 bg-zinc-100 text-zinc-600 rounded-xl text-xs font-bold hover:bg-zinc-200 transition-colors">Email to Supervisor</button>
                  </div>
                  <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest">Confidential • SA-iLabs™ Security Ops</p>
                </div>
              </div>
            </motion.div>
          )}
          {loadingHandover && (
            <div className="fixed inset-0 z-[110] flex items-center justify-center bg-white/50 backdrop-blur-sm">
              <div className="flex flex-col items-center gap-4">
                <div className="w-12 h-12 border-4 border-zinc-900 border-t-transparent rounded-full animate-spin" />
                <p className="font-bold text-zinc-900">Emma-Ai™ generating summary...</p>
              </div>
            </div>
          )}
        </>
      );
      case 'incidents': return (
        <OccurrenceBookView 
          incidents={incidents} 
          onNewIncident={() => setIsModalOpen(true)} 
          onSelectIncident={(i) => setSelectedIncident(i)}
        />
      );
      case 'dispatch': return (
        <DispatchView 
          incidents={incidents} 
          guards={guards} 
          onDispatch={handleDispatch} 
        />
      );
      case 'guards': return <GuardsView guards={guards} />;
      case 'reports': return <ReportsView incidents={incidents} onExport={handleExport} />;
      case 'audit': return <AuditLogsView logs={auditLogs} />;
      case 'settings': return <SettingsView stats={stats} />;
      default: return <DashboardView stats={stats} incidents={incidents} onGenerateHandover={handleGenerateHandover} />;
    }
  };

  if (!isLoggedIn) {
    return <LoginView onLogin={handleLogin} />;
  }

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-zinc-50">
      <Sidebar activeView={activeView} setActiveView={setActiveView} onLogout={() => setIsLoggedIn(false)} user={user} />
      
      <main className="pl-64 min-h-screen flex flex-col">
        <Header title={activeView.charAt(0).toUpperCase() + activeView.slice(1)} isOnline={isOnline} user={user} />
        
        <div className="p-8 flex-1">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeView}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              {renderView()}
            </motion.div>
          </AnimatePresence>
        </div>

        <footer className="p-8 text-center border-t border-zinc-200">
          <p className="text-xs text-zinc-400 font-medium">
            © 2026 🌐SA-iLabs™ Pty Ltd • Emma-Ai™ Security Operations Platform • v1.0.4
          </p>
        </footer>
      </main>

      <NewIncidentModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        clients={clients}
        onSuccess={(msg: string, type: any) => {
          fetchData();
          showToast(msg, type);
        }}
      />

      <IncidentDetailModal 
        incident={selectedIncident}
        isOpen={!!selectedIncident}
        onClose={() => setSelectedIncident(null)}
        guards={guards}
        onDispatch={handleDispatch}
      />

      <AnimatePresence>
        {toast && (
          <Toast 
            message={toast.message} 
            type={toast.type} 
            onClose={() => setToast(null)} 
          />
        )}
      </AnimatePresence>
    </div>
    </ErrorBoundary>
  );
}
