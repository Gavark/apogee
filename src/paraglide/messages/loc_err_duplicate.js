/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Loc_Err_DuplicateInputs */



/**
* | output |
* | --- |
* | "A location already has this name." |
*
* @param {Loc_Err_DuplicateInputs} inputs
* @param {{ locale?: "fr" | "en" }} options
* @returns {LocalizedString}
*/
export const loc_err_duplicate = /** @type {((inputs?: Loc_Err_DuplicateInputs, options?: { locale?: "fr" | "en" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Loc_Err_DuplicateInputs, { locale?: "fr" | "en" }, {}>} */ ((inputs = {}, options = {}) => {
	void inputs;
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return /** @type {LocalizedString} */ ("A location already has this name.")
	return /** @type {LocalizedString} */ ("Un lieu porte déjà ce nom.")
});