import React from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { Button } from './Button';

interface ConfirmationModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'primary';
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmationModal({
  isOpen,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'danger',
  onConfirm,
  onCancel
}: ConfirmationModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/80 backdrop-blur-sm animate-fade-in" 
        onClick={onCancel}
      />
      
      {/* Content Card */}
      <div 
        className="relative w-full max-w-md overflow-hidden rounded-2xl border border-white/5 bg-[#121214] p-6 shadow-2xl animate-scale-in"
        role="dialog"
        aria-modal="true"
      >
        {/* Close Button */}
        <button 
          onClick={onCancel}
          className="absolute right-4 top-4 rounded-lg p-1.5 text-zinc-400 hover:bg-white/5 hover:text-white transition-colors cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex gap-4 items-start mt-1">
          {/* Warning Icon Circle */}
          <div className={`rounded-xl p-3 shrink-0 ${
            variant === 'danger' 
              ? 'bg-rose-500/10 text-rose-500' 
              : variant === 'warning'
              ? 'bg-amber-500/10 text-amber-500'
              : 'bg-red-500/10 text-red-500'
          }`}>
            <AlertTriangle className="w-6 h-6" />
          </div>

          <div className="space-y-2">
            <h3 className="text-base font-bold text-white leading-snug">
              {title}
            </h3>
            <p className="text-xs text-zinc-400 leading-relaxed">
              {message}
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-3 mt-6 pt-4 border-t border-white/5">
          <Button 
            variant="ghost" 
            onClick={onCancel} 
            size="sm"
            className="text-xs font-semibold px-4"
          >
            {cancelText}
          </Button>
          <Button 
            variant={variant === 'danger' ? 'danger' : 'primary'} 
            onClick={() => {
              onConfirm();
              onCancel();
            }} 
            size="sm"
            className="text-xs font-bold px-4"
          >
            {confirmText}
          </Button>
        </div>
      </div>
    </div>
  );
}
