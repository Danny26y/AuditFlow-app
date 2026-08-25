import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native';
import { initDatabase, getDatabaseStats } from './src/db/database';
import CaptureForm from './src/screens/CaptureForm';
import SyncDashboard from './src/screens/SyncDashboard';
import RecordsList from './src/screens/RecordsList';
import BluetoothScannerModal from './src/screens/BluetoothScannerModal';
import { syncEngine } from './src/services/syncEngine';

type ActiveTab = 'CAPTURE' | 'SYNC' | 'RECORDS' | 'BLUETOOTH';

export default function App() {
  const { width } = useWindowDimensions();
  const isCompact = width < 480;

  const [activeTab, setActiveTab] = useState<ActiveTab>('CAPTURE');
  const [isDbReady, setIsDbReady] = useState<boolean>(false);
  const [dbPendingCount, setDbPendingCount] = useState<number>(0);

  const refreshPendingCount = async () => {
    try {
      const stats = await getDatabaseStats();
      setDbPendingCount(stats.pending + stats.error);
    } catch (err) {
      console.warn('Could not read DB stats:', err);
    }
  };

  useEffect(() => {
    async function bootstrap() {
      try {
        await initDatabase();
        setIsDbReady(true);
        await refreshPendingCount();
      } catch (err) {
        console.error('Database bootstrap error:', err);
      }
    }
    bootstrap();

    const unsubscribe = syncEngine.addListener(() => {
      refreshPendingCount();
    });

    return () => {
      unsubscribe();
    };
  }, []);

  if (!isDbReady) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2563EB" />
        <Text style={styles.loadingText}>Initializing SQLite Database...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#0F172A" />

      {/* Top App Branding Bar */}
      <View style={styles.topBar}>
        <View style={styles.topBarTitleContainer}>
          <Text style={styles.appTitle} numberOfLines={1}>AuditFlow Field Capture</Text>
          <Text style={styles.appSub} numberOfLines={1}>Offline Farmer Demographic & Biometric Client</Text>
        </View>
        {dbPendingCount > 0 && (
          <TouchableOpacity
            style={styles.pendingBadge}
            onPress={() => setActiveTab('SYNC')}
          >
            <Text style={styles.pendingBadgeText}>⚡ {dbPendingCount} PENDING</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Screen Views */}
      <View style={styles.screenContainer}>
        {activeTab === 'CAPTURE' && (
          <CaptureForm
            onRecordSaved={() => {
              refreshPendingCount();
            }}
          />
        )}
        {activeTab === 'SYNC' && (
          <SyncDashboard
            onNavigateToRecords={() => {
              setActiveTab('RECORDS');
            }}
          />
        )}
        {activeTab === 'RECORDS' && <RecordsList />}
        {activeTab === 'BLUETOOTH' && <BluetoothScannerModal />}
      </View>

      {/* Daylight-Optimized Bottom Navigation Bar */}
      <View style={styles.navBar}>
        <TouchableOpacity
          style={[styles.navItem, activeTab === 'CAPTURE' ? styles.navItemActive : null]}
          onPress={() => setActiveTab('CAPTURE')}
        >
          <Text style={styles.navIcon}>📝</Text>
          <Text style={[styles.navLabel, activeTab === 'CAPTURE' ? styles.navLabelActive : null]} numberOfLines={1}>
            {isCompact ? 'Capture' : 'Capture (18-Col)'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.navItem, activeTab === 'SYNC' ? styles.navItemActive : null]}
          onPress={() => setActiveTab('SYNC')}
        >
          <Text style={styles.navIcon}>🚀</Text>
          <Text style={[styles.navLabel, activeTab === 'SYNC' ? styles.navLabelActive : null]} numberOfLines={1}>
            Sync
          </Text>
          {dbPendingCount > 0 && (
            <View style={styles.navBadge}>
              <Text style={styles.navBadgeText}>{dbPendingCount}</Text>
            </View>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.navItem, activeTab === 'RECORDS' ? styles.navItemActive : null]}
          onPress={() => setActiveTab('RECORDS')}
        >
          <Text style={styles.navIcon}>📂</Text>
          <Text style={[styles.navLabel, activeTab === 'RECORDS' ? styles.navLabelActive : null]} numberOfLines={1}>
            Records
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.navItem, activeTab === 'BLUETOOTH' ? styles.navItemActive : null]}
          onPress={() => setActiveTab('BLUETOOTH')}
        >
          <Text style={styles.navIcon}>📶</Text>
          <Text style={[styles.navLabel, activeTab === 'BLUETOOTH' ? styles.navLabelActive : null]} numberOfLines={1}>
            Bluetooth
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#0F172A',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    marginTop: 12,
  },
  topBar: {
    backgroundColor: '#0F172A',
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: '#1E293B',
    gap: 8,
  },
  topBarTitleContainer: {
    flex: 1,
  },
  appTitle: {
    fontSize: 17,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: -0.3,
  },
  appSub: {
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '500',
    marginTop: 1,
  },
  pendingBadge: {
    backgroundColor: '#EA580C',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: '#FB923C',
  },
  pendingBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '900',
  },
  screenContainer: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  navBar: {
    flexDirection: 'row',
    backgroundColor: '#0F172A',
    borderTopWidth: 2,
    borderTopColor: '#1E293B',
    paddingBottom: 6,
    paddingTop: 6,
    paddingHorizontal: 4,
  },
  navItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 2,
    borderRadius: 8,
    position: 'relative',
  },
  navItemActive: {
    backgroundColor: '#1E293B',
  },
  navIcon: {
    fontSize: 18,
    marginBottom: 2,
  },
  navLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#94A3B8',
  },
  navLabelActive: {
    color: '#38BDF8',
    fontWeight: '900',
  },
  navBadge: {
    position: 'absolute',
    top: 2,
    right: 8,
    backgroundColor: '#DC2626',
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 3,
  },
  navBadgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '900',
  },
});
