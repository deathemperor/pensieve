// One-off dev tooling: downloads ~5 reference photos per fish for the
// /fish/tuyet pick-for-order page, mirroring how /plant-gallery ships
// committed images. Sources from Bing image search (its CDN thumbnail URLs
// — tse*.mm.bing.net — download reliably, unlike hotlinked source URLs).
//
//   node scripts/fetch-fish-images.mjs            # fetch all
//   node scripts/fetch-fish-images.mjs neon-vua   # fetch one slug
//
// Writes:
//   public/fish/tuyet/images/<slug>_0..4.jpg
//   public/fish/tuyet/fish-data.json   (slug,name,price,cat,imgs[] — read by index.html)
//
// Vietnamese trade names map to an enriched query (English/scientific where
// known) so the images are actually relevant. Items flagged FLAG below are
// uncertain transcriptions from the printed sheet — verify before trusting.

import { mkdir, writeFile, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";

const OUT_DIR = "public/fish/tuyet/images";
const DATA_FILE = "public/fish/tuyet/fish-data.json";
const PER_ITEM = 5;

// cat: oc | thuy-sinh | tang-day | tep
const ITEMS = [
	// ── Ốc dọn bể ────────────────────────────────────────────────
	{ slug: "oc-tao-vang-lon", name: "Ốc táo vàng lớn", price: "60k/10con", cat: "oc", q: "gold mystery snail aquarium" },
	{ slug: "oc-tao-tim-hong", name: "Ốc táo tím/hồng", price: "15k/1con", cat: "oc", q: "purple mystery snail aquarium" },
	{ slug: "oc-nerita-van", name: "Ốc Nerita vằn", price: "65k/100con (lẻ 1,5k/1con)", cat: "oc", q: "zebra nerite snail" },
	{ slug: "oc-nerita-thit-vang-mini", name: "Ốc Nerita thịt vàng mini", price: "35k/100con · 50k/250con (lẻ 0,5k/1con)", cat: "oc", q: "horned nerite snail" },
	{ slug: "oc-helena-lon", name: "Ốc Helena lớn", price: "50k/10con", cat: "oc", q: "assassin snail clea helena" },

	// ── Cá thủy sinh / bơi theo đàn ──────────────────────────────
	{ slug: "tram-moi", name: "Trâm mồi", price: "50k/300con · 35k/150con", cat: "thuy-sinh", q: "ca tram boraras micro fish" },
	{ slug: "canh-buom-du-mau", name: "Cánh buồm đủ màu", price: "4k/1con · 200k/100con", cat: "thuy-sinh", q: "colored black skirt tetra" },
	{ slug: "soc-ngua-canh-tien", name: "Sọc ngựa cánh tiên", price: "15k/1con", cat: "thuy-sinh", q: "longfin zebra danio" },
	{ slug: "molly-platinum-short", name: "Molly Platinum Short", price: "35k", cat: "thuy-sinh", q: "platinum molly fish" },
	{ slug: "molly-ngua", name: "Molly Ngựa", price: "40k", cat: "thuy-sinh", q: "sailfin molly fish" },
	{ slug: "mun-lua-short", name: "Mún Lửa Short", price: "20k", cat: "thuy-sinh", q: "red wagtail platy fish" },
	{ slug: "mun-do-thuong", name: "Mún Đỏ thường", price: "45k/10con", cat: "thuy-sinh", q: "red platy fish" },
	{ slug: "diec-anh-dao-vdai-sieu-do", name: "Diếc Anh Đào v.dài siêu đỏ", price: "150k/10con", cat: "thuy-sinh", q: "super red longfin cherry barb" },
	{ slug: "cat-keo", name: "Cắt kéo", price: "130k/10con", cat: "thuy-sinh", q: "scissortail rasbora" },
	{ slug: "soc-dau-do", name: "Sóc Đầu Đỏ", price: "70k/10con · 250k/50con", cat: "thuy-sinh", q: "rummy nose tetra" },
	{ slug: "neon-vua", name: "Neon Vua", price: "70k/10con · 250k/50con", cat: "thuy-sinh", q: "cardinal tetra" },
	{ slug: "neon-den", name: "Neon Đen", price: "60k/10con", cat: "thuy-sinh", q: "black neon tetra" },
	{ slug: "neon-kim-cuong", name: "Neon Kim Cương", price: "15k/1con", cat: "thuy-sinh", q: "diamond neon tetra" },
	{ slug: "hong-mi-4-5cm", name: "Hồng Mi size 4-5cm", price: "50k/1con", cat: "thuy-sinh", q: "denison barb roseline shark" },
	{ slug: "hong-mi-8-10cm", name: "Hồng Mi size 8-10cm", price: "120k/1con", cat: "thuy-sinh", q: "denison barb roseline shark adult" },
	{ slug: "hong-mi-tambra", name: "Hồng Mi Tambra", price: "75k", cat: "thuy-sinh", q: "tor tambra fish" },
	{ slug: "tao-do-dai", name: "Táo Đỏ dài", price: "150k", cat: "thuy-sinh", q: "ca tao do thuy sinh" },
	{ slug: "tao-do-short", name: "Táo Đỏ Short", price: "170k", cat: "thuy-sinh", q: "ca tao do short body fish" },
	{ slug: "trifas-dai", name: "Trifas dài", price: "150k", cat: "thuy-sinh", q: "ca trifas thuy sinh" },
	{ slug: "trifas-short", name: "Trifas short", price: "170k", cat: "thuy-sinh", q: "ca trifas short body" },
	{ slug: "diec-vay-rong", name: "Diếc vảy rồng", price: "50k", cat: "thuy-sinh", q: "dragon scale barb fish" },
	{ slug: "thach-my-nhan-3-4", name: "Thạch Mỹ nhân 3-4", price: "100k", cat: "thuy-sinh", q: "ca thach my nhan fish" },
	{ slug: "thach-my-nhan-do-5-6", name: "Thạch Mỹ Nhân Đỏ 5-6", price: "180k", cat: "thuy-sinh", q: "ca thach my nhan do fish" },
	{ slug: "congo-tetra", name: "Congo Tetra", price: "120k", cat: "thuy-sinh", q: "congo tetra" },
	{ slug: "phuong-hoang-lam", name: "Phượng Hoàng Lam", price: "40k", cat: "thuy-sinh", q: "german blue ram cichlid" },
	{ slug: "phuong-hoang-ngu-sac", name: "Phượng Hoàng Ngũ sắc", price: "40k", cat: "thuy-sinh", q: "electric blue ram cichlid" },
	{ slug: "phuong-hoang-vang", name: "Phượng hoàng Vàng", price: "40k", cat: "thuy-sinh", q: "golden ram cichlid" },
	{ slug: "xecan-short-vang", name: "Xecan short vàng", price: "50k", cat: "thuy-sinh", q: "ca xecan vang fish" },
	{ slug: "xecan-short-xanh", name: "Xecan short xanh", price: "60k", cat: "thuy-sinh", q: "ca xecan xanh fish" },
	{ slug: "xecan-short-tiger", name: "Xecan short tiger", price: "35k", cat: "thuy-sinh", q: "ca xecan tiger fish" },

	// ── Cá tầng đáy ──────────────────────────────────────────────
	{ slug: "chuot-venezuela", name: "Chuột Venezuela", price: "25k", cat: "tang-day", q: "corydoras venezuelanus orange" },
	{ slug: "chuot-cafe-canh-tien", name: "Chuột Cafe Cánh Tiên", price: "50k", cat: "tang-day", q: "bronze corydoras longfin" },
	{ slug: "chuot-cafe-thuong", name: "Chuột Cafe thường", price: "12k", cat: "tang-day", q: "bronze corydoras aeneus" },
	{ slug: "chuot-my", name: "Chuột Mỹ", price: "80k", cat: "tang-day", q: "corydoras paleatus peppered" },
	{ slug: "chuot-julli", name: "Chuột Julli", price: "25k", cat: "tang-day", q: "corydoras julii" },
	{ slug: "chuot-sao", name: "Chuột Sao", price: "25k", cat: "tang-day", q: "corydoras sterbai" },
	{ slug: "chuot-green-lon", name: "Chuột Green lớn", price: "55k", cat: "tang-day", q: "green corydoras splendens" },
	{ slug: "chuot-albino-thuong", name: "Chuột Albino thường", price: "nhỏ 17k · lớn 35k", cat: "tang-day", q: "albino corydoras aeneus" },
	{ slug: "chuot-albino-canh-tien", name: "Chuột Albino Cánh Tiên", price: "85k", cat: "tang-day", q: "albino corydoras longfin" },
	{ slug: "chuot-muoi-tieu-ky-cao", name: "Chuột Muối Tiêu Kỳ Cao", price: "35k", cat: "tang-day", q: "salt and pepper corydoras highfin" },
	{ slug: "chuot-pygmy", name: "Chuột Pygmy", price: "40k", cat: "tang-day", q: "corydoras pygmaeus" },
	{ slug: "chuot-hastatus", name: "Chuột Hastatus", price: "45k", cat: "tang-day", q: "corydoras hastatus" },
	{ slug: "chuot-similis", name: "Chuột Similis", price: "90k", cat: "tang-day", q: "corydoras similis" },
	{ slug: "chuot-adofoi", name: "Chuột Adofoi", price: "120k", cat: "tang-day", q: "corydoras adolfoi" },
	{ slug: "chuot-black-vene", name: "Chuột Black Vene", price: "90k", cat: "tang-day", q: "corydoras venezuelanus black" },
	{ slug: "chuot-caudi", name: "Chuột Caudi", price: "140k", cat: "tang-day", q: "corydoras caudimaculatus" },
	{ slug: "chuot-fulleri", name: "Chuột Fulleri", price: "200k", cat: "tang-day", q: "corydoras fulleri" },
	{ slug: "chuot-fullnli", name: "Chuột Fullnli", price: "200k", cat: "tang-day", q: "corydoras fulleri" }, // FLAG: name unclear on sheet
	{ slug: "chach-kuhli", name: "Chạch Kuhli", price: "25k/1con", cat: "tang-day", q: "kuhli loach" }, // FLAG: price 2k5 vs 25k on sheet
	{ slug: "bac-si-panda", name: "Bác sĩ Panda", price: "55k", cat: "tang-day", q: "panda garra flavatra" },
	{ slug: "but-chi-thai", name: "Bút Chì Thái", price: "20k", cat: "tang-day", q: "siamese algae eater" },
	{ slug: "otto", name: "Otto", price: "65k", cat: "tang-day", q: "otocinclus catfish" },
	{ slug: "ty-ba-beo-15-16cm", name: "Tỳ bà beo size 15-16cm", price: "80k", cat: "tang-day", q: "leopard sailfin pleco" },
	{ slug: "ty-ba-beo-mini", name: "Tỳ bà beo size mini", price: "25k", cat: "tang-day", q: "leopard pleco juvenile" },
	{ slug: "meo-bung-bu", name: "Mèo Bụng bự", price: "70k", cat: "tang-day", q: "ca meo bung bu catfish" }, // FLAG
	{ slug: "meo-soc-dua", name: "Mèo Sọc Dưa", price: "70k", cat: "tang-day", q: "synodontis striped catfish" },
	{ slug: "meo-petricola", name: "Mèo Petricola", price: "90k", cat: "tang-day", q: "synodontis petricola" },
	{ slug: "meo-ma-thien", name: "Mèo Mã Thiên", price: "nhỏ 40k · lớn 250k", cat: "tang-day", q: "ca meo ma thien catfish" }, // FLAG
	{ slug: "meo-haplo-den", name: "Mèo Haplo Đen", price: "120k", cat: "tang-day", q: "synodontis catfish black" },
	{ slug: "meo-haplo-albino", name: "Mèo Haplo Albino", price: "120k", cat: "tang-day", q: "synodontis albino catfish" },
	{ slug: "pleco-l397", name: "Pleco L397", price: "180k", cat: "tang-day", q: "L397 pleco" },
	{ slug: "pleco-l333", name: "Pleco L333", price: "150k", cat: "tang-day", q: "L333 pleco" },
	{ slug: "pleco-l183", name: "Pleco L183", price: "120k", cat: "tang-day", q: "L183 pleco" },
	{ slug: "pleco-l134", name: "Pleco L134", price: "300k", cat: "tang-day", q: "L134 leopard frog pleco" },
	{ slug: "pleco-l155", name: "Pleco L155", price: "500k", cat: "tang-day", q: "L155 pleco" },

	// ── Tép thủy sinh ────────────────────────────────────────────
	{ slug: "tep-vang-dai", name: "Tép Vàng Đài", price: "150k/10con", cat: "tep", q: "golden back yellow neocaridina shrimp" },
	{ slug: "tep-vang-thai", name: "Tép Vàng Thái", price: "120k/10con", cat: "tep", q: "yellow neocaridina shrimp" },
	{ slug: "tep-bluedream", name: "Tép BlueDream", price: "150k/10con", cat: "tep", q: "blue dream neocaridina shrimp" },
	{ slug: "tep-socola", name: "Tép Socola", price: "150k/10con", cat: "tep", q: "chocolate neocaridina shrimp" },
	{ slug: "tep-loan-mau", name: "Tép Loạn Màu", price: "170k/100con", cat: "tep", q: "mixed color neocaridina shrimp" },
	{ slug: "tep-do", name: "Tép Đỏ", price: "70k/10con · 250k/50con", cat: "tep", q: "red cherry shrimp" },
	{ slug: "tep-rili-cam-do", name: "Tép Rili Cam/Đỏ", price: "60k/10con", cat: "tep", q: "red rili shrimp" },
	{ slug: "tep-mui-do", name: "Tép Mũi Đỏ", price: "170k/10con", cat: "tep", q: "red nose pinokio shrimp" },
	{ slug: "tep-yamato", name: "Tép Yamato (diệt rêu tóc)", price: "35k/1con", cat: "tep", q: "amano shrimp" },
];

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// DuckDuckGo image search: fetch a vqd token from the HTML page, then call
// the i.js JSON endpoint. Returns CDN thumbnail URLs (mm.bing.net), which
// download reliably. Bing's own HTML degrades under scraping; DDG doesn't.
async function ddgThumbs(query) {
	const tok = await fetch(`https://duckduckgo.com/?q=${encodeURIComponent(query)}&iax=images&ia=images`, {
		headers: { "User-Agent": UA },
	});
	const html = await tok.text();
	const vqd = (html.match(/vqd=["']?([\d-]+)["']?/) || [])[1];
	if (!vqd) throw new Error("no vqd token");
	const res = await fetch(
		`https://duckduckgo.com/i.js?l=us-en&o=json&q=${encodeURIComponent(query)}&vqd=${vqd}&f=,,,&p=1`,
		{ headers: { "User-Agent": UA, Referer: "https://duckduckgo.com/", Accept: "application/json" } },
	);
	if (!res.ok) throw new Error(`i.js ${res.status}`);
	const json = await res.json();
	const urls = [];
	const seen = new Set();
	for (const r of json.results || []) {
		const u = r.thumbnail || r.image;
		if (u && !seen.has(u)) { seen.add(u); urls.push(u); }
		if (urls.length >= PER_ITEM * 3) break;
	}
	return urls;
}

async function download(url, dest) {
	const res = await fetch(url, { headers: { "User-Agent": UA } });
	if (!res.ok) throw new Error(`img ${res.status}`);
	const buf = Buffer.from(await res.arrayBuffer());
	if (buf.length < 1500) throw new Error("too small");
	await writeFile(dest, buf);
	return buf.length;
}

async function fetchItem(item) {
	const got = [];
	let candidates = [];
	try {
		candidates = await ddgThumbs(item.q);
	} catch (e) {
		console.warn(`  search failed for ${item.slug}: ${e.message}`);
	}
	for (const url of candidates) {
		if (got.length >= PER_ITEM) break;
		const idx = got.length;
		const file = `${item.slug}_${idx}.jpg`;
		try {
			await download(url, `${OUT_DIR}/${file}`);
			got.push(`images/${file}`);
		} catch { /* try next candidate */ }
		await sleep(150);
	}
	return got;
}

async function main() {
	const only = process.argv[2];
	const work = only ? ITEMS.filter((i) => i.slug === only) : ITEMS;
	if (!work.length) { console.error(`no item matched "${only}"`); process.exit(1); }
	await mkdir(OUT_DIR, { recursive: true });

	// Preserve existing data so single-slug runs don't wipe the rest.
	let data = [];
	if (existsSync(DATA_FILE)) {
		const { readFile } = await import("node:fs/promises");
		try { data = JSON.parse(await readFile(DATA_FILE, "utf8")); } catch { data = []; }
	}
	const bySlug = new Map(data.map((d) => [d.slug, d]));

	let ok = 0, partial = 0, failed = 0;
	for (const item of work) {
		const imgs = await fetchItem(item);
		bySlug.set(item.slug, { slug: item.slug, name: item.name, price: item.price, cat: item.cat, imgs });
		if (imgs.length >= PER_ITEM) ok++;
		else if (imgs.length > 0) partial++;
		else failed++;
		console.log(`${item.slug}: ${imgs.length}/${PER_ITEM}`);
		await sleep(400);
	}

	// Re-order to match ITEMS order, drop any stale slugs not in ITEMS.
	const order = new Map(ITEMS.map((it, i) => [it.slug, i]));
	const out = [...bySlug.values()]
		.filter((d) => order.has(d.slug))
		.sort((a, b) => order.get(a.slug) - order.get(b.slug));
	await writeFile(DATA_FILE, JSON.stringify(out, null, 0));

	const counts = await readdir(OUT_DIR);
	console.log(`\nDone. full=${ok} partial=${partial} none=${failed} · ${counts.length} image files · data → ${DATA_FILE}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
