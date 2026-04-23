/**
 * Hand-simplified continent outline paths in geographic coordinates.
 *
 * These are NOT geodetically accurate — they're visual guides so the
 * Atlas reads as a world map rather than a graticule grid. Drawn from
 * memory of major coastline inflection points. Good enough for a
 * stylized personal atlas; not for navigation.
 *
 * Each entry is a closed polygon in (lng, lat) pairs. The AtlasPanel
 * projects each point via projectLatLng and joins with the SVG polyline
 * commands.
 */

export interface WorldOutline {
	name: string;
	points: Array<[number, number]>; // [lng, lat] pairs
}

export const worldOutlines: WorldOutline[] = [
	{
		name: "Europe",
		points: [
			[-10, 36], [-5, 36], [0, 38], [5, 44], [9, 44], [12, 38], [18, 40],
			[23, 38], [27, 37], [30, 40], [32, 45], [35, 48], [32, 52], [25, 55],
			[19, 56], [10, 58], [5, 61], [-1, 61], [-6, 58], [-10, 54], [-9, 44], [-10, 36],
		],
	},
	{
		name: "Africa",
		points: [
			[-17, 14], [-10, 6], [-5, 5], [3, 6], [9, 4], [14, 0], [18, -5],
			[15, -14], [12, -22], [17, -29], [25, -34], [32, -30], [36, -17],
			[40, -12], [43, -4], [48, -3], [51, 9], [44, 12], [39, 17], [34, 28],
			[25, 31], [15, 32], [3, 37], [-7, 35], [-13, 28], [-17, 21], [-17, 14],
		],
	},
	{
		name: "Asia mainland",
		points: [
			[30, 40], [40, 38], [48, 32], [55, 25], [60, 22], [68, 24], [75, 22],
			[80, 12], [90, 20], [95, 22], [100, 15], [105, 8], [109, 12], [115, 18],
			[120, 26], [122, 37], [128, 43], [135, 46], [140, 52], [150, 60],
			[145, 65], [135, 64], [120, 62], [100, 60], [80, 60], [60, 62],
			[40, 60], [30, 55], [30, 40],
		],
	},
	{
		name: "Indian subcontinent lobe",
		points: [
			[68, 23], [73, 17], [78, 10], [80, 7], [83, 11], [88, 20], [91, 22], [84, 24], [78, 26], [72, 26], [68, 23],
		],
	},
	{
		name: "SE Asia archipelago (simplified Sumatra–Java–Borneo ring)",
		points: [
			[95, 5], [102, -1], [106, -6], [114, -8], [118, -6], [116, 2], [110, 5], [100, 4], [95, 5],
		],
	},
	{
		name: "Japan",
		points: [[131, 31], [135, 34], [140, 37], [141, 41], [144, 44], [140, 41], [138, 37], [132, 34], [131, 31]],
	},
	{
		name: "Australia",
		points: [
			[114, -22], [120, -19], [129, -15], [137, -11], [142, -10], [147, -18],
			[151, -30], [147, -36], [140, -38], [130, -33], [119, -33], [114, -22],
		],
	},
	{
		name: "North America (simplified east)",
		points: [
			[-125, 49], [-115, 49], [-95, 49], [-75, 46], [-60, 46], [-65, 40],
			[-75, 36], [-80, 26], [-84, 25], [-90, 29], [-98, 27], [-108, 32],
			[-117, 32], [-125, 40], [-125, 49],
		],
	},
];
