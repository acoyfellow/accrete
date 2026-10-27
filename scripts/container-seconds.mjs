import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';

const ACCOUNT = 'bfcb6ac5b3ceaf42a09607f6f7925823';
const APPLICATION = process.env.ACCRETE_BUILDER_APP ?? 'a039b6f7-166f-4755-9c42-86fbd6ebb772';

const token = () => {
  if (process.env.CLOUDFLARE_PERSONAL_API_TOKEN) return process.env.CLOUDFLARE_PERSONAL_API_TOKEN;
  const config = readFileSync(`${homedir()}/.wrangler/config/default.toml`, 'utf8');
  const value = /oauth_token = "([^"]+)"/.exec(config)?.[1];
  if (!value) throw new Error('no wrangler token');
  return value;
};

const QUERY = `query($account: String!, $application: String!, $since: Time!, $until: Time!) { viewer { accounts(filter: {accountTag: $account}) {
  containersMetricsAdaptiveGroups(limit: 1000, filter: {applicationId: $application, datetimeMinute_geq: $since, datetimeMinute_leq: $until}) {
    sum { allocatedCpu containerUptime cpuTimeSec }
    dimensions { datetimeMinute instanceId }
  } } } }`;

export const containerSeconds = async (since, until) => {
  const response = await fetch('https://api.cloudflare.com/client/v4/graphql', {
    method: 'POST',
    headers: { authorization: `Bearer ${token()}`, 'content-type': 'application/json' },
    body: JSON.stringify({ query: QUERY, variables: { account: ACCOUNT, application: APPLICATION, since, until } }),
    signal: AbortSignal.timeout(30_000),
  });
  const body = await response.json();
  if (body.errors?.some((error) => error.extensions?.code === 'budget')) return null;
  if (body.errors) throw new Error(`graphql: ${JSON.stringify(body.errors).slice(0, 400)}`);
  const groups = body.data.viewer.accounts[0]?.containersMetricsAdaptiveGroups ?? [];
  const allocatedVcpuSeconds = groups.reduce((sum, group) => sum + group.sum.allocatedCpu, 0);
  const cpuSeconds = groups.reduce((sum, group) => sum + group.sum.cpuTimeSec, 0);
  const uptimeSeconds = groups.reduce((sum, group) => sum + group.sum.containerUptime, 0) / 1000;
  return { seconds: Math.max(allocatedVcpuSeconds, uptimeSeconds), allocatedVcpuSeconds, uptimeSeconds, cpuSeconds, groups: groups.length };
};

const floorMinute = (iso) => `${iso.slice(0, 16)}:00Z`;

if (import.meta.url === `file://${process.argv[1]}`) {
  const since = process.argv[2] ?? new Date(Date.now() - 3600_000).toISOString();
  const until = process.argv[3] ?? new Date().toISOString();
  console.log(JSON.stringify(await containerSeconds(floorMinute(since), floorMinute(until))));
}

export { floorMinute };
