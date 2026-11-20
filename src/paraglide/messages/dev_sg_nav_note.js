/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Dev_Sg_Nav_NoteInputs */



/**
* | output |
* | --- |
* | "On this page the bar is pinned to the bottom of the screen." |
*
* @param {Dev_Sg_Nav_NoteInputs} inputs
* @param {{ locale?: "fr" | "en" }} options
* @returns {LocalizedString}
*/
export const dev_sg_nav_note = /** @type {((inputs?: Dev_Sg_Nav_NoteInputs, options?: { locale?: "fr" | "en" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Dev_Sg_Nav_NoteInputs, { locale?: "fr" | "en" }, {}>} */ ((inputs = {}, options = {}) => {
	void inputs;
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return /** @type {LocalizedString} */ ("On this page the bar is pinned to the bottom of the screen.")
	return /** @type {LocalizedString} */ ("La barre est fixée en bas de l'écran sur cette page.")
});