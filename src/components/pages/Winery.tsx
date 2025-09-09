
const Winery: React.FC = () => {
  return (
    <div className="space-y-6">
      <h2 className="text-3xl font-bold text-gray-800">Winery Management</h2>
      
      {/* Warehouse Storage */}
      <div 
        className="h-48 bg-cover bg-center rounded-lg relative"
        style={{
          backgroundImage: "url('https://images.unsplash.com/photo-1474722883778-792e7990302f?w=1200&h=400&fit=crop')"
        }}
      >
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-amber-900 to-transparent p-4">
          <div className="flex justify-between items-end">
            <h3 className="text-white text-xl font-semibold">Warehouse Storage</h3>
            <button className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded">
              Crush Grapes
            </button>
          </div>
        </div>
      </div>

      {/* Storage Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Container</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Capacity</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Resource</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Amount</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Quality</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {/* Empty for now */}
          </tbody>
        </table>
      </div>

      {/* Winery Processing */}
      <div 
        className="h-48 bg-cover bg-center rounded-lg relative"
        style={{
          backgroundImage: "url('https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=1200&h=400&fit=crop')"
        }}
      >
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-amber-900 to-transparent p-4">
          <div className="flex justify-between items-end">
            <h3 className="text-white text-xl font-semibold">Winery Processing</h3>
            <button className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded">
              Ferment Must
            </button>
          </div>
        </div>
      </div>

      {/* Processing Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Container</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Capacity</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Resource</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Amount</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Quality</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {/* Empty for now */}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Winery;
