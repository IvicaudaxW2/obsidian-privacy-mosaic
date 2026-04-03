import {
	MOSAIC_REGEX,
	MOSAIC_BLUR_CLASS,
	MOSAIC_REVEALED_CLASS,
	ALLOWED_TAGS,
} from "./constants";
import type MosaicSpoilerPlugin from "./main";

/**
 * Creates a markdown post-processor for Reading mode.
 * Finds ++content++ patterns in rendered HTML and wraps them in blur spans.
 */
export function createReadingModeProcessor(plugin: MosaicSpoilerPlugin) {
	return (el: HTMLElement): void => {
		// Process image embeds first, before text nodes consume the ++ markers.
		processImageEmbeds(el, plugin);

		// Then process text nodes.
		const elements = el.querySelectorAll<HTMLElement>(ALLOWED_TAGS);
		const targets: HTMLElement[] = [el, ...Array.from(elements)];

		for (const target of targets) {
			processTextNodes(target, plugin);
		}
	};
}

/**
 * Walk through text nodes in an element and wrap ++content++ matches in blur spans.
 */
function processTextNodes(
	element: HTMLElement,
	plugin: MosaicSpoilerPlugin
): void {
	const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT, null);
	const textNodes: Text[] = [];

	let node: Text | null;
	while ((node = walker.nextNode() as Text | null)) {
		if (node.textContent && MOSAIC_REGEX.test(node.textContent)) {
			textNodes.push(node);
		}
		// Reset regex lastIndex since it's global.
		MOSAIC_REGEX.lastIndex = 0;
	}

	for (const textNode of textNodes) {
		replaceTextNode(textNode, plugin);
	}
}

/**
 * Replace a single text node containing ++content++ with a fragment
 * that has blur spans for matched content.
 */
function replaceTextNode(textNode: Text, plugin: MosaicSpoilerPlugin): void {
	const text = textNode.textContent;
	if (!text) return;

	const fragment = document.createDocumentFragment();
	let lastIndex = 0;
	let match: RegExpExecArray | null;

	MOSAIC_REGEX.lastIndex = 0;
	while ((match = MOSAIC_REGEX.exec(text)) !== null) {
		// Add text before the match.
		if (match.index > lastIndex) {
			fragment.appendChild(
				document.createTextNode(text.slice(lastIndex, match.index))
			);
		}

		// Create a blur span for the matched content, without ++ delimiters.
		const content = match[1];
		const span = createBlurSpan(content, plugin);
		fragment.appendChild(span);

		lastIndex = match.index + match[0].length;
	}

	// Add remaining text after the last match.
	if (lastIndex < text.length) {
		fragment.appendChild(document.createTextNode(text.slice(lastIndex)));
	}

	// Replace the original text node only if we found matches.
	if (lastIndex > 0 && textNode.parentNode) {
		textNode.parentNode.replaceChild(fragment, textNode);
	}
}

/**
 * Process image embeds that are flanked by ++ text markers.
 * Handles: ++<img>++, ++<.internal-embed>++, and ++<span with image>++
 *
 * Supports patterns like:
 *   ++![alt](url)++      -> text "++" + <img> + text "++"
 *   ++![[file.png]]++    -> text "++" + <span.internal-embed> + text "++"
 */
