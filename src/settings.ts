import { App, PluginSettingTab, Setting } from "obsidian";
import type MosaicSpoilerPlugin from "./main";

export class MosaicSpoilerSettingTab extends PluginSettingTab {
	plugin: MosaicSpoilerPlugin;

	constructor(app: App, plugin: MosaicSpoilerPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		new Setting(containerEl)
			.setName("Enable in editing mode")
			.setDesc(
				"Apply mosaic blur in Live Preview (editing) mode. When disabled, blur only works in reading mode."
			)
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.enableInEditMode)
					.onChange(async (value) => {
						this.plugin.settings.enableInEditMode = value;
						await this.plugin.saveSettings();
						this.plugin.refreshEditorExtension();
					})
			);

		new Setting(containerEl)
			.setName("Reveal mode")
			.setDesc(
				"How to reveal blurred content. Hover mode auto-reveals on mouse over; Double-click mode requires a double-click to toggle."
			)
			.addDropdown((dropdown) =>
				dropdown
					.addOption("hover", "Hover")
					.addOption("dblclick", "Double-click")
					.setValue(this.plugin.settings.revealMode)
					.onChange(async (value) => {
						this.plugin.settings.revealMode = value as "hover" | "dblclick";
						await this.plugin.saveSettings();
						this.plugin.applyRevealModeClass();
					})
			);

		new Setting(containerEl)
			.setName("Blur strength")
			.setDesc("The intensity of the blur effect in pixels (1-20).")
			.addSlider((slider) =>
				slider
					.setLimits(1, 20, 1)
					.setValue(this.plugin.settings.blurStrength)
					.setDynamicTooltip()
					.onChange(async (value) => {
						this.plugin.settings.blurStrength = value;
						await this.plugin.saveSettings();
						this.plugin.updateCSSVariables();
					})
			);

		new Setting(containerEl)
			.setName("Transition duration")
			.setDesc(
				"How long the blur/reveal animation takes in milliseconds (0-500)."
			)
			.addSlider((slider) =>
				slider
					.setLimits(0, 500, 10)
					.setValue(this.plugin.settings.transitionDuration)
					.setDynamicTooltip()
					.onChange(async (value) => {
						this.plugin.settings.transitionDuration = value;
						await this.plugin.saveSettings();
						this.plugin.updateCSSVariables();
					})
			);
	}
}
