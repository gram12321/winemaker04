// Shared component interfaces for consistency across the application

// Common page component props
export interface PageProps {
  onBack?: () => void;
  onNavigate?: (page: string) => void;
}

// Navigation-related props
export interface NavigationProps {
  onNavigate?: (page: string) => void;
  onNavigateToWinepedia?: () => void;
  onNavigateToLogin?: () => void;
}

// Company-related props
export interface CompanyProps {
  currentCompany?: any | null;
  currentCompanyId?: string;
  onCompanySelected?: (company: any) => void;
}

// Dialog component props
export interface DialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit?: (data: any) => void;
}

// Form component props
export interface FormProps {
  onSubmit: (data: any) => void;
  onCancel?: () => void;
  isLoading?: boolean;
}

// Table component props
export interface TableProps {
  data: any[];
  columns: any[];
  sortable?: boolean;
  onRowClick?: (row: any) => void;
}

// Loading state props
export interface LoadingProps {
  isLoading: boolean;
  error?: string | null;
  children?: React.ReactNode;
}

// Card component props
export interface CardProps {
  title?: string;
  description?: string;
  children?: React.ReactNode;
  className?: string;
}

// Button variant types
export type ButtonVariant = 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link';
export type ButtonSize = 'default' | 'sm' | 'lg' | 'icon';

// Common action types
export type ActionType = 'create' | 'edit' | 'delete' | 'view' | 'submit' | 'cancel';

// Status types
export type StatusType = 'success' | 'error' | 'warning' | 'info' | 'loading';

// Common component props with consistent naming
export interface BaseComponentProps {
  className?: string;
  children?: React.ReactNode;
  disabled?: boolean;
  loading?: boolean;
}

// Export all interfaces for easy importing
export * from './UItypes';
