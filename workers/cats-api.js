/**
 * ryuujo-cats-api — read-only JSON stats for https://ryuujo.com/cats/
 *
 * Security posture:
 *  - Exactly one route: GET /cats. Query strings are stripped, never read.
 *    Any other path -> 404; any other method -> 405. There are no
 *    client-controlled inputs, so nothing can be injected into HA queries.
 *  - The Home Assistant long-lived token lives in the HA_TOKEN secret binding.
 *  - All HA entity ids are hardcoded constants (stable Xiaomi spec keys).
 *  - Responses are non-sensitive feeder stats only.
 *  - Edge-cached ~20s per colo so polling clients never hammer HA.
 *
 * The aggregation below mirrors ryuujo.com src/lib/feeder.ts (kept
 * self-contained because Workers deploy as a single module).
 */

const HA_URL = "https://home.zako.tv";
const TZ_OFFSET_MS = 8 * 3600e3; // feeder is UTC+8, no DST
const DAY_MS = 86400e3;

const E = {
	battery: "binary_sensor.xiaomi_cn_922991116_pi2001_battery_level_p_4_1",
	foodOutComplete: "event.xiaomi_cn_922991116_pi2001_food_out_complete_e_2_5",
	dayEaten: "event.xiaomi_cn_922991116_pi2001_day_eaten_food_e_2_1",
	foodStorage: "sensor.xiaomi_cn_922991116_pi2001_pet_food_left_level_p_2_6",
	bowlNow: "sensor.xiaomi_cn_922991116_pi2001_eaten_food_measure_p_2_22",
	dispenseState: "sensor.xiaomi_cn_922991116_pi2001_status_p_2_26",
	scheduleProgress: "sensor.xiaomi_cn_922991116_pi2001_status_p_2_29",
	jam: "sensor.xiaomi_cn_922991116_pi2001_status_p_2_10",
	bowlFault: "sensor.xiaomi_cn_922991116_pi2001_status_p_2_11",
	weighFault: "sensor.xiaomi_cn_922991116_pi2001_fault_p_2_1",
	pile: "sensor.xiaomi_cn_922991116_pi2001_status_p_2_15",
	desiccantPct: "sensor.xiaomi_cn_922991116_pi2001_desiccant_left_level_p_6_1",
	desiccantDays: "sensor.xiaomi_cn_922991116_pi2001_desiccant_left_time_p_6_2",
	childLock: "switch.xiaomi_cn_922991116_pi2001_physical_controls_locked_p_3_1",
	scheduleText: "text.xiaomi_cn_922991116_pi2001_feeder_schedule_p_5_1",
	scheduleOn: "select.xiaomi_cn_922991116_pi2001_schedule_state_p_5_8",
};

const CORS = {
	"access-control-allow-methods": "GET, OPTIONS",
	"access-control-max-age": "86400",
};

/** Reflect an allow-listed Origin (prod site + local dev), else default to prod. */
const corsOrigin = (req) => {
	const o = req.headers.get("origin") || "";
	const allowed = /^https:\/\/ryuujo\.com$|^http:\/\/(localhost|\[::1\]|127\.0\.0\.1):4399$/;
	return allowed.test(o) ? o : "https://ryuujo.com";
};

const json = (obj, status = 200, headers = {}, origin = "https://ryuujo.com") =>
	new Response(JSON.stringify(obj), {
		status,
		headers: {
			"content-type": "application/json; charset=utf-8",
			...CORS,
			"access-control-allow-origin": origin,
			// The reflected origin must never leak across cache entries.
			vary: "Origin",
			...headers,
		},
	});

const localDayKey = (ms) => new Date(ms + TZ_OFFSET_MS).toISOString().slice(0, 10);
const localTimeStr = (ms) => new Date(ms + TZ_OFFSET_MS).toISOString().slice(11, 16);

