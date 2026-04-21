import { Plugin } from "obsidian";
import {
	DEFAULT_SETTINGS,
	PensievePublisherSettings,
	PensievePublisherSettingsTab,
} from "./src/settings";
import { publishCurrentNote } from "./src/publish";

export default class PensievePublisherPlugin extends Plugin {
	settings!: PensievePublisherSettings;

	async onload(): Promise<void> {
		await this.loadSettings();

		this.addCommand({
			id: "publish-to-pensieve",
			name: "Publish current note to Pensieve",
			callback: () =>
				publishCurrentNote(this, {
					crossPostFacebook: this.settings.autoCrossPostFacebook,
				}),
		});

		this.addCommand({
			id: "publish-to-pensieve-only",
			name: "Publish current note to Pensieve (no Facebook)",
			callback: () => publishCurrentNote(this, { crossPostFacebook: false }),
		});

		this.addCommand({
			id: "publish-to-pensieve-and-facebook",
			name: "Publish current note to Pensieve + Facebook",
			callback: () => publishCurrentNote(this, { crossPostFacebook: true }),
		});

		this.addRibbonIcon("upload-cloud", "Publish to Pensieve", () =>
			publishCurrentNote(this, {
				crossPostFacebook: this.settings.autoCrossPostFacebook,
			}),
		);

		this.addSettingTab(new PensievePublisherSettingsTab(this.app, this));
	}

	async loadSettings(): Promise<void> {
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			(await this.loadData()) || {},
		);
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
	}
}
