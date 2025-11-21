import { Card, Button } from '@/components/ui';
import { createActivity } from '@/lib/services/activity';
import { WorkCategory } from '@/lib/types/types';

export function ResearchPanel() {
      const handleTestResearch = async () => {
            await createActivity({
                  category: WorkCategory.ADMINISTRATION_AND_RESEARCH,
                  title: 'Test Research Grant',
                  totalWork: 100,
                  params: {
                        type: 'research'
                  }
            });
      };

      return (
            <div className="space-y-6">
                  <Card className="p-6">
                        <h2 className="text-xl font-semibold text-gray-800 mb-4">Research</h2>
                        <div className="space-y-4">
                              <p className="text-gray-600">
                                    Start research projects to unlock new technologies and grants.
                              </p>
                              <Button onClick={handleTestResearch}>
                                    Start Test Research (Grant)
                              </Button>
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
