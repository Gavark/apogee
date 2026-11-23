/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Verdict_QuestionInputs */



/**
* | output |
* | --- |
* | "Opened at the right time?" |
*
* @param {Verdict_QuestionInputs} inputs
* @param {{ locale?: "fr" | "en" }} options
* @returns {LocalizedString}
*/
export const verdict_question = /** @type {((inputs?: Verdict_QuestionInputs, options?: { locale?: "fr" | "en" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Verdict_QuestionInputs, { locale?: "fr" | "en" }, {}>} */ ((inputs = {}, options = {}) => {
	void inputs;
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return /** @type {LocalizedString} */ ("Opened at the right time?")
	return /** @type {LocalizedString} */ ("Ouverte au bon moment ?")
});