/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Setup_Household_HintInputs */



/**
* | output |
* | --- |
* | "For example \"Jo's place\". The people you invite will share this cellar." |
*
* @param {Setup_Household_HintInputs} inputs
* @param {{ locale?: "fr" | "en" }} options
* @returns {LocalizedString}
*/
export const setup_household_hint = /** @type {((inputs?: Setup_Household_HintInputs, options?: { locale?: "fr" | "en" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Setup_Household_HintInputs, { locale?: "fr" | "en" }, {}>} */ ((inputs = {}, options = {}) => {
	void inputs;
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return /** @type {LocalizedString} */ ("For example \"Jo's place\". The people you invite will share this cellar.")
	return /** @type {LocalizedString} */ ("Par exemple « Chez Jo ». Les personnes que vous inviterez partageront cette cave.")
});