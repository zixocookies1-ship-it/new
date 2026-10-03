'use server';

import { integrationState, integrationLabels } from './env';

export interface IntegrationCheck {
  key: string;
  label: string;
  state: 'configured' | 'missing';
  hint: string;
}

export function getIntegrationChecklist(): IntegrationCheck[] {
  const keys = ['mongo', 'cloudinary', 'razorpay', 'delhivery', 'auth'] as const;
  return keys.map((key) => {
    const state = integrationState(key);
    return {
      key,
      label: integrationLabels[key],
      state,
      hint: state === 'missing'
        ? `Add ${key} to .env.local to enable this integration.`
        : 'Configured',
    };
  });
}