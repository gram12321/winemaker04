import { useState, useEffect } from 'react';
import { WarningModal } from '@/components/ui';
import { PendingLoanWarning } from '@/lib/types/types';
import { getFirstUnacknowledgedLoanWarning, acknowledgeLoanWarning } from '@/lib/database/core/loansDB';

/**
 * Display loan warning modals from database only
 * This component loads unacknowledged warnings from database on startup
 * Modal is dismissed by acknowledging the warning in database
 */
export function LoanWarningModalDisplay() {
  const [warning, setWarning] = useState<PendingLoanWarning | null>(null);
  const [warningId, setWarningId] = useState<string | null>(null);

  // Load unacknowledged warnings from database on startup
  useEffect(() => {
    const loadWarnings = async () => {
      try {
        const warning = await getFirstUnacknowledgedLoanWarning();
        
        if (warning) {
          setWarning(warning);
          setWarningId(warning.loanId);
        } else {
          setWarning(null);
          setWarningId(null);
        }
      } catch (error) {
        setWarning(null);
        setWarningId(null);
      }
    };

    loadWarnings();
  }, []);

  // Listen for new loan warnings (check every 2 seconds)
  useEffect(() => {
    const interval = setInterval(async () => {
      // Only check if we don't already have a warning showing
      if (!warning) {
        try {
          const newWarning = await getFirstUnacknowledgedLoanWarning();
          if (newWarning) {
            setWarning(newWarning);
            setWarningId(newWarning.loanId);
          }
        } catch (error) {
          // Silently handle errors to avoid console spam
        }
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [warning]);

  const handleClose = async () => {
    try {
      // Acknowledge warning in database if it has an ID
      if (warningId) {
        await acknowledgeLoanWarning(warningId);
      }
      
      // Clear local state
      setWarning(null);
      setWarningId(null);
    } catch (error) {
      // Still clear the warning from UI even if database update fails
      setWarning(null);
      setWarningId(null);
    }
  };

  if (!warning) return null;

  return (
    <WarningModal
      isOpen={true}
      onClose={handleClose}
      severity={warning.severity}
      title={warning.title}
      message={warning.message}
      details={warning.details}
    />
  );
}

