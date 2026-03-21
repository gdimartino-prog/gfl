'use client';

import { useState, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { AlertTriangle } from 'lucide-react';

interface ConfirmState {
  message: string;
  title?: string;
  confirmLabel?: string;
  destructive?: boolean;
  resolve: (value: boolean) => void;
}

export function useConfirm() {
  const [state, setState] = useState<ConfirmState | null>(null);
  const resolveRef = useRef<((value: boolean) => void) | null>(null);

  const confirm = useCallback((
    message: string,
    options?: { title?: string; confirmLabel?: string; destructive?: boolean }
  ): Promise<boolean> => {
    return new Promise(resolve => {
      resolveRef.current = resolve;
      setState({ message, ...options, resolve });
    });
  }, []);

  const handleConfirm = () => {
    resolveRef.current?.(true);
    setState(null);
  };

  const handleCancel = () => {
    resolveRef.current?.(false);
    setState(null);
  };

  const ConfirmDialog = () => {
    if (!state) return null;
    return (
      <div className="fixed inset-0 z-[200] flex items-center justify-center">
        <div className="absolute inset-0 bg-black/50" onClick={handleCancel} />
        <div className="relative bg-white rounded-xl shadow-2xl max-w-sm w-full mx-4 p-6">
          <div className="flex items-start gap-3 mb-4">
            {state.destructive && (
              <AlertTriangle className="text-red-500 mt-0.5 shrink-0" size={20} />
            )}
            <div>
              {state.title && (
                <p className="font-black text-slate-900 uppercase tracking-tight text-sm mb-1">{state.title}</p>
              )}
              <p className="text-slate-600 text-sm leading-relaxed">{state.message}</p>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={handleCancel}>
              Cancel
            </Button>
            <Button
              variant={state.destructive ? 'destructive' : 'default'}
              size="sm"
              onClick={handleConfirm}
            >
              {state.confirmLabel ?? 'Confirm'}
            </Button>
          </div>
        </div>
      </div>
    );
  };

  return [confirm, ConfirmDialog] as const;
}
