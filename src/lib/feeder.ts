/**
 * Build-time Home Assistant data source for the /cats page.
 *
 * Runs exclusively in Astro frontmatter (build machine), so the long-lived
 * access token never reaches the client bundle — only normalized,
 * non-sensitive stats are baked into the static HTML.
 */

const HA_URL = import.meta.env.HA_URL || 'https://home.zako.tv';
const HA_TOKEN = import.meta.env.HA_TOKEN;

/** Device model reported by the Xiaomi Home integration. */
const FEEDER_MODEL = 'xiaomi.feeder.pi2001';

/** Entity id suffixes we rely on, keyed by role (suffixes are spec-key based). */
const ENTITY_ROLES = {
	battery: 'battery_level_p_4_1',
	foodOutComplete: 'food_out_complete_e_2_5',
	dayEaten: 'day_eaten_food_e_2_1',
	foodStorage: 'pet_food_left_level_p_2_6',
	bowlNow: 'eaten_food_measure_p_2_22',
	dispenseState: 'status_p_2_26',
	scheduleProgress: 'status_p_2_29',
	consumable: 'status_p_2_31',
	jam: 'status_p_2_10',
	bowlFault: 'status_p_2_11',
	weighFault: 'fault_p_2_1',
	pile: 'status_p_2_15',
	desiccantPct: 'desiccant_left_level_p_6_1',
	desiccantDays: 'desiccant_left_time_p_6_2',
	childLock: 'physical_controls_locked_p_3_1',
	scheduleText: 'feeder_schedule_p_5_1',
	scheduleOn: 'schedule_state_p_5_8',
} as const;

/** The feeder lives in UTC+8 (device reports 时区 28800); no DST in China. */
const TZ_OFFSET_MS = 8 * 3600e3;

const DAY_MS = 86400e3;

export interface FeederMeal {
	/** HH:MM in the feeder's local time */
	time: string;
	grams: number;
}

export interface DispenseEvent {
	/** ms epoch */
	at: number;
	grams: number;
	/** 出粮类型: 2 计划 / 0 手动 / 1 按键 */
	kind: '计划' | '手动' | '按键';
}

export interface DailyEaten {
	/** YYYY-MM-DD in feeder local time */
	date: string;
	grams: number;
}

export interface BowlPoint {
	/** ms epoch */
	t: number;
	grams: number;
}

export interface FeederData {
	fetchedAt: number;
	device: {
		name: string;
		model: string;
		manufacturer: string;
		swVersion: string | null;
		area: string | null;
	};
	bowlGrams: number | null;
	dispensing: boolean;
	foodStorageLow: boolean;
	scheduleEnabled: boolean;
	scheduleProgress: number | null;
	nextMeal: FeederMeal | null;
	schedule: FeederMeal[];
	desiccant: { percent: number; daysLeft: number };
	faults: { jam: boolean; bowl: boolean; weigh: boolean; pile: boolean };
	childLock: boolean;
	powered: boolean;
	todayEatenGrams: number | null;
	lastEatenAt: number | null;
	todayDispenses: { count: number; grams: number };
	totalDispenses: { count: number; grams: number };
	dispenses: DispenseEvent[];
	dailyEaten: DailyEaten[];
	bowlHistory: BowlPoint[];
	/** Inclusive history window actually covered by the recorder (ms epoch). */
	windowStart: number;
	windowEnd: number;
}

async function haFetch(path: string): Promise<unknown> {
	const res = await fetch(`${HA_URL}${path}`, {
		headers: { authorization: `Bearer ${HA_TOKEN}` },
		signal: AbortSignal.timeout(20_000),
	});
	if (!res.ok) throw new Error(`HA ${path} -> ${res.status}`);
	return res.json();
}

type WsResult = Record<string, unknown>;
function haWs(commands: { type: string }[]): Promise<Record<string, WsResult>> {
	return new Promise((resolve, reject) => {
		const wsUrl = `${HA_URL.replace(/^http/, 'ws')}/api/websocket`;
		const ws = new WebSocket(wsUrl);
		const out: Record<string, WsResult> = {};
		let id = 0;
		const timer = setTimeout(() => {
			ws.close();
			reject(new Error('HA websocket timeout'));
		}, 20_000);
		ws.onmessage = (ev) => {
			const msg = JSON.parse(ev.data as string) as {
				type: string;
				id?: number;
				success?: boolean;
				result?: WsResult;
				error?: unknown;
			};
			if (msg.type === 'auth_required') {
				ws.send(JSON.stringify({ type: 'auth', access_token: HA_TOKEN }));
				return;
			}
			if (msg.type === 'auth_invalid') {
				clearTimeout(timer);
				reject(new Error('HA websocket auth rejected'));
				return;
			}
			if (msg.type === 'auth_ok') {
				for (const cmd of commands) ws.send(JSON.stringify({ id: ++id, ...cmd }));
				return;
			}
			if (msg.id != null) {
				if (!msg.success) {
					clearTimeout(timer);
					reject(new Error(`HA ws ${msg.type} failed: ${JSON.stringify(msg.error)}`));
					return;
				}
				out[commands[(msg.id ?? 1) - 1].type] = msg.result ?? {};
				if (Object.keys(out).length === commands.length) {
					clearTimeout(timer);
					ws.close();
					resolve(out);
				}
			}
		};
		ws.onerror = () => {
			clearTimeout(timer);
			reject(new Error('HA websocket error'));
		};
	});
}

