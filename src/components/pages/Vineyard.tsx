
import React, { useState, useEffect } from 'react';
import { 
  createVineyard, 
  plantVineyard, 
  harvestVineyard, 
  growVineyard,
  resetVineyard,
  getAllVineyards,
  GRAPE_VARIETIES
} from '../../lib/services/vineyardService';
import { addGrapesToInventory } from '../../lib/services/inventoryService';
import { Vineyard as VineyardType, GrapeVariety } from '../../lib/types';
import { useGameUpdates } from '../../hooks/useGameUpdates';

interface CreateVineyardDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (name: string) => void;
}

const CreateVineyardDialog: React.FC<CreateVineyardDialogProps> = ({ isOpen, onClose, onSubmit }) => {
  const [name, setName] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(name);
    setName('');
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-96">
        <h3 className="text-lg font-bold mb-4">Create New Vineyard</h3>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1 block w-full border-gray-300 rounded-md shadow-sm"
                required
              />
            </div>
          </div>
          <div className="flex justify-end space-x-2 mt-6">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-amber-600 text-white rounded-md hover:bg-amber-700"
            >
              Create
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

interface PlantDialogProps {
  isOpen: boolean;
  vineyard: VineyardType | null;
  onClose: () => void;
  onSubmit: (grape: GrapeVariety) => void;
}

const PlantDialog: React.FC<PlantDialogProps> = ({ isOpen, vineyard, onClose, onSubmit }) => {
  const [selectedGrape, setSelectedGrape] = useState<GrapeVariety>('Chardonnay');

  if (!isOpen || !vineyard) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(selectedGrape);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-96">
        <h3 className="text-lg font-bold mb-4">Plant Vineyard: {vineyard.name}</h3>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Grape Variety</label>
              <select
                value={selectedGrape}
                onChange={(e) => setSelectedGrape(e.target.value as GrapeVariety)}
                className="mt-1 block w-full border-gray-300 rounded-md shadow-sm"
              >
                {GRAPE_VARIETIES.map((grape) => (
                  <option key={grape} value={grape}>{grape}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex justify-end space-x-2 mt-6">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
            >
              Plant
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const Vineyard: React.FC = () => {
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showPlantDialog, setShowPlantDialog] = useState(false);
  const [selectedVineyard, setSelectedVineyard] = useState<VineyardType | null>(null);
  const [vineyards, setVineyards] = useState<VineyardType[]>([]);
  const { subscribe } = useGameUpdates();

  // Update vineyards state when component mounts or when actions are performed
  useEffect(() => {
    const loadVineyards = async () => {
      const vineyardData = await getAllVineyards();
      setVineyards(vineyardData);
    };
    
    loadVineyards();
    
    // Subscribe to global updates
    const unsubscribe = subscribe(async () => {
      const vineyardData = await getAllVineyards();
      setVineyards(vineyardData);
    });
    
    return () => {
      unsubscribe();
    };
  }, [subscribe]);

  const handleCreateVineyard = async (name: string) => {
    await createVineyard(name);
  };

  const handlePlantVineyard = async (grape: GrapeVariety) => {
    if (selectedVineyard) {
      await plantVineyard(selectedVineyard.id, grape);
    }
  };

  const handleHarvestVineyard = async (vineyard: VineyardType) => {
    const result = await harvestVineyard(vineyard.id);
    if (result.success && result.quantity && vineyard.grape) {
      // Add grapes to inventory
      await addGrapesToInventory(vineyard.grape, result.quantity, vineyard.name);
      alert(`Harvested ${result.quantity} kg of ${vineyard.grape} grapes!`);
    }
  };

  const handleGrowVineyard = async (vineyard: VineyardType) => {
    await growVineyard(vineyard.id);
  };

  const handleResetVineyard = async (vineyard: VineyardType) => {
    await resetVineyard(vineyard.id);
  };

  const getActionButtons = (vineyard: VineyardType) => {
    if (!vineyard.isPlanted) {
      return (
        <button 
          onClick={() => {
            setSelectedVineyard(vineyard);
            setShowPlantDialog(true);
          }}
          className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded"
        >
          Plant
        </button>
      );
    }

    switch (vineyard.status) {
      case 'Planted':
        return (
          <button 
            onClick={() => handleGrowVineyard(vineyard)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded"
          >
            Grow
          </button>
        );
      case 'Growing':
        return (
          <button 
            onClick={() => handleHarvestVineyard(vineyard)}
            className="bg-purple-600 hover:bg-purple-700 text-white px-3 py-1 rounded"
          >
            Harvest
          </button>
        );
      case 'Harvested':
        return (
          <button 
            onClick={() => handleResetVineyard(vineyard)}
            className="bg-orange-600 hover:bg-orange-700 text-white px-3 py-1 rounded"
          >
            Reset
          </button>
        );
      default:
        return null;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Barren': return 'text-gray-500';
      case 'Planted': return 'text-green-500';
      case 'Growing': return 'text-blue-500';
      case 'Harvested': return 'text-purple-500';
      case 'Dormant': return 'text-orange-500';
      default: return 'text-gray-500';
    }
  };

  return (
    <div className="space-y-6">
      <h2 className="text-3xl font-bold text-gray-800">Vineyard Management</h2>
      
      {/* Vineyard Image */}
      <div 
        className="h-48 bg-cover bg-center rounded-lg relative"
        style={{
          backgroundImage: "url('https://images.unsplash.com/photo-1516594798947-e65505dbb29d?w=1200&h=400&fit=crop')"
        }}
      >
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-amber-900 to-transparent p-4">
          <div className="flex justify-between items-end">
            <h3 className="text-white text-xl font-semibold">Owned Vineyards ({vineyards.length})</h3>
            <button 
              onClick={() => setShowCreateDialog(true)}
              className="bg-amber-700 hover:bg-amber-800 text-white px-4 py-2 rounded"
            >
              Create Vineyard
            </button>
          </div>
        </div>
      </div>

      {/* Vineyards Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Grape</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Action</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {vineyards.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-6 py-8 text-center text-gray-500">
                  No vineyards yet. Create your first vineyard to get started!
                </td>
              </tr>
            ) : (
              vineyards.map((vineyard) => (
                <tr key={vineyard.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{vineyard.name}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {vineyard.grape || 'None'}
                  </td>
                  <td className={`px-6 py-4 whitespace-nowrap text-sm font-medium ${getStatusColor(vineyard.status)}`}>
                    {vineyard.status}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm space-x-2">
                    {getActionButtons(vineyard)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <CreateVineyardDialog
        isOpen={showCreateDialog}
        onClose={() => setShowCreateDialog(false)}
        onSubmit={handleCreateVineyard}
      />

      <PlantDialog
        isOpen={showPlantDialog}
        vineyard={selectedVineyard}
        onClose={() => {
          setShowPlantDialog(false);
          setSelectedVineyard(null);
        }}
        onSubmit={handlePlantVineyard}
      />
    </div>
  );
};

export default Vineyard;
