/**
 * Offline BPM validation harness.
 *
 * Decodes local library files with ffmpeg, runs the SAME analyzeBpm() the
 * extension ships, and diffs the result against rekordbox's analyzed BPM
 * (ground-truth.tsv, produced by export-ground-truth.sh). Reports accuracy so
 * the algorithm can be tuned before it's wired into the UI.
 *
 * The extension decodes the Bandcamp mp3 stream via Web Audio decodeAudioData;
 * here we decode local flac/mp3 via ffmpeg. BPM is decoder-invariant, so the
 * PCM source doesn't matter -- only that analyzeBpm() is identical.
 *
 * Run: pnpm bpm:validate            (samples ~120 tracks; set LIMIT=0 for all)
 *      LIMIT=300 pnpm bpm:validate
 */
import {spawnSync} from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import {fileURLToPath} from 'node:url';
import {analyzeBpm} from '../../src/app/utils/bpm/analyze-bpm';
import type {BpmAnalysisOptions} from '../../src/app/utils/bpm/types';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const GT_PATH = path.join(HERE, 'ground-truth.tsv');
const SAMPLE_FILE = path.join(HERE, 'sample.tsv');
const LIBRARY = path.join(os.homedir(), 'Library/Mobile Documents/com~apple~CloudDocs/music_library');
const TARGET_SR = process.env.SR ? parseInt(process.env.SR, 10) : 22050; // mirror the extension's decode rate
const DECODE_SECONDS = 150; // cap decode cost; analyzeBpm windows the middle 60s
const LIMIT = process.env.LIMIT !== undefined ? parseInt(process.env.LIMIT, 10) : 120;
const CONF = process.env.CONF !== undefined ? parseFloat(process.env.CONF) : undefined;
const OPTS: Record<string, number | boolean> = {};
if (CONF !== undefined) {
  OPTS.confidenceThreshold = CONF;
}
if (process.env.COMB !== undefined) {
  OPTS.useComb = process.env.COMB === '1';
}
if (process.env.PREF !== undefined) {
  OPTS.prefBpm = parseFloat(process.env.PREF);
}
if (process.env.SIGMA !== undefined) {
  OPTS.priorSigma = parseFloat(process.env.SIGMA);
}

interface GroundTruthRow {
  trueBpm: number;
  folderPath: string;
}

function loadGroundTruth(): GroundTruthRow[] {
  if (!fs.existsSync(GT_PATH)) {
    console.error(`Missing ${GT_PATH}. Run tools/bpm-harness/export-ground-truth.sh first.`);
    process.exit(1);
  }
  const rows: GroundTruthRow[] = [];
  for (const line of fs.readFileSync(GT_PATH, 'utf8').split('\n')) {
    if (!line.trim()) {
      continue;
    }
    const tab = line.indexOf('\t');
    if (tab < 0) {
      continue;
    }
    const bpmX100 = parseInt(line.slice(0, tab), 10);
    const folderPath = line.slice(tab + 1);
    if (!Number.isFinite(bpmX100) || bpmX100 <= 0) {
      continue;
    }
    rows.push({trueBpm: bpmX100 / 100, folderPath});
  }
  return rows;
}

/** basename(lowercased) -> absolute paths, for resolving stale rekordbox paths. */
function indexLibrary(): Map<string, string[]> {
  const index = new Map<string, string[]>();
  const walk = (dir: string): void => {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, {withFileTypes: true});
    } catch {
      return;
    }
    for (const e of entries) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) {
        walk(full);
      } else if (/\.(flac|mp3|wav|aif|aiff|m4a)$/i.test(e.name)) {
        const key = e.name.toLowerCase();
        const list = index.get(key);
        if (list) {
          list.push(full);
        } else {
          index.set(key, [full]);
        }
      }
    }
  };
  if (fs.existsSync(LIBRARY)) {
    walk(LIBRARY);
  }
  return index;
}

/** Resolve a ground-truth row to a real on-disk file (exact path, else unique basename). */
function resolveFile(row: GroundTruthRow, index: Map<string, string[]>): string | null {
  if (row.folderPath && fs.existsSync(row.folderPath)) {
    return row.folderPath;
  }
  const base = path.basename(row.folderPath).toLowerCase();
  const matches = index.get(base);
  if (matches && matches.length === 1) {
    return matches[0];
  }
  return null; // skip ambiguous/missing rather than guess
}

function decodePcm(file: string): Float32Array | null {
  const res = spawnSync(
    'ffmpeg',
    ['-v', 'quiet', '-t', String(DECODE_SECONDS), '-i', file, '-ac', '1', '-ar', String(TARGET_SR), '-f', 'f32le', '-'],
    {maxBuffer: 512 * 1024 * 1024},
  );
  if (res.status !== 0 || !res.stdout || res.stdout.length < 4) {
    return null;
  }
  const buf = res.stdout;
  const usable = Math.floor(buf.length / 4) * 4;
  const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + usable);
  return new Float32Array(ab);
}

