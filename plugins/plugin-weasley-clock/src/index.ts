import type { PluginDescriptor } from "emdash";

export function weasleyClockPlugin(): PluginDescriptor {
	return {
		id: "weasley-clock",
		version: "0.1.0",
		format: "standard",
		entrypoint: "plugin-weasley-clock/sandbox",
		options: {},
		capabilities: [],
		allowedHosts: [],
		storage: {},
		adminPages: [],
	};
}
