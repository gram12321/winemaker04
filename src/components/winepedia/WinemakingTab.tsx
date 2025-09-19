import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui';

export function WinemakingTab() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Winemaking Process</CardTitle>
        <CardDescription>Understand the steps involved in creating fine wines</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-gray-600">Content coming soon...</p>
      </CardContent>
    </Card>
  );
}
