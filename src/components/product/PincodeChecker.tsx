'use client';

import { useState } from 'react';

import { TextInput } from '@/components/ui/Field';
import { Alert } from '@/components/ui/StateBlocks';

/**
 * PIN-code serviceability check.
 *
 * Honest states only:
 *  - SERVICEABLE → "We deliver to this PIN code"
 *  - UNSERVICEABLE → the courier/admin list rejected it
 *  - UNKNOWN → we could not confirm; the customer is told to continue
 *
 * It never prints a delivery *date* unless the courier returned one.
 */
export function PincodeChecker({
  weightGrams,
  compact = false,
}: {
  weightGrams?: number;
  compact?: boolean;
}) {
  const [pincode, setPincode] = useState('');
  const [state, setState] = useState<
    | { status: 'idle' }
    | { status: 'loading' }
    | {
        status: 'result';
        serviceability: 'SERVICEABLE' | 'UNSERVICEABLE' | 'UNKNOWN';
        message: string;
        estimatedDeliveryDays: number | null;
        error?: boolean;
      }
  >({ status: 'idle' });

  async function check(e: React.FormEvent) {
    e.preventDefault();
    const value = pincode.trim();
    if (!/^\d{6}$/.test(value)) return;

    setState({ status: 'loading' });
    try {
      const res = await fetch('/api/serviceability', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pincode: value, weightGrams }),
      });
      const json = (await res.json()) as {
        ok: boolean;
        error?: string;
        data?: {
          serviceability: 'SERVICEABLE' | 'UNSERVICEABLE' | 'UNKNOWN';
          message: string;
          estimatedDeliveryDays: number | null;
        };
      };

      if (!json.ok || !json.data) {
        setState({
          status: 'result',
          serviceability: 'UNKNOWN',
          message: json.error ?? 'We could not check that PIN code right now.',
          estimatedDeliveryDays: null,
          error: true,
        });
        return;
      }

      setState({
        status: 'result',
        serviceability: json.data.serviceability,
        message: json.data.message,
        estimatedDeliveryDays: json.data.estimatedDeliveryDays,
      });
    } catch {
      setState({
        status: 'result',
        serviceability: 'UNKNOWN',
        message: 'We could not reach the delivery service. Please try again.',
        estimatedDeliveryDays: null,
        error: true,
      });
    }
  }

  return (
    <div>
      <form onSubmit={check}>
        {!compact ? (
          <p className="nc-label" id="pincode-label">
            Check delivery to your PIN code
          </p>
        ) : null}
        <div className="flex gap-2">
          <TextInput
            label="6-digit PIN code"
            hideLabel
            name="pincode"
            inputMode="numeric"
            autoComplete="postal-code"
            pattern="\d{6}"
            maxLength={6}
            placeholder="6-digit PIN"
            value={pincode}
            onChange={(e) => setPincode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            className="flex-1"
            inputClassName=""
          />
          <button
            type="submit"
            className="nc-btn-outline nc-btn-sm shrink-0"
            disabled={state.status === 'loading' || pincode.length !== 6}
          >
            {state.status === 'loading' ? 'Checking…' : 'Check'}
          </button>
        </div>
      </form>

      {state.status === 'result' ? (
        <div className="mt-3">
          <Alert
            tone={
              state.serviceability === 'SERVICEABLE'
                ? 'success'
                : state.serviceability === 'UNSERVICEABLE'
                  ? 'error'
                  : state.error
                    ? 'error'
                    : 'warning'
            }
          >
            <p>{state.message}</p>
            {state.estimatedDeliveryDays ? (
              <p className="mt-1 text-xs opacity-90">
                Estimated delivery: about {state.estimatedDeliveryDays} day
                {state.estimatedDeliveryDays === 1 ? '' : 's'} after dispatch.
              </p>
            ) : null}
          </Alert>
        </div>
      ) : null}
    </div>
  );
}