interface Outcome {
  name: string;
  trueBpm: number;
  detected: number | null;
  raw: number | undefined;
  confidence: number;
  klass: 'exact' | 'within2' | 'octave' | 'wrong' | 'null';
}

function classify(trueBpm: number, detected: number | null): Outcome['klass'] {
  if (detected === null) {
    return 'null';
  }
  const err = Math.abs(detected - trueBpm);
  if (err <= 1) {
    return 'exact';
  }
  if (err <= 2) {
    return 'within2';
  }
  const halfErr = Math.abs(detected - trueBpm / 2);
  const doubleErr = Math.abs(detected - trueBpm * 2);
  if (halfErr <= 2 || doubleErr <= 2) {
    return 'octave';
  }
  return 'wrong';
}

/**
 * Build the work list. The library lives in iCloud, so file resolvability and
 * decodability drift between runs as files are evicted/materialized -- which
 * silently shifts an evenly-spaced sample and makes A/B tuning meaningless. So
 * we freeze a decodable sample to sample.tsv once and reuse it (FREEZE=1 rebuilds).
 */
function buildWorkList(): {trueBpm: number; file: string}[] {
  if (fs.existsSync(SAMPLE_FILE) && process.env.FREEZE === undefined) {
    const work: {trueBpm: number; file: string}[] = [];
    for (const line of fs.readFileSync(SAMPLE_FILE, 'utf8').split('\n')) {
      const tab = line.indexOf('\t');
      if (tab < 0) {
        continue;
      }
      work.push({trueBpm: parseFloat(line.slice(0, tab)), file: line.slice(tab + 1)});
    }
    console.log(`using frozen sample: ${work.length} tracks (${path.basename(SAMPLE_FILE)})`);
    return work;
  }

  const all = loadGroundTruth();
  const index = indexLibrary();
  const resolved = all
    .map(row => ({row, file: resolveFile(row, index)}))
    .filter((r): r is {row: GroundTruthRow; file: string} => r.file !== null);

  // Evenly-spaced candidate order, then keep only those that actually decode,
  // up to LIMIT -- so the frozen set is both representative and stable.
  const targetN = LIMIT > 0 ? Math.min(LIMIT, resolved.length) : resolved.length;
  const step = resolved.length / targetN;
  const order = LIMIT > 0 && resolved.length > LIMIT
    ? Array.from({length: targetN}, (_, i) => resolved[Math.floor(i * step)])
    : resolved;

  const work: {trueBpm: number; file: string}[] = [];
  for (const {row, file} of order) {
    if (decodePcm(file)) {
      work.push({trueBpm: row.trueBpm, file});
    }
  }
  fs.writeFileSync(SAMPLE_FILE, work.map(w => `${w.trueBpm}\t${w.file}`).join('\n') + '\n');
  console.log(`froze sample: ${work.length}/${order.length} decodable -> ${path.basename(SAMPLE_FILE)} (resolved on disk: ${resolved.length})`);
  return work;
}

function main(): void {
  const work = buildWorkList();

  const outcomes: Outcome[] = [];
  let decodeFailures = 0;
  let done = 0;
  for (const {trueBpm, file} of work) {
    const pcm = decodePcm(file);
    done++;
    if (!pcm) {
      decodeFailures++;
      continue;
    }
    const result = analyzeBpm(pcm, TARGET_SR, OPTS);
    outcomes.push({
      name: path.basename(file),
      trueBpm,
      detected: result.bpm,
      raw: result.raw,
      confidence: result.confidence,
      klass: classify(trueBpm, result.bpm),
    });
    if (done % 25 === 0) {
      process.stdout.write(`  ...${done}/${work.length}\n`);
    }
  }

  report(outcomes, decodeFailures);
}

