/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Setup_IntroInputs */



/**
* | output |
* | --- |
* | "Create the administrator account and the first household for this installation." |
*
* @param {Setup_IntroInputs} inputs
* @param {{ locale?: "fr" | "en" }} options
* @returns {LocalizedString}
*/
export const setup_intro = /** @type {((inputs?: Setup_IntroInputs, options?: { locale?: "fr" | "en" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Setup_IntroInputs, { locale?: "fr" | "en" }, {}>} */ ((inputs = {}, options = {}) => {
	void inputs;
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return /** @type {LocalizedString} */ ("Create the administrator account and the first household for this installation.")
	return /** @type {LocalizedString} */ ("Créez le compte administrateur et le premier foyer de cette installation.")
});