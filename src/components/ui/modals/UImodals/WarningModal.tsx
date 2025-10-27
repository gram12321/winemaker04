import React from 'react';
import { Button } from '@/components/ui';
import { AlertTriangle, AlertCircle, XCircle, Info } from 'lucide-react';

export type WarningSeverity = 'info' | 'warning' | 'error' | 'critical';

export interface WarningModalAction {
  label: string;
  onClick: () => void;
  variant?: 'default' | 'destructive' | 'outline';
}

export interface WarningModalProps {
  isOpen: boolean;
  onClose: () => void;
  severity: WarningSeverity;
  title: string;
  message: string;
  details?: string;
  actions?: WarningModalAction[];
}

/**
 * Generic Warning Modal Component
 * Used for critical notifications that require user acknowledgment
 * Blocks interaction with the rest of the app until acknowledged
 */
export const WarningModal: React.FC<WarningModalProps> = ({
  isOpen,
  onClose,
  severity,
  title,
  message,
  details,
  actions
}) => {
  if (!isOpen) return null;

  // Severity-based styling
  const getSeverityConfig = () => {
    switch (severity) {
      case 'info':
        return {
          bgColor: 'bg-blue-900',
          borderColor: 'border-blue-500',
          textColor: 'text-blue-100',
          icon: <Info className="h-12 w-12 text-blue-400" />,
          iconBg: 'bg-blue-800'
        };
      case 'warning':
        return {
          bgColor: 'bg-yellow-900',
          borderColor: 'border-yellow-500',
          textColor: 'text-yellow-100',
          icon: <AlertTriangle className="h-12 w-12 text-yellow-400" />,
          iconBg: 'bg-yellow-800'
        };
      case 'error':
        return {
          bgColor: 'bg-orange-900',
          borderColor: 'border-orange-500',
          textColor: 'text-orange-100',
          icon: <AlertCircle className="h-12 w-12 text-orange-400" />,
          iconBg: 'bg-orange-800'
        };
      case 'critical':
        return {
          bgColor: 'bg-red-900',
          borderColor: 'border-red-500',
          textColor: 'text-red-100',
          icon: <XCircle className="h-12 w-12 text-red-400" />,
          iconBg: 'bg-red-800'
        };
    }
  };

  const config = getSeverityConfig();

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-[100] p-4">
      <div className={`${config.bgColor} rounded-lg shadow-2xl w-full max-w-md border-2 ${config.borderColor} animate-in fade-in zoom-in duration-200`}>
        {/* Icon Header */}
        <div className="flex justify-center pt-8 pb-4">
          <div className={`${config.iconBg} rounded-full p-4`}>
            {config.icon}
          </div>
        </div>

        {/* Content */}
        <div className="px-8 pb-6 text-center">
          <h2 className={`text-2xl font-bold mb-4 ${config.textColor}`}>
            {title}
          </h2>
          <p className="text-gray-300 text-base mb-4 leading-relaxed">
            {message}
          </p>
          {details && (
            <div className="bg-black bg-opacity-30 rounded-lg p-4 mt-4 text-left">
              <p className="text-sm text-gray-400 whitespace-pre-line">
                {details}
              </p>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="px-8 pb-8 flex gap-3 justify-center">
          {actions && actions.length > 0 ? (
            actions.map((action, index) => (
              <Button
                key={index}
                onClick={() => {
                  action.onClick();
                  onClose();
                }}
                variant={action.variant || 'default'}
                className={
                  action.variant === 'destructive'
                    ? 'bg-red-600 hover:bg-red-700 text-white'
                    : action.variant === 'outline'
                    ? 'bg-transparent border-2 border-gray-600 text-gray-300 hover:bg-gray-800'
                    : 'bg-green-600 hover:bg-green-700 text-white'
                }
              >
                {action.label}
              </Button>
            ))
          ) : (
            <Button
              onClick={onClose}
              className="bg-green-600 hover:bg-green-700 text-white min-w-[120px]"
            >
              Acknowledge
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

