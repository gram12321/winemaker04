import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "../ui/card";
import { Button } from "../ui/button";
import { notificationService } from "../layout/NotificationCenter";

interface SettingsProps {
  view?: string;
}

export default function Settings({ view }: SettingsProps) {
  const [showNotifications, setShowNotifications] = useState(true);
  const [isSaved, setIsSaved] = useState(false);

  useEffect(() => {
    // Load saved settings from localStorage
    const saved = localStorage.getItem('showNotifications') !== 'false'; // Default to true
    setShowNotifications(saved);
  }, []);

  const handleSaveSettings = () => {
    // Save settings to localStorage
    localStorage.setItem('showNotifications', showNotifications.toString());
    
    // Show saved message
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2000);
    
    // Show a console message
    notificationService.info('Settings saved successfully');
  };

  // Test console functionality
  const testNotifications = () => {
    notificationService.info('This is a test info message');
    setTimeout(() => notificationService.warning('This is a warning message'), 500);
    setTimeout(() => notificationService.error('This is an error message'), 1000);
  };

  // If this view is not active, don't render anything
  if (view && view !== 'settings') return null;

  return (
    <div className="container mx-auto py-6">
      <h1 className="text-3xl font-bold mb-6">Settings</h1>
      
      <Card className="max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle>Game Settings</CardTitle>
          <CardDescription>Customize your winery management experience</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <h3 className="text-lg font-medium">Display Options</h3>
            
            <div className="flex items-center justify-between">
              <div>
                <label className="text-base font-medium">Show Notifications</label>
                <p className="text-sm text-gray-500">Display toast notifications on screen</p>
              </div>
              <input 
                type="checkbox"
                checked={showNotifications} 
                onChange={(e) => setShowNotifications(e.target.checked)}
                className="w-4 h-4"
              />
            </div>
          </div>
        </CardContent>
        <CardFooter className="flex justify-between">
          {isSaved && <p className="text-green-600">Settings saved successfully!</p>}
          <div className="space-x-2 ml-auto">
            <Button variant="outline" onClick={testNotifications}>Test Notifications</Button>
            <Button onClick={handleSaveSettings}>Save Settings</Button>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}
