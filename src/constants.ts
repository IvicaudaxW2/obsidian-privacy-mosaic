// Regex to match ++content++ syntax (non-greedy, supports multiline inline)
export const MOSAIC_REGEX = /\+\+([\s\S]+?)\+\+/g;

// Regex to detect image markdown syntax inside ++...++
// Matches: ![alt](url), ![[internal-file]], ![[internal-file|alias]]
export const IMAGE_SYNTAX_REGEX = /^!\[.*?\]\(.*?\)$|^!\[\[.*?\]\]$/;

// CSS class names
export const MOSAIC_BLUR_CLASS = "mosaic-blur";
export const MOSAIC_DELIMITER_CLASS = "mosaic-delimiter";
export const MOSAIC_REVEALED_CLASS = "mosaic-revealed";
export const MOSAIC_ALL_REVEALED_CLASS = "mosaic-all-revealed";
export const MOSAIC_HOVER_MODE_CLASS = "mosaic-hover-mode";
export const MOSAIC_IMAGE_WRAPPER_CLASS = "mosaic-blur-image";

// HTML tags to scan in reading mode post-processor
export const ALLOWED_TAGS = "p, li, h1, h2, h3, h4, h5, h6, blockquote, em, strong, b, i, a, th, td, span, div";

// Settings interface
export interface MosaicSpoilerSettings {
	revealMode: "hover" | "dblclick";
	blurStrength: number;
	transitionDuration: number;
	enableInEditMode: boolean;
}

// Default settings
export const DEFAULT_SETTINGS: MosaicSpoilerSettings = {
	revealMode: "hover",
	blurStrength: 8,
	transitionDuration: 200,
	enableInEditMode: true,
};