function processImageEmbeds(
	container: HTMLElement,
	plugin: MosaicSpoilerPlugin
): void {
	// Find all image-like elements.
	const embeds = container.querySelectorAll<HTMLElement>(
		".internal-embed, img"
	);

	for (const embed of Array.from(embeds)) {
		// Skip images already processed.
		if (embed.closest(`.${MOSAIC_BLUR_CLASS}`)) continue;

		const prev = embed.previousSibling;
		const next = embed.nextSibling;

		if (!prev || !next) continue;

		let prevText: string | null = null;
		let nextText: string | null = null;
		let prevNode: Node = prev;
		let nextNode: Node = next;

		// Get text content from adjacent nodes.
		if (prev.nodeType === Node.TEXT_NODE) {
			prevText = prev.textContent || "";
		} else if (prev.nodeType === Node.ELEMENT_NODE) {
			const el = prev as HTMLElement;
			if (el.textContent?.endsWith("++")) {
				prevText = el.textContent;
			}
		}

		if (next.nodeType === Node.TEXT_NODE) {
			nextText = next.textContent || "";
		} else if (next.nodeType === Node.ELEMENT_NODE) {
			const el = next as HTMLElement;
			if (el.textContent?.startsWith("++")) {
				nextText = el.textContent;
			}
		}

		if (prevText === null || nextText === null) continue;

		if (prevText.endsWith("++") && nextText.startsWith("++")) {
			const prevContentWithoutMarker = prevText.slice(0, -2);
			const nextContentWithoutMarker = nextText.slice(2);
			const isBlockLikeEmbed =
				(embed.matches(".internal-embed, .image-embed, .media-embed") &&
					!embed.matches("img")) ||
				isStandaloneReadingImage(
					embed,
					prevNode,
					nextNode,
					prevContentWithoutMarker,
					nextContentWithoutMarker
				);

			// Remove the ++ markers from adjacent nodes.
			if (prevNode.nodeType === Node.TEXT_NODE) {
				prevNode.textContent = prevContentWithoutMarker;
			} else {
				(prevNode as HTMLElement).textContent = prevContentWithoutMarker;
			}

			if (nextNode.nodeType === Node.TEXT_NODE) {
				nextNode.textContent = nextContentWithoutMarker;
			} else {
				(nextNode as HTMLElement).textContent = nextContentWithoutMarker;
			}

			// Wrap the embed in a blur container.
			const wrapper = document.createElement("span");
			wrapper.className = isBlockLikeEmbed
				? `${MOSAIC_BLUR_CLASS} mosaic-reading-image-block`
				: `${MOSAIC_BLUR_CLASS} mosaic-reading-image-inline`;
			wrapper.style.display = isBlockLikeEmbed ? "block" : "inline-block";
			embed.parentNode?.insertBefore(wrapper, embed);
			wrapper.appendChild(embed);

			attachRevealListener(wrapper, plugin);
		}
	}

	// Also handle block-level embeds.
	const blockEmbeds = container.querySelectorAll<HTMLElement>(
		".internal-embed[src], .image-embed"
	);

	for (const embed of Array.from(blockEmbeds)) {
		if (embed.closest(`.${MOSAIC_BLUR_CLASS}`)) continue;

		const prevEl = embed.previousElementSibling;
		const nextEl = embed.nextElementSibling;

		if (!prevEl || !nextEl) continue;

		const prevContent = prevEl.textContent || "";
		const nextContent = nextEl.textContent || "";

		if (prevContent.endsWith("++") && nextContent.startsWith("++")) {
			prevEl.textContent = prevContent.slice(0, -2);
			nextEl.textContent = nextContent.slice(2);

			const wrapper = document.createElement("div");
			wrapper.className = `${MOSAIC_BLUR_CLASS} mosaic-reading-image-block`;
			embed.parentNode?.insertBefore(wrapper, embed);
			wrapper.appendChild(embed);

			attachRevealListener(wrapper, plugin);
		}
	}
}

function isStandaloneReadingImage(
	embed: HTMLElement,
	prevNode: Node,
	nextNode: Node,
	prevContentWithoutMarker: string,
	nextContentWithoutMarker: string
): boolean {
	if (embed.tagName !== "IMG") return false;
	if (prevContentWithoutMarker.trim() !== "") return false;
	if (nextContentWithoutMarker.trim() !== "") return false;

	const parent = embed.parentElement;
	if (!parent) return false;

	const visibleChildren = Array.from(parent.childNodes).filter((node) => {
		if (node === prevNode || node === nextNode) return false;
		if (node === embed) return true;
		if (node.nodeType === Node.TEXT_NODE) {
			return (node.textContent || "").trim() !== "";
		}
		return !isLineBreak(node);
	});

	return visibleChildren.length === 1 && visibleChildren[0] === embed;
}

function isLineBreak(node: Node): boolean {
	return node.nodeType === Node.ELEMENT_NODE &&
		(node as HTMLElement).tagName === "BR";
}

/**
 * Create a blur span element with the given text content.
 */
function createBlurSpan(
	content: string,
	plugin: MosaicSpoilerPlugin
): HTMLSpanElement {
	const span = document.createElement("span");
	span.className = MOSAIC_BLUR_CLASS;
	span.textContent = content;
	attachRevealListener(span, plugin);
	return span;
}

/**
 * Attach the appropriate reveal listener based on current settings.
 */
function attachRevealListener(el: HTMLElement, plugin: MosaicSpoilerPlugin): void {
	// For hover mode, CSS handles the reveal, so no JS listener is needed.
	// For double-click mode, toggle the revealed class.
	el.addEventListener("dblclick", (e) => {
		if (plugin.settings.revealMode === "dblclick") {
			e.preventDefault();
			e.stopPropagation();
			el.classList.toggle(MOSAIC_REVEALED_CLASS);
		}
	});
}
