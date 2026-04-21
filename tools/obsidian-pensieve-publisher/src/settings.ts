import { App, PluginSettingTab, Setting } from "obsidian";
import type PensievePublisherPlugin from "../main";

export interface PensievePublisherSettings {
	baseUrl: string;
	apiToken: string;
	defaultLanguage: "vi" | "en";
	defaultCategory: string;
	defaultStatus: "published" | "draft";
	autoCrossPostFacebook: boolean;
	facebookPageId: string;
	facebookAccessToken: string;
}

export const DEFAULT_SETTINGS: PensievePublisherSettings = {
	baseUrl: "https://huuloc.com",
	apiToken: "",
	defaultLanguage: "vi",
	defaultCategory: "",
	defaultStatus: "published",
	autoCrossPostFacebook: false,
	facebookPageId: "",
	facebookAccessToken: "",
};

export class PensievePublisherSettingsTab extends PluginSettingTab {
	constructor(app: App, private plugin: PensievePublisherPlugin) {
		super(app, plugin);
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		containerEl.createEl("h2", { text: "Pensieve Publisher" });
		containerEl.createEl("p", {
			text: "Publish the current note to your Pensieve (EmDash) site. Optionally cross-post to Facebook.",
			cls: "setting-item-description",
		});

		new Setting(containerEl)
			.setName("Site URL")
			.setDesc("The base URL of your EmDash instance (no trailing slash).")
			.addText((text) =>
				text
					.setPlaceholder("https://huuloc.com")
					.setValue(this.plugin.settings.baseUrl)
					.onChange(async (value) => {
						this.plugin.settings.baseUrl = value.replace(/\/$/, "");
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName("API token")
			.setDesc(
				"Generate a long-lived token from the admin UI (Settings → API tokens). Stored in plugin data, treat this device as trusted.",
			)
			.addText((text) => {
				text
					.setPlaceholder("ec_at_…")
					.setValue(this.plugin.settings.apiToken)
					.onChange(async (value) => {
						this.plugin.settings.apiToken = value.trim();
						await this.plugin.saveSettings();
					});
				text.inputEl.type = "password";
			});

		new Setting(containerEl)
			.setName("Default language")
			.setDesc("Used when the note's frontmatter doesn't specify one.")
			.addDropdown((dd) =>
				dd
					.addOption("vi", "Tiếng Việt")
					.addOption("en", "English")
					.setValue(this.plugin.settings.defaultLanguage)
					.onChange(async (value) => {
						this.plugin.settings.defaultLanguage = value === "en" ? "en" : "vi";
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName("Default category slug")
			.setDesc("Applied when the note doesn't specify a `category` in frontmatter. Leave empty to skip.")
			.addText((text) =>
				text
					.setPlaceholder("personal-stories")
					.setValue(this.plugin.settings.defaultCategory)
					.onChange(async (value) => {
						this.plugin.settings.defaultCategory = value.trim();
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName("Default publish status")
			.addDropdown((dd) =>
				dd
					.addOption("published", "Published")
					.addOption("draft", "Draft")
					.setValue(this.plugin.settings.defaultStatus)
					.onChange(async (value) => {
						this.plugin.settings.defaultStatus = value === "draft" ? "draft" : "published";
						await this.plugin.saveSettings();
					}),
			);

		containerEl.createEl("h3", { text: "Facebook cross-post" });
		containerEl.createEl("p", {
			text: "After publishing to Pensieve, optionally post the link to a Facebook page. Requires a page access token with pages_manage_posts scope.",
			cls: "setting-item-description",
		});

		new Setting(containerEl)
			.setName("Auto cross-post to Facebook")
			.setDesc("When on, Publish will also post to Facebook. You can still publish-without-FB via the 'Publish (Pensieve only)' command.")
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.autoCrossPostFacebook)
					.onChange(async (value) => {
						this.plugin.settings.autoCrossPostFacebook = value;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName("Facebook page ID")
			.addText((text) =>
				text
					.setPlaceholder("123456789012345")
					.setValue(this.plugin.settings.facebookPageId)
					.onChange(async (value) => {
						this.plugin.settings.facebookPageId = value.trim();
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName("Facebook page access token")
			.setDesc("Long-lived page access token. Treat like a password.")
			.addText((text) => {
				text
					.setPlaceholder("EAAG…")
					.setValue(this.plugin.settings.facebookAccessToken)
					.onChange(async (value) => {
						this.plugin.settings.facebookAccessToken = value.trim();
						await this.plugin.saveSettings();
					});
				text.inputEl.type = "password";
			});
	}
}
