import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Switch } from '../ui/switch';
import { Label } from '../ui/label';
import { Settings as SettingsIcon, Bell } from 'lucide-react';
import { Company } from '@/lib/services/companyService';

interface SettingsProps {
  currentCompany?: Company | null;
  onBack?: () => void;
  onSignOut?: () => void;
}

interface SimpleSettings {
  showNotifications: boolean;
}

export function Settings({ currentCompany, onBack }: SettingsProps) {
  const [settings, setSettings] = useState<SimpleSettings>({
    showNotifications: true
  });
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    // Load settings from localStorage
    if (currentCompany) {
      loadLocalSettings();
    }
  }, [currentCompany]);

  const loadLocalSettings = () => {
    try {
      const key = `settings_${currentCompany?.id}`;
      const stored = localStorage.getItem(key);
      
      if (stored) {
        const parsed = JSON.parse(stored);
        setSettings(prev => ({ ...prev, ...parsed }));
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  };

  const saveSettings = async (updates: Partial<SimpleSettings>) => {
    if (!currentCompany) return;

    setIsSaving(true);
    try {
      const updatedSettings = { ...settings, ...updates };
      
      // Save to localStorage
      const key = `settings_${currentCompany.id}`;
      localStorage.setItem(key, JSON.stringify(updatedSettings));
      
      setSettings(updatedSettings);
    } catch (error) {
      console.error('Error saving settings:', error);
    } finally {
      setTimeout(() => setIsSaving(false), 500); // Brief delay to show saving state
    }
  };

  const handleNotificationToggle = async (checked: boolean) => {
    await saveSettings({ showNotifications: checked });
  };


  if (!currentCompany) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>No Active Company</CardTitle>
            <CardDescription>
              You need to select a company to access settings
            </CardDescription>
          </CardHeader>
          <CardContent>
            {onBack && (
              <Button onClick={onBack} className="w-full">
                Back
              </Button>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-gray-800 flex items-center gap-3">
            <SettingsIcon className="h-8 w-8" />
            Settings
          </h2>
          <p className="text-muted-foreground mt-1">
            Configure your game preferences for {currentCompany.name}
          </p>
        </div>
        {onBack && (
          <Button variant="outline" onClick={onBack}>
            Back
          </Button>
        )}
      </div>

        <div className="space-y-6">
          {/* Notifications */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5" />
                Notifications
              </CardTitle>
              <CardDescription>
                Control popup notifications and alerts
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Show Notifications</Label>
                  <p className="text-sm text-muted-foreground">
                    Enable or disable popup notifications
                  </p>
                </div>
                <Switch
                  checked={settings.showNotifications}
                  onCheckedChange={handleNotificationToggle}
                  disabled={isSaving}
                />
              </div>
            </CardContent>
          </Card>

      </div>

      {/* Save Status */}
      {isSaving && (
        <div className="fixed bottom-4 right-4">
          <Card>
            <CardContent className="p-3">
              <div className="flex items-center gap-2 text-sm">
                <SettingsIcon className="h-4 w-4 animate-spin" />
                Saving settings...
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}