function parseSchedule(raw) {
	const meals = [];
	for (const part of raw.replace(/[[\]\s]/g, "").split(",")) {
		const entry = part.trim();
		if (!/^\d{8}$/.test(entry)) continue;
		meals.push({ time: `${entry.slice(0, 2)}:${entry.slice(2, 4)}`, grams: Math.round(Number(entry.slice(4)) / 10) });
	}
	return meals.sort((a, b) => a.time.localeCompare(b.time));
}

function dedupeEvents(points, tsAttr) {
	const seen = new Set();
	const out = [];
	for (const p of points) {
		const ts = p.attributes?.[tsAttr];
		if (typeof ts !== "number" || seen.has(String(ts))) continue;
		seen.add(String(ts));
		out.push(p);
	}
	return out;
}

async function collectFeederData(now, HA_TOKEN) {
	const headers = { authorization: `Bearer ${HA_TOKEN}` };
	const histUrl = (id, minimal) => {
		const p = new URLSearchParams({ filter_entity_id: id, end_time: new Date(now).toISOString() });
		if (minimal) p.set("minimal_response", "");
		return `/api/history/period/${new Date(now - 7 * DAY_MS).toISOString()}?${p}`;
	};

	const [statesRes, feedRes, eatenRes, bowlRes] = await Promise.all([
		fetch(`${HA_URL}/api/states`, { headers, signal: AbortSignal.timeout(15000) }),
		fetch(`${HA_URL}${histUrl(E.foodOutComplete, false)}`, { headers, signal: AbortSignal.timeout(15000) }),
		fetch(`${HA_URL}${histUrl(E.dayEaten, false)}`, { headers, signal: AbortSignal.timeout(15000) }),
		fetch(`${HA_URL}${histUrl(E.bowlNow, true)}`, { headers, signal: AbortSignal.timeout(15000) }),
	]);
	if (!statesRes.ok || !feedRes.ok || !eatenRes.ok || !bowlRes.ok) {
		throw new Error(`HA upstream ${[statesRes, feedRes, eatenRes, bowlRes].map((r) => r.status).join("/")}`);
	}
	const states = await statesRes.json();
	const [feedHist] = await feedRes.json();
	const [eatenHist] = await eatenRes.json();
	const [bowlPts] = await bowlRes.json();

	const st = (role) => states.find((s) => s.entity_id === E[role]);
	const stateVal = (role) => st(role)?.state;
	const num = (role) => {
		const n = Number(stateVal(role));
		return Number.isFinite(n) ? n : null;
	};

	const kindLabel = { "0": "手动", "1": "按键", "2": "计划" };
	const dispenses = dedupeEvents(feedHist ?? [], "出粮事件产生时间")
		.map((p) => {
			const ts = p.attributes["出粮事件产生时间"];
			return typeof ts === "number"
				? { at: ts * 1000, grams: Number(p.attributes["单次出粮克数"]) || 0, kind: kindLabel[String(p.attributes["出粮类型"])] ?? "手动" }
				: null;
		})
		.filter((d) => d !== null && d.grams > 0)
		.sort((a, b) => a.at - b.at);

	const eatenReports = dedupeEvents(eatenHist ?? [], "进食克数时间戳")
		.map((p) => {
			const ts = p.attributes["进食克数时间戳"];
			return typeof ts === "number" ? { at: ts * 1000, grams: Number(p.attributes["进食克数"]) || 0 } : null;
		})
		.filter((e) => e !== null)
		.sort((a, b) => a.at - b.at);

	const dailyMap = new Map();
	for (const r of eatenReports) dailyMap.set(localDayKey(r.at), { date: localDayKey(r.at), grams: r.grams });
	const dailyEaten = [...dailyMap.values()].sort((a, b) => a.date.localeCompare(b.date));
	const todayKey = localDayKey(now);
	const todayEaten = dailyMap.get(todayKey);
	const lastEaten = eatenReports.at(-1) ?? null;

	// minimal_response history: later points arrive as [state, last_changed] tuples
	const windowStart = now - 7 * DAY_MS;
	const bowlRaw = (bowlPts ?? [])
		.map((p) => {
			const [state, changed] = Array.isArray(p) ? p : [p.state, p.last_changed];
			const grams = Number(state);
			const t = Date.parse(changed);
			return Number.isFinite(grams) && Number.isFinite(t) ? { t, grams } : null;
		})
		.filter((p) => p !== null && p.t >= windowStart && p.t <= now)
		.sort((a, b) => a.t - b.t);
	const bucketMs = 5 * 60e3;
	const buckets = new Map();
	for (const p of bowlRaw) buckets.set(Math.floor(p.t / bucketMs), p.grams);
	const bowlHistory = [...buckets.entries()]
		.sort((a, b) => a[0] - b[0])
		.map(([b, grams]) => ({ t: b * bucketMs + bucketMs / 2, grams }));

	const scheduleEnabled = stateVal("scheduleOn") === "On";
	const schedule = parseSchedule(stateVal("scheduleText") ?? "");
	const nextMeal = schedule.find((m) => m.time > localTimeStr(now)) ?? schedule[0] ?? null;
	const todayDispensesList = dispenses.filter((d) => localDayKey(d.at) === todayKey);

	return {
		fetchedAt: now,
		bowlGrams: num("bowlNow"),
		dispensing: stateVal("dispenseState") === "出粮中",
		foodStorageLow: stateVal("foodStorage") === "Low",
		scheduleEnabled,
		scheduleProgress: num("scheduleProgress"),
		nextMeal,
		schedule,
		desiccant: { percent: num("desiccantPct") ?? 0, daysLeft: num("desiccantDays") ?? 0 },
		faults: {
			jam: stateVal("jam") === "异常",
			bowl: stateVal("bowlFault") === "异常",
			weigh: stateVal("weighFault") === "Faults",
			pile: stateVal("pile") === "Yes",
		},
		childLock: stateVal("childLock") === "on",
		powered: stateVal("battery") !== "on",
		todayEatenGrams: todayEaten?.grams ?? (eatenReports.length ? 0 : null),
		lastEatenAt: lastEaten?.at ?? null,
		todayDispenses: { count: todayDispensesList.length, grams: todayDispensesList.reduce((s, d) => s + d.grams, 0) },
		totalDispenses: { count: dispenses.length, grams: dispenses.reduce((s, d) => s + d.grams, 0) },
		dispenses: dispenses.slice(-12).reverse(),
		dailyEaten: dailyEaten.slice(-7),
		bowlHistory,
	};
}

