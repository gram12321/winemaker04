import { useState, useEffect } from 'react';
import { useLoadingState } from '@/hooks';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, Button, Switch, Label, Badge } from '../ui';
import { Settings as SettingsIcon, Bell, Shield, Filter, Trash2, RotateCcw } from 'lucide-react';
import { PageProps, CompanyProps } from '../../lib/types/UItypes';
import { notificationService } from '@/lib/services/core/notificationService';
import { toast } from '@/lib/utils/toast';

interface SettingsProps extends PageProps, CompanyProps {
  onSignOut?: () => void;
}

interface SimpleSettings {
  showNotifications: boolean;
}

interface NotificationFilter {
  id: string;
  type: 'origin' | 'category';
  value: string;
  description?: string;
  blockFromHistory?: boolean;
  createdAt: string;
}

export function Settings({ currentCompany, onBack, onSignOut }: SettingsProps) {
  const { isLoading, withLoading } = useLoadingState();
  const [settings, setSettings] = useState<SimpleSettings>({
    showNotifications: true
  });
  const [notificationFilters, setNotificationFilters] = useState<NotificationFilter[]>([]);

  useEffect(() => {
    // Load settings from localStorage
    if (currentCompany) {
      loadLocalSettings();
      loadNotificationFilters();
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

  const loadNotificationFilters = () => {
    try {
      const filters = notificationService.getFilters();
      setNotificationFilters(filters as NotificationFilter[]);
    } catch (error) {
      console.error('Error loading notification filters:', error);
    }
  };

  const saveSettings = (updates: Partial<SimpleSettings>) => withLoading(async () => {
    if (!currentCompany) return;

    const updatedSettings = { ...settings, ...updates };
    
    // Save to localStorage
    const key = `settings_${currentCompany.id}`;
    localStorage.setItem(key, JSON.stringify(updatedSettings));
    
    setSettings(updatedSettings);
  });

  const handleNotificationToggle = (checked: boolean) => {
    saveSettings({ showNotifications: checked });
  };

  const handleRemoveFilter = (filterId: string) => {
    try {
      notificationService.removeFilter(filterId);
      loadNotificationFilters();
      toast({
        title: "Filter Removed",
        description: "Notification filter has been removed",
        variant: "default"
      });
    } catch (error) {
      console.error('Error removing filter:', error);
      toast({
        title: "Error",
        description: "Failed to remove filter",
        variant: "destructive"
      });
    }
  };

  const handleClearAllFilters = () => {
    try {
      notificationService.clearFilters();
      loadNotificationFilters();
      toast({
        title: "Filters Cleared",
        description: "All notification filters have been removed. You will now receive all notifications.",
        variant: "default"
      });
    } catch (error) {
      console.error('Error clearing filters:', error);
      toast({
        title: "Error",
        description: "Failed to clear filters",
        variant: "destructive"
      });
    }
  };

  const handleToggleBlockFromHistory = (filterId: string, currentValue: boolean) => {
    try {
      // Update the filter with the new blockFromHistory value
      notificationService.updateFilter(filterId, {
        blockFromHistory: !currentValue
      });
      
      // Reload filters to refresh UI
      loadNotificationFilters();
      
      toast({
        title: "Filter Updated",
        description: !currentValue 
          ? "This notification will now be completely silenced (no history)" 
          : "This notification will now appear in history (but no toast)",
        variant: "default"
      });
    } catch (error) {
      console.error('Error toggling filter:', error);
      toast({
        title: "Error",
        description: "Failed to update filter",
        variant: "destructive"
      });
    }
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
        <div className="flex gap-2">
          {onBack && (
            <Button variant="outline" onClick={onBack}>
              Back
            </Button>
          )}
          {onSignOut && (
            <Button variant="destructive" onClick={onSignOut}>
              Sign Out
            </Button>
          )}
        </div>
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
                  disabled={isLoading}
                />
              </div>
            </CardContent>
          </Card>

          {/* Notification Filters */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Filter className="h-5 w-5" />
                    Notification Filters
                  </CardTitle>
                  <CardDescription>
                    Manage blocked notification sources and categories
                  </CardDescription>
                </div>
                {notificationFilters.length > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleClearAllFilters}
                    className="gap-2"
                  >
                    <RotateCcw className="h-4 w-4" />
                    Reset to Default
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {notificationFilters.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Filter className="h-12 w-12 mx-auto mb-3 opacity-20" />
                  <p className="font-medium">No notification filters active</p>
                  <p className="text-sm mt-1">
                    You're receiving all notifications. Use the Shield icon on notifications to block specific sources or categories.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {notificationFilters.map((filter) => (
                    <div
                      key={filter.id}
                      className="p-3 border rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3 flex-1">
                          {filter.type === 'origin' ? (
                            <Shield className="h-5 w-5 text-orange-600" />
                          ) : (
                            <Filter className="h-5 w-5 text-purple-600" />
                          )}
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <Badge variant={filter.type === 'origin' ? 'secondary' : 'outline'}>
                                {filter.type === 'origin' ? 'Origin' : 'Category'}
                              </Badge>
                              <span className="font-medium text-sm">{filter.value}</span>
                            </div>
                            {filter.description && (
                              <p className="text-xs text-muted-foreground">
                                {filter.description}
                              </p>
                            )}
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveFilter(filter.id)}
                          className="text-red-600 hover:text-red-800 hover:bg-red-50"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                      
                      {/* Block from history toggle */}
                      <div className="flex items-center justify-between pl-8 pt-2 border-t">
                        <div className="space-y-0.5">
                          <Label className="text-xs font-medium">
                            {filter.blockFromHistory ? '🔇 Completely Silenced' : '📝 Saved to History'}
                          </Label>
                          <p className="text-xs text-muted-foreground">
                            {filter.blockFromHistory 
                              ? 'Not shown as toast and not saved in notification history' 
                              : 'Hidden from toasts but still saved in notification history'}
                          </p>
                        </div>
                        <Switch
                          checked={filter.blockFromHistory ?? false}
                          onCheckedChange={() => handleToggleBlockFromHistory(filter.id, filter.blockFromHistory ?? false)}
                          disabled={isLoading}
                        />
                      </div>
                    </div>
                  ))}
                  <div className="text-xs text-muted-foreground mt-4 p-3 bg-blue-50 rounded-md border border-blue-100">
                    <p className="font-medium mb-1">💡 Tip:</p>
                    <p>
                      By default, blocked notifications are hidden from toasts but still saved in notification history. 
                      Use the toggle to completely silence them (no toast + no history). 
                      Click the trash icon to re-enable specific notifications.
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

      </div>

      {/* Save Status */}
      {isLoading && (
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