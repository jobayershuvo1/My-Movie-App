import React from 'react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center rounded-lg font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 disabled:pointer-events-none disabled:opacity-50 cursor-pointer",
          {
            'bg-red-600 text-white hover:bg-red-700 accent-glow': variant === 'primary',
            'glass text-[#E5E5E5] hover:bg-white/10': variant === 'secondary',
            'border border-white/10 bg-transparent text-[#E5E5E5] hover:bg-white/5 hover:text-white': variant === 'outline',
            'bg-transparent text-zinc-400 hover:bg-white/5 hover:text-white': variant === 'ghost',
            'bg-rose-900/50 text-rose-500 hover:bg-rose-900 hover:text-rose-400': variant === 'danger',
            'h-8 px-3 text-xs': size === 'sm',
            'h-10 px-4 py-2 text-sm': size === 'md',
            'h-12 px-8 py-3 text-base': size === 'lg',
          },
          className
        )}
        {...props}
      />
    );
  }
);

Button.displayName = 'Button';
