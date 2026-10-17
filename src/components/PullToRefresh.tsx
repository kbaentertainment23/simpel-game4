import React from 'react';

export interface PullToRefreshProps {
  onRefresh?: () => Promise<void> | void;
  disabled?: boolean;
  children: React.ReactNode;
}

/**
 * Pass-through component. Custom pull-to-refresh has been disabled
 * in favor of the browser's native pull-to-refresh / reload functionality.
 */
export const PullToRefresh: React.FC<PullToRefreshProps> = ({ children }) => {
  return <>{children}</>;
};
