
const Vineyard: React.FC = () => {
  return (
    <div className="space-y-6">
      <h2 className="text-3xl font-bold text-gray-800">Farmland Management</h2>
      
      {/* Vineyard Image */}
      <div 
        className="h-48 bg-cover bg-center rounded-lg relative"
        style={{
          backgroundImage: "url('https://images.unsplash.com/photo-1516594798947-e65505dbb29d?w=1200&h=400&fit=crop')"
        }}
      >
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-amber-900 to-transparent p-4">
          <div className="flex justify-between items-end">
            <h3 className="text-white text-xl font-semibold">Owned Farmland</h3>
            <button className="bg-amber-700 hover:bg-amber-800 text-white px-4 py-2 rounded">
              Buy Land
            </button>
          </div>
        </div>
      </div>

      {/* Farmland Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Farmland</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Field Name</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Country/Region</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Size</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Crop</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Prestige</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Health</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Action</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            <tr>
              <td className="px-6 py-4 whitespace-nowrap">
                <div className="w-12 h-12 bg-amber-200 rounded"></div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">Laurent</td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                <span className="inline-flex items-center">
                  🇫🇷 France, Burgundy (Bourgogne)
                </span>
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">0.33 acres</td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">None</td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">110%</td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-orange-500">50%</td>
              <td className="px-6 py-4 whitespace-nowrap text-sm space-x-2">
                <button className="bg-amber-600 hover:bg-amber-700 text-white px-3 py-1 rounded">
                  Plant
                </button>
                <button className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded">
                  Clear
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Vineyard;
