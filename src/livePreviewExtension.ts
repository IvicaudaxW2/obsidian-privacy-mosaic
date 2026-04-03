import {
	Decoration,
	DecorationSet,
	EditorView,
	PluginValue,
	ViewPlugin,
	ViewUpdate,
	WidgetType,
} from "@codemirror/view";
import { RangeSetBuilder } from "@codemirror/state";
import type { Extension } from "@codemirror/state";
import {
	MOSAIC_REGEX,
	MOSAIC_BLUR_CLASS,
	MOSAIC_REVEALED_CLASS,
	IMAGE_SYNTAX_REGEX,
} from "./constants";
import type MosaicSpoilerPlugin from "./main";

/* Decorations */

/** Hides ++ delimiter text. */
const HIDE_DECO = Decoration.replace({});

/** Wraps text content in <span class="mosaic-blur"> for CSS blur. */
const BLUR_MARK = Decoration.mark({ class: MOSAIC_BLUR_CLASS });

/**
 * Invisible marker widget placed where ++ was for images.
 * Used as DOM anchors to locate and blur nearby images.
 */
class ImgMarkerWidget extends WidgetType {
	constructor(readonly side: "open" | "close") {
		super();
	}

	eq(other: ImgMarkerWidget): boolean {
		return this.side === other.side;
	}

	toDOM(): HTMLElement {
		const span = document.createElement("span");
		span.className = `mosaic-img-${this.side}`;
		return span;
	}

	ignoreEvent(): boolean {
		return true;
	}
}

const IMG_OPEN_DECO = Decoration.replace({
	widget: new ImgMarkerWidget("open"),
});

const IMG_CLOSE_DECO = Decoration.replace({
	widget: new ImgMarkerWidget("close"),
});

/* Helpers */

function isImageSyntax(content: string): boolean {
	return IMAGE_SYNTAX_REGEX.test(content.trim());
}

function isCursorOnLine(view: EditorView, from: number, to: number): boolean {
	try {
		const fromLine = view.state.doc.lineAt(from).number;
		const toLine = view.state.doc.lineAt(to).number;
		for (const range of view.state.selection.ranges) {
			const curLine = view.state.doc.lineAt(range.head).number;
			if (curLine >= fromLine && curLine <= toLine) return true;
		}
	} catch {
		return true;
	}
	return false;
}

interface DecoRange {
	from: number;
	to: number;
	deco: Decoration;
}

/* Main extension */

/**
 * CM6 extension for Live Preview and Source mode.
 *
 * TEXT: Decoration.mark() wraps text in <span class="mosaic-blur">.
 * IMAGE: Marker widgets plus DOM-based blur handling.
 *        Decoration.mark() cannot wrap Obsidian's block-level embed widgets,
 *        so images are blurred via direct DOM class manipulation.
 */
