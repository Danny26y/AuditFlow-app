import { useState, useEffect, useCallback } from 'react';
import { Navbar } from './components/Navbar';
import { StatsCards } from './components/StatsCards';
import { FarmMap } from './components/FarmMap';
import { FarmerTable } from './components/FarmerTable';
import { FarmerDetailModal } from './components/FarmerDetailModal';
import { TransitReconciler } from './components/TransitReconciler';
import { fetchStatsSummary, fetchRecords } from './services/api';
import {
  FarmerRecordOut,
  StatsSummaryResponse,
} from './types/dashboard';
import { ThemeProvider } from './context/ThemeContext';

function DashboardContent() {
  const [activeTab, setActiveTab] = useState<'OPERATIONS' | 'SECURITY'>('OPERATIONS');
  const [stats, setStats] = useState<StatsSummaryResponse | null>(null);
  const [statsLoading, setStatsLoading] = useState<boolean>(true);

  // Farmer Records Table State
  const [records, setRecords] = useState<FarmerRecordOut[]>([]);
  const [mapRecords, setMapRecords] = useState<FarmerRecordOut[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [tableLoading, setTableLoading] = useState<boolean>(true);
  const limit = 50;
  const [offset, setOffset] = useState<number>(0);

  // Filters State
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedLga, setSelectedLga] = useState<string>('');
  const [selectedCrop, setSelectedCrop] = useState<string>('');

  // Selected Farmer for 18-Column Profile Drawer
  const [selectedFarmer, setSelectedFarmer] = useState<FarmerRecordOut | null>(null);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  // Load KPI Stats
  const loadStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const data = await fetchStatsSummary();
      setStats(data);
    } catch (err) {
      console.warn('Could not load stats summary:', err);
    } finally {
      setStatsLoading(false);
    }
  }, []);

  // Load Table Records (Paginated & Filtered)
  const loadTableRecords = useCallback(async () => {
    setTableLoading(true);
    try {
      const res = await fetchRecords({
        limit,
        offset,
        search: searchQuery || undefined,
        lga: selectedLga || undefined,
        crop_type: selectedCrop || undefined,
      });
      setRecords(res.records);
      setTotalCount(res.total_count);
    } catch (err) {
      console.warn('Could not load table records:', err);
    } finally {
      setTableLoading(false);
    }
  }, [limit, offset, searchQuery, selectedLga, selectedCrop]);

  // Load All Geotagged Records for Map (Limit up to 500)
  const loadMapRecords = useCallback(async () => {
    try {
      const res = await fetchRecords({
        limit: 500,
        offset: 0,
        lga: selectedLga || undefined,
        crop_type: selectedCrop || undefined,
      });
      setMapRecords(res.records);
    } catch (err) {
      console.warn('Could not load map records:', err);
    }
  }, [selectedLga, selectedCrop]);

  // Initial Bootstrap & Refresh
  const handleRefreshAll = useCallback(async () => {
    setIsRefreshing(true);
    await Promise.all([loadStats(), loadTableRecords(), loadMapRecords()]);
    setIsRefreshing(false);
  }, [loadStats, loadTableRecords, loadMapRecords]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  useEffect(() => {
    loadTableRecords();
  }, [loadTableRecords]);

  useEffect(() => {
    loadMapRecords();
  }, [loadMapRecords]);

  // Debounced search / filter reset
  const handleSearchChange = (q: string) => {
    setSearchQuery(q);
    setOffset(0);
  };

  const handleLgaChange = (lga: string) => {
    setSelectedLga(lga);
    setOffset(0);
  };

  const handleCropChange = (crop: string) => {
    setSelectedCrop(crop);
    setOffset(0);
  };

  const handleResetFilters = () => {
    setSearchQuery('');
    setSelectedLga('');
    setSelectedCrop('');
    setOffset(0);
  };

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 dark:bg-slate-950 dark:text-slate-100 flex flex-col font-sans transition-colors duration-200">
      {/* Top Navigation Bar with Dark/Light Mode Toggle */}
      <Navbar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onRefresh={handleRefreshAll}
        isRefreshing={isRefreshing}
      />

      {/* Main Dashboard Workspace */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Executive KPI Summary Cards */}
        <StatsCards stats={stats} loading={statsLoading} />

        {/* Tab 1: Operations & Geospatial Map */}
        {activeTab === 'OPERATIONS' && (
          <div className="space-y-6">
            {/* Geospatial Map */}
            <FarmMap
              records={mapRecords}
              selectedLga={selectedLga}
              onSelectLga={handleLgaChange}
              onSelectFarmer={setSelectedFarmer}
            />

            {/* Master Farmer Registry Table */}
            <FarmerTable
              records={records}
              totalCount={totalCount}
              limit={limit}
              offset={offset}
              searchQuery={searchQuery}
              selectedLga={selectedLga}
              selectedCrop={selectedCrop}
              loading={tableLoading}
              onSearchChange={handleSearchChange}
              onLgaChange={handleLgaChange}
              onCropChange={handleCropChange}
              onPageChange={setOffset}
              onSelectFarmer={setSelectedFarmer}
              onResetFilters={handleResetFilters}
            />
          </div>
        )}

        {/* Tab 2: SEC Supply Chain Transit Reconciler */}
        {activeTab === 'SECURITY' && (
          <div className="space-y-6">
            <TransitReconciler />
          </div>
        )}
      </main>

      {/* Slide-over / Modal 18-Column Detail Inspector */}
      {selectedFarmer && (
        <FarmerDetailModal
          farmer={selectedFarmer}
          onClose={() => setSelectedFarmer(null)}
        />
      )}

      {/* Minimal Footer */}
      <footer className="border-t border-slate-200 dark:border-slate-800/80 bg-white dark:bg-slate-950 py-4 px-4 sm:px-6 lg:px-8 text-center text-xs text-slate-500 transition-colors duration-200">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>AuditFlow Master Registry & Supply Chain Platform · SEC ISA Compliant</span>
          <span>Benue State Agricultural Development Network</span>
        </div>
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <DashboardContent />
    </ThemeProvider>
  );
}