function report(outcomes: Outcome[], decodeFailures: number): void {
  const n = outcomes.length;
  const counts: Record<Outcome['klass'], number> = {exact: 0, within2: 0, octave: 0, wrong: 0, null: 0};
  for (const o of outcomes) {
    counts[o.klass]++;
  }
  const pct = (x: number): string => (n ? ((100 * x) / n).toFixed(1) : '0.0') + '%';

  // MAE over octave-correct results (exact + within2).
  const octaveCorrect = outcomes.filter(o => o.klass === 'exact' || o.klass === 'within2');
  const mae = octaveCorrect.length
    ? octaveCorrect.reduce((s, o) => s + Math.abs((o.detected as number) - o.trueBpm), 0) / octaveCorrect.length
    : NaN;

  const confs = outcomes.map(o => o.confidence).sort((a, b) => a - b);
  const median = confs.length ? confs[Math.floor(confs.length / 2)] : NaN;
  const nullConfs = outcomes.filter(o => o.klass === 'null').map(o => o.confidence);

  // Per-class confidence separation (run with CONF=0 to disable the gate and see this clearly).
  const classConf = (klass: Outcome['klass']): string => {
    const cs = outcomes.filter(o => o.klass === klass).map(o => o.confidence).sort((a, b) => a - b);
    if (!cs.length) {
      return 'n/a';
    }
    const med = cs[Math.floor(cs.length / 2)];
    return `n=${cs.length} min=${cs[0].toFixed(3)} med=${med.toFixed(3)} max=${cs[cs.length - 1].toFixed(3)}`;
  };

  console.log('\n================ BPM VALIDATION ================');
  console.log(`analyzed:        ${n}   (decode failures: ${decodeFailures})`);
  console.log(`exact (+-1 BPM): ${counts.exact}  (${pct(counts.exact)})`);
  console.log(`within +-2 BPM:  ${counts.exact + counts.within2}  (${pct(counts.exact + counts.within2)})  [cumulative]`);
  console.log(`octave error:    ${counts.octave}  (${pct(counts.octave)})  [half/double of true]`);
  console.log(`wrong:           ${counts.wrong}  (${pct(counts.wrong)})`);
  console.log(`null (no beat):  ${counts.null}  (${pct(counts.null)})  [false-null on analyzed tracks]`);
  console.log(`MAE (octave-correct): ${Number.isNaN(mae) ? 'n/a' : mae.toFixed(2)} BPM`);
  console.log(`confidence: min=${confs[0]?.toFixed(3)} median=${median?.toFixed(3)} max=${confs[confs.length - 1]?.toFixed(3)}`);
  console.log('confidence by class:');
  console.log(`  exact:    ${classConf('exact')}`);
  console.log(`  within2:  ${classConf('within2')}`);
  console.log(`  octave:   ${classConf('octave')}`);
  console.log(`  wrong:    ${classConf('wrong')}`);
  if (nullConfs.length) {
    console.log(`  null:     ${classConf('null')}`);
  }

  const mismatches = outcomes
    .filter(o => o.klass === 'octave' || o.klass === 'wrong' || o.klass === 'null')
    .slice(0, 20);
  if (mismatches.length) {
    console.log('\n---- mismatches (up to 20) ----');
    for (const o of mismatches) {
      const det = o.detected === null ? 'null' : o.detected.toFixed(2);
      const raw = o.raw === undefined ? '-' : o.raw.toFixed(2);
      console.log(`  true=${o.trueBpm.toFixed(2)}  detected=${det}  raw=${raw}  conf=${o.confidence.toFixed(3)}  [${o.klass}]  ${o.name}`);
    }
  }
  console.log('===============================================\n');
}

/**
 * Grid-search params over the frozen sample. Decodes each track ONCE and runs the
 * whole grid on it (O(1) PCM memory), so comparisons are apples-to-apples.
 */
function sweepMode(): void {
  const work = buildWorkList();
  const combs = [false, true];
  const sigmas = [0.5, 0.6, 0.7, 0.9];
  const prefs = [126, 128, 130];
  const grid: BpmAnalysisOptions[] = [];
  for (const useComb of combs) {
    for (const priorSigma of sigmas) {
      for (const prefBpm of prefs) {
        grid.push({useComb, priorSigma, prefBpm, confidenceThreshold: 0});
      }
    }
  }

  const tally = grid.map(() => ({exact: 0, within2: 0, octave: 0, wrong: 0, n: 0}));
  let done = 0;
  for (const {trueBpm, file} of work) {
    const pcm = decodePcm(file);
    done++;
    if (!pcm) {
      continue;
    }
    grid.forEach((opts, gi) => {
      const klass = classify(trueBpm, analyzeBpm(pcm, TARGET_SR, opts).bpm);
      const t = tally[gi];
      t.n++;
      if (klass === 'exact') {
        t.exact++;
      } else if (klass === 'within2') {
        t.within2++;
      } else if (klass === 'octave') {
        t.octave++;
      } else {
        t.wrong++;
      }
    });
    if (done % 25 === 0) {
      process.stdout.write(`  ...${done}/${work.length}\n`);
    }
  }

  const rows = grid.map((opts, gi) => ({opts, ...tally[gi]}));
  rows.sort((a, b) => b.exact - a.exact);
  console.log('\n==== SWEEP (sorted by exact +-1) ====');
  for (const r of rows) {
    const pct = ((100 * r.exact) / r.n).toFixed(1);
    console.log(
      `comb=${r.opts.useComb ? 1 : 0} sigma=${r.opts.priorSigma} pref=${r.opts.prefBpm}  ` +
        `exact=${r.exact}/${r.n} (${pct}%)  octave=${r.octave}  wrong=${r.wrong}`,
    );
  }
}

if (process.env.SWEEP !== undefined) {
  sweepMode();
} else {
  main();
}
