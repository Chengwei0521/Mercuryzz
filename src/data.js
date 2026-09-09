import { createClient } from '@supabase/supabase-js';

const url = 'https://jgigvgysiykcyclxvjpn.supabase.co';
const key = 'sb_publishable_RIVvsx8W5ejVCHcHJBdTIQ_0kPwH-_k';
const fields = 'id,name,message,latitude,longitude,mood,is_observatory,created_at';
const supabase = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});

export async function fetchSignals() {
  const { data, count, error } = await supabase
    .from('observatory_signals')
    .select(fields, { count: 'exact' })
    .order('id', { ascending: false })
    .limit(100)
    .abortSignal(AbortSignal.timeout(12000));
  if (error) throw error;
  return { signals: data, count };
}

export async function fetchSignal(id) {
  const { data, error } = await supabase.from('observatory_signals').select(fields).eq('id', id).single().abortSignal(AbortSignal.timeout(12000));
  if (error) throw error;
  return data;
}

export async function sendSignal(signal) {
  let visitor;
  try {
    visitor = localStorage.getItem('mercury-visitor');
    if (!visitor || !/^[0-9a-f-]{36}$/i.test(visitor)) {
      visitor = crypto.randomUUID();
      localStorage.setItem('mercury-visitor', visitor);
    }
  } catch {
    visitor = crypto.randomUUID();
  }
  const { data, error } = await supabase.from('observatory_signals')
    .insert({ ...signal, visitor_id: visitor })
    .select(fields).single().abortSignal(AbortSignal.timeout(15000));
  if (error) throw error;
  return data;
}

export function subscribeSignals(onSignal, onStatus) {
  const channel = supabase.channel('observatory-public-signals')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'observatory_signals' }, ({ new: signal }) => onSignal(signal))
    .subscribe(onStatus);
  return () => supabase.removeChannel(channel);
}
