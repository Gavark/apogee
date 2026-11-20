/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Loc_IntroInputs */



/**
* | output |
* | --- |
* | "The places where you keep your bottles." |
*
* @param {Loc_IntroInputs} inputs
* @param {{ locale?: "fr" | "en" }} options
* @returns {LocalizedString}
*/
export const loc_intro = /** @type {((inputs?: Loc_IntroInputs, options?: { locale?: "fr" | "en" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Loc_IntroInputs, { locale?: "fr" | "en" }, {}>} */ ((inputs = {}, options = {}) => {
	void inputs;
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return /** @type {LocalizedString} */ ("The places where you keep your bottles.")
	return /** @type {LocalizedString} */ ("Les endroits où vous rangez vos bouteilles.")
});