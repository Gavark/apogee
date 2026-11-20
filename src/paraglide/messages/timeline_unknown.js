/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Timeline_UnknownInputs */



/**
* | output |
* | --- |
* | "Window to estimate" |
*
* @param {Timeline_UnknownInputs} inputs
* @param {{ locale?: "fr" | "en" }} options
* @returns {LocalizedString}
*/
export const timeline_unknown = /** @type {((inputs?: Timeline_UnknownInputs, options?: { locale?: "fr" | "en" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Timeline_UnknownInputs, { locale?: "fr" | "en" }, {}>} */ ((inputs = {}, options = {}) => {
	void inputs;
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return /** @type {LocalizedString} */ ("Window to estimate")
	return /** @type {LocalizedString} */ ("Fenêtre à estimer")
});