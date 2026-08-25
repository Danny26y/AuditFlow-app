import React from 'react';
import {
  Users,
  Sprout,
  TrendingUp,
  Lock,
  Radio,
  Clock,
} from 'lucide-react';
import { StatsSummaryResponse } from '../types/dashboard';

interface StatsCardsProps {
  stats: StatsSummaryResponse | null;
  loading: boolean;
}

export const StatsCards: React.FC<StatsCardsProps> = ({ stats, loading }) => {
  if (loading && !stats) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {[1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className="h-28 rounded-2xl bg-slate-900/60 border border-slate-800 animate-pulse p-4 flex flex-col justify-between"
          >
            <div className="h-4 bg-slate-800 rounded w-1/2"></div>
            <div className="h-7 bg-slate-800 rounded w-3/4"></div>
            <div className="h-3 bg-slate-800 rounded w-1/3"></div>
          </div>
        ))}
      </div>
    );
  }

  const totalFarmers = stats?.total_registered_farmers ?? 0;
  const lockedCount = stats?.sec_digital_locked_records ?? 0;
  const complianceRate = totalFarmers > 0 ? Math.round((lockedCount / totalFarmers) * 100) : 100;
  const totalHectares = (stats?.total_farm_area_hectares ?? 0).toLocaleString(undefined, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 2,
  });
  const totalYield = (stats?.total_estimated_yield_tonnes ?? 0).toLocaleString(undefined, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 2,
  });
  const activeAgents = stats?.active_field_agents ?? 0;

  const cards = [
    {
      title: 'Total Onboarded Farmers',
      value: totalFarmers.toLocaleString(),
      subtitle: 'Primary Producer Registry',
      icon: Users,
      color: 'emerald',
      bgGlow: 'from-emerald-500/10 to-teal-500/5',
      borderColor: 'border-emerald-500/30',
      iconColor: 'text-emerald-400',
      badge: '18-Col Verified',
    },
    {
      title: 'Cultivated Land Area',
      value: `${totalHectares} ha`,
      subtitle: 'Geotagged Farm Plots',
      icon: Sprout,
      color: 'teal',
      bgGlow: 'from-teal-500/10 to-cyan-500/5',
      borderColor: 'border-teal-500/30',
      iconColor: 'text-teal-400',
      badge: 'Benue Basin',
    },
    {
      title: 'Projected Harvest Yield',
      value: `${totalYield} T`,
      subtitle: 'Estimated Crop & Livestock',
      icon: TrendingUp,
      color: 'sky',
      bgGlow: 'from-sky-500/10 to-blue-500/5',
      borderColor: 'border-sky-500/30',
      iconColor: 'text-sky-400',
      badge: 'Aggregated',
    },
    {
      title: 'SEC Digital Lock Status',
      value: `${lockedCount} (${complianceRate}%)`,
      subtitle: 'Immutable Cryptographic Lock',
      icon: Lock,
      color: 'amber',
      bgGlow: 'from-amber-500/10 to-orange-500/5',
      borderColor: 'border-amber-500/30',
      iconColor: 'text-amber-400',
      badge: complianceRate === 100 ? '100% Compliant' : `${complianceRate}% Locked`,
    },
    {
      title: 'Active Fleet Enumerators',
      value: activeAgents.toString(),
      subtitle: 'Field Agent Anchors',
      icon: Radio,
      color: 'indigo',
      bgGlow: 'from-indigo-500/10 to-purple-500/5',
      borderColor: 'border-indigo-500/30',
      iconColor: 'text-indigo-400',
      badge: 'Fleet Synchronized',
    },
  ];

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {cards.map((card, idx) => {
          const Icon = card.icon;
          return (
            <div
              key={idx}
              className={`relative overflow-hidden rounded-2xl bg-slate-900/80 backdrop-blur-md border ${card.borderColor} bg-gradient-to-b ${card.bgGlow} p-4 shadow-xl transition-all duration-200 hover:scale-[1.01] hover:shadow-emerald-950/20`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  {card.title}
                </span>
                <div className={`p-1.5 rounded-lg bg-slate-950/60 border border-slate-800 ${card.iconColor}`}>
                  <Icon className="h-4 w-4" />
                </div>
              </div>

              <div className="flex items-baseline space-x-2 my-1">
                <span className="text-2xl font-extrabold tracking-tight text-white font-mono">
                  {card.value}
                </span>
              </div>

              <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-800/60">
                <span className="text-[11px] text-slate-400 truncate">{card.subtitle}</span>
                <span className="inline-flex items-center text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-950/80 text-emerald-300 border border-emerald-500/20">
                  {card.badge}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Last update footer */}
      {stats?.last_updated && (
        <div className="flex items-center justify-end space-x-1.5 text-[11px] text-slate-500 pr-1">
          <Clock className="h-3 w-3" />
          <span>Last synchronized: {new Date(stats.last_updated).toLocaleTimeString()}</span>
        </div>
      )}
    </div>
  );
};