export default {
	async fetch(request, env, ctx) {
		const url = new URL(request.url);
		const origin = corsOrigin(request);

		if (request.method === "OPTIONS")
			return new Response(null, { status: 204, headers: { ...CORS, "access-control-allow-origin": origin } });
		if (request.method !== "GET") return json({ error: "method not allowed" }, 405, {}, origin);
		if (url.pathname !== "/cats") return json({ error: "not found" }, 404, {}, origin);
		if (!env.HA_TOKEN)
			return json({ error: "worker secret HA_TOKEN is not configured" }, 500, { "cache-control": "no-store" }, origin);

		// Query-free cache key; the reflected CORS origin is part of it so one
		// origin's response can never be served to another (CORS pollution).
		// `origin` is already restricted to the allow-list by corsOrigin().
		const cacheKey = new Request(
			`https://api.ryuujo.com/cats?origin=${encodeURIComponent(origin)}`,
			{ method: "GET" },
		);
		const cache = caches.default;
		const hit = await cache.match(cacheKey);
		if (hit) return hit;

		let payload;
		try {
			payload = await collectFeederData(Date.now(), env.HA_TOKEN);
		} catch (err) {
			return json({ error: `feeder data unavailable: ${err.message}` }, 502, { "cache-control": "no-store" }, origin);
		}

		const res = json(payload, 200, { "cache-control": "public, max-age=20" }, origin);
		ctx.waitUntil(cache.put(cacheKey, res.clone()));
		return res;
	},
};
