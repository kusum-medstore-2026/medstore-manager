import { useState, useEffect, useCallback } from 'react';
import {
  Pill,
  AlertTriangle,
  Clock,
  Plus,
  ShoppingBag,
  RefreshCw,
  Search,
  CheckCircle2,
  Trash2,
  Database,
  Code2,
  Calendar,
  Layers,
  Download,
  LogOut,
  Shield
} from 'lucide-react';
import { Medicine, Sale, BackendStatus, LowStockAlertResponse, ExpiringAlertResponse, User } from './types';
import { AddMedicineModal } from './components/AddMedicineModal';
import { CreateSaleModal } from './components/CreateSaleModal';
import { ApiConsoleModal } from './components/ApiConsoleModal';
import { LoginPage } from './components/LoginPage';

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    try {
      const stored = localStorage.getItem('medstore_user');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [lowStockAlerts, setLowStockAlerts] = useState<Medicine[]>([]);
  const [expiringAlerts, setExpiringAlerts] = useState<Medicine[]>([]);
  const [backendStatus, setBackendStatus] = useState<BackendStatus | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTab, setSelectedTab] = useState<'inventory' | 'alerts' | 'sales'>('inventory');
  const [alertFilter, setAlertFilter] = useState<'all' | 'low-stock' | 'expiring'>('all');

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isSaleModalOpen, setIsSaleModalOpen] = useState(false);
  const [isApiModalOpen, setIsApiModalOpen] = useState(false);
  const [activeMedicineForSale, setActiveMedicineForSale] = useState<string | undefined>(undefined);

  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'info' | 'error' } | null>(null);

  const showNotification = (message: string, type: 'success' | 'info' | 'error' = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3500);
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch {
      // Ignored
    }
    localStorage.removeItem('medstore_user');
    localStorage.removeItem('medstore_token');
    setCurrentUser(null);
    showNotification('Logged out successfully.', 'info');
  };

  // Resilient fetch helper with automatic retry and backoff
  const safeFetchJson = async <T,>(url: string, retries = 2, initialDelay = 500): Promise<T | null> => {
    let delay = initialDelay;
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const res = await fetch(url);
        if (res.ok) {
          return (await res.json()) as T;
        }
      } catch (err) {
        if (attempt === retries) {
          return null;
        }
        await new Promise((resolve) => setTimeout(resolve, delay));
        delay *= 1.5;
      }
    }
    return null;
  };

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);

    try {
      // Execute fetches in parallel with resilient retries
      const [statusData, medsData, lowStockData, expiringData, salesData] = await Promise.allSettled([
        safeFetchJson<BackendStatus>('/api/status'),
        safeFetchJson<{ success: boolean; count: number; medicines: Medicine[] }>('/api/medicines'),
        safeFetchJson<LowStockAlertResponse>('/api/alerts/low-stock'),
        safeFetchJson<ExpiringAlertResponse>('/api/alerts/expiring'),
        safeFetchJson<{ success: boolean; count: number; sales: Sale[] }>('/api/sales'),
      ]);

      if (statusData.status === 'fulfilled' && statusData.value) {
        setBackendStatus(statusData.value);
      }

      let loadedMedicines: Medicine[] = [];
      if (medsData.status === 'fulfilled' && medsData.value?.medicines) {
        loadedMedicines = medsData.value.medicines;
        setMedicines(loadedMedicines);
      }

      // Populate low stock alerts (from dedicated endpoint or derived immediately from medicines)
      if (lowStockData.status === 'fulfilled' && lowStockData.value?.medicines) {
        setLowStockAlerts(lowStockData.value.medicines);
      } else if (loadedMedicines.length > 0) {
        const derivedLowStock = loadedMedicines
          .filter((m) => m.stock < 10)
          .sort((a, b) => a.stock - b.stock);
        setLowStockAlerts(derivedLowStock);
      }

      // Populate expiring alerts (from dedicated endpoint or derived immediately from medicines)
      if (expiringData.status === 'fulfilled' && expiringData.value?.medicines) {
        setExpiringAlerts(expiringData.value.medicines);
      } else if (loadedMedicines.length > 0) {
        const derivedExpiring = loadedMedicines.filter(
          (m) => m.daysToExpiry !== null && m.daysToExpiry <= 30
        );
        setExpiringAlerts(derivedExpiring);
      }

      if (salesData.status === 'fulfilled' && salesData.value?.sales) {
        setSales(salesData.value.sales);
      }

      // Set loadError only if neither medicines nor status responded
      if (
        (!medsData || medsData.status !== 'fulfilled' || !medsData.value) &&
        (!statusData || statusData.status !== 'fulfilled' || !statusData.value)
      ) {
        setLoadError('Temporary network interruption connecting to server. Retrying...');
      }
    } catch {
      // Handled gracefully without unhandled rejection
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleMedicineAdded = (newMed: Medicine) => {
    showNotification(`Medicine "${newMed.name}" added to Firestore!`, 'success');
    loadData();
  };

  const handleSaleCompleted = (sale: Sale, updatedMedicine: { id: string; newStock: number }) => {
    showNotification(`Sale recorded for "${sale.medicineName}" (${sale.quantity} units). Stock updated!`, 'success');
    // Update local state immediately for snappy response
    setMedicines((prev) =>
      prev.map((m) => (m.id === updatedMedicine.id ? { ...m, stock: updatedMedicine.newStock } : m))
    );
    loadData();
  };

  const handleDeleteMedicine = async (id: string, name: string) => {
    if (currentUser?.role === 'cashier') {
      alert('Access Restricted: Cashiers have POS Billing privileges. Only Pharmacists or Store Admins can delete medicines from inventory.');
      return;
    }

    if (!window.confirm(`Are you sure you want to delete "${name}" from Firestore?`)) return;

    try {
      const res = await fetch(`/api/medicines/${id}`, { method: 'DELETE' });
      if (res.ok) {
        showNotification(`"${name}" removed from inventory.`, 'info');
        loadData();
      } else {
        const err = await res.json();
        alert(err.error || 'Failed to delete medicine');
      }
    } catch (err: any) {
      alert(`Delete error: ${err.message}`);
    }
  };

  const filteredMedicines = medicines.filter((m) => {
    const query = searchQuery.toLowerCase();
    return (
      m.name.toLowerCase().includes(query) ||
      m.batch.toLowerCase().includes(query) ||
      m.supplier.toLowerCase().includes(query)
    );
  });

  const totalStockUnits = medicines.reduce((acc, m) => acc + m.stock, 0);
  const totalSalesRevenue = sales.reduce((acc, s) => acc + s.totalPrice, 0);

  // If user is not logged in, render the LoginPage
  if (!currentUser) {
    return (
      <LoginPage
        onLoginSuccess={(user) => {
          setCurrentUser(user);
          showNotification(`Welcome back, ${user.name}! (${user.role.toUpperCase()})`, 'success');
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col font-sans selection:bg-emerald-500 selection:text-white">
      {/* Toast Notification */}
      {notification && (
        <div
          id="toast-notification"
          className={`fixed bottom-5 right-5 z-50 flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-xl border text-xs font-medium animate-in fade-in slide-in-from-bottom-3 duration-200 ${
            notification.type === 'success'
              ? 'bg-emerald-900 text-white border-emerald-700'
              : notification.type === 'error'
              ? 'bg-rose-900 text-white border-rose-700'
              : 'bg-slate-900 text-white border-slate-700'
          }`}
        >
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{notification.message}</span>
        </div>
      )}

      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-slate-200 px-4 sm:px-8 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-xs">
            <Pill className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold text-slate-900 tracking-tight">MedStore Manager</h1>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
                <Database className="w-3 h-3" />
                <span>Firestore (default)</span>
              </span>
            </div>
            <p className="text-xs text-slate-500">
              {currentUser.storeName || 'MedStore Healthcare Pharmacy'} • Express.js Server
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-2.5">
          <a
            id="btn-export-zip"
            href="/api/download-zip"
            download="medstore-manager.zip"
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200/90 rounded-xl transition-colors shadow-xs"
            title="Export and Download Complete Project as ZIP for VS Code"
          >
            <Download className="w-4 h-4 text-emerald-700" />
            <span className="hidden sm:inline">Export ZIP</span>
            <span className="sm:hidden">ZIP</span>
          </a>

          <button
            id="btn-open-api-console"
            onClick={() => setIsApiModalOpen(true)}
            className="hidden sm:inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200/80 rounded-xl transition-colors"
            title="Inspect Express Endpoints & Run cURL"
          >
            <Code2 className="w-4 h-4 text-slate-600" />
            <span>API Docs</span>
          </button>

          <button
            id="btn-refresh-data"
            onClick={loadData}
            disabled={isLoading}
            className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors disabled:opacity-50"
            title="Refresh database records"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>

          {currentUser.role !== 'cashier' && (
            <button
              id="btn-open-add-modal"
              onClick={() => setIsAddModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-xs transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden md:inline">Add Medicine</span>
              <span className="md:hidden">Add</span>
            </button>
          )}

          <button
            id="btn-open-sale-modal"
            onClick={() => {
              setActiveMedicineForSale(undefined);
              setIsSaleModalOpen(true);
            }}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-xl shadow-xs transition-colors"
          >
            <ShoppingBag className="w-4 h-4" />
            <span className="hidden md:inline">Record Sale</span>
            <span className="md:hidden">Sale</span>
          </button>

          {/* User Profile & Logout section */}
          <div className="flex items-center gap-2 pl-2 sm:pl-3 border-l border-slate-200">
            <div className="flex items-center gap-2">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shadow-xs shrink-0 ${
                  currentUser.role === 'admin'
                    ? 'bg-amber-100 text-amber-800 border border-amber-300'
                    : currentUser.role === 'cashier'
                    ? 'bg-blue-100 text-blue-800 border border-blue-300'
                    : 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                }`}
                title={`${currentUser.name} (${currentUser.role})`}
              >
                {currentUser.name.charAt(0).toUpperCase()}
              </div>
              <div className="hidden lg:block text-left leading-tight">
                <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <span className="truncate max-w-[110px]">{currentUser.name}</span>
                  <span
                    className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wider ${
                      currentUser.role === 'admin'
                        ? 'bg-amber-100 text-amber-800'
                        : currentUser.role === 'cashier'
                        ? 'bg-blue-100 text-blue-800'
                        : 'bg-emerald-100 text-emerald-800'
                    }`}
                  >
                    {currentUser.role}
                  </span>
                </div>
                <div className="text-[10px] text-slate-400 truncate max-w-[120px]">
                  {currentUser.email}
                </div>
              </div>
            </div>

            <button
              id="btn-logout"
              onClick={handleLogout}
              className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer"
              title="Logout (लॉगआउट)"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-8 space-y-6">
        {loadError && (
          <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-between text-xs text-amber-900">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>{loadError}</span>
            </div>
            <button
              onClick={() => loadData()}
              className="px-2.5 py-1 font-semibold bg-white border border-amber-300 rounded-lg hover:bg-amber-100/60 transition-colors shadow-2xs"
            >
              Retry Now
            </button>
          </div>
        )}

        {/* Status notice banner */}
        <div className="p-3 bg-slate-100 border border-slate-200 rounded-xl flex flex-wrap items-center justify-between gap-3 text-xs text-slate-600">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>
              Backend Server Active on <strong>port 3000</strong> using{' '}
              <code className="bg-slate-200 px-1 py-0.5 rounded font-mono text-[11px] text-slate-800">
                FIREBASE_SERVICEACCOUNT
              </code>
            </span>
            <span className="text-slate-400">|</span>
            <span>
              Mode:{' '}
              <strong className={backendStatus?.isLiveFirestore ? 'text-emerald-700' : 'text-slate-700'}>
                {backendStatus?.isLiveFirestore ? 'Live Firebase Admin' : 'Local Fallback (Ready for Service Account)'}
              </strong>
            </span>
          </div>
          <div className="flex items-center gap-2 font-mono text-[11px]">
            <span className="bg-white px-2 py-0.5 rounded border border-slate-200">
              Collection: <strong>medicines</strong> ({medicines.length})
            </span>
            <span className="bg-white px-2 py-0.5 rounded border border-slate-200">
              Collection: <strong>sales</strong> ({sales.length})
            </span>
          </div>
        </div>

        {/* Overview Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div
            id="card-metric-medicines"
            className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between"
          >
            <div>
              <p className="text-xs font-medium text-slate-500">Medicines in Stock</p>
              <h3 className="text-2xl font-bold text-slate-900 mt-1">{medicines.length}</h3>
              <p className="text-xs text-slate-400 mt-1">{totalStockUnits} total inventory units</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Layers className="w-6 h-6" />
            </div>
          </div>

          <div
            id="card-metric-low-stock"
            onClick={() => {
              setSelectedTab('alerts');
              setAlertFilter('low-stock');
            }}
            className="bg-white p-5 rounded-2xl border border-amber-200/80 hover:border-amber-400 shadow-xs flex items-center justify-between cursor-pointer transition-all hover:bg-amber-50/20"
          >
            <div>
              <div className="flex items-center gap-1.5">
                <p className="text-xs font-medium text-amber-700">Low Stock Alert</p>
                <span className="px-1.5 py-0.2 bg-amber-100 text-amber-800 text-[10px] font-bold rounded">
                  &lt; 10 units
                </span>
              </div>
              <h3 className="text-2xl font-bold text-amber-600 mt-1">{lowStockAlerts.length}</h3>
              <p className="text-xs text-amber-600/80 mt-1">Click to view items needing restock</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center">
              <AlertTriangle className="w-6 h-6" />
            </div>
          </div>

          <div
            id="card-metric-expiring"
            onClick={() => {
              setSelectedTab('alerts');
              setAlertFilter('expiring');
            }}
            className="bg-white p-5 rounded-2xl border border-rose-200/80 hover:border-rose-400 shadow-xs flex items-center justify-between cursor-pointer transition-all hover:bg-rose-50/20"
          >
            <div>
              <div className="flex items-center gap-1.5">
                <p className="text-xs font-medium text-rose-700">Expiring Alert</p>
                <span className="px-1.5 py-0.2 bg-rose-100 text-rose-800 text-[10px] font-bold rounded">
                  Next 30 Days
                </span>
              </div>
              <h3 className="text-2xl font-bold text-rose-600 mt-1">{expiringAlerts.length}</h3>
              <p className="text-xs text-rose-600/80 mt-1">Critical batches nearing expiry</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center">
              <Clock className="w-6 h-6" />
            </div>
          </div>

          <div
            id="card-metric-sales"
            onClick={() => setSelectedTab('sales')}
            className="bg-white p-5 rounded-2xl border border-slate-200/80 hover:border-slate-400 shadow-xs flex items-center justify-between cursor-pointer transition-all hover:bg-slate-50/50"
          >
            <div>
              <p className="text-xs font-medium text-slate-500">Total Sales Recorded</p>
              <h3 className="text-2xl font-bold text-slate-900 mt-1">₹{totalSalesRevenue.toFixed(2)}</h3>
              <p className="text-xs text-slate-400 mt-1">{sales.length} customer purchases</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-slate-100 text-slate-800 flex items-center justify-center">
              <ShoppingBag className="w-6 h-6" />
            </div>
          </div>
        </div>

        {/* Tab Navigation & Search Filter */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pt-2">
          <div className="flex items-center gap-1.5 p-1 bg-slate-200/70 rounded-xl">
            <button
              id="tab-inventory"
              onClick={() => setSelectedTab('inventory')}
              className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg transition-all ${
                selectedTab === 'inventory' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Medicines Inventory ({medicines.length})</span>
            </button>

            <button
              id="tab-alerts"
              onClick={() => setSelectedTab('alerts')}
              className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg transition-all ${
                selectedTab === 'alerts'
                  ? 'bg-white text-amber-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
              <span>
                Inventory Alerts ({lowStockAlerts.length + expiringAlerts.length})
              </span>
            </button>

            <button
              id="tab-sales"
              onClick={() => setSelectedTab('sales')}
              className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg transition-all ${
                selectedTab === 'sales' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <ShoppingBag className="w-3.5 h-3.5" />
              <span>Sales Log ({sales.length})</span>
            </button>
          </div>

          {/* Search box */}
          {selectedTab === 'inventory' && (
            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                id="input-search-medicines"
                type="text"
                placeholder="Search by medicine, batch, supplier..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3.5 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition-colors"
              />
            </div>
          )}
        </div>

        {/* TAB 1: INVENTORY TABLE */}
        {selectedTab === 'inventory' && (
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-slate-800">Medicines Catalog</h3>
                <p className="text-xs text-slate-500">Connected to Firestore <code className="font-mono text-slate-700 font-medium">medicines</code> collection</p>
              </div>
              <span className="text-xs text-slate-400 font-mono">
                {filteredMedicines.length} of {medicines.length} items
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/70 text-slate-500 font-medium">
                    <th className="py-3 px-6">Medicine & Batch</th>
                    <th className="py-3 px-6">Supplier</th>
                    <th className="py-3 px-6">Expiry Date</th>
                    <th className="py-3 px-6">Stock Units</th>
                    <th className="py-3 px-6">Unit Price</th>
                    <th className="py-3 px-6 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredMedicines.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-slate-400">
                        <Pill className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                        <p className="font-medium">No medicines found</p>
                        <p className="text-[11px] mt-1">Try another search or click &quot;Add Medicine&quot; above.</p>
                      </td>
                    </tr>
                  ) : (
                    filteredMedicines.map((med) => {
                      const isLowStock = med.stock < 10;
                      const isExpiringSoon = med.daysToExpiry !== null && med.daysToExpiry >= 0 && med.daysToExpiry <= 30;
                      const isExpired = med.daysToExpiry !== null && med.daysToExpiry < 0;

                      return (
                        <tr key={med.id} className="hover:bg-slate-50/60 transition-colors">
                          <td className="py-3.5 px-6">
                            <div className="font-semibold text-slate-900">{med.name}</div>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <span className="font-mono text-[11px] bg-slate-100 px-1.5 py-0.5 rounded text-slate-600">
                                {med.batch}
                              </span>
                              {isLowStock && (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                                  Low Stock
                                </span>
                              )}
                              {isExpiringSoon && (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                                  Expiring Soon
                                </span>
                              )}
                              {isExpired && (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-900 text-white">
                                  Expired
                                </span>
                              )}
                            </div>
                          </td>

                          <td className="py-3.5 px-6 text-slate-600">{med.supplier}</td>

                          <td className="py-3.5 px-6">
                            <div className="flex items-center gap-1 text-slate-800">
                              <Calendar className="w-3.5 h-3.5 text-slate-400" />
                              <span>{med.expiryDate ? med.expiryDate.split('T')[0] : 'N/A'}</span>
                            </div>
                            <span className="text-[11px] text-slate-500 block mt-0.5">
                              {med.daysToExpiry !== null
                                ? med.daysToExpiry < 0
                                  ? `Expired ${Math.abs(med.daysToExpiry)} days ago`
                                  : med.daysToExpiry === 0
                                  ? 'Expires today!'
                                  : `In ${med.daysToExpiry} days`
                                : ''}
                            </span>
                          </td>

                          <td className="py-3.5 px-6">
                            <span
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-semibold ${
                                med.stock <= 0
                                  ? 'bg-rose-100 text-rose-800'
                                  : med.stock < 10
                                  ? 'bg-amber-100 text-amber-800'
                                  : 'bg-emerald-100 text-emerald-800'
                              }`}
                            >
                              {med.stock} units
                            </span>
                          </td>

                          <td className="py-3.5 px-6 font-semibold text-slate-900">
                            ₹{med.price.toFixed(2)}
                          </td>

                          <td className="py-3.5 px-6 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => {
                                  setActiveMedicineForSale(med.id);
                                  setIsSaleModalOpen(true);
                                }}
                                disabled={med.stock <= 0}
                                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg shadow-xs transition-colors disabled:opacity-30"
                              >
                                <ShoppingBag className="w-3 h-3" />
                                <span>Sell</span>
                              </button>

                              <button
                                onClick={() => handleDeleteMedicine(med.id, med.name)}
                                className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors"
                                title="Delete Medicine"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 2: ALERTS PANEL */}
        {selectedTab === 'alerts' && (
          <div className="space-y-6">
            {/* Filter pills */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setAlertFilter('all')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                  alertFilter === 'all' ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 border border-slate-200'
                }`}
              >
                All Alerts ({lowStockAlerts.length + expiringAlerts.length})
              </button>
              <button
                onClick={() => setAlertFilter('low-stock')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                  alertFilter === 'low-stock'
                    ? 'bg-amber-600 text-white'
                    : 'bg-white text-amber-700 border border-amber-200'
                }`}
              >
                Low Stock &lt; 10 units ({lowStockAlerts.length})
              </button>
              <button
                onClick={() => setAlertFilter('expiring')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                  alertFilter === 'expiring' ? 'bg-rose-600 text-white' : 'bg-white text-rose-700 border border-rose-200'
                }`}
              >
                Expiring Next 30 Days ({expiringAlerts.length})
              </button>
            </div>

            {/* Section 1: Low-Stock Alerts */}
            {(alertFilter === 'all' || alertFilter === 'low-stock') && (
              <div className="bg-white rounded-2xl border border-amber-200 shadow-xs overflow-hidden">
                <div className="px-6 py-4 bg-amber-50/60 border-b border-amber-200/80 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <AlertTriangle className="w-5 h-5 text-amber-600" />
                    <div>
                      <h3 className="text-sm font-bold text-amber-950">
                        Low Stock Alerts (GET /api/alerts/low-stock)
                      </h3>
                      <p className="text-xs text-amber-700">Inventory items with available stock below threshold (&lt; 10 units)</p>
                    </div>
                  </div>
                  <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-200 text-amber-900">
                    {lowStockAlerts.length} items
                  </span>
                </div>

                <div className="divide-y divide-slate-100">
                  {lowStockAlerts.length === 0 ? (
                    <div className="p-8 text-center text-slate-400 text-xs">
                      No low-stock items detected. All medicines have 10+ units in stock.
                    </div>
                  ) : (
                    lowStockAlerts.map((med) => (
                      <div key={med.id} className="p-4 sm:px-6 flex items-center justify-between gap-4 hover:bg-slate-50">
                        <div>
                          <span className="font-semibold text-slate-900 text-sm">{med.name}</span>
                          <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
                            <span className="font-mono bg-slate-100 px-1.5 py-0.5 rounded">{med.batch}</span>
                            <span>Supplier: {med.supplier}</span>
                            <span>Price: ₹{med.price.toFixed(2)}</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800">
                            {med.stock} units remaining
                          </span>
                          <button
                            onClick={() => {
                              setActiveMedicineForSale(med.id);
                              setIsSaleModalOpen(true);
                            }}
                            disabled={med.stock <= 0}
                            className="px-3 py-1 text-xs font-semibold bg-slate-900 text-white rounded-lg hover:bg-slate-800 disabled:opacity-30"
                          >
                            Sell
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* Section 2: Expiring Alerts */}
            {(alertFilter === 'all' || alertFilter === 'expiring') && (
              <div className="bg-white rounded-2xl border border-rose-200 shadow-xs overflow-hidden">
                <div className="px-6 py-4 bg-rose-50/60 border-b border-rose-200/80 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <Clock className="w-5 h-5 text-rose-600" />
                    <div>
                      <h3 className="text-sm font-bold text-rose-950">
                        Expiring Medicine Alerts (GET /api/alerts/expiring)
                      </h3>
                      <p className="text-xs text-rose-700">Medicines with expiry timestamp within the next 30 days (or expired)</p>
                    </div>
                  </div>
                  <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-rose-200 text-rose-900">
                    {expiringAlerts.length} items
                  </span>
                </div>

                <div className="divide-y divide-slate-100">
                  {expiringAlerts.length === 0 ? (
                    <div className="p-8 text-center text-slate-400 text-xs">
                      No medicines are expiring within the next 30 days.
                    </div>
                  ) : (
                    expiringAlerts.map((med) => {
                      const isExpired = med.daysToExpiry !== null && med.daysToExpiry < 0;
                      return (
                        <div key={med.id} className="p-4 sm:px-6 flex items-center justify-between gap-4 hover:bg-slate-50">
                          <div>
                            <span className="font-semibold text-slate-900 text-sm">{med.name}</span>
                            <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
                              <span className="font-mono bg-slate-100 px-1.5 py-0.5 rounded">{med.batch}</span>
                              <span>Expiry: {med.expiryDate ? med.expiryDate.split('T')[0] : 'N/A'}</span>
                              <span>Stock: {med.stock}</span>
                            </div>
                          </div>

                          <div className="text-right">
                            <span
                              className={`inline-block px-3 py-1 rounded-full text-xs font-bold ${
                                isExpired ? 'bg-slate-900 text-white' : 'bg-rose-100 text-rose-800'
                              }`}
                            >
                              {isExpired
                                ? `Expired ${Math.abs(med.daysToExpiry!)} days ago`
                                : med.daysToExpiry === 0
                                ? 'Expires today'
                                : `Expires in ${med.daysToExpiry} days`}
                            </span>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 3: SALES LOG */}
        {selectedTab === 'sales' && (
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-slate-800">Sales Transactions History</h3>
                <p className="text-xs text-slate-500">Recorded into Firestore <code className="font-mono text-slate-700 font-medium">sales</code> collection with atomic stock auto-decrease</p>
              </div>
              <button
                id="btn-new-sale-from-tab"
                onClick={() => setIsSaleModalOpen(true)}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>New Sale</span>
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/70 text-slate-500 font-medium">
                    <th className="py-3 px-6">Sale ID</th>
                    <th className="py-3 px-6">Medicine Name</th>
                    <th className="py-3 px-6">Customer Name</th>
                    <th className="py-3 px-6">Quantity</th>
                    <th className="py-3 px-6">Total Price</th>
                    <th className="py-3 px-6">Remaining Stock</th>
                    <th className="py-3 px-6 text-right">Date & Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {sales.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-400">
                        <ShoppingBag className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                        <p className="font-medium">No sales recorded yet</p>
                        <p className="text-[11px] mt-1">Click &quot;Record Sale&quot; to test stock decrementing transaction.</p>
                      </td>
                    </tr>
                  ) : (
                    sales.map((sale) => (
                      <tr key={sale.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="py-3.5 px-6 font-mono text-[11px] text-slate-500">
                          {sale.id.slice(0, 10)}...
                        </td>
                        <td className="py-3.5 px-6 font-semibold text-slate-900">
                          {sale.medicineName}
                        </td>
                        <td className="py-3.5 px-6 text-slate-700">
                          {sale.customerName}
                        </td>
                        <td className="py-3.5 px-6 font-medium text-slate-800">
                          {sale.quantity} units
                        </td>
                        <td className="py-3.5 px-6 font-bold text-emerald-700">
                          ₹{sale.totalPrice.toFixed(2)}
                        </td>
                        <td className="py-3.5 px-6">
                          {sale.remainingStock !== undefined ? (
                            <span className="font-mono text-slate-600 bg-slate-100 px-2 py-0.5 rounded text-[11px]">
                              {sale.remainingStock} units left
                            </span>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                        <td className="py-3.5 px-6 text-right text-slate-500 font-mono text-[11px]">
                          {sale.date ? new Date(sale.date).toLocaleString() : 'N/A'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white py-4 px-6 text-center text-xs text-slate-500 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span>Backend Files:</span>
          <code className="bg-slate-100 px-1.5 py-0.5 rounded font-mono text-slate-800 font-semibold">server.js</code>
          <span>&</span>
          <code className="bg-slate-100 px-1.5 py-0.5 rounded font-mono text-slate-800 font-semibold">firebase.js</code>
        </div>
        <div className="text-[11px] text-slate-400">
          MedStore Manager API • Express 4.x + Firebase Admin SDK • Database: <strong>(default)</strong>
        </div>
      </footer>

      {/* Modals */}
      <AddMedicineModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onMedicineAdded={handleMedicineAdded}
      />

      <CreateSaleModal
        isOpen={isSaleModalOpen}
        onClose={() => setIsSaleModalOpen(false)}
        medicines={medicines}
        initialMedicineId={activeMedicineForSale}
        onSaleCompleted={handleSaleCompleted}
      />

      <ApiConsoleModal
        isOpen={isApiModalOpen}
        onClose={() => setIsApiModalOpen(false)}
        onRefreshData={loadData}
      />
    </div>
  );
}
