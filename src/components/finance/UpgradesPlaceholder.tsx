import { Card } from '@/components/ui';

export function UpgradesPlaceholder() {
  return (
    <div className="space-y-6">
      <Card className="p-6">
        <h2 className="text-xl font-semibold text-gray-800 mb-4">Research & Upgrades</h2>
        <div className="text-center py-8 text-gray-500">
          <p className="text-lg mb-2">🔬 Research & Development Coming Soon</p>
          <p className="text-sm">
            This section will include research projects, vineyard upgrades, and equipment improvements.
          </p>
        </div>
      </Card>
      
      <Card className="p-6">
        <h2 className="text-xl font-semibold text-gray-800 mb-4">Ongoing Projects</h2>
        <div className="text-center py-8 text-gray-500">
          <p className="text-lg mb-2">⚡ Project Management Coming Soon</p>
          <p className="text-sm">
            Track progress on active research and upgrade projects here.
          </p>
        </div>
      </Card>
    </div>
  );
}
