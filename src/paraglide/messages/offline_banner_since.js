/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{ date: NonNullable<unknown> }} Offline_Banner_SinceInputs */



/**
* | output |
* | --- |
* | "Offline — data from {date}" |
*
* @param {Offline_Banner_SinceInputs} inputs
* @param {{ locale?: "fr" | "en" }} options
* @returns {LocalizedString}
*/
export const offline_banner_since = /** @type {((inputs: Offline_Banner_SinceInputs, options?: { locale?: "fr" | "en" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Offline_Banner_SinceInputs, { locale?: "fr" | "en" }, {}>} */ ((i, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return /** @type {LocalizedString} */ (`Offline — data from ${i?.date}`)
	return /** @type {LocalizedString} */ (`Hors ligne — données du ${i?.date}`)
});