import { BoardRoomPanel } from '@/components/finance/BoardRoomPanel';
import { ShareManagementPanel } from '@/components/finance/ShareManagementPanel';
import { ShareMarketTab } from '@/components/pages/winepedia/ShareMarketTab';
import type { BoardShareFeature } from './contracts';
import { activeBoardShareRuntimeFeature } from './runtime';

export const activeBoardShareFeature: BoardShareFeature = {
  ...activeBoardShareRuntimeFeature,

  ui: {
    getFinanceTabs() {
      return [
        {
          id: 'shares',
          label: 'Shares',
          activeLabel: 'Share Management',
          render: () => <ShareManagementPanel />
        },
        {
          id: 'board',
          label: 'Board Room',
          activeLabel: 'Board Room',
          render: () => <BoardRoomPanel />
        }
      ];
    },

    getWinepediaTabs() {
      return [
        {
          id: 'shareMarket',
          label: 'Share Market',
          component: ShareMarketTab
        }
      ];
    },

    registerAppEventListeners(handlers) {
      const handleNavigateToWinepedia = () => handlers.navigateToWinepedia();
      window.addEventListener('navigateToWinepedia', handleNavigateToWinepedia);

      return () => {
        window.removeEventListener('navigateToWinepedia', handleNavigateToWinepedia);
      };
    }
  }
};
