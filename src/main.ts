import { Editor, Plugin } from "obsidian";
import type { Extension } from "@codemirror/state";
import {
	DEFAULT_SETTINGS,
	MOSAIC_ALL_REVEALED_CLASS,
	MOSAIC_HOVER_MODE_CLASS,
} from "./constants";
import type { MosaicSpoilerSettings } from "./constants";
import { MosaicSpoilerSettingTab } from "./settings";
import { createReadingModeProcessor } from "./readingModeProcessor";
import { createLivePreviewExtension } from "./livePreviewExtension";

export default class MosaicSpoilerPlugin extends Plugin {
	settings: MosaicSpoilerSettings = DEFAULT_SETTINGS;
	private editorExtensions: Extension[] = [];

	async onload(): Promise<void> {
		await this.loadSettings();

		// Set initial CSS variables and body classes
		this.updateCSSVariables();
		this.applyRevealModeClass();

		// Register reading mode post-processor
		this.registerMarkdownPostProcessor(createReadingModeProcessor(this));

		// Register CM6 editor extension for live preview
		this.editorExtensions.push(createLivePreviewExtension(this));
		this.registerEditorExtension(this.editorExtensions);

		// Command: Toggle mosaic on selection
		this.addCommand({
			id: "toggle-mosaic-selection",
			name: "Toggle mosaic on selection",
			editorCallback: (editor: Editor) => {
				const selection = editor.getSelection();
				if (!selection) return;

				if (selection.startsWith("++") && selection.endsWith("++") && selection.length > 4) {
					// Unwrap: remove ++ from both ends
					editor.replaceSelection(selection.slice(2, -2));
				} else {
					// Wrap: add ++ around selection
					editor.replaceSelection(`++${selection}++`);
				}
			},
		});

		// Command: Reveal/hide all mosaic
		this.addCommand({
			id: "reveal-hide-all-mosaic",
			name: "Reveal/hide all mosaic",
			callback: () => {
				document.body.classList.toggle(MOSAIC_ALL_REVEALED_CLASS);
			},
		});

		// Register settings tab
		this.addSettingTab(new MosaicSpoilerSettingTab(this.app, this));
	}

	onunload(): void {
		// Clean up body classes and CSS variables
		document.body.classList.remove(MOSAIC_HOVER_MODE_CLASS);
		document.body.classList.remove(MOSAIC_ALL_REVEALED_CLASS);
		document.body.style.removeProperty("--mosaic-blur-strength");
		document.body.style.removeProperty("--mosaic-transition-duration");

		// Clear editor extensions
		this.editorExtensions.length = 0;
		this.app.workspace.updateOptions();
	}

	async loadSettings(): Promise<void> {
		const loadedData = (await this.loadData()) as
			| Partial<MosaicSpoilerSettings>
			| null;
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			loadedData ?? {}
		);
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
	}

	/**
	 * Force editor extensions to re-evaluate (e.g. when enableInEditMode changes).
	 */
	refreshEditorExtension(): void {
		this.app.workspace.updateOptions();
	}

	/**
	 * Update CSS custom properties on document.body based on current settings.
	 */
	updateCSSVariables(): void {
		document.body.style.setProperty(
			"--mosaic-blur-strength",
			`${this.settings.blurStrength}px`
		);
		document.body.style.setProperty(
			"--mosaic-transition-duration",
			`${this.settings.transitionDuration}ms`
		);
	}

	/**
	 * Toggle the hover-mode class on document.body.
	 */
	applyRevealModeClass(): void {
		document.body.classList.toggle(
			MOSAIC_HOVER_MODE_CLASS,
			this.settings.revealMode === "hover"
		);
	}
}