interface HaDevice {
	id: string;
	name: string | null;
	model: string | null;
	manufacturer: string | null;
	sw_version: string | null;
	area_id: string | null;
}

interface HaEntity {
	entity_id: string;
	device_id: string | null;
	disabled_by: string | null;
}

interface HaState {
	entity_id: string;
	state: string;
	attributes: Record<string, unknown>;
	last_changed: string;
}

/** Parse "[1,08000100,12000601]" → meals. Entry: HHMM + grams×10 (0.1g units). */
function parseSchedule(raw: string): FeederMeal[] {
	const meals: FeederMeal[] = [];
	for (const part of raw.replace(/[[\]\s]/g, '').split(',')) {
		const entry = part.trim();
		if (!/^\d{8}$/.test(entry)) continue;
		const grams = Math.round(Number(entry.slice(4)) / 10);
		meals.push({ time: `${entry.slice(0, 2)}:${entry.slice(2, 4)}`, grams });
	}
	return meals.sort((a, b) => a.time.localeCompare(b.time));
}

function localDayKey(ms: number): string {
	return new Date(ms + TZ_OFFSET_MS).toISOString().slice(0, 10);
}

function localTimeStr(ms: number): string {
	return new Date(ms + TZ_OFFSET_MS).toISOString().slice(11, 16);
}

/** Dedupe event-entity history into real events (state repeats between firings). */
function dedupeEvents(points: HaState[], tsAttr: string): HaState[] {
	const seen = new Set<string>();
	const out: HaState[] = [];
	for (const p of points) {
		const ts = p.attributes?.[tsAttr];
		if (typeof ts !== 'number' || seen.has(String(ts))) continue;
		seen.add(String(ts));
		out.push(p);
	}
	return out;
}

