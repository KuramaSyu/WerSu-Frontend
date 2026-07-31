import React, { type ReactNode } from "react";
import { FeatureFlagName, useFeatureStore } from "../zustand/FeatureStore";

interface FeatureProps {
  name: FeatureFlagName;
  children: ReactNode;
  fallback?: ReactNode;
}

/**
 * Renders `children` when the named flag is on, otherwise renders
 * `fallback` (default: nothing).
 *
 * Useful for hiding experimental UI behind a flag — wrap a block
 * of JSX with `<Feature name={...}>` instead of reading the store
 * at the call site.
 */
export const Feature: React.FC<FeatureProps> = ({
  name,
  children,
  fallback = null,
}) => {
  const enabled = useFeatureStore((state) => state.flags[name]);
  return <>{enabled ? children : fallback}</>;
};
