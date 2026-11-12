const base = process.env.BASE ?? 'http://127.0.0.1:3000';
const tool = process.env.TOOL ?? `sass-${Date.now()}`;
const n = Number(process.env.N ?? 20);
const post = async (path, body) => {
  const r = await fetch(`${base}/${path}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  const text = await r.text();
  return { status: r.status, body: text ? JSON.parse(text) : null };
};
const started = Date.now();
const answers = await Promise.all(Array.from({ length: n }, (_, i) => post('RequestBuild', { target: tool, input: { by: `agent-${i}`, at: Date.now() } })));
const tags = answers.map((a) => (a.status === 200 ? 'BuildStarted' : a.body?._tag ?? `http-${a.status}`));
const count = (t) => tags.filter((x) => x === t).length;
const winner = answers.findIndex((a) => a.status === 200);
const late = await post('RecordBuilt', { target: tool, input: { by: `agent-${(winner + 1) % n}`, hash: 'late', version: 'v', nativeMatchesBundle: true, isolateMatchesNative: true } });
const done = await post('RecordBuilt', { target: tool, input: { by: `agent-${winner}`, hash: 'abc', version: 'sass@1', nativeMatchesBundle: true, isolateMatchesNative: true } });
const after = await post('RequestBuild', { target: tool, input: { by: 'agent-late', at: Date.now() } });
console.log(JSON.stringify({
  tool, callers: n, ms: Date.now() - started,
  started: count('BuildStarted'), waiting: count('AlreadyBuilding'), other: tags.filter((t) => t !== 'BuildStarted' && t !== 'AlreadyBuilding'),
  wrongAgentFinishes: late.body?._tag ?? late.status, rightAgentFinishes: done.status === 200 ? 'Built' : done.body?._tag, laterAsk: after.body?._tag ?? after.status,
  sampleRejection: answers.find((a) => a.status !== 200),
}));
