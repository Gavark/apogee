/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Error_GenericInputs */



/**
* | output |
* | --- |
* | "Something went wrong. Please try again in a moment." |
*
* @param {Error_GenericInputs} inputs
* @param {{ locale?: "fr" | "en" }} options
* @returns {LocalizedString}
*/
export const error_generic = /** @type {((inputs?: Error_GenericInputs, options?: { locale?: "fr" | "en" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Error_GenericInputs, { locale?: "fr" | "en" }, {}>} */ ((inputs = {}, options = {}) => {
	void inputs;
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return /** @type {LocalizedString} */ ("Something went wrong. Please try again in a moment.")
	return /** @type {LocalizedString} */ ("Une erreur est survenue. Réessayez dans un instant.")
});