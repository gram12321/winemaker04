import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";

interface WinepediaProps {
  view?: string;
}

export default function Winepedia({ view }: WinepediaProps) {
  const [activeTab, setActiveTab] = useState('grapeVarieties');

  if (view && view !== 'winepedia') return null;

  // Mock grape varieties
  const grapeVarieties = [
    {
      name: 'Barbera',
      description: 'A versatile grape known for high acidity and moderate tannins, producing medium-bodied wines.'
    },
    {
      name: 'Chardonnay',
      description: 'A noble grape variety producing aromatic, medium-bodied wines with moderate acidity.'
    },
    {
      name: 'Pinot Noir',
      description: 'A delicate grape creating light-bodied, aromatic wines with high acidity and soft tannins.'
    },
    {
      name: 'Primitivo',
      description: 'A robust grape yielding full-bodied, aromatic wines with natural sweetness and high tannins.'
    },
    {
      name: 'Sauvignon Blanc',
      description: 'A crisp grape variety producing aromatic, light-bodied wines with high acidity.'
    }
  ];

  return (
    <div className="container mx-auto py-6">
      <h1 className="text-3xl font-bold mb-6">Wine-Pedia</h1>
      
      <div className="space-y-6">
        {/* Navigation tabs */}
        <div className="flex space-x-1 border-b">
          {[
            { id: 'grapeVarieties', label: 'Grape Varieties' },
            { id: 'wineRegions', label: 'Wine Regions' },
            { id: 'winemaking', label: 'Winemaking' },
            { id: 'importers', label: 'Importers' }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 text-sm font-medium rounded-t-lg ${
                activeTab === tab.id
                  ? 'bg-blue-50 text-blue-700 border-b-2 border-blue-700'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        
        {/* Content */}
        {activeTab === 'grapeVarieties' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {grapeVarieties.map((grape, index) => (
              <Card 
                key={index} 
                className="hover:shadow-md transition-shadow cursor-pointer"
              >
                <CardHeader className="flex flex-row items-center gap-4 pb-2">
                  <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                    <span className="text-red-700 font-bold">{grape.name.charAt(0)}</span>
                  </div>
                  <CardTitle>{grape.name}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-600">{grape.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
        
        {activeTab === 'wineRegions' && (
          <Card>
            <CardHeader>
              <CardTitle>Wine Regions</CardTitle>
              <CardDescription>Learn about different wine regions around the world</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600">Content coming soon...</p>
            </CardContent>
          </Card>
        )}
        
        {activeTab === 'winemaking' && (
          <Card>
            <CardHeader>
              <CardTitle>Winemaking Process</CardTitle>
              <CardDescription>Understand the steps involved in creating fine wines</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600">Content coming soon...</p>
            </CardContent>
          </Card>
        )}
        
        {activeTab === 'importers' && (
          <Card>
            <CardHeader>
              <CardTitle>Wine Importers Directory</CardTitle>
              <CardDescription>Global wine importers and their relationships</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600">Content coming soon...</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
