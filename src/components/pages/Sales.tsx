
const Sales: React.FC = () => {
  return (
    <div className="space-y-6">
      <h2 className="text-3xl font-bold text-gray-800">Sales</h2>
      
      {/* Navigation Tabs */}
      <div className="flex space-x-1">
        <button className="bg-amber-600 text-white px-4 py-2 rounded">Wine Cellar</button>
        <button className="bg-red-600 text-white px-4 py-2 rounded">Orders</button>
        <button className="bg-red-600 text-white px-4 py-2 rounded">Contracts</button>
      </div>

      {/* Wine Cellar Image */}
      <div 
        className="h-48 bg-cover bg-center rounded-lg relative"
        style={{
          backgroundImage: "url('https://images.unsplash.com/photo-1510076857177-7470076d4098?w=1200&h=400&fit=crop')"
        }}
      >
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-amber-900 to-transparent p-4">
          <h3 className="text-white text-xl font-semibold">Wine Cellar Inventory</h3>
        </div>
      </div>

      {/* Wine Inventory Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Wine</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Storage</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Amount</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Quality</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Order Type</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Bulk Price</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Bulk Sales</th>
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

export default Sales;