export function createLivePreviewExtension(
	plugin: MosaicSpoilerPlugin
): Extension {
	return ViewPlugin.fromClass(
		class implements PluginValue {
			decorations: DecorationSet;
			private editorView: EditorView;
			private hasImages = false;
			private measureScheduled = false;
			private readonly blurredTargets = new Set<HTMLElement>();

			constructor(view: EditorView) {
				this.editorView = view;
				this.decorations = this.build(view);
				view.dom.addEventListener("dblclick", this.onDblClick);
				if (this.hasImages) this.scheduleImageBlur(view);
			}

			update(update: ViewUpdate): void {
				if (
					update.docChanged ||
					update.viewportChanged ||
					update.selectionSet
				) {
					this.decorations = this.build(update.view);
					if (this.hasImages) {
						this.scheduleImageBlur(update.view);
					} else {
						this.cleanupImageBlur();
					}
				}
			}

			destroy(): void {
				this.editorView.dom.removeEventListener(
					"dblclick",
					this.onDblClick
				);
				this.measureScheduled = false;
				this.cleanupImageBlur();
			}

			/** Event delegation: double-click on any .mosaic-blur toggles reveal. */
			private onDblClick = (e: MouseEvent): void => {
				if (plugin.settings.revealMode !== "dblclick") return;
				const blurEl = (e.target as HTMLElement).closest(
					`.${MOSAIC_BLUR_CLASS}`
				);
				if (blurEl instanceof HTMLElement) {
					e.preventDefault();
					blurEl.classList.toggle(MOSAIC_REVEALED_CLASS);
				}
			};

			/* Build decorations */

			build(view: EditorView): DecorationSet {
				if (!plugin.settings.enableInEditMode) {
					this.hasImages = false;
					return Decoration.none;
				}

				const ranges: DecoRange[] = [];
				let foundImages = false;

				// Iterate over full line text in the viewport, not visibleRanges.
				// visibleRanges excludes text hidden by widget replacements, which
				// breaks matching for rendered embeds.
				const { from: vpFrom, to: vpTo } = view.viewport;
				let pos = vpFrom;

				while (pos <= vpTo) {
					let line;
					try {
						line = view.state.doc.lineAt(pos);
					} catch {
						break;
					}

					const lineText = line.text;
					MOSAIC_REGEX.lastIndex = 0;
					let match: RegExpExecArray | null;

					while ((match = MOSAIC_REGEX.exec(lineText)) !== null) {
						try {
							const content = match[1];
							const mFrom = line.from + match.index;
							const mTo = mFrom + match[0].length;
							const cFrom = mFrom + 2;
							const cTo = mTo - 2;

							if (cFrom >= cTo) continue;
							if (isCursorOnLine(view, mFrom, mTo)) continue;

							if (isImageSyntax(content)) {
								// IMAGE: use marker widgets around the inner content.
								foundImages = true;
								ranges.push({
									from: mFrom,
									to: cFrom,
									deco: IMG_OPEN_DECO,
								});
								ranges.push({
									from: cFrom,
									to: cTo,
									deco: BLUR_MARK,
								});
								ranges.push({
									from: cTo,
									to: mTo,
									deco: IMG_CLOSE_DECO,
								});
							} else {
								// TEXT: hide ++ and blur the inner content.
								ranges.push({
									from: mFrom,
									to: cFrom,
									deco: HIDE_DECO,
								});
								ranges.push({
									from: cFrom,
									to: cTo,
									deco: BLUR_MARK,
								});
								ranges.push({
									from: cTo,
									to: mTo,
									deco: HIDE_DECO,
								});
							}
						} catch {
							continue;
						}
					}

					pos = line.to + 1;
				}

				this.hasImages = foundImages;

				ranges.sort((a, b) => a.from - b.from || a.to - b.to);
				const builder = new RangeSetBuilder<Decoration>();
				for (const r of ranges) builder.add(r.from, r.to, r.deco);
				return builder.finish();
			}

			/* DOM-based image blur */

			scheduleImageBlur(view: EditorView): void {
				if (this.measureScheduled) return;
				this.measureScheduled = true;
				view.requestMeasure({
					read: () => null,
					write: () => {
						this.measureScheduled = false;
						this.applyImageBlur(view);
					},
				});
			}

			cleanupImageBlur(): void {
				for (const el of this.blurredTargets) {
					el.classList.remove(
						MOSAIC_BLUR_CLASS,
						"mosaic-img-blurred",
						MOSAIC_REVEALED_CLASS
					);
				}
				this.blurredTargets.clear();
			}

			applyImageBlur(view: EditorView): void {
				const nextBlurredTargets = new Set<HTMLElement>();
				const openMarkers = view.dom.querySelectorAll(".mosaic-img-open");

				for (const marker of Array.from(openMarkers)) {
					try {
						const line = marker.closest(".cm-line");
						if (!line) continue;

						// Case 1: Obsidian embed container in the same .cm-line.
						const embed = line.querySelector(
							".internal-embed, .image-embed"
						);
						if (embed) {
							this.collectBlurTarget(embed, nextBlurredTargets);
							continue;
						}

						// Case 1b: standalone img, but not a CM widget buffer.
						const img = line.querySelector("img:not(.cm-widgetBuffer)");
						if (img) {
							this.collectBlurTarget(img, nextBlurredTargets);
							continue;
						}

						// Case 2: block embed, walk siblings until the embed is found.
						let next = line.nextElementSibling;
						while (next) {
							if (next.classList.contains("cm-embed-block")) {
								this.collectBlurTarget(next, nextBlurredTargets);
								break;
							}

							const nestedEmbed = next.querySelector(
								".internal-embed, .image-embed"
							);
							if (nestedEmbed) {
								this.collectBlurTarget(
									nestedEmbed,
									nextBlurredTargets
								);
								break;
							}

							// Stop if we hit a content line without a close marker.
							if (
								next.classList.contains("cm-line") &&
								!next.querySelector(".mosaic-img-close")
							) {
								break;
							}

							next = next.nextElementSibling;
						}
					} catch {
						/* skip */
					}
				}

				for (const el of this.blurredTargets) {
					if (!nextBlurredTargets.has(el)) {
						el.classList.remove(
							MOSAIC_BLUR_CLASS,
							"mosaic-img-blurred",
							MOSAIC_REVEALED_CLASS
						);
					}
				}

				for (const el of nextBlurredTargets) {
					if (!this.blurredTargets.has(el)) {
						el.classList.add(MOSAIC_BLUR_CLASS, "mosaic-img-blurred");
					}
				}

				this.blurredTargets.clear();
				for (const el of nextBlurredTargets) {
					this.blurredTargets.add(el);
				}
			}

			/** Collect an element that should stay blurred. */
			private collectBlurTarget(
				el: Element | null,
				targets: Set<HTMLElement>
			): void {
				if (!(el instanceof HTMLElement)) return;
				targets.add(el);
			}
		},
		{
			decorations: (v) => v.decorations,
		}
	);
}
