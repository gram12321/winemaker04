import React from 'react';
import { CloudSun, Leaf, ShieldAlert, Snowflake, Sprout, SunMedium } from 'lucide-react';

interface VineyardStatusBadgeProps {
  status: string;
  className?: string;
}

function getStatusMeta(status: string): { label: string; icon: React.ReactElement; tone: string } {
  switch (status) {
    case 'Growing':
      return { label: 'Growing', icon: <Sprout className="h-3.5 w-3.5" />, tone: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
    case 'Harvested':
      return { label: 'Harvested', icon: <Leaf className="h-3.5 w-3.5" />, tone: 'bg-amber-50 text-amber-700 border-amber-200' };
    case 'Dormant':
      return { label: 'Dormant', icon: <Snowflake className="h-3.5 w-3.5" />, tone: 'bg-slate-100 text-slate-700 border-slate-200' };
    case 'Planting':
      return { label: 'Planting', icon: <CloudSun className="h-3.5 w-3.5" />, tone: 'bg-sky-50 text-sky-700 border-sky-200' };
    case 'Planted':
      return { label: 'Planted', icon: <SunMedium className="h-3.5 w-3.5" />, tone: 'bg-blue-50 text-blue-700 border-blue-200' };
    case 'Barren':
      return { label: 'Barren', icon: <ShieldAlert className="h-3.5 w-3.5" />, tone: 'bg-gray-100 text-gray-700 border-gray-200' };
    default:
      return { label: status || 'Unknown', icon: <ShieldAlert className="h-3.5 w-3.5" />, tone: 'bg-slate-100 text-slate-700 border-slate-200' };
  }
}

export const VineyardStatusBadge: React.FC<VineyardStatusBadgeProps> = ({ status, className }) => {
  const statusMeta = getStatusMeta(status);
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${statusMeta.tone} ${className || ''}`}>
      {statusMeta.icon}
      {statusMeta.label}
    </span>
  );
};

export default VineyardStatusBadge;