export async function fetchFeederData(): Promise<FeederData> {
	const now = Date.now();

	const { 'config/device_registry/list': devices, 'config/entity_registry/list': entities } =
		await haWs([{ type: 'config/device_registry/list' }, { type: 'config/entity_registry/list' }]);
	const areas = (await haWs([{ type: 'config/area_registry/list' }]))[
		'config/area_registry/list'
	] as unknown as { area_id: string; name: string }[];

	const feeder = (devices as unknown as HaDevice[]).find((d) => d.model === FEEDER_MODEL);
	if (!feeder) throw new Error(`device ${FEEDER_MODEL} not found`);
	const eid = new Map<string, string>();
	const mine = (entities as unknown as HaEntity[]).filter(
		(e) => e.device_id === feeder.id && !e.disabled_by,
	);
	for (const [role, suffix] of Object.entries(ENTITY_ROLES)) {
		const match = mine.find((e) => e.entity_id.endsWith(`_${suffix}`));
		if (match) eid.set(role, match.entity_id);
	}
	if (!eid.size) throw new Error('no feeder entities resolved');

	const states = (await haFetch('/api/states')) as HaState[];
	const st = (role: string): HaState | undefined =>
		states.find((s) => s.entity_id === eid.get(role));
	const stateVal = (role: string): string | undefined => st(role)?.state;
	const num = (role: string): number | null => {
		const v = stateVal(role);
		const n = v == null ? NaN : Number(v);
		return Number.isFinite(n) ? n : null;
	};

	// History: event entities need full attributes (grams); the bowl sensor only
	// needs state+time, so fetch it with minimal_response. 7-day window. One
	// call per entity — the API may drop empty entities from combined results.
	const windowStart = now - 7 * DAY_MS;
	const period = new Date(windowStart).toISOString();
	const end = new Date(now).toISOString();
	const histUrl = (id: string, minimal: boolean) => {
		const params = new URLSearchParams({ filter_entity_id: id, end_time: end });
		if (minimal) params.set('minimal_response', '');
		return `/api/history/period/${period}?${params}`;
	};

	const [[feedHist], [eatenHist], [bowlHist]] = (await Promise.all([
		haFetch(histUrl(eid.get('foodOutComplete')!, false)),
		haFetch(histUrl(eid.get('dayEaten')!, false)),
		haFetch(histUrl(eid.get('bowlNow')!, true)),
	])) as [HaState[], HaState[], (HaState | [string, string])[]];

	const byEid = (list: HaState[], role: string) => list.filter((p) => p.entity_id === eid.get(role));

	// Dispense events: attrs carry grams + type + device-side timestamp.
	const kindLabel: Record<string, DispenseEvent['kind']> = { '0': '手动', '1': '按键', '2': '计划' };
	const dispenses: DispenseEvent[] = dedupeEvents(
		byEid(feedHist, 'foodOutComplete'),
		'出粮事件产生时间',
	)
		.map((p) => {
			const ts = p.attributes['出粮事件产生时间'];
			return typeof ts === 'number'
				? {
						at: ts * 1000,
						grams: Number(p.attributes['单次出粮克数']) || 0,
						kind: kindLabel[String(p.attributes['出粮类型'])] ?? '手动',
					}
				: null;
		})
		.filter((d): d is DispenseEvent => d !== null && d.grams > 0)
		.sort((a, b) => a.at - b.at);

	// Eaten reports: cumulative grams per feeder-local day (device resets at midnight).
	const eatenReports = dedupeEvents(byEid(eatenHist, 'dayEaten'), '进食克数时间戳')
		.map((p) => {
			const ts = p.attributes['进食克数时间戳'];
			return typeof ts === 'number'
				? { at: ts * 1000, grams: Number(p.attributes['进食克数']) || 0 }
				: null;
		})
		.filter((e): e is { at: number; grams: number } => e !== null)
		.sort((a, b) => a.at - b.at);

	const dailyMap = new Map<string, DailyEaten>();
	for (const r of eatenReports) {
		dailyMap.set(localDayKey(r.at), { date: localDayKey(r.at), grams: r.grams });
	}
	const dailyEaten = [...dailyMap.values()].sort((a, b) => a.date.localeCompare(b.date));
	const todayKey = localDayKey(now);
	const todayEaten = dailyMap.get(todayKey) ?? null;
	const lastEaten = eatenReports.at(-1) ?? null;

	// Bowl weight series: with minimal_response, later points arrive as
	// [state, last_changed] tuples rather than full objects. Drop unknown
	// states, 5-minute downsample, clamp to window.
	const bowlRaw = bowlHist
		.map((p): { t: number; grams: number } | null => {
			const [state, changed] = Array.isArray(p) ? p : [p.state, p.last_changed];
			const grams = Number(state);
			const t = Date.parse(changed);
			return Number.isFinite(grams) && Number.isFinite(t) ? { t, grams } : null;
		})
		.filter((p): p is { t: number; grams: number } => p !== null && p.t >= windowStart && p.t <= now)
		.sort((a, b) => a.t - b.t);
	const bucketMs = 5 * 60e3;
	const bowlBuckets = new Map<number, number>();
	for (const p of bowlRaw) bowlBuckets.set(Math.floor(p.t / bucketMs), p.grams);
	const bowlHistory: BowlPoint[] = [...bowlBuckets.entries()]
		.sort((a, b) => a[0] - b[0])
		.map(([b, grams]) => ({ t: b * bucketMs + bucketMs / 2, grams }));

	// Schedule.
	const scheduleEnabled = stateVal('scheduleOn') === 'On';
	const schedule = parseSchedule(stateVal('scheduleText') ?? '');
	const nowLocal = localTimeStr(now);
	const nextMeal =
		schedule.find((m) => m.time > nowLocal) ??
		(schedule.length ? { ...schedule[0] } : null);

	const todayDispensesList = dispenses.filter((d) => localDayKey(d.at) === todayKey);

	// Friendly area name (e.g. ke_ting → 客厅) from the area registry.
	const areaName = areas.find((a) => a.area_id === feeder.area_id)?.name;

	return {
		fetchedAt: now,
		device: {
			name: feeder.name ?? '米家智能宠物喂食器',
			model: feeder.model ?? FEEDER_MODEL,
			manufacturer: feeder.manufacturer ?? '小米',
			swVersion: feeder.sw_version,
			area: areaName ?? feeder.area_id,
		},
		bowlGrams: num('bowlNow'),
		dispensing: stateVal('dispenseState') === '出粮中',
		foodStorageLow: stateVal('foodStorage') === 'Low',
		scheduleEnabled,
		scheduleProgress: num('scheduleProgress'),
		nextMeal,
		schedule,
		desiccant: {
			percent: num('desiccantPct') ?? 0,
			daysLeft: num('desiccantDays') ?? 0,
		},
		faults: {
			jam: stateVal('jam') === '异常',
			bowl: stateVal('bowlFault') === '异常',
			weigh: stateVal('weighFault') === 'Faults',
			pile: stateVal('pile') === 'Yes',
		},
		childLock: stateVal('childLock') === 'on',
		powered: stateVal('battery') !== 'on',
		todayEatenGrams: todayEaten?.grams ?? (eatenReports.length ? 0 : null),
		lastEatenAt: lastEaten?.at ?? null,
		todayDispenses: {
			count: todayDispensesList.length,
			grams: todayDispensesList.reduce((s, d) => s + d.grams, 0),
		},
		totalDispenses: {
			count: dispenses.length,
			grams: dispenses.reduce((s, d) => s + d.grams, 0),
		},
		dispenses: dispenses.slice(-12).reverse(),
		dailyEaten: dailyEaten.slice(-7),
		bowlHistory,
		windowStart,
		windowEnd: now,
	};
